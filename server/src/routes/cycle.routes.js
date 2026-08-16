import { Router } from 'express';
import { z } from 'zod';
import { randomBytes } from 'node:crypto';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/error.js';
import {
  buildDoctorSummary,
  buildPredictions,
  buildCycleAiUserPrompt,
  buildLocalInsights,
  fetalInsightForWeek,
  gestationalAge,
  inferCycleStats,
  parseCycleInsightsJson,
  toDateKey,
} from '../lib/cycle.js';
import { askEvidenceMd } from '../lib/evidencemd.js';
import { enforceAiQuota } from '../middleware/aiLimiter.js';
import { calculateAge } from '../lib/patient.js';

export const cycleRouter = Router();
cycleRouter.use(requireAuth);

const MODES = ['TRACK_PERIOD', 'TRY_TO_CONCEIVE', 'PREGNANCY'];
const FLOWS = ['none', 'spotting', 'light', 'medium', 'heavy'];
const MUCUS = ['dry', 'sticky', 'creamy', 'watery', 'eggwhite'];

function assertFemale(user) {
  if (user.gender !== 'FEMALE') {
    const err = new Error('ციკლის მოდული ხელმისაწვდომია მხოლოდ ქალის პროფილისთვის.');
    err.status = 403;
    throw err;
  }
}

function parseJsonArray(value) {
  if (Array.isArray(value)) return value.map(String);
  return [];
}

async function getOrCreateProfile(userId) {
  return prisma.cycleProfile.upsert({
    where: { userId },
    create: { userId },
    update: {},
  });
}

async function loadBundle(userId) {
  const [profile, logs, pregnancyLogs] = await Promise.all([
    getOrCreateProfile(userId),
    prisma.cycleLog.findMany({
      where: { userId },
      orderBy: { date: 'desc' },
      take: 400,
    }),
    prisma.pregnancyLog.findMany({
      where: { userId },
      orderBy: { date: 'desc' },
      take: 120,
    }),
  ]);

  const shapedLogs = logs.map((l) => ({
    ...l,
    symptoms: parseJsonArray(l.symptoms),
    moods: parseJsonArray(l.moods),
  }));

  const inferred = inferCycleStats(
    shapedLogs,
    profile.avgCycleLength,
    profile.avgPeriodLength,
  );

  const lastPeriodStart =
    toDateKey(profile.lastPeriodStart) || inferred.lastPeriodStart;

  const predictions = buildPredictions({
    lastPeriodStart,
    avgCycleLength: profile.avgCycleLength || inferred.avgCycleLength,
    avgPeriodLength: profile.avgPeriodLength || inferred.avgPeriodLength,
  });

  // Overlay actual period days from logs (not predicted)
  for (const log of shapedLogs) {
    if (log.flow && log.flow !== 'none') {
      predictions.calendar[log.date] = {
        ...(predictions.calendar[log.date] || {}),
        period: true,
        predicted: false,
        logged: true,
        flow: log.flow,
      };
    } else if (log.symptoms?.length || log.moods?.length) {
      predictions.calendar[log.date] = {
        ...(predictions.calendar[log.date] || {}),
        logged: true,
      };
    }
  }

  const due = toDateKey(profile.dueDate);
  const pregnancy =
    profile.mode === 'PREGNANCY' && due
      ? {
          dueDate: due,
          age: gestationalAge(due),
          insight: fetalInsightForWeek(gestationalAge(due)?.week ?? 14),
        }
      : null;

  return {
    profile: {
      ...profile,
      lastPeriodStart,
      dueDate: due,
      aiInsights: profile.aiInsights ?? null,
      aiInsightsAt: profile.aiInsightsAt ?? null,
    },
    logs: shapedLogs,
    pregnancyLogs: pregnancyLogs.map((p) => ({
      ...p,
      symptoms: parseJsonArray(p.symptoms),
    })),
    predictions,
    pregnancy,
    inferred,
    summary: buildDoctorSummary({
      profile: { ...profile, lastPeriodStart },
      logs: shapedLogs,
      predictions,
    }),
    localInsights: buildLocalInsights({
      profile: { ...profile, lastPeriodStart },
      logs: shapedLogs,
      predictions,
      pregnancy,
    }),
  };
}

cycleRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    assertFemale(req.user);
    const bundle = await loadBundle(req.user.id);
    return res.json(bundle);
  }),
);

