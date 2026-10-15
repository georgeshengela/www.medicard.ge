/**
 * MEDIBOOK clock helpers. Every business in the catalogue is in Georgia, which has kept UTC+4 all year
 * since 2005, so a fixed offset is exact and needs no tz database. Dates travel as `YYYY-MM-DD`, clock
 * times as `HH:mm`, instants as ISO strings / Date objects.
 */
export const TBILISI_OFFSET_MIN = 4 * 60;
const MIN = 60_000;

/** `YYYY-MM-DD` of an instant in Tbilisi. */
export function tbilisiYmd(at = new Date()) {
  return new Date(at.getTime() + TBILISI_OFFSET_MIN * MIN).toISOString().slice(0, 10);
}

/** 0 = Sunday … 6 = Saturday, in Tbilisi. */
export function tbilisiWeekday(at = new Date()) {
  return new Date(at.getTime() + TBILISI_OFFSET_MIN * MIN).getUTCDay();
}

/** Minutes since local midnight in Tbilisi. */
export function tbilisiMinutes(at = new Date()) {
  const d = new Date(at.getTime() + TBILISI_OFFSET_MIN * MIN);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

/** `HH:mm` in Tbilisi. */
export function tbilisiClock(at) {
  const m = tbilisiMinutes(at instanceof Date ? at : new Date(at));
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/** The instant of `HH:mm` on a Tbilisi calendar day (minutes may exceed 24 h for an overnight close). */
export function tbilisiInstant(ymd, minutes) {
  const [y, m, d] = String(ymd).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 0, 0) - TBILISI_OFFSET_MIN * MIN + minutes * MIN);
}

/** Weekday (0–6) of a `YYYY-MM-DD`. */
export function weekdayOfYmd(ymd) {
  const [y, m, d] = String(ymd).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function addDaysYmd(ymd, days) {
  const [y, m, d] = String(ymd).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

export function isYmd(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value ?? '')) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

/** `HH:mm` → minutes since midnight, or null. */
export function clockToMinutes(value) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(value ?? '').trim());
  if (!m) return null;
  const h = Number(m[1]);
  const mm = Number(m[2]);
  if (h > 24 || mm > 59 || (h === 24 && mm > 0)) return null;
  return h * 60 + mm;
}

export function minutesToClock(minutes) {
  const m = Math.max(0, Math.round(minutes));
  return `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/** Start of the Tbilisi day that contains `at`, as an instant. */
export function tbilisiDayStart(at = new Date()) {
  return tbilisiInstant(tbilisiYmd(at), 0);
}

/** Days between two `YYYY-MM-DD` (b − a). */
export function daysBetweenYmd(a, b) {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}
