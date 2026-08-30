/**
 * Server-owned historical analytics. Structured data only — no Georgian prose.
 * Does not change next-period / ovulation / fertile-window math.
 */

import { parsePainEntries } from './cycleObservations.js';
import {
  BASIC_STATS_MIN_CYCLES,
  PATTERN_CYCLE_HORIZON,
  PMS_DAYS_BEFORE_MAX,
  PMS_DAYS_BEFORE_MIN,
  RECURRING_PATTERN_MIN_CYCLES,
  bleedDaysInCycle,
  locateObservation,
  observationDaysInCycle,
  patternCycles,
  segmentHistoricalCycles,
} from './cycleHistory.js';

const PMS_KEYS = new Set([
  'cramps',
  'headache',
  'bloating',
  'fatigue',
  'back_pain',
  'breast_tenderness',
  'breast_swelling',
  'nausea',
  'insomnia',
  'hot_flashes',
  'pelvic_pain',
  'anxious',
  'irritable',
  'sensitive',
  'sad',
  'mood_swings',
  'cravings',
]);

const PAIN_TYPES = ['cramps', 'pelvic', 'lower_back', 'headache', 'breast', 'ovulation_side', 'other'];
const SYMPTOM_CANDIDATES = [
  'cramps',
  'headache',
  'bloating',
  'fatigue',
  'back_pain',
  'breast_tenderness',
  'nausea',
  'pelvic_pain',
];
const MOOD_CANDIDATES = ['anxious', 'irritable', 'sad', 'sensitive', 'mood_swings', 'tired_mood'];

const COVERAGE_MEDIUM = 0.15;
const COVERAGE_HIGH = 0.35;
const HISTORICAL_CYCLE_SLICE = PATTERN_CYCLE_HORIZON + 4;

function avg(nums) {
  if (!nums.length) return null;
  return Math.round(nums.reduce((s, n) => s + n, 0) / nums.length);
}

function rangeOf(nums) {
  if (!nums.length) return { shortest: null, longest: null, variability: null };
  const shortest = Math.min(...nums);
  const longest = Math.max(...nums);
  return { shortest, longest, variability: longest - shortest };
}

function logKeys(log) {
  const symptoms = Array.isArray(log.symptoms) ? log.symptoms.map(String) : [];
  const moods = Array.isArray(log.moods) ? log.moods.map(String) : [];
  return { symptoms, moods, keys: [...symptoms, ...moods] };
}

function inCycle(date, cycle) {
  if (!date || !cycle) return false;
  if (date < cycle.startDate) return false;
  if (cycle.nextPeriodStart && date >= cycle.nextPeriodStart) return false;
  return true;
}

function hasPmsSignal(log) {
  const { keys } = logKeys(log);
  if (keys.some((k) => PMS_KEYS.has(k))) return true;
  return parsePainEntries(log.painEntries).length > 0;
}

function pmsHitKeys(log) {
  const hits = logKeys(log).keys.filter((k) => PMS_KEYS.has(k));
  for (const pain of parsePainEntries(log.painEntries)) {
    if (pain.type === 'cramps' || pain.type === 'pelvic' || pain.type === 'headache' || pain.type === 'breast') {
      hits.push(pain.type);
    }
  }
  return hits;
}

export function insightDataQuality({ completedCount, coverage }) {
  if (completedCount >= 4 && coverage >= COVERAGE_HIGH) return 'HIGH';
  if (completedCount >= BASIC_STATS_MIN_CYCLES && coverage >= COVERAGE_MEDIUM) return 'MEDIUM';
  return 'LOW';
}

export function loggingCoverage(cycles, logs) {
  const eligible = patternCycles(cycles);
  if (!eligible.length) return 0;
  const denom = eligible.reduce((s, c) => s + (c.cycleLength || 0), 0);
  if (!denom) return 0;
  const numer = eligible.reduce((s, c) => s + observationDaysInCycle(c, logs), 0);
  return Math.round((numer / denom) * 1000) / 1000;
}

