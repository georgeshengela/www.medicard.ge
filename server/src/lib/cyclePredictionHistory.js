/**
 * Phase 8 — historical prediction snapshots.
 * Observes Cycle engine output. Does not change forecast, mean, confidence, or segmentation.
 */

import { daysBetween } from './cycle.js';

export const CYCLE_PREDICTION_ENGINE_VERSION = 1;
export const SNAPSHOT_TYPE_NEXT_PERIOD_START = 'NEXT_PERIOD_START';
export const AGGREGATE_MIN_COMPLETED = 3;
export const COMPARISON_GAP_MIN = 18;
export const COMPARISON_GAP_MAX = 60;

export const SNAPSHOT_PUBLIC_KEYS = [
  'type',
  'predictedDate',
  'snapshotDate',
  'snapshotAt',
  'cycleAnchorDate',
  'confidence',
  'engineVersion',
  'validGapCount',
  'isIrregular',
  'source',
];

const SENSITIVE_KEYS = [
  'notes',
  'sexualActivity',
  'symptoms',
  'pain',
  'painEntries',
  'mood',
  'moods',
  'customTagIds',
  'libido',
  'bbt',
  'cervicalMucus',
  'observations',
  'energy',
  'pregnancyTest',
  'ovulationTest',
];

function civilKey(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  return value;
}

function historyLog(event) {
  if (process.env.NODE_ENV === 'production') return;
  console.info(`[cycle-prediction-history] ${event}`);
}

export function snapshotIdentity(input) {
  return {
    userId: input.userId,
    type: input.type || SNAPSHOT_TYPE_NEXT_PERIOD_START,
    cycleAnchorDate: input.cycleAnchorDate,
    predictedDate: input.predictedDate,
    confidence: input.confidence,
    engineVersion: input.engineVersion ?? CYCLE_PREDICTION_ENGINE_VERSION,
  };
}

export function shouldObservePrediction({
  mode,
  predictedDate,
  cycleAnchorDate,
  forecastAllowed,
} = {}) {
  if (forecastAllowed === false) return false;
  if (mode === 'PREGNANCY') return false;
  if (mode === 'POSTPARTUM') return false;
  if (!civilKey(predictedDate) || !civilKey(cycleAnchorDate)) return false;
  return true;
}

/**
 * Meaningful change = new identity row.
 * Confidence change creates a revision. validGapCount-only does not.
 */
export function isSameSnapshotIdentity(a, b) {
  if (!a || !b) return false;
  return (
    a.userId === b.userId &&
    a.type === b.type &&
    a.cycleAnchorDate === b.cycleAnchorDate &&
    a.predictedDate === b.predictedDate &&
    a.confidence === b.confidence &&
    a.engineVersion === b.engineVersion
  );
}

export function publicSnapshotFields(row) {
  if (!row) return null;
  const out = {};
  for (const key of SNAPSHOT_PUBLIC_KEYS) {
    if (row[key] !== undefined) out[key] = row[key];
  }
  if (row.snapshotAt instanceof Date) out.snapshotAt = row.snapshotAt.toISOString();
  else if (row.snapshotAt) out.snapshotAt = row.snapshotAt;
  return out;
}

export function snapshotHasSensitiveFields(row) {
  if (!row || typeof row !== 'object') return false;
  return SENSITIVE_KEYS.some((key) => Object.hasOwn(row, key));
}

