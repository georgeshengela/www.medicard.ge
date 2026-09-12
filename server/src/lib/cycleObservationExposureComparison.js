/**
 * Phase 30 — exposure-aware two-window observation comparison.
 *
 * Two adjacent non-overlapping 14-day civil windows.
 * Denominator in each window is field-specific assessedDays
 * (PRESENT + explicit ABSENT). UNKNOWN never enters.
 *
 * Reuses Phase 28 aggregateObservationExposure and Phase 29 window/rate helpers.
 * Does not invent a second denominator engine.
 *
 * Descriptive comparison only. Not a biological trend. Not diagnosis.
 * No similar/equivalent claim. No improving/worsening. No AI.
 */

import { addDays } from './cycle.js';
import { isExposureComparisonEligible } from './cycleObservationRegistry.js';
import { aggregateObservationExposure } from './cycleObservationAssessment.js';
import {
  listCivilDates,
  roundExposureRatePercent,
} from './cycleObservationExposureRates.js';

export const EXPOSURE_COMPARISON_WINDOW_DAYS = 14;
export const EXPOSURE_COMPARISON_MIN_ASSESSED_DAYS = 5;
export const EXPOSURE_COMPARISON_MIN_COVERAGE = 0.35;
export const EXPOSURE_COMPARISON_MIN_AVAILABLE_DAYS = 7;
export const EXPOSURE_COMPARISON_MIN_WINDOW_PRESENT = 2;
export const EXPOSURE_COMPARISON_MIN_TOTAL_PRESENT = 3;
export const EXPOSURE_COMPARISON_MIN_ABS_POINTS = 20;
export const EXPOSURE_COMPARISON_MIN_RELATIVE_RATIO = 1.5;
export const EXPOSURE_COMPARISON_ZERO_BASELINE_MIN_PRESENT = 3;
export const EXPOSURE_COMPARISON_ZERO_BASELINE_MIN_ABS_POINTS = 25;
export const EXPOSURE_COMPARISON_MAX_COVERAGE_RATIO = 2;
export const EXPOSURE_COMPARISON_MAX_ROWS = 3;

export const EXPOSURE_COMPARISON_DIRECTION = Object.freeze({
  HIGHER: 'HIGHER',
  LOWER: 'LOWER',
  NONE: null,
});

export const COMPARISON_NUMBERS_UNAVAILABLE_REASON = Object.freeze({
  EARLIER_WINDOW_INSUFFICIENT: 'EARLIER_WINDOW_INSUFFICIENT',
  RECENT_WINDOW_INSUFFICIENT: 'RECENT_WINDOW_INSUFFICIENT',
  BOTH_WINDOWS_INSUFFICIENT: 'BOTH_WINDOWS_INSUFFICIENT',
  SHORT_AVAILABLE_HISTORY: 'SHORT_AVAILABLE_HISTORY',
  NO_QUALIFIED_TWO_WINDOW_DATA: 'NO_QUALIFIED_TWO_WINDOW_DATA',
});

export const COMPARISON_DIRECTION_UNAVAILABLE_REASON = Object.freeze({
  CHANGE_TOO_SMALL: 'CHANGE_TOO_SMALL',
  COVERAGE_NOT_COMPARABLE: 'COVERAGE_NOT_COMPARABLE',
  EVENT_COUNT_TOO_LOW: 'EVENT_COUNT_TOO_LOW',
  ZERO_BASELINE_NOT_QUALIFIED: 'ZERO_BASELINE_NOT_QUALIFIED',
});

