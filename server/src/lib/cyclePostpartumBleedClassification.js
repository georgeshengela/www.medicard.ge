/**
 * Phase 41 — owner-classified postpartum bleed episodes.
 *
 * Default postpartum bleeding remains UNKNOWN-type bleeding.
 * Only an explicit OWNER action creates MENSTRUAL_PERIOD semantics.
 *
 * Does not change PERIOD_FLOWS, forecast arithmetic, or Phase 38
 * engineLogWhere exclusion of unclassified postpartum logs.
 */

import {
  daysBetween,
  inferCycleStats,
  isPeriodFlow,
  toDateKey,
} from './cycle.js';
import { engineHistoryCutoff } from './cycleHistoryQuery.js';
import {
  isEngineEligibleLog,
  isPostpartumTrackingContext,
  POSTPARTUM_TRACKING_CONTEXT,
} from './cyclePostpartum.js';

export const MENSTRUAL_PERIOD_CLASSIFICATION = 'MENSTRUAL_PERIOD';
export const CLASSIFICATION_SOURCE_OWNER = 'OWNER';
export const CYCLE_POSTPARTUM_BLEED_CLASSIFICATION_PATH = '/postpartum/bleed-classifications';

function httpError(message, status, code) {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  return err;
}

function rangesOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart <= bEnd && bStart <= aEnd;
}

/**
 * Group postpartum-stamped PERIOD_FLOW days into bleed runs using the
 * frozen engine episode rule (inferCycleStats / canContinuePeriod).
 * Spotting-only days are not a classifiable episode.
 */
export function groupPostpartumBleedRuns(logs, { postpartumEpisodeId } = {}) {
  const byEpisode = new Map();
  for (const log of logs || []) {
    if (!isPostpartumTrackingContext(log?.trackingContext)) continue;
    const eid = log.postpartumEpisodeId || null;
    if (postpartumEpisodeId && eid !== postpartumEpisodeId) continue;
    if (!byEpisode.has(eid)) byEpisode.set(eid, []);
    byEpisode.get(eid).push(log);
  }
  const runs = [];
  for (const [episodeId, episodeLogs] of byEpisode) {
    const inferred = inferCycleStats(episodeLogs);
    for (const range of inferred.periodRanges || []) {
      if (!range?.start || !range?.end) continue;
      runs.push({
        postpartumEpisodeId: episodeId,
        start: range.start,
        end: range.end,
        lengthDays: range.lengthDays ?? daysBetween(range.start, range.end) + 1,
      });
    }
  }
  return runs.sort((a, b) => a.start.localeCompare(b.start));
}

export function findBleedRunForDate(runs, date, postpartumEpisodeId) {
  return (runs || []).find((run) => {
    if (postpartumEpisodeId && run.postpartumEpisodeId !== postpartumEpisodeId) return false;
    return date >= run.start && date <= run.end;
  }) || null;
}

/** PERIOD_FLOW dates inside classified runs. Interior spotting is not admitted. */
export function classifiedPeriodFlowDates(logs, classifiedRuns) {
  const dates = new Set();
  const runs = classifiedRuns || [];
  for (const log of logs || []) {
    if (!isPostpartumTrackingContext(log?.trackingContext)) continue;
    if (!isPeriodFlow(log.flow)) continue;
    const date = toDateKey(log.date);
    if (!date) continue;
    const hit = runs.find((run) => {
      const start = run.start || run.bleedStart;
      const end = run.end || run.bleedEnd;
      if (!start || !end) return false;
      return (
        date >= start
        && date <= end
        && (run.postpartumEpisodeId == null || log.postpartumEpisodeId === run.postpartumEpisodeId)
      );
    });
    if (hit) dates.add(date);
  }
  return dates;
}

