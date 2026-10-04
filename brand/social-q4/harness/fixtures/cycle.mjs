// MEDICARD web-QA mock — women's cycle (`/api/cycle*`).
//
// The GET /api/cycle bundle is computed by the REAL server's pure cycle engine
// (server/src/lib/cycle*.js, imported read-only from the repo — no Prisma, no network), fed with
// in-memory CycleProfile / CycleLog rows. `buildBundle` mirrors `loadBundle` in
// server/src/routes/cycle.routes.js line by line, so shapes and forecasts match production.
//
// Persona 'women' (FEMALE): TRACK_PERIOD, contraception NONE, 7 logged periods (6 completed cycles
// 29/27/28/29/27/28 → inferred 28, period 5), today = cycle day 26 (luteal), next period in 3 days,
// confidence high, forecastEligibility STANDARD/allowed, symptoms + moods on recent days, no log today.
// Persona 'man' (MALE): every /api/cycle route answers 403 like `assertFemale` does (the check reads
// state.user.gender from core.mjs, so a gender change in onboarding is honoured).
// ctx.onboarding set → new tracker: only lastPeriodStart (from the onboarding goal step), no logs.
// The seed follows the Tbilisi calendar day; once anything is written it stays put until /__reset.
// MEDICARD_REPO overrides the repo path the engine is imported from.
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { addDays, isoAt } from '../lib.mjs';

const REPO = process.env.MEDICARD_REPO || 'C:/Users/User/Desktop/www.medicard';
const TIMEZONE = 'Asia/Tbilisi';
const MODES = ['TRACK_PERIOD', 'TRY_TO_CONCEIVE', 'PREGNANCY', 'PERIMENOPAUSE', 'POSTPARTUM'];
const SIMPLE_MODES = new Set(['TRACK_PERIOD', 'TRY_TO_CONCEIVE', 'PERIMENOPAUSE']);
const FLOWS = ['none', 'spotting', 'light', 'medium', 'heavy'];
const MUCUS = ['dry', 'sticky', 'creamy', 'watery', 'eggwhite'];
const TEST_RESULTS = ['negative', 'positive', 'unclear'];

// ---------- real server engine (pure modules only) ----------

let E = null;
let engineError = null;
try {
  const lib = (name) => import(pathToFileURL(join(REPO, 'server', 'src', 'lib', name)).href);
  const mods = await Promise.all([
    lib('cycle.js'),
    lib('cycleHistoryQuery.js'),
    lib('cycleHistoryAnalytics.js'),
    lib('cyclePregnancy.js'),
    lib('cyclePerimenopause.js'),
    lib('cyclePostpartum.js'),
    lib('cyclePostpartumBleedClassification.js'),
    lib('cyclePostpartumReturnForecast.js'),
    lib('cycleContraception.js'),
    lib('cycleObservations.js'),
    lib('cycleShare.js'),
    lib('cyclePeriod.js'),
    lib('cyclePredictionHistory.js'),
    lib('cycleObservationTrends.js'),
    lib('cycleTtc.js'),
    lib('cycleDoctorSummary.js'),
    lib('cycleLifecycle.js'),
    lib('cyclePregnancyObservations.js'),
    lib('cycleForecastHonesty.js'),
  ]);
  E = Object.assign({}, ...mods);
} catch (error) {
  engineError = error;
  console.error(`[cycle fixture] could not load the server cycle engine from ${REPO}: ${error?.message || error}`);
}

// ---------- helpers ----------

