import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/error.js';
import {
  applyPrivateCache,
  assertShareOwner,
  buildPartnerPayload,
  denyShare,
  denyShareAuth,
  decidePartnerPeek,
  decideShareAccept,
  decideShareManage,
  generateShareToken,
  hashShareToken,
  isShareTokenFormat,
  mergeSharePermissions,
  ownerShareView,
  securityShareLog,
  shareExpiresAt,
} from '../lib/cycleShare.js';
import {
  buildDoctorSummary,
  buildPredictions,
  buildCycleAiUserPrompt,
  buildCycleTrends,
  buildCycleAlerts,
  buildLocalInsights,
  emptyCycleAiCache,
  CYCLE_TIMEZONE,
  detectCyclePhase,
  fetalInsightForWeek,
  gestationalAge,
  inferCycleStats,
  parseCycleInsightsJson,
  pickLastPeriodStart,
  resolveForecastAverages,
  stampCalendarPhases,
  todayInTimeZone,
  toDateKey,
} from '../lib/cycle.js';
import {
  assertCycleDateKey,
  DEFAULT_BLEED_FLOW,
  logHasExtras,
  planEndPeriod,
  planFillRange,
  planStartPeriod,
} from '../lib/cyclePeriod.js';
import { askEvidenceMd } from '../lib/evidencemd.js';
import { runTrackedAi } from '../lib/aiTelemetry.js';
import { enforceAiQuota } from '../middleware/aiLimiter.js';
import { calculateAge, withPatientAiContext } from '../lib/patient.js';
import { CYCLE_TEST_RESULTS } from '../lib/cycleFertility.js';
import {
  CONTRACEPTION_METHODS,
  interpretContraception,
  presentPredictions,
  presentTodayPhase,
} from '../lib/cycleContraception.js';

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

async function syncLastPeriodStart(userId) {
  const profile = await getOrCreateProfile(userId);
  const logs = await prisma.cycleLog.findMany({
    where: { userId },
    select: { date: true, flow: true },
    take: 400,
  });
  const current = toDateKey(profile.lastPeriodStart);
  const next = pickLastPeriodStart(current, logs);
  if (next && next !== current) {
    await prisma.cycleProfile.update({
      where: { userId },
      data: {
        lastPeriodStart: new Date(`${next}T00:00:00.000Z`),
        ...emptyCycleAiCache(),
      },
    });
    return;
  }
  await prisma.cycleProfile.updateMany({
    where: { userId },
    data: emptyCycleAiCache(),
  });
}

async function upsertBleedDay(userId, date, flow) {
  return prisma.cycleLog.upsert({
    where: { userId_date: { userId, date } },
    create: {
      userId,
      date,
      flow,
      symptoms: [],
      moods: [],
    },
    update: { flow },
  });
}

