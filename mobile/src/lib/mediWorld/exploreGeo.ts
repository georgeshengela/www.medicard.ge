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
