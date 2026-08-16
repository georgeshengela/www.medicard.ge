import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { askEvidenceMd, AiEngineError } from '../lib/evidencemd.js';
import { describeImage, SUPPORTED_IMAGE_TYPES } from '../lib/vision.js';
import { extractPdfText, ocrImage, SUPPORTED_DOCUMENT_TYPES } from '../lib/ocr.js';
import { buildVisionHandoff } from '../lib/prompts.js';
import { calculateAge, withPatientProfile } from '../lib/patient.js';
import { saveUpload } from '../lib/storage.js';
import { requireAuth } from '../middleware/auth.js';
import { enforceAiQuota } from '../middleware/aiLimiter.js';
import { asyncHandler } from '../middleware/error.js';

export const aiRouter = Router();

aiRouter.use(requireAuth);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    const allowed = [...SUPPORTED_IMAGE_TYPES, ...SUPPORTED_DOCUMENT_TYPES];
    if (!allowed.includes(file.mimetype)) {
      cb(new AiEngineError('დაშვებულია მხოლოდ JPG, PNG, WEBP ან PDF ფაილი.', { status: 400 }));
      return;
    }
    cb(null, true);
  },
});

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

    const answer = await askEvidenceMd({
      mode,
      context: withPatientProfile(req.user, context),
      messages: [...priorTurns, { role: 'user', content: message }],
    });

    const now = new Date().toISOString();
    const nextMessages = [
      ...history,
      { role: 'user', content: message, timestamp: now },
      { role: 'assistant', content: answer.content, timestamp: new Date().toISOString() },
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
    const { buffer, mimetype } = req.file;
    const isPdf = mimetype === 'application/pdf';

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

    const analysis = await askEvidenceMd({
      mode: kind,
      context: withPatientProfile(req.user),
      messages: [{ role: 'user', content: buildVisionHandoff({ kind, visionNotes, patientContext: context }) }],
    });

    const imageUrl = await saveUpload(buffer, mimetype);

    const record = await prisma.medicalRecord.create({
      data: {
        userId: req.user.id,
        type: RECORD_TYPE_BY_KIND[kind],
        imageUrl,
        aiAnalysis: analysis.content,
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
      analysis: analysis.content,
      pipeline: { extractor, reasoning: { provider: 'evidencemd', model: analysis.model } },
      usage,
    });
  }),
);

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

    const answer = await askEvidenceMd({
      mode: 'SKINCARE',
      context: withPatientProfile(req.user),
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
    });

    const record = await prisma.medicalRecord.create({
      data: { userId: req.user.id, type: 'SKINCARE', aiAnalysis: answer.content },
    });

    const usage = await req.consumeAiCredit();
    return res.status(201).json({ recordId: record.id, analysis: answer.content, usage });
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

    const answer = await askEvidenceMd({
      mode: 'MEDICATION',
      context: withPatientProfile(req.user),
      messages: [{ role: 'user', content: `პაციენტის მიმდინარე მედიკამენტები:\n${list}` }],
    });

    const usage = await req.consumeAiCredit();
    return res.json({ analysis: answer.content, medicationCount: medications.length, usage });
  }),
);

function buildTitle(message) {
  const clean = message.replace(/\s+/g, ' ').trim();
  return clean.length <= 48 ? clean : `${clean.slice(0, 45)}…`;
}
