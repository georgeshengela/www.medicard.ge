/** Browse last-known may only hint the map inside the same freshness window as collect. */
export const EXPLORE_LAST_KNOWN_MAX_AGE_MS = 30_000;
export const EXPLORE_ACCURACY_MAX_M = 50;

/**
 * High-accuracy TTFF on this Android emulator was ~4s once GPS was actually requested.
 * Balanced never started GPS, so the old 8–12s races expired against a silent Fused provider.
 */
export const EXPLORE_BROWSE_TIMEOUT_MS = 15_000;
export const EXPLORE_COLLECT_TIMEOUT_MS = 15_000;
export const EXPLORE_FUTURE_SLACK_MS = 5_000;

export function shouldUseLastKnown(ageMs: number, maxAgeMs = EXPLORE_LAST_KNOWN_MAX_AGE_MS) {
  return Number.isFinite(ageMs) && ageMs >= 0 && ageMs <= maxAgeMs;
}

export function isCollectSampleFresh(timestamp: number, now = Date.now(), maxAgeMs = EXPLORE_LAST_KNOWN_MAX_AGE_MS) {
  if (!Number.isFinite(timestamp)) return false;
  if (timestamp > now + EXPLORE_FUTURE_SLACK_MS) return false;
  return now - timestamp <= maxAgeMs;
}

export function isCollectSampleAccurate(accuracy: number | null, maxM = EXPLORE_ACCURACY_MAX_M) {
  return accuracy != null && Number.isFinite(accuracy) && accuracy <= maxM;
}

export function redactExploreCoordinate(value: number) {
  if (!Number.isFinite(value)) return null;
  return Math.round(value * 10) / 10;
}
