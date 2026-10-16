/** Home / Expo display: local taps plus the stored daily total from the other device. */
export function mergeDayHydrationMl(localMl, serverMl) {
  const local = Math.max(0, Math.round(Number(localMl) || 0));
  if (serverMl == null || !Number.isFinite(Number(serverMl))) return local;
  return Math.max(local, Math.max(0, Math.round(Number(serverMl))));
}

/**
 * The app's own write reached the server: its stored day total moved by the same amount. Without this a
 * tap did not move the number when the server already had more water that day (Medi chat, web, Apple
 * Health), because the shown value is max(local taps, stored total). A day with no stored total stays
 * without one (local taps alone are shown), and a read that began after the write (`serverAt` later than
 * `startedAt`) may already contain it, so it is never counted twice.
 */
export function serverTotalsAfterOwnWrite(serverByDate, serverAt, { date, deltaMl, startedAt }) {
  if (!(Number(serverAt) <= Number(startedAt))) return serverByDate;
  const current = serverByDate?.[date];
  if (current == null || !Number.isFinite(Number(current))) return serverByDate;
  const delta = Math.round(Number(deltaMl) || 0);
  if (!delta) return serverByDate;
  return { ...serverByDate, [date]: Math.max(0, Math.round(Number(current)) + delta) };
}

/** Days of the Monday-first `week` up to and including `today`. */
function daysSoFar(week, today) {
  return week.filter((date) => date <= today).length;
}

/** „კვირის საშუალო“: the average per day of this week so far (Monday through today), not the week's sum. */
export function weekSoFarAverageMl(weekTotals, week, today) {
  const days = daysSoFar(week, today);
  if (!days) return 0;
  return Math.round(weekTotals.slice(0, days).reduce((a, b) => a + b, 0) / days);
}

/**
 * Week over week on equal footing: this week so far against the same days of last week (a Monday
 * morning against a whole last week always read as a big drop).
 */
export function weekSoFarSums(weekTotals, lastWeekTotals, week, today) {
  const days = daysSoFar(week, today);
  const sum = (list) => list.slice(0, days).reduce((a, b) => a + b, 0);
  return { current: sum(weekTotals), previous: sum(lastWeekTotals) };
}
