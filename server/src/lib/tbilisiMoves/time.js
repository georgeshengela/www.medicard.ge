import { addDaysYmd, tbilisiMidnight, tbilisiYmd } from '../adminAnalyticsRange.js';
import { nextTbilisiMidnight } from '../usageWindow.js';

export { addDaysYmd, tbilisiMidnight, tbilisiYmd, nextTbilisiMidnight };

export const TBILISI_TIMEZONE = 'Asia/Tbilisi';
export const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Authoritative Tbilisi civil clock for mobile sync. Never invent from device TZ. */
export function tbilisiClock(now = new Date()) {
  const date = tbilisiYmd(now);
  const dayStart = tbilisiMidnight(date);
  const nextMidnight = tbilisiMidnight(addDaysYmd(date, 1));
  return {
    timezone: TBILISI_TIMEZONE,
    serverNow: now.toISOString(),
    date,
    dayStart: dayStart.toISOString(),
    dayEnd: nextMidnight.toISOString(),
    nextMidnight: nextMidnight.toISOString(),
  };
}

export function assertYmd(value, field = 'date') {
  const ymd = String(value || '').slice(0, 10);
  if (!YMD_RE.test(ymd)) {
    const err = new Error(`${field} must be YYYY-MM-DD`);
    err.status = 400;
    err.code = 'INVALID_DATE';
    throw err;
  }
  return ymd;
}

export function addHours(date, hours) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

export function graceEndsAtFor(ymd, graceHours) {
  return addHours(tbilisiMidnight(addDaysYmd(ymd, 1)), graceHours);
}

/** Inclusive start, exclusive end. */
export function dateInPeriod(ymd, startDate, endDate) {
  if (ymd < startDate) return false;
  if (endDate == null) return true;
  return ymd < endDate;
}

export function intervalsOverlap(aStart, aEnd, bStart, bEnd) {
  const a0 = aStart.getTime();
  const a1 = aEnd.getTime();
  const b0 = bStart.getTime();
  const b1 = bEnd == null ? Number.POSITIVE_INFINITY : bEnd.getTime();
  return a0 < b1 && b0 < a1;
}
