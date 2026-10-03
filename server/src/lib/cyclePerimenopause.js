/**
 * Perimenopause tracking mode — presentation read model.
 * Does not change forecast arithmetic. Does not diagnose perimenopause or menopause.
 * Civil dates only. Reuse cycle.js daysBetween / addDays / isPeriodFlow.
 */

import { addDays, daysBetween, isPeriodFlow } from './cycle.js';
import { hideFertilityFromPredictions } from './cycleContraception.js';
import { capabilitiesForProfileMode } from './cycleModes.js';
import { OBSERVATION_CATEGORIES, OBSERVATION_REGISTRY } from './cycleObservationRegistry.js';
import { buildPerimenopauseObservationSummaries } from './cyclePerimenopauseObservationTrends.js';

export const PERIMENOPAUSE_INTERVAL_WINDOW = 6;
export const PERIMENOPAUSE_INTERVAL_HORIZON_DAYS = 365;
export const PERIMENOPAUSE_EPISODE_LIMIT = 6;
export const PERIMENOPAUSE_RECENT_OBS_DAYS = 14;
export const PERIMENOPAUSE_VARIABILITY_MIN_FOR_RANGE = 2;
export const PERIMENOPAUSE_SOURCE_WINDOW = 'last_6_completed_intervals';

/*
 * Range forecast (brief §9 „მერე“ item 7; Flo shows a range instead of a date in perimenopause).
 * Never one next-period date in this mode: the next period is a window measured from her own last
 * (up to 6, not hidden, unclamped) cycle lengths — 10th…90th percentile, widened by 3 days each side,
 * never narrower than 7 days, never wider than 60. Fewer than 2 cycles → no forecast at all.
 */
/** Cycles needed before any window is shown. */
export const PERI_RANGE_MIN_CYCLES = 2;
/** Percentiles of her recent cycle lengths that bound the window. */
export const PERI_RANGE_LOW_PERCENTILE = 0.1;
export const PERI_RANGE_HIGH_PERCENTILE = 0.9;
/** Days added on each side of the percentile window („widen rather than guess“). */
export const PERI_RANGE_WIDEN_DAYS = 3;
/** The window (inclusive days) is never narrower than this … */
export const PERI_RANGE_MIN_WIDTH_DAYS = 7;
/** … and never wider than this (a wider one says nothing). */
export const PERI_RANGE_MAX_WIDTH_DAYS = 60;
/** The window never opens earlier than this many days after the last period started. */
export const PERI_RANGE_MIN_START_DAYS = 10;
/** More days than this since the last bleeding (and no window open now): „დიდი ხანია …“. */
export const PERI_LONG_GAP_DAYS = 60;
/** This many days without any bleeding: a calm note that a doctor can confirm menopause. */
export const PERI_NO_BLEEDING_NOTE_DAYS = 365;

/** Presentation states of the perimenopause forecast (codes only — the app and the portal word them). */
export const PERI_FORECAST_STATUS = Object.freeze({
  /** < 2 cycles: no date and no window — „სანამ რამდენიმე ციკლს არ დავითვლით, თარიღს არ ვამბობთ“. */
  LEARNING: 'learning',
  /** A window (ahead, open, or already passed — the app tells them apart with `cyclePeriodWindow`). */
  RANGE: 'range',
  /** > 60 days since the last bleeding and no window open now: calm, „ესაუბრე ექიმს, თუ გაწუხებს“. */
  LONG_GAP: 'long_gap',
  /** ≥ 12 months without bleeding: a doctor can confirm menopause (never a diagnosis here). */
  NO_BLEEDING_12M: 'no_bleeding_12m',
});

const OVERVIEW_BODY_KEYS = Object.freeze([
  'hot_flashes',
  'night_sweats',
  'fatigue',
  'headache',
  'migraine',
  'insomnia',
  'dry_skin',
  'hair_loss',
  'breast_tenderness',
]);

