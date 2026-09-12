/**
 * Cycle prediction helpers — period, fertile window, ovulation.
 * Identity is a civil calendar day YYYY-MM-DD, never a timestamp.
 * Engine "today" is resolved by cycleCivilDate (device TZ → stored quest TZ →
 * Asia/Tbilisi). Never Date#toISOString, never host TZ, never a UTC midnight identity.
 */

import {
  CYCLE_AI_HONESTY_RULES,
  CYCLE_CONTRACEPTION_AI_RULES,
  CYCLE_HISTORY_AI_RULES,
  CYCLE_OBSERVATION_AI_RULES,
  cycleHonestyFlags,
  irregularLengthAlertKa,
  latePeriodAlertKa,
  nextPeriodEstimateBody,
  pcosCautionKa,
  ttcWindowBody,
  emptyCycleAiCache,
} from './cycleHonesty.js';
import {
  buildTtcObservationCards,
  CYCLE_FERTILITY_AI_RULES,
} from './cycleFertility.js';
import {
  CYCLE_FIELD_CATEGORIES,
  classifyCycleSymptomKey,
  inspectCycleAiCategories,
  serializeCycleLogForAi,
} from './cycleAiContext.js';
import {
  contraceptionInsightsFilter,
  interpretContraception,
} from './cycleContraception.js';
import {
  logHasPhase9Extras,
  stripPainManagedSymptoms,
} from './cycleObservations.js';
import { buildPmsByDaysBefore, historicalAnalyticsForAi } from './cycleHistoryAnalytics.js';
import { segmentHistoricalCycles } from './cycleHistory.js';
import { isCycleAiContextSupported, profileModeForAiPrompt } from './cycleModes.js';

export { emptyCycleAiCache };
export { buildDoctorSummary, buildCycleDoctorSummaryData } from './cycleDoctorSummary.js';

export const CYCLE_TIMEZONE = 'Asia/Tbilisi';
export const DEFAULT_CYCLE_LENGTH = 28;
export const DEFAULT_PERIOD_LENGTH = 5;

/** Product "today" in an IANA zone. Host / browser TZ must not leak in. */
export function todayInTimeZone(timeZone = CYCLE_TIMEZONE, now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const pick = (type) => parts.find((p) => p.type === type)?.value;
  return `${pick('year')}-${pick('month')}-${pick('day')}`;
}

/**
 * Serialize a stored date-only value (@db.Date or YYYY-MM-DD).
 * Uses UTC civil parts so midnight UTC does not shift the calendar day.
 * Do not use this for "now" — use todayInTimeZone.
 */