export function splitExposureComparisonWindows(today, { allowedDates = null } = {}) {
  if (!today) {
    return {
      earlier: [],
      recent: [],
      earlierFrom: null,
      earlierTo: null,
      recentFrom: null,
      recentTo: null,
    };
  }
  const recentTo = today;
  const recentFrom = addDays(today, -(EXPOSURE_COMPARISON_WINDOW_DAYS - 1));
  const earlierTo = addDays(recentFrom, -1);
  const earlierFrom = addDays(earlierTo, -(EXPOSURE_COMPARISON_WINDOW_DAYS - 1));
  const allow = Array.isArray(allowedDates) ? new Set(allowedDates.map(String)) : null;
  const clip = (from, to) => {
    const all = listCivilDates(from, to);
    return allow ? all.filter((date) => allow.has(date)) : all;
  };
  return {
    earlier: clip(earlierFrom, earlierTo),
    recent: clip(recentFrom, recentTo),
    earlierFrom,
    earlierTo,
    recentFrom,
    recentTo,
  };
}

export function comparisonWindowsOverlap(earlierDates, recentDates) {
  if (!earlierDates?.length || !recentDates?.length) return false;
  const recent = new Set(recentDates);
  return earlierDates.some((date) => recent.has(date));
}

function coverage(assessedDays, availableDays) {
  const assessed = Number(assessedDays) || 0;
  const available = Number(availableDays) || 0;
  if (available < 1) return 0;
  return assessed / available;
}

function rawRate(presentDays, assessedDays) {
  const present = Number(presentDays) || 0;
  const assessed = Number(assessedDays) || 0;
  if (assessed < 1) return null;
  return present / assessed;
}

export function isComparisonWindowNumbersEligible({
  presentDays = 0,
  assessedDays = 0,
  availableDays = 0,
} = {}) {
  const present = Number(presentDays) || 0;
  const assessed = Number(assessedDays) || 0;
  const available = Number(availableDays) || 0;
  if (available < EXPOSURE_COMPARISON_MIN_AVAILABLE_DAYS) return false;
  if (assessed < EXPOSURE_COMPARISON_MIN_ASSESSED_DAYS) return false;
  if (present > assessed) return false;
  if (coverage(assessed, available) < EXPOSURE_COMPARISON_MIN_COVERAGE) return false;
  return true;
}

function serializeWindow(agg, dates) {
  const availableDays = Array.isArray(dates) ? dates.length : 0;
  const sorted = [...(dates || [])].sort();
  return {
    presentDays: agg.presentDays,
    absentDays: agg.absentDays,
    assessedDays: agg.assessedDays,
    availableDays,
    ratePercent: roundExposureRatePercent(agg.presentDays, agg.assessedDays),
    from: sorted[0] || null,
    to: sorted[sorted.length - 1] || null,
  };
}

function coverageComparable(earlier, recent) {
  const earlierCoverage = coverage(earlier.assessedDays, earlier.availableDays);
  const recentCoverage = coverage(recent.assessedDays, recent.availableDays);
  const smaller = Math.min(earlierCoverage, recentCoverage);
  const larger = Math.max(earlierCoverage, recentCoverage);
  if (smaller <= 0) return false;
  return larger / smaller <= EXPOSURE_COMPARISON_MAX_COVERAGE_RATIO;
}

function eventThresholdPasses(earlier, recent) {
  const earlierPresent = Number(earlier.presentDays) || 0;
  const recentPresent = Number(recent.presentDays) || 0;
  if (earlierPresent < EXPOSURE_COMPARISON_MIN_WINDOW_PRESENT && recentPresent < EXPOSURE_COMPARISON_MIN_WINDOW_PRESENT) {
    return false;
  }
  return earlierPresent + recentPresent >= EXPOSURE_COMPARISON_MIN_TOTAL_PRESENT;
}