export async function observeNextPeriodPrediction(prisma, input = {}) {
  const predictedDate = civilKey(input.predictedDate);
  const cycleAnchorDate = civilKey(input.cycleAnchorDate);
  const snapshotDate = civilKey(input.today) || civilKey(input.snapshotDate);
  if (!shouldObservePrediction({
    mode: input.mode,
    predictedDate,
    cycleAnchorDate,
    forecastAllowed: input.forecastAllowed,
  }) || !snapshotDate) {
    return { created: false, reason: 'ineligible' };
  }

  const identity = snapshotIdentity({
    userId: input.userId,
    predictedDate,
    cycleAnchorDate,
    confidence: input.confidence,
    engineVersion: input.engineVersion ?? CYCLE_PREDICTION_ENGINE_VERSION,
  });

  const existing = await prisma.cyclePredictionSnapshot.findFirst({
    where: identity,
  });
  if (existing) {
    historyLog('snapshot_deduplicated');
    return { created: false, reason: 'deduplicated', snapshot: existing };
  }

  const data = {
    ...identity,
    snapshotDate,
    snapshotAt: input.now instanceof Date ? input.now : new Date(),
    validGapCount: Number.isFinite(input.validGapCount) ? input.validGapCount : 0,
    isIrregular: Boolean(input.isIrregular),
    source: input.source || 'stored',
  };

  try {
    const snapshot = await prisma.cyclePredictionSnapshot.create({ data });
    historyLog('snapshot_created');
    return { created: true, reason: 'created', snapshot };
  } catch (err) {
    if (err?.code === 'P2002') {
      historyLog('snapshot_deduplicated');
      const raced = await prisma.cyclePredictionSnapshot.findFirst({ where: identity });
      return { created: false, reason: 'deduplicated', snapshot: raced };
    }
    throw err;
  }
}

export function errorDays(predictedDate, actualStart) {
  if (!civilKey(predictedDate) || !civilKey(actualStart)) return null;
  return daysBetween(predictedDate, actualStart);
}

export function absErrorDays(predictedDate, actualStart) {
  const signed = errorDays(predictedDate, actualStart);
  return signed == null ? null : Math.abs(signed);
}

export function medianAbsError(values) {
  const nums = (values || []).filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  if (!nums.length) return null;
  const mid = Math.floor(nums.length / 2);
  if (nums.length % 2) return nums[mid];
  return Math.round((nums[mid - 1] + nums[mid]) / 2);
}

function isPrePeriodSnapshot(snapshot, actualStart, loggedAtByDate) {
  if (!actualStart) return true;
  if (snapshot.snapshotDate < actualStart) return true;
  if (snapshot.snapshotDate > actualStart) return false;
  const loggedAt = loggedAtByDate?.[actualStart];
  const snapAt = snapshot.snapshotAt instanceof Date
    ? snapshot.snapshotAt
    : snapshot.snapshotAt
      ? new Date(snapshot.snapshotAt)
      : null;
  if (loggedAt && snapAt && !Number.isNaN(snapAt.getTime())) {
    return snapAt.getTime() < new Date(loggedAt).getTime();
  }
  return false;
}

function nextActualStart(periodStarts, cycleAnchorDate) {
  return (periodStarts || [])
    .filter((d) => d && d > cycleAnchorDate)
    .sort((a, b) => a.localeCompare(b))[0] ?? null;
}

