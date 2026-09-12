/**
 * Phase 14 — clinician-facing Cycle doctor summary.
 * Dedicated serializer. Not partner, not AI, not personal export, not Journal trends.
 * Facts only. Missing log ≠ negative. Predictions are never historical facts.
 */

import { addDays, daysBetween, inferCycleStats, isPeriodFlow, toDateKey } from './cycle.js';
import {
  DOCTOR_SUMMARY,
  OBSERVATION_CATEGORIES,
  PAIN_SYMPTOM_TO_TYPE,
  PAIN_TYPES,
  getObservationDef,
  observationDoctorSummary,
  stripPainManagedSymptoms,
} from './cycleObservationRegistry.js';
import {
  isPregnancyProfileMode,
  PREGNANCY_EPISODE_ACTIVE,
  presentPregnancyDating,
} from './cyclePregnancy.js';
import {
  buildVariabilitySummary,
  completedCycleIntervals,
  isPerimenopauseProfileMode,
} from './cyclePerimenopause.js';
import {
  isPostpartumProfileMode,
  POSTPARTUM_EPISODE_ACTIVE,
  postpartumElapsed,
} from './cyclePostpartum.js';

export const DOCTOR_SUMMARY_QUERY_DAYS = 180;
export const DOCTOR_SUMMARY_MAX_RANGE_DAYS = 366;
export const DOCTOR_SUMMARY_MAX_EPISODES = 6;
export const DOCTOR_SUMMARY_MAX_PAIN_ROWS = 24;
export const DOCTOR_SUMMARY_MAX_DATES = 8;
export const DOCTOR_SUMMARY_VERSION = 'cycle.doctor-summary.v1';

const FERTILITY_CATEGORIES = new Set([
  OBSERVATION_CATEGORIES.FERTILITY,
  OBSERVATION_CATEGORIES.PREGNANCY_TEST,
]);
const SEXUAL_CATEGORIES = new Set([OBSERVATION_CATEGORIES.SEXUAL_HEALTH]);

function civilDate(value) {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return toDateKey(value) || String(value || '').slice(0, 10);
}

function inWindow(date, from, to) {
  return date >= from && date <= to;
}

function policyAllows(key, options) {
  const defn = getObservationDef(key);
  if (!defn || !defn.enabled) return false;
  const policy = defn.doctorSummary || DOCTOR_SUMMARY.EXCLUDE;
  if (policy === DOCTOR_SUMMARY.EXCLUDE) return false;
  if (policy === DOCTOR_SUMMARY.INCLUDE || policy === DOCTOR_SUMMARY.INCLUDE_IF_NONEMPTY) return true;
  if (policy === DOCTOR_SUMMARY.REQUIRES_EXPLICIT_USER_OPT_IN) {
    if (FERTILITY_CATEGORIES.has(defn.category)) return Boolean(options.includeFertility);
    if (SEXUAL_CATEGORIES.has(defn.category)) return Boolean(options.includeSexual);
    if (defn.category === OBSERVATION_CATEGORIES.FREE_TEXT) return Boolean(options.includeNotes);
    return false;
  }
  return false;
}

function energyValue(log) {
  const bag = log?.observations && typeof log.observations === 'object' ? log.observations : {};
  return bag.energy || log?.energy || null;
}

function consecutiveFlowSequence(logs) {
  const seq = [];
  for (const log of logs) {
    const flow = log.flow;
    if (!isPeriodFlow(flow)) continue;
    if (!seq.length || seq[seq.length - 1] !== flow) seq.push(flow);
  }
  return seq;
}

function dominantSeverity(counts) {
  const entries = Object.entries(counts).filter(([, n]) => n > 0);
  if (!entries.length) return null;
  entries.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  if (entries.length > 1 && entries[0][1] === entries[1][1]) return null;
  return entries[0][0];
}

function normalizeOptions(raw = {}) {
  return {
    includeFertility: Boolean(raw.includeFertility),
    includeSexual: Boolean(raw.includeSexual),
    includeNotes: Boolean(raw.includeNotes),
    from: raw.from || null,
    to: raw.to || null,
  };
}

