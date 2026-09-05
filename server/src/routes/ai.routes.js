import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { askEvidenceMd, AiEngineError } from '../lib/evidencemd.js';
import { runTrackedAi } from '../lib/aiTelemetry.js';
import { describeImage, structureLabText, SUPPORTED_IMAGE_TYPES } from '../lib/vision.js';
import { extractPdfText, ocrImage, SUPPORTED_DOCUMENT_TYPES } from '../lib/ocr.js';
import { buildVisionHandoff, buildDoctorTurnContext, sanitizeDoctorReply } from '../lib/prompts.js';
import { calculateAge, withPatientAiContext } from '../lib/patient.js';
import { buildSymptomPrompt, formatSymptomRecordKa, runSymptomCheck } from '../lib/symptomCheck.js';
import { saveUpload } from '../lib/storage.js';
import { extractLabFromText } from '../lib/labExtract.js';
import { alignLabAnalytes } from '../lib/labAlign.js';
import { requireAuth } from '../middleware/auth.js';
import { enforceAiQuota } from '../middleware/aiLimiter.js';
import { getUsage } from '../lib/usage.js';
import { asyncHandler } from '../middleware/error.js';

export const aiRouter = Router();

aiRouter.use(requireAuth);

const UPLOAD_MIME_ALIASES = {
  'image/jpg': 'image/jpeg',
  'image/pjpeg': 'image/jpeg',
  'image/heic': 'image/heic',
  'image/heif': 'image/heic',
  'image/heic-sequence': 'image/heic',
};

function normalizeUploadMime(mime) {
  const raw = String(mime || '').toLowerCase().trim();
  return UPLOAD_MIME_ALIASES[raw] ?? raw;
}

/** JPEG/PNG/WEBP magic beats a lying iPhone HEIC Content-Type. */
function sniffImageMime(buffer, declared) {
  if (!buffer?.length) return declared;
  if (buffer[0] === 0xff && buffer[1] === 0xd8) return 'image/jpeg';
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e) return 'image/png';
  if (buffer.length > 12 && buffer.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  if (buffer.length > 8 && buffer.toString('ascii', 4, 8) === 'ftyp') return 'image/heic';
  return declared === 'image/jpg' ? 'image/jpeg' : declared;
}

function acceptLabUpload(req, file, cb) {
  const mime = normalizeUploadMime(file.mimetype);
  const allowed = new Set([
    ...SUPPORTED_IMAGE_TYPES,
    ...SUPPORTED_DOCUMENT_TYPES,
    'image/heic',
    'image/heif',
  ]);
  if (!allowed.has(mime) && !allowed.has(file.mimetype)) {
    cb(new AiEngineError('დაშვებულია მხოლოდ JPG, PNG, WEBP ან PDF ფაილი.', { status: 400 }));
    return;
  }
  file.mimetype = mime;
  cb(null, true);
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024, files: 1 },
  fileFilter: acceptLabUpload,
});

const uploadMany = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024, files: 8 },
  fileFilter: acceptLabUpload,
});

function formatLabTable(parameters) {
  return (parameters ?? [])
    .map((row) => {
      const range = row.refLow != null || row.refHigh != null ? `${row.refLow ?? ''}–${row.refHigh ?? ''}` : '';
      return `${row.nameKa || row.nameEn} | ${row.display} | ${row.unit ?? ''} | ${range} | ${row.flag ?? 'U'}`;
    })
    .join('\n');
}

/* ────────────────────────────────────────────────────────────────
 * POST /api/ai/query — text consultation (AI ექიმი & კონსილიუმი)
 * ──────────────────────────────────────────────────────────────── */

const querySchema = z.object({
  message: z.string().trim().min(2, 'შეკითხვა ძალიან მოკლეა').max(4000),
  mode: z.enum(['DOCTOR', 'CONSILIUM']).default('DOCTOR'),
  sessionId: z.string().uuid().optional(),
  context: z.string().trim().max(4000).optional(),
});