function uuid(seed) {
  const h = createHash('sha1').update(`medicard-mock-cycle:${seed}`).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

function dateIso(key) {
  return key ? `${key}T00:00:00.000Z` : null;
}

function userIdOf(state) {
  return (
    state?.auth?.user?.id ||
    state?.user?.id ||
    state?.me?.id ||
    state?.account?.id ||
    (state?.persona === 'man' ? 'mock-user-man' : 'mock-user-women')
  );
}

function httpError(status, message, messageEn, code) {
  const err = new Error(message);
  err.status = status;
  err.messageEn = messageEn;
  if (code) err.code = code;
  return err;
}

/** Same body the server's error middleware sends for a ZodError (400 + fields). */
function invalidField(field) {
  const err = httpError(400, 'შევსებული მონაცემები არასწორია.', 'Some of the details you entered are not valid.');
  err.fields = [{ field, message: 'This field is not valid.' }];
  return err;
}

/** The engine's dev-only console.info chatter (prediction history) stays out of the mock log. */
function quietly(fn) {
  const info = console.info;
  console.info = () => {};
  try {
    return fn();
  } finally {
    console.info = info;
  }
}

function emptyProfile(userId, createdAt) {
  return {
    id: uuid(`profile:${userId}`),
    userId,
    mode: 'TRACK_PERIOD',
    avgCycleLength: 28,
    avgPeriodLength: 5,
    lastPeriodStart: null,
    isIrregular: false,
    dueDate: null,
    privacyEnabled: false,
    partnerShareCode: null,
    aiInsights: null,
    aiInsightsAt: null,
    conditions: [],
    reminderPrefs: null,
    contraceptionMethod: null,
    contraceptionStartedAt: null,
    forecastGateKind: null,
    forecastGateEpisodeId: null,
    createdAt,
    updatedAt: createdAt,
  };
}

/** One CycleLog row exactly as Prisma returns it (Json columns parsed, Dates as ISO strings). */
function logRow(userId, date, fields = {}, hhmm = '21:30') {
  const at = isoAt(date, hhmm);
  return {
    id: uuid(`log:${userId}:${date}`),
    userId,
    date,
    flow: null,
    symptoms: [],
    moods: [],
    sexualActivity: null,
    libido: null,
    bbt: null,
    cervicalMucus: null,
    ovulationTest: null,
    pregnancyTest: null,
    notes: null,
    painEntries: [],
    sleepQuality: null,
    stressLevel: null,
    exerciseLevel: null,
    caffeine: null,
    alcohol: null,
    customTagIds: [],
    observations: {},
    observationSchemaVersion: 1,
    observationAssessments: {},
    trackingContext: null,
    postpartumEpisodeId: null,
    createdAt: at,
    updatedAt: at,
    ...fields,
  };
}

const PERIOD_FLOW_BY_DAY = ['medium', 'heavy', 'medium', 'light', 'light', 'light'];

function seedWomen(state, today) {
  const userId = userIdOf(state);
  // Oldest → newest completed cycle lengths: mean 28, range 27–29 (stats „ტიპური“, variation 2).
  // W2-4 scenarios: CYCLE_SCENARIO=learning2 (2 cycles) | ttc1 (1 cycle, TTC) | irregular (spread 9).
  const scenario = process.env.CYCLE_SCENARIO || '';
  const gaps =
    scenario === 'learning2'
      ? [28, 29]
      : scenario === 'ttc1'
        ? [28]
        : scenario === 'irregular'
          ? [26, 34, 29, 30, 25, 33]
          : [29, 27, 28, 29, 27, 28];
  // Period length per start (last = current period, already over). Mean 5.
  const lengths = [5, 4, 5, 6, 5, 5, 5];
  const current = addDays(today, -(Number(process.env.CYCLE_DAY || 26) - 1)); // today = cycle day 26 (CYCLE_DAY overrides)
  const starts = [current];
  for (let i = gaps.length - 1; i >= 0; i -= 1) starts.unshift(addDays(starts[0], -gaps[i]));

  const yogaTag = {
    id: uuid(`tag:${userId}:yoga`),
    name: 'იოგა',
    nameNormalized: 'იოგა',
    createdAt: isoAt(starts[0], '20:00'),
    archivedAt: null,
  };

  const byDate = new Map();
  const put = (date, fields, hhmm) => {
    const prev = byDate.get(date);
    byDate.set(date, prev ? { ...prev, ...fields } : logRow(userId, date, fields, hhmm));
  };

  // HEAVY_FLOW=1 (QA for the heavy-bleeding card): the current period runs through today, every day 'heavy'.
  const heavyRun = process.env.HEAVY_FLOW === '1';
  starts.forEach((start, i) => {
    const isCurrent = i === starts.length - 1;
    const len = heavyRun && isCurrent ? Number(process.env.CYCLE_DAY || 26) : lengths[i];
    for (let d = 0; d < len; d += 1) {
      const date = addDays(start, d);
      const fields = { flow: heavyRun && isCurrent ? 'heavy' : PERIOD_FLOW_BY_DAY[d] ?? 'light' };
      if (d === 0) {
        fields.painEntries = [{ type: 'cramps', severity: i % 2 ? 'mild' : 'moderate' }];
        fields.symptoms = ['fatigue'];
        fields.moods = ['tired_mood'];
      } else if (d === 1) {
        fields.painEntries = [
          { type: 'cramps', severity: 'mild' },
          ...(i % 3 === 0 ? [{ type: 'lower_back', severity: 'mild' }] : []),
        ];
        fields.symptoms = ['bloating'];
        fields.sleepQuality = 'okay';
      } else if (d === 2) {
        fields.moods = ['calm'];
      }
      put(date, fields, d === 0 ? '08:40' : '21:30');
    }
    const next = starts[i + 1];
    if (next) {
      // PMS days before each following period, a good mid-cycle day, some private / lifestyle notes.
      put(addDays(next, -2), { symptoms: ['bloating', 'breast_tenderness'], moods: ['irritable'] });
      put(addDays(next, -1), { symptoms: ['cravings', 'acne'], moods: ['sensitive'], sleepQuality: 'poor' });
      put(addDays(start, 13), { moods: ['energetic', 'happy'], observations: { energy: 'high' }, sexualActivity: true });
      if (i % 2 === 0) put(addDays(start, 8), { exerciseLevel: 'moderate', customTagIds: [yogaTag.id], moods: ['focused'] });
      // Expectation engine (T4): cramps + bloating on cycle days 25–27 of the last three completed cycles,
      // so day 26 shows „სპაზმები დღეს სავარაუდოა“ and dashed tiles in the quick log.
      if (i >= starts.length - 4) {
        for (let d = 24; d <= 26; d += 1) {
          const date = addDays(start, d);
          if (date >= next) continue;
          const prev = byDate.get(date);
          const symptoms = [...new Set([...(prev?.symptoms ?? []), 'bloating'])];
          const painEntries = [...(prev?.painEntries ?? []).filter((e) => e.type !== 'cramps'), { type: 'cramps', severity: d === 25 ? 'moderate' : 'mild' }];
          put(date, { symptoms, painEntries });
        }
      }
    }
  });

  // Current cycle after the period (cycle days 6–25): the recent days the stats/tips read.
  put(addDays(today, -16), { sexualActivity: true, moods: ['romantic'] });
  put(addDays(today, -13), { moods: ['energetic', 'happy'], observations: { energy: 'high' }, exerciseLevel: 'moderate' });
  put(addDays(today, -12), { sexualActivity: true, symptoms: ['ovulation_pain'] });
  put(addDays(today, -9), { symptoms: ['acne'], caffeine: 'moderate' });
  put(addDays(today, -6), { moods: ['calm'], sleepQuality: 'good', customTagIds: [yogaTag.id], exerciseLevel: 'light' });
  put(addDays(today, -3), { symptoms: ['acne'], moods: ['calm'], stressLevel: 'medium' });
  put(addDays(today, -2), { symptoms: ['cravings', 'fatigue'], moods: ['tired_mood'], sleepQuality: 'okay', caffeine: 'high' });
  put(addDays(today, -1), {
    symptoms: ['bloating', 'breast_tenderness'],
    moods: ['sensitive', 'irritable'],
    painEntries: [{ type: 'headache', severity: 'mild' }],
    observations: { energy: 'low' },
  });
  // Today: nothing logged yet (the hero offers „დღის აღრიცხვა“).

  const createdAt = isoAt(addDays(starts[0], 1), '09:15');
  const profile = {
    ...emptyProfile(userId, createdAt),
    ...(scenario === 'ttc1' ? { mode: 'TRY_TO_CONCEIVE' } : {}),
    lastPeriodStart: dateIso(current),
    contraceptionMethod: 'NONE',
    reminderPrefs: { enabled: true, periodDaysBefore: 2, ovulation: true, dailyLog: false, pms: true, opk: false, bbt: false },
    updatedAt: isoAt(current, '08:41'),
  };

  // One NEXT_PERIOD_START snapshot per anchor once ≥2 gaps existed (prediction-history screen).
  const snapshots = [];
  for (let i = 2; i < starts.length; i += 1) {
    const anchor = starts[i];
    const snapshotDate = addDays(anchor, 2);
    snapshots.push({
      id: uuid(`snap:${userId}:${anchor}`),
      userId,
      type: 'NEXT_PERIOD_START',
      cycleAnchorDate: anchor,
      predictedDate: addDays(anchor, 28),
      confidence: i >= 6 ? 'high' : 'medium',
      engineVersion: 1,
      snapshotDate,
      snapshotAt: isoAt(snapshotDate, '09:00'),
      validGapCount: i,
      isIrregular: false,
      source: 'inferred',
    });
  }

  return {
    profile,
    logs: [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)),
    tags: [yogaTag],
    snapshots,
    share: null,
  };
}

