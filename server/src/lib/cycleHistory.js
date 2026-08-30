/**
 * Historical cycle segmentation from logged period starts.
 * Prediction math lives in cycle.js and must not import this module
 * for forecast / ovulation / fertile-window work.
 */

/** Civil-day math — same UTC rule as cycle.js daysBetween. Do not use Date#toISOString. */
function parseDateKey(key) {
  const [y, m, d] = String(key).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function civilDaysBetween(a, b) {
  return Math.round((parseDateKey(b) - parseDateKey(a)) / 86_400_000);
}

function daysBetween(a, b) {
  return civilDaysBetween(a, b);
}

export const PATTERN_CYCLE_HORIZON = 12;
export const PATTERN_LENGTH_MIN = 18;
export const PATTERN_LENGTH_MAX = 60;
export const PMS_DAYS_BEFORE_MIN = 1;
export const PMS_DAYS_BEFORE_MAX = 14;
export const BASIC_STATS_MIN_CYCLES = 2;
export const RECURRING_PATTERN_MIN_CYCLES = 3;

/**
 * daysBeforeNextPeriod:
 *   0 = observation falls on the next period start
 *   1 = one civil day before the next period start
 * Positive integer. Never negative.
 */
export function daysBeforeNextPeriod(observationDate, nextPeriodStart) {
  if (!observationDate || !nextPeriodStart) return null;
  const gap = daysBetween(observationDate, nextPeriodStart);
  return gap >= 0 ? gap : null;
}

export function historicalCycleDay(cycleStart, observationDate) {
  if (!cycleStart || !observationDate || observationDate < cycleStart) return null;
  return daysBetween(cycleStart, observationDate) + 1;
}

/**
 * @returns {Array<{
 *   startDate: string,
 *   nextPeriodStart: string | null,
 *   cycleLength: number | null,
 *   complete: boolean,
 *   validForPatterns: boolean,
 * }>}
 */
export function segmentHistoricalCycles(periodStarts = []) {
  const starts = [...periodStarts].filter(Boolean).sort((a, b) => a.localeCompare(b));
  const cycles = [];
  for (let i = 0; i < starts.length; i += 1) {
    const startDate = starts[i];
    const nextPeriodStart = starts[i + 1] ?? null;
    const complete = Boolean(nextPeriodStart);
    const cycleLength = complete ? daysBetween(startDate, nextPeriodStart) : null;
    const validForPatterns =
      complete &&
      cycleLength != null &&
      cycleLength >= PATTERN_LENGTH_MIN &&
      cycleLength <= PATTERN_LENGTH_MAX;
    cycles.push({
      startDate,
      nextPeriodStart,
      cycleLength,
      complete,
      validForPatterns,
    });
  }
  return cycles;
}

/**
 * Locate the cycle an observation belongs to.
 * complete cycle: start <= date < nextStart
 * open cycle: start <= date (last start only)
 * orphan: date < first start
 */
export function locateObservation(date, cycles = []) {
  if (!date || !cycles.length) {
    return { kind: 'orphan', cycle: null, cycleDay: null, daysBeforeNextPeriod: null };
  }
  const ordered = [...cycles].sort((a, b) => a.startDate.localeCompare(b.startDate));
  if (date < ordered[0].startDate) {
    return { kind: 'orphan', cycle: null, cycleDay: null, daysBeforeNextPeriod: null };
  }
  for (const cycle of ordered) {
    if (date < cycle.startDate) continue;
    if (cycle.nextPeriodStart && date >= cycle.nextPeriodStart) continue;
    return {
      kind: cycle.complete ? 'complete' : 'open',
      cycle,
      cycleDay: historicalCycleDay(cycle.startDate, date),
      daysBeforeNextPeriod: cycle.complete
        ? daysBeforeNextPeriod(date, cycle.nextPeriodStart)
        : null,
    };
  }
  return { kind: 'orphan', cycle: null, cycleDay: null, daysBeforeNextPeriod: null };
}

export function patternCycles(cycles = []) {
  return cycles.filter((c) => c.validForPatterns).slice(-PATTERN_CYCLE_HORIZON);
}

export function bleedDaysInCycle(cycle, periodRanges = []) {
  if (!cycle) return 0;
  return periodRanges
    .filter((range) => {
      if (!range?.start) return false;
      if (range.start < cycle.startDate) return false;
      if (cycle.nextPeriodStart && range.start >= cycle.nextPeriodStart) return false;
      return true;
    })
    .reduce((sum, range) => sum + (Number(range.lengthDays) || 0), 0);
}

export function observationDaysInCycle(cycle, logs = []) {
  if (!cycle) return 0;
  return logs.filter((log) => {
    if (!log?.date) return false;
    if (log.date < cycle.startDate) return false;
    if (cycle.nextPeriodStart && log.date >= cycle.nextPeriodStart) return false;
    return true;
  }).length;
}

export function isBleedLog(log) {
  return log?.flow === 'light' || log?.flow === 'medium' || log?.flow === 'heavy';
}