export function toDateKey(value) {
  if (!value) return null;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

export function parseDateKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function addDays(key, days) {
  const d = parseDateKey(key);
  d.setUTCDate(d.getUTCDate() + days);
  return toDateKey(d);
}

export function daysBetween(a, b) {
  const ms = parseDateKey(b) - parseDateKey(a);
  return Math.round(ms / 86_400_000);
}

/** Confirmed bleed — spotting is not a period start. */
export const PERIOD_FLOWS = ['light', 'medium', 'heavy'];

/** Merge at most one interior calendar day (missing or spotting). Explicit `none` never bridges. */
export const PERIOD_MERGE_MAX_INTERIOR_DAYS = 1;
/** Inclusive calendar span when bridging a logging gap. Consecutive logged bleed is not split. */
export const PERIOD_MERGE_MAX_SPAN_DAYS = 10;

export function isPeriodFlow(flow) {
  return PERIOD_FLOWS.includes(flow);
}

/** missing row / null flow vs explicit none vs spotting vs bleed. */
export function classifyCycleFlowDay(flow) {
  if (isPeriodFlow(flow)) return 'bleed';
  if (flow === 'none') return 'none';
  if (flow === 'spotting') return 'spotting';
  return 'missing';
}

function interiorHasExplicitNone(prevBleed, nextBleed, byDate) {
  let d = addDays(prevBleed, 1);
  while (d < nextBleed) {
    if (classifyCycleFlowDay(byDate.get(d)?.flow) === 'none') return true;
    d = addDays(d, 1);
  }
  return false;
}

/**
 * Same menstrual episode vs new episode.
 * Consecutive bleed always continues. A single missing/spotting day may continue
 * if the episode span stays ≤ 10 days. Explicit flow=none never continues.
 */
export function canContinuePeriod(runStart, lastBleed, nextBleed, byDate) {
  if (!runStart || !lastBleed || !nextBleed) return false;
  const gap = daysBetween(lastBleed, nextBleed);
  if (gap <= 1) return true;
  const interior = gap - 1;
  if (interior > PERIOD_MERGE_MAX_INTERIOR_DAYS) return false;
  if (daysBetween(runStart, nextBleed) + 1 > PERIOD_MERGE_MAX_SPAN_DAYS) return false;
  if (interiorHasExplicitNone(lastBleed, nextBleed, byDate)) return false;
  return true;
}

/** Infer averages and logged period ranges from bleed days (not spotting). */
export function inferCycleStats(
  logs,
  fallbackCycle = DEFAULT_CYCLE_LENGTH,
  fallbackPeriod = DEFAULT_PERIOD_LENGTH,
) {
  const periodStarts = [];
  const periodRanges = [];
  const sorted = [...logs].sort((x, y) => x.date.localeCompare(y.date));
  const byDate = new Map(sorted.map((log) => [log.date, log]));
  let lastBleedDate = null;
  let runStart = null;
  let runEnd = null;

  const flushRun = () => {
    if (!runStart || !runEnd) return;
    periodRanges.push({
      start: runStart,
      end: runEnd,
      lengthDays: daysBetween(runStart, runEnd) + 1,
      source: 'logged',
    });
    runStart = null;
    runEnd = null;
  };

  for (const log of sorted) {
    if (!isPeriodFlow(log.flow)) continue;
    if (!lastBleedDate || !canContinuePeriod(runStart, lastBleedDate, log.date, byDate)) {
      flushRun();
      periodStarts.push(log.date);
      runStart = log.date;
      runEnd = log.date;
    } else {
      runEnd = log.date;
    }
    lastBleedDate = log.date;
  }
  flushRun();

  const gaps = [];
  for (let i = 1; i < periodStarts.length; i += 1) {
    const gap = daysBetween(periodStarts[i - 1], periodStarts[i]);
    if (gap >= 18 && gap <= 45) gaps.push(gap);
  }

  const hasInferredCycle = gaps.length >= 2;
  const avgCycle = hasInferredCycle
    ? Math.round(gaps.reduce((s, n) => s + n, 0) / gaps.length)
    : fallbackCycle;

  const periodLengths = periodRanges
    .map((r) => r.lengthDays)
    .filter((n) => n >= 2 && n <= 10);
  const hasInferredPeriod = periodLengths.length >= 1;
  const avgPeriod = hasInferredPeriod
    ? Math.round(periodLengths.reduce((s, n) => s + n, 0) / periodLengths.length)
    : fallbackPeriod;

  const inferredCycleLength = hasInferredCycle
    ? Math.min(45, Math.max(21, avgCycle))
    : null;
  const inferredPeriodLength = hasInferredPeriod
    ? Math.min(10, Math.max(2, avgPeriod))
    : null;

  return {
    avgCycleLength: inferredCycleLength ?? Math.min(45, Math.max(21, fallbackCycle)),
    avgPeriodLength: inferredPeriodLength ?? Math.min(10, Math.max(2, fallbackPeriod)),
    inferredCycleLength,
    inferredPeriodLength,
    periodStarts,
    periodRanges,
    cycleGaps: gaps,
    cycleCount: gaps.length,
    lastPeriodStart: periodStarts[periodStarts.length - 1] ?? null,
  };
}

/**
 * Recommendation C: never overwrite stored profile averages.
 * Forecast uses inferred lengths when cycleCount >= 2, else stored, else defaults.
 */
export function resolveForecastAverages(profile, inferred) {
  const storedCycle = Number.isFinite(profile?.avgCycleLength)
    ? profile.avgCycleLength
    : DEFAULT_CYCLE_LENGTH;
  const storedPeriod = Number.isFinite(profile?.avgPeriodLength)
    ? profile.avgPeriodLength
    : DEFAULT_PERIOD_LENGTH;
  const cycleCount = inferred?.cycleCount ?? 0;
  const inferredCycle = inferred?.inferredCycleLength ?? null;
  const inferredPeriod = inferred?.inferredPeriodLength ?? null;

  if (cycleCount >= 2 && inferredCycle != null) {
    return {
      storedCycleLength: storedCycle,
      storedPeriodLength: storedPeriod,
      inferredCycleLength: inferredCycle,
      inferredPeriodLength: inferredPeriod,
      usedCycleLength: inferredCycle,
      usedPeriodLength: inferredPeriod ?? storedPeriod,
      source: 'inferred',
      cycleCount,
    };
  }

  const usingDefaults =
    storedCycle === DEFAULT_CYCLE_LENGTH && storedPeriod === DEFAULT_PERIOD_LENGTH;

  return {
    storedCycleLength: storedCycle,
    storedPeriodLength: storedPeriod,
    inferredCycleLength: inferredCycle,
    inferredPeriodLength: inferredPeriod,
    usedCycleLength: storedCycle,
    usedPeriodLength: storedPeriod,
    source: usingDefaults ? 'default' : 'user',
    cycleCount,
  };
}

export function cycleLengthStats(cycleLengths = []) {
  const lengths = cycleLengths.map((c) => c.length).filter((n) => Number.isFinite(n));
  if (!lengths.length) {
    return { shortest: null, longest: null, variability: null, count: 0 };
  }
  const shortest = Math.min(...lengths);
  const longest = Math.max(...lengths);
  return {
    shortest,
    longest,
    variability: longest - shortest,
    count: lengths.length,
  };
}

/** HIGH needs ≥6 in-band gaps and trimmed/full spread ≤7 days. MEDIUM needs ≥2 gaps and spread ≤14. */
export const CONFIDENCE_HIGH_MIN_GAPS = 6;
export const CONFIDENCE_HIGH_MAX_RANGE_DAYS = 7;
export const CONFIDENCE_MEDIUM_MIN_GAPS = 2;
export const CONFIDENCE_MEDIUM_MAX_RANGE_DAYS = 14;

/**
 * Robust spread of in-band cycle lengths.
 * n < 6: full range (small samples cannot spare an outlier).
 * n ≥ 6: trimmed range (drop one min and one max) so a single isolated cycle
 * does not collapse confidence, while persistent 21/45 chaos stays wide.
 */
export function cycleLengthSpread(lengths) {
  const nums = (Array.isArray(lengths) ? lengths : []).map(Number).filter((n) => Number.isFinite(n));
  if (nums.length < 2) return null;
  const sorted = [...nums].sort((a, b) => a - b);
  const used = sorted.length >= CONFIDENCE_HIGH_MIN_GAPS ? sorted.slice(1, -1) : sorted;
  return Math.max(...used) - Math.min(...used);
}

/**
 * Confidence = history quantity AND typical consistency of the same 18–45 day gaps.
 * Metric: trimmed range at n≥6, else full range. No fake percentages.
 * Missing lengths never produce HIGH.
 */
export function predictionConfidence({
  cycleCount = 0,
  isIrregular = false,
  cycleLengths = null,
} = {}) {
  if (isIrregular || cycleCount < CONFIDENCE_MEDIUM_MIN_GAPS) return 'low';
  const lengths = Array.isArray(cycleLengths)
    ? cycleLengths.map(Number).filter((n) => Number.isFinite(n))
    : null;
  const spread = lengths && lengths.length >= 2 ? cycleLengthSpread(lengths) : null;
  if (spread != null && spread > CONFIDENCE_MEDIUM_MAX_RANGE_DAYS) return 'low';
  if (
    cycleCount >= CONFIDENCE_HIGH_MIN_GAPS &&
    spread != null &&
    spread <= CONFIDENCE_HIGH_MAX_RANGE_DAYS
  ) {
    return 'high';
  }
  if (spread == null && cycleCount >= CONFIDENCE_HIGH_MIN_GAPS) return 'medium';
  return 'medium';
}

/**
 * Build predictions from last period start + averages.
 * Fertile window ≈ ovulation −5 … ovulation +1; ovulation ≈ cycleLength − 14.
 * Forecast object is always estimated. Logs must overlay predicted:false separately.
 */
export function buildPredictions({
  lastPeriodStart,
  avgCycleLength = DEFAULT_CYCLE_LENGTH,
  avgPeriodLength = DEFAULT_PERIOD_LENGTH,
  horizonDays = 90,
  cycleCount = 0,
  isIrregular = false,
  cycleLengths = null,
  logs = [],
}) {
  const confidence = predictionConfidence({ cycleCount, isIrregular, cycleLengths });
  if (!lastPeriodStart) {
    return {
      nextPeriodStart: null,
      nextPeriodEnd: null,
      ovulationDate: null,
      fertileWindow: null,
      phases: [],
      calendar: {},
      confidence,
      estimated: true,
    };
  }

  const calendar = {};
  const phases = [];
  let start = lastPeriodStart;

  for (let cycle = 0; cycle < 4; cycle += 1) {
    const periodEnd = addDays(start, avgPeriodLength - 1);
    const ovulation = addDays(start, avgCycleLength - 14);
    const fertileStart = addDays(ovulation, -5);
    const fertileEnd = addDays(ovulation, 1);
    const nextStart = addDays(start, avgCycleLength);

    phases.push({
      periodStart: start,
      periodEnd,
      ovulation,
      fertileStart,
      fertileEnd,
      nextPeriodStart: nextStart,
    });

    for (let i = 0; i < avgPeriodLength; i += 1) {
      const key = addDays(start, i);
      calendar[key] = {
        ...(calendar[key] || {}),
        period: true,
        predicted: true,
        estimated: true,
      };
    }
    for (let i = 0; i <= daysBetween(fertileStart, fertileEnd); i += 1) {
      const key = addDays(fertileStart, i);
      calendar[key] = { ...(calendar[key] || {}), fertile: true, estimated: true };
    }
    calendar[ovulation] = {
      ...(calendar[ovulation] || {}),
      ovulation: true,
      fertile: true,
      estimated: true,
    };

    start = nextStart;
    if (daysBetween(lastPeriodStart, start) > horizonDays) break;
  }

  const upcoming = phases.find((p) => p.periodStart >= lastPeriodStart) || phases[0];
  const next = phases.find((p) => p.periodStart > lastPeriodStart) || phases[1] || upcoming;

  let marked = calendar;
  if (logs.length) marked = overlayLogsOnCalendar(marked, logs);
  marked = stampCalendarPhases(marked, {
    lastPeriodStart,
    avgCycleLength,
    avgPeriodLength,
    fromKey: lastPeriodStart,
    toKey: addDays(lastPeriodStart, horizonDays),
  });

  return {
    nextPeriodStart: next?.periodStart ?? null,
    nextPeriodEnd: next?.periodEnd ?? null,
    ovulationDate: upcoming?.ovulation ?? null,
    fertileWindow: upcoming
      ? { start: upcoming.fertileStart, end: upcoming.fertileEnd }
      : null,
    phases,
    calendar: marked,
    confidence,
    estimated: true,
  };
}

/** Fill every civil day in [fromKey, toKey] with server cycleDay + phase. */
export function stampCalendarPhases(calendar, {
  lastPeriodStart,
  avgCycleLength = DEFAULT_CYCLE_LENGTH,
  avgPeriodLength = DEFAULT_PERIOD_LENGTH,
  fromKey,
  toKey,
}) {
  if (!lastPeriodStart || !fromKey || !toKey) return calendar;
  const next = { ...calendar };
  let key = fromKey;
  for (let i = 0; i < 500 && key <= toKey; i += 1) {
    const info = detectCyclePhase({
      lastPeriodStart,
      avgCycleLength,
      avgPeriodLength,
      today: key,
    });
    const prev = next[key] || {};
    const loggedActual = prev.predicted === false;
    next[key] = {
      ...prev,
      cycleDay: info.day,
      phase: info.phase,
      phaseKa: info.phaseKa,
      estimated: loggedActual ? false : Boolean(prev.predicted || prev.fertile || prev.ovulation),
    };
    key = addDays(key, 1);
  }
  return next;
}

/** Derived LMP from logs wins; stored onboarding LMP is the fallback. */
export function resolveLastPeriodStart(stored, inferredStart) {
  return inferredStart || stored || null;
}

/** Keep onboarding/profile start when logs have no confirmed bleed run. */
export function pickLastPeriodStart(
  current,
  logs,
  fallbackCycle = DEFAULT_CYCLE_LENGTH,
  fallbackPeriod = DEFAULT_PERIOD_LENGTH,
) {
  const inferred = inferCycleStats(logs, fallbackCycle, fallbackPeriod);
  return resolveLastPeriodStart(current, inferred.lastPeriodStart);
}

/**
 * Overlay daily logs on a forecast calendar.
 * Logged light/medium/heavy → period + predicted:false.
 * Spotting / none never count as a period day.
 */
export function overlayLogsOnCalendar(calendar, logs) {
  const next = { ...calendar };
  for (const log of logs) {
    const hasNotes =
      (Array.isArray(log.symptoms) && log.symptoms.length > 0) ||
      (Array.isArray(log.moods) && log.moods.length > 0) ||
      log.notes ||
      log.bbt != null ||
      log.sexualActivity != null ||
      log.ovulationTest != null ||
      log.pregnancyTest != null ||
      Boolean(log.cervicalMucus) ||
      logHasPhase9Extras(log) ||
      (log.observations && typeof log.observations === 'object' && Object.keys(log.observations).length > 0);
    const hasJournal = Boolean(log.notes);
    if (isPeriodFlow(log.flow)) {
      next[log.date] = {
        ...(next[log.date] || {}),
        period: true,
        predicted: false,
        estimated: false,
        logged: true,
        hasNote: Boolean(hasJournal),
        flow: log.flow,
      };
    } else if (log.flow === 'spotting') {
      next[log.date] = {
        ...(next[log.date] || {}),
        logged: true,
        hasNote: Boolean(hasJournal),
        flow: 'spotting',
        period: false,
      };
    } else if (log.flow === 'none' || hasNotes) {
      next[log.date] = {
        ...(next[log.date] || {}),
        logged: true,
        hasNote: Boolean(hasJournal),
        ...(log.flow ? { flow: log.flow } : {}),
        ...(log.flow === 'none' ? { period: false } : {}),
      };
    }
  }
  return next;
}

export function gestationalAge(dueDateKey, todayKey = todayInTimeZone()) {
  if (!dueDateKey || !todayKey) return null;
  // Pregnancy: due date = LMP + 280 days → current day of pregnancy = 280 - daysUntilDue
  const daysUntilDue = daysBetween(todayKey, dueDateKey);
  const dayOfPregnancy = 280 - daysUntilDue;
  if (dayOfPregnancy < 0 || dayOfPregnancy > 300) return null;
  const week = Math.floor(dayOfPregnancy / 7);
  const day = dayOfPregnancy % 7;
  return { week, day, dayOfPregnancy, trimester: week < 13 ? 1 : week < 27 ? 2 : 3 };
}

/** Size metaphors by pregnancy week (Georgian). */
export const FETAL_SIZE_KA = {
  4: { size: 'ყაყაჩოს მარცვალი', note: 'იმპლანტაცია და ადრეული განვითარება' },
  5: { size: 'სეზამის მარცვალი', note: 'გულის პირველი დარტყმები' },
  6: { size: 'ოცეული', note: 'ნერვული მილის ფორმირება' },
  8: { size: 'მოცვი', note: 'კიდურების ჩანასახები' },
  10: { size: 'მარწყვი', note: 'ორგანოების ძირითადი სტრუქტურა' },
  12: { size: 'ცაცხვი', note: 'პირველი ტრიმესტრის დასასრული' },
  14: { size: 'ქლიავი', note: 'მიმიკის კუნთები იწყებს მუშაობას' },
  16: { size: 'ავოკადო', note: 'შეგიძლიათ იგრძნოთ მოძრაობა' },
  18: { size: 'ბულგარული წიწაკა', note: 'სმენის განვითარება' },
  20: { size: 'ბანანი', note: 'შუა ორსულობა — ანატომიური სკანირება' },
  24: { size: 'სიმინდის თავი', note: 'ფილტვების მომწიფება იწყება' },
  28: { size: 'ბადრიჯანი', note: 'თვალები იხსნება' },
  32: { size: 'კოქოსი', note: 'ცხიმოვანი ქსოვილის დაგროვება' },
  36: { size: 'რომანული სალათი', note: 'მზადება მშობიარობისთვის' },
  40: { size: 'საზამთრო', note: 'სრული ვადა' },
};

export function fetalInsightForWeek(week) {
  const keys = Object.keys(FETAL_SIZE_KA)
    .map(Number)
    .sort((a, b) => a - b);
  let best = keys[0];
  for (const k of keys) {
    if (k <= week) best = k;
  }
  return { week, ...(FETAL_SIZE_KA[best] || FETAL_SIZE_KA[14]) };
}

export function detectCyclePhase({
  lastPeriodStart,
  avgCycleLength = DEFAULT_CYCLE_LENGTH,
  avgPeriodLength = DEFAULT_PERIOD_LENGTH,
  today = todayInTimeZone(),
}) {
  if (!lastPeriodStart) return { day: null, phase: 'unknown', phaseKa: 'უცნობი ფაზა' };
  const day = daysBetween(lastPeriodStart, today) + 1;
  if (day < 1) return { day: null, phase: 'unknown', phaseKa: 'უცნობი ფაზა' };
  const cycleDay = ((day - 1) % avgCycleLength) + 1;
  // Same civil day as buildPredictions: ovulation = LMP + (length − 14) → cycle day length − 13.
  const ovulationCycleDay = avgCycleLength - 13;
  if (cycleDay <= avgPeriodLength) {
    return { day: cycleDay, phase: 'period', phaseKa: 'მენსტრუაცია' };
  }
  if (cycleDay >= ovulationCycleDay - 5 && cycleDay <= ovulationCycleDay + 1) {
    return {
      day: cycleDay,
      phase: cycleDay === ovulationCycleDay ? 'ovulation' : 'fertile',
      phaseKa: cycleDay === ovulationCycleDay ? 'ოვულაცია' : 'ნაყოფიერი ფანჯარა',
    };
  }
  if (cycleDay > ovulationCycleDay + 1) {
    return { day: cycleDay, phase: 'luteal', phaseKa: 'ლუთეალური ფაზა' };
  }
  return { day: cycleDay, phase: 'follicular', phaseKa: 'ფოლიკულური ფაზა' };
}

/** Instant Flo-like tips (no AI) — shown while / as fallback to EvidenceMD. */
export function buildLocalInsights({ profile, logs, predictions, pregnancy, averages, today, contraception }) {
  const phase = detectCyclePhase({
    lastPeriodStart: toDateKey(profile.lastPeriodStart),
    avgCycleLength: averages?.usedCycleLength ?? profile.avgCycleLength,
    avgPeriodLength: averages?.usedPeriodLength ?? profile.avgPeriodLength,
    today: today || todayInTimeZone(),
  });
  const flags = cycleHonestyFlags({
    confidence: predictions?.confidence,
    isIrregular: profile.isIrregular,
    conditions: parseConditions(profile),
  });
  const recent = [...logs].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3);
  const symptoms = recent.flatMap((l) => (Array.isArray(l.symptoms) ? l.symptoms : []));
  const moods = recent.flatMap((l) => (Array.isArray(l.moods) ? l.moods : []));
  const cards = [];

  cards.push({
    id: 'phase_today',
    tone: phase.phase === 'fertile' || phase.phase === 'ovulation' ? 'fertile' : 'calm',
    title: phase.phaseKa,
    body:
      phase.day != null
        ? `დღეს ციკლის ${phase.day}-ე დღეა. სავარაუდო ფაზა: ${phase.phaseKa}. ეს კალენდარული შეფასებაა, არა ჰორმონის გაზომვა.`
        : 'მონიშნეთ ბოლო მენსტრუაციის დასაწყისი უფრო ზუსტი პროგნოზებისთვის.',
    action: 'გახსენი დღის აღრიცხვა',
  });

  if (symptoms.includes('cramps') || symptoms.includes('back_pain')) {
    cards.push({
      id: 'cramps_care',
      tone: 'care',
      title: 'კრუნჩხვების შემსუბუქება',
      body: 'სითბო მუცელზე, მსუბუქი გაჭიმვა და ჰიდრატაცია ხშირად ეხმარება. ძლიერი ტკივილისას მიმართეთ ექიმს.',
      action: 'დალიე წყალი და დაისვენე',
    });
  }
  if (moods.includes('anxious') || moods.includes('irritable') || moods.includes('sad')) {
    cards.push({
      id: 'mood_support',
      tone: 'mood',
      title: 'განწყობის მხარდაჭერა',
      body: 'მოკლე სეირნობა, სუნთქვის ვარჯიში ან საყვარელ ადამიანთან საუბარი შეუძლია დაძაბულობის შემცირებას.',
      action: '5 წუთი სიღრმისეული სუნთქვა',
    });
  }
  if (
    profile.mode === 'TRY_TO_CONCEIVE' &&
    predictions?.fertileWindow &&
    contraception?.presentation?.showFertileWindow !== false
  ) {
    cards.push({
      id: 'ttc_window',
      tone: 'fertile',
      title: 'სავარაუდო ნაყოფიერი ფანჯარა',
      body: ttcWindowBody(predictions, flags),
      action: 'აღრიცხე BBT ან ლორწო',
    });
    cards.push(
      ...buildTtcObservationCards({
        logs,
        today: today || todayInTimeZone(),
        lastPeriodStart: toDateKey(profile.lastPeriodStart),
      }),
    );
  }
  if (profile.mode === 'PREGNANCY' && pregnancy?.age) {
    const source =
      pregnancy.referenceType === 'LMP'
        ? 'LMP-ზე დაფუძნებული შეფასება'
        : 'არჩეულ თარიღზე დაფუძნებული შეფასება';
    cards.push({
      id: 'preg_week',
      tone: 'pregnancy',
      title: 'ორსულობის რეჟიმი',
      body: `კვირა ${pregnancy.age.week} + ${pregnancy.age.day} დღე. ${source}. ეს არ არის დიაგნოზი.`,
      action: null,
    });
  }
  if (predictions?.nextPeriodStart && profile.mode !== 'PREGNANCY' && profile.mode !== 'PERIMENOPAUSE') {
    cards.push({
      id: 'next_period',
      tone: 'energy',
      title:
        contraception?.bleedingLabel === 'bleeding'
          ? 'სავარაუდო შემდეგი სისხლდენა'
          : 'სავარაუდო შემდეგი მენსტრუაცია',
      body: nextPeriodEstimateBody(predictions.nextPeriodStart, flags),
      action: null,
    });
  }

  const filtered = contraceptionInsightsFilter(cards, contraception);

  return {
    headline:
      contraception?.predictionAvailability === 'LIMITED'
        ? 'აღრიცხვები და კონტრაცეფციის კონტექსტი'
        : phase.day != null
          ? `დღეს: სავარაუდო ${phase.phaseKa}`
          : 'თქვენი ციკლის რჩევები',
    phaseLabel:
      contraception?.predictionAvailability === 'LIMITED'
        ? contraception.presentation?.phaseLabelOverride || phase.phaseKa
        : phase.phaseKa,
    cards: filtered.slice(0, 7),
    source: 'local',
    generatedAt: new Date().toISOString(),
  };
}