export function contraceptionRelation(cycleStart, startedAt) {
  if (!startedAt) return 'unknown';
  return cycleStart < startedAt ? 'before_current_method' : 'on_or_after_current_start';
}

export function buildPmsByDaysBefore(logs, cycles) {
  const eligible = patternCycles(cycles);
  const eligibleStarts = new Set(eligible.map((c) => c.startDate));
  const buckets = {};
  for (let d = PMS_DAYS_BEFORE_MIN; d <= PMS_DAYS_BEFORE_MAX; d += 1) {
    buckets[d] = { count: 0, symptoms: {} };
  }
  for (const log of logs) {
    const loc = locateObservation(log.date, cycles);
    if (loc.kind !== 'complete' || !loc.cycle) continue;
    if (!eligibleStarts.has(loc.cycle.startDate)) continue;
    const before = loc.daysBeforeNextPeriod;
    if (before == null || before < PMS_DAYS_BEFORE_MIN || before > PMS_DAYS_BEFORE_MAX) continue;
    if (!hasPmsSignal(log)) continue;
    buckets[before].count += 1;
    for (const key of pmsHitKeys(log)) {
      buckets[before].symptoms[key] = (buckets[before].symptoms[key] || 0) + 1;
    }
  }
  return Object.entries(buckets)
    .map(([daysBefore, v]) => ({
      daysBefore: Number(daysBefore),
      count: v.count,
      topSymptoms: Object.entries(v.symptoms)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([key, count]) => ({ key, count })),
    }))
    .filter((row) => row.count > 0);
}

function cyclesContaining(eligible, logs, predicate) {
  let hits = 0;
  const befores = [];
  for (const cycle of eligible) {
    const inThis = logs.filter((log) => inCycle(log.date, cycle) && predicate(log));
    if (!inThis.length) continue;
    hits += 1;
    for (const log of inThis) {
      const loc = locateObservation(log.date, [cycle]);
      const before = loc.daysBeforeNextPeriod;
      if (before != null && before >= PMS_DAYS_BEFORE_MIN && before <= PMS_DAYS_BEFORE_MAX) {
        befores.push(before);
      }
    }
  }
  return { hits, befores };
}

function buildRecurring(eligible, logs, items, predicateFor, patternReady) {
  if (!patternReady) return [];
  const out = [];
  for (const item of items) {
    const { hits, befores } = cyclesContaining(eligible, logs, predicateFor(item));
    if (hits < 2) continue;
    out.push({
      key: item,
      cyclesWithObservation: hits,
      eligibleCycles: eligible.length,
      daysBeforeMin: befores.length ? Math.min(...befores) : null,
      daysBeforeMax: befores.length ? Math.max(...befores) : null,
    });
  }
  return out.sort((a, b) => b.cyclesWithObservation - a.cyclesWithObservation).slice(0, 8);
}

function buildFlowPatterns(logs, eligible, periodRanges) {
  const heavyDays = eligible.map(
    (cycle) => logs.filter((log) => inCycle(log.date, cycle) && log.flow === 'heavy').length,
  );
  const spottingDays = logs.filter((log) => log.flow === 'spotting').length;
  const byBleedDay = {};
  for (const range of periodRanges) {
    if (!range?.start || !range.end) continue;
    const cycle = eligible.find((c) => inCycle(range.start, c));
    if (!cycle) continue;
    for (const log of logs) {
      if (log.date < range.start || log.date > range.end) continue;
      if (!['light', 'medium', 'heavy', 'spotting'].includes(log.flow)) continue;
      const loc = locateObservation(log.date, [cycle]);
      const bleedDay = loc.cycleDay;
      if (!bleedDay || bleedDay > 10) continue;
      byBleedDay[bleedDay] = byBleedDay[bleedDay] || {};
      byBleedDay[bleedDay][log.flow] = (byBleedDay[bleedDay][log.flow] || 0) + 1;
    }
  }
  const flowByBleedDay = Object.entries(byBleedDay)
    .map(([bleedDay, counts]) => {
      const mostCommonFlow = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
      return { bleedDay: Number(bleedDay), mostCommonFlow, counts };
    })
    .sort((a, b) => a.bleedDay - b.bleedDay);

  return {
    source: 'observed_flow_only',
    heavyFlowDaysPerCycle: heavyDays.length ? Math.round((avg(heavyDays) ?? 0) * 10) / 10 : null,
    spottingDayCount: spottingDays,
    flowByBleedDay,
  };
}

