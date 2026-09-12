/**
 * Perimenopause tracking mode — presentation read model.
 * Does not change forecast arithmetic. Does not diagnose perimenopause or menopause.
 * Civil dates only. Reuse cycle.js daysBetween / addDays / isPeriodFlow.
 */

import { addDays, daysBetween, isPeriodFlow } from './cycle.js';
import { capabilitiesForProfileMode } from './cycleModes.js';
import { OBSERVATION_CATEGORIES, OBSERVATION_REGISTRY } from './cycleObservationRegistry.js';
import { buildPerimenopauseObservationSummaries } from './cyclePerimenopauseObservationTrends.js';

export const PERIMENOPAUSE_INTERVAL_WINDOW = 6;
export const PERIMENOPAUSE_INTERVAL_HORIZON_DAYS = 365;
export const PERIMENOPAUSE_EPISODE_LIMIT = 6;
export const PERIMENOPAUSE_RECENT_OBS_DAYS = 14;
export const PERIMENOPAUSE_VARIABILITY_MIN_FOR_RANGE = 2;
export const PERIMENOPAUSE_SOURCE_WINDOW = 'last_6_completed_intervals';

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
export function completedCycleIntervals(periodStarts = [], { today, window = PERIMENOPAUSE_INTERVAL_WINDOW } = {}) {
  const starts = [...periodStarts].filter(Boolean).sort();
  if (starts.length < 2 || !today) return [];
  const horizon = addDays(today, -PERIMENOPAUSE_INTERVAL_HORIZON_DAYS);
  const rows = [];
  for (let i = starts.length - 1; i >= 1 && rows.length < window; i -= 1) {
    const from = starts[i - 1];
    const to = starts[i];
    if (to < horizon) break;
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

export function presentPerimenopauseForecast(predictions = {}) {
  const confidence =
    predictions.confidence === 'high' || predictions.confidence === 'medium'
      ? predictions.confidence
      : 'low';
  const showPreciseNextPeriod = confidence !== 'low' && Boolean(predictions.nextPeriodStart);
  return {
    showPreciseNextPeriod,
    nextPeriodStart: showPreciseNextPeriod ? predictions.nextPeriodStart || null : null,
    nextPeriodEnd: showPreciseNextPeriod ? predictions.nextPeriodEnd || null : null,
    confidence,
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
} = {}) {
  if (!isPerimenopauseProfileMode(mode) || !today) return null;
  const intervals = completedCycleIntervals(inferred.periodStarts || [], { today });
  const recentBleedingEpisodes = presentBleedingEpisodes(inferred.periodRanges || [], logs);
  return {
    mode: 'PERIMENOPAUSE',
    capabilities: capabilitiesForProfileMode(mode),
    recentBleedingEpisodes,
    recentCycleIntervals: intervals,
    variabilitySummary: buildVariabilitySummary(intervals),
    lastRecordedBleeding: lastRecordedBleeding(logs),
    recentObservations: presentRecentObservations(logs, today),
    forecast: presentPerimenopauseForecast(predictions),
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