export function parseConditions(profile) {
  const raw = profile?.conditions;
  if (Array.isArray(raw)) return raw.map(String).filter(Boolean);
  return [];
}

export function buildCycleTrends({ profile, logs, inferred, averages, today }) {
  const periodStarts = inferred?.periodStarts ?? [];
  const cycleLengths = [];
  for (let i = 1; i < periodStarts.length; i += 1) {
    const gap = daysBetween(periodStarts[i - 1], periodStarts[i]);
    if (gap >= 18 && gap <= 45) {
      cycleLengths.push({ start: periodStarts[i], length: gap });
    }
  }

  const todayKey = today || todayInTimeZone();
  const historicalCycles = segmentHistoricalCycles(inferred?.periodStarts ?? []);
  const pmsByDaysBefore = buildPmsByDaysBefore(logs, historicalCycles);

  const symptomFreq = {};
  const cutoff = addDays(todayKey, -90);
  for (const log of logs) {
    if (log.date < cutoff) continue;
    for (const s of stripPainManagedSymptoms(
      Array.isArray(log.symptoms) ? log.symptoms : [],
      log.painEntries,
    )) {
      const cat = classifyCycleSymptomKey(s);
      if (cat !== CYCLE_FIELD_CATEGORIES.GENERAL_WELLNESS && cat !== CYCLE_FIELD_CATEGORIES.MOOD) continue;
      symptomFreq[s] = (symptomFreq[s] || 0) + 1;
    }
  }
  const topSymptoms90d = Object.entries(symptomFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([key, count]) => ({ key, count }));

  const bbtPoints = logs
    .filter((l) => l.bbt != null && Number.isFinite(l.bbt))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-60)
    .map((l) => ({ date: l.date, bbt: l.bbt }));

  const stats = cycleLengthStats(cycleLengths);
  return {
    cycleLengths,
    pmsByDay: [],
    pmsByDaysBefore,
    topSymptoms90d,
    bbtPoints,
    periodStarts,
    shortestCycle: stats.shortest,
    longestCycle: stats.longest,
    variability: stats.variability,
    cycleCount: stats.count,
    confidence: predictionConfidence({
      cycleCount: stats.count,
      isIrregular: profile.isIrregular,
      cycleLengths: cycleLengths.map((c) => c.length),
    }),
  };
}

