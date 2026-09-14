import { addDays, toDateKey } from './cycle.js';
import { assertStableCivilDate } from './cycleCivilDate.js';
import { isRealCalendarDate } from './petsAge.js';

export { addDays, toDateKey };

export function pad2(value) {
  return String(value).padStart(2, '0');
}

export function parseYmd(ymd) {
  const key = assertStableCivilDate(ymd);
  if (!key || !isRealCalendarDate(key)) return null;
  const [year, month, day] = key.split('-').map(Number);
  return { year, month, day, ymd: key };
}

export function formatYmd(year, month, day) {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

export function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function compareYmd(a, b) {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

export function maxYmd(a, b) {
  return compareYmd(a, b) >= 0 ? a : b;
}

export function minYmd(a, b) {
  return compareYmd(a, b) <= 0 ? a : b;
}

/** Calendar months are not a fixed number of days. Anchor day is preserved across short months. */
export function addCalendarMonths(ymd, count, anchorDay) {
  const parsed = parseYmd(ymd);
  if (!parsed) return null;
  const n = Number(count);
  if (!Number.isInteger(n)) return null;
  const anchor = Number.isInteger(anchorDay) ? anchorDay : parsed.day;
  const total = parsed.year * 12 + (parsed.month - 1) + n;
  const year = Math.floor(total / 12);
  const month = (total % 12) + 1;
  const day = Math.min(anchor, daysInMonth(year, month));
  return formatYmd(year, month, day);
}

export function addCalendarWeeks(ymd, count) {
  return addDays(ymd, count * 7);
}

export function isTimeHHmm(value) {
  return typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export function compareYmdTime(aOn, aTime, bOn, bTime) {
  const dates = compareYmd(aOn, bOn);
  if (dates !== 0) return dates;
  const left = aTime || 'date';
  const right = bTime || 'date';
  if (left === right) return 0;
  if (left === 'date') return -1;
  if (right === 'date') return 1;
  return left < right ? -1 : 1;
}