const OVERVIEW_DENY = new Set(
  Object.values(OBSERVATION_REGISTRY)
    .filter(
      (item) =>
        item.category === OBSERVATION_CATEGORIES.SEXUAL_HEALTH ||
        item.key === 'palpitations' ||
        item.key === 'vaginal_dryness',
    )
    .map((item) => item.key),
);

export function isPerimenopauseProfileMode(mode) {
  return mode === 'PERIMENOPAUSE';
}

function isRecordedBleedingFlow(flow) {
  return flow === 'spotting' || isPeriodFlow(flow);
}

/**
 * Last 6 completed intervals from consecutive period starts.
 * Does not use the engine's 18–45 day clamp. Gaps <1 or >365 are skipped
 * as logging holes, not as cycle lengths.
 */
export function completedCycleIntervals(
  periodStarts = [],
  { today, window = PERIMENOPAUSE_INTERVAL_WINDOW, hiddenStarts = [] } = {},
) {
  const starts = [...periodStarts].filter(Boolean).sort();
  // Cycles she hid from averages („საშუალოდან დამალვა“) are not intervals for the variability range.
  const hidden = new Set(Array.isArray(hiddenStarts) ? hiddenStarts : []);
  if (starts.length < 2 || !today) return [];
  const horizon = addDays(today, -PERIMENOPAUSE_INTERVAL_HORIZON_DAYS);
  const rows = [];
  for (let i = starts.length - 1; i >= 1 && rows.length < window; i -= 1) {
    const from = starts[i - 1];
    const to = starts[i];
    if (to < horizon) break;
    if (hidden.has(from)) continue;
    const days = daysBetween(from, to);
    if (!Number.isFinite(days) || days < 1 || days > PERIMENOPAUSE_INTERVAL_HORIZON_DAYS) continue;
    rows.unshift({ from, to, days });
  }
  return rows;
}

export function buildVariabilitySummary(intervals = []) {
  const count = intervals.length;
  if (count < PERIMENOPAUSE_VARIABILITY_MIN_FOR_RANGE) {
    return {
      intervalCount: count,
      shortestDays: null,
      longestDays: null,
      recentIntervalDays: count === 1 ? intervals[0].days : null,
      sourceWindow: PERIMENOPAUSE_SOURCE_WINDOW,
    };
  }
  const lengths = intervals.map((row) => row.days);
  return {
    intervalCount: count,
    shortestDays: Math.min(...lengths),
    longestDays: Math.max(...lengths),
    recentIntervalDays: intervals[count - 1].days,
    sourceWindow: PERIMENOPAUSE_SOURCE_WINDOW,
  };
}

function flowFactsForRange(logs, start, end) {
  const facts = [];
  const seen = new Set();
  for (const log of logs || []) {
    if (!log?.date || log.date < start || log.date > end) continue;
    if (!isRecordedBleedingFlow(log.flow)) continue;
    if (seen.has(log.flow)) continue;
    seen.add(log.flow);
    facts.push(log.flow);
  }
  return facts;
}

export function presentBleedingEpisodes(periodRanges = [], logs = [], { limit = PERIMENOPAUSE_EPISODE_LIMIT } = {}) {
  const ranges = [...periodRanges].sort((a, b) => String(a.start).localeCompare(String(b.start)));
  const sliced = ranges.slice(-limit);
  return sliced.map((range, index) => {
    const prev = index > 0 ? sliced[index - 1] : ranges[ranges.indexOf(range) - 1] || null;
    const intervalDays =
      prev?.start && range.start ? daysBetween(prev.start, range.start) : null;
    return {
      start: range.start,
      end: range.end,
      durationDays: range.lengthDays ?? null,
      intervalDays: Number.isFinite(intervalDays) && intervalDays > 0 ? intervalDays : null,
      flowFacts: flowFactsForRange(logs, range.start, range.end),
    };
  });
}

