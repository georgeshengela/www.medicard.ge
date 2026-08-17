/** Billing period helpers — monthly subscriptions use a 30-day window; FREE uses calendar month. */

export const TIMEZONE = 'Asia/Tbilisi';
const TBILISI_OFFSET = '+04:00';
export const SUBSCRIPTION_DAYS = 30;

export function calendarMonthKey(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .format(now)
    .slice(0, 7);
}

export function msUntilCalendarMonthReset(now = new Date()) {
  const key = calendarMonthKey(now);
  const [year, month] = key.split('-').map(Number);
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextStart = new Date(
    `${nextYear}-${String(nextMonth).padStart(2, '0')}-01T00:00:00${TBILISI_OFFSET}`,
  );
  return Math.max(0, nextStart.getTime() - now.getTime());
}

export function buildSubscriptionDates(from = new Date()) {
  const packageStartedAt = new Date(from);
  const packageExpiresAt = new Date(packageStartedAt);
  packageExpiresAt.setUTCDate(packageExpiresAt.getUTCDate() + SUBSCRIPTION_DAYS);
  return { packageStartedAt, packageExpiresAt };
}

export function renewSubscriptionDates(user, from = new Date()) {
  const anchor =
    user.packageExpiresAt && user.packageExpiresAt.getTime() > from.getTime()
      ? user.packageExpiresAt
      : from;
  return buildSubscriptionDates(anchor);
}

/**
 * @param {import('@prisma/client').User & { package?: import('@prisma/client').Package | null }} user
 * @param {import('@prisma/client').Package | null | undefined} effectivePackage
 */
export function getBillingPeriod(user, effectivePackage) {
  const now = new Date();
  const code = effectivePackage?.code ?? 'FREE';
  const hasActivePaid =
    code !== 'FREE' &&
    user.packageStartedAt &&
    user.packageExpiresAt &&
    user.packageExpiresAt.getTime() > now.getTime();

  if (hasActivePaid) {
    const start = user.packageStartedAt;
    const end = user.packageExpiresAt;
    const startKey = start.toISOString().slice(0, 10);
    const endKey = end.toISOString().slice(0, 10);
    return {
      key: `sub:${startKey}:${endKey}`,
      type: 'subscription',
      label: 'გამოწერის პერიოდი',
      start,
      end,
      resetsInMs: Math.max(0, end.getTime() - now.getTime()),
    };
  }

  const monthKey = calendarMonthKey(now);
  const [year, month] = monthKey.split('-').map(Number);
  const start = new Date(`${monthKey}-01T00:00:00${TBILISI_OFFSET}`);
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const end = new Date(`${nextYear}-${String(nextMonth).padStart(2, '0')}-01T00:00:00${TBILISI_OFFSET}`);

  return {
    key: `cal:${monthKey}`,
    type: 'calendar',
    label: 'კალენდარული თვე',
    start,
    end,
    resetsInMs: msUntilCalendarMonthReset(now),
  };
}