function directionFromRates(earlier, recent) {
  const earlierRate = rawRate(earlier.presentDays, earlier.assessedDays);
  const recentRate = rawRate(recent.presentDays, recent.assessedDays);
  if (earlierRate == null || recentRate == null) return EXPOSURE_COMPARISON_DIRECTION.NONE;

  const absPoints = Math.abs(recentRate - earlierRate) * 100;

  if (earlierRate === 0 && recentRate === 0) return EXPOSURE_COMPARISON_DIRECTION.NONE;

  if (earlierRate === 0) {
    if (
      Number(recent.presentDays) >= EXPOSURE_COMPARISON_ZERO_BASELINE_MIN_PRESENT &&
      absPoints >= EXPOSURE_COMPARISON_ZERO_BASELINE_MIN_ABS_POINTS
    ) {
      return EXPOSURE_COMPARISON_DIRECTION.HIGHER;
    }
    return EXPOSURE_COMPARISON_DIRECTION.NONE;
  }

  if (recentRate === 0) {
    if (
      Number(earlier.presentDays) >= EXPOSURE_COMPARISON_ZERO_BASELINE_MIN_PRESENT &&
      absPoints >= EXPOSURE_COMPARISON_ZERO_BASELINE_MIN_ABS_POINTS
    ) {
      return EXPOSURE_COMPARISON_DIRECTION.LOWER;
    }
    return EXPOSURE_COMPARISON_DIRECTION.NONE;
  }

  if (absPoints < EXPOSURE_COMPARISON_MIN_ABS_POINTS) return EXPOSURE_COMPARISON_DIRECTION.NONE;

  if (recentRate > earlierRate) {
    if (recentRate / earlierRate >= EXPOSURE_COMPARISON_MIN_RELATIVE_RATIO) {
      return EXPOSURE_COMPARISON_DIRECTION.HIGHER;
    }
    return EXPOSURE_COMPARISON_DIRECTION.NONE;
  }

  if (earlierRate > recentRate) {
    if (earlierRate / recentRate >= EXPOSURE_COMPARISON_MIN_RELATIVE_RATIO) {
      return EXPOSURE_COMPARISON_DIRECTION.LOWER;
    }
    return EXPOSURE_COMPARISON_DIRECTION.NONE;
  }

  return EXPOSURE_COMPARISON_DIRECTION.NONE;
}

/**
 * Shared qualification math. Mode-specific code supplies window stats only.
 */
export function qualifyObservationExposureComparison({ earlier, recent } = {}) {
  const earlierWindow = earlier || {};
  const recentWindow = recent || {};
  const earlierOk = isComparisonWindowNumbersEligible(earlierWindow);
  const recentOk = isComparisonWindowNumbersEligible(recentWindow);
  const earlierPresent = Number(earlierWindow.presentDays) || 0;
  const recentPresent = Number(recentWindow.presentDays) || 0;
  const numbersEligible =
    earlierOk && recentOk && !(earlierPresent === 0 && recentPresent === 0);

  if (!numbersEligible) {
    return {
      numbersEligible: false,
      directionEligible: false,
      direction: EXPOSURE_COMPARISON_DIRECTION.NONE,
      earlier: earlierWindow,
      recent: recentWindow,
    };
  }

  const direction =
    eventThresholdPasses(earlierWindow, recentWindow) && coverageComparable(earlierWindow, recentWindow)
      ? directionFromRates(earlierWindow, recentWindow)
      : EXPOSURE_COMPARISON_DIRECTION.NONE;

  return {
    numbersEligible: true,
    directionEligible: direction != null,
    direction,
    earlier: earlierWindow,
    recent: recentWindow,
  };
}

export function comparisonNumbersUnavailableReason(earlier, recent) {
  const earlierWindow = earlier || {};
  const recentWindow = recent || {};
  const earlierAvailable = Number(earlierWindow.availableDays) || 0;
  const recentAvailable = Number(recentWindow.availableDays) || 0;
  if (
    earlierAvailable < EXPOSURE_COMPARISON_MIN_AVAILABLE_DAYS ||
    recentAvailable < EXPOSURE_COMPARISON_MIN_AVAILABLE_DAYS
  ) {
    return COMPARISON_NUMBERS_UNAVAILABLE_REASON.SHORT_AVAILABLE_HISTORY;
  }
  const earlierOk = isComparisonWindowNumbersEligible(earlierWindow);
  const recentOk = isComparisonWindowNumbersEligible(recentWindow);
  const earlierPresent = Number(earlierWindow.presentDays) || 0;
  const recentPresent = Number(recentWindow.presentDays) || 0;
  if (earlierPresent === 0 && recentPresent === 0 && earlierOk && recentOk) {
    return COMPARISON_NUMBERS_UNAVAILABLE_REASON.NO_QUALIFIED_TWO_WINDOW_DATA;
  }
  if (earlierOk && recentOk) return null;
  if (!earlierOk && !recentOk) return COMPARISON_NUMBERS_UNAVAILABLE_REASON.BOTH_WINDOWS_INSUFFICIENT;
  if (!earlierOk) return COMPARISON_NUMBERS_UNAVAILABLE_REASON.EARLIER_WINDOW_INSUFFICIENT;
  return COMPARISON_NUMBERS_UNAVAILABLE_REASON.RECENT_WINDOW_INSUFFICIENT;
}