/**
 * Deterministic reconciliation.
 *
 * KEEP if:
 *   - current run.start === stored bleedStart (same episode identity; end may shrink or grow)
 *   - OR exactly one overlapping current run that is a subset of the stored range
 *     (start day removed / suffix remains)
 *
 * DROP (fail-safe, no duplicate, no proximity jump) if:
 *   - no overlapping run (orphan / all bleed deleted)
 *   - two or more overlapping runs (split)
 *   - one overlapping run that extends outside the stored range (ambiguous merge)
 *   - a nearby non-overlapping run (no date-proximity guess)
 */
export function planClassificationReconciliation({ classifications = [], runs = [] } = {}) {
  const keep = [];
  const drop = [];
  const updates = [];

  for (const row of classifications || []) {
    if (row.classification && row.classification !== MENSTRUAL_PERIOD_CLASSIFICATION) {
      drop.push({ id: row.id, reason: 'unsupported' });
      continue;
    }
    const sameEpisode = (runs || []).filter(
      (run) => run.postpartumEpisodeId === row.postpartumEpisodeId,
    );
    const exact = sameEpisode.find((run) => run.start === row.bleedStart);
    if (exact) {
      const next = {
        ...row,
        bleedStart: exact.start,
        bleedEnd: exact.end,
      };
      keep.push(next);
      if (exact.end !== row.bleedEnd) {
        updates.push({ id: row.id, bleedStart: exact.start, bleedEnd: exact.end });
      }
      continue;
    }

    const overlapping = sameEpisode.filter((run) =>
      rangesOverlap(row.bleedStart, row.bleedEnd, run.start, run.end),
    );
    if (overlapping.length === 0) {
      drop.push({ id: row.id, reason: 'orphan' });
      continue;
    }
    if (overlapping.length > 1) {
      drop.push({ id: row.id, reason: 'split' });
      continue;
    }
    const run = overlapping[0];
    const subset = run.start >= row.bleedStart && run.end <= row.bleedEnd;
    if (!subset) {
      drop.push({ id: row.id, reason: 'merge' });
      continue;
    }
    const next = { ...row, bleedStart: run.start, bleedEnd: run.end };
    keep.push(next);
    updates.push({ id: row.id, bleedStart: run.start, bleedEnd: run.end });
  }

  return { keep, drop, updates };
}

export function isFactualMenstrualHistoryLog(log, classifiedDateSet) {
  if (!log) return false;
  if (isEngineEligibleLog(log)) return true;
  return (
    isPostpartumTrackingContext(log.trackingContext)
    && isPeriodFlow(log.flow)
    && classifiedDateSet instanceof Set
    && classifiedDateSet.has(log.date)
  );
}

export function filterLogsForMenstrualHistory(logs, today, classifiedDateSet) {
  const cutoff = engineHistoryCutoff(today);
  return (logs || []).filter(
    (log) => log?.date >= cutoff && isFactualMenstrualHistoryLog(log, classifiedDateSet),
  );
}

/**
 * Forecast input stays Phase 38 isolated while POSTPARTUM (and PREGNANCY).
 * After an explicit mode switch to TRACK/TTC/PERI, classified postpartum
 * PERIOD_FLOW days may join factual menstrual history / forecast input.
 */
export function forecastLogsForMode(mode, logs, today, classifiedDateSet) {
  if (mode === 'POSTPARTUM' || mode === 'PREGNANCY') {
    return (logs || []).filter((log) => log?.date >= engineHistoryCutoff(today) && isEngineEligibleLog(log));
  }
  return filterLogsForMenstrualHistory(logs, today, classifiedDateSet);
}

export function presentBleedClassification(row) {
  if (!row) return null;
  return {
    postpartumEpisodeId: row.postpartumEpisodeId ?? null,
    bleedStart: row.bleedStart ?? null,
    bleedEnd: row.bleedEnd ?? null,
    classification: MENSTRUAL_PERIOD_CLASSIFICATION,
    source: CLASSIFICATION_SOURCE_OWNER,
    ownerClassified: true,
    inferred: false,
    classifiedAt: row.classifiedAt instanceof Date
      ? row.classifiedAt.toISOString()
      : row.classifiedAt ?? null,
  };
}

