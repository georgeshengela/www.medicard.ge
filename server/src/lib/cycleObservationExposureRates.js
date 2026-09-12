/**
 * Phase 29 — exposure-aware observation rates.
 *
 * Denominator is field-specific assessedDays (PRESENT + explicit ABSENT).
 * UNKNOWN days never enter the denominator.
 * Never use calendar days, daysWithAnyLog, or daysInMode.
 *
 * Reuses Phase 28 aggregateObservationExposure. Does not invent a second resolver.
 * Rates are computed on read. Not stored. Not diagnosis. No directional claims.
 */

import { addDays } from './cycle.js';
import { isExposureRateEligible } from './cycleObservationRegistry.js';
import { aggregateObservationExposure } from './cycleObservationAssessment.js';

export const EXPOSURE_RATE_MIN_ASSESSED_DAYS = 5;
export const EXPOSURE_RATE_MIN_COVERAGE = 0.3;
export const EXPOSURE_RATE_MIN_PRESENT_DAYS = 2;

export function listCivilDates(from, to) {
  if (!from || !to || from > to) return [];
  const out = [];
  let cursor = from;
  while (cursor <= to) {
    out.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return out;
}

export function roundExposureRatePercent(presentDays, assessedDays) {
  const present = Number(presentDays);
  const assessed = Number(assessedDays);
  if (!Number.isFinite(present) || !Number.isFinite(assessed) || assessed < 1) return null;
  return Math.round((present / assessed) * 100);
}

/**
 * Display eligibility only. Coverage uses availableDays as a quality metric,
 * never as the symptom denominator.
 */
export function isExposureRateDisplayEligible({
  presentDays = 0,
  assessedDays = 0,
  availableDays = 0,
} = {}) {
  const present = Number(presentDays) || 0;
  const assessed = Number(assessedDays) || 0;
  const available = Number(availableDays) || 0;
  if (present < EXPOSURE_RATE_MIN_PRESENT_DAYS) return false;
  if (assessed < EXPOSURE_RATE_MIN_ASSESSED_DAYS) return false;
  if (available < 1) return false;
  if (present > assessed) return false;
  if (assessed / available < EXPOSURE_RATE_MIN_COVERAGE) return false;
  return true;
}

export const EXPOSURE_RATE_UNAVAILABLE_REASON = Object.freeze({
  NO_PRESENT_OCCURRENCES: 'NO_PRESENT_OCCURRENCES',
  INSUFFICIENT_OCCURRENCES: 'INSUFFICIENT_OCCURRENCES',
  INSUFFICIENT_ASSESSED_DAYS: 'INSUFFICIENT_ASSESSED_DAYS',
  INSUFFICIENT_COVERAGE: 'INSUFFICIENT_COVERAGE',
  NOT_EXPOSURE_ELIGIBLE: 'NOT_EXPOSURE_ELIGIBLE',
});

/**
 * Product explanation metadata only. Does not change display eligibility.
 * Never leak these strings as user-facing threshold copy.
 */
export function exposureRateUnavailableReason({
  presentDays = 0,
  assessedDays = 0,
  availableDays = 0,
} = {}) {
  if (isExposureRateDisplayEligible({ presentDays, assessedDays, availableDays })) return null;
  const present = Number(presentDays) || 0;
  const assessed = Number(assessedDays) || 0;
  const available = Number(availableDays) || 0;
  if (present < 1) return EXPOSURE_RATE_UNAVAILABLE_REASON.NO_PRESENT_OCCURRENCES;
  if (present < EXPOSURE_RATE_MIN_PRESENT_DAYS) return EXPOSURE_RATE_UNAVAILABLE_REASON.INSUFFICIENT_OCCURRENCES;
  if (assessed < EXPOSURE_RATE_MIN_ASSESSED_DAYS) return EXPOSURE_RATE_UNAVAILABLE_REASON.INSUFFICIENT_ASSESSED_DAYS;
  if (available < 1 || assessed / available < EXPOSURE_RATE_MIN_COVERAGE) {
    return EXPOSURE_RATE_UNAVAILABLE_REASON.INSUFFICIENT_COVERAGE;
  }
  return EXPOSURE_RATE_UNAVAILABLE_REASON.INSUFFICIENT_ASSESSED_DAYS;
}

export function buildObservationExposure(logs, key, { dates } = {}) {
  const window = Array.isArray(dates) ? dates : [];
  const availableDays = window.length;
  const agg = aggregateObservationExposure(logs, key, { dates: window });
  const rateDisplayEligible =
    isExposureRateEligible(key) &&
    isExposureRateDisplayEligible({
      presentDays: agg.presentDays,
      assessedDays: agg.assessedDays,
      availableDays,
    });
  const ratePercent = rateDisplayEligible
    ? roundExposureRatePercent(agg.presentDays, agg.assessedDays)
    : null;
  return {
    presentDays: agg.presentDays,
    absentDays: agg.absentDays,
    assessedDays: agg.assessedDays,
    availableDays,
    ratePercent,
    rateDisplayEligible,
  };
}

export function attachExposureIfEligible(row, logs, dates) {
  if (!row || !isExposureRateEligible(row.key)) return row;
  const exposure = buildObservationExposure(logs, row.key, { dates });
  if (!exposure.rateDisplayEligible) return row;
  return {
    ...row,
    exposure: {
      presentDays: exposure.presentDays,
      absentDays: exposure.absentDays,
      assessedDays: exposure.assessedDays,
      availableDays: exposure.availableDays,
      ratePercent: exposure.ratePercent,
      rateDisplayEligible: true,
    },
  };
}