cycleRouter.patch(
  '/profile',
  asyncHandler(async (req, res) => {
    assertFemale(req.user);
    const body = z
      .object({
        mode: z.enum(MODES).optional(),
        avgCycleLength: z.number().int().min(21).max(45).optional(),
        avgPeriodLength: z.number().int().min(2).max(10).optional(),
        lastPeriodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
        isIrregular: z.boolean().optional(),
        dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
        privacyEnabled: z.boolean().optional(),
        enablePartnerShare: z.boolean().optional(),
      })
      .parse(req.body);

    const data = {};
    if (body.mode !== undefined) data.mode = body.mode;
    if (body.avgCycleLength !== undefined) data.avgCycleLength = body.avgCycleLength;
    if (body.avgPeriodLength !== undefined) data.avgPeriodLength = body.avgPeriodLength;
    if (body.isIrregular !== undefined) data.isIrregular = body.isIrregular;
    if (body.privacyEnabled !== undefined) data.privacyEnabled = body.privacyEnabled;
    if (body.lastPeriodStart !== undefined) {
      data.lastPeriodStart = body.lastPeriodStart
        ? new Date(`${body.lastPeriodStart}T00:00:00.000Z`)
        : null;
    }
    if (body.dueDate !== undefined) {
      data.dueDate = body.dueDate ? new Date(`${body.dueDate}T00:00:00.000Z`) : null;
    }
    if (body.enablePartnerShare === true) {
      data.partnerShareCode = randomBytes(6).toString('hex');
    }
    if (body.enablePartnerShare === false) {
      data.partnerShareCode = null;
    }

    await getOrCreateProfile(req.user.id);
    await prisma.cycleProfile.update({
      where: { userId: req.user.id },
      data,
    });

    return res.json(await loadBundle(req.user.id));
  }),
);

cycleRouter.put(
  '/logs/:date',
  asyncHandler(async (req, res) => {
    assertFemale(req.user);
    const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).parse(req.params.date);
    const body = z
      .object({
        flow: z.enum(FLOWS).nullable().optional(),
        symptoms: z.array(z.string().max(40)).max(40).optional(),
        moods: z.array(z.string().max(40)).max(20).optional(),
        sexualActivity: z.boolean().nullable().optional(),
        libido: z.number().int().min(1).max(5).nullable().optional(),
        bbt: z.number().min(34).max(42).nullable().optional(),
        cervicalMucus: z.enum(MUCUS).nullable().optional(),
        notes: z.string().trim().max(500).nullable().optional(),
      })
      .parse(req.body);

    const log = await prisma.cycleLog.upsert({
      where: { userId_date: { userId: req.user.id, date } },
      create: {
        userId: req.user.id,
        date,
        flow: body.flow ?? null,
        symptoms: body.symptoms ?? [],
        moods: body.moods ?? [],
        sexualActivity: body.sexualActivity ?? null,
        libido: body.libido ?? null,
        bbt: body.bbt ?? null,
        cervicalMucus: body.cervicalMucus ?? null,
        notes: body.notes ?? null,
      },
      update: {
        ...(body.flow !== undefined ? { flow: body.flow } : {}),
        ...(body.symptoms !== undefined ? { symptoms: body.symptoms } : {}),
        ...(body.moods !== undefined ? { moods: body.moods } : {}),
        ...(body.sexualActivity !== undefined ? { sexualActivity: body.sexualActivity } : {}),
        ...(body.libido !== undefined ? { libido: body.libido } : {}),
        ...(body.bbt !== undefined ? { bbt: body.bbt } : {}),
        ...(body.cervicalMucus !== undefined ? { cervicalMucus: body.cervicalMucus } : {}),
        ...(body.notes !== undefined ? { notes: body.notes } : {}),
      },
    });

    // If this is a period start (flow after gap), refresh lastPeriodStart when earlier unset or newer
    if (body.flow && body.flow !== 'none') {
      const profile = await getOrCreateProfile(req.user.id);
      const current = toDateKey(profile.lastPeriodStart);
      if (!current || date > current || date < current) {
        // Prefer earliest day of current bleed run as lastPeriodStart
        const prev = await prisma.cycleLog.findFirst({
          where: {
            userId: req.user.id,
            date: { lt: date },
            AND: [{ flow: { not: null } }, { flow: { not: 'none' } }],
          },
          orderBy: { date: 'desc' },
        });
        const isNewCycleStart = !prev || daysBetweenSafe(prev.date, date) > 1;
        if (isNewCycleStart) {
          await prisma.cycleProfile.update({
            where: { userId: req.user.id },
            data: { lastPeriodStart: new Date(`${date}T00:00:00.000Z`) },
          });
        }
      }
    }

    return res.json({ log: { ...log, symptoms: parseJsonArray(log.symptoms), moods: parseJsonArray(log.moods) }, bundle: await loadBundle(req.user.id) });
  }),
);

function daysBetweenSafe(a, b) {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  const ms = Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad);
  return Math.round(ms / 86_400_000);
}

cycleRouter.delete(
  '/logs/:date',
  asyncHandler(async (req, res) => {
    assertFemale(req.user);
    const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).parse(req.params.date);
    await prisma.cycleLog.deleteMany({ where: { userId: req.user.id, date } });
    return res.json(await loadBundle(req.user.id));
  }),
);

