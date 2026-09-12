export function civilPeriodKey(timeZone?: string, now = new Date()): string {
  const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: '2-digit', day: '2-digit' };
  try {
    return new Intl.DateTimeFormat('en-CA', { ...options, timeZone: timeZone || 'UTC' }).format(now);
  } catch {
    return new Intl.DateTimeFormat('en-CA', options).format(now);
  }
}

export function isAdventureCacheExpired(
  adventure: { periodKey?: string; timezone?: string } | null | undefined,
  now = new Date(),
): boolean {
  if (!adventure?.periodKey) return false;
  return adventure.periodKey !== civilPeriodKey(adventure.timezone, now);
}