aiRouter.post(
  '/query',
  enforceAiQuota,
  asyncHandler(async (req, res) => {
    const { message, mode, sessionId, context } = querySchema.parse(req.body);

    const session = sessionId
      ? await prisma.chatSession.findFirst({ where: { id: sessionId, userId: req.user.id } })
      : null;

    if (sessionId && !session) {
      return res.status(404).json({ error: 'საუბარი ვერ მოიძებნა.' });
    }

    const history = Array.isArray(session?.messages) ? session.messages : [];
    // Keep the last 12 turns: enough for continuity, small enough to stay inside the context window.
    const priorTurns = history.slice(-12).map((m) => ({ role: m.role, content: m.content }));
    const userTurnCount = priorTurns.filter((m) => m.role === 'user').length + 1;
    const assistantTurnCount = priorTurns.filter((m) => m.role === 'assistant').length;

    const profileContext = await withPatientAiContext(req.user, context);
    const turnContext =
      mode === 'DOCTOR'
        ? buildDoctorTurnContext({ userTurnCount, assistantTurnCount })
        : null;
    const mergedContext = [profileContext, turnContext].filter(Boolean).join('\n\n');

    const answer = await runTrackedAi({
      userId: req.user.id,
      mode,
      chatSessionId: session?.id,
      userPrompt: message,
      fn: async () => {
        const result = await askEvidenceMd({
          mode,
          context: mergedContext || undefined,
          messages: [...priorTurns, { role: 'user', content: message }],
          temperature: mode === 'DOCTOR' ? 0.4 : 0.2,
          maxTokens: mode === 'DOCTOR' ? 900 : 2400,
        });
        if (mode === 'DOCTOR') {
          result.content = sanitizeDoctorReply(result.content);
        }
        return result;
      },
    });

    const now = new Date().toISOString();
    const nextMessages = [
      ...history,
      { role: 'user', content: message, timestamp: now },
      {
        role: 'assistant',
        content: answer.content,
        timestamp: new Date().toISOString(),
        interactionId: answer.interactionId,
      },
    ];

    const saved = session
      ? await prisma.chatSession.update({
          where: { id: session.id },
          data: { messages: nextMessages, updatedAt: new Date() },
        })
      : await prisma.chatSession.create({
          data: {
            userId: req.user.id,
            mode,
            title: buildTitle(message),
            messages: nextMessages,
          },
        });

    const usage = await req.consumeAiCredit();

    return res.json({
      sessionId: saved.id,
      title: saved.title,
      mode: saved.mode,
      answer: answer.content,
      model: answer.model,
      engine: 'evidencemd',
      interactionId: answer.interactionId,
      usage,
    });
  }),
);

/* ────────────────────────────────────────────────────────────────
 * POST /api/ai/analyze-image — lab sheets, X-ray/CT/MRI, skin & moles
 * ──────────────────────────────────────────────────────────────── */

const analyzeSchema = z.object({
  kind: z.enum(['LAB', 'IMAGING', 'SKIN']),
  context: z.string().trim().max(2000).optional(),
});

const RECORD_TYPE_BY_KIND = { LAB: 'LAB', IMAGING: 'CT_MRI', SKIN: 'SKIN' };

