import { metersBetween } from './geoPlace.js';

export const PLACE_MOVE_METERS = 2000;
export const MAX_LOCATION_FIX_AGE_MS = 90_000;
export const IMPLAUSIBLE_JUMP_METERS = 200_000;
export const IMPLAUSIBLE_JUMP_MS = 15 * 60 * 1000;

export function isStaleLocationFixAt(fixAt, now = Date.now(), maxAgeMs = MAX_LOCATION_FIX_AGE_MS) {
  if (!Number.isFinite(fixAt)) return false;
  const age = now - Number(fixAt);
  if (age < 0) return false;
  return age > maxAgeMs;
}

export function didMoveFar(row, lat, lng) {
  if (!row || !Number.isFinite(row.lat) || !Number.isFinite(row.lng)) return false;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  return metersBetween({ lat: row.lat, lng: row.lng }, { lat, lng }) >= PLACE_MOVE_METERS;
}

export function isImplausibleJump(row, lat, lng, now = Date.now()) {
  if (!row || !Number.isFinite(row.lat) || !Number.isFinite(row.lng)) return false;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  const dist = metersBetween({ lat: row.lat, lng: row.lng }, { lat, lng });
  if (dist < IMPLAUSIBLE_JUMP_METERS) return false;
  if (!row.updatedAt) return false;
  const dtMs = now - new Date(row.updatedAt).getTime();
  if (!Number.isFinite(dtMs) || dtMs < 0) return true;
  return dtMs < IMPLAUSIBLE_JUMP_MS;
}

export function geocodeAppliesToRow(row, lat, lng) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (!row || !Number.isFinite(row.lat) || !Number.isFinite(row.lng)) return true;
  return metersBetween({ lat: row.lat, lng: row.lng }, { lat, lng }) < PLACE_MOVE_METERS;
}

export function resolveStoredPlace({ current = {}, geocoded = null, movedFar = false } = {}) {
  const geo = geocoded && typeof geocoded === 'object' ? geocoded : null;
  const hasGeo = Boolean(geo && (geo.countryCode || geo.cityKa));
  if (hasGeo && movedFar) {
    return {
      countryCode: geo.countryCode || null,
      countryKa: geo.countryKa || null,
      cityKa: geo.cityKa || null,
    };
  }
  if (hasGeo) {
    return {
      countryCode: geo.countryCode || current.countryCode || null,
      countryKa: geo.countryKa || current.countryKa || null,
      cityKa: geo.cityKa || current.cityKa || null,
    };
  }
  if (movedFar) {
    return { countryCode: null, countryKa: null, cityKa: null };
  }
  return {
    countryCode: current.countryCode ?? null,
    countryKa: current.countryKa ?? null,
    cityKa: current.cityKa ?? null,
  };
}

export function snapshotFromRow(row, extra = {}) {
  if (!row && !extra.location && extra.locationPrompted !== true) {
    return {
      prompted: false,
      enabled: false,
      countryCode: null,
      countryKa: null,
      cityKa: null,
      lat: null,
      lng: null,
      accuracy: null,
      updatedAt: null,
    };
  }
  const stored = extra.location && typeof extra.location === 'object' ? extra.location : {};
  const fromRow = Boolean(row);
  return {
    prompted: extra.locationPrompted === true || stored.prompted === true || fromRow,
    enabled: fromRow ? row.enabled !== false : stored.enabled === true,
    countryCode: fromRow ? row.countryCode ?? null : stored.countryCode ?? null,
    countryKa: fromRow ? row.countryKa ?? null : stored.countryKa ?? null,
    cityKa: fromRow ? row.cityKa ?? null : stored.cityKa ?? null,
    lat: fromRow ? row.lat ?? null : stored.lat ?? null,
    lng: fromRow ? row.lng ?? null : stored.lng ?? null,
    accuracy: fromRow ? row.accuracy ?? null : stored.accuracy ?? null,
    updatedAt: (row?.updatedAt ? new Date(row.updatedAt).toISOString() : null) || stored.updatedAt || null,
  };
}