function resolveRange({ logs, today, options }) {
  const day = civilDate(today) || civilDate(logs[logs.length - 1]?.date);
  const requestedTo = options.to && /^\d{4}-\d{2}-\d{2}$/.test(options.to) ? options.to : day;
  const to = requestedTo > day ? day : requestedTo;
  let from;
  if (options.from && /^\d{4}-\d{2}-\d{2}$/.test(options.from)) {
    from = options.from;
  } else {
    from = addDays(to, -(DOCTOR_SUMMARY_QUERY_DAYS - 1));
  }
  if (from > to) from = to;
  const span = daysBetween(from, to) + 1;
  if (span > DOCTOR_SUMMARY_MAX_RANGE_DAYS) {
    from = addDays(to, -(DOCTOR_SUMMARY_MAX_RANGE_DAYS - 1));
  }
  return { from, to, queryDays: daysBetween(from, to) + 1 };
}

const DOCTOR_SUMMARY_FRUIT_LEAK = [
  'weekDevelopment',
  'comparisonKey',
  'lengthCm',
  'weightGrams',
  'developmentFactKeys',
  'illustrationKey',
  'carePlannerSummary',
  'pregnancyCarePlan',
  'careItemId',
  'reminderEnabled',
  'reminderOffset',
  'reminderMode',
  'exactReminderOffsetMinutes',
  'plannedTime',
  'plannedPlace',
  'calendarEventId',
  'calendarExport',
  'liveBirth',
  'birthDate',
  'deliveryDate',
  'deliveryType',
  'vaginalBirth',
  'cSection',
  'miscarriage',
  'stillbirth',
  'abortion',
  'ectopic',
  'neonatalOutcome',
  'infantStatus',
];

/**
 * Current Pregnancy tracking context for the clinician report.
 * Generation-time snapshot. Not in-range history. Not a diagnosis.
 * Week/day and due date come from presentPregnancyDating — never recomputed here.
 */
export function buildDoctorPregnancyContext({ profile, pregnancyEpisode, today } = {}) {
  if (!isPregnancyProfileMode(profile?.mode)) return null;
  if (!pregnancyEpisode || pregnancyEpisode.status !== PREGNANCY_EPISODE_ACTIVE) return null;
  const dating = presentPregnancyDating({
    referenceDate: civilDate(pregnancyEpisode.referenceDate),
    referenceType: pregnancyEpisode.referenceType,
    today: civilDate(today),
  });
  const reviewRequired = Boolean(dating.reviewRequired);
  const age = !reviewRequired && dating.estimatedGestationalAge ? dating.estimatedGestationalAge : null;
  const due = !reviewRequired && dating.estimatedDueDate?.date ? dating.estimatedDueDate : null;
  return {
    current: true,
    trackingMode: 'PREGNANCY',
    referenceDate: dating.referenceDate || null,
    referenceType: dating.referenceType || null,
    reviewRequired,
    estimatedGestationalAge:
      age && Number.isFinite(age.week) && Number.isFinite(age.day)
        ? { week: age.week, day: age.day }
        : null,
    estimatedDueDate: due?.date ? { date: due.date, estimated: true } : null,
  };
}

/**
 * Current Perimenopause tracking context for the clinician report.
 * Generation-time snapshot. Not in-range history. Not a diagnosis.
 * Interval range reuses Phase 24 completedCycleIntervals / buildVariabilitySummary.
 */
export function buildDoctorPerimenopauseContext({ profile, inferred = null, logs = [], today } = {}) {
  if (!isPerimenopauseProfileMode(profile?.mode)) return null;
  const todayKey = civilDate(today);
  if (!todayKey) return null;
  const starts = inferred?.periodStarts || inferCycleStats(logs).periodStarts || [];
  const intervals = completedCycleIntervals(starts, { today: todayKey });
  const summary = buildVariabilitySummary(intervals);
  const variability =
    summary.intervalCount >= 2 && summary.shortestDays != null && summary.longestDays != null
      ? {
          intervalCount: summary.intervalCount,
          shortestDays: summary.shortestDays,
          longestDays: summary.longestDays,
          sourceWindow: summary.sourceWindow,
        }
      : null;
  return {
    current: true,
    trackingMode: 'PERIMENOPAUSE',
    userSelected: true,
    variability,
  };
}