export function evaluateEpisode(snapshots, {
  periodStarts = [],
  loggedAtByDate = {},
} = {}) {
  const rows = [...(snapshots || [])].sort((a, b) => {
    const ta = new Date(a.snapshotAt || 0).getTime();
    const tb = new Date(b.snapshotAt || 0).getTime();
    if (ta !== tb) return ta - tb;
    return String(a.snapshotDate).localeCompare(String(b.snapshotDate));
  });
  if (!rows.length) return null;

  const cycleAnchorDate = rows[0].cycleAnchorDate;
  const actualStart = nextActualStart(periodStarts, cycleAnchorDate);
  const pre = actualStart
    ? rows.filter((row) => isPrePeriodSnapshot(row, actualStart, loggedAtByDate))
    : rows;

  if (!actualStart) {
    return {
      cycleAnchorDate,
      actualStart: null,
      firstPredictedStart: rows[0].predictedDate,
      lastPredictedStart: rows[rows.length - 1].predictedDate,
      firstErrorDays: null,
      lastErrorDays: null,
      firstAbsErrorDays: null,
      lastAbsErrorDays: null,
      snapshotCount: rows.length,
      prePeriodSnapshotCount: rows.length,
      confidenceAtFirst: rows[0].confidence,
      confidenceAtLast: rows[rows.length - 1].confidence,
      status: 'open',
      exclusionReason: null,
    };
  }

  const gap = daysBetween(cycleAnchorDate, actualStart);
  if (gap < COMPARISON_GAP_MIN || gap > COMPARISON_GAP_MAX) {
    historyLog('comparison_excluded');
    return {
      cycleAnchorDate,
      actualStart,
      firstPredictedStart: null,
      lastPredictedStart: null,
      firstErrorDays: null,
      lastErrorDays: null,
      firstAbsErrorDays: null,
      lastAbsErrorDays: null,
      snapshotCount: rows.length,
      prePeriodSnapshotCount: pre.length,
      confidenceAtFirst: null,
      confidenceAtLast: null,
      status: 'excluded',
      exclusionReason: 'INVALID_CYCLE_GAP',
    };
  }

  if (!pre.length) {
    return {
      cycleAnchorDate,
      actualStart,
      firstPredictedStart: null,
      lastPredictedStart: null,
      firstErrorDays: null,
      lastErrorDays: null,
      firstAbsErrorDays: null,
      lastAbsErrorDays: null,
      snapshotCount: rows.length,
      prePeriodSnapshotCount: 0,
      confidenceAtFirst: null,
      confidenceAtLast: null,
      status: 'excluded',
      exclusionReason: 'NO_PRE_PERIOD_SNAPSHOT',
    };
  }

  const first = pre[0];
  const last = pre[pre.length - 1];
  const firstErr = errorDays(first.predictedDate, actualStart);
  const lastErr = errorDays(last.predictedDate, actualStart);
  historyLog('outcome_matched');
  return {
    cycleAnchorDate,
    actualStart,
    firstPredictedStart: first.predictedDate,
    lastPredictedStart: last.predictedDate,
    firstErrorDays: firstErr,
    lastErrorDays: lastErr,
    firstAbsErrorDays: Math.abs(firstErr),
    lastAbsErrorDays: Math.abs(lastErr),
    snapshotCount: rows.length,
    prePeriodSnapshotCount: pre.length,
    confidenceAtFirst: first.confidence,
    confidenceAtLast: last.confidence,
    status: 'completed',
    exclusionReason: null,
  };
}

export function buildPredictionHistory(snapshots = [], {
  periodStarts = [],
  loggedAtByDate = {},
} = {}) {
  const groups = new Map();
  for (const row of snapshots) {
    if (row.type && row.type !== SNAPSHOT_TYPE_NEXT_PERIOD_START) continue;
    const key = row.cycleAnchorDate;
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }

  const episodes = [...groups.keys()]
    .sort((a, b) => a.localeCompare(b))
    .map((key) => evaluateEpisode(groups.get(key), { periodStarts, loggedAtByDate }))
    .filter(Boolean);

  const completed = episodes.filter((e) => e.status === 'completed');
  const open = episodes.filter((e) => e.status === 'open');
  const excluded = episodes.filter((e) => e.status === 'excluded');
  const aggregateEligible = completed.length >= AGGREGATE_MIN_COMPLETED;
  const typicalAbsErrorDays = aggregateEligible
    ? medianAbsError(completed.map((e) => e.lastAbsErrorDays))
    : null;

  return {
    engineVersion: CYCLE_PREDICTION_ENGINE_VERSION,
    snapshotCount: snapshots.length,
    completedCount: completed.length,
    openCount: open.length,
    excludedCount: excluded.length,
    aggregateEligible,
    aggregate: aggregateEligible
      ? {
          completedCount: completed.length,
          typicalAbsErrorDays,
          basis: 'median_absolute_error',
        }
      : null,
    episodes,
    emptyReason: snapshots.length ? null : 'NO_SNAPSHOTS',
  };
}

export function exportPredictionSnapshots(rows = []) {
  return (rows || []).map((row) => ({
    type: row.type,
    predictedDate: row.predictedDate,
    snapshotDate: row.snapshotDate,
    cycleAnchorDate: row.cycleAnchorDate,
    confidence: row.confidence,
    engineVersion: row.engineVersion,
  }));
}
