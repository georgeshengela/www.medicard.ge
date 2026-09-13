export const EXPLORE_GRID = 0.05;
export const COLLECTION_RADIUS_M = 75;
export const ACCURACY_MAX_M = 50;
export const MOTORIZED_MPS = 7;

export function coarseAreaKey(latitude: number, longitude: number) {
  const glat = Math.floor(Number(latitude) / EXPLORE_GRID) * EXPLORE_GRID;
  const glng = Math.floor(Number(longitude) / EXPLORE_GRID) * EXPLORE_GRID;
  return `g${glat.toFixed(2)}_${glng.toFixed(2)}`;
}

export function isValidLatitude(value: number) {
  return Number.isFinite(value) && value >= -90 && value <= 90;
}

export function isValidLongitude(value: number) {
  return Number.isFinite(value) && value >= -180 && value <= 180;
}

export function geodesicMeters(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
) {
  const EARTH_R = 6371008.8;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const la1 = toRad(a.latitude);
  const la2 = toRad(b.latitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function formatExploreDistanceM(meters: number) {
  if (!Number.isFinite(meters) || meters < 0) return null;
  return Math.round(meters);
}