aiRouter.post(
  '/analyze-image',
  enforceAiQuota,
  upload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: 'ფაილი არ არის ატვირთული.' });
    }

    const { kind, context } = analyzeSchema.parse(req.body);
    const { buffer } = req.file;
    const mimetype = sniffImageMime(buffer, normalizeUploadMime(req.file.mimetype));
    const isPdf = mimetype === 'application/pdf';
    if (mimetype === 'image/heic') {
      return res.status(400).json({
        error: 'iPhone HEIC photo could not be read. Please pick the photos again.',
      });
    }

    if (isPdf && kind !== 'LAB') {
      return res.status(400).json({ error: 'PDF ფორმატი მხოლოდ ანალიზების გასაშიფრადაა დაშვებული.' });
    }

    let visionNotes;
    let extractor;

    if (isPdf) {
      const { text, pages } = await extractPdfText(buffer);
      if (text.length < 24) {
        return res.status(422).json({
          error: 'PDF-დან ტექსტის ამოკითხვა ვერ მოხერხდა. სცადეთ დოკუმენტის ფოტოს ატვირთვა.',
        });
      }
      visionNotes = `[PDF, ${pages} გვერდი]\n\n${text}`;
      extractor = { provider: 'pdf-parse', model: 'pdf-parse' };
    } else {
      const described = await describeImage({ buffer, mimeType: mimetype, kind, context }).catch(
        async (error) => {
          // If no vision provider is reachable, fall back to local OCR for lab sheets.
          if (kind !== 'LAB') throw error;
          const text = await ocrImage(buffer);
          if (!text) throw error;
          return { notes: text, provider: 'tesseract', model: 'tesseract-kat+eng+rus' };
        },
      );
      visionNotes = described.notes;
      extractor = { provider: described.provider, model: described.model };
    }

    let analysisContent = visionNotes;
    let interactionId = null;
    let reasoning = { provider: 'vision', model: extractor.model };

    // Lab sheets are extract-only here. Clinical write-up is POST /api/ai/explain-lab.
    if (kind !== 'LAB') {
      const patientAiContext = await withPatientAiContext(req.user);
      const analysis = await runTrackedAi({
        userId: req.user.id,
        mode: kind,
        userPrompt: buildVisionHandoff({ kind, visionNotes, patientContext: context }),
        visionProvider: extractor.provider,
        visionModel: extractor.model,
        fn: () =>
          askEvidenceMd({
            mode: kind,
            context: patientAiContext,
            messages: [
              { role: 'user', content: buildVisionHandoff({ kind, visionNotes, patientContext: context }) },
            ],
          }),
      });
      analysisContent = analysis.content;
      interactionId = analysis.interactionId;
      reasoning = { provider: 'evidencemd', model: analysis.model };
    }

    const imageUrl = await saveUpload(buffer, mimetype);

    const record = await prisma.medicalRecord.create({
      data: {
        userId: req.user.id,
        type: RECORD_TYPE_BY_KIND[kind],
        imageUrl,
        aiAnalysis: analysisContent,
      },
    });

    if (interactionId) {
      await prisma.aiInteraction.update({
        where: { id: interactionId },
        data: { medicalRecordId: record.id },
      });
    }

    const usage = await req.consumeAiCredit();

    return res.status(201).json({
      record: {
        id: record.id,
        type: record.type,
        imageUrl: record.imageUrl,
        aiAnalysis: record.aiAnalysis,
        createdAt: record.createdAt,
      },
      analysis: analysisContent,
      labExtract: kind === 'LAB' ? extractLabFromText(visionNotes) : undefined,
      interactionId,
      pipeline: { extractor, reasoning },
      usage,
    });
  }),
);

/* ────────────────────────────────────────────────────────────────
 * POST /api/ai/extract-lab — one OpenRouter read for one day's test
 * ──────────────────────────────────────────────────────────────── */

const extractLabSchema = z.object({
  context: z.string().trim().max(2000).optional(),
  recordId: z.string().trim().max(80).optional(),
  append: z.string().trim().optional(),
});

function isLabAppend(body) {
  return ['1', 'true', 'yes'].includes(String(body?.append ?? '').toLowerCase());
}

