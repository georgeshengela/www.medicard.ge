/**
 * Period auto-end (MEDICARD Cycle brief §9 wave 2 item 3, [კ-22]) — Flo's derivation, read time only.
 *
 * The latest logged bleeding run is "open" until one of these happens:
 *   (a) a day after its last bleeding day is logged as „none“ or „spotting“ (explicit end — kept as is);
 *   (b) the typical period length has passed with no further bleeding logged. The day after the typical
 *       length (or after the last logged bleeding day, if she logged past it) the app asks once
 *       „ჯერ კიდევ გაქვს?“ (`askStill`); with no answer the run counts as ended the day after that.
 *       The run's end is always its last logged bleeding day.
 *
 * Nothing is written to the database for (b): a later bleeding log (the „კი“ answer is one) simply
 * extends the run again, and every derived value follows. A bleeding log today keeps the run `active`
 * that day, so an explicit „still bleeding“ answer is never auto-ended on the day it was given.
 * Runs longer than 7 days are flagged (`longRun`); the app's calm heavy-bleeding card reads the logs
 * itself and keeps showing for them.
 *
 * Pregnancy and postpartum bleeding is not a period: no status in those modes.
 */
import { addDays, daysBetween, isPeriodFlow, DEFAULT_PERIOD_LENGTH } from './cycle.js';

export const PERIOD_STATUS_STATES = Object.freeze(['active', 'ended', 'askStill']);
/** Same threshold as the app's heavy-bleeding card (bleeding > 7 days → talk to a doctor). */
export const PERIOD_LONG_RUN_DAYS = 7;
const MIN_TYPICAL = 2;
const MAX_TYPICAL = 10;
const NO_STATUS_MODES = new Set(['PREGNANCY', 'POSTPARTUM']);

/** The usual period length the forecast uses (inferred average when available, else profile, else 5), clamped 2–10. */
export function typicalPeriodLength(value) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_PERIOD_LENGTH;
  return Math.min(MAX_TYPICAL, Math.max(MIN_TYPICAL, n));
}

function isExplicitEndFlow(flow) {
  return flow === 'none' || flow === 'spotting';
}

/**
 * @param {object} input
 * @param {{start: string, end: string}[]} input.ranges  logged period runs (`inferCycleStats().periodRanges`)
 * @param {{date: string, flow?: string|null}[]} input.logs  engine logs (date + flow are read)
 * @param {string} input.today  civil today (YYYY-MM-DD)
 * @param {number} [input.typicalLength]  `averages.usedPeriodLength`
 * @param {string} [input.mode]  cycle profile mode
 * @returns {null | {
 *   state: 'active'|'ended'|'askStill', day: number|null, typicalLength: number, autoEnded: boolean,
 *   start: string, lastBleed: string, longRun: boolean
 * }}
 */
export function derivePeriodStatus({ ranges = [], logs = [], today, typicalLength, mode = null } = {}) {
  if (!today || NO_STATUS_MODES.has(mode)) return null;
  const run = [...(ranges || [])]
    .filter((r) => r?.start && r?.end && r.start <= today)
    .sort((a, b) => a.start.localeCompare(b.start))
    .pop();
  if (!run) return null;

  const typical = typicalPeriodLength(typicalLength);
  const lastBleed = run.end > today ? today : run.end;
  const runDay = daysBetween(run.start, today) + 1;
  const flowOn = new Map();
  for (const log of logs || []) {
    if (log?.date) flowOn.set(String(log.date).slice(0, 10), log.flow ?? null);
  }
  const base = {
    typicalLength: typical,
    start: run.start,
    lastBleed,
    longRun: daysBetween(run.start, lastBleed) + 1 > PERIOD_LONG_RUN_DAYS,
  };

  if (isPeriodFlow(flowOn.get(today))) {
    return { state: 'active', day: runDay, autoEnded: false, ...base };
  }

  // (a) „none“ / „spotting“ logged after the last bleeding day (and not in the future) ended it.
  for (const [date, flow] of flowOn) {
    if (date > lastBleed && date <= today && isExplicitEndFlow(flow)) {
      return { state: 'ended', day: null, autoEnded: false, ...base };
    }
  }

  // (b) Typical length: open through the usual length (or the last logged bleeding day, if later),
  // one question the day after, ended after that.
  const usualEnd = addDays(run.start, typical - 1);
  const horizon = lastBleed > usualEnd ? lastBleed : usualEnd;
  if (today <= horizon) return { state: 'active', day: runDay, autoEnded: false, ...base };
  if (today === addDays(horizon, 1)) return { state: 'askStill', day: runDay, autoEnded: false, ...base };
  return { state: 'ended', day: null, autoEnded: true, ...base };
}

/**
 * Once the current period has ended (explicitly or by the typical length), the forecast's projection of
 * that same period must not keep painting „expected period“ on the days after its last bleeding day.
 * Only the projection anchored on this run (`lastPeriodStart === status.start`) is trimmed; logged days,
 * fertile marks and the next cycles stay untouched. Returns a new calendar object.
 */
export function trimEndedPeriodProjection(calendar, status, { lastPeriodStart, periodLength } = {}) {
  if (!calendar || !status || status.state !== 'ended' || !lastPeriodStart || status.start !== lastPeriodStart) {
    return calendar;
  }
  const length = typicalPeriodLength(periodLength);
  let next = calendar;
  for (let i = 0; i < length; i += 1) {
    const key = addDays(lastPeriodStart, i);
    if (key <= status.lastBleed) continue;
    const mark = next[key];
    if (!mark?.period || mark.predicted !== true || mark.periodRange) continue;
    if (next === calendar) next = { ...calendar };
    const { period, predicted, estimated, ...rest } = mark;
    const keepEstimated = Boolean(rest.fertile || rest.ovulation);
    const trimmed = keepEstimated ? { ...rest, estimated } : rest;
    if (Object.keys(trimmed).length) next[key] = trimmed;
    else delete next[key];
  }
  return next;
}