async function clearBleedDay(userId, date) {
  const existing = await prisma.cycleLog.findUnique({
    where: { userId_date: { userId, date } },
  });
  if (!existing) return;
  if (!logHasExtras(existing)) {
    await prisma.cycleLog.delete({ where: { id: existing.id } });
    return;
  }
  await prisma.cycleLog.update({
    where: { id: existing.id },
    data: { flow: 'none' },
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
  const averages = resolveForecastAverages(profile, inferred);

  const lastPeriodStart =
    toDateKey(profile.lastPeriodStart) || inferred.lastPeriodStart;

  const today = todayInTimeZone();
  const rawPredictions = buildPredictions({
    lastPeriodStart,
    avgCycleLength: averages.usedCycleLength,
    avgPeriodLength: averages.usedPeriodLength,
    cycleCount: averages.cycleCount,
    isIrregular: profile.isIrregular,
    logs: shapedLogs,
  });
  const contraception = interpretContraception(
    {
      ...profile,
      contraceptionMethod: profile.contraceptionMethod,
      contraceptionStartedAt: toDateKey(profile.contraceptionStartedAt),
      mode: profile.mode,
    },
    { todayLog: shapedLogs.find((l) => l.date === today) },
  );

  const historyStart = inferred.periodRanges?.[0]?.start;
  if (lastPeriodStart && historyStart && historyStart < lastPeriodStart) {
    rawPredictions.calendar = stampCalendarPhases(rawPredictions.calendar, {
      lastPeriodStart,
      avgCycleLength: averages.usedCycleLength,
      avgPeriodLength: averages.usedPeriodLength,
      fromKey: historyStart,
      toKey: lastPeriodStart,
    });
  }
  const predictions = presentPredictions(rawPredictions, contraception);

  const todayPhase = presentTodayPhase(
    detectCyclePhase({
      lastPeriodStart,
      avgCycleLength: averages.usedCycleLength,
      avgPeriodLength: averages.usedPeriodLength,
      today,
    }),
    contraception,
  );

  const due = toDateKey(profile.dueDate);
  const pregnancy =
    profile.mode === 'PREGNANCY' && due
      ? {
          dueDate: due,
          age: gestationalAge(due, today),
          insight: fetalInsightForWeek(gestationalAge(due, today)?.week ?? 14),
        }
      : null;

  const profileView = { ...profile, lastPeriodStart };

  let partnerShare = ownerShareView(null, null);
  try {
    const share = await prisma.cyclePartnerShare.findFirst({
      where: { ownerUserId: userId, revokedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    const live = share && new Date(share.expiresAt).getTime() > Date.now();
    const token = isShareTokenFormat(profile.partnerShareCode) ? profile.partnerShareCode : null;
    partnerShare = ownerShareView(live ? share : null, live ? token : null);
  } catch {
    partnerShare = ownerShareView(null, null);
  }

  return {
    meta: { today, timezone: CYCLE_TIMEZONE },
    cycleDay: todayPhase.day,
    phase: todayPhase.phase,
    phaseKa: todayPhase.phaseKa,
    periodRanges: inferred.periodRanges ?? [],
    averages,
    partnerShare,
    contraception,
    profile: {
      ...profile,
      partnerShareCode: isShareTokenFormat(profile.partnerShareCode) ? profile.partnerShareCode : null,
      lastPeriodStart,
      dueDate: due,
      contraceptionMethod: contraception.method,
      contraceptionStartedAt: contraception.startedAt,
      conditions: Array.isArray(profile.conditions) ? profile.conditions.map(String) : [],
      reminderPrefs: profile.reminderPrefs ?? null,
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
      profile: profileView,
      logs: shapedLogs,
      predictions,
    }),
    localInsights: buildLocalInsights({
      profile: profileView,
      logs: shapedLogs,
      predictions,
      pregnancy,
      averages,
      today,
      contraception,
    }),
    trends: buildCycleTrends({
      profile: profileView,
      logs: shapedLogs,
      inferred,
      averages,
      today,
    }),
    alerts: buildCycleAlerts({
      profile: profileView,
      logs: shapedLogs,
      predictions,
      inferred,
      today,
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

const DATE_KEY = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const profileUpdateSchema = z.object({
  mode: z.enum(MODES).optional(),
  avgCycleLength: z.number().int().min(21).max(45).optional(),
  avgPeriodLength: z.number().int().min(2).max(10).optional(),
  lastPeriodStart: DATE_KEY.nullable().optional(),
  contraceptionMethod: z.enum(CONTRACEPTION_METHODS).nullable().optional(),
  contraceptionStartedAt: DATE_KEY.nullable().optional(),
  isIrregular: z.boolean().optional(),
  dueDate: DATE_KEY.nullable().optional(),
  privacyEnabled: z.boolean().optional(),
  enablePartnerShare: z.boolean().optional(),
  sharePermissions: z
    .object({
      period: z.boolean().optional(),
      cyclePhase: z.boolean().optional(),
      fertileWindow: z.boolean().optional(),
      symptoms: z.boolean().optional(),
    })
    .optional(),
  conditions: z.array(z.enum(['pcos', 'endometriosis', 'perimenopause'])).optional(),
  reminderPrefs: z
    .object({
      enabled: z.boolean().optional(),
      periodDaysBefore: z.number().int().min(0).max(5).optional(),
      ovulation: z.boolean().optional(),
      dailyLog: z.boolean().optional(),
      pms: z.boolean().optional(),
      opk: z.boolean().optional(),
      bbt: z.boolean().optional(),
    })
    .optional(),
});

async function respondWithBundle(userId, res, fallback) {
  try {
    return res.json(await loadBundle(userId));
  } catch (err) {
    console.error('[cycle] loadBundle failed after write', err);
    return res.json(fallback);
  }
}

async function applyProfileUpdate(req, res) {
  assertFemale(req.user);
  const body = profileUpdateSchema.parse(req.body ?? {});

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
  if (body.conditions !== undefined) data.conditions = body.conditions;
  if (body.reminderPrefs !== undefined) data.reminderPrefs = body.reminderPrefs;
  if (body.contraceptionMethod !== undefined) data.contraceptionMethod = body.contraceptionMethod;
  if (body.contraceptionStartedAt !== undefined) {
    data.contraceptionStartedAt = body.contraceptionStartedAt
      ? new Date(`${body.contraceptionStartedAt}T00:00:00.000Z`)
      : null;
  }
  if (body.contraceptionMethod === 'NONE' && body.contraceptionStartedAt === undefined) {
    data.contraceptionStartedAt = null;
  }

  await getOrCreateProfile(req.user.id);
  if (Object.keys(data).length) {
    await prisma.cycleProfile.update({
      where: { userId: req.user.id },
      data,
    });
  }

  if (body.enablePartnerShare === true) {
    await createOwnerShare(req.user.id, body.sharePermissions);
  }
  if (body.enablePartnerShare === false) {
    await revokeOwnerShares(req.user.id);
  }
  if (body.sharePermissions && body.enablePartnerShare !== true && body.enablePartnerShare !== false) {
    await updateOwnerSharePermissions(req.user.id, body.sharePermissions);
  }

  return respondWithBundle(req.user.id, res, {
    profile: { lastPeriodStart: body.lastPeriodStart ?? null },
    meta: { today: todayInTimeZone(), timezone: CYCLE_TIMEZONE },
  });
}

/** Android/Expo Go often drops or mishandles PATCH bodies — keep PUT + PATCH. */
cycleRouter.put('/profile', asyncHandler(applyProfileUpdate));
cycleRouter.patch('/profile', asyncHandler(applyProfileUpdate));

/** Lean first-visit save: POST is reliable on Expo Go / Android OkHttp. */
cycleRouter.post(
  '/last-period',
  asyncHandler(async (req, res) => {
    assertFemale(req.user);
    const date = DATE_KEY.parse(req.body?.date ?? req.body?.lastPeriodStart);
    await getOrCreateProfile(req.user.id);
    await prisma.cycleProfile.update({
      where: { userId: req.user.id },
      data: { lastPeriodStart: new Date(`${date}T00:00:00.000Z`) },
    });
    return respondWithBundle(req.user.id, res, {
      profile: { lastPeriodStart: date },
      meta: { today: todayInTimeZone(), timezone: CYCLE_TIMEZONE },
    });
  }),
);

const sharePermSchema = z.object({
  period: z.boolean().optional(),
  cyclePhase: z.boolean().optional(),
  fertileWindow: z.boolean().optional(),
  symptoms: z.boolean().optional(),
});

async function createOwnerShare(ownerUserId, permissions) {
  const token = generateShareToken();
  await prisma.cyclePartnerShare.updateMany({
    where: { ownerUserId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  await prisma.cyclePartnerShare.create({
    data: {
      ownerUserId,
      tokenHash: hashShareToken(token),
      permissions: mergeSharePermissions(permissions),
      expiresAt: shareExpiresAt(),
    },
  });
  await prisma.cycleProfile.update({
    where: { userId: ownerUserId },
    data: { partnerShareCode: token },
  });
  securityShareLog('created', { owner: true });
  return token;
}

async function revokeOwnerShares(ownerUserId) {
  await prisma.cyclePartnerShare.updateMany({
    where: { ownerUserId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  await prisma.cycleProfile.updateMany({
    where: { userId: ownerUserId },
    data: { partnerShareCode: null },
  });
  securityShareLog('revoked', { owner: true });
}

async function updateOwnerSharePermissions(ownerUserId, permissions) {
  const share = await prisma.cyclePartnerShare.findFirst({
    where: { ownerUserId, revokedAt: null },
    orderBy: { createdAt: 'desc' },
  });
  if (!assertShareOwner(share, ownerUserId)) return;
  await prisma.cyclePartnerShare.update({
    where: { id: share.id },
    data: { permissions: mergeSharePermissions({ ...share.permissions, ...permissions }) },
  });
}

cycleRouter.get(
  '/share',
  asyncHandler(async (req, res) => {
    assertFemale(req.user);
    applyPrivateCache(res);
    const bundle = await loadBundle(req.user.id);
    return res.json({ share: bundle.partnerShare });
  }),
);

cycleRouter.post(
  '/share',
  asyncHandler(async (req, res) => {
    assertFemale(req.user);
    applyPrivateCache(res);
    const body = z.object({ permissions: sharePermSchema.optional() }).parse(req.body ?? {});
    await getOrCreateProfile(req.user.id);
    await createOwnerShare(req.user.id, body.permissions);
    return res.json(await loadBundle(req.user.id));
  }),
);

cycleRouter.patch(
  '/share',
  asyncHandler(async (req, res) => {
    assertFemale(req.user);
    applyPrivateCache(res);
    const body = z.object({ permissions: sharePermSchema }).parse(req.body ?? {});
    const share = await prisma.cyclePartnerShare.findFirst({
      where: { ownerUserId: req.user.id, revokedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    const manage = decideShareManage({ share, viewerUserId: req.user.id });
    if (!manage.ok) return denyShare(res);
    await updateOwnerSharePermissions(req.user.id, body.permissions);
    return res.json(await loadBundle(req.user.id));
  }),
);

cycleRouter.delete(
  '/share',
  asyncHandler(async (req, res) => {
    assertFemale(req.user);
    applyPrivateCache(res);
    await revokeOwnerShares(req.user.id);
    return res.json(await loadBundle(req.user.id));
  }),
);

cycleRouter.post(
  '/share/:code/accept',
  asyncHandler(async (req, res) => {
    applyPrivateCache(res);
    const code = String(req.params.code || '').trim();
    if (!isShareTokenFormat(code)) return denyShare(res);
    const share = await prisma.cyclePartnerShare.findUnique({
      where: { tokenHash: hashShareToken(code) },
    });
    const verdict = decideShareAccept({ share, viewerUserId: req.user.id });
    if (!verdict.ok) {
      securityShareLog('accept_denied', { reason: verdict.reason, partner: true });
      return denyShare(res);
    }
    if (!verdict.alreadyBound) {
      const claimed = await prisma.cyclePartnerShare.updateMany({
        where: { id: share.id, partnerUserId: null, revokedAt: null },
        data: { partnerUserId: req.user.id },
      });
      if (claimed.count === 0) {
        const fresh = await prisma.cyclePartnerShare.findUnique({ where: { id: share.id } });
        if (fresh?.partnerUserId !== req.user.id) return denyShare(res);
      }
    }
    securityShareLog('accepted', { partner: true });
    return res.json({ ok: true });
  }),
);

cycleRouter.get(
  '/share/:code',
  asyncHandler(async (req, res) => {
    applyPrivateCache(res);
    const code = String(req.params.code || '').trim();
    if (!isShareTokenFormat(code)) return denyShare(res);

    const share = await prisma.cyclePartnerShare.findUnique({
      where: { tokenHash: hashShareToken(code) },
    });
    const owner = share
      ? await prisma.user.findUnique({
          where: { id: share.ownerUserId },
          select: { id: true, status: true },
        })
      : null;
    const verdict = decidePartnerPeek({ viewerUserId: req.user.id, share, owner });
    if (!verdict.ok) {
      securityShareLog('peek_denied', { reason: verdict.reason, partner: true });
      return denyShare(res);
    }

    const profile = await prisma.cycleProfile.findUnique({ where: { userId: share.ownerUserId } });
    if (!profile) return denyShare(res);

    const logs = await prisma.cycleLog.findMany({
      where: { userId: share.ownerUserId },
      select: { date: true, flow: true, symptoms: true },
      take: 400,
    });
    const shaped = logs.map((l) => ({
      date: l.date,
      flow: l.flow,
      symptoms: Array.isArray(l.symptoms) ? l.symptoms.map(String) : [],
    }));

    const payload = buildPartnerPayload({
      profile,
      logs: shaped,
      permissions: share.permissions,
    });
    securityShareLog('peek_ok', { partner: true });
    return res.json(payload);
  }),
);

cycleRouter.put(
  '/period',
  asyncHandler(async (req, res) => {
    assertFemale(req.user);
    const today = todayInTimeZone();
    const body = z
      .object({
        action: z.enum(['start', 'end', 'fill']),
        date: z.string().optional(),
        start: z.string().optional(),
        end: z.string().optional(),
        flow: z.enum(['light', 'medium', 'heavy']).optional(),
      })
      .parse(req.body ?? {});
    const flow = body.flow ?? DEFAULT_BLEED_FLOW;

    if (body.action === 'start') {
      const date = assertCycleDateKey(body.date, today);
      const existing = await prisma.cycleLog.findUnique({
        where: { userId_date: { userId: req.user.id, date } },
      });
      const plan = planStartPeriod(date, existing?.flow, flow);
      if (!plan.alreadyLogged) {
        await upsertBleedDay(req.user.id, date, plan.flow);
      }
    } else if (body.action === 'end') {
      const date = assertCycleDateKey(body.date, today);
      const existing = await prisma.cycleLog.findMany({
        where: { userId: req.user.id },
        take: 400,
      });
      const inferred = inferCycleStats(existing);
      const plan = planEndPeriod({
        ranges: inferred.periodRanges,
        logs: existing,
        endDate: date,
      });
      for (const key of plan.clear) {
        await clearBleedDay(req.user.id, key);
      }
    } else {
      const start = assertCycleDateKey(body.start, today);
      const end = assertCycleDateKey(body.end, today);
      if (start > end) {
        const err = new Error('დასრულების თარიღი ვერ იქნება დაწყებაზე ადრე.');
        err.status = 400;
        throw err;
      }
      const existing = await prisma.cycleLog.findMany({
        where: { userId: req.user.id },
        take: 400,
      });
      const plan = planFillRange(start, end, existing, flow);
      for (const key of plan.fill) {
        await upsertBleedDay(req.user.id, key, plan.flow);
      }
    }

    await syncLastPeriodStart(req.user.id);
    return res.json(await loadBundle(req.user.id));
  }),
);

cycleRouter.put(
  '/logs/:date',
  asyncHandler(async (req, res) => {
    assertFemale(req.user);
    const date = assertCycleDateKey(z.string().parse(req.params.date));
    const body = z
      .object({
        flow: z.enum(FLOWS).nullable().optional(),
        symptoms: z.array(z.string().max(40)).max(40).optional(),
        moods: z.array(z.string().max(40)).max(20).optional(),
        sexualActivity: z.boolean().nullable().optional(),
        libido: z.number().int().min(1).max(5).nullable().optional(),
        bbt: z.number().min(34).max(42).nullable().optional(),
        cervicalMucus: z.enum(MUCUS).nullable().optional(),
        ovulationTest: z.enum(CYCLE_TEST_RESULTS).nullable().optional(),
        pregnancyTest: z.enum(CYCLE_TEST_RESULTS).nullable().optional(),
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
        ovulationTest: body.ovulationTest ?? null,
        pregnancyTest: body.pregnancyTest ?? null,
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
        ...(body.ovulationTest !== undefined ? { ovulationTest: body.ovulationTest } : {}),
        ...(body.pregnancyTest !== undefined ? { pregnancyTest: body.pregnancyTest } : {}),
        ...(body.notes !== undefined ? { notes: body.notes } : {}),
      },
    });

    await syncLastPeriodStart(req.user.id);

    return res.json({ log: { ...log, symptoms: parseJsonArray(log.symptoms), moods: parseJsonArray(log.moods) }, bundle: await loadBundle(req.user.id) });
  }),
);

cycleRouter.delete(
  '/logs/:date',
  asyncHandler(async (req, res) => {
    assertFemale(req.user);
    const date = assertCycleDateKey(z.string().parse(req.params.date));
    await prisma.cycleLog.deleteMany({ where: { userId: req.user.id, date } });
    await syncLastPeriodStart(req.user.id);
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

    // Only enforce AI quota when we actually call EvidenceMD.
    // Await the middleware itself — a 429 sends the body and never calls next().
    await enforceAiQuota(req, res, () => undefined);
    if (res.headersSent) return;

    const age = calculateAge(req.user.birthDate);
    const prompt = buildCycleAiUserPrompt({
      profile: bundle.profile,
      logs: bundle.logs,
      predictions: bundle.predictions,
      pregnancy: bundle.pregnancy,
      user: { age },
      averages: bundle.averages,
      today: bundle.meta?.today,
    });

    const patientAiContext = await withPatientAiContext(req.user);
    const answer = await runTrackedAi({
      userId: req.user.id,
      mode: 'CYCLE_WELLNESS',
      userPrompt: prompt,
      fn: () =>
        askEvidenceMd({
          mode: 'CYCLE_WELLNESS',
          context: patientAiContext,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.55,
          maxTokens: 1200,
          skipDisclaimer: true,
        }),
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

    const usage = parsed ? await req.consumeAiCredit() : req.usage;

    return res.json({
      insights,
      cached: false,
      model: answer.model,
      engine: 'evidencemd',
      interactionId: answer.interactionId,
      localInsights: bundle.localInsights,
      usage,
    });
  }),
);

/** Legacy public URL. Never returns health data — auth is required on /api/cycle/share. */
export function partnerShareClosedHandler(req, res) {
  return denyShareAuth(res);
}