export const LATE_GRACE_HIGH_DAYS = 2;
export const LATE_GRACE_MEDIUM_DAYS = 5;
export const LATE_GRACE_LOW_DAYS = 14;
export const LATE_FALLBACK_DAYS_SINCE_FLOW = 45;

/**
 * Personalized late-period status. Estimates only — never pregnancy.
 * notifyEligible is always false: there is no Cycle late push; in-app alert only.
 */
export function detectLatePeriod({
  today,
  profile,
  logs = [],
  predictions = {},
  inferred = {},
  forecastEligibility,
} = {}) {
  const todayKey = today || todayInTimeZone();
  const empty = {
    status: 'unknown',
    reason: 'insufficient',
    daysPastPredicted: null,
    graceDays: null,
    notifyEligible: false,
  };
  if (profile?.mode === 'PREGNANCY') return { ...empty, reason: 'pregnancy_mode' };
  if (profile?.mode === 'PERIMENOPAUSE') return { ...empty, reason: 'perimenopause_mode' };
  if (profile?.mode === 'POSTPARTUM') return { ...empty, reason: 'postpartum_mode' };
  if (forecastEligibility?.allowed === false) {
    return { ...empty, reason: 'postpartum_return_insufficient' };
  }

  const ranges = inferred?.periodRanges ?? [];
  if (ranges.some((r) => todayKey >= r.start && todayKey <= r.end)) {
    return { ...empty, status: 'on_time', reason: 'in_period' };
  }

  const sorted = [...logs].sort((a, b) => b.date.localeCompare(a.date));
  const lastFlow = sorted.find((l) => isPeriodFlow(l.flow));
  if (!lastFlow) return { ...empty, reason: 'no_flow' };

  const cycleCount = inferred?.cycleCount ?? 0;
  const confidence = predictions?.confidence === 'high' || predictions?.confidence === 'medium'
    ? predictions.confidence
    : 'low';
  const predicted = predictions?.nextPeriodStart || null;
  const irregular = Boolean(profile?.isIrregular);

  if (cycleCount >= 2 && predicted && !irregular && confidence !== 'low') {
    const grace = confidence === 'high' ? LATE_GRACE_HIGH_DAYS : LATE_GRACE_MEDIUM_DAYS;
    const daysPast = daysBetween(predicted, todayKey);
    if (daysPast > grace) {
      return {
        status: 'late',
        reason: 'predicted',
        daysPastPredicted: daysPast,
        graceDays: grace,
        notifyEligible: false,
      };
    }
    return {
      status: 'on_time',
      reason: 'within_grace',
      daysPastPredicted: daysPast,
      graceDays: grace,
      notifyEligible: false,
    };
  }

  if (predicted && (irregular || confidence === 'low') && cycleCount >= 2) {
    const daysPast = daysBetween(predicted, todayKey);
    if (daysPast > LATE_GRACE_LOW_DAYS) {
      return {
        status: 'late',
        reason: 'wide_prediction',
        daysPastPredicted: daysPast,
        graceDays: LATE_GRACE_LOW_DAYS,
        notifyEligible: false,
      };
    }
    return {
      status: 'on_time',
      reason: 'within_wide_grace',
      daysPastPredicted: daysPast,
      graceDays: LATE_GRACE_LOW_DAYS,
      notifyEligible: false,
    };
  }

  const sinceFlow = daysBetween(lastFlow.date, todayKey);
  if (sinceFlow >= LATE_FALLBACK_DAYS_SINCE_FLOW) {
    return {
      status: 'late',
      reason: 'low_history_fallback',
      daysPastPredicted: predicted ? daysBetween(predicted, todayKey) : null,
      graceDays: null,
      notifyEligible: false,
    };
  }
  return empty;
}

