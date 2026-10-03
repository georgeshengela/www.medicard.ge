import { addDays, daysBetween, isPeriodFlow, todayInTimeZone } from './cycle.js';

export const CYCLE_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const MAX_PERIOD_SPAN_DAYS = 14;
export const DEFAULT_BLEED_FLOW = 'medium';

export function isValidCycleDateKey(key) {
  if (typeof key !== 'string' || !CYCLE_DATE_RE.test(key)) return false;
  const [y, m, d] = key.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export function assertCycleDateKey(key, today = todayInTimeZone()) {
  if (!isValidCycleDateKey(key)) {
    const err = new Error('თარიღი არასწორია.');
    err.messageEn = 'The date is not valid.';
    err.status = 400;
    throw err;
  }
  if (key > today) {
    const err = new Error('მომავალი თარიღის აღრიცხვა შეუძლებელია.');
    err.messageEn = 'You cannot log a date in the future.';
    err.status = 400;
    throw err;
  }
  return key;
}

export function eachDateKey(start, end) {
  if (!start || !end || start > end) return [];
  const out = [];
  let key = start;
  for (let i = 0; i < 40 && key <= end; i += 1) {
    out.push(key);
    key = addDays(key, 1);
  }
  return out;
}

export function logsByDate(logs = []) {
  return Object.fromEntries((logs || []).map((log) => [log.date, log]));
}

export function planStartPeriod(date, existingFlow, defaultFlow = DEFAULT_BLEED_FLOW) {
  const alreadyLogged = isPeriodFlow(existingFlow);
  return {
    date,
    alreadyLogged,
    flow: alreadyLogged ? existingFlow : defaultFlow,
  };
}

/**
 * End Period = bleeding stopped as of `endDate` (that civil day is no longer a period day).
 * Never synthesize CycleLog.flow for unlogged days — intensity is a user observation.
 * Schema cannot represent "bled, intensity unknown" (only none|spotting|light|medium|heavy).
 * Future days cannot be logged, so clearing only *after* endDate made the hub CTA a no-op.
 */
export function planEndPeriod({ ranges = [], logs = [], endDate }) {
  const map = logsByDate(logs);
  const sorted = [...ranges].sort((a, b) => a.start.localeCompare(b.start));
  const containing = sorted.find((r) => r.start <= endDate && endDate <= r.end);
  const earlier = [...sorted].reverse().find((r) => r.start <= endDate) || null;
  const range = containing || earlier;
  const start = range?.start || endDate;
  const oldEnd = range?.end || endDate;
  const span = eachDateKey(start, endDate);
  const unlogged = span.filter((key) => !isPeriodFlow(map[key]?.flow));
  const clear =
    oldEnd >= endDate
      ? eachDateKey(endDate, oldEnd).filter((key) => isPeriodFlow(map[key]?.flow))
      : [];
  // Period auto-end (brief §9 wave 2 item 3): „დასრულდა“ is an observation — that day had no bleeding.
  // It is kept as flow „none“ so a derived „still bleeding?“ never asks again about a period she ended.
  // Not on the run's first day (that is the undo of a one-tap start: the day is cleared as before) and
  // never for a date far past the run.
  const flowOnEnd = map[endDate]?.flow;
  const markNone =
    range &&
    endDate > range.start &&
    daysBetween(range.start, endDate) < MAX_PERIOD_SPAN_DAYS &&
    flowOnEnd !== 'none' &&
    flowOnEnd !== 'spotting'
      ? endDate
      : null;
  return { start, end: endDate, fill: [], clear, unlogged, markNone };
}

/** Dates HealthKit / Health Connect would receive as observed flow (not predictions). */
export function observedFlowSamples(logs = []) {
  return (logs || [])
    .filter((log) => isPeriodFlow(log.flow) || log.flow === 'spotting')
    .map((log) => ({ date: log.date, flow: log.flow }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function applyEndPeriodToLogs(logs = [], plan) {
  if (plan.fill?.length) {
    const err = new Error('End Period must not synthesize flow days.');
    err.status = 500;
    throw err;
  }
  const keep = [];
  const cleared = new Set(plan.clear || []);
  const markNone = plan.markNone || null;
  let marked = false;
  for (const log of logs) {
    if (log.date === markNone) {
      keep.push({ ...log, flow: 'none' });
      marked = true;
      continue;
    }
    if (!cleared.has(log.date)) {
      keep.push(log);
      continue;
    }
    if (logHasExtras(log)) keep.push({ ...log, flow: 'none' });
  }
  if (markNone && !marked) {
    keep.push({ date: markNone, flow: 'none', symptoms: [], moods: [] });
    keep.sort((a, b) => a.date.localeCompare(b.date));
  }
  return keep;
}

export function planFillRange(start, end, logs = [], flow = DEFAULT_BLEED_FLOW) {
  const span = eachDateKey(start, end);
  if (span.length === 0) {
    const err = new Error('თარიღები არასწორია.');
    err.messageEn = 'The dates are not valid.';
    err.status = 400;
    throw err;
  }
  if (span.length > MAX_PERIOD_SPAN_DAYS) {
    const err = new Error('მენსტრუაციის დიაპაზონი ძალიან გრძელია.');
    err.messageEn = 'That period range is too long.';
    err.status = 400;
    throw err;
  }
  const map = logsByDate(logs);
  return {
    start,
    end,
    fill: span.filter((key) => !isPeriodFlow(map[key]?.flow)),
    flow,
  };
}

export function logHasExtras(log) {
  if (!log) return false;
  const symptoms = Array.isArray(log.symptoms) ? log.symptoms : [];
  const moods = Array.isArray(log.moods) ? log.moods : [];
  return (
    symptoms.length > 0 ||
    moods.length > 0 ||
    Boolean(log.notes) ||
    log.bbt != null ||
    log.sexualActivity != null ||
    log.libido != null ||
    Boolean(log.cervicalMucus) ||
    Boolean(log.ovulationTest) ||
    Boolean(log.pregnancyTest) ||
    (Array.isArray(log.painEntries) && log.painEntries.length > 0) ||
    Boolean(log.sleepQuality) ||
    Boolean(log.stressLevel) ||
    Boolean(log.exerciseLevel) ||
    Boolean(log.caffeine) ||
    Boolean(log.alcohol) ||
    (Array.isArray(log.customTagIds) && log.customTagIds.length > 0) ||
    (log.observations && typeof log.observations === 'object' && Object.keys(log.observations).length > 0) ||
    Boolean(log.energy)
  );
}