export function comparisonDirectionUnavailableReason(earlier, recent) {
  const qualified = qualifyObservationExposureComparison({ earlier, recent });
  if (!qualified.numbersEligible) return null;
  if (qualified.directionEligible) return null;
  if (!eventThresholdPasses(earlier, recent)) {
    return COMPARISON_DIRECTION_UNAVAILABLE_REASON.EVENT_COUNT_TOO_LOW;
  }
  if (!coverageComparable(earlier, recent)) {
    return COMPARISON_DIRECTION_UNAVAILABLE_REASON.COVERAGE_NOT_COMPARABLE;
  }
  const earlierRate = rawRate(earlier.presentDays, earlier.assessedDays);
  const recentRate = rawRate(recent.presentDays, recent.assessedDays);
  if (earlierRate === 0 || recentRate === 0) {
    return COMPARISON_DIRECTION_UNAVAILABLE_REASON.ZERO_BASELINE_NOT_QUALIFIED;
  }
  return COMPARISON_DIRECTION_UNAVAILABLE_REASON.CHANGE_TOO_SMALL;
}

export function buildObservationExposureComparison(logs, key, { today, allowedDates = null } = {}) {
  if (!isExposureComparisonEligible(key) || !today) return null;
  const windows = splitExposureComparisonWindows(today, { allowedDates });
  if (comparisonWindowsOverlap(windows.earlier, windows.recent)) return null;

  const earlierAgg = aggregateObservationExposure(logs, key, { dates: windows.earlier });
  const recentAgg = aggregateObservationExposure(logs, key, { dates: windows.recent });
  const earlier = serializeWindow(earlierAgg, windows.earlier);
  const recent = serializeWindow(recentAgg, windows.recent);
  const qualified = qualifyObservationExposureComparison({ earlier, recent });
  if (!qualified.numbersEligible) return null;

  return {
    earlier: {
      presentDays: earlier.presentDays,
      absentDays: earlier.absentDays,
      assessedDays: earlier.assessedDays,
      availableDays: earlier.availableDays,
      ratePercent: earlier.ratePercent,
      from: earlier.from,
      to: earlier.to,
    },
    recent: {
      presentDays: recent.presentDays,
      absentDays: recent.absentDays,
      assessedDays: recent.assessedDays,
      availableDays: recent.availableDays,
      ratePercent: recent.ratePercent,
      from: recent.from,
      to: recent.to,
    },
    direction: qualified.direction,
  };
}

export function attachExposureComparisonIfEligible(row, logs, { today, allowedDates } = {}) {
  if (!row || !isExposureComparisonEligible(row.key)) return row;
  const comparison = buildObservationExposureComparison(logs, row.key, { today, allowedDates });
  if (!comparison) return row;
  return { ...row, comparison };
}

export function attachExposureComparisons(rows, logs, { today, allowedDates, max = EXPOSURE_COMPARISON_MAX_ROWS } = {}) {
  let attached = 0;
  return (rows || []).map((row) => {
    if (attached >= max) return row;
    const next = attachExposureComparisonIfEligible(row, logs, { today, allowedDates });
    if (next.comparison) attached += 1;
    return next;
  });
}