/**
 * Current Postpartum tracking context for the clinician report.
 * Generation-time snapshot. Not obstetric history. Not a diagnosis.
 * Elapsed week/day come from postpartumElapsed — never recomputed here.
 */
export function buildDoctorPostpartumContext({ profile, postpartumEpisode, today } = {}) {
  if (!isPostpartumProfileMode(profile?.mode)) return null;
  if (!postpartumEpisode || postpartumEpisode.status !== POSTPARTUM_EPISODE_ACTIVE) {
    console.warn('[cycle-doctor-summary] postpartum_context_invariant mode_without_active_episode');
    return null;
  }
  const todayKey = civilDate(today);
  const raw = postpartumEpisode.referenceDate;
  const referenceDate =
    raw == null || raw === ''
      ? null
      : civilDate(raw) && /^\d{4}-\d{2}-\d{2}$/.test(civilDate(raw))
        ? civilDate(raw)
        : null;
  const full = referenceDate && todayKey ? postpartumElapsed(referenceDate, todayKey) : null;
  return {
    current: true,
    trackingMode: 'POSTPARTUM',
    referenceDate: referenceDate || null,
    elapsed:
      full && Number.isFinite(full.week) && Number.isFinite(full.day)
        ? { week: full.week, day: full.day }
        : null,
  };
}

/**
 * @param {{
 *   profile?: object,
 *   logs?: object[],
 *   today?: string,
 *   inferred?: object,
 *   pregnancyEpisode?: object | null,
 *   postpartumEpisode?: object | null,
 *   options?: { includeFertility?: boolean, includeSexual?: boolean, includeNotes?: boolean, from?: string, to?: string }
 * }} input
 */
