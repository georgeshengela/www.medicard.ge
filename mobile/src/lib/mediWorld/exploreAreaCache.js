'use strict';

/**
 * Explore nearby-area cache policy.
 *
 * Two clocks, not one:
 * - fetchedAt age (`EXPLORE_AREA_CACHE_MAX_MS`) is elapsed wall time. It only
 *   decides whether a snapshot may still be *browsed*.
 * - Each Spark expires on its own `expiresAt` (UTC 6-hour spawn buckets).
 *   An expired Spark is never collectible, even inside a still-fresh snapshot.
 *
 * A snapshot is previously loaded nearby data, never current live nearby.
 * Cache never stores user coordinates or movement history.
 */

const SPAWN_WINDOW_MS = 6 * 60 * 60 * 1000;
/** Elapsed age since fetchedAt. Independent of UTC spawn-window alignment. */
const EXPLORE_AREA_CACHE_MAX_MS = 6 * 60 * 60 * 1000;
const EXPLORE_AREA_CACHE_MAX_RATIONALE =
  'fetchedAt max age is elapsed wall time for browsing a snapshot (6h so leftover pins cannot linger indefinitely). It is not the UTC Spark spawn window. Sparks expire on expiresAt even when the snapshot is still within cache max age.';

function sparkExpiresAtMs(spark) {
  if (!spark || spark.expiresAt == null) return null;
  const ms = Date.parse(spark.expiresAt);
  return Number.isFinite(ms) ? ms : null;
}

function isSparkExpired(spark, nowMs = Date.now()) {
  const exp = sparkExpiresAtMs(spark);
  if (exp == null) return false;
  return exp <= Number(nowMs);
}

function spawnWindow(nowMs = Date.now()) {
  const start = Math.floor(Number(nowMs) / SPAWN_WINDOW_MS) * SPAWN_WINDOW_MS;
  return {
    windowKey: String(start),
    startsAt: start,
    expiresAt: start + SPAWN_WINDOW_MS,
  };
}

function applyExpiredSparks(places, nowMs = Date.now()) {
  if (!Array.isArray(places)) return [];
  return places.map((place) => {
    if (!place || !place.spark) return place;
    if (!isSparkExpired(place.spark, nowMs)) return place;
    return { ...place, spark: null };
  });
}

function stripSpark(place) {
  if (!place || !place.spark) return place;
  return { ...place, spark: null };
}

function placesHaveExpiredSpark(places, nowMs = Date.now()) {
  return (Array.isArray(places) ? places : []).some((place) => isSparkExpired(place?.spark, nowMs));
}

function nextKnownSparkExpiryMs(places, nowMs = Date.now()) {
  const now = Number(nowMs);
  let next = null;
  for (const place of Array.isArray(places) ? places : []) {
    const exp = sparkExpiresAtMs(place?.spark);
    if (exp == null || exp <= now) continue;
    if (next == null || exp < next) next = exp;
  }
  return next;
}

function delayUntilSparkExpiry(expiresAtMs, nowMs = Date.now()) {
  const exp = Number(expiresAtMs);
  const now = Number(nowMs);
  if (!Number.isFinite(exp)) return null;
  if (exp <= now) return 0;
  return Math.min(exp - now, SPAWN_WINDOW_MS);
}

function applyKnownSparkExpiry(area, selected, nowMs = Date.now()) {
  const areaChanged = placesHaveExpiredSpark(area?.places, nowMs);
  const selectedExpired = isSparkExpired(selected?.spark, nowMs);
  if (!areaChanged && !selectedExpired) {
    return { changed: false, area, selected, selectedExpired: false };
  }
  return {
    changed: true,
    area: area ? { ...area, places: applyExpiredSparks(area.places, nowMs) } : area,
    selected: selectedExpired && selected ? { ...selected, spark: null } : selected,
    selectedExpired,
  };
}

function selectPlaceAfterRefresh(prev, livePlaces) {
  if (!prev) return null;
  const list = Array.isArray(livePlaces) ? livePlaces : [];
  return list.find((row) => row && row.id === prev.id) || null;
}

function shouldCommitExploreArea({
  startedGeneration,
  currentGeneration,
  startedOwner,
  currentOwner,
  startedCell,
  currentCell,
} = {}) {
  if (startedGeneration !== currentGeneration) return false;
  if (!startedOwner || !currentOwner || startedOwner !== currentOwner) return false;
  if (startedCell && currentCell && startedCell !== currentCell) return false;
  return true;
}

function emptyExploreArea(coarseAreaKey, extras = {}) {
  return {
    enabled: extras.enabled !== false,
    rulesetId: extras.rulesetId || 'medi-world-explore-v1',
    coarseAreaKey: String(coarseAreaKey || ''),
    stale: Boolean(extras.stale),
    snapshotOnly: Boolean(extras.snapshotOnly),
    places: [],
  };
}

