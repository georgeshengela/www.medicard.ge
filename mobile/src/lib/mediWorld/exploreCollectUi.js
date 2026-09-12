const DONE = new Set(['SPARK_COLLECTED', 'SPARK_ALREADY_COLLECTED']);

export function isExploreCollectSuccess(outcome) {
  return DONE.has(String(outcome || ''));
}

export function applyExploreCollectResult(place, result) {
  if (!place) return place;
  if (!isExploreCollectSuccess(result?.outcome)) return place;
  if (!place.spark) return place;
  return { ...place, spark: { ...place.spark, collected: true } };
}

export function isExploreCollectLocked({
  spark,
  outcome,
  verifying = false,
  offline = false,
  denied = false,
  approximate = false,
  motorized = false,
} = {}) {
  if (verifying) return true;
  if (offline || denied || approximate || motorized) return true;
  if (!spark) return true;
  if (spark.collected) return true;
  if (isExploreCollectSuccess(outcome)) return true;
  return false;
}