function presentRecentObservations(logs = [], today) {
  const from = addDays(today, -(PERIMENOPAUSE_RECENT_OBS_DAYS - 1));
  const rows = [];
  const sorted = [...logs].sort((a, b) => String(b.date).localeCompare(String(a.date)));
  for (const log of sorted) {
    if (!log?.date || log.date < from || log.date > today) continue;
    const symptoms = (log.symptoms || []).filter(
      (key) => OVERVIEW_BODY_KEYS.includes(key) && !OVERVIEW_DENY.has(key),
    );
    const moods = [...(log.moods || [])];
    const energy = log.energy ?? log.observations?.energy ?? null;
    const sleepQuality = log.sleepQuality || null;
    const pain = (log.painEntries || []).map((entry) => ({
      type: entry.type,
      severity: entry.severity,
    }));
    if (!symptoms.length && !moods.length && !energy && !sleepQuality && !pain.length) continue;
    rows.push({
      date: log.date,
      symptoms,
      moods,
      energy,
      sleepQuality,
      pain,
    });
    if (rows.length >= 8) break;
  }
  return rows;
}

function lastRecordedBleeding(logs = []) {
  const sorted = [...logs].sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const hit = sorted.find((log) => isRecordedBleedingFlow(log.flow));
  return hit
    ? { date: hit.date, flow: hit.flow }
    : null;
}

/** Linear-interpolated percentile of an ascending list (p in 0…1). */
export function percentileOf(sorted, p) {
  if (!sorted.length) return null;
  if (sorted.length === 1) return sorted[0];
  const at = (sorted.length - 1) * Math.min(1, Math.max(0, p));
  const lo = Math.floor(at);
  const hi = Math.ceil(at);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (at - lo);
}

/**
 * The window in cycle days (days after the last period start) from recent cycle lengths, or null with
 * fewer than 2. `{ minDays, maxDays, medianDays, basedOn }` — min/max inclusive.
 */
export function perimenopauseRangeDays(lengths = []) {
  const nums = (Array.isArray(lengths) ? lengths : [])
    .map(Number)
    .filter((n) => Number.isFinite(n) && n > 0)
    .slice(-PERIMENOPAUSE_INTERVAL_WINDOW);
  if (nums.length < PERI_RANGE_MIN_CYCLES) return null;
  const sorted = [...nums].sort((a, b) => a - b);
  const median = Math.round(percentileOf(sorted, 0.5));
  let minDays = Math.floor(percentileOf(sorted, PERI_RANGE_LOW_PERCENTILE)) - PERI_RANGE_WIDEN_DAYS;
  let maxDays = Math.ceil(percentileOf(sorted, PERI_RANGE_HIGH_PERCENTILE)) + PERI_RANGE_WIDEN_DAYS;
  // Never narrower than a week: grow both sides around the middle.
  const minSpan = PERI_RANGE_MIN_WIDTH_DAYS - 1;
  if (maxDays - minDays < minSpan) {
    const missing = minSpan - (maxDays - minDays);
    minDays -= Math.floor(missing / 2);
    maxDays += Math.ceil(missing / 2);
  }
  // Never wider than 60 days: keep the part around her median.
  const maxSpan = PERI_RANGE_MAX_WIDTH_DAYS - 1;
  if (maxDays - minDays > maxSpan) {
    let from = Math.max(minDays, median - Math.floor(maxSpan / 2));
    let to = from + maxSpan;
    if (to > maxDays) {
      to = maxDays;
      from = to - maxSpan;
    }
    minDays = from;
    maxDays = to;
  }
  // A window cannot open in the first days after a period started.
  if (minDays < PERI_RANGE_MIN_START_DAYS) {
    maxDays = Math.min(maxDays + (PERI_RANGE_MIN_START_DAYS - minDays), PERI_RANGE_MIN_START_DAYS + maxSpan);
    minDays = PERI_RANGE_MIN_START_DAYS;
  }
  return {
    minDays,
    maxDays,
    medianDays: Math.min(maxDays, Math.max(minDays, median)),
    basedOn: nums.length,
  };
}