export function buildCycleDoctorSummaryData({
  profile = {},
  logs = [],
  today,
  inferred = null,
  pregnancyEpisode = null,
  postpartumEpisode = null,
  options: rawOptions,
} = {}) {
  const options = normalizeOptions(rawOptions);
  const { from, to, queryDays } = resolveRange({ logs, today, options });
  const windowLogs = (logs || []).filter((log) => {
    const date = civilDate(log?.date);
    return date && inWindow(date, from, to);
  });
  const stats = inferred || inferCycleStats(logs);
  const episodes = (stats.periodRanges || [])
    .filter((range) => range?.start && range.end && range.source !== 'predicted')
    .filter((range) => range.end >= from && range.start <= to)
    .sort((a, b) => a.start.localeCompare(b.start))
    .slice(-DOCTOR_SUMMARY_MAX_EPISODES)
    .map((range) => {
      const days = windowLogs
        .filter((log) => log.date >= range.start && log.date <= range.end)
        .sort((a, b) => a.date.localeCompare(b.date));
      return {
        start: range.start,
        end: range.end,
        durationDays: range.lengthDays || daysBetween(range.start, range.end) + 1,
        flowSequence: consecutiveFlowSequence(days),
        source: 'DERIVED_FROM_LOGGED_PERIODS',
      };
    });

  const spottingDates = windowLogs
    .filter((log) => log.flow === 'spotting')
    .map((log) => civilDate(log.date))
    .filter(Boolean);

  const cycleLengths = [];
  const starts = (stats.periodStarts || []).filter((d) => d <= to);
  for (let i = 1; i < starts.length; i += 1) {
    const gap = daysBetween(starts[i - 1], starts[i]);
    if (gap >= 18 && gap <= 45 && starts[i] >= from && starts[i] <= to) {
      cycleLengths.push({
        start: starts[i - 1],
        end: starts[i],
        lengthDays: gap,
        source: 'DERIVED_FROM_LOGGED_PERIODS',
      });
    }
  }

  const periodDayCount = windowLogs.filter((log) => isPeriodFlow(log.flow)).length;

  const painRows = [];
  const symptomDays = new Map();
  const energyRows = [];
  const sleepRows = [];
  const stressRows = [];
  const fertility = {
    ovulationTests: [],
    pregnancyTests: [],
    bbt: [],
    cervicalMucus: [],
  };
  const sexual = [];
  const notes = [];

  for (const log of windowLogs) {
    const date = civilDate(log.date);
    const pain = Array.isArray(log.painEntries) ? log.painEntries : [];
    const covered = new Set();
    for (const entry of pain) {
      if (!PAIN_TYPES.includes(entry?.type)) continue;
      if (!policyAllows('pain', options)) continue;
      covered.add(entry.type);
      painRows.push({
        date,
        type: entry.type,
        severity: entry.severity || null,
        source: 'USER_LOGGED',
      });
    }
    const symptoms = stripPainManagedSymptoms(Array.isArray(log.symptoms) ? log.symptoms : [], pain);
    for (const id of symptoms) {
      const mapped = PAIN_SYMPTOM_TO_TYPE[id];
      if (mapped) {
        if (!covered.has(mapped) && policyAllows('pain', options)) {
          covered.add(mapped);
          painRows.push({ date, type: mapped, severity: null, source: 'USER_LOGGED' });
        }
        continue;
      }
      if (!policyAllows(id, options)) continue;
      const defn = getObservationDef(id);
      if (SEXUAL_CATEGORIES.has(defn.category)) {
        sexual.push({ date, key: id, source: 'USER_LOGGED' });
        continue;
      }
      if (!symptomDays.has(id)) symptomDays.set(id, new Set());
      symptomDays.get(id).add(date);
    }

    if (policyAllows('energy', options)) {
      const energy = energyValue(log);
      if (energy) energyRows.push({ date, value: energy, source: 'USER_LOGGED' });
    }
    if (policyAllows('sleepQuality', options) && log.sleepQuality) {
      sleepRows.push({ date, value: log.sleepQuality, label: 'self_reported_quality', source: 'USER_LOGGED' });
    }
    if (policyAllows('stressLevel', options) && log.stressLevel) {
      stressRows.push({ date, value: log.stressLevel, source: 'USER_LOGGED' });
    }
    if (policyAllows('ovulationTest', options) && log.ovulationTest) {
      fertility.ovulationTests.push({ date, result: log.ovulationTest, source: 'USER_LOGGED' });
    }
    if (policyAllows('pregnancyTest', options) && log.pregnancyTest) {
      fertility.pregnancyTests.push({ date, result: log.pregnancyTest, source: 'USER_LOGGED' });
    }
    if (policyAllows('bbt', options) && log.bbt != null && Number.isFinite(Number(log.bbt))) {
      fertility.bbt.push({ date, temperature: Number(log.bbt), unit: 'celsius', source: 'USER_LOGGED' });
    }
    if (policyAllows('cervicalMucus', options) && log.cervicalMucus) {
      fertility.cervicalMucus.push({ date, value: log.cervicalMucus, source: 'USER_LOGGED' });
    }
    if (policyAllows('sexualActivity', options) && log.sexualActivity) {
      sexual.push({ date, key: 'sexualActivity', source: 'USER_LOGGED' });
    }
    if (policyAllows('libido', options) && log.libido != null) {
      sexual.push({ date, key: 'libido', value: log.libido, source: 'USER_LOGGED' });
    }
    if (policyAllows('notes', options) && typeof log.notes === 'string' && log.notes.trim()) {
      notes.push({ date, text: log.notes, source: 'USER_LOGGED' });
    }
  }

  painRows.sort((a, b) => b.date.localeCompare(a.date) || a.type.localeCompare(b.type));
  const painByType = new Map();
  for (const row of painRows) {
    if (!painByType.has(row.type)) {
      painByType.set(row.type, { type: row.type, dates: new Set(), severities: { mild: 0, moderate: 0, severe: 0 } });
    }
    const bucket = painByType.get(row.type);
    bucket.dates.add(row.date);
    if (row.severity && Object.hasOwn(bucket.severities, row.severity)) bucket.severities[row.severity] += 1;
  }
  const painAggregates = [...painByType.values()].map((bucket) => ({
    type: bucket.type,
    dayCount: bucket.dates.size,
    severityMode: dominantSeverity(bucket.severities),
    source: 'USER_LOGGED',
  }));

  const symptoms = [...symptomDays.entries()]
    .map(([key, dates]) => ({
      key,
      dayCount: dates.size,
      dates: [...dates].sort().reverse().slice(0, DOCTOR_SUMMARY_MAX_DATES),
      source: 'USER_LOGGED',
    }))
    .sort((a, b) => b.dayCount - a.dayCount || a.key.localeCompare(b.key));

  const contraceptionMethod = profile.contraceptionMethod || null;
  const contraception =
    observationDoctorSummary('contraceptionMethod') === DOCTOR_SUMMARY.INCLUDE_IF_NONEMPTY && contraceptionMethod
      ? {
          method: contraceptionMethod,
          startedAt: civilDate(profile.contraceptionStartedAt) || null,
          source: 'USER_LOGGED',
          label: 'self_reported',
        }
      : null;

  const menstrualHistory =
    episodes.length || spottingDates.length || cycleLengths.length
      ? {
          episodes,
          spottingDates: spottingDates.slice(0, 40),
          cycleLengths: cycleLengths.slice(-12),
          periodDayCount,
        }
      : null;

  const pain =
    painRows.length
      ? {
          rows: painRows.slice(0, DOCTOR_SUMMARY_MAX_PAIN_ROWS),
          aggregates: painAggregates,
        }
      : null;

  const wellnessParts = {};
  if (energyRows.length) wellnessParts.energy = energyRows.slice(0, 16);
  if (sleepRows.length) wellnessParts.sleep = sleepRows.slice(0, 16);
  if (stressRows.length) wellnessParts.stress = stressRows.slice(0, 16);
  const wellness = Object.keys(wellnessParts).length ? wellnessParts : null;

  const fertilitySection = options.includeFertility
    ? {
        ovulationTests: fertility.ovulationTests.slice(0, 20),
        pregnancyTests: fertility.pregnancyTests.slice(0, 20),
        bbt: fertility.bbt.slice(0, 40),
        cervicalMucus: fertility.cervicalMucus.slice(0, 20),
      }
    : null;
  const fertilityHasData =
    fertilitySection &&
    (fertilitySection.ovulationTests.length ||
      fertilitySection.pregnancyTests.length ||
      fertilitySection.bbt.length ||
      fertilitySection.cervicalMucus.length);

  const privateSection = options.includeSexual || options.includeNotes
    ? {
        sexual: options.includeSexual ? sexual.slice(0, 20) : [],
        notes: options.includeNotes ? notes.slice(0, 12) : [],
      }
    : null;
  const privateHasData =
    privateSection && (privateSection.sexual.length || privateSection.notes.length);

  const stressCounts = { low: 0, medium: 0, high: 0 };
  for (const row of stressRows) {
    if (Object.hasOwn(stressCounts, row.value)) stressCounts[row.value] += 1;
  }
  const sleepCounts = { poor: 0, okay: 0, good: 0 };
  for (const row of sleepRows) {
    if (Object.hasOwn(sleepCounts, row.value)) sleepCounts[row.value] += 1;
  }

  const pregnancyContext = buildDoctorPregnancyContext({
    profile,
    pregnancyEpisode,
    today: civilDate(today) || to,
  });
  const perimenopauseContext = buildDoctorPerimenopauseContext({
    profile,
    inferred,
    logs,
    today: civilDate(today) || to,
  });
  const postpartumContext = buildDoctorPostpartumContext({
    profile,
    postpartumEpisode,
    today: civilDate(today) || to,
  });

  return {
    version: DOCTOR_SUMMARY_VERSION,
    generatedAt: `${to}T00:00:00.000Z`,
    range: {
      from,
      to,
      queryDays,
      loggedDays: windowLogs.length,
    },
    inclusions: {
      menstrual: true,
      pain: true,
      symptoms: true,
      wellness: true,
      fertility: Boolean(options.includeFertility),
      sexual: Boolean(options.includeSexual),
      notes: Boolean(options.includeNotes),
      pregnancyContext: Boolean(pregnancyContext),
      perimenopauseContext: Boolean(perimenopauseContext),
      postpartumContext: Boolean(postpartumContext),
    },
    pregnancyContext,
    perimenopauseContext,
    postpartumContext,
    menstrualHistory,
    pain,
    symptoms: symptoms.length ? { rows: symptoms } : null,
    wellness,
    contraception,
    fertilityObservations: fertilityHasData ? fertilitySection : null,
    privateObservations: privateHasData ? privateSection : null,
    disclaimer: 'history_not_diagnosis',
    sourceLabels: ['USER_LOGGED', 'DERIVED_FROM_LOGGED_PERIODS'],
    // Compatibility aliases for the frozen Journal stats band (owner bundle only).
    // These are derived from logged period gaps, not forecast predictions.
    mode: profile.mode ?? null,
    avgCycleLength: profile.avgCycleLength ?? stats.avgCycleLength ?? null,
    avgPeriodLength: profile.avgPeriodLength ?? stats.avgPeriodLength ?? null,
    cycleCount: stats.cycleCount ?? 0,
    shortestCycle: (stats.cycleGaps || []).length ? Math.min(...stats.cycleGaps) : null,
    longestCycle: (stats.cycleGaps || []).length ? Math.max(...stats.cycleGaps) : null,
    loggedDays: windowLogs.length,
    periodDaysLogged: periodDayCount,
    painObservations: pain ? pain.rows : [],
    lifestyleSummary: {
      sleep: sleepCounts,
      stress: stressCounts,
      exercise: { none: 0, light: 0, moderate: 0, intense: 0 },
      caffeine: { none: 0, low: 0, moderate: 0, high: 0 },
      alcohol: { none: 0, light: 0, moderate: 0, heavy: 0 },
    },
    topSymptoms: symptoms.map((row) => ({ key: row.key, count: row.dayCount })).slice(0, 8),
    topMoods: [],
  };
}

