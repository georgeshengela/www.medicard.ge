// Shared date helpers for the MEDICARD web-QA mock. No dependencies.
// Georgia (Asia/Tbilisi) is UTC+4 all year (no DST since 2005).

export const TZ = 'Asia/Tbilisi';
export const TZ_OFFSET = '+04:00';

/** Today's calendar date in Tbilisi as YYYY-MM-DD. */
export function tbilisiToday(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

/** Current Tbilisi wall-clock hour (0-23). */
export function tbilisiHour(now = new Date()) {
  return Number(new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', hour12: false }).format(now)) % 24;
}

/** YYYY-MM-DD + n days (calendar math in UTC, safe for date-only keys). */
export function addDays(ymd, n) {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Whole days b - a for two YYYY-MM-DD keys. */
export function diffDays(a, b) {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
}

/** ISO instant (UTC, with Z) for a Tbilisi local date + 'HH:MM'. */
export function isoAt(ymd, hhmm = '12:00') {
  return new Date(`${ymd}T${hhmm}:00${TZ_OFFSET}`).toISOString();
}

/** ISO instant n minutes before now. */
export function minutesAgo(n) {
  return new Date(Date.now() - n * 60000).toISOString();
}

/** 0 = Sunday … 6 = Saturday for a YYYY-MM-DD key. */
export function weekday(ymd) {
  return new Date(`${ymd}T00:00:00Z`).getUTCDay();
}

/** Monday of the ISO week that contains ymd. */
export function mondayOf(ymd) {
  const wd = weekday(ymd);
  return addDays(ymd, wd === 0 ? -6 : 1 - wd);
}

/** Deterministic pseudo-random in [0,1) from a string seed (stable fixtures). */
export function seeded(seed) {
  let h = 2166136261;
  for (const ch of String(seed)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return ((h >>> 0) % 100000) / 100000;
}

export function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}
