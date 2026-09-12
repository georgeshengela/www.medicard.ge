/**
 * Phase 31 — observation data transparency / comparison explainability.
 *
 * Server-owned reason enums for why a rate, comparison, or direction
 * is or is not shown. Product explanation metadata only — not medical
 * conclusions, not coaching, not a second qualification engine.
 *
 * Qualification math stays in Phase 29/30 helpers. This file classifies
 * the already-computed state.
 */

import { isExposureRateEligible, isExposureComparisonEligible } from './cycleObservationRegistry.js';
import {
  buildObservationExposure,
  exposureRateUnavailableReason,
  EXPOSURE_RATE_UNAVAILABLE_REASON,
  roundExposureRatePercent,
} from './cycleObservationExposureRates.js';

import { aggregateObservationExposure } from './cycleObservationAssessment.js';
import {
  COMPARISON_DIRECTION_UNAVAILABLE_REASON,
  COMPARISON_NUMBERS_UNAVAILABLE_REASON,
  comparisonDirectionUnavailableReason,
  comparisonNumbersUnavailableReason,
  comparisonWindowsOverlap,
  qualifyObservationExposureComparison,
  splitExposureComparisonWindows,
} from './cycleObservationExposureComparison.js';

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

export function explainObservationRate(logs, key, dates) {
  if (!isExposureRateEligible(key)) {
    return {
      available: false,
      reason: EXPOSURE_RATE_UNAVAILABLE_REASON.NOT_EXPOSURE_ELIGIBLE,
    };
  }
  const exposure = buildObservationExposure(logs, key, { dates });
  if (exposure.rateDisplayEligible) {
    return { available: true, reason: null };
  }
  return {
    available: false,
    reason: exposureRateUnavailableReason({
      presentDays: exposure.presentDays,
      assessedDays: exposure.assessedDays,
      availableDays: exposure.availableDays,
    }),
  };
}

export function explainObservationComparison(logs, key, { today, allowedDates = null } = {}) {
  if (!isExposureComparisonEligible(key) || !today) {
    return {
      numbersAvailable: false,
      directionAvailable: false,
      numbersReason: COMPARISON_NUMBERS_UNAVAILABLE_REASON.NO_QUALIFIED_TWO_WINDOW_DATA,
      directionReason: null,
    };
  }
  const windows = splitExposureComparisonWindows(today, { allowedDates });
  if (comparisonWindowsOverlap(windows.earlier, windows.recent)) {
    return {
      numbersAvailable: false,
      directionAvailable: false,
      numbersReason: COMPARISON_NUMBERS_UNAVAILABLE_REASON.NO_QUALIFIED_TWO_WINDOW_DATA,
      directionReason: null,
    };
  }
  const earlierAgg = aggregateObservationExposure(logs, key, { dates: windows.earlier });
  const recentAgg = aggregateObservationExposure(logs, key, { dates: windows.recent });
  const earlier = serializeWindow(earlierAgg, windows.earlier);
  const recent = serializeWindow(recentAgg, windows.recent);
  const qualified = qualifyObservationExposureComparison({ earlier, recent });
  if (!qualified.numbersEligible) {
    return {
      numbersAvailable: false,
      directionAvailable: false,
      numbersReason: comparisonNumbersUnavailableReason(earlier, recent),
      directionReason: null,
    };
  }
  return {
    numbersAvailable: true,
    directionAvailable: qualified.directionEligible,
    numbersReason: null,
    directionReason: qualified.directionEligible
      ? null
      : comparisonDirectionUnavailableReason(earlier, recent),
  };
}

export function attachObservationExplainability(rows, logs, { today, allowedDates } = {}) {
  return (rows || []).map((row) => {
    if (!row || !isExposureRateEligible(row.key)) return row;
    const rate = row.exposure?.rateDisplayEligible
      ? { available: true, reason: null }
      : explainObservationRate(logs, row.key, allowedDates);
    let comparison = null;
    if (isExposureComparisonEligible(row.key)) {
      if (row.comparison) {
        comparison = {
          numbersAvailable: true,
          directionAvailable: row.comparison.direction != null,
          numbersReason: null,
          directionReason:
            row.comparison.direction != null
              ? null
              : comparisonDirectionUnavailableReason(row.comparison.earlier, row.comparison.recent),
        };
      } else {
        comparison = explainObservationComparison(logs, row.key, { today, allowedDates });
      }
    }
    return { ...row, explainability: { rate, comparison } };
  });
}

export {
  EXPOSURE_RATE_UNAVAILABLE_REASON,
  COMPARISON_NUMBERS_UNAVAILABLE_REASON,
  COMPARISON_DIRECTION_UNAVAILABLE_REASON,
};
