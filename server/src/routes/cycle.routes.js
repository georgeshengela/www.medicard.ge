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
  inferCycleStats,
  parseCycleInsightsJson,
  pickLastPeriodStart,
  resolveForecastAverages,
  stampCalendarPhases,
  todayInTimeZone,
  toDateKey,
  addDays,
  daysBetween,
} from '../lib/cycle.js';
import { isCycleAiContextSupported } from '../lib/cycleModes.js';
import { clientTimezoneFromReq, resolveCycleClock } from '../lib/cycleCivilDate.js';
import {
  CYCLE_DISPLAY_LOG_LIMIT,
  engineLogWhere,
} from '../lib/cycleHistoryQuery.js';
import { buildHistoricalAnalytics } from '../lib/cycleHistoryAnalytics.js';
import { buildObservationTrends, OBSERVATION_TREND_QUERY_DAYS } from '../lib/cycleObservationTrends.js';
import { buildCycleTtcData, CYCLE_TTC_HTTP_PATH, TTC_HISTORY_DAYS } from '../lib/cycleTtc.js';
import {
  applyPregnancyEpisodeTransition,
  buildCyclePregnancyData,
  bundlePregnancyView,
  CYCLE_PREGNANCY_HTTP_PATH,
  isPregnancyProfileMode,
  loadActivePregnancyEpisode,
  PREGNANCY_HISTORY_DAYS,
  presentPregnancyDating,
  serializePregnancyEpisodeForExport,
} from '../lib/cyclePregnancy.js';
import {
  CYCLE_PREGNANCY_CARE_PLAN_HTTP_PATH,
  loadPregnancyCarePlanStates,
  presentPregnancyCarePlan,
  resolveCarePlanPlaceFields,
  resolveCarePlanReminderFields,
  resolveCarePlanTimeFields,
  serializeCarePlanStateForExport,
  validateCarePlanWrite,
} from '../lib/pregnancyCarePlan.js';
import { buildPerimenopauseContext, PERIMENOPAUSE_INTERVAL_HORIZON_DAYS } from '../lib/cyclePerimenopause.js';
import {
  applyPostpartumEpisodeTransition,
  buildCyclePostpartumData,
  bundlePostpartumView,
  CYCLE_POSTPARTUM_HTTP_PATH,
  isPostpartumProfileMode,
  loadActivePostpartumEpisode,
  POSTPARTUM_HISTORY_DAYS,
  serializePostpartumEpisodeForExport,
  stampPostpartumLogWrite,
} from '../lib/cyclePostpartum.js';
import {
  CYCLE_POSTPARTUM_BLEED_CLASSIFICATION_PATH,
  classifyPostpartumBleedEpisode,
  groupPostpartumBleedRuns,
  loadClassifiedPeriodFlowLogs,
  mergeForecastLogs,
  reconcileUserBleedClassifications,
  serializeBleedClassificationsForExport,
  unclassifyPostpartumBleedEpisode,
} from '../lib/cyclePostpartumBleedClassification.js';
import {
  applyForecastEligibilityToPredictions,
  applyForecastEligibilityToTodayPhase,
  evaluateForecastEligibility,
  forecastGateProfilePatch,
  omitForecastGateFromProfile,
  publicForecastEligibility,
  serializePostpartumReturnForExport,
} from '../lib/cyclePostpartumReturnForecast.js';
import { pregnancyLogQueryFrom } from '../lib/cyclePregnancyObservations.js';
import { weekDevelopmentForCompletedWeek } from '../../../mobile/src/lib/pregnancyWeekData.js';
import {
  buildCycleDoctorSummaryData,
  DOCTOR_SUMMARY_MAX_RANGE_DAYS,
  DOCTOR_SUMMARY_QUERY_DAYS,
} from '../lib/cycleDoctorSummary.js';
import {
  DELETE_CYCLE_CONFIRM,
  buildCycleExportPayload,
  wipeCycleHealthData,
} from '../lib/cycleLifecycle.js';
import {
  buildPredictionHistory,
  observeNextPeriodPrediction,
} from '../lib/cyclePredictionHistory.js';
import {
  assertCycleDateKey,
  DEFAULT_BLEED_FLOW,
  logHasExtras,
  planEndPeriod,
  planFillRange,
  planStartPeriod,
} from '../lib/cyclePeriod.js';
import { askAi } from '../lib/aiEngine.js';
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
import {
  buildObservationInsights,
  CYCLE_TAG_ACTIVE_MAX,
  foreignTagIds,
  isClientUuid,
  normalizeTagName,
  parseObservationWrite,
  shapeLogObservations,
} from '../lib/cycleObservations.js';

export const cycleRouter = Router();
cycleRouter.use(requireAuth);
cycleRouter.use((_req, res, next) => {
  applyPrivateCache(res);
  next();
});

const MODES = ['TRACK_PERIOD', 'TRY_TO_CONCEIVE', 'PREGNANCY', 'PERIMENOPAUSE', 'POSTPARTUM'];
const FLOWS = ['none', 'spotting', 'light', 'medium', 'heavy'];
const MUCUS = ['dry', 'sticky', 'creamy', 'watery', 'eggwhite'];

function assertFemale(user) {
  if (user.gender !== 'FEMALE') {
    const err = new Error('ციკლის მოდული ხელმისაწვდომია მხოლოდ ქალის პროფილისთვის.');
    err.status = 403;
    throw err;
  }
}

async function cycleClockForUser(userId, deviceTimezone = null) {
  let stored = null;
  try {
    const row = await prisma.userQuestProfile.findUnique({
      where: { userId },
      select: { timezone: true },
    });
    stored = row?.timezone ?? null;
  } catch {
    stored = null;
  }
  return resolveCycleClock({ deviceTimezone, storedTimezone: stored });
}

async function bundleFor(req) {
  const clock = await cycleClockForUser(req.user.id, clientTimezoneFromReq(req));
  return loadBundle(req.user.id, clock);
}

function parseJsonArray(value) {
  if (Array.isArray(value)) return value.map(String);
  return [];
}

function shapeCycleLog(log) {
  return {
    ...log,
    symptoms: parseJsonArray(log.symptoms),
    moods: parseJsonArray(log.moods),
    ...shapeLogObservations(log),
    notes: log.notes ?? null,
  };
}

