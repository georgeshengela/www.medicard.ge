/** Drop OS last-known fixes so a Tbilisi cache cannot overwrite live Liège. */
export const MAX_LOCATION_FIX_AGE_MS = 75_000;

export type LocationFixSample = {
  lat: number;
  lng: number;
  accuracy: number | null;
  fixAt: number;
};

export function isFreshLocationTimestamp(
  timestamp: number | null | undefined,
  now = Date.now(),
  maxAgeMs = MAX_LOCATION_FIX_AGE_MS,
): boolean {
  if (!Number.isFinite(timestamp)) return false;
  const age = now - Number(timestamp);
  if (age < 0) return true;
  return age <= maxAgeMs;
}

/** Rough Georgia bounding box so a Tbilisi last-known cannot win while abroad. */
export function isInGeorgiaBox(lat: number, lng: number): boolean {
  return lat >= 41 && lat <= 43.7 && lng >= 39.5 && lng <= 46.8;
}

export function isCachedCaucasusFix(
  lat: number,
  lng: number,
  timeZone: string | null | undefined,
): boolean {
  if (!isInGeorgiaBox(lat, lng)) return false;
  const tz = String(timeZone || '');
  if (!tz) return false;
  if (tz === 'Asia/Tbilisi' || tz === 'Asia/Yerevan' || tz === 'Asia/Baku') return false;
  return /^(Europe|America|Africa|Australia|Pacific)\//.test(tz);
}

export function coordsAgreeWithDeviceTimezone(
  lat: number,
  lng: number,
  timeZone: string | null | undefined,
): boolean {
  return !isCachedCaucasusFix(lat, lng, timeZone);
}

/**
 * If the OS emits both last-known Tbilisi and live Liège, keep Liège.
 * A lone Tbilisi sample is dropped when the phone timezone is already in Europe.
 */
export function pickLiveLocationFix(
  candidates: LocationFixSample[],
  timeZone: string | null | undefined,
  now = Date.now(),
): LocationFixSample | null {
  const fresh = candidates.filter(
    (item) =>
      Number.isFinite(item.lat) &&
      Number.isFinite(item.lng) &&
      isFreshLocationTimestamp(item.fixAt, now),
  );
  const abroad = fresh.filter((item) => !isInGeorgiaBox(item.lat, item.lng));
  const pool = abroad.length
    ? abroad
    : fresh.filter((item) => coordsAgreeWithDeviceTimezone(item.lat, item.lng, timeZone));
  if (!pool.length) return null;
  return [...pool].sort((a, b) => {
    const acc = (a.accuracy ?? 9999) - (b.accuracy ?? 9999);
    if (acc !== 0) return acc;
    return b.fixAt - a.fixAt;
  })[0];
}