export function serializeBleedClassificationsForExport(rows) {
  return (rows || []).map((row) => ({
    postpartumEpisodeId: row.postpartumEpisodeId ?? null,
    bleedStart: row.bleedStart ?? null,
    bleedEnd: row.bleedEnd ?? null,
    classification: row.classification ?? MENSTRUAL_PERIOD_CLASSIFICATION,
    source: CLASSIFICATION_SOURCE_OWNER,
    ownerClassified: true,
    inferred: false,
    classifiedAt: row.classifiedAt instanceof Date
      ? row.classifiedAt.toISOString()
      : row.classifiedAt ?? null,
  }));
}

export function assertMenstrualClassification(value) {
  if (value == null || value === MENSTRUAL_PERIOD_CLASSIFICATION) {
    return MENSTRUAL_PERIOD_CLASSIFICATION;
  }
  throw httpError('მხოლოდ მენსტრუაციად მონიშვნაა შესაძლებელი.', 400, 'unsupported_classification');
}

export async function loadPostpartumBleedLogs(prisma, userId) {
  const rows = await prisma.cycleLog.findMany({
    where: { userId, trackingContext: POSTPARTUM_TRACKING_CONTEXT },
    select: {
      date: true,
      flow: true,
      trackingContext: true,
      postpartumEpisodeId: true,
    },
    orderBy: { date: 'asc' },
  });
  return rows.map((row) => ({
    ...row,
    date: toDateKey(row.date) || row.date,
  }));
}

export async function reconcileUserBleedClassifications(prisma, userId) {
  if (!prisma?.cyclePostpartumBleedClassification || !userId) {
    return { classifiedDates: [], episodes: [], latest: null, keep: [] };
  }
  let rows = [];
  try {
    rows = await prisma.cyclePostpartumBleedClassification.findMany({
      where: { userId },
    });
  } catch {
    return { classifiedDates: [], episodes: [], latest: null, keep: [] };
  }

  let ppLogs = [];
  try {
    ppLogs = await loadPostpartumBleedLogs(prisma, userId);
  } catch {
    ppLogs = [];
  }
  const runs = groupPostpartumBleedRuns(ppLogs);
  const plan = planClassificationReconciliation({ classifications: rows, runs });
  const dropIds = plan.drop.map((row) => row.id).filter(Boolean);
  if (dropIds.length) {
    await prisma.cyclePostpartumBleedClassification.deleteMany({
      where: { userId, id: { in: dropIds } },
    });
  }
  for (const update of plan.updates) {
    try {
      await prisma.cyclePostpartumBleedClassification.update({
        where: { id: update.id },
        data: { bleedStart: update.bleedStart, bleedEnd: update.bleedEnd },
      });
    } catch {
      await prisma.cyclePostpartumBleedClassification.deleteMany({
        where: { id: update.id, userId },
      });
    }
  }

  const classifiedDates = [...classifiedPeriodFlowDates(ppLogs, plan.keep)];
  const episodes = plan.keep
    .map((row) => ({
      postpartumEpisodeId: row.postpartumEpisodeId,
      start: row.bleedStart,
      end: row.bleedEnd,
      classified: true,
      source: CLASSIFICATION_SOURCE_OWNER,
    }))
    .sort((a, b) => a.start.localeCompare(b.start));
  const latest = episodes.length ? episodes[episodes.length - 1] : null;
  return {
    classifiedDates,
    episodes,
    latest,
    keep: plan.keep,
    dropReasons: plan.drop.map((row) => row.reason),
  };
}

export function canMutatePostpartumBleedClassification(mode) {
  return mode !== 'PREGNANCY';
}