aiRouter.post(
  '/extract-lab',
  uploadMany.array('files', 8),
  (req, res, next) => {
    req.labAppend = isLabAppend(req.body);
    if (req.labAppend) return next();
    return enforceAiQuota(req, res, next);
  },
  asyncHandler(async (req, res) => {
    const files = req.files ?? [];
    if (!files.length) {
      return res.status(400).json({ error: 'ფაილი არ არის ატვირთული.' });
    }

    const { context, recordId } = extractLabSchema.parse(req.body ?? {});
    const images = [];
    const pdfNotes = [];

    for (const file of files) {
      const declared = normalizeUploadMime(file.mimetype);
      const isPdf =
        declared === 'application/pdf' ||
        (file.buffer?.length >= 4 && file.buffer.toString('ascii', 0, 4) === '%PDF');
      if (isPdf) {
        const { text, pages } = await extractPdfText(file.buffer);
        if (text.length < 24) {
          return res.status(422).json({
            error: 'PDF-დან ტექსტის ამოკითხვა ვერ მოხერხდა. სცადეთ დოკუმენტის ფოტოს ატვირთვა.',
          });
        }
        pdfNotes.push(`[PDF, ${pages} გვერდი]\n\n${text}`);
        continue;
      }

      const mimeType = sniffImageMime(file.buffer, declared);
      if (mimeType === 'image/heic') {
        return res.status(400).json({
          error: 'iPhone HEIC photo could not be read. Please pick the photos again.',
        });
      }
      images.push({ buffer: file.buffer, mimeType });
    }

    let visionNotes = pdfNotes.join('\n\n');
    let extractor = { provider: pdfNotes.length ? 'pdf-parse' : 'none', model: pdfNotes.length ? 'pdf-parse' : '' };

    if (images.length) {
      const parts = [];
      let last = null;
      for (const [index, image] of images.entries()) {
        const described = await describeImage({
          buffer: image.buffer,
          mimeType: image.mimeType,
          kind: 'LAB',
          patientContext: context,
        }).catch(async (error) => {
          const text = await ocrImage(image.buffer);
          if (!text) throw error;
          return { notes: text, provider: 'tesseract', model: 'tesseract-kat+eng+rus' };
        });
        parts.push(images.length > 1 ? `--- PAGE ${index + 1} ---\n${described.notes}` : described.notes);
        last = described;
      }
      visionNotes = [visionNotes, ...parts].filter(Boolean).join('\n\n');
      extractor = { provider: last?.provider ?? 'openrouter', model: last?.model ?? '' };
    }

    let labExtract = extractLabFromText(visionNotes);
    if (labExtract.parameters.length < 3 && visionNotes.length >= 24) {
      const structured = await structureLabText(visionNotes).catch(() => null);
      if (structured?.notes) {
        visionNotes = `${visionNotes}\n\n${structured.notes}`;
        labExtract = extractLabFromText(visionNotes);
        extractor = { provider: structured.provider, model: structured.model };
      }
    }

    if (req.labAppend) {
      if (!recordId) {
        return res.status(400).json({ error: 'ჩანაწერი ვერ მოიძებნა.' });
      }
      const existing = await prisma.medicalRecord.findFirst({
        where: { id: recordId, userId: req.user.id, type: 'LAB' },
      });
      if (!existing) {
        return res.status(404).json({ error: 'ჩანაწერი ვერ მოიძებნა.' });
      }
      visionNotes = [existing.aiAnalysis, visionNotes].filter(Boolean).join('\n\n--- PAGE ---\n\n');
      const labExtract = extractLabFromText(visionNotes);
      const record = await prisma.medicalRecord.update({
        where: { id: existing.id },
        data: { aiAnalysis: visionNotes },
      });
      return res.json({
        record: {
          id: record.id,
          type: record.type,
          imageUrl: record.imageUrl,
          aiAnalysis: record.aiAnalysis,
          createdAt: record.createdAt,
        },
        notes: visionNotes,
        labExtract,
        interactionId: null,
        pipeline: { extractor, reasoning: null },
        usage: await getUsage(req.user.id),
      });
    }

    const preview = images[0] ?? files[0];
    const imageUrl = preview
      ? await saveUpload(preview.buffer, preview.mimeType ?? preview.mimetype ?? 'application/pdf')
      : null;

    const record = await prisma.medicalRecord.create({
      data: {
        userId: req.user.id,
        type: 'LAB',
        imageUrl,
        aiAnalysis: visionNotes,
      },
    });

    const usage = await req.consumeAiCredit();

    return res.status(201).json({
      record: {
        id: record.id,
        type: record.type,
        imageUrl: record.imageUrl,
        aiAnalysis: record.aiAnalysis,
        createdAt: record.createdAt,
      },
      notes: visionNotes,
      labExtract,
      interactionId: null,
      pipeline: { extractor, reasoning: null },
      usage,
    });
  }),
);

/* ────────────────────────────────────────────────────────────────
 * POST /api/ai/explain-lab — one EvidenceMD write-up for a saved test
 * ──────────────────────────────────────────────────────────────── */

