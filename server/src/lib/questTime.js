import { mondayOfWeek } from './checkIn.js';
import { QUEST_ECONOMY } from './questEconomy.js';

/**
 * Quest calendar helpers. Period keys are produced ONLY here.
 *
 * Daily periodKey:  `YYYY-MM-DD` in the user's effective IANA timezone
 * Weekly periodKey: ISO `YYYY-Www` (Monday 00:00 – Sunday 23:59:59.999 local)
 *
 * Asia/Tbilisi is a legacy fallback only — never the permanent Quest rule.
 */
export const QUEST_TIMEZONE_FALLBACK = 'Asia/Tbilisi';
/** @deprecated Use QUEST_TIMEZONE_FALLBACK / getEffectiveQuestTimezone */
export const QUEST_TIMEZONE = QUEST_TIMEZONE_FALLBACK;

const IANA_LIST = typeof Intl.supportedValuesOf === 'function' ? new Set(Intl.supportedValuesOf('timeZone')) : null;

export function isValidIanaTimezone(value) {
  if (typeof value !== 'string') return false;
  const tz = value.trim();
  if (!tz || tz.length > 64) return false;
  if (IANA_LIST) return IANA_LIST.has(tz);
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export function normalizeQuestTimezone(value) {
  const tz = typeof value === 'string' ? value.trim() : '';
  return isValidIanaTimezone(tz) ? tz : null;
}

/**
 * Resolution:
 * 1. explicit current device timezone (options.deviceTimezone)
 * 2. Quest profile timezone
 * 3. existing user.timezone if present
 * 4. Asia/Tbilisi legacy fallback
 *
 * Never derive timezone from longitude.
 */
export function getEffectiveQuestTimezone(user = {}, options = {}) {
  const candidates = [
    options.deviceTimezone,
    options.timezone,
    options.profileTimezone,
    user?.questProfile?.timezone,
    user?.timezone,
  ];
  for (const candidate of candidates) {
    const ok = normalizeQuestTimezone(candidate);
    if (ok) return ok;
  }
  return QUEST_TIMEZONE_FALLBACK;
}

export function addDaysYmd(ymd, days) {
  const date = new Date(`${ymd}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function questYmd(now = new Date(), timeZone = QUEST_TIMEZONE_FALLBACK) {
  const tz = normalizeQuestTimezone(timeZone) || QUEST_TIMEZONE_FALLBACK;
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(now);
}

/** Weekday of a calendar `YYYY-MM-DD` (0=Sun … 6=Sat). */
export function dowFromYmd(ymd) {
  return new Date(`${ymd}T00:00:00.000Z`).getUTCDay();
}

function tzOffsetMs(date, timeZone) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
      .formatToParts(date)
      .map((part) => [part.type, part.value]),
  );
  const hour = Number(parts.hour) === 24 ? 0 : Number(parts.hour);
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    hour,
    Number(parts.minute),
    Number(parts.second),
  );
  return asUtc - date.getTime();
}

export function startOfLocalDay(ymd, timeZone = QUEST_TIMEZONE_FALLBACK) {
  const tz = normalizeQuestTimezone(timeZone) || QUEST_TIMEZONE_FALLBACK;
  const [year, month, day] = ymd.split('-').map(Number);
  const localAsUtc = Date.UTC(year, month - 1, day, 0, 0, 0);
  let guess = new Date(localAsUtc);
  let offset = tzOffsetMs(guess, tz);
  guess = new Date(localAsUtc - offset);
  offset = tzOffsetMs(guess, tz);
  return new Date(localAsUtc - offset);
}

export function endOfLocalDay(ymd, timeZone = QUEST_TIMEZONE_FALLBACK) {
  return new Date(startOfLocalDay(addDaysYmd(ymd, 1), timeZone).getTime() - 1);
}

/** ISO week key `YYYY-Www` for a local calendar date (Monday-first). */
export function isoWeekKey(ymd) {
  const monday = mondayOfWeek(ymd);
  const thursday = addDaysYmd(monday, 3);
  const weekYear = Number(thursday.slice(0, 4));
  const week1Monday = mondayOfWeek(`${weekYear}-01-04`);
  const week =
    Math.round(
      (Date.parse(`${monday}T00:00:00.000Z`) - Date.parse(`${week1Monday}T00:00:00.000Z`)) /
        86_400_000 /
        7,
    ) + 1;
  return `${weekYear}-W${String(week).padStart(2, '0')}`;
}

export function mondayOfIsoWeek(weekKey) {
  const match = /^(\d{4})-W(\d{2})$/.exec(String(weekKey || ''));
  if (!match) return null;
  const year = Number(match[1]);
  const week = Number(match[2]);
  const week1Monday = mondayOfWeek(`${year}-01-04`);
  return addDaysYmd(week1Monday, (week - 1) * 7);
}

export function daysInIsoWeek(weekKey) {
  const monday = mondayOfIsoWeek(weekKey);
  if (!monday) return [];
  return Array.from({ length: 7 }, (_, i) => addDaysYmd(monday, i));
}

export function dailyPeriodKey(now = new Date(), timeZone = QUEST_TIMEZONE_FALLBACK) {
  return questYmd(now, timeZone);
}

export function weeklyPeriodKey(now = new Date(), timeZone = QUEST_TIMEZONE_FALLBACK) {
  return isoWeekKey(questYmd(now, timeZone));
}

export function expiresAtForPeriod(cadence, periodKey, timeZone = QUEST_TIMEZONE_FALLBACK) {
  if (cadence === 'WEEKLY') {
    const monday = mondayOfIsoWeek(periodKey);
    const sunday = monday ? addDaysYmd(monday, 6) : periodKey;
    return endOfLocalDay(sunday, timeZone);
  }
  return endOfLocalDay(periodKey, timeZone);
}

export function resolveQuestClock(now = new Date(), timeZone = QUEST_TIMEZONE_FALLBACK) {
  const tz = normalizeQuestTimezone(timeZone) || QUEST_TIMEZONE_FALLBACK;
  const today = questYmd(now, tz);
  return {
    timezone: tz,
    today,
    week: isoWeekKey(today),
    now,
  };
}

/**
 * Timezone-hop guard.
 *
 * Unique (userId, templateId, periodKey) already blocks the same local date twice.
 * This extra guard stops farming extra "today" sets by flipping IANA zones:
 *
 * - same periodKey → always allowed (idempotent refresh)
 * - earlier periodKey within 20h → denied (westbound hop)
 * - exact last+1, local day has started, ≥12h since last assign → allowed
 * - any other jump → allowed only after 20h and once that local day has started
 *
 * Existing completed periodKeys are never rewritten.
 */
export function canAssignNewDailyPeriod(profile, periodKey, now, timeZone) {
  const last = profile?.lastDailyAssignPeriodKey;
  if (!last || last === periodKey) return true;
  const lastAt = profile.lastDailyAssignAt ? new Date(profile.lastDailyAssignAt) : null;
  const elapsed = lastAt ? now.getTime() - lastAt.getTime() : Number.POSITIVE_INFINITY;
  const dayHasStarted = now.getTime() >= startOfLocalDay(periodKey, timeZone).getTime();
  if (!dayHasStarted) return false;
  if (periodKey < last && elapsed < QUEST_ECONOMY.dailyHopGuardMs) return false;
  if (periodKey === addDaysYmd(last, 1)) {
    return elapsed >= QUEST_ECONOMY.dailySuccessorGuardMs;
  }
  return elapsed >= QUEST_ECONOMY.dailyHopGuardMs;
}
