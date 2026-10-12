// Civil-date age maths for MEDIFAMILY. Every date is a 'YYYY-MM-DD' string in the family's own day (the
// phone's time zone), never a timestamp: a child born on 3 March is one month old on 3 April everywhere.
import { todayInTimeZone } from '../cycle.js';
import { clientTimezoneFromReq, CYCLE_TIMEZONE_FALLBACK } from '../cycleCivilDate.js';

export const DAY_MS = 86400000;
/** WHO: one month = 30.4375 days (365.25 / 12). */
export const DAYS_PER_MONTH = 30.4375;
/** Term pregnancy: corrected age counts from 40 weeks; under 37 weeks is preterm. */
export const TERM_WEEKS = 40;
export const PRETERM_BELOW_WEEKS = 37;
/** Corrected age is used until two years of chronological age (WHO, AAP). */
export const CORRECT_UNTIL_DAYS = 730;
export const CHILD_MAX_YEARS = 18;

export function familyTodayYmd(req, now = new Date()) {
  return todayInTimeZone(clientTimezoneFromReq(req) || CYCLE_TIMEZONE_FALLBACK, now);
}

export function familyTimeZone(req) {
  return clientTimezoneFromReq(req) || CYCLE_TIMEZONE_FALLBACK;
}

/** The instant the civil day starts in a time zone (DST edges are off by at most an hour). */
export function dayStartMs(timeZone, ymd) {
  const utcMidnight = ymdToUtc(ymd);
  const dtf = new Intl.DateTimeFormat('en-US', { timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  const parts = Object.fromEntries(dtf.formatToParts(new Date(utcMidnight)).map((p) => [p.type, p.value]));
  const asUtc = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute));
  return utcMidnight - (asUtc - utcMidnight);
}

export function isYmd(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

export function ymdToUtc(ymd) {
  const [y, m, d] = ymd.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

export function utcToYmd(ms) {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Postgres DATE values arrive as Date objects at UTC midnight; strings pass through. */
export function toYmd(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString().slice(0, 10);
  const text = String(value).slice(0, 10);
  return isYmd(text) ? text : null;
}

export function daysBetween(fromYmd, toYmd) {
  return Math.round((ymdToUtc(toYmd) - ymdToUtc(fromYmd)) / DAY_MS);
}

export function addDays(ymd, days) {
  return utcToYmd(ymdToUtc(ymd) + days * DAY_MS);
}

/** Calendar months: 31 Jan + 1 month = 28/29 Feb (the last day, never 3 March). */
export function addMonths(ymd, months) {
  const [y, m, d] = ymd.split('-').map(Number);
  const total = (m - 1) + months;
  const year = y + Math.floor(total / 12);
  const month = ((total % 12) + 12) % 12;
  const last = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return utcToYmd(Date.UTC(year, month, Math.min(d, last)));
}

export function addYears(ymd, years) {
  return addMonths(ymd, years * 12);
}

/** Whole calendar years / months / days between two civil dates (birthday logic). */
export function ageParts(birthYmd, onYmd) {
  if (!isYmd(birthYmd) || !isYmd(onYmd) || onYmd < birthYmd) return { years: 0, months: 0, days: 0, totalMonths: 0 };
  let months = 0;
  while (addMonths(birthYmd, months + 1) <= onYmd) months += 1;
  const days = daysBetween(addMonths(birthYmd, months), onYmd);
  return { years: Math.floor(months / 12), months: months % 12, days, totalMonths: months };
}

export function isPreterm(gestationWeeks) {
  const weeks = Number(gestationWeeks);
  return Number.isFinite(weeks) && weeks >= 22 && weeks < PRETERM_BELOW_WEEKS;
}

/**
 * The age used for growth and development: chronological age minus the weeks born early, until two
 * years. Vaccines always follow chronological age (Georgian calendar, WHO).
 */
export function correctedAgeDays(ageDays, gestationWeeks) {
  if (!isPreterm(gestationWeeks) || ageDays >= CORRECT_UNTIL_DAYS) return ageDays;
  return Math.max(0, ageDays - (TERM_WEEKS - Number(gestationWeeks)) * 7);
}

const KA_UNITS = { y: 'წლის', m: 'თვის', w: 'კვირის', d: 'დღის' };

function enUnit(n, one, many) {
  return `${n} ${n === 1 ? one : many}`;
}

/**
 * „4 თვის და 12 დღის“ / „4 months 12 days“. Under two months the days stay; from two years the days go;
 * from six years only years are shown (that is how parents say it).
 */
export function ageLabel(birthYmd, onYmd, lang = 'ka') {
  const days = daysBetween(birthYmd, onYmd);
  const en = lang === 'en';
  if (days < 0) return en ? 'Not born yet' : 'ჯერ არ დაბადებულა';
  if (days === 0) return en ? 'Born today' : 'დღეს დაიბადა';
  const { years, months, days: rest, totalMonths } = ageParts(birthYmd, onYmd);
  if (totalMonths === 0) {
    if (days < 14) return en ? enUnit(days, 'day', 'days') : `${days} ${KA_UNITS.d}`;
    const weeks = Math.floor(days / 7);
    return en ? enUnit(weeks, 'week', 'weeks') : `${weeks} ${KA_UNITS.w}`;
  }
  if (years === 0) {
    if (rest === 0) return en ? enUnit(months, 'month', 'months') : `${months} ${KA_UNITS.m}`;
    return en ? `${enUnit(months, 'month', 'months')} ${enUnit(rest, 'day', 'days')}` : `${months} ${KA_UNITS.m} და ${rest} ${KA_UNITS.d}`;
  }
  if (years < 6 && months > 0) {
    return en ? `${enUnit(years, 'year', 'years')} ${enUnit(months, 'month', 'months')}` : `${years} ${KA_UNITS.y} და ${months} ${KA_UNITS.m}`;
  }
  return en ? enUnit(years, 'year', 'years') : `${years} ${KA_UNITS.y}`;
}

/** Stage keys drive the guide, feeding and the hero copy. */
export function ageStage(ageDaysValue) {
  if (ageDaysValue < 28) return 'newborn';
  if (ageDaysValue < 183) return 'infant_0_6';
  if (ageDaysValue < 365) return 'infant_6_12';
  if (ageDaysValue < 365 * 3) return 'toddler';
  if (ageDaysValue < 365 * 6) return 'preschool';
  if (ageDaysValue < 365 * 12) return 'school';
  return 'teen';
}