const explainLabSchema = z.object({
  parameters: z
    .array(
      z.object({
        key: z.string().trim().min(1).max(80),
        nameKa: z.string().trim().min(1).max(160),
        nameEn: z.string().trim().max(160).optional().default(''),
        display: z.string().trim().min(1).max(40),
        unit: z.string().trim().max(40).optional().default(''),
        value: z.number().finite().optional(),
        refLow: z.number().finite().nullable().optional(),
        refHigh: z.number().finite().nullable().optional(),
        flag: z.enum(['N', 'H', 'L', 'U']).optional(),
      }),
    )
    .min(1)
    .max(80),
  visionNotes: z.string().trim().max(40000).optional(),
  date: z.string().trim().max(32).optional(),
  context: z.string().trim().max(2000).optional(),
  recordId: z.string().trim().max(80).optional(),
});

aiRouter.post(
  '/explain-lab',
  enforceAiQuota,
  asyncHandler(async (req, res) => {
    const body = explainLabSchema.parse(req.body);
    const table = formatLabTable(body.parameters);
    const visionNotes = [
      body.date ? `DOCUMENT META\ndate: ${body.date}` : '',
      'STRUCTURED ANALYTES (already extracted — do not invent values):',
      table,
      body.visionNotes ? `OCR / vision notes:\n${body.visionNotes}` : '',
    ]
      .filter(Boolean)
      .join('\n\n');

    const patientAiContext = await withPatientAiContext(req.user);
    const analysis = await runTrackedAi({
      userId: req.user.id,
      mode: 'LAB',
      userPrompt: buildVisionHandoff({ kind: 'LAB', visionNotes, patientContext: body.context }),
      fn: () =>
        askEvidenceMd({
          mode: 'LAB',
          context: patientAiContext,
          messages: [
            { role: 'user', content: buildVisionHandoff({ kind: 'LAB', visionNotes, patientContext: body.context }) },
          ],
        }),
    });

    if (body.recordId) {
      const existing = await prisma.medicalRecord.findFirst({
        where: { id: body.recordId, userId: req.user.id },
      });
      if (existing) {
        await prisma.medicalRecord.update({
          where: { id: existing.id },
          data: { aiAnalysis: analysis.content },
        });
      }
    }

    const usage = await req.consumeAiCredit();

    return res.json({
      analysis: analysis.content,
      interactionId: analysis.interactionId,
      usage,
    });
  }),
);

/* ────────────────────────────────────────────────────────────────
 * POST /api/ai/align-lab — remap French/OCR names onto the catalog
 * ──────────────────────────────────────────────────────────────── */

const alignLabSchema = z.object({
  analytes: z
    .array(
      z.object({
        key: z.string().trim().min(1).max(80),
        nameKa: z.string().trim().max(160).optional().default(''),
        nameEn: z.string().trim().max(160).optional().default(''),
        unit: z.string().trim().max(40).optional().default(''),
      }),
    )
    .min(1)
    .max(200),
});

aiRouter.post(
  '/align-lab',
  enforceAiQuota,
  asyncHandler(async (req, res) => {
    const body = alignLabSchema.parse(req.body);
    const aligned = await runTrackedAi({
      userId: req.user.id,
      mode: 'LAB_ALIGN',
      userPrompt: `align ${body.analytes.length} analytes`,
      visionProvider: 'openrouter',
      visionModel: alignedModelHint(),
      fn: async () => {
        const result = await alignLabAnalytes(body.analytes);
        return { content: JSON.stringify({ joined: result.joined, leftover: result.leftover }), model: result.model, usage: result.tokenUsage, extra: result };
      },
    });

    const result = aligned.extra;
    if (!result) {
      return res.status(500).json({ error: 'სახელების შემოწმება ვერ დასრულდა.' });
    }
    const usage = result.engine === 'openrouter' ? await req.consumeAiCredit() : req.usage;
    return res.json({
      maps: result.maps,
      joined: result.joined,
      already: result.already,
      leftover: result.leftover,
      model: result.model,
      engine: result.engine,
      usage,
    });
  }),
);

function alignedModelHint() {
  return process.env.OPENROUTER_MODEL || 'openai/gpt-4o';
}

/* ────────────────────────────────────────────────────────────────
 * POST /api/ai/skincare — კანის მოვლის რუტინა
 * ──────────────────────────────────────────────────────────────── */