cycleRouter.put(
  '/pregnancy/:date',
  asyncHandler(async (req, res) => {
    assertFemale(req.user);
    const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).parse(req.params.date);
    const body = z
      .object({
        currentWeek: z.number().int().min(1).max(42).nullable().optional(),
        weightKg: z.number().min(30).max(200).nullable().optional(),
        symptoms: z.array(z.string().max(40)).max(30).optional(),
        kickCount: z.number().int().min(0).max(500).optional(),
        notes: z.string().trim().max(500).nullable().optional(),
      })
      .parse(req.body);

    const log = await prisma.pregnancyLog.upsert({
      where: { userId_date: { userId: req.user.id, date } },
      create: {
        userId: req.user.id,
        date,
        currentWeek: body.currentWeek ?? null,
        weightKg: body.weightKg ?? null,
        symptoms: body.symptoms ?? [],
        kickCount: body.kickCount ?? 0,
        notes: body.notes ?? null,
      },
      update: {
        ...(body.currentWeek !== undefined ? { currentWeek: body.currentWeek } : {}),
        ...(body.weightKg !== undefined ? { weightKg: body.weightKg } : {}),
        ...(body.symptoms !== undefined ? { symptoms: body.symptoms } : {}),
        ...(body.kickCount !== undefined ? { kickCount: body.kickCount } : {}),
        ...(body.notes !== undefined ? { notes: body.notes } : {}),
      },
    });

    return res.json({ log, bundle: await loadBundle(req.user.id) });
  }),
);

const INSIGHTS_TTL_MS = 18 * 60 * 60 * 1000;

/** Flo-style AI recommendations via EvidenceMD (cached ~18h). */
cycleRouter.post(
  '/insights',
  asyncHandler(async (req, res) => {
    assertFemale(req.user);
    const { refresh } = z
      .object({ refresh: z.boolean().optional() })
      .parse(req.body ?? {});

    const bundle = await loadBundle(req.user.id);
    const cached = bundle.profile.aiInsights;
    const cachedAt = bundle.profile.aiInsightsAt
      ? new Date(bundle.profile.aiInsightsAt).getTime()
      : 0;
    const fresh = Boolean(cached) && Date.now() - cachedAt < INSIGHTS_TTL_MS;

    if (fresh && !refresh) {
      return res.json({
        insights: cached,
        cached: true,
        localInsights: bundle.localInsights,
      });
    }

    // Only enforce AI quota when we actually call EvidenceMD
    await new Promise((resolve, reject) => {
      enforceAiQuota(req, res, (err) => (err ? reject(err) : resolve()));
    });
    if (res.headersSent) return;

    const age = calculateAge(req.user.birthDate);
    const prompt = buildCycleAiUserPrompt({
      profile: bundle.profile,
      logs: bundle.logs,
      predictions: bundle.predictions,
      pregnancy: bundle.pregnancy,
      user: { age },
    });

    const answer = await askEvidenceMd({
      mode: 'CYCLE_WELLNESS',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.55,
      maxTokens: 1200,
      skipDisclaimer: true,
    });

    const parsed = parseCycleInsightsJson(answer.content);
    const insights = parsed || {
      ...bundle.localInsights,
      source: 'local_fallback',
      headline: bundle.localInsights.headline,
    };

    await prisma.cycleProfile.update({
      where: { userId: req.user.id },
      data: {
        aiInsights: insights,
        aiInsightsAt: new Date(),
      },
    });

    const usage = await req.consumeAiCredit();

    return res.json({
      insights,
      cached: false,
      model: answer.model,
      engine: 'evidencemd',
      localInsights: bundle.localInsights,
      usage,
    });
  }),
);

/** Public partner peek (read-only, no auth) — mounted separately below export if needed */
export async function partnerShareHandler(req, res) {
  const code = String(req.params.code || '').trim();
  if (!code) return res.status(400).json({ error: 'კოდი საჭიროა' });
  const profile = await prisma.cycleProfile.findUnique({ where: { partnerShareCode: code } });
  if (!profile) return res.status(404).json({ error: 'ბმული ვერ მოიძებნა' });

  const lastPeriodStart = toDateKey(profile.lastPeriodStart);
  const predictions = buildPredictions({
    lastPeriodStart,
    avgCycleLength: profile.avgCycleLength,
    avgPeriodLength: profile.avgPeriodLength,
  });
  const due = toDateKey(profile.dueDate);
  const pregnancy =
    profile.mode === 'PREGNANCY' && due
      ? { dueDate: due, age: gestationalAge(due), insight: fetalInsightForWeek(gestationalAge(due)?.week ?? 14) }
      : null;

  return res.json({
    mode: profile.mode,
    nextPeriodStart: predictions.nextPeriodStart,
    ovulationDate: predictions.ovulationDate,
    fertileWindow: predictions.fertileWindow,
    pregnancy,
  });
}
