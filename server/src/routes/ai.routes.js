import { bindAiLanguage, currentAiLanguage, requireAiConsent } from '../lib/aiConsent.js';
import { t } from '../lib/i18n.js';
import { Router } from 'express';
import { FREE_CONSUMER_RELEASE } from '../lib/consumerAccess.js';
import multer from 'multer';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { AiEngineError } from '../lib/evidencemd.js';
import { askAi, serverAiEngine, publicAiEngineCatalog, resolveOpenRouterModel } from '../lib/aiEngine.js';
import { runTrackedAi } from '../lib/aiTelemetry.js';
import { describeImage, structureLabText, SUPPORTED_IMAGE_TYPES, VISION_EFFORTS } from '../lib/vision.js';
import { extractPdfText, ocrImage, SUPPORTED_DOCUMENT_TYPES } from '../lib/ocr.js';
import { buildVisionHandoff, buildDoctorTurnContext, sanitizeDoctorReply } from '../lib/prompts.js';
import { calculateAge, withPatientAiContext } from '../lib/patient.js';
import { MEDI_RECORD_CONTEXT_RULES } from '../lib/cycleAccountContext.js';
import { clientTimezoneFromReq, cycleTodayKey } from '../lib/cycleCivilDate.js';
import { buildSymptomPrompt, formatSymptomRecordKa, runSymptomCheck } from '../lib/symptomCheck.js';
import { saveUpload } from '../lib/storage.js';
import { extractLabFromText, isCredibleLabRow } from '../lib/labExtract.js';
import { persistLabExtract } from '../lib/appState.js';
import { alignLabAnalytes } from '../lib/labAlign.js';
import { adviseWeight } from '../lib/weightAdvice.js';
import { requireAuth } from '../middleware/auth.js';
import { enforceAiQuota } from '../middleware/aiLimiter.js';
import { getUsage, commitAiCredit } from '../lib/usage.js';
import { asyncHandler } from '../middleware/error.js';
import { QuestSignal, refreshQuestProgressForUser } from '../lib/quest.js';
import { featureDisabledMessage, isFeatureEnabled } from '../lib/featureFlags.js';

export const aiRouter = Router();

aiRouter.use(requireAuth);
aiRouter.use(bindAiLanguage);
aiRouter.use((req, res, next) => req.method === 'POST' && req.path !== '/feedback' ? requireAiConsent(req, res, next) : next());

aiRouter.get(
  '/engines',
  asyncHandler(async (req, res) => {
    return res.json({
      selected: serverAiEngine(),
      engines: publicAiEngineCatalog(),
    });
  }),
);

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
    cb(new AiEngineError('დაშვებულია მხოლოდ JPG, PNG, WEBP ან PDF ფაილი.', { status: 400, messageEn: 'Only JPG, PNG, WEBP or PDF files are allowed.' }));
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
 * POST /api/ai/query — text consultation (Medi & კონსილიუმი)
 * ──────────────────────────────────────────────────────────────── */

const querySchema = z.object({
  message: z.string().trim().min(2, { error: () => t(currentAiLanguage(), 'შეკითხვა ძალიან მოკლეა', 'Your question is too short') }).max(4000),
  mode: z.enum(['DOCTOR', 'CONSILIUM']).default('DOCTOR'),
  sessionId: z.string().uuid().optional(),
  context: z.string().trim().max(4000).optional(),
  stream: z.boolean().optional(),
  cycleContextAllowed: z.boolean().optional(),
  /** Earlier turns of the one Medi chat (the planner's part the clinical session does not hold). */
  thread: z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().max(4000) })).max(12).optional(),
});

function wantsChatStream(req) {
  if (req.body?.stream === true) return true;
  return String(req.headers.accept || '').includes('text/event-stream');
}

function writeSse(res, payload) {
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
  if (typeof res.flush === 'function') res.flush();
}

async function persistChatTurn({ req, session, history, message, mode, answer }) {
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
  // A new chat exists only after its first answer: link that answer's log row too, or admin
  // shows the first question apart from the rest of the conversation.
  if (!session && answer.interactionId) {
    await prisma.aiInteraction
      .updateMany({ where: { id: answer.interactionId, chatSessionId: null }, data: { chatSessionId: saved.id } })
      .catch(() => undefined);
  }

  const usage = await req.consumeAiCredit();
  await refreshQuestProgressForUser(req.user.id, QuestSignal.MEDI_USED);
  return { saved, usage };
}