const skincareSchema = z.object({
  skinType: z.string().trim().min(2).max(60),
  concerns: z.array(z.string().trim().min(1).max(60)).min(1, 'აირჩიეთ მინიმუმ ერთი პრობლემა').max(10),
  age: z.coerce.number().int().min(10).max(100).optional(),
  currentProducts: z.string().trim().max(1000).optional(),
});

aiRouter.post(
  '/skincare',
  enforceAiQuota,
  asyncHandler(async (req, res) => {
    const data = skincareSchema.parse(req.body);
    // The form may still override it, but the registered birth date is the default source of age.
    const age = data.age ?? calculateAge(req.user.birthDate);

    const prompt = [
      'შეადგინე კანის მოვლის ინდივიდუალური რუტინა შემდეგი მონაცემების მიხედვით:',
      `- კანის ტიპი: ${data.skinType}`,
      `- ძირითადი პრობლემები: ${data.concerns.join(', ')}`,
      age ? `- ასაკი: ${age} წელი` : null,
      data.currentProducts ? `- ამჟამად გამოყენებული საშუალებები: ${data.currentProducts}` : null,
    ]
      .filter(Boolean)
      .join('\n');

    const patientAiContext = await withPatientAiContext(req.user);
    const answer = await runTrackedAi({
      userId: req.user.id,
      mode: 'SKINCARE',
      userPrompt: prompt,
      fn: () =>
        askEvidenceMd({
          mode: 'SKINCARE',
          context: patientAiContext,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.3,
        }),
    });

    const record = await prisma.medicalRecord.create({
      data: { userId: req.user.id, type: 'SKINCARE', aiAnalysis: answer.content },
    });

    await prisma.aiInteraction.update({
      where: { id: answer.interactionId },
      data: { medicalRecordId: record.id },
    });

    const usage = await req.consumeAiCredit();
    return res.status(201).json({
      recordId: record.id,
      analysis: answer.content,
      interactionId: answer.interactionId,
      usage,
    });
  }),
);

/* ────────────────────────────────────────────────────────────────
 * POST /api/ai/medication-review — interaction check on the user's schedule
 * ──────────────────────────────────────────────────────────────── */

aiRouter.post(
  '/medication-review',
  enforceAiQuota,
  asyncHandler(async (req, res) => {
    const medications = await prisma.medicationSchedule.findMany({
      where: { userId: req.user.id, active: true },
      orderBy: { createdAt: 'asc' },
    });

    if (medications.length === 0) {
      return res.status(400).json({ error: 'აქტიური მედიკამენტი არ არის დამატებული.' });
    }

    const list = medications
      .map((m, i) => `${i + 1}. ${m.medName} — დოზა: ${m.dosage}; მიღება: ${m.frequency}${m.notes ? `; შენიშვნა: ${m.notes}` : ''}`)
      .join('\n');

    const patientAiContext = await withPatientAiContext(req.user);
    const answer = await runTrackedAi({
      userId: req.user.id,
      mode: 'MEDICATION',
      userPrompt: list,
      fn: () =>
        askEvidenceMd({
          mode: 'MEDICATION',
          context: patientAiContext,
          messages: [{ role: 'user', content: `პაციენტის მიმდინარე მედიკამენტები:\n${list}` }],
        }),
    });

    const usage = await req.consumeAiCredit();
    return res.json({
      analysis: answer.content,
      medicationCount: medications.length,
      interactionId: answer.interactionId,
      usage,
    });
  }),
);

const symptomCheckSchema = z.object({
  symptoms: z.array(z.string().trim().min(1).max(80)).min(1, 'აირჩიეთ მინიმუმ ერთი სიმპტომი').max(16),
  method: z.enum(['manual', 'anatomy']).optional(),
  mode: z.enum(['muscle', 'organ', 'search']).optional(),
  bodyPartId: z.string().trim().max(40).optional(),
  bodyPartKa: z.string().trim().max(80).optional(),
  organId: z.string().trim().max(40).optional(),
  organKa: z.string().trim().max(80).optional(),
  durationKa: z.string().trim().max(80).optional(),
  painLevel: z.coerce.number().int().min(1).max(5).optional(),
  notes: z.string().trim().max(1200).optional(),
});