export function buildHistoricalAnalytics({
  logs = [],
  inferred = {},
  contraceptionStartedAt = null,
} = {}) {
  const cycles = segmentHistoricalCycles(inferred.periodStarts ?? []);
  const completed = cycles.filter((c) => c.complete);
  const eligible = patternCycles(cycles);
  const coverage = loggingCoverage(cycles, logs);
  const quality = insightDataQuality({ completedCount: completed.length, coverage });
  const patternReady =
    eligible.length >= RECURRING_PATTERN_MIN_CYCLES && coverage >= COVERAGE_MEDIUM;

  const lengths = eligible.map((c) => c.cycleLength).filter((n) => n != null);
  const bleedDurations = eligible
    .map((c) => bleedDaysInCycle(c, inferred.periodRanges ?? []))
    .filter((n) => n > 0);

  const startedAt =
    typeof contraceptionStartedAt === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(contraceptionStartedAt)
      ? contraceptionStartedAt
      : null;

  const historicalCycles = cycles.slice(-HISTORICAL_CYCLE_SLICE).map((c) => ({
    startDate: c.startDate,
    nextPeriodStart: c.nextPeriodStart,
    cycleLength: c.cycleLength,
    loggedBleedDays: bleedDaysInCycle(c, inferred.periodRanges ?? []),
    loggedObservationDays: observationDaysInCycle(c, logs),
    complete: c.complete,
    contraceptionRelation: contraceptionRelation(c.startDate, startedAt),
  }));

  const pmsByDaysBefore = buildPmsByDaysBefore(logs, cycles);

  const painPatterns = [];
  if (patternReady) {
    for (const type of PAIN_TYPES) {
      const { hits, befores } = cyclesContaining(eligible, logs, (log) =>
        parsePainEntries(log.painEntries).some((p) => p.type === type),
      );
      if (hits < 2) continue;
      const severeHits = cyclesContaining(eligible, logs, (log) =>
        parsePainEntries(log.painEntries).some((p) => p.type === type && p.severity === 'severe'),
      ).hits;
      painPatterns.push({
        kind: 'pain_before_period',
        painType: type,
        cyclesWithObservation: hits,
        eligibleCycles: eligible.length,
        daysBeforeMin: befores.length ? Math.min(...befores) : null,
        daysBeforeMax: befores.length ? Math.max(...befores) : null,
        severeCycles: severeHits,
      });
    }
  }

  const symptomPatterns = buildRecurring(
    eligible,
    logs,
    SYMPTOM_CANDIDATES,
    (key) => (log) => logKeys(log).symptoms.includes(key),
    patternReady,
  );
  const moodPatterns = buildRecurring(
    eligible,
    logs,
    MOOD_CANDIDATES,
    (key) => (log) => logKeys(log).moods.includes(key),
    patternReady,
  );

  const lifestylePatterns = [];
  const highStress = logs.filter((l) => l.stressLevel === 'high');
  if (highStress.length >= 5) {
    const withHeadache = highStress.filter(
      (l) =>
        logKeys(l).keys.includes('headache') ||
        parsePainEntries(l.painEntries).some((p) => p.type === 'headache'),
    ).length;
    if (withHeadache > 0) {
      lifestylePatterns.push({
        kind: 'co_occurrence',
        left: 'stress_high',
        right: 'headache',
        numerator: withHeadache,
        denominator: highStress.length,
      });
    }
  }

  const opkPositiveCycles = eligible.filter((cycle) =>
    logs.some((log) => log.ovulationTest === 'positive' && inCycle(log.date, cycle)),
  ).length;
  const bbtReadings = logs.filter((l) => l.bbt != null && Number.isFinite(Number(l.bbt))).length;
  const bbtValues = logs
    .map((l) => (l.bbt != null ? Number(l.bbt) : null))
    .filter((n) => n != null && Number.isFinite(n));

  const tagCounts = {};
  for (const log of logs) {
    for (const id of Array.isArray(log.customTagIds) ? log.customTagIds : []) {
      tagCounts[id] = (tagCounts[id] || 0) + 1;
    }
  }

  return {
    insightDataQuality: quality,
    completedCycleCount: completed.length,
    patternCycleCount: eligible.length,
    loggingCoverage: coverage,
    horizonCycles: eligible.length,
    historicalCycles,
    cycleLengths: eligible.map((c) => ({ startDate: c.startDate, length: c.cycleLength })),
    cycleLengthStats: {
      average: avg(lengths),
      ...rangeOf(lengths),
      count: lengths.length,
    },
    bleedDurations: {
      average: avg(bleedDurations),
      ...rangeOf(bleedDurations),
      count: bleedDurations.length,
      label: 'logged_bleeding_duration',
    },
    flowPatterns: buildFlowPatterns(logs, eligible, inferred.periodRanges ?? []),
    pmsByDaysBefore,
    pmsRecurringEligible: patternReady,
    painPatterns,
    symptomPatterns,
    moodPatterns,
    lifestylePatterns,
    fertilityObservations: {
      label: 'user_logged',
      bbtReadingCount: bbtReadings,
      bbtMin: bbtValues.length ? Math.min(...bbtValues) : null,
      bbtMax: bbtValues.length ? Math.max(...bbtValues) : null,
      cyclesWithPositiveOpk: opkPositiveCycles,
      eligibleCycles: eligible.length,
    },
    customTagDayCounts: Object.entries(tagCounts)
      .map(([tagId, dayCount]) => ({ tagId, dayCount }))
      .sort((a, b) => b.dayCount - a.dayCount)
      .slice(0, 12),
    contraceptionContext: {
      startedAt,
      doNotRetroactivelyApply: true,
      applyLimitedHistorically: false,
      cyclesBeforeCurrentMethod: historicalCycles.filter(
        (c) => c.contraceptionRelation === 'before_current_method',
      ).length,
    },
    thresholds: {
      basicStatsMinCycles: BASIC_STATS_MIN_CYCLES,
      recurringPatternMinCycles: RECURRING_PATTERN_MIN_CYCLES,
      pmsWindow: { min: PMS_DAYS_BEFORE_MIN, max: PMS_DAYS_BEFORE_MAX },
      patternHorizon: PATTERN_CYCLE_HORIZON,
      coverageMedium: COVERAGE_MEDIUM,
      coverageHigh: COVERAGE_HIGH,
    },
  };
}

export function historicalAnalyticsForAi(analytics) {
  if (!analytics) return [];
  if (analytics.insightDataQuality === 'LOW' && !analytics.pmsRecurringEligible) return [];
  const lines = [];
  lines.push(
    `completedCycles=${analytics.completedCycleCount}; coverage=${analytics.loggingCoverage}; quality=${analytics.insightDataQuality}`,
  );
  if (analytics.cycleLengthStats?.average != null) {
    lines.push(
      `cycleLength avg=${analytics.cycleLengthStats.average} range=${analytics.cycleLengthStats.shortest}-${analytics.cycleLengthStats.longest} n=${analytics.cycleLengthStats.count}`,
    );
  }
  for (const p of (analytics.painPatterns || []).slice(0, 3)) {
    lines.push(
      `pain ${p.painType} in ${p.cyclesWithObservation}/${p.eligibleCycles} cycles daysBefore=${p.daysBeforeMin ?? '—'}-${p.daysBeforeMax ?? '—'}`,
    );
  }
  for (const p of (analytics.symptomPatterns || []).slice(0, 3)) {
    lines.push(`symptom ${p.key} in ${p.cyclesWithObservation}/${p.eligibleCycles} cycles`);
  }
  return lines;
}