aiRouter.post(
  '/query',
  enforceAiQuota,
  asyncHandler(async (req, res) => {
    const { message, mode, sessionId, context, cycleContextAllowed, thread } = querySchema.parse(req.body);

    const session = sessionId
      ? await prisma.chatSession.findFirst({ where: { id: sessionId, userId: req.user.id, mode: { in: ['DOCTOR', 'CONSILIUM'] } } })
      : null;

    if (sessionId && !session) {
      return res.status(404).json({ error: t(req, 'საუბარი ვერ მოიძებნა.', 'Conversation not found.') });
    }

    const history = Array.isArray(session?.messages) ? session.messages : [];
    // Keep the last 12 turns: enough for continuity, small enough to stay inside the context window.
    const priorTurns = history.slice(-12).map((m) => ({ role: m.role, content: m.content }));
    const userTurnCount = priorTurns.filter((m) => m.role === 'user').length + 1;
    const assistantTurnCount = priorTurns.filter((m) => m.role === 'assistant').length;

    // Everything Medi may know about the person, re-read for every turn (2026-10-08 incident).
    // The cycle diary needs the client's explicit yes: its Face ID/PIN lock lives on the device only.
    const profileContext = await withPatientAiContext(req.user, context, {
      full: true, cycleAllowed: cycleContextAllowed === true,
      today: cycleTodayKey(clientTimezoneFromReq(req)), thread, priorTurns, excludeSessionId: session?.id,
    });
    const turnContext =
      [MEDI_RECORD_CONTEXT_RULES, mode === 'DOCTOR'
        ? buildDoctorTurnContext({ userTurnCount, assistantTurnCount })
        : null].filter(Boolean).join('\n\n');
    const stream = wantsChatStream(req);

    if (stream) {
      req.setTimeout(0);
      res.setTimeout(0);
      res.status(200);
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      if (req.socket) req.socket.setNoDelay(true);
      if (typeof res.flushHeaders === 'function') res.flushHeaders();

      const abort = new AbortController();
      const onClose = () => {
        if (!res.writableEnded) abort.abort();
      };
      req.on('close', onClose);

      try {
        const answer = await runTrackedAi({
          userId: req.user.id,
          mode,
          chatSessionId: session?.id,
          userPrompt: message,
          fn: async () => {
            const result = await askAi({
              user: req.user,
              mode,
              context: profileContext || undefined,
              trustedContext: turnContext || undefined,
              messages: [...priorTurns, { role: 'user', content: message }],
              temperature: mode === 'DOCTOR' ? 0.3 : 0.2,
              maxTokens: 2400,
              signal: abort.signal,
              onDelta: (text) => {
                if (abort.signal.aborted || res.writableEnded) return;
                writeSse(res, { type: 'delta', text });
              },
            });
            if (mode === 'DOCTOR') {
              result.content = sanitizeDoctorReply(result.content);
            }
            return result;
          },
        });

        if (abort.signal.aborted) return;

        const { saved, usage } = await persistChatTurn({ req, session, history, message, mode, answer });
        writeSse(res, {
          type: 'done',
          sessionId: saved.id,
          title: saved.title,
          mode: saved.mode,
          answer: answer.content,
          model: answer.model,
          engine: answer.engine ?? 'openrouter',
          interactionId: answer.interactionId,
          usage,
        });
        res.end();
      } catch (error) {
        if (abort.signal.aborted || res.writableEnded) return;
        const status = error instanceof AiEngineError ? error.status : error?.status;
        writeSse(res, {
          type: 'error',
          error: t(req, error?.message, error?.messageEn || error?.message) || t(req, 'სამედიცინო ანალიზის სერვისთან დაკავშირება ვერ მოხერხდა.', 'We could not reach the medical analysis service.'),
          status: status && status >= 400 && status < 600 ? status : 502,
        });
        res.end();
      } finally {
        req.removeListener('close', onClose);
      }
      return;
    }

    const answer = await runTrackedAi({
      userId: req.user.id,
      mode,
      chatSessionId: session?.id,
      userPrompt: message,
      fn: async () => {
        const result = await askAi({
          user: req.user,
          mode,
          context: profileContext || undefined,
          trustedContext: turnContext || undefined,
          messages: [...priorTurns, { role: 'user', content: message }],
          temperature: mode === 'DOCTOR' ? 0.3 : 0.2,
          maxTokens: 2400,
        });
        if (mode === 'DOCTOR') {
          result.content = sanitizeDoctorReply(result.content);
        }
        return result;
      },
    });

    const { saved, usage } = await persistChatTurn({ req, session, history, message, mode, answer });

    return res.json({
      sessionId: saved.id,
      title: saved.title,
      mode: saved.mode,
      answer: answer.content,
      model: answer.model,
      engine: answer.engine ?? 'openrouter',
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
      return res.status(400).json({ error: t(req, 'ფაილი არ არის ატვირთული.', 'No file was uploaded.') });
    }

    const { kind, context } = analyzeSchema.parse(req.body);
    // Each image kind has its own admin switch; the multipart body is only readable here.
    const kindFeature = { LAB: 'labs', IMAGING: 'imaging', SKIN: 'skin' }[kind];
    if (kindFeature && !(await isFeatureEnabled(kindFeature))) {
      return res.status(503).json({ error: await featureDisabledMessage(kindFeature, undefined, req.lang), code: 'FEATURE_DISABLED', feature: kindFeature });
    }
    const { buffer } = req.file;
    const mimetype = sniffImageMime(buffer, normalizeUploadMime(req.file.mimetype));
    const isPdf = mimetype === 'application/pdf';
    if (mimetype === 'image/heic') {
      return res.status(400).json({
        error: t(req, 'iPhone-ის HEIC ფოტო ვერ წავიკითხეთ. ატვირთე სურათი თავიდან JPEG ან PNG ფორმატში.', 'We could not read the iPhone HEIC photo. Please upload it again as JPEG or PNG.'),
      });
    }

    if (isPdf && kind !== 'LAB') {
      return res.status(400).json({ error: t(req, 'PDF ფორმატი მხოლოდ ანალიზების გასაშიფრადაა დაშვებული.', 'PDF files are only accepted for lab results.') });
    }

    let visionNotes;
    let extractor;

    if (isPdf) {
      const { text, pages } = await extractPdfText(buffer);
      if (text.length < 24) {
        return res.status(422).json({
          error: t(req, 'PDF-დან ტექსტის ამოკითხვა ვერ მოხერხდა. სცადე დოკუმენტის ფოტოს ატვირთვა.', 'We could not read text from the PDF. Try uploading a photo of the document.'),
        });
      }
      visionNotes = `[PDF, ${pages} გვერდი]\n\n${text}`;
      extractor = { provider: 'pdf-parse', model: 'pdf-parse' };
    } else {
      const described = await describeImage({
        buffer,
        mimeType: mimetype,
        kind,
        patientContext: context,
        model: resolveOpenRouterModel(req.user),
      }).catch(
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
        userPrompt: buildVisionHandoff({ kind, visionNotes, patientContext: context, lang: req.lang }),
        visionProvider: extractor.provider,
        visionModel: extractor.model,
        fn: () =>
          askAi({
            user: req.user,
            mode: kind,
            context: patientAiContext,
            messages: [
              { role: 'user', content: buildVisionHandoff({ kind, visionNotes, patientContext: context, lang: req.lang }) },
            ],
          }),
      });
      analysisContent = analysis.content;
      interactionId = analysis.interactionId;
      reasoning = { provider: analysis.engine ?? 'openrouter', model: analysis.model };
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
    if (req.labAppend && !FREE_CONSUMER_RELEASE) return next();
    return enforceAiQuota(req, res, next);
  },
  asyncHandler(async (req, res) => {
    const files = req.files ?? [];
    if (!files.length) {
      return res.status(400).json({ error: t(req, 'ფაილი არ არის ატვირთული.', 'No file was uploaded.') });
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
        const { text, pages } = await extractPdfText(file.buffer).catch(() => ({ text: '', pages: 0 }));
        if (text.length >= 24) {
          pdfNotes.push(`[PDF, ${pages} გვერდი]\n\n${text}`);
          continue;
        }
        // A scanned PDF is only pictures: the vision model reads its pages itself.
        images.push({ buffer: file.buffer, mimeType: 'application/pdf' });
        continue;
      }

      const mimeType = sniffImageMime(file.buffer, declared);
      if (mimeType === 'image/heic') {
        return res.status(400).json({
          error: t(req, 'iPhone-ის HEIC ფოტო ვერ წავიკითხეთ. ატვირთე სურათი თავიდან JPEG ან PNG ფორმატში.', 'We could not read the iPhone HEIC photo. Please upload it again as JPEG or PNG.'),
        });
      }
      images.push({ buffer: file.buffer, mimeType });
    }

    let visionNotes = pdfNotes.join('\n\n');
    let extractor = { provider: pdfNotes.length ? 'pdf-parse' : 'none', model: pdfNotes.length ? 'pdf-parse' : '' };

    let usedOcr = false;
    const readImages = async (efforts, { ocr }) => {
      const parts = [];
      let last = null;
      for (const [index, image] of images.entries()) {
        const described = await describeImage({
          buffer: image.buffer,
          mimeType: image.mimeType,
          kind: 'LAB',
          patientContext: context,
          model: resolveOpenRouterModel(req.user),
          efforts,
        }).catch(async (error) => {
          // Tesseract is the last resort: Georgian print through it is mostly noise, so its text only
          // counts when it still yields real analytes (checked below).
          const text = ocr && image.mimeType !== 'application/pdf' ? await ocrImage(image.buffer) : null;
          if (!text) throw error;
          usedOcr = true;
          return { notes: text, provider: 'tesseract', model: 'tesseract-kat+eng+rus' };
        });
        parts.push(images.length > 1 ? `--- PAGE ${index + 1} ---\n${described.notes}` : described.notes);
        last = described;
      }
      return { notes: [pdfNotes.join('\n\n'), ...parts].filter(Boolean).join('\n\n'), last };
    };

    if (images.length) {
      const read = await readImages(VISION_EFFORTS, { ocr: true });
      visionNotes = read.notes;
      extractor = { provider: read.last?.provider ?? 'openrouter', model: read.last?.model ?? '' };
    }

    let labExtract = extractLabFromText(visionNotes);
    // The model answered but no value came out of it: one careful pass before telling the person.
    if (images.length && !usedOcr && !labExtract.parameters.length) {
      const deep = await readImages(['high'], { ocr: false }).catch(() => null);
      const deepExtract = deep ? extractLabFromText(deep.notes) : null;
      if (deepExtract && deepExtract.parameters.length > labExtract.parameters.length) {
        visionNotes = deep.notes;
        labExtract = deepExtract;
        extractor = { provider: deep.last?.provider ?? 'openrouter', model: deep.last?.model ?? '' };
      }
    }
    if (labExtract.parameters.length < 3 && visionNotes.length >= 24) {
      const structured = await structureLabText(visionNotes, {
        model: resolveOpenRouterModel(req.user),
      }).catch(() => null);
      if (structured?.notes) {
        visionNotes = `${visionNotes}\n\n${structured.notes}`;
        labExtract = extractLabFromText(visionNotes);
        extractor = { provider: structured.provider, model: structured.model };
      }
    }

    // OCR noise reads as rows like „დაბადების თარიღი … AVERS | 4“: only rows with a unit or a printed
    // range count, and a page that yields none is reported as unreadable instead of being saved.
    if (usedOcr) {
      labExtract = { ...labExtract, parameters: labExtract.parameters.filter(isCredibleLabRow) };
      // The app re-parses `notes`: hand it the clean rows, not the noise they came from.
      visionNotes = [labExtract.date ? `DOCUMENT META\ndate: ${labExtract.date}` : '', formatLabTable(labExtract.parameters)].filter(Boolean).join('\n\n');
    }
    const unreadable = !labExtract.parameters.length || (usedOcr && labExtract.parameters.length < 3);
    if (unreadable) {
      console.warn('[medicard] lab sheet unreadable', { images: images.length, ocr: usedOcr, rows: labExtract.parameters.length });
    }

    if (req.labAppend) {
      if (!recordId) {
        return res.status(400).json({ error: t(req, 'ჩანაწერი ვერ მოიძებნა.', 'Record not found.') });
      }
      const existing = await prisma.medicalRecord.findFirst({
        where: { id: recordId, userId: req.user.id, type: 'LAB' },
      });
      if (!existing) {
        return res.status(404).json({ error: t(req, 'ჩანაწერი ვერ მოიძებნა.', 'Record not found.') });
      }
      if (unreadable) {
        // Keep the pages already read; this page adds nothing rather than noise.
        return res.json({
          record: { id: existing.id, type: existing.type, imageUrl: existing.imageUrl, aiAnalysis: existing.aiAnalysis, createdAt: existing.createdAt },
          notes: existing.aiAnalysis,
          labExtract: extractLabFromText(existing.aiAnalysis),
          unreadable: true,
          interactionId: null,
          pipeline: { extractor, reasoning: null },
          usage: await getUsage(req.user.id),
        });
      }
      visionNotes = [existing.aiAnalysis, visionNotes].filter(Boolean).join('\n\n--- PAGE ---\n\n');
      const labExtract = extractLabFromText(visionNotes);
      const record = await prisma.medicalRecord.update({
        where: { id: existing.id },
        data: { aiAnalysis: visionNotes },
      });
      await persistLabExtract(req.user.id, labExtract, record).catch(() => undefined);
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

    if (unreadable) {
      return res.status(422).json({
        code: 'LAB_UNREADABLE',
        error: t(
          req,
          'ფურცლიდან მაჩვენებლები ვერ ამოვიკითხეთ. გადაუღე პირდაპირ, კარგ შუქზე, რომ ყველა ციფრი მკაფიოდ ჩანდეს, ან ატვირთე ლაბორატორიის PDF. ეს მცდელობა ლიმიტში არ ჩაგეთვლება.',
          'We could not read the values on this sheet. Take the photo straight on, in good light, so every number is sharp, or upload the lab’s PDF. This try does not count toward your limit.',
        ),
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
    await persistLabExtract(req.user.id, labExtract, record).catch(() => undefined);

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

// Lenient on purpose (owner 2026-10-04): a real lab sheet can yield a long value, unit or name, a NaN
// or an unknown flag. Those are trimmed or dropped instead of failing the whole explanation with
// „შევსებული მონაცემები არასწორია“; only the table text built from them reaches the model.
const clipped = (max) => z.coerce.string().trim().transform((v) => v.slice(0, max));
const finiteOrNull = z.preprocess((v) => (typeof v === 'number' && Number.isFinite(v) ? v : null), z.number().nullable());
const explainLabSchema = z.object({
  parameters: z
    .array(
      z.object({
        key: clipped(80),
        nameKa: clipped(160),
        nameEn: clipped(160).optional().default(''),
        display: clipped(40),
        unit: clipped(40).optional().default(''),
        value: finiteOrNull.optional(),
        refLow: finiteOrNull.optional(),
        refHigh: finiteOrNull.optional(),
        flag: z.preprocess((v) => (['N', 'H', 'L', 'U'].includes(v) ? v : 'U'), z.enum(['N', 'H', 'L', 'U'])).optional(),
      }),
    )
    .transform((rows) => rows.filter((row) => (row.nameKa || row.nameEn) && row.display).slice(0, 80))
    .pipe(z.array(z.any()).min(1)),
  visionNotes: clipped(40000).optional(),
  date: clipped(32).optional(),
  context: clipped(2000).optional(),
  recordId: clipped(80).optional(),
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
      userPrompt: buildVisionHandoff({ kind: 'LAB', visionNotes, patientContext: body.context, lang: req.lang }),
      fn: () =>
        askAi({
          user: req.user,
          mode: 'LAB',
          // A 40-row sheet explained in Georgian is ~5 000 visible tokens; a cut reply is retried, never saved.
          maxTokens: 9000,
          reasoningEffort: 'low',
          context: patientAiContext,
          messages: [
            { role: 'user', content: buildVisionHandoff({ kind: 'LAB', visionNotes, patientContext: body.context, lang: req.lang }) },
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
      visionModel: alignedModelHint(req.user),
      fn: async () => {
        const result = await alignLabAnalytes(body.analytes, {
          model: resolveOpenRouterModel(req.user),
        });
        return { content: JSON.stringify({ joined: result.joined, leftover: result.leftover }), model: result.model, usage: result.tokenUsage, extra: result };
      },
    });

    const result = aligned.extra;
    if (!result) {
      return res.status(500).json({ error: t(req, 'სახელების შემოწმება ვერ დასრულდა.', 'We could not finish checking the test names.') });
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

function alignedModelHint(user) {
  return resolveOpenRouterModel(user);
}

/* ────────────────────────────────────────────────────────────────
 * POST /api/ai/weight-advice — Medi wellness tips for logged weight
 * ──────────────────────────────────────────────────────────────── */

const weightAdviceSchema = z.object({
  weightKg: z.coerce.number().min(30).max(250),
  heightCm: z.coerce.number().min(80).max(250).optional(),
  bmi: z.coerce.number().min(8).max(80).optional(),
  category: z.enum(['underweight', 'normal', 'overweight', 'obese']).optional(),
  targetKg: z.coerce.number().min(30).max(250).optional(),
});

aiRouter.post(
  '/weight-advice',
  enforceAiQuota,
  asyncHandler(async (req, res) => {
    const body = weightAdviceSchema.parse(req.body);
    const patientAiContext = await withPatientAiContext(req.user);
    const advice = await runTrackedAi({
      userId: req.user.id,
      mode: 'WEIGHT_ADVICE',
      userPrompt: `weight ${body.weightKg} kg`,
      visionProvider: 'openrouter',
      visionModel: alignedModelHint(req.user),
      fn: async () => {
        const result = await adviseWeight({
          ...body,
          patientContext: patientAiContext,
          model: resolveOpenRouterModel(req.user),
        });
        return {
          content: JSON.stringify({ blurb: result.blurb, tips: result.tips }),
          model: result.model,
          usage: result.usage,
          extra: result,
        };
      },
    });

    const result = advice.extra;
    if (!result) {
      return res.status(500).json({ error: t(req, 'წონის რჩევა ვერ დასრულდა.', 'We could not finish your weight advice.') });
    }
    const usage = await req.consumeAiCredit();
    return res.json({
      blurb: result.blurb,
      tips: result.tips,
      model: result.model,
      usage,
    });
  }),
);

/* ────────────────────────────────────────────────────────────────
 * POST /api/ai/skincare — კანის მოვლის რუტინა
 * ──────────────────────────────────────────────────────────────── */

const skincareSchema = z.object({
  skinType: z.string().trim().min(2).max(60),
  concerns: z.array(z.string().trim().min(1).max(60)).min(1, { error: () => t(currentAiLanguage(), 'აირჩიე მინიმუმ ერთი პრობლემა', 'Choose at least one concern') }).max(10),
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
        askAi({
          user: req.user,
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
      return res.status(400).json({ error: t(req, 'აქტიური მედიკამენტი არ არის დამატებული.', 'You have no active medications added.') });
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
        askAi({
          user: req.user,
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
  includeHealthProfile: z.boolean().default(false),
  primarySymptom: z.string().trim().min(1).max(80).optional(),
  symptoms: z.array(z.string().trim().min(1).max(80)).min(1, { error: () => t(currentAiLanguage(), 'აირჩიე მინიმუმ ერთი სიმპტომი', 'Choose at least one symptom') }).max(16),
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
    const prompt = buildSymptomPrompt({
      firstName: '',
      gender: req.user.gender,
      age,
      symptoms: data.symptoms,
      primarySymptom: data.symptoms.includes(data.primarySymptom) ? data.primarySymptom : undefined,
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
          user: req.user,
          prompt,
          patientContext: data.includeHealthProfile ? await withPatientAiContext(req.user) : null,
          symptoms: data.symptoms,
          bodyPartKa: data.bodyPartKa,
          notes: data.notes,
          lang: req.lang,
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
    const { record, usage } = await req.settleAiOperation(() => prisma.$transaction(async tx => {
      const record = await tx.medicalRecord.create({
        data: { userId: req.user.id, type: 'SYMPTOM', aiAnalysis: formatSymptomRecordKa(result, data, req.lang) },
      });
      await tx.aiInteraction.update({ where: { id: answer.interactionId }, data: { medicalRecordId: record.id } });
      const usage = await commitAiCredit(req.user.id, tx);
      return { record, usage };
    }));
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
    if (!record) return res.status(404).json({ error: t(req, 'ჩანაწერი ვერ მოიძებნა.', 'Record not found.') });

    const interaction = await prisma.aiInteraction.findFirst({
      where: { medicalRecordId: recordId, userId: req.user.id, mode: 'SYMPTOM_CHECKER' },
      orderBy: { createdAt: 'desc' },
    });
    if (!interaction?.assistantReply) return res.status(404).json({ error: t(req, 'შედეგი ვერ მოიძებნა.', 'Result not found.') });

    let parsed;
    try {
      parsed = JSON.parse(interaction.assistantReply);
    } catch {
      return res.status(404).json({ error: t(req, 'შედეგის ფორმატი არასწორია.', 'The result format is invalid.') });
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
      return res.status(404).json({ error: t(req, 'AI ურთიერთობა ვერ მოიძებნა.', 'AI interaction not found.') });
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