async function loadCustomTags(userId) {
  try {
    const rows = await prisma.cycleCustomTag.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      archivedAt: row.archivedAt ? row.archivedAt.toISOString() : null,
      createdAt: row.createdAt.toISOString(),
    }));
  } catch {
    return [];
  }
}

async function loadDailyMetrics(userId) {
  try {
    const rows = await prisma.healthMetricDaily.findMany({
      where: { userId },
      orderBy: { date: 'desc' },
      take: 90,
      select: { date: true, hydrationMl: true, steps: true, sleepHours: true },
    });
    return rows.map((row) => ({
      date: row.date,
      hydrationMl: row.hydrationMl ?? null,
      steps: row.steps ?? null,
      sleepHours: row.sleepHours ?? null,
    }));
  } catch {
    return [];
  }
}

async function assertOwnedTagIds(userId, ids) {
  if (!ids?.length) return [];
  const rows = await prisma.cycleCustomTag.findMany({
    where: { userId, id: { in: ids } },
    select: { id: true },
  });
  const foreign = foreignTagIds(ids, rows.map((r) => r.id));
  if (foreign.length) {
    const err = new Error('ნიშანი ამ ანგარიშს არ ეკუთვნის.');
    err.status = 403;
    throw err;
  }
  return ids;
}

async function getOrCreateProfile(userId) {
  return prisma.cycleProfile.upsert({
    where: { userId },
    create: { userId },
    update: {},
  });
}

