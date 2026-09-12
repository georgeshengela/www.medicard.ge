/**
 * Phase 37 — optional owner-entered prenatal visit place.
 *
 * User-authored organizational text on an already-planned date.
 * Not verified provider data. Not geolocation. Not a map.
 * Does not affect reminders, Calendar export, AI, partner, or doctor summary.
 */

import { isCivilDateKey } from './pregnancyCareCatalog.js';

export const PLANNED_PLACE_MAX = 160;
export const PLANNED_PLACE_FIELD = 'plannedPlace';

export function visitPlaceIsVerifiedProviderData() {
  return false;
}

export function visitPlaceUsesGeolocation() {
  return false;
}

export function visitPlaceRequestsLocationPermission() {
  return false;
}

export function visitPlaceGeocodingApis() {
  return Object.freeze([]);
}

export function visitPlaceHasMapUi() {
  return false;
}

export function visitPlaceHasClinicSearch() {
  return false;
}

export function storedPlaceCoordinates(_row) {
  return { latitude: null, longitude: null, placeId: null };
}

export function visitPlaceParsesAddress() {
  return false;
}

export function visitPlaceInfersProvider() {
  return false;
}

export function reminderSchedulingUsesPlannedPlace() {
  return false;
}

export function calendarExportIncludesVisitPlace() {
  return false;
}

export function calendarEventLocationField() {
  return null;
}

export function placeChangeCreatesCalendarMismatch() {
  return false;
}

export function unicodeLength(value) {
  return Array.from(String(value ?? '')).length;
}

/**
 * Trim, collapse accidental whitespace/newlines to a single space.
 * Empty → null. Too long after normalize → 400.
 * Does not alter meaningful punctuation.
 */
export function normalizePlannedPlace(value) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'string') {
    const err = new Error('ვიზიტის ადგილი არასწორია.');
    err.status = 400;
    throw err;
  }
  const collapsed = value.replace(/\s+/g, ' ').trim();
  if (!collapsed) return null;
  if (unicodeLength(collapsed) > PLANNED_PLACE_MAX) {
    const err = new Error('ადგილი ძალიან გრძელია.');
    err.status = 400;
    throw err;
  }
  return collapsed;
}

export function resolvePlannedPlace({ plannedDate, plannedPlace } = {}) {
  if (!isCivilDateKey(plannedDate)) return null;
  if (plannedPlace === undefined) return undefined;
  return normalizePlannedPlace(plannedPlace);
}

/**
 * Place exists only with a planned date.
 * Clearing the date always clears place.
 * Omitted place keeps existing only while the resolved date remains.
 */
export function resolvePlannedDateAndPlace({ plannedDate, plannedPlace, existing } = {}) {
  const nextDate = plannedDate === undefined ? existing?.plannedDate ?? null : plannedDate;
  const date = isCivilDateKey(nextDate) ? nextDate : null;
  if (!date) return { plannedDate: null, plannedPlace: null };
  if (plannedPlace === undefined) {
    return { plannedDate: date, plannedPlace: normalizePlannedPlace(existing?.plannedPlace ?? null) };
  }
  return { plannedDate: date, plannedPlace: normalizePlannedPlace(plannedPlace) };
}

export function placeRequiresPlannedDate() {
  return true;
}

export function calendarPayloadHasLocation(payload) {
  if (!payload || typeof payload !== 'object') return false;
  return Boolean(
    payload.location ||
      payload.structuredLocation ||
      payload.URL ||
      payload.url ||
      payload.geo,
  );
}

export function reminderCopyIncludesPlace(copy, place) {
  if (!place) return false;
  const blob = `${copy?.title || ''}\n${copy?.body || ''}`;
  return blob.includes(place);
}

export function xssLikePlaceSample() {
  return '<script>alert(1)</script>';
}