aiRouter.post(
  '/symptom-check',
  enforceAiQuota,
  asyncHandler(async (req, res) => {
    const data = symptomCheckSchema.parse(req.body);
    const age = calculateAge(req.user.birthDate);
    const firstName = String(req.user.fullName || '').split(' ')[0];

    const prompt = buildSymptomPrompt({
      firstName,
      gender: req.user.gender,
      age,
      symptoms: data.symptoms,
      bodyPartKa: data.bodyPartKa,
      organKa: data.organKa,
      durationKa: data.durationKa,
      painLevel: data.painLevel,
      notes: data.notes,
      mode: data.mode ?? (data.method === 'anatomy' ? 'muscle' : 'search'),
    });

    const answer = await runTrackedAi({
      userId: req.user.id,
      mode: 'SYMPTOM_CHECKER',
      userPrompt: prompt,
      fn: async () => {
        const result = await runSymptomCheck({
          prompt,
          patientContext: await withPatientAiContext(req.user),
          symptoms: data.symptoms,
          bodyPartKa: data.bodyPartKa,
          notes: data.notes,
        });
        return {
          content: JSON.stringify({ result, input: data }),
          model: result.model,
          usage: result.usage,
        };
      },
    });

    const payload = JSON.parse(answer.content);
    const result = payload.result ?? payload;
    const record = await prisma.medicalRecord.create({
      data: {
        userId: req.user.id,
        type: 'SYMPTOM',
        aiAnalysis: formatSymptomRecordKa(result, data),
      },
    });

    await prisma.aiInteraction.update({
      where: { id: answer.interactionId },
      data: { medicalRecordId: record.id },
    });

    const usage = await req.consumeAiCredit();
    return res.status(201).json({
      recordId: record.id,
      result,
      interactionId: answer.interactionId,
      usage,
    });
  }),
);

aiRouter.get(
  '/symptom-result/:recordId',
  asyncHandler(async (req, res) => {
    const { recordId } = z.object({ recordId: z.string().uuid() }).parse(req.params);
    const record = await prisma.medicalRecord.findFirst({
      where: { id: recordId, userId: req.user.id, type: 'SYMPTOM' },
    });
    if (!record) return res.status(404).json({ error: 'ჩანაწერი ვერ მოიძებნა.' });

    const interaction = await prisma.aiInteraction.findFirst({
      where: { medicalRecordId: recordId, userId: req.user.id, mode: 'SYMPTOM_CHECKER' },
      orderBy: { createdAt: 'desc' },
    });
    if (!interaction?.assistantReply) return res.status(404).json({ error: 'შედეგი ვერ მოიძებნა.' });

    let parsed;
    try {
      parsed = JSON.parse(interaction.assistantReply);
    } catch {
      return res.status(404).json({ error: 'შედეგის ფორმატი არასწორია.' });
    }

    const result = parsed.result ?? parsed;
    const input = parsed.input ?? null;
    return res.json({ recordId, result, input });
  }),
);

const feedbackSchema = z.object({
  interactionId: z.string().uuid(),
  rating: z.union([z.literal(1), z.literal(-1)]),
  comment: z.string().trim().max(500).optional(),
});

aiRouter.post(
  '/feedback',
  asyncHandler(async (req, res) => {
    const body = feedbackSchema.parse(req.body);
    const interaction = await prisma.aiInteraction.findFirst({
      where: { id: body.interactionId, userId: req.user.id },
    });
    if (!interaction) {
      return res.status(404).json({ error: 'AI ურთიერთობა ვერ მოიძებნა.' });
    }

    const feedback = await prisma.aiFeedback.upsert({
      where: {
        interactionId_userId: { interactionId: body.interactionId, userId: req.user.id },
      },
      create: {
        interactionId: body.interactionId,
        userId: req.user.id,
        rating: body.rating,
        comment: body.comment ?? null,
      },
      update: {
        rating: body.rating,
        comment: body.comment ?? null,
      },
    });

    return res.json({ feedback });
  }),
);

function buildTitle(message) {
  const clean = message.replace(/\s+/g, ' ').trim();
  return clean.length <= 48 ? clean : `${clean.slice(0, 45)}…`;
}
