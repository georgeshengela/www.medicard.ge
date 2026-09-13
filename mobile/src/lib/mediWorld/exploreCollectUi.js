const DONE = new Set(['SPARK_COLLECTED', 'SPARK_ALREADY_COLLECTED']);
const GONE = new Set(['SPARK_EXPIRED', 'SPARK_PLACE_UNAVAILABLE']);

function sparkExpired(spark, nowMs = Date.now()) {
  if (!spark || spark.expiresAt == null) return false;
  const exp = Date.parse(spark.expiresAt);
  return Number.isFinite(exp) && exp <= Number(nowMs);
}

export function isExploreCollectSuccess(outcome) {
  return DONE.has(String(outcome || ''));
}

export function applyExploreCollectResult(place, result) {
  if (!place) return place;
  if (!isExploreCollectSuccess(result?.outcome)) return place;
  if (!place.spark) return place;
  return { ...place, spark: { ...place.spark, collected: true } };
}

export function applyAuthoritativeCollectOutcome(place, result) {
  if (!place) return place;
  const outcome = String(result?.outcome || '');
  if (GONE.has(outcome)) {
    if (!place.spark) return place;
    return { ...place, spark: null };
  }
  return applyExploreCollectResult(place, result);
}

/**
 * @param {{
 *   spark?: { collected?: boolean, expiresAt?: string } | null,
 *   outcome?: string | null,
 *   verifying?: boolean,
 * }} [opts]
 */
export function shouldOfferExploreCollect({ spark, outcome, verifying = false } = {}) {
  if (verifying) return true;
  if (GONE.has(String(outcome || ''))) return false;
  return Boolean(spark);
}

/** @param {string | null | undefined} outcome */
export function shouldRetryExpiredCollect(outcome) {
  return String(outcome || '') !== 'SPARK_EXPIRED';
}

/**
 * @param {{
 *   spark?: { collected?: boolean, expiresAt?: string } | null,
 *   outcome?: string | null,
 *   verifying?: boolean,
 *   offline?: boolean,
 *   denied?: boolean,
 *   approximate?: boolean,
 *   motorized?: boolean,
 *   snapshotOnly?: boolean,
 *   noLivePosition?: boolean,
 *   nowMs?: number,
 * }} [opts]
 */
export function isExploreCollectLocked({
  spark,
  outcome,
  verifying = false,
  offline = false,
  denied = false,
  approximate = false,
  motorized = false,
  snapshotOnly = false,
  noLivePosition = false,
  nowMs = Date.now(),
} = {}) {
  if (verifying) return true;
  if (offline || denied || approximate || motorized || snapshotOnly || noLivePosition) return true;
  if (!spark) return true;
  if (spark.collected) return true;
  if (sparkExpired(spark, nowMs)) return true;
  if (isExploreCollectSuccess(outcome)) return true;
  if (GONE.has(String(outcome || ''))) return true;
  return false;
}