function seedDailyMetrics(today) {
  const out = [];
  for (let i = 1; i <= 30; i += 1) {
    const date = addDays(today, -i);
    const h = createHash('sha1').update(`metrics:${date}`).digest();
    out.push({
      date,
      hydrationMl: 1300 + (h[0] % 12) * 100,
      steps: 4200 + h[1] * 30,
      sleepHours: Math.round((6 + (h[2] % 25) / 10) * 10) / 10,
    });
  }
  return out;
}

/**
 * Onboarding tail (core.mjs: steps 1–5 answered, primaryGoal 'cycle'): the goal step already saved
 * „ბოლო მენსტრუაცია“ via POST /api/cycle/last-period, nothing was logged yet → defaults 28/5,
 * source 'default', confidence low, no stats card until real cycles are logged.
 */
function seedOnboarding(state, today) {
  const profile = emptyProfile(userIdOf(state), isoAt(today, '09:00'));
  profile.lastPeriodStart = dateIso(addDays(today, -25));
  return { profile, logs: [], tags: [], snapshots: [], share: null };
}

function seed(state, ctx) {
  const today = ctx.today;
  const onboarding = Boolean(ctx.onboarding);
  const base =
    ctx.persona === 'man'
      ? { profile: emptyProfile(userIdOf(state), isoAt(today, '09:00')), logs: [], tags: [], snapshots: [], share: null }
      : onboarding
        ? seedOnboarding(state, today)
        : seedWomen(state, today);
  state.cycle = {
    seedDay: today,
    onboarding,
    dirty: false,
    dailyMetrics: onboarding || ctx.persona === 'man' ? [] : seedDailyMetrics(today),
    pregnancyLogs: [],
    ...base,
  };
}

export function init(state, ctx) {
  seed(state, ctx);
}

/** Keep the seeded history aligned to the current day unless the session already wrote something. */
function cycleState(rq) {
  const c = rq.state.cycle;
  if (!c || (!c.dirty && c.seedDay !== rq.today)) {
    seed(rq.state, {
      persona: rq.persona,
      today: rq.today,
      onboarding: rq.state.options?.onboarding ?? null,
      layout: rq.state.options?.layout ?? null,
    });
  }
  return rq.state.cycle;
}

function langOf(rq) {
  return rq.lang === 'en' ? 'en' : 'ka';
}

// ---------- the bundle (mirror of loadBundle in server/src/routes/cycle.routes.js) ----------

function shapeCycleLog(log) {
  return {
    ...log,
    symptoms: Array.isArray(log.symptoms) ? log.symptoms.map(String) : [],
    moods: Array.isArray(log.moods) ? log.moods.map(String) : [],
    ...E.shapeLogObservations(log),
    notes: log.notes ?? null,
  };
}