async function syncLastPeriodStart(userId, today = todayInTimeZone()) {
  const profile = await getOrCreateProfile(userId);
  const logs = await prisma.cycleLog.findMany({
    where: engineLogWhere(userId, today),
    select: { date: true, flow: true },
    orderBy: { date: 'asc' },
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

async function postpartumWriteStamp(userId) {
  const profile = await prisma.cycleProfile.findUnique({
    where: { userId },
    select: { mode: true },
  });
  if (profile?.mode !== 'POSTPARTUM') return {};
  const episode = await loadActivePostpartumEpisode(prisma, userId);
  return stampPostpartumLogWrite({ mode: 'POSTPARTUM', episodeId: episode?.id });
}

async function upsertBleedDay(userId, date, flow) {
  const stamp = await postpartumWriteStamp(userId);
  return prisma.cycleLog.upsert({
    where: { userId_date: { userId, date } },
    create: {
      userId,
      date,
      flow,
      symptoms: [],
      moods: [],
      ...stamp,
    },
    update: { flow, ...stamp },
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

async function loadBundle(userId, clock = null) {
  const today = clock?.today || todayInTimeZone();
  const timezone = clock?.timezone || CYCLE_TIMEZONE;
  const [profile, engineLogs, displayLogs, pregnancyLogs, customTags, dailyMetrics, activeEpisode, activePostpartum] = await Promise.all([
    getOrCreateProfile(userId),
    prisma.cycleLog.findMany({
      where: engineLogWhere(userId, today),
      orderBy: { date: 'asc' },
      select: { date: true, flow: true },
    }),
    prisma.cycleLog.findMany({
      where: { userId },
      orderBy: { date: 'desc' },
      take: CYCLE_DISPLAY_LOG_LIMIT,
    }),
    prisma.pregnancyLog.findMany({
      where: { userId },
      orderBy: { date: 'desc' },
      take: 120,
    }),
    loadCustomTags(userId),
    loadDailyMetrics(userId),
    loadActivePregnancyEpisode(prisma, userId),
    loadActivePostpartumEpisode(prisma, userId),
  ]);

  const shapedLogs = displayLogs.map(shapeCycleLog);

  const classifiedState = await reconcileUserBleedClassifications(prisma, userId);
  const forecastEligibility = evaluateForecastEligibility({
    forecastGateKind: profile.forecastGateKind,
    forecastGateEpisodeId: profile.forecastGateEpisodeId,
    classifications: classifiedState.keep,
  });
  let forecastLogs = engineLogs;
  if (profile.mode !== 'POSTPARTUM' && profile.mode !== 'PREGNANCY' && classifiedState.classifiedDates.length) {
    try {
      const extra = await loadClassifiedPeriodFlowLogs(prisma, userId, today, classifiedState.classifiedDates);
      forecastLogs = mergeForecastLogs(engineLogs, extra);
    } catch {
      forecastLogs = engineLogs;
    }
  }

  const inferred = inferCycleStats(
    forecastLogs,
    profile.avgCycleLength,
    profile.avgPeriodLength,
  );
  const averages = resolveForecastAverages(profile, inferred);

  const lastPeriodStart = inferred.lastPeriodStart || toDateKey(profile.lastPeriodStart);

  const rawPredictions = buildPredictions({
    lastPeriodStart,
    avgCycleLength: averages.usedCycleLength,
    avgPeriodLength: averages.usedPeriodLength,
    cycleCount: averages.cycleCount,
    cycleLengths: inferred.cycleGaps,
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
  const predictions = applyForecastEligibilityToPredictions(
    presentPredictions(rawPredictions, contraception),
    forecastEligibility,
  );

  const todayPhase = applyForecastEligibilityToTodayPhase(
    presentTodayPhase(
      detectCyclePhase({
        lastPeriodStart,
        avgCycleLength: averages.usedCycleLength,
        avgPeriodLength: averages.usedPeriodLength,
        today,
      }),
      contraception,
    ),
    forecastEligibility,
  );

  const due = toDateKey(profile.dueDate);
  const pregnancy = bundlePregnancyView({
    profile,
    episode: activeEpisode,
    today,
  });

  const profileView = { ...omitForecastGateFromProfile(profile), lastPeriodStart };
  const analytics = buildHistoricalAnalytics({
    logs: shapedLogs,
    inferred,
    contraceptionStartedAt: toDateKey(profile.contraceptionStartedAt),
  });

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

  const bundle = {
    meta: { today, timezone },
    cycleDay: todayPhase.day,
    phase: todayPhase.phase,
    phaseKa: todayPhase.phaseKa,
    periodRanges: inferred.periodRanges ?? [],
    averages,
    partnerShare,
    contraception,
    profile: {
      ...profileView,
      partnerShareCode: isShareTokenFormat(profile.partnerShareCode) ? profile.partnerShareCode : null,
      dueDate: pregnancy?.dueDate ?? due,
      contraceptionMethod: contraception.method,
      contraceptionStartedAt: contraception.startedAt,
      conditions: Array.isArray(profile.conditions) ? profile.conditions.map(String) : [],
      reminderPrefs: profile.reminderPrefs ?? null,
      aiInsights: profile.aiInsights ?? null,
      aiInsightsAt: profile.aiInsightsAt ?? null,
    },
    logs: shapedLogs,
    customTags,
    dailyMetrics,
    observationInsights: buildObservationInsights(shapedLogs, {
      predictionAvailability: contraception.predictionAvailability,
      phasesByDate: Object.fromEntries(
        shapedLogs.map((l) => [
          l.date,
          detectCyclePhase({
            lastPeriodStart,
            avgCycleLength: averages.usedCycleLength,
            avgPeriodLength: averages.usedPeriodLength,
            today: l.date,
          }).phase,
        ]),
      ),
    }),
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
      today,
      inferred,
      pregnancyEpisode: activeEpisode,
      postpartumEpisode: activePostpartum,
    }),
    analytics,
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
      forecastEligibility,
    }),
    perimenopause: buildPerimenopauseContext({
      mode: profile.mode,
      inferred,
      logs: shapedLogs,
      predictions,
      today,
    }),
    postpartum: bundlePostpartumView({
      profile,
      episode: activePostpartum,
      today,
      classifiedDates: classifiedState.classifiedDates,
      latestClassified: classifiedState.latest,
    }),
    classifiedDates: classifiedState.classifiedDates,
    forecastEligibility: publicForecastEligibility(forecastEligibility),
  };

  try {
    await observeNextPeriodPrediction(prisma, {
      userId,
      today,
      now: clock?.now || new Date(),
      predictedDate: rawPredictions.nextPeriodStart,
      cycleAnchorDate: lastPeriodStart,
      confidence: rawPredictions.confidence,
      validGapCount: averages.cycleCount,
      isIrregular: Boolean(profile.isIrregular),
      source: averages.source,
      mode: profile.mode,
      forecastAllowed: forecastEligibility.allowed,
    });
  } catch {
    /* Observation must never fail the Cycle bundle. */
  }

  return bundle;
}

cycleRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    assertFemale(req.user);
    const bundle = await bundleFor(req);
    return res.json(bundle);
  }),
);

cycleRouter.get(
  '/export',
  asyncHandler(async (req, res) => {
    assertFemale(req.user);
    const bundle = await bundleFor(req);
    let predictionSnapshots = [];
    try {
      predictionSnapshots = await prisma.cyclePredictionSnapshot.findMany({
        where: { userId: req.user.id },
        orderBy: { snapshotAt: 'asc' },
        select: {
          type: true,
          predictedDate: true,
          snapshotDate: true,
          cycleAnchorDate: true,
          confidence: true,
          engineVersion: true,
        },
      });
    } catch {
      predictionSnapshots = [];
    }
    let pregnancyEpisodes = [];
    try {
      const episodeRows = await prisma.cyclePregnancyEpisode.findMany({
        where: { userId: req.user.id },
        orderBy: { startedAt: 'asc' },
      });
      pregnancyEpisodes = episodeRows.map(serializePregnancyEpisodeForExport);
    } catch {
      pregnancyEpisodes = [];
    }
    let pregnancyCarePlan = [];
    try {
      const rows = await prisma.pregnancyCarePlanItemState.findMany({
        where: { userId: req.user.id },
        orderBy: { updatedAt: 'asc' },
      });
      pregnancyCarePlan = rows.map(serializeCarePlanStateForExport);
    } catch {
      pregnancyCarePlan = [];
    }
    let postpartumEpisodes = [];
    try {
      const episodeRows = await prisma.cyclePostpartumEpisode.findMany({
        where: { userId: req.user.id },
        orderBy: { startedAt: 'asc' },
      });
      postpartumEpisodes = episodeRows.map(serializePostpartumEpisodeForExport);
    } catch {
      postpartumEpisodes = [];
    }
    let postpartumBleedClassifications = [];
    try {
      const rows = await prisma.cyclePostpartumBleedClassification.findMany({
        where: { userId: req.user.id },
        orderBy: { bleedStart: 'asc' },
      });
      postpartumBleedClassifications = serializeBleedClassificationsForExport(rows);
    } catch {
      postpartumBleedClassifications = [];
    }
    let ownerProfile = null;
    try {
      ownerProfile = await prisma.cycleProfile.findUnique({ where: { userId: req.user.id } });
    } catch {
      ownerProfile = null;
    }
    return res.json(
      buildCycleExportPayload({
        profile: bundle.profile,
        logs: bundle.logs,
        customTags: bundle.customTags,
        inferred: bundle.inferred,
        contraception: bundle.contraception,
        pregnancyLogs: bundle.pregnancyLogs,
        predictionSnapshots,
        pregnancyEpisodes,
        pregnancyCarePlan,
        postpartumEpisodes,
        postpartumBleedClassifications,
        postpartumReturn: serializePostpartumReturnForExport({
          forecastGateKind: ownerProfile?.forecastGateKind,
          forecastGateEpisodeId: ownerProfile?.forecastGateEpisodeId,
          forecastEligibility: bundle.forecastEligibility,
        }),
      }),
    );
  }),
);

cycleRouter.get(
  CYCLE_TTC_HTTP_PATH,
  asyncHandler(async (req, res) => {
    assertFemale(req.user);
    applyPrivateCache(res);
    const bundle = await bundleFor(req);
    const today = bundle.meta.today;
    const from = addDays(today, -(TTC_HISTORY_DAYS - 1));
    const rows = await prisma.cycleLog.findMany({
      where: { userId: req.user.id, date: { gte: from } },
      orderBy: { date: 'desc' },
    });
    const logs = rows.map((row) =>
      shapeCycleLog({
        ...row,
        date: toDateKey(row.date) || row.date,
      }),
    );
    return res.json(
      buildCycleTtcData({
        today,
        profile: bundle.profile,
        logs,
        predictions: bundle.predictions,
        contraception: bundle.contraception,
      }),
    );
  }),
);

cycleRouter.get(
  CYCLE_PREGNANCY_HTTP_PATH,
  asyncHandler(async (req, res) => {
    assertFemale(req.user);
    applyPrivateCache(res);
    const bundle = await bundleFor(req);
    const today = bundle.meta.today;
    const episode = await loadActivePregnancyEpisode(prisma, req.user.id);
    const from = pregnancyLogQueryFrom({ episode, today, historyDays: PREGNANCY_HISTORY_DAYS });
    const rows = await prisma.cycleLog.findMany({
      where: { userId: req.user.id, date: { gte: from } },
      orderBy: { date: 'desc' },
    });
    const logs = rows.map((row) =>
      shapeCycleLog({
        ...row,
        date: toDateKey(row.date) || row.date,
      }),
    );
    const carePlanStates = await loadPregnancyCarePlanStates(prisma, {
      userId: req.user.id,
      episodeId: episode?.id,
    });
    return res.json(
      buildCyclePregnancyData({
        today,
        profile: bundle.profile,
        episode,
        logs,
        carePlanStates,
      }),
    );
  }),
);

cycleRouter.get(
  CYCLE_POSTPARTUM_HTTP_PATH,
  asyncHandler(async (req, res) => {
    assertFemale(req.user);
    applyPrivateCache(res);
    const bundle = await bundleFor(req);
    const today = bundle.meta.today;
    const episode = await loadActivePostpartumEpisode(prisma, req.user.id);
    const from = addDays(today, -(POSTPARTUM_HISTORY_DAYS - 1));
    const rows = await prisma.cycleLog.findMany({
      where: { userId: req.user.id, date: { gte: from } },
      orderBy: { date: 'desc' },
    });
    const logs = rows.map((row) =>
      shapeCycleLog({
        ...row,
        date: toDateKey(row.date) || row.date,
      }),
    );
    const classifiedState = await reconcileUserBleedClassifications(prisma, req.user.id);
    const episodeLogs = episode
      ? logs.filter((log) => log?.postpartumEpisodeId === episode.id)
      : [];
    const runs = groupPostpartumBleedRuns(episodeLogs);
    const classifiedStarts = new Set(
      (classifiedState.episodes || [])
        .filter((row) => row.postpartumEpisodeId === episode?.id)
        .map((row) => row.start),
    );
    const bleedEpisodes = runs.map((run) => ({
      start: run.start,
      end: run.end,
      classified: classifiedStarts.has(run.start),
    }));
    return res.json(
      buildCyclePostpartumData({
        today,
        profile: bundle.profile,
        episode,
        logs,
        classifiedDates: classifiedState.classifiedDates,
        classifiedEpisodes: classifiedState.episodes,
        latestClassified: classifiedState.latest,
        bleedEpisodes,
      }),
    );
  }),
);

cycleRouter.put(
  CYCLE_POSTPARTUM_HTTP_PATH,
  asyncHandler(async (req, res) => {
    assertFemale(req.user);
    applyPrivateCache(res);
    const bundle = await bundleFor(req);
    if (!isPostpartumProfileMode(bundle.profile?.mode)) {
      const err = new Error('საწყისი თარიღი მხოლოდ მშობიარობის შემდგომ რეჟიმში იცვლება.');
      err.status = 404;
      throw err;
    }
    const body = z
      .object({
        referenceDate: DATE_KEY.nullable(),
      })
      .parse(req.body ?? {});
    const clock = await cycleClockForUser(req.user.id, clientTimezoneFromReq(req));
    await prisma.$transaction(async (tx) => {
      await applyPostpartumEpisodeTransition(tx, {
        userId: req.user.id,
        currentMode: 'POSTPARTUM',
        nextMode: 'POSTPARTUM',
        body: { postpartumReferenceDate: body.referenceDate },
        today: clock.today,
      });
    });
    return respondWithBundle(req, res, {
      profile: bundle.profile,
      meta: bundle.meta,
    });
  }),
);

cycleRouter.put(
  CYCLE_POSTPARTUM_BLEED_CLASSIFICATION_PATH,
  asyncHandler(async (req, res) => {
    assertFemale(req.user);
    applyPrivateCache(res);
    const bundle = await bundleFor(req);
    const body = z.object({ date: DATE_KEY }).parse(req.body ?? {});
    await classifyPostpartumBleedEpisode(prisma, {
      userId: req.user.id,
      date: body.date,
      mode: bundle.profile?.mode,
      today: bundle.meta.today,
    });
    return respondWithBundle(req, res, {
      profile: bundle.profile,
      meta: bundle.meta,
    });
  }),
);

cycleRouter.delete(
  CYCLE_POSTPARTUM_BLEED_CLASSIFICATION_PATH,
  asyncHandler(async (req, res) => {
    assertFemale(req.user);
    applyPrivateCache(res);
    const bundle = await bundleFor(req);
    const body = z.object({ date: DATE_KEY }).parse(req.body ?? {});
    await unclassifyPostpartumBleedEpisode(prisma, {
      userId: req.user.id,
      date: body.date,
      mode: bundle.profile?.mode,
    });
    return respondWithBundle(req, res, {
      profile: bundle.profile,
      meta: bundle.meta,
    });
  }),
);

cycleRouter.get(
  `${CYCLE_PREGNANCY_HTTP_PATH}/weeks/:week`,
  asyncHandler(async (req, res) => {
    assertFemale(req.user);
    applyPrivateCache(res);
    const bundle = await bundleFor(req);
    if (!isPregnancyProfileMode(bundle.profile?.mode)) {
      const err = new Error('ორსულობის კვირის კატალოგი მხოლოდ ორსულობის რეჟიმშია.');
      err.status = 404;
      throw err;
    }
    const week = z.coerce.number().int().parse(req.params.week);
    const weekDevelopment = weekDevelopmentForCompletedWeek(week);
    if (!weekDevelopment) {
      const err = new Error('კვირა არასწორია.');
      err.status = 400;
      throw err;
    }
    return res.json({ weekDevelopment });
  }),
);

cycleRouter.get(
  CYCLE_PREGNANCY_CARE_PLAN_HTTP_PATH,
  asyncHandler(async (req, res) => {
    assertFemale(req.user);
    applyPrivateCache(res);
    const bundle = await bundleFor(req);
    if (!isPregnancyProfileMode(bundle.profile?.mode)) {
      const err = new Error('მოვლის გეგმა მხოლოდ ორსულობის რეჟიმშია.');
      err.status = 404;
      throw err;
    }
    const episode = await loadActivePregnancyEpisode(prisma, req.user.id);
    if (!episode || episode.status !== 'ACTIVE') {
      const err = new Error('აქტიური ორსულობის ეპიზოდი არ არის.');
      err.status = 404;
      throw err;
    }
    const dating = presentPregnancyDating({
      referenceDate: episode.referenceDate,
      referenceType: episode.referenceType,
      today: bundle.meta.today,
    });
    const states = await loadPregnancyCarePlanStates(prisma, {
      userId: req.user.id,
      episodeId: episode.id,
    });
    return res.json(
      presentPregnancyCarePlan({
        mode: bundle.profile.mode,
        pregnancyActive: true,
        dating,
        episodeId: episode.id,
        states,
      }),
    );
  }),
);

cycleRouter.put(
  `${CYCLE_PREGNANCY_CARE_PLAN_HTTP_PATH}/:careItemId`,
  asyncHandler(async (req, res) => {
    assertFemale(req.user);
    applyPrivateCache(res);
    const bundle = await bundleFor(req);
    if (!isPregnancyProfileMode(bundle.profile?.mode)) {
      const err = new Error('მოვლის გეგმა მხოლოდ ორსულობის რეჟიმშია.');
      err.status = 404;
      throw err;
    }
    const episode = await loadActivePregnancyEpisode(prisma, req.user.id);
    if (!episode || episode.status !== 'ACTIVE') {
      const err = new Error('აქტიური ორსულობის ეპიზოდი არ არის.');
      err.status = 404;
      throw err;
    }
    const careItemId = String(req.params.careItemId || '');
    const parsed = validateCarePlanWrite(req.body ?? {}, {
      careItemId,
      today: bundle.meta.today,
    });
    if (parsed.action === 'CLEAR') {
      await prisma.pregnancyCarePlanItemState.deleteMany({
        where: {
          userId: req.user.id,
          pregnancyEpisodeId: episode.id,
          careItemId,
        },
      });
    } else {
      const existing = await prisma.pregnancyCarePlanItemState.findUnique({
        where: {
          pregnancyEpisodeId_careItemId: {
            pregnancyEpisodeId: episode.id,
            careItemId,
          },
        },
      });
      const time = resolveCarePlanTimeFields({ parsed, existing });
      const plannedPlace = resolveCarePlanPlaceFields({
        parsed,
        existing,
        plannedDate: time.plannedDate,
      });
      const reminder = resolveCarePlanReminderFields({
        parsed: { ...parsed, plannedDate: time.plannedDate },
        existing,
        plannedTime: time.plannedTime,
      });
      if (parsed.reminderEnabled === true && !reminder.reminderEnabled) {
        const err = new Error(
          parsed.reminderMode === 'EXACT_TIME'
            ? 'დროითი შეხსენება დაგეგმილ თარიღსა და დროს საჭიროებს.'
            : 'შეხსენება მხოლოდ დაგეგმილ თარიღზე ირთვება.',
        );
        err.status = 400;
        throw err;
      }
      const data = {
        userId: req.user.id,
        pregnancyEpisodeId: episode.id,
        careItemId,
        status: parsed.status,
        plannedDate: time.plannedDate,
        plannedTime: time.plannedTime,
        plannedPlace,
        completedDate:
          parsed.completedDate === undefined ? existing?.completedDate ?? null : parsed.completedDate,
        note: parsed.note === undefined ? existing?.note ?? null : parsed.note,
        reminderEnabled: reminder.reminderEnabled,
        reminderOffset: reminder.reminderOffset,
        reminderMode: reminder.reminderMode,
        exactReminderOffsetMinutes: reminder.exactReminderOffsetMinutes,
        catalogVersion: parsed.catalogVersion,
      };
      await prisma.pregnancyCarePlanItemState.upsert({
        where: {
          pregnancyEpisodeId_careItemId: {
            pregnancyEpisodeId: episode.id,
            careItemId,
          },
        },
        create: data,
        update: {
          status: data.status,
          plannedDate: data.plannedDate,
          plannedTime: data.plannedTime,
          plannedPlace: data.plannedPlace,
          completedDate: data.completedDate,
          note: data.note,
          reminderEnabled: data.reminderEnabled,
          reminderOffset: data.reminderOffset,
          reminderMode: data.reminderMode,
          exactReminderOffsetMinutes: data.exactReminderOffsetMinutes,
          catalogVersion: data.catalogVersion,
        },
      });
    }
    const dating = presentPregnancyDating({
      referenceDate: episode.referenceDate,
      referenceType: episode.referenceType,
      today: bundle.meta.today,
    });
    const states = await loadPregnancyCarePlanStates(prisma, {
      userId: req.user.id,
      episodeId: episode.id,
    });
    return res.json(
      presentPregnancyCarePlan({
        mode: bundle.profile.mode,
        pregnancyActive: true,
        dating,
        episodeId: episode.id,
        states,
      }),
    );
  }),
);

cycleRouter.get(
  '/observation-trends',
  asyncHandler(async (req, res) => {
    assertFemale(req.user);
    const clock = await cycleClockForUser(req.user.id, clientTimezoneFromReq(req));
    const today = clock.today;
    const from = addDays(today, -(OBSERVATION_TREND_QUERY_DAYS - 1));
    const rows = await prisma.cycleLog.findMany({
      where: { userId: req.user.id, date: { gte: from } },
      orderBy: { date: 'asc' },
    });
    const logs = rows.map((row) =>
      shapeCycleLog({
        ...row,
        date: toDateKey(row.date) || row.date,
      }),
    );
    const inferred = inferCycleStats(logs);
    return res.json(buildObservationTrends({ logs, today, inferred }));
  }),
);

cycleRouter.get(
  '/doctor-summary',
  asyncHandler(async (req, res) => {
    assertFemale(req.user);
    const clock = await cycleClockForUser(req.user.id, clientTimezoneFromReq(req));
    const today = clock.today;
    const query = z
      .object({
        from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        includeFertility: z.enum(['0', '1', 'true', 'false']).optional(),
        includeSexual: z.enum(['0', '1', 'true', 'false']).optional(),
        includeNotes: z.enum(['0', '1', 'true', 'false']).optional(),
      })
      .parse(req.query);
    const flag = (value) => value === '1' || value === 'true';
    const to = query.to && query.to < today ? query.to : today;
    let from = query.from || addDays(to, -(DOCTOR_SUMMARY_QUERY_DAYS - 1));
    if (from > to) from = to;
    if (daysBetween(from, to) + 1 > DOCTOR_SUMMARY_MAX_RANGE_DAYS) {
      from = addDays(to, -(DOCTOR_SUMMARY_MAX_RANGE_DAYS - 1));
    }
    const [rows, profile, pregnancyEpisode, postpartumEpisode] = await Promise.all([
      prisma.cycleLog.findMany({
        where: { userId: req.user.id, date: { gte: from, lte: to } },
        orderBy: { date: 'asc' },
      }),
      prisma.cycleProfile.findUnique({ where: { userId: req.user.id } }),
      loadActivePregnancyEpisode(prisma, req.user.id),
      loadActivePostpartumEpisode(prisma, req.user.id),
    ]);
    const logs = rows.map((row) =>
      shapeCycleLog({
        ...row,
        date: toDateKey(row.date) || row.date,
      }),
    );
    let inferred = null;
    if (profile?.mode === 'PERIMENOPAUSE') {
      const horizonFrom = addDays(today, -(PERIMENOPAUSE_INTERVAL_HORIZON_DAYS - 1));
      const flowRows = await prisma.cycleLog.findMany({
        where: { userId: req.user.id, date: { gte: horizonFrom, lte: today } },
        select: { date: true, flow: true },
        orderBy: { date: 'asc' },
      });
      inferred = inferCycleStats(
        flowRows.map((row) => ({
          date: toDateKey(row.date) || row.date,
          flow: row.flow,
        })),
      );
    }
    return res.json(
      buildCycleDoctorSummaryData({
        profile: profile || {},
        logs,
        today,
        inferred,
        pregnancyEpisode,
        postpartumEpisode,
        options: {
          from: query.from,
          to: query.to,
          includeFertility: flag(query.includeFertility),
          includeSexual: flag(query.includeSexual),
          includeNotes: flag(query.includeNotes),
        },
      }),
    );
  }),
);

cycleRouter.get(
  '/prediction-history',
  asyncHandler(async (req, res) => {
    assertFemale(req.user);
    const clock = await cycleClockForUser(req.user.id, clientTimezoneFromReq(req));
    const today = clock.today;
    const engineLogs = await prisma.cycleLog.findMany({
      where: engineLogWhere(req.user.id, today),
      orderBy: { date: 'asc' },
      select: { date: true, flow: true, createdAt: true },
    });
    let snapshots = [];
    try {
      snapshots = await prisma.cyclePredictionSnapshot.findMany({
        where: { userId: req.user.id, type: 'NEXT_PERIOD_START' },
        orderBy: { snapshotAt: 'asc' },
      });
    } catch {
      snapshots = [];
    }
    const inferred = inferCycleStats(engineLogs);
    const loggedAtByDate = {};
    for (const log of engineLogs) {
      if (log.createdAt && !loggedAtByDate[log.date]) {
        loggedAtByDate[log.date] = log.createdAt;
      }
    }
    return res.json(buildPredictionHistory(snapshots, {
      periodStarts: inferred.periodStarts,
      loggedAtByDate,
    }));
  }),
);

cycleRouter.post(
  '/wipe',
  asyncHandler(async (req, res) => {
    assertFemale(req.user);
    const parsed = z.object({ confirm: z.literal(DELETE_CYCLE_CONFIRM) }).safeParse(req.body);
    if (!parsed.success) {
      const err = new Error('ციკლის მონაცემების წასაშლელად საჭიროა დადასტურება.');
      err.status = 400;
      throw err;
    }
    const deleted = await wipeCycleHealthData(prisma, req.user.id);
    const bundle = await bundleFor(req);
    return res.json({ ok: true, deleted, bundle });
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
  pregnancyReferenceDate: DATE_KEY.optional(),
  pregnancyReferenceType: z.enum(['LMP', 'USER_SELECTED']).optional(),
  pregnancyConfirm: z.literal(true).optional(),
  postpartumConfirm: z.literal(true).optional(),
  postpartumReferenceDate: DATE_KEY.nullable().optional(),
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

async function respondWithBundle(req, res, fallback) {
  try {
    return res.json(await bundleFor(req));
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
  const current = await prisma.cycleProfile.findUnique({ where: { userId: req.user.id } });
  const nextMode = body.mode ?? current?.mode;
  const clock = await cycleClockForUser(req.user.id, clientTimezoneFromReq(req));
  const pregnancyWrite =
    body.mode === 'PREGNANCY' ||
    current?.mode === 'PREGNANCY' ||
    body.pregnancyConfirm === true ||
    Boolean(body.pregnancyReferenceDate);
  if (body.dueDate !== undefined && !pregnancyWrite) {
    data.dueDate = body.dueDate ? new Date(`${body.dueDate}T00:00:00.000Z`) : null;
  }

  await prisma.$transaction(async (tx) => {
    const side = await applyPregnancyEpisodeTransition(tx, {
      userId: req.user.id,
      currentMode: current?.mode,
      nextMode,
      body,
      today: clock.today,
    });
    const postpartumSide = await applyPostpartumEpisodeTransition(tx, {
      userId: req.user.id,
      currentMode: current?.mode,
      nextMode,
      body,
      today: clock.today,
    });
    Object.assign(data, forecastGateProfilePatch(postpartumSide));
    if (side.dueDate) {
      data.dueDate = new Date(`${side.dueDate}T00:00:00.000Z`);
    }
    if (Object.keys(data).length) {
      await tx.cycleProfile.update({
        where: { userId: req.user.id },
        data,
      });
    }
  });

  if (body.enablePartnerShare === true) {
    await createOwnerShare(req.user.id, body.sharePermissions);
  }
  if (body.enablePartnerShare === false) {
    await revokeOwnerShares(req.user.id);
  }
  if (body.sharePermissions && body.enablePartnerShare !== true && body.enablePartnerShare !== false) {
    await updateOwnerSharePermissions(req.user.id, body.sharePermissions);
  }

  return respondWithBundle(req, res, {
    profile: { lastPeriodStart: body.lastPeriodStart ?? null },
    meta: { today: clock.today, timezone: clock.timezone },
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
    const clock = await cycleClockForUser(req.user.id, clientTimezoneFromReq(req));
    await getOrCreateProfile(req.user.id);
    await prisma.cycleProfile.update({
      where: { userId: req.user.id },
      data: { lastPeriodStart: new Date(`${date}T00:00:00.000Z`) },
    });
    return respondWithBundle(req, res, {
      profile: { lastPeriodStart: date },
      meta: { today: clock.today, timezone: clock.timezone },
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
    const bundle = await bundleFor(req);
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
    return res.json(await bundleFor(req));
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
    return res.json(await bundleFor(req));
  }),
);

cycleRouter.delete(
  '/share',
  asyncHandler(async (req, res) => {
    assertFemale(req.user);
    applyPrivateCache(res);
    await revokeOwnerShares(req.user.id);
    return res.json(await bundleFor(req));
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

    const ownerClock = await cycleClockForUser(share.ownerUserId);
    const [engineLogs, todayRow] = await Promise.all([
      prisma.cycleLog.findMany({
        where: engineLogWhere(share.ownerUserId, ownerClock.today),
        select: { date: true, flow: true },
        orderBy: { date: 'asc' },
      }),
      prisma.cycleLog.findUnique({
        where: { userId_date: { userId: share.ownerUserId, date: ownerClock.today } },
        select: { date: true, flow: true, symptoms: true },
      }),
    ]);
    const shaped = engineLogs.map((l) => ({
      date: l.date,
      flow: l.flow,
      symptoms: l.date === todayRow?.date
        ? (Array.isArray(todayRow.symptoms) ? todayRow.symptoms.map(String) : [])
        : [],
    }));
    const payload = buildPartnerPayload({
      profile,
      logs: shaped,
      permissions: share.permissions,
      today: ownerClock.today,
    });
    securityShareLog('peek_ok', { partner: true });
    return res.json(payload);
  }),
);

cycleRouter.put(
  '/period',
  asyncHandler(async (req, res) => {
    assertFemale(req.user);
    const { today } = await cycleClockForUser(req.user.id, clientTimezoneFromReq(req));
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
        where: engineLogWhere(req.user.id, today),
        orderBy: { date: 'asc' },
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
        where: engineLogWhere(req.user.id, today),
        orderBy: { date: 'asc' },
      });
      const plan = planFillRange(start, end, existing, flow);
      for (const key of plan.fill) {
        await upsertBleedDay(req.user.id, key, plan.flow);
      }
    }

    await syncLastPeriodStart(req.user.id, today);
    return res.json(await bundleFor(req));
  }),
);

cycleRouter.put(
  '/logs/:date',
  asyncHandler(async (req, res) => {
    assertFemale(req.user);
    const { today } = await cycleClockForUser(req.user.id, clientTimezoneFromReq(req));
    const date = assertCycleDateKey(z.string().parse(req.params.date), today);
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
        notes: z.string().trim().max(2000).nullable().optional(),
        painEntries: z.array(z.unknown()).max(7).optional(),
        sleepQuality: z.string().nullable().optional(),
        stressLevel: z.string().nullable().optional(),
        exerciseLevel: z.string().nullable().optional(),
        caffeine: z.string().nullable().optional(),
        alcohol: z.string().nullable().optional(),
        customTagIds: z.array(z.string()).max(8).optional(),
        observations: z.record(z.string(), z.unknown()).nullable().optional(),
        energy: z.string().nullable().optional(),
        observationAssessments: z.record(z.string(), z.unknown()).optional(),
      })
      .parse(req.body);

    const existing = await prisma.cycleLog.findUnique({
      where: { userId_date: { userId: req.user.id, date } },
    });
    const observations = parseObservationWrite(body, existing || {});
    if (observations.customTagIds) {
      await assertOwnedTagIds(req.user.id, observations.customTagIds);
    }

    const stamp = await postpartumWriteStamp(req.user.id);
    const log = await prisma.cycleLog.upsert({
      where: { userId_date: { userId: req.user.id, date } },
      create: {
        userId: req.user.id,
        date,
        flow: body.flow ?? null,
        symptoms: observations.symptoms ?? [],
        moods: observations.moods ?? [],
        sexualActivity: body.sexualActivity ?? null,
        libido: body.libido ?? null,
        bbt: body.bbt ?? null,
        cervicalMucus: body.cervicalMucus ?? null,
        ovulationTest: body.ovulationTest ?? null,
        pregnancyTest: body.pregnancyTest ?? null,
        notes: observations.notes !== undefined ? observations.notes : body.notes ?? null,
        painEntries: observations.painEntries ?? [],
        sleepQuality: observations.sleepQuality ?? null,
        stressLevel: observations.stressLevel ?? null,
        exerciseLevel: observations.exerciseLevel ?? null,
        caffeine: observations.caffeine ?? null,
        alcohol: observations.alcohol ?? null,
        customTagIds: observations.customTagIds ?? [],
        observations: observations.observations ?? {},
        observationSchemaVersion: observations.observationSchemaVersion ?? 1,
        observationAssessments: observations.observationAssessments ?? {},
        ...stamp,
      },
      update: {
        ...(body.flow !== undefined ? { flow: body.flow } : {}),
        ...(observations.symptoms !== undefined ? { symptoms: observations.symptoms } : {}),
        ...(observations.moods !== undefined ? { moods: observations.moods } : {}),
        ...(body.sexualActivity !== undefined ? { sexualActivity: body.sexualActivity } : {}),
        ...(body.libido !== undefined ? { libido: body.libido } : {}),
        ...(body.bbt !== undefined ? { bbt: body.bbt } : {}),
        ...(body.cervicalMucus !== undefined ? { cervicalMucus: body.cervicalMucus } : {}),
        ...(body.ovulationTest !== undefined ? { ovulationTest: body.ovulationTest } : {}),
        ...(body.pregnancyTest !== undefined ? { pregnancyTest: body.pregnancyTest } : {}),
        ...(observations.notes !== undefined ? { notes: observations.notes } : {}),
        ...(observations.painEntries !== undefined ? { painEntries: observations.painEntries } : {}),
        ...(observations.sleepQuality !== undefined ? { sleepQuality: observations.sleepQuality } : {}),
        ...(observations.stressLevel !== undefined ? { stressLevel: observations.stressLevel } : {}),
        ...(observations.exerciseLevel !== undefined ? { exerciseLevel: observations.exerciseLevel } : {}),
        ...(observations.caffeine !== undefined ? { caffeine: observations.caffeine } : {}),
        ...(observations.alcohol !== undefined ? { alcohol: observations.alcohol } : {}),
        ...(observations.customTagIds !== undefined ? { customTagIds: observations.customTagIds } : {}),
        ...(observations.observations !== undefined ? { observations: observations.observations } : {}),
        ...(observations.observationSchemaVersion !== undefined
          ? { observationSchemaVersion: observations.observationSchemaVersion }
          : {}),
        ...(observations.observationAssessments !== undefined
          ? { observationAssessments: observations.observationAssessments }
          : {}),
        ...stamp,
      },
    });

    await syncLastPeriodStart(req.user.id, today);

    return res.json({ log: shapeCycleLog(log), bundle: await bundleFor(req) });
  }),
);

cycleRouter.delete(
  '/logs/:date',
  asyncHandler(async (req, res) => {
    assertFemale(req.user);
    const { today } = await cycleClockForUser(req.user.id, clientTimezoneFromReq(req));
    const date = assertCycleDateKey(z.string().parse(req.params.date), today);
    await prisma.cycleLog.deleteMany({ where: { userId: req.user.id, date } });
    await syncLastPeriodStart(req.user.id, today);
    return res.json(await bundleFor(req));
  }),
);

cycleRouter.post(
  '/tags',
  asyncHandler(async (req, res) => {
    assertFemale(req.user);
    const body = z
      .object({
        id: z.string().optional(),
        name: z.string(),
      })
      .parse(req.body);
    const parsed = normalizeTagName(body.name);
    if (!parsed.ok) {
      const err = new Error(parsed.error === 'too_long' ? 'ნიშანი ძალიან გრძელია.' : 'ნიშნის სახელი ცარიელია.');
      err.status = 400;
      throw err;
    }
    if (body.id && !isClientUuid(body.id)) {
      const err = new Error('ნიშნის იდენტიფიკატორი არასწორია.');
      err.status = 400;
      throw err;
    }
    const activeCount = await prisma.cycleCustomTag.count({
      where: { userId: req.user.id, archivedAt: null },
    });
    const existing = await prisma.cycleCustomTag.findFirst({
      where: { userId: req.user.id, nameNormalized: parsed.nameNormalized, archivedAt: null },
    });
    if (existing) {
      return res.json({ tag: { id: existing.id, name: existing.name, archivedAt: null, createdAt: existing.createdAt.toISOString() }, bundle: await bundleFor(req) });
    }
    if (activeCount >= CYCLE_TAG_ACTIVE_MAX) {
      const err = new Error('აქტიური ნიშნების ლიმიტი ამოწურულია.');
      err.status = 400;
      throw err;
    }
    if (body.id) {
      const taken = await prisma.cycleCustomTag.findUnique({ where: { id: body.id } });
      if (taken && taken.userId !== req.user.id) {
        const err = new Error('ნიშანი ამ ანგარიშს არ ეკუთვნის.');
        err.status = 403;
        throw err;
      }
      if (taken && taken.userId === req.user.id) {
        const updated = await prisma.cycleCustomTag.update({
          where: { id: body.id },
          data: { name: parsed.name, nameNormalized: parsed.nameNormalized, archivedAt: null },
        });
        return res.json({
          tag: { id: updated.id, name: updated.name, archivedAt: null, createdAt: updated.createdAt.toISOString() },
          bundle: await bundleFor(req),
        });
      }
    }
    const tag = await prisma.cycleCustomTag.create({
      data: {
        ...(body.id ? { id: body.id } : {}),
        userId: req.user.id,
        name: parsed.name,
        nameNormalized: parsed.nameNormalized,
      },
    });
    return res.json({
      tag: { id: tag.id, name: tag.name, archivedAt: null, createdAt: tag.createdAt.toISOString() },
      bundle: await bundleFor(req),
    });
  }),
);

cycleRouter.patch(
  '/tags/:id',
  asyncHandler(async (req, res) => {
    assertFemale(req.user);
    const id = z.string().parse(req.params.id);
    const body = z.object({ name: z.string() }).parse(req.body);
    const parsed = normalizeTagName(body.name);
    if (!parsed.ok) {
      const err = new Error(parsed.error === 'too_long' ? 'ნიშანი ძალიან გრძელია.' : 'ნიშნის სახელი ცარიელია.');
      err.status = 400;
      throw err;
    }
    const existing = await prisma.cycleCustomTag.findFirst({ where: { id, userId: req.user.id } });
    if (!existing) {
      const err = new Error('ნიშანი ვერ მოიძებნა.');
      err.status = 404;
      throw err;
    }
    const clash = await prisma.cycleCustomTag.findFirst({
      where: {
        userId: req.user.id,
        nameNormalized: parsed.nameNormalized,
        archivedAt: null,
        NOT: { id },
      },
    });
    if (clash) {
      const err = new Error('ასეთი ნიშანი უკვე არსებობს.');
      err.status = 409;
      throw err;
    }
    const tag = await prisma.cycleCustomTag.update({
      where: { id },
      data: { name: parsed.name, nameNormalized: parsed.nameNormalized },
    });
    return res.json({
      tag: {
        id: tag.id,
        name: tag.name,
        archivedAt: tag.archivedAt ? tag.archivedAt.toISOString() : null,
        createdAt: tag.createdAt.toISOString(),
      },
      bundle: await bundleFor(req),
    });
  }),
);

cycleRouter.delete(
  '/tags/:id',
  asyncHandler(async (req, res) => {
    assertFemale(req.user);
    const id = z.string().parse(req.params.id);
    const existing = await prisma.cycleCustomTag.findFirst({ where: { id, userId: req.user.id } });
    if (!existing) {
      const err = new Error('ნიშანი ვერ მოიძებნა.');
      err.status = 404;
      throw err;
    }
    const tag = await prisma.cycleCustomTag.update({
      where: { id },
      data: { archivedAt: existing.archivedAt || new Date() },
    });
    return res.json({
      tag: {
        id: tag.id,
        name: tag.name,
        archivedAt: tag.archivedAt ? tag.archivedAt.toISOString() : null,
        createdAt: tag.createdAt.toISOString(),
      },
      bundle: await bundleFor(req),
    });
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

    return res.json({ log, bundle: await bundleFor(req) });
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

    const bundle = await bundleFor(req);

    if (!isCycleAiContextSupported(bundle.profile?.mode)) {
      return res.json({
        insights: {
          ...bundle.localInsights,
          source: 'local_fallback',
          headline: bundle.localInsights.headline,
        },
        cached: false,
        localInsights: bundle.localInsights,
      });
    }

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
      contraception: bundle.contraception,
      analytics: bundle.analytics,
      forecastEligibility: bundle.forecastEligibility,
    });

    const patientAiContext = await withPatientAiContext(req.user);
    const answer = await runTrackedAi({
      userId: req.user.id,
      mode: 'CYCLE_WELLNESS',
      userPrompt: prompt,
      fn: () =>
        askAi({
          user: req.user,
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
      engine: answer.engine ?? 'openrouter',
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
