/**
 * Cycle civil-date clock.
 * Stored logs stay YYYY-MM-DD forever. Only "today" uses a timezone.
 */

import { todayInTimeZone } from './cycle.js';
import { getEffectiveQuestTimezone, isValidIanaTimezone } from './questTime.js';

export const CYCLE_TIMEZONE_FALLBACK = 'Asia/Tbilisi';

export function clientTimezoneFromReq(req) {
  const header = req?.headers?.['x-client-timezone'] ?? req?.headers?.['X-Client-Timezone'];
  const query = req?.query?.timezone;
  const raw = (typeof header === 'string' && header) || (typeof query === 'string' && query) || '';
  return isValidIanaTimezone(raw) ? raw.trim() : null;
}

/**
 * Precedence (no schema migration):
 * 1. current device timezone (request header/query)
 * 2. stored Quest profile timezone
 * 3. Asia/Tbilisi fallback
 *
 * Travel does not rewrite historical YYYY-MM-DD rows.
 */
export function resolveCycleTimezone({ deviceTimezone, storedTimezone } = {}) {
  return getEffectiveQuestTimezone(
    { questProfile: { timezone: storedTimezone || null } },
    { deviceTimezone: deviceTimezone || null },
  );
}

export function cycleTodayKey(timezone, now = new Date()) {
  const tz = isValidIanaTimezone(timezone) ? timezone : CYCLE_TIMEZONE_FALLBACK;
  return todayInTimeZone(tz, now);
}

export function resolveCycleClock({ deviceTimezone, storedTimezone, now = new Date() } = {}) {
  const timezone = resolveCycleTimezone({ deviceTimezone, storedTimezone });
  return {
    timezone,
    today: cycleTodayKey(timezone, now),
  };
}

/** YYYY-MM-DD round-trip: never shift a stored civil date. */
export function assertStableCivilDate(key) {
  if (typeof key !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(key)) return null;
  return key;
}