function sanitizeCachedPlace(place) {
  if (!place || !place.id) return null;
  return {
    id: String(place.id),
    name: place.name,
    nameKa: place.nameKa,
    nameEn: place.nameEn,
    placeType: place.placeType,
    publicLat: place.publicLat,
    publicLng: place.publicLng,
    coarseAreaKey: place.coarseAreaKey,
    accessibility: place.accessibility,
    accessibilityNote: place.accessibilityNote ?? null,
    safeHoursPolicy: place.safeHoursPolicy ?? null,
    developmentFixture: Boolean(place.developmentFixture),
    spark: place.spark
      ? {
          spawnId: place.spark.spawnId,
          category: place.spark.category,
          locKey: place.spark.locKey,
          expiresAt: place.spark.expiresAt,
          collected: Boolean(place.spark.collected),
        }
      : null,
  };
}

function toPersistedExploreArea({ ownerId, fetchedAt, area, nowMs } = {}) {
  if (!ownerId || !area || !area.coarseAreaKey) return null;
  const at = Number(fetchedAt != null ? fetchedAt : nowMs);
  if (!Number.isFinite(at)) return null;
  const places = Array.isArray(area.places)
    ? area.places.map(sanitizeCachedPlace).filter(Boolean)
    : [];
  return {
    ownerId: String(ownerId),
    fetchedAt: at,
    enabled: area.enabled !== false,
    rulesetId: area.rulesetId || 'medi-world-explore-v1',
    coarseAreaKey: String(area.coarseAreaKey),
    places,
  };
}

function fromPersistedExploreArea(parsed) {
  if (!parsed || typeof parsed !== 'object') return null;
  if (!parsed.ownerId || !parsed.coarseAreaKey || !Array.isArray(parsed.places)) return null;
  if (!Number.isFinite(Number(parsed.fetchedAt))) return null;
  return {
    ownerId: String(parsed.ownerId),
    fetchedAt: Number(parsed.fetchedAt),
    enabled: parsed.enabled !== false,
    rulesetId: parsed.rulesetId || 'medi-world-explore-v1',
    coarseAreaKey: String(parsed.coarseAreaKey),
    places: parsed.places,
  };
}

function isExploreAreaCacheFresh(record, nowMs = Date.now()) {
  if (!record) return false;
  const age = Number(nowMs) - Number(record.fetchedAt);
  return Number.isFinite(age) && age >= 0 && age <= EXPLORE_AREA_CACHE_MAX_MS;
}

/**
 * Cache is never "current nearby". Matching owner+freshness snapshots may be
 * shown as previously loaded. Another cell's pins are never used.
 */
function resolveExploreAreaCacheUse(record, query = {}) {
  const ownerId = String(query.ownerId || '');
  const liveCell = query.liveCell ? String(query.liveCell) : null;
  const nowMs = Number(query.nowMs || Date.now());
  const denied = Boolean(query.denied);

  if (!record || !ownerId || record.ownerId !== ownerId) {
    return { use: false, asCurrent: false, snapshotOnly: false, area: null, reason: 'owner' };
  }
  if (!isExploreAreaCacheFresh(record, nowMs)) {
    return { use: false, asCurrent: false, snapshotOnly: false, area: null, reason: 'freshness' };
  }
  if (liveCell && record.coarseAreaKey !== liveCell) {
    return { use: false, asCurrent: false, snapshotOnly: false, area: null, reason: 'cell-mismatch' };
  }

  const places = applyExpiredSparks(record.places, nowMs);
  const area = {
    enabled: record.enabled !== false,
    rulesetId: record.rulesetId,
    coarseAreaKey: record.coarseAreaKey,
    stale: true,
    snapshotOnly: true,
    places,
  };
  return {
    use: true,
    asCurrent: false,
    snapshotOnly: true,
    area,
    reason: denied ? 'denied-snapshot' : liveCell ? 'same-cell-snapshot' : 'snapshot',
  };
}

module.exports = {
  SPAWN_WINDOW_MS,
  EXPLORE_AREA_CACHE_MAX_MS,
  EXPLORE_AREA_CACHE_MAX_RATIONALE,
  sparkExpiresAtMs,
  isSparkExpired,
  spawnWindow,
  applyExpiredSparks,
  stripSpark,
  placesHaveExpiredSpark,
  nextKnownSparkExpiryMs,
  delayUntilSparkExpiry,
  applyKnownSparkExpiry,
  selectPlaceAfterRefresh,
  shouldCommitExploreArea,
  emptyExploreArea,
  toPersistedExploreArea,
  fromPersistedExploreArea,
  isExploreAreaCacheFresh,
  resolveExploreAreaCacheUse,
};
