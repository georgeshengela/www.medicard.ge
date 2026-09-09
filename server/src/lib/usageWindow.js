import { addDaysYmd, tbilisiMidnight, tbilisiYmd, TBILISI_OFFSET } from './adminAnalyticsRange.js';

export const ROLLING_DAILY_KEY = 'roll:daily';
export const DAY_MS = 86_400_000;
export const TBILISI_TZ = 'Asia/Tbilisi';
/** Default quiet window in Georgia — same 22:00–08:00 as Medi companion. */
export const QUIET_START_MIN = 22 * 60;
export const QUIET_END_MIN = 8 * 60 + 15;

export function toDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function tbilisiHm(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TBILISI_TZ,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const hour = Number(parts.find((part) => part.type === 'hour')?.value);
  const minute = Number(parts.find((part) => part.type === 'minute')?.value);
  return {
    hour: Number.isFinite(hour) ? hour : 0,
    minute: Number.isFinite(minute) ? minute : 0,
  };
}

export function tbilisiAt(ymd, hour, minute) {
  return new Date(
    `${ymd}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00.000${TBILISI_OFFSET}`,
  );
}

export function nextTbilisiMidnight(now = new Date()) {
  return tbilisiMidnight(addDaysYmd(tbilisiYmd(now), 1));
}

export function isTbilisiQuiet(now = new Date()) {
  const { hour, minute } = tbilisiHm(now);
  const mins = hour * 60 + minute;
  if (QUIET_START_MIN === QUIET_END_MIN) return false;
  if (QUIET_START_MIN < QUIET_END_MIN) return mins >= QUIET_START_MIN && mins < QUIET_END_MIN;
  return mins >= QUIET_START_MIN || mins < QUIET_END_MIN;
}

/** Move a fire time out of Tbilisi quiet hours to 08:15. Daytime timestamps stay exact. */
export function bumpOutOfQuietTbilisi(date) {
  const instant = toDate(date);
  if (!instant) return null;
  if (!isTbilisiQuiet(instant)) return new Date(instant);
  const ymd = tbilisiYmd(instant);
  const { hour, minute } = tbilisiHm(instant);
  const mins = hour * 60 + minute;
  if (mins < QUIET_END_MIN) return tbilisiAt(ymd, 8, 15);
  return tbilisiAt(addDaysYmd(ymd, 1), 8, 15);
}

export function inferResetKind(resetAt) {
  const instant = toDate(resetAt);
  if (!instant) return null;
  const { hour, minute } = tbilisiHm(instant);
  return hour === 0 && minute === 0 ? 'calendar' : 'lock';
}

export function quotaResetKey(resetAt, kind = 'calendar') {
  const instant = toDate(resetAt);
  if (!instant) return null;
  if (kind === 'lock') return `lock:${instant.toISOString()}`;
  return `cal:${tbilisiYmd(instant)}`;
}

/**
 * @param {{ count?: number, resetAt?: Date | string | null, notifyAt?: Date | string | null }} row
 * @param {number} limit
 * @param {Date} now
 */
export function applyExpiration(row, limit, now = new Date()) {
  const count = Number(row?.count ?? 0);
  const resetAt = toDate(row?.resetAt);
  const notifyAt = toDate(row?.notifyAt);
  const finite = Number.isFinite(limit);

  if (finite && count >= limit && resetAt && resetAt.getTime() > now.getTime()) {
    return {
      count,
      resetAt,
      notifyAt,
      expired: false,
      stale: false,
      previousCount: count,
      resetKind: 'lock',
      resetKey: quotaResetKey(resetAt, 'lock'),
    };
  }

  if (resetAt && resetAt.getTime() <= now.getTime() && count > 0) {
    const kind = finite && count >= limit ? 'lock' : 'calendar';
    const pending = notifyAt && notifyAt.getTime() > now.getTime() ? notifyAt : bumpOutOfQuietTbilisi(now);
    return {
      count: 0,
      resetAt,
      notifyAt: pending,
      expired: true,
      stale: false,
      previousCount: count,
      resetKind: kind,
      resetKey: quotaResetKey(resetAt, kind),
    };
  }

  if (!resetAt && count > 0 && (!finite || count < limit)) {
    return {
      count: 0,
      resetAt: null,
      notifyAt: null,
      expired: true,
      stale: true,
      previousCount: count,
      resetKind: 'calendar',
      resetKey: `stale:${tbilisiYmd(now)}`,
    };
  }

  const idleKind = finite && count >= limit ? 'lock' : inferResetKind(resetAt);
  return {
    count,
    resetAt,
    notifyAt,
    expired: false,
    stale: false,
    previousCount: count,
    resetKind: idleKind,
    resetKey: resetAt ? quotaResetKey(resetAt, idleKind || 'calendar') : null,
  };
}

/**
 * @param {{ count?: number, resetAt?: Date | string | null, notifyAt?: Date | string | null }} row
 * @param {number} limit
 * @param {Date} now
 */
export function applyConsume(row, limit, now = new Date()) {
  const opened = applyExpiration(row, limit, now);
  const count = opened.count + 1;
  const hittingCap = Number.isFinite(limit) && count >= limit;
  const resetAt = hittingCap ? new Date(now.getTime() + DAY_MS) : nextTbilisiMidnight(now);
  const resetKind = hittingCap ? 'lock' : 'calendar';
  const pendingNotify = opened.notifyAt && opened.notifyAt.getTime() > now.getTime() ? opened.notifyAt : null;

  return {
    count,
    resetAt,
    notifyAt: pendingNotify || bumpOutOfQuietTbilisi(resetAt),
    expired: opened.expired,
    stale: opened.stale,
    previousCount: opened.previousCount,
    resetKind,
    resetKey: quotaResetKey(resetAt, resetKind),
  };
}

export function publicResetAt(row, limit) {
  const count = Number(row?.count ?? 0);
  const resetAt = toDate(row?.resetAt);
  if (!resetAt) return null;
  if (Number.isFinite(limit) && count >= limit) return resetAt;
  if (count > 0) return resetAt;
  return null;
}