export function buildDoctorSummary(args) {
  return buildCycleDoctorSummaryData(args);
}

export function doctorSummaryHasSensitiveLeak(payload, options = {}) {
  if (Object.hasOwn(payload, 'nextPeriodStart') || Object.hasOwn(payload, 'ovulationDate')) return true;
  if (Object.hasOwn(payload, 'observationTrends') || Object.hasOwn(payload, 'fertileWindow')) return true;
  if (!options.includeNotes && payload?.privateObservations?.notes?.length) return true;
  if (!options.includeSexual && payload?.privateObservations?.sexual?.length) return true;
  if (!options.includeFertility && payload?.fertilityObservations) return true;
  const text = JSON.stringify(payload);
  if (text.includes('observationTrends')) return true;
  if (!options.includeNotes && /private journal/.test(text)) return true;
  if (DOCTOR_SUMMARY_FRUIT_LEAK.some((key) => text.includes(`"${key}"`))) return true;
  const peri = payload?.perimenopauseContext;
  if (peri && (peri.nextPeriodStart || peri.forecast || peri.fertileWindow || peri.lateStatus || peri.symptoms)) {
    return true;
  }
  const pp = payload?.postpartumContext;
  if (
    pp &&
    (pp.liveBirth ||
      pp.birthDate ||
      pp.deliveryDate ||
      pp.deliveryType ||
      pp.startedAt ||
      pp.endedAt ||
      pp.id ||
      pp.trackingContext ||
      pp.plannedPlace ||
      pp.plannedTime ||
      (pp.elapsed && Object.hasOwn(pp.elapsed, 'days')))
  ) {
    return true;
  }
  return false;
}