function lastBleedingDate(logs = []) {
  let last = null;
  for (const log of logs || []) {
    if (!log?.date || !isRecordedBleedingFlow(log.flow)) continue;
    if (!last || log.date > last) last = log.date;
  }
  return last;
}

/**
 * The whole perimenopause forecast for one day. `intervals` = `completedCycleIntervals(...)` (hidden
 * cycles already left out). Returns
 * `{ status, range: { from, to, estimate, minDays, maxDays, basedOn } | null, daysSinceBleeding, lastBleeding }`.
 * `estimate` (her median) only keeps older readers of `nextPeriodStart` working — it is never shown alone.
 */
export function perimenopauseForecast({ intervals = [], lastPeriodStart = null, logs = [], today } = {}) {
  const days = perimenopauseRangeDays((intervals || []).map((row) => row?.days));
  const range = days && lastPeriodStart
    ? {
        from: addDays(lastPeriodStart, days.minDays),
        to: addDays(lastPeriodStart, days.maxDays),
        estimate: addDays(lastPeriodStart, days.medianDays),
        minDays: days.minDays,
        maxDays: days.maxDays,
        basedOn: days.basedOn,
      }
    : null;
  const logged = lastBleedingDate(logs);
  const lastBleeding = logged && (!lastPeriodStart || logged >= lastPeriodStart) ? logged : lastPeriodStart || logged || null;
  const daysSinceBleeding = lastBleeding && today ? Math.max(0, daysBetween(lastBleeding, today)) : null;
  let status = range ? PERI_FORECAST_STATUS.RANGE : PERI_FORECAST_STATUS.LEARNING;
  if (daysSinceBleeding != null && daysSinceBleeding >= PERI_NO_BLEEDING_NOTE_DAYS) {
    status = PERI_FORECAST_STATUS.NO_BLEEDING_12M;
  } else if (daysSinceBleeding != null && daysSinceBleeding > PERI_LONG_GAP_DAYS && !(range && today <= range.to)) {
    status = PERI_FORECAST_STATUS.LONG_GAP;
  }
  return { status, range, daysSinceBleeding, lastBleeding };
}

/**
 * The bundle's `predictions` in PERIMENOPAUSE mode: no fertile window / ovulation anywhere, no late
 * state, `confidence` always 'low', and the next period only as `nextPeriodRange` (null with < 2 cycles).
 * Future calendar days keep nothing but the window (from today on); the current period's projected days
 * and every logged day stay. Input is not mutated.
 */
export function applyPerimenopauseForecast(
  predictions,
  forecast,
  { lastPeriodStart = null, avgPeriodLength = 5, avgCycleLength = 28, today = null, lang = 'ka' } = {},
) {
  if (!predictions) return predictions;
  const base = hideFertilityFromPredictions(predictions, { avgCycleLength, lang });
  const range = forecast?.range || null;
  const periodDays = Math.max(1, Math.round(Number(avgPeriodLength) || 5));
  const currentPeriodEnd = lastPeriodStart ? addDays(lastPeriodStart, periodDays - 1) : null;
  const calendar = {};
  for (const [key, mark] of Object.entries(base.calendar || {})) {
    if (!mark || typeof mark !== 'object') continue;
    const logged = mark.predicted === false || mark.logged === true;
    const inCurrentPeriod = Boolean(currentPeriodEnd && key >= lastPeriodStart && key <= currentPeriodEnd);
    if (logged || (inCurrentPeriod && mark.period)) {
      calendar[key] = mark;
      continue;
    }
    // The future has no phases and no projected cycles in this mode — only the window, painted below.
    if (today && key > today) continue;
    // A past projected period day of a later cycle: keep the history stamps, drop the projection.
    const { period, predicted, periodRange, ...rest } = mark;
    if (Object.keys(rest).length) calendar[key] = { ...rest, estimated: false };
  }
  if (range) {
    const start = today && range.from < today ? today : range.from;
    for (let key = start; key <= range.to; key = addDays(key, 1)) {
      const prev = calendar[key] || {};
      if (prev.predicted === false || prev.logged) continue;
      calendar[key] = { ...prev, period: true, predicted: true, estimated: true, periodRange: true };
    }
  }
  const estimate = range ? range.estimate : null;
  const phases = range && lastPeriodStart
    ? [{
        periodStart: lastPeriodStart,
        periodEnd: currentPeriodEnd,
        ovulation: null,
        ovulationStart: null,
        ovulationEnd: null,
        ovulationSource: null,
        fertileStart: null,
        fertileEnd: null,
        fertileWindowKind: null,
        nextPeriodStart: estimate,
      }]
    : [];
  return {
    ...base,
    nextPeriodStart: estimate,
    nextPeriodEnd: estimate ? addDays(estimate, periodDays - 1) : null,
    nextPeriodRange: range ? { from: range.from, to: range.to } : null,
    ovulationDate: null,
    ovulationRange: null,
    fertileWindow: null,
    phases,
    calendar,
    confidence: 'low',
    late: false,
  };
}