export async function classifyPostpartumBleedEpisode(prisma, {
  userId,
  date,
  mode,
  today,
} = {}) {
  if (!canMutatePostpartumBleedClassification(mode)) {
    throw httpError('ორსულობის რეჟიმში მონიშვნა შეუძლებელია.', 400, 'mode');
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) {
    throw httpError('თარიღი არასწორია.', 400, 'invalid_date');
  }

  const ppLogs = await loadPostpartumBleedLogs(prisma, userId);
  const runs = groupPostpartumBleedRuns(ppLogs);
  const run = findBleedRunForDate(runs, date);
  if (!run || !run.postpartumEpisodeId) {
    throw httpError('სისხლდენის ეპიზოდი ვერ მოიძებნა.', 400, 'no_bleed_episode');
  }

  const existing = await prisma.cyclePostpartumBleedClassification.findFirst({
    where: {
      userId,
      postpartumEpisodeId: run.postpartumEpisodeId,
      bleedStart: run.start,
    },
  });
  if (existing) {
    if (existing.bleedEnd !== run.end) {
      const updated = await prisma.cyclePostpartumBleedClassification.update({
        where: { id: existing.id },
        data: { bleedEnd: run.end },
      });
      return { created: false, idempotent: true, row: updated };
    }
    return { created: false, idempotent: true, row: existing };
  }

  const row = await prisma.cyclePostpartumBleedClassification.create({
    data: {
      userId,
      postpartumEpisodeId: run.postpartumEpisodeId,
      bleedStart: run.start,
      bleedEnd: run.end,
      classification: MENSTRUAL_PERIOD_CLASSIFICATION,
      source: CLASSIFICATION_SOURCE_OWNER,
    },
  });
  return { created: true, idempotent: false, row };
}

export async function unclassifyPostpartumBleedEpisode(prisma, {
  userId,
  date,
  mode,
} = {}) {
  if (!canMutatePostpartumBleedClassification(mode)) {
    throw httpError('ორსულობის რეჟიმში მონიშვნის გაუქმება შეუძლებელია.', 400, 'mode');
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) {
    throw httpError('თარიღი არასწორია.', 400, 'invalid_date');
  }

  const ppLogs = await loadPostpartumBleedLogs(prisma, userId);
  const runs = groupPostpartumBleedRuns(ppLogs);
  const run = findBleedRunForDate(runs, date);
  const starts = new Set([date]);
  if (run?.start) starts.add(run.start);

  const result = await prisma.cyclePostpartumBleedClassification.deleteMany({
    where: {
      userId,
      bleedStart: { in: [...starts] },
      ...(run?.postpartumEpisodeId ? { postpartumEpisodeId: run.postpartumEpisodeId } : {}),
    },
  });
  return { deleted: result.count, idempotent: true };
}

export async function loadClassifiedPeriodFlowLogs(prisma, userId, today, classifiedDates) {
  if (!classifiedDates?.length) return [];
  const cutoff = engineHistoryCutoff(today);
  const dates = classifiedDates.map((date) => toDateKey(date)).filter((date) => date && date >= cutoff);
  if (!dates.length) return [];
  const rows = await prisma.cycleLog.findMany({
    where: {
      userId,
      trackingContext: POSTPARTUM_TRACKING_CONTEXT,
      date: { in: dates },
      flow: { in: ['light', 'medium', 'heavy'] },
    },
    select: { date: true, flow: true, trackingContext: true, postpartumEpisodeId: true },
    orderBy: { date: 'asc' },
  });
  return rows.map((row) => ({
    ...row,
    date: toDateKey(row.date) || row.date,
  }));
}

export function mergeForecastLogs(engineLogs, classifiedLogs) {
  const byDate = new Map();
  for (const log of engineLogs || []) byDate.set(log.date, log);
  for (const log of classifiedLogs || []) {
    if (!byDate.has(log.date)) byDate.set(log.date, log);
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function classificationCopyForbidden(text) {
  const value = String(text || '');
  return {
    fertilityReturn: /ნაყოფიერება დაბრუნ|fertility (has )?return/i.test(value),
    ovulationReturn: /ოვულაცია დაბრუნ|ovulation (has )?return/i.test(value),
    lochia: /ლოხია|lochia/i.test(value),
    hemorrhage: /ჰემორაგ|სისხლდენა მასიური|postpartum hemorrhage|\bPPH\b/i.test(value),
    medicardDetected: /Medicard (detected|დაადგინა)|აპმა დაადგინა/i.test(value),
  };
}