function engineLogs(c, today) {
  return E.filterLogsForEngine(c.logs, today)
    .map((l) => ({ date: l.date, flow: l.flow }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function customTagsView(c) {
  return [...c.tags]
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((t) => ({ id: t.id, name: t.name, archivedAt: t.archivedAt ?? null, createdAt: t.createdAt }));
}

function shareLive(c) {
  return Boolean(c.share && !c.share.revokedAt && Date.parse(c.share.expiresAt) > Date.now());
}

function buildBundle(rq) {
  const c = cycleState(rq);
  const lang = langOf(rq);
  const today = rq.today;
  const profile = c.profile;

  const engine = engineLogs(c, today);
  const displayLogs = [...c.logs].sort((a, b) => b.date.localeCompare(a.date)).slice(0, E.CYCLE_DISPLAY_LOG_LIMIT);
  const shapedLogs = displayLogs.map(shapeCycleLog);

  // No postpartum episodes in the mock: same as reconcileUserBleedClassifications with no rows.
  const classifiedState = { classifiedDates: [], episodes: [], latest: null, keep: [] };
  const forecastEligibility = E.evaluateForecastEligibility({
    forecastGateKind: profile.forecastGateKind,
    forecastGateEpisodeId: profile.forecastGateEpisodeId,
    classifications: classifiedState.keep,
  });
  const forecastLogs = engine;

  const inferred = E.inferCycleStats(forecastLogs, profile.avgCycleLength, profile.avgPeriodLength);
  const averages = E.resolveForecastAverages(profile, inferred);
  const lastPeriodStart = E.resolveLastPeriodStart(
    E.toDateKey(profile.lastPeriodStart),
    inferred.lastPeriodStart,
    E.lastLoggedBleedDay(inferred),
  );

  const rawPredictions = E.buildPredictions({
    lastPeriodStart,
    avgCycleLength: averages.usedCycleLength,
    avgPeriodLength: averages.usedPeriodLength,
    cycleCount: averages.cycleCount,
    cycleLengths: inferred.cycleGaps,
    isIrregular: profile.isIrregular,
    logs: shapedLogs,
    today,
    lang,
    mode: profile.mode,
  });
  const contraception = E.interpretContraception(
    {
      ...profile,
      contraceptionMethod: profile.contraceptionMethod,
      contraceptionStartedAt: E.toDateKey(profile.contraceptionStartedAt),
      mode: profile.mode,
    },
    { todayLog: shapedLogs.find((l) => l.date === today), lang },
  );

  const historyStart = inferred.periodRanges?.[0]?.start;
  if (lastPeriodStart && historyStart && historyStart < lastPeriodStart) {
    rawPredictions.calendar = E.stampCalendarPhases(rawPredictions.calendar, {
      lastPeriodStart,
      avgCycleLength: averages.usedCycleLength,
      avgPeriodLength: averages.usedPeriodLength,
      fromKey: historyStart,
      toKey: lastPeriodStart,
      lang,
      fertility: rawPredictions.fertility,
    });
  }
  const predictions = E.applyForecastEligibilityToPredictions(
    E.presentPredictions(rawPredictions, contraception, lang),
    forecastEligibility,
  );
  const todayPhase = E.applyForecastEligibilityToTodayPhase(
    E.presentTodayPhase(
      E.alignPhaseWithForecast(
        E.detectCyclePhase({
          lastPeriodStart,
          avgCycleLength: averages.usedCycleLength,
          avgPeriodLength: averages.usedPeriodLength,
          today,
          lang,
        }),
        rawPredictions,
        today,
      ),
      contraception,
      lang,
    ),
    forecastEligibility,
  );

  const due = E.toDateKey(profile.dueDate);
  const pregnancy = E.bundlePregnancyView({ profile, episode: null, today });
  const profileView = { ...E.omitForecastGateFromProfile(profile), lastPeriodStart };
  const analytics = E.buildHistoricalAnalytics({
    logs: shapedLogs,
    inferred,
    contraceptionStartedAt: E.toDateKey(profile.contraceptionStartedAt),
  });

  const live = shareLive(c);
  const token = E.isShareTokenFormat(profile.partnerShareCode) ? profile.partnerShareCode : null;
  const partnerShare = E.ownerShareView(live ? c.share : null, live ? token : null);

  const bundle = {
    meta: { today, timezone: TIMEZONE },
    cycleDay: todayPhase.day,
    phase: todayPhase.phase,
    phaseKa: todayPhase.phaseKa,
    periodRanges: inferred.periodRanges ?? [],
    averages,
    partnerShare,
    contraception,
    profile: {
      ...profileView,
      partnerShareCode: token,
      dueDate: pregnancy?.dueDate ?? due,
      contraceptionMethod: contraception.method,
      contraceptionStartedAt: contraception.startedAt,
      conditions: Array.isArray(profile.conditions) ? profile.conditions.map(String) : [],
      reminderPrefs: profile.reminderPrefs ?? null,
      aiInsights: profile.aiInsights ?? null,
      aiInsightsAt: profile.aiInsightsAt ?? null,
    },
    logs: shapedLogs,
    customTags: customTagsView(c),
    dailyMetrics: c.dailyMetrics,
    observationInsights: E.buildObservationInsights(shapedLogs, {
      predictionAvailability: contraception.predictionAvailability,
      lang,
      phasesByDate: Object.fromEntries(
        shapedLogs.map((l) => [
          l.date,
          E.detectCyclePhase({
            lastPeriodStart,
            avgCycleLength: averages.usedCycleLength,
            avgPeriodLength: averages.usedPeriodLength,
            today: l.date,
          }).phase,
        ]),
      ),
    }),
    pregnancyLogs: c.pregnancyLogs.map((p) => ({ ...p, symptoms: Array.isArray(p.symptoms) ? p.symptoms : [] })),
    predictions,
    pregnancy,
    inferred,
    summary: E.buildDoctorSummary({
      profile: profileView,
      logs: shapedLogs,
      today,
      inferred,
      pregnancyEpisode: null,
      postpartumEpisode: null,
    }),
    analytics,
    localInsights: E.buildLocalInsights({
      profile: profileView,
      logs: shapedLogs,
      predictions,
      pregnancy,
      averages,
      today,
      contraception,
      lang,
    }),
    trends: E.buildCycleTrends({ profile: profileView, logs: shapedLogs, inferred, averages, today }),
    alerts: E.buildCycleAlerts({
      profile: profileView,
      logs: shapedLogs,
      predictions,
      inferred,
      today,
      forecastEligibility,
      lang,
    }),
    perimenopause: E.buildPerimenopauseContext({
      mode: profile.mode,
      inferred,
      logs: shapedLogs,
      predictions,
      today,
    }),
    postpartum: E.bundlePostpartumView({
      profile,
      episode: null,
      today,
      classifiedDates: classifiedState.classifiedDates,
      latestClassified: classifiedState.latest,
    }),
    classifiedDates: classifiedState.classifiedDates,
    forecastEligibility: E.publicForecastEligibility(forecastEligibility),
  };

  observeNextPeriodPrediction(c, {
    userId: profile.userId,
    today,
    predictedDate: rawPredictions.nextPeriodStart,
    cycleAnchorDate: lastPeriodStart,
    confidence: rawPredictions.confidence,
    validGapCount: averages.cycleCount,
    isIrregular: Boolean(profile.isIrregular),
    source: averages.source,
    mode: profile.mode,
    forecastAllowed: forecastEligibility.allowed,
  });

  // JSON round-trip = what the client receives (Dates → ISO, undefined dropped).
  return JSON.parse(JSON.stringify(bundle));
}

/** In-memory twin of cyclePredictionHistory.observeNextPeriodPrediction (dedup by identity). */
function observeNextPeriodPrediction(c, input) {
  if (
    !E.shouldObservePrediction({
      mode: input.mode,
      predictedDate: input.predictedDate,
      cycleAnchorDate: input.cycleAnchorDate,
      forecastAllowed: input.forecastAllowed,
    })
  ) {
    return;
  }
  const identity = E.snapshotIdentity({
    userId: input.userId,
    predictedDate: input.predictedDate,
    cycleAnchorDate: input.cycleAnchorDate,
    confidence: input.confidence,
  });
  if (c.snapshots.some((s) => E.isSameSnapshotIdentity({ ...s, userId: identity.userId }, identity))) return;
  c.snapshots.push({
    id: uuid(`snap:${identity.userId}:${identity.cycleAnchorDate}:${identity.predictedDate}:${identity.confidence}`),
    ...identity,
    snapshotDate: input.today,
    snapshotAt: new Date().toISOString(),
    validGapCount: Number.isFinite(input.validGapCount) ? input.validGapCount : 0,
    isIrregular: Boolean(input.isIrregular),
    source: input.source || 'stored',
  });
}

// ---------- write helpers (mirror the route handlers) ----------

function touch(c) {
  c.dirty = true;
  c.profile.updatedAt = new Date().toISOString();
}

function findLog(c, date) {
  return c.logs.find((l) => l.date === date) ?? null;
}

function upsertLog(c, date, create, update) {
  const existing = findLog(c, date);
  const now = new Date().toISOString();
  if (existing) {
    Object.assign(existing, update, { updatedAt: now });
    return existing;
  }
  const row = { ...logRow(c.profile.userId, date), ...create, createdAt: now, updatedAt: now };
  c.logs.push(row);
  c.logs.sort((a, b) => a.date.localeCompare(b.date));
  return row;
}

function upsertBleedDay(c, date, flow) {
  return upsertLog(c, date, { flow }, { flow });
}

function clearBleedDay(c, date) {
  const existing = findLog(c, date);
  if (!existing) return;
  if (!E.logHasExtras(existing)) {
    c.logs = c.logs.filter((l) => l !== existing);
    return;
  }
  existing.flow = 'none';
  existing.updatedAt = new Date().toISOString();
}

/** server syncLastPeriodStart: re-derive the stored LMP from what the logs say; always drop the AI cache. */
function syncLastPeriodStart(c, today, touched = []) {
  const logs = engineLogs(c, today);
  const current = E.toDateKey(c.profile.lastPeriodStart);
  const next = E.pickLastPeriodStart(current, logs, undefined, undefined, touched);
  if (next !== current) c.profile.lastPeriodStart = dateIso(next);
  Object.assign(c.profile, E.emptyCycleAiCache());
}

function assertDate(key, today) {
  return E.assertCycleDateKey(key, today);
}

function pickEnum(value, allowed, field) {
  if (value === undefined || value === null) return value;
  if (!allowed.includes(value)) throw invalidField(field);
  return value;
}

// ---------- route plumbing ----------

/** server assertFemale: reads the signed-in user's gender (core.mjs `state.user`, editable in onboarding). */
function isFemale(rq) {
  const gender = rq.state.user?.gender;
  return gender ? gender === 'FEMALE' : rq.persona !== 'man';
}

function femaleOnly(rq) {
  const c = cycleState(rq);
  if (!isFemale(rq)) {
    throw httpError(403, 'ციკლის მოდული ხელმისაწვდომია მხოლოდ ქალის პროფილისთვის.', 'Cycle tracking is available only for female profiles.');
  }
  return c;
}

function handle(fn) {
  return async (rq) => {
    if (!E) {
      return rq.reply(500, { error: 'mock: cycle engine failed to load', detail: String(engineError?.message || engineError) });
    }
    try {
      return await fn(rq);
    } catch (error) {
      if (typeof error?.status === 'number' && error.status >= 400 && error.status < 600) {
        const en = langOf(rq) === 'en' && typeof error.messageEn === 'string' && error.messageEn;
        return rq.reply(error.status, {
          error: en || error.message || 'Request declined.',
          ...(error.code ? { code: error.code } : {}),
          ...(error.fields ? { fields: error.fields } : {}),
        });
      }
      throw error;
    }
  };
}

const route = (method, path, fn) => ({ method, path, handler: handle(fn) });

// ---------- routes ----------

function getBundle(rq) {
  femaleOnly(rq);
  return buildBundle(rq);
}

function logsSince(c, from) {
  return c.logs
    .filter((l) => l.date >= from)
    .sort((a, b) => b.date.localeCompare(a.date))
    .map(shapeCycleLog);
}

function applyPeriod(rq) {
  const c = femaleOnly(rq);
  const today = rq.today;
  const body = rq.body ?? {};
  if (!['start', 'end', 'fill'].includes(body.action)) throw invalidField('action');
  const flow = pickEnum(body.flow, ['light', 'medium', 'heavy'], 'flow') ?? E.DEFAULT_BLEED_FLOW;
  const touched = [];
  if (body.action === 'start') {
    const date = assertDate(body.date, today);
    const plan = E.planStartPeriod(date, findLog(c, date)?.flow, flow);
    if (!plan.alreadyLogged) upsertBleedDay(c, date, plan.flow);
  } else if (body.action === 'end') {
    const date = assertDate(body.date, today);
    const existing = E.filterLogsForEngine(c.logs, today).sort((a, b) => a.date.localeCompare(b.date));
    const inferred = E.inferCycleStats(existing);
    const plan = E.planEndPeriod({ ranges: inferred.periodRanges, logs: existing, endDate: date });
    for (const key of plan.clear) {
      clearBleedDay(c, key);
      touched.push(key);
    }
  } else {
    const start = assertDate(body.start, today);
    const end = assertDate(body.end, today);
    if (start > end) throw httpError(400, 'დასრულების თარიღი ვერ იქნება დაწყებაზე ადრე.', 'The end date cannot be before the start date.');
    const existing = E.filterLogsForEngine(c.logs, today).sort((a, b) => a.date.localeCompare(b.date));
    const plan = E.planFillRange(start, end, existing, flow);
    for (const key of plan.fill) upsertBleedDay(c, key, plan.flow);
  }
  syncLastPeriodStart(c, today, touched);
  touch(c);
  return buildBundle(rq);
}

function editPeriodDays(rq) {
  const c = femaleOnly(rq);
  const today = rq.today;
  const body = rq.body ?? {};
  const addList = Array.isArray(body.add) ? body.add : [];
  const removeList = Array.isArray(body.remove) ? body.remove : [];
  if (addList.length > 120 || removeList.length > 120) throw invalidField(addList.length > 120 ? 'add' : 'remove');
  const add = [...new Set(addList.map((d) => assertDate(d, today)))];
  const remove = [...new Set(removeList.map((d) => assertDate(d, today)))].filter((d) => !add.includes(d));
  for (const date of add) {
    if (!E.isPeriodFlow(findLog(c, date)?.flow)) upsertBleedDay(c, date, E.DEFAULT_BLEED_FLOW);
  }
  for (const date of remove) clearBleedDay(c, date);
  syncLastPeriodStart(c, today, [...add, ...remove]);
  touch(c);
  return buildBundle(rq);
}

function upsertDayLog(rq) {
  const c = femaleOnly(rq);
  const today = rq.today;
  const date = assertDate(rq.params.date, today);
  const body = rq.body && typeof rq.body === 'object' ? rq.body : {};
  pickEnum(body.flow, FLOWS, 'flow');
  pickEnum(body.cervicalMucus, MUCUS, 'cervicalMucus');
  pickEnum(body.ovulationTest, TEST_RESULTS, 'ovulationTest');
  pickEnum(body.pregnancyTest, TEST_RESULTS, 'pregnancyTest');
  if (body.libido != null && !(Number.isInteger(body.libido) && body.libido >= 1 && body.libido <= 5)) throw invalidField('libido');
  if (body.bbt != null && !(typeof body.bbt === 'number' && body.bbt >= 34 && body.bbt <= 42)) throw invalidField('bbt');

  const existing = findLog(c, date);
  const observations = E.parseObservationWrite(body, existing || {});
  if (observations.customTagIds) {
    const owned = new Set(c.tags.map((t) => t.id));
    if (observations.customTagIds.some((id) => !owned.has(id))) {
      throw httpError(403, 'ნიშანი ამ ანგარიშს არ ეკუთვნის.', 'This tag does not belong to your account.');
    }
  }
  const notes = body.notes === undefined ? undefined : body.notes == null ? null : String(body.notes).trim().slice(0, 2000) || null;
  const create = {
    flow: body.flow ?? null,
    symptoms: observations.symptoms ?? [],
    moods: observations.moods ?? [],
    sexualActivity: body.sexualActivity ?? null,
    libido: body.libido ?? null,
    bbt: body.bbt ?? null,
    cervicalMucus: body.cervicalMucus ?? null,
    ovulationTest: body.ovulationTest ?? null,
    pregnancyTest: body.pregnancyTest ?? null,
    notes: observations.notes !== undefined ? observations.notes : notes ?? null,
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
  };
  const update = {};
  for (const key of ['flow', 'sexualActivity', 'libido', 'bbt', 'cervicalMucus', 'ovulationTest', 'pregnancyTest']) {
    if (body[key] !== undefined) update[key] = body[key];
  }
  for (const key of [
    'symptoms',
    'moods',
    'notes',
    'painEntries',
    'sleepQuality',
    'stressLevel',
    'exerciseLevel',
    'caffeine',
    'alcohol',
    'customTagIds',
    'observations',
    'observationSchemaVersion',
    'observationAssessments',
  ]) {
    if (observations[key] !== undefined) update[key] = observations[key];
  }
  if (update.notes === undefined && notes !== undefined && observations.notes === undefined) update.notes = notes;
  const log = upsertLog(c, date, create, update);
  syncLastPeriodStart(c, today, [date]);
  touch(c);
  return { log: JSON.parse(JSON.stringify(shapeCycleLog(log))), bundle: buildBundle(rq) };
}

function removeDayLog(rq) {
  const c = femaleOnly(rq);
  const today = rq.today;
  const date = assertDate(rq.params.date, today);
  c.logs = c.logs.filter((l) => l.date !== date);
  syncLastPeriodStart(c, today, [date]);
  touch(c);
  return buildBundle(rq);
}

function setLastPeriod(rq) {
  const c = femaleOnly(rq);
  const date = assertDate(rq.body?.date ?? rq.body?.lastPeriodStart, rq.today);
  c.profile.lastPeriodStart = dateIso(date);
  touch(c);
  return buildBundle(rq);
}

function createShare(c, permissions) {
  const token = E.generateShareToken();
  c.share = {
    id: uuid(`share:${token}`),
    ownerUserId: c.profile.userId,
    partnerUserId: null,
    permissions: E.mergeSharePermissions(permissions),
    expiresAt: E.shareExpiresAt().toISOString(),
    createdAt: new Date().toISOString(),
    revokedAt: null,
  };
  c.profile.partnerShareCode = token;
}

function revokeShare(c) {
  if (c.share) c.share.revokedAt = new Date().toISOString();
  c.profile.partnerShareCode = null;
}

function updateShare(c, permissions) {
  if (!shareLive(c)) return;
  c.share.permissions = E.mergeSharePermissions({ ...c.share.permissions, ...(permissions || {}) });
}

function updateProfile(rq) {
  const c = femaleOnly(rq);
  const today = rq.today;
  const body = rq.body && typeof rq.body === 'object' ? rq.body : {};
  const p = c.profile;
  if (body.mode !== undefined) {
    pickEnum(body.mode, MODES, 'mode');
    // ?force=1 (QA only): switch into pregnancy/postpartum without an episode, to render their quick logs.
    if (!SIMPLE_MODES.has(body.mode) && body.mode !== p.mode && rq.query?.force !== '1') {
      throw httpError(400, 'ეს რეჟიმი სატესტო სერვერზე არ არის.', `mock: switching to ${body.mode} is not simulated (pregnancy/postpartum episodes).`);
    }
  }
  const int = (v, lo, hi, field) => {
    if (v === undefined) return undefined;
    if (!Number.isInteger(v) || v < lo || v > hi) throw invalidField(field);
    return v;
  };
  const avgCycleLength = int(body.avgCycleLength, 21, 45, 'avgCycleLength');
  const avgPeriodLength = int(body.avgPeriodLength, 2, 10, 'avgPeriodLength');
  if (body.lastPeriodStart) assertDate(body.lastPeriodStart, today);
  if (body.contraceptionStartedAt) assertDate(body.contraceptionStartedAt, today);
  if (body.contraceptionMethod != null) pickEnum(body.contraceptionMethod, E.CONTRACEPTION_METHODS, 'contraceptionMethod');
  if (body.conditions !== undefined) {
    if (!Array.isArray(body.conditions)) throw invalidField('conditions');
    body.conditions.forEach((x) => pickEnum(x, ['pcos', 'endometriosis', 'perimenopause'], 'conditions'));
  }

  if (body.mode !== undefined) p.mode = body.mode;
  if (avgCycleLength !== undefined) p.avgCycleLength = avgCycleLength;
  if (avgPeriodLength !== undefined) p.avgPeriodLength = avgPeriodLength;
  if (typeof body.isIrregular === 'boolean') p.isIrregular = body.isIrregular;
  if (typeof body.privacyEnabled === 'boolean') p.privacyEnabled = body.privacyEnabled;
  if (body.lastPeriodStart !== undefined) p.lastPeriodStart = body.lastPeriodStart ? dateIso(body.lastPeriodStart) : null;
  if (body.conditions !== undefined) p.conditions = [...body.conditions];
  if (body.reminderPrefs !== undefined && body.reminderPrefs && typeof body.reminderPrefs === 'object') p.reminderPrefs = { ...body.reminderPrefs };
  if (body.contraceptionMethod !== undefined) p.contraceptionMethod = body.contraceptionMethod;
  if (body.contraceptionStartedAt !== undefined) p.contraceptionStartedAt = body.contraceptionStartedAt ? dateIso(body.contraceptionStartedAt) : null;
  if (body.contraceptionMethod === 'NONE' && body.contraceptionStartedAt === undefined) p.contraceptionStartedAt = null;
  if (body.dueDate !== undefined) p.dueDate = body.dueDate ? dateIso(body.dueDate) : null;

  if (body.enablePartnerShare === true) createShare(c, body.sharePermissions);
  if (body.enablePartnerShare === false) revokeShare(c);
  if (body.sharePermissions && body.enablePartnerShare !== true && body.enablePartnerShare !== false) {
    updateShare(c, body.sharePermissions);
  }
  touch(c);
  return buildBundle(rq);
}

function tagView(t) {
  return { id: t.id, name: t.name, archivedAt: t.archivedAt ?? null, createdAt: t.createdAt };
}

function parseTagName(raw) {
  const parsed = E.normalizeTagName(raw);
  if (!parsed.ok) {
    throw parsed.error === 'too_long'
      ? httpError(400, 'ნიშანი ძალიან გრძელია.', 'The tag is too long.')
      : httpError(400, 'ნიშნის სახელი ცარიელია.', 'The tag name is empty.');
  }
  return parsed;
}

function createTag(rq) {
  const c = femaleOnly(rq);
  const body = rq.body ?? {};
  const parsed = parseTagName(body.name);
  if (body.id && !E.isClientUuid(body.id)) throw httpError(400, 'ნიშნის იდენტიფიკატორი არასწორია.', 'The tag ID is not valid.');
  const active = c.tags.filter((t) => !t.archivedAt);
  const same = active.find((t) => t.nameNormalized === parsed.nameNormalized);
  if (same) return { tag: tagView(same), bundle: buildBundle(rq) };
  if (active.length >= E.CYCLE_TAG_ACTIVE_MAX) throw httpError(400, 'აქტიური ნიშნების ლიმიტი ამოწურულია.', 'You have reached the limit of active tags.');
  const taken = body.id ? c.tags.find((t) => t.id === body.id) : null;
  let tag;
  if (taken) {
    Object.assign(taken, { name: parsed.name, nameNormalized: parsed.nameNormalized, archivedAt: null });
    tag = taken;
  } else {
    tag = {
      id: body.id || uuid(`tag:${Date.now()}:${Math.random()}`),
      name: parsed.name,
      nameNormalized: parsed.nameNormalized,
      createdAt: new Date().toISOString(),
      archivedAt: null,
    };
    c.tags.push(tag);
  }
  touch(c);
  return { tag: tagView(tag), bundle: buildBundle(rq) };
}

function renameTag(rq) {
  const c = femaleOnly(rq);
  const parsed = parseTagName(rq.body?.name);
  const tag = c.tags.find((t) => t.id === rq.params.id);
  if (!tag) throw httpError(404, 'ნიშანი ვერ მოიძებნა.', 'Tag not found.');
  if (c.tags.some((t) => t.id !== tag.id && !t.archivedAt && t.nameNormalized === parsed.nameNormalized)) {
    throw httpError(409, 'ასეთი ნიშანი უკვე არსებობს.', 'A tag with this name already exists.');
  }
  Object.assign(tag, { name: parsed.name, nameNormalized: parsed.nameNormalized });
  touch(c);
  return { tag: tagView(tag), bundle: buildBundle(rq) };
}

function archiveTag(rq) {
  const c = femaleOnly(rq);
  const tag = c.tags.find((t) => t.id === rq.params.id);
  if (!tag) throw httpError(404, 'ნიშანი ვერ მოიძებნა.', 'Tag not found.');
  tag.archivedAt = tag.archivedAt || new Date().toISOString();
  touch(c);
  return { tag: tagView(tag), bundle: buildBundle(rq) };
}

/** No AI in the mock: the server's non-AI branch (local insights as a fallback). */
function insights(rq) {
  const c = femaleOnly(rq);
  const bundle = buildBundle(rq);
  const cached = c.profile.aiInsights;
  if (cached && rq.body?.refresh !== true) {
    return { insights: cached, cached: true, localInsights: bundle.localInsights };
  }
  const fallback = { ...bundle.localInsights, source: 'local_fallback', headline: bundle.localInsights.headline };
  return { insights: fallback, cached: false, localInsights: bundle.localInsights, engine: 'mock' };
}

function wipe(rq) {
  const c = femaleOnly(rq);
  if (rq.body?.confirm !== E.DELETE_CYCLE_CONFIRM) {
    throw httpError(400, 'ციკლის მონაცემების წასაშლელად საჭიროა დადასტურება.', 'Please confirm before deleting your cycle data.');
  }
  const deleted = {
    logs: c.logs.length,
    tags: c.tags.length,
    pregnancyLogs: c.pregnancyLogs.length,
    pregnancyEpisodes: 0,
    pregnancyCarePlan: 0,
    postpartumEpisodes: 0,
    postpartumBleedClassifications: 0,
    shares: c.share ? 1 : 0,
    predictionSnapshots: c.snapshots.length,
    profiles: 1,
  };
  Object.assign(c, {
    profile: emptyProfile(c.profile.userId, new Date().toISOString()),
    logs: [],
    tags: [],
    snapshots: [],
    share: null,
    pregnancyLogs: [],
  });
  touch(c);
  return { ok: true, deleted, bundle: buildBundle(rq) };
}

function exportData(rq) {
  const c = femaleOnly(rq);
  const bundle = buildBundle(rq);
  return E.buildCycleExportPayload({
    profile: bundle.profile,
    logs: bundle.logs,
    customTags: bundle.customTags,
    inferred: bundle.inferred,
    contraception: bundle.contraception,
    pregnancyLogs: bundle.pregnancyLogs,
    predictionSnapshots: c.snapshots.map((s) => ({
      type: s.type,
      predictedDate: s.predictedDate,
      snapshotDate: s.snapshotDate,
      cycleAnchorDate: s.cycleAnchorDate,
      confidence: s.confidence,
      engineVersion: s.engineVersion,
    })),
    pregnancyEpisodes: [],
    pregnancyCarePlan: [],
    postpartumEpisodes: [],
    postpartumBleedClassifications: [],
    postpartumReturn: E.serializePostpartumReturnForExport({
      forecastGateKind: c.profile.forecastGateKind,
      forecastGateEpisodeId: c.profile.forecastGateEpisodeId,
      forecastEligibility: bundle.forecastEligibility,
    }),
  });
}

function ttc(rq) {
  const c = femaleOnly(rq);
  const bundle = buildBundle(rq);
  const today = bundle.meta.today;
  return E.buildCycleTtcData({
    today,
    profile: bundle.profile,
    logs: logsSince(c, addDays(today, -(E.TTC_HISTORY_DAYS - 1))),
    predictions: bundle.predictions,
    contraception: bundle.contraception,
  });
}

function pregnancyData(rq) {
  const c = femaleOnly(rq);
  const bundle = buildBundle(rq);
  const today = bundle.meta.today;
  const from = E.pregnancyLogQueryFrom({ episode: null, today, historyDays: E.PREGNANCY_HISTORY_DAYS });
  return JSON.parse(
    JSON.stringify(
      E.buildCyclePregnancyData({ today, profile: bundle.profile, episode: null, logs: logsSince(c, from), carePlanStates: [] }),
    ),
  );
}

function postpartumData(rq) {
  const c = femaleOnly(rq);
  const bundle = buildBundle(rq);
  const today = bundle.meta.today;
  return JSON.parse(
    JSON.stringify(
      E.buildCyclePostpartumData({
        today,
        profile: bundle.profile,
        episode: null,
        logs: logsSince(c, addDays(today, -(E.POSTPARTUM_HISTORY_DAYS - 1))),
        classifiedDates: [],
        classifiedEpisodes: [],
        latestClassified: null,
        bleedEpisodes: [],
      }),
    ),
  );
}

function observationTrends(rq) {
  const c = femaleOnly(rq);
  const today = rq.today;
  const from = addDays(today, -(E.OBSERVATION_TREND_QUERY_DAYS - 1));
  const logs = c.logs
    .filter((l) => l.date >= from)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(shapeCycleLog);
  const inferred = E.inferCycleStats(logs);
  return JSON.parse(JSON.stringify(E.buildObservationTrends({ logs, today, inferred })));
}

function doctorSummary(rq) {
  const c = femaleOnly(rq);
  const today = rq.today;
  const q = rq.query ?? {};
  const isKey = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
  const flag = (v) => v === '1' || v === 'true';
  const to = isKey(q.to) && q.to < today ? q.to : today;
  let from = isKey(q.from) ? q.from : addDays(to, -(E.DOCTOR_SUMMARY_QUERY_DAYS - 1));
  if (from > to) from = to;
  if (E.daysBetween(from, to) + 1 > E.DOCTOR_SUMMARY_MAX_RANGE_DAYS) from = addDays(to, -(E.DOCTOR_SUMMARY_MAX_RANGE_DAYS - 1));
  const logs = c.logs
    .filter((l) => l.date >= from && l.date <= to)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(shapeCycleLog);
  let inferred = null;
  if (c.profile.mode === 'PERIMENOPAUSE') {
    const horizonFrom = addDays(today, -(E.PERIMENOPAUSE_INTERVAL_HORIZON_DAYS - 1));
    inferred = E.inferCycleStats(
      c.logs.filter((l) => l.date >= horizonFrom && l.date <= today).map((l) => ({ date: l.date, flow: l.flow })),
    );
  }
  return JSON.parse(
    JSON.stringify(
      E.buildCycleDoctorSummaryData({
        profile: c.profile,
        logs,
        today,
        inferred,
        pregnancyEpisode: null,
        postpartumEpisode: null,
        options: {
          from: isKey(q.from) ? q.from : undefined,
          to: isKey(q.to) ? q.to : undefined,
          includeFertility: flag(q.includeFertility),
          includeSexual: flag(q.includeSexual),
          includeNotes: flag(q.includeNotes),
        },
      }),
    ),
  );
}

function predictionHistory(rq) {
  const c = femaleOnly(rq);
  const today = rq.today;
  const engine = E.filterLogsForEngine(c.logs, today).sort((a, b) => a.date.localeCompare(b.date));
  const inferred = E.inferCycleStats(engine.map((l) => ({ date: l.date, flow: l.flow })));
  const loggedAtByDate = {};
  for (const log of engine) if (log.createdAt && !loggedAtByDate[log.date]) loggedAtByDate[log.date] = log.createdAt;
  const snapshots = [...c.snapshots].sort((a, b) => a.snapshotAt.localeCompare(b.snapshotAt));
  const history = quietly(() => E.buildPredictionHistory(snapshots, { periodStarts: inferred.periodStarts, loggedAtByDate }));
  return JSON.parse(JSON.stringify(history));
}

function shareGet(rq) {
  femaleOnly(rq);
  return { share: buildBundle(rq).partnerShare };
}

function shareCreate(rq) {
  const c = femaleOnly(rq);
  if (!shareLive(c)) createShare(c, rq.body?.permissions);
  touch(c);
  return buildBundle(rq);
}

function sharePatch(rq) {
  const c = femaleOnly(rq);
  if (!shareLive(c)) throw httpError(404, 'გაზიარება ვერ მოიძებნა.', 'Sharing was not found.');
  updateShare(c, rq.body?.permissions);
  touch(c);
  return buildBundle(rq);
}

function shareDelete(rq) {
  const c = femaleOnly(rq);
  revokeShare(c);
  touch(c);
  return buildBundle(rq);
}

// GET /api/community/membership (women's-space gate read by Home) lives in engage.mjs.
export const routes = [
  route('GET', '/api/cycle', getBundle),
  route('GET', '/api/cycle/export', exportData),
  route('GET', '/api/cycle/ttc', ttc),
  route('GET', '/api/cycle/pregnancy', pregnancyData),
  route('GET', '/api/cycle/postpartum', postpartumData),
  route('GET', '/api/cycle/observation-trends', observationTrends),
  route('GET', '/api/cycle/doctor-summary', doctorSummary),
  route('GET', '/api/cycle/prediction-history', predictionHistory),
  route('POST', '/api/cycle/wipe', wipe),
  route('PUT', '/api/cycle/profile', updateProfile),
  route('PATCH', '/api/cycle/profile', updateProfile),
  route('POST', '/api/cycle/last-period', setLastPeriod),
  route('GET', '/api/cycle/share', shareGet),
  route('POST', '/api/cycle/share', shareCreate),
  route('PATCH', '/api/cycle/share', sharePatch),
  route('DELETE', '/api/cycle/share', shareDelete),
  route('PUT', '/api/cycle/period', applyPeriod),
  route('PUT', '/api/cycle/period/days', editPeriodDays),
  route('PUT', '/api/cycle/logs/:date', upsertDayLog),
  route('DELETE', '/api/cycle/logs/:date', removeDayLog),
  route('POST', '/api/cycle/tags', createTag),
  route('PATCH', '/api/cycle/tags/:id', renameTag),
  route('DELETE', '/api/cycle/tags/:id', archiveTag),
  route('POST', '/api/cycle/insights', insights),
];
