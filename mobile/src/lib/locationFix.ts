/** Drop OS last-known fixes so a Tbilisi cache cannot overwrite live Liège. */
export const MAX_LOCATION_FIX_AGE_MS = 75_000;

export function isFreshLocationTimestamp(
  timestamp: number | null | undefined,
  now = Date.now(),
  maxAgeMs = MAX_LOCATION_FIX_AGE_MS,
): boolean {
  if (!Number.isFinite(timestamp)) return true;
  const age = now - Number(timestamp);
  if (age < 0) return true;
  return age <= maxAgeMs;
}