export function buildCycleAlerts({ profile, logs, predictions, inferred, today, forecastEligibility }) {
  const alerts = [];
  const todayKey = today || todayInTimeZone();
  const conditions = parseConditions(profile);

  const sorted = [...logs].sort((a, b) => b.date.localeCompare(a.date));
  let heavyRun = 0;
  for (const log of sorted) {
    if (log.flow === 'heavy') heavyRun += 1;
    else break;
  }
  if (heavyRun >= 8) {
    alerts.push({
      level: 'urgent',
      messageKa: '8+ დღეა ძლიერი გამონადენი აღრიცხულია — მიმართეთ გინეკოლოგს.',
      action: 'chat',
    });
  }

  const peri = profile?.mode === 'PERIMENOPAUSE';
  const starts = inferred?.periodStarts ?? [];
  if (!peri && starts.length >= 2) {
    const lastGap = daysBetween(starts[starts.length - 2], starts[starts.length - 1]);
    if (lastGap > 35 || lastGap < 21) {
      alerts.push({
        level: profile.isIrregular ? 'warn' : 'info',
        messageKa: irregularLengthAlertKa(lastGap),
        action: 'chat',
      });
    }
  }

  const late = detectLatePeriod({
    today: todayKey,
    profile,
    logs,
    predictions,
    inferred,
    forecastEligibility,
  });
  if (!peri && late.status === 'late') {
    alerts.push({
      level: 'warn',
      messageKa: latePeriodAlertKa(),
      action: 'chat',
      late,
    });
  }

  if (conditions.includes('pcos')) {
    alerts.push({
      level: 'info',
      messageKa: pcosCautionKa(),
      action: null,
    });
  }

  if (conditions.includes('endometriosis')) {
    alerts.push({
      level: 'info',
      messageKa:
        'ენდომეტრიოზისას ტკივილი და სიმპტომები შეიძლება ციკლის გარეთაც გამოჩნდეს — აღრიცხეთ ყველა დღე.',
      action: null,
    });
  }

  return alerts.slice(0, 4);
}