/**
 * `perimenopause.forecast` — never a precise single date (`showPreciseNextPeriod` stays false, so older
 * builds show their „low confidence“ line). `status` / `range` / `daysSinceBleeding` are new (optional).
 */
export function presentPerimenopauseForecast(predictions = {}, forecast = null) {
  return {
    showPreciseNextPeriod: false,
    nextPeriodStart: null,
    nextPeriodEnd: null,
    confidence: 'low',
    status: forecast?.status ?? PERI_FORECAST_STATUS.LEARNING,
    range: forecast?.range
      ? {
          from: forecast.range.from,
          to: forecast.range.to,
          minDays: forecast.range.minDays,
          maxDays: forecast.range.maxDays,
          basedOn: forecast.range.basedOn,
        }
      : null,
    daysSinceBleeding: forecast?.daysSinceBleeding ?? null,
  };
}

/**
 * Owner bundle attachment. null unless profile mode is PERIMENOPAUSE.
 * Numbers only — no irregularity labels, no diagnosis, no directional claims.
 */
export function buildPerimenopauseContext({
  mode,
  inferred = {},
  logs = [],
  predictions = {},
  today,
  /** The resolved last period start (defaults to the inferred one). */
  lastPeriodStart = null,
  /** `perimenopauseForecast(...)` when the caller already built it from the same inputs. */
  forecast = null,
} = {}) {
  if (!isPerimenopauseProfileMode(mode) || !today) return null;
  const intervals = completedCycleIntervals(inferred.periodStarts || [], { today, hiddenStarts: inferred.hiddenStarts || [] });
  const periForecast =
    forecast ||
    perimenopauseForecast({
      intervals,
      lastPeriodStart: lastPeriodStart || inferred.lastPeriodStart || null,
      logs,
      today,
    });
  const recentBleedingEpisodes = presentBleedingEpisodes(inferred.periodRanges || [], logs);
  return {
    mode: 'PERIMENOPAUSE',
    capabilities: capabilitiesForProfileMode(mode),
    recentBleedingEpisodes,
    recentCycleIntervals: intervals,
    variabilitySummary: buildVariabilitySummary(intervals),
    lastRecordedBleeding: lastRecordedBleeding(logs),
    recentObservations: presentRecentObservations(logs, today),
    forecast: presentPerimenopauseForecast(predictions, periForecast),
    observationSummaries: buildPerimenopauseObservationSummaries({ logs, today, mode }),
  };
}

export function perimenopauseContextHasSensitiveLeak(payload) {
  if (!payload) return false;
  const text = JSON.stringify(payload);
  if (text.includes('vaginal_dryness')) return true;
  if (text.includes('palpitations')) return true;
  if (/\b(skipped|missed period|menopause confirmed|hormonal decline)\b/i.test(text)) return true;
  return false;
}
