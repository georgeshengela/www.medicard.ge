const EARTH_R = 6371008.8;
const GRID = 0.05;
const CATEGORIES = ['movement', 'hydration', 'calm', 'care', 'connection'];

export const EXPLORE_RULESET_ID = 'medi-world-explore-v1';
export const COLLECTION_RADIUS_M = 75;
export const ACCURACY_MAX_M = 50;
export const FRESHNESS_MS = 30_000;
export const DAILY_COLLECTION_CAP = 5;
export const SPAWN_WINDOW_MS = 6 * 60 * 60 * 1000;
export const MOTORIZED_MPS = 7;
export const AREA_RESULT_LIMIT = 40;

export const ALLOWED_PLACE_TYPES = Object.freeze([
  'park',
  'public_square',
  'public_garden',
  'promenade',
  'trail_entrance',
  'community_space',
]);

export const FORBIDDEN_PLACE_TYPES = Object.freeze([
  'home',
  'school',
  'children',
  'hospital',
  'clinic',
  'pharmacy',
  'religious',
  'police',
  'military',
  'road_shoulder',
  'railway',
  'construction',
  'abandoned',
  'private_interior',
  'sensitive_health',
]);

const toRad = (d) => (d * Math.PI) / 180;
const toDeg = (r) => (r * 180) / Math.PI;

export function geodesicMeters(a, b) {
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const la1 = toRad(a.latitude);
  const la2 = toRad(b.latitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function destinationPoint(origin, bearingDeg, distM) {
  const br = toRad(bearingDeg);
  const la1 = toRad(origin.latitude);
  const lo1 = toRad(origin.longitude);
  const ad = distM / EARTH_R;
  const la2 = Math.asin(Math.sin(la1) * Math.cos(ad) + Math.cos(la1) * Math.sin(ad) * Math.cos(br));
  const lo2 =
    lo1 + Math.atan2(Math.sin(br) * Math.sin(ad) * Math.cos(la1), Math.cos(ad) - Math.sin(la1) * Math.sin(la2));
  return { latitude: toDeg(la2), longitude: ((toDeg(lo2) + 540) % 360) - 180 };
}

export function coarseAreaKey(latitude, longitude) {
  const glat = Math.floor(Number(latitude) / GRID) * GRID;
  const glng = Math.floor(Number(longitude) / GRID) * GRID;
  return `g${glat.toFixed(2)}_${glng.toFixed(2)}`;
}

export function isValidLatitude(value) {
  return Number.isFinite(value) && value >= -90 && value <= 90;
}

export function isValidLongitude(value) {
  return Number.isFinite(value) && value >= -180 && value <= 180;
}

export function spawnWindow(now = new Date()) {
  const ms = now.getTime();
  const start = Math.floor(ms / SPAWN_WINDOW_MS) * SPAWN_WINDOW_MS;
  return {
    windowKey: String(start),
    startsAt: new Date(start),
    expiresAt: new Date(start + SPAWN_WINDOW_MS),
  };
}

export function fnv1a(text) {
  let hash = 2166136261;
  const value = String(text);
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function categoryForPlaceWindow(placeId, windowKey) {
  return CATEGORIES[fnv1a(`${placeId}:${windowKey}`) % CATEGORIES.length];
}

export function spawnIdFor(placeId, windowKey) {
  return `cs:${placeId}:${windowKey}`;
}

export function distanceBand(meters) {
  if (!Number.isFinite(meters)) return 'unknown';
  if (meters <= 25) return 'within_25m';
  if (meters <= COLLECTION_RADIUS_M) return 'within_75m';
  return 'beyond';
}

export function accuracyBand(meters) {
  if (!Number.isFinite(meters)) return 'unknown';
  if (meters <= 15) return 'fine';
  if (meters <= ACCURACY_MAX_M) return 'ok';
  return 'poor';
}

export function isAllowedPlaceType(type) {
  return ALLOWED_PLACE_TYPES.includes(type) && !FORBIDDEN_PLACE_TYPES.includes(type);
}