export function buildCycleWellnessContext({
  profile,
  logs,
  predictions,
  pregnancy,
  user,
  averages,
  today,
  contraception,
  analytics,
  forecastEligibility,
}) {
  if (!isCycleAiContextSupported(profile?.mode)) {
    return {
      prompt: '',
      includedCategories: [],
      excludedCategories: [],
    };
  }
  const prompt = buildCycleAiUserPrompt({
    profile,
    logs,
    predictions,
    pregnancy,
    user,
    averages,
    today,
    contraception,
    analytics,
    forecastEligibility,
  });
  const inspect = inspectCycleAiCategories({ logs });
  return {
    prompt,
    includedCategories: inspect.includedCategories,
    excludedCategories: inspect.excludedCategories,
  };
}

export function buildCycleAiUserPrompt({ profile, logs, predictions, pregnancy, user, averages, today, contraception, analytics, forecastEligibility }) {
  if (!isCycleAiContextSupported(profile?.mode)) return '';
  const phase = detectCyclePhase({
    lastPeriodStart: toDateKey(profile.lastPeriodStart),
    avgCycleLength: averages?.usedCycleLength ?? profile.avgCycleLength,
    avgPeriodLength: averages?.usedPeriodLength ?? profile.avgPeriodLength,
    today: today || todayInTimeZone(),
  });
  const flags = cycleHonestyFlags({
    confidence: predictions?.confidence,
    isIrregular: profile.isIrregular,
    conditions: parseConditions(profile),
  });
  const contra =
    contraception ||
    interpretContraception({
      ...profile,
      contraceptionStartedAt: toDateKey(profile.contraceptionStartedAt),
    });
  const limited = contra.predictionAvailability === 'LIMITED';
  const recent = [...logs]
    .filter((l) => l?.trackingContext !== 'POSTPARTUM')
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 7);
  const lines = recent.map((l) => serializeCycleLogForAi(l).line).filter(Boolean);
  const forecastGated = forecastEligibility?.allowed === false;

  return [
    'USER_LOGGED:',
    `რეჟიმი: ${profileModeForAiPrompt(profile.mode)}`,
    `ასაკი: ${user?.age ?? 'უცნობი'}`,
    lines.length ? 'ბოლო აღრიცხვები:' : 'ბოლო აღრიცხვები: —',
    ...lines,
    '',
    forecastGated ? null : 'ESTIMATED:',
    forecastGated
      ? null
      : limited
        ? `ციკლის დღე: ${phase.day ?? '—'} · კალენდარული ფაზა არ არის ხაზგასასმელი (LIMITED)`
        : `ციკლის დღე: ${phase.day ?? '—'} · სავარაუდო ფაზა: ${phase.phaseKa}`,
    forecastGated
      ? null
      : limited
        ? `სავარაუდო შემდეგი სისხლდენა: ${predictions?.nextPeriodStart ?? '—'}`
        : `სავარაუდო შემდეგი მენსტრუაცია: ${predictions?.nextPeriodStart ?? '—'}`,
    forecastGated
      ? null
      : limited
        ? 'ოვულაცია / ნაყოფიერი ფანჯარა: ნუ ხაზს უსვამ — კონტრაცეფციის კონტექსტში შეიძლება შეცდომაში შემყვანი იყოს.'
        : `სავარაუდო ოვულაცია: ${predictions?.ovulationDate ?? '—'}`,
    forecastGated
      ? null
      : limited
        ? null
        : predictions?.fertileWindow
          ? `სავარაუდო ნაყოფიერი ფანჯარა: ${predictions.fertileWindow.start} – ${predictions.fertileWindow.end}`
          : 'სავარაუდო ნაყოფიერი ფანჯარა: —',
    forecastGated ? null : `სიზუსტე: ${flags.confidence}`,
    `არარეგულარული (მომხმარებლის მითითება): ${profile.isIrregular ? 'კი' : 'არა'}`,
    forecastGated ? null : (averages?.source ? `პროგნოზის წყარო: ${averages.source}` : null),
    forecastGated
      ? null
      : `საშუალო ციკლი (შეფასება): ${averages?.usedCycleLength ?? profile.avgCycleLength} დღე, მენსტრუაცია: ${averages?.usedPeriodLength ?? profile.avgPeriodLength} დღე`,
    pregnancy?.age
      ? `ორსულობის რეჟიმი (მომხმარებლის მითითება): კვირა ${pregnancy.age.week}, დღე ${pregnancy.age.day}, ტრიმესტრი ${pregnancy.age.trimester}`
      : null,
    '',
    'CONDITIONS_SELF_REPORTED:',
    flags.conditions.length ? flags.conditions.join(', ') : '—',
    contra.method ? '' : null,
    contra.method ? 'CONTRACEPTION_SELF_REPORTED:' : null,
    contra.method ? `method: ${contra.method}` : null,
    contra.method ? `startedAt: ${contra.startedAt || 'unknown'}` : null,
    contra.method ? `predictionAvailability: ${contra.predictionAvailability}` : null,
    '',
    ...(() => {
      const historyLines = historicalAnalyticsForAi(analytics);
      if (!historyLines.length) return [];
      return ['HISTORICAL_LOG_PATTERN:', ...historyLines.map((line) => `- ${line}`), ''];
    })(),
    'HONESTY_RULES:',
    ...CYCLE_AI_HONESTY_RULES.map((rule) => `- ${rule}`),
    ...CYCLE_FERTILITY_AI_RULES.map((rule) => `- ${rule}`),
    ...CYCLE_CONTRACEPTION_AI_RULES.map((rule) => `- ${rule}`),
    ...CYCLE_OBSERVATION_AI_RULES.map((rule) => `- ${rule}`),
    ...CYCLE_HISTORY_AI_RULES.map((rule) => `- ${rule}`),
    '',
    'დააბრუნე მხოლოდ JSON რჩევების ბარათებით.',
  ]
    .filter((line) => line != null)
    .join('\n');
}

export function parseCycleInsightsJson(raw) {
  if (!raw || typeof raw !== 'string') return null;
  let text = raw.trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) text = fence[1].trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    const data = JSON.parse(text.slice(start, end + 1));
    if (!data || !Array.isArray(data.cards)) return null;
    const cards = data.cards
      .slice(0, 6)
      .map((card, i) => ({
        id: String(card.id || `tip_${i}`).slice(0, 40),
        tone: ['calm', 'energy', 'care', 'fertile', 'pregnancy', 'mood'].includes(card.tone)
          ? card.tone
          : 'calm',
        title: String(card.title || 'რჩევა').slice(0, 80),
        body: String(card.body || '').slice(0, 400),
        action: card.action ? String(card.action).slice(0, 80) : null,
      }))
      .filter((c) => c.body);
    if (!cards.length) return null;
    return {
      headline: String(data.headline || 'დღის რჩევები').slice(0, 100),
      phaseLabel: data.phaseLabel ? String(data.phaseLabel).slice(0, 60) : null,
      cards,
      source: 'ai',
      generatedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

