/**
 * Phase 42 — explicit POSTPARTUM → TRACK_PERIOD return.
 *
 * Mode transition and forecast readiness are separate.
 * Stored cycle length and the default 28-day fallback must not
 * satisfy post-postpartum forecast eligibility.
 *
 * Does not change ovulation / fertile-window / confidence arithmetic.
 */

import { inferCycleStats } from './cycle.js';
import {
  CLASSIFICATION_SOURCE_OWNER,
  MENSTRUAL_PERIOD_CLASSIFICATION,
} from './cyclePostpartumBleedClassification.js';

export const FORECAST_GATE_KIND_POSTPARTUM_RETURN = 'POSTPARTUM_RETURN';

export const FORECAST_ELIGIBILITY_REASON = Object.freeze({
  STANDARD: 'STANDARD',
  POSTPARTUM_HISTORY_INSUFFICIENT: 'POSTPARTUM_HISTORY_INSUFFICIENT',
  POSTPARTUM_HISTORY_READY: 'POSTPARTUM_HISTORY_READY',
});

/** Same as inferCycleStats hasInferredCycle (gaps.length >= 2). Never weaken. */
export const POSTPARTUM_RETURN_MIN_VALID_INTERVALS = 2;

export function forecastGateProfilePatch(transition) {
  if (transition?.entered) {
    return { forecastGateKind: null, forecastGateEpisodeId: null };
  }
  if (transition?.left) {
    return {
      forecastGateKind: FORECAST_GATE_KIND_POSTPARTUM_RETURN,
      forecastGateEpisodeId: transition.endedEpisodeId || null,
    };
  }
  return {};
}

export function omitForecastGateFromProfile(profile) {
  if (!profile || typeof profile !== 'object') return profile;
  const { forecastGateKind, forecastGateEpisodeId, ...rest } = profile;
  return rest;
}

function classifiedStartsForEpisode(classifications, episodeId) {
  return (classifications || [])
    .filter((row) => (
      row
      && row.postpartumEpisodeId === episodeId
      && row.source === CLASSIFICATION_SOURCE_OWNER
      && row.classification === MENSTRUAL_PERIOD_CLASSIFICATION
      && typeof row.bleedStart === 'string'
    ))
    .map((row) => ({ date: row.bleedStart, flow: 'medium' }));
}

export function inferPostpartumReturnStats(classifications, episodeId) {
  return inferCycleStats(classifiedStartsForEpisode(classifications, episodeId));
}

export function evaluateForecastEligibility({
  forecastGateKind,
  forecastGateEpisodeId,
  classifications = [],
} = {}) {
  if (forecastGateKind !== FORECAST_GATE_KIND_POSTPARTUM_RETURN) {
    return {
      allowed: true,
      reason: FORECAST_ELIGIBILITY_REASON.STANDARD,
    };
  }
  if (!forecastGateEpisodeId) {
    return {
      allowed: false,
      reason: FORECAST_ELIGIBILITY_REASON.POSTPARTUM_HISTORY_INSUFFICIENT,
    };
  }
  const inferred = inferPostpartumReturnStats(classifications, forecastGateEpisodeId);
  if (inferred.cycleCount >= POSTPARTUM_RETURN_MIN_VALID_INTERVALS) {
    return {
      allowed: true,
      reason: FORECAST_ELIGIBILITY_REASON.POSTPARTUM_HISTORY_READY,
    };
  }
  return {
    allowed: false,
    reason: FORECAST_ELIGIBILITY_REASON.POSTPARTUM_HISTORY_INSUFFICIENT,
  };
}

export function publicForecastEligibility(eligibility) {
  return {
    allowed: eligibility?.allowed === true,
    reason: eligibility?.reason || FORECAST_ELIGIBILITY_REASON.STANDARD,
  };
}

export function applyForecastEligibilityToPredictions(predictions, eligibility) {
  if (!predictions || eligibility?.allowed !== false) return predictions;
  const calendar = {};
  for (const [date, mark] of Object.entries(predictions.calendar || {})) {
    if (!mark || typeof mark !== 'object') continue;
    const logged = Boolean(mark.logged || mark.flow || (mark.period && mark.predicted === false));
    if (!logged && (mark.predicted || mark.fertile || mark.ovulation)) continue;
    calendar[date] = {
      ...mark,
      predicted: false,
      estimated: false,
      fertile: false,
      ovulation: false,
    };
  }
  return {
    ...predictions,
    nextPeriodStart: null,
    nextPeriodEnd: null,
    ovulationDate: null,
    fertileWindow: null,
    phases: [],
    calendar,
  };
}

export function applyForecastEligibilityToTodayPhase(todayPhase, eligibility) {
  if (!todayPhase || eligibility?.allowed !== false) return todayPhase;
  return {
    ...todayPhase,
    phase: 'unknown',
  };
}

export function serializePostpartumReturnForExport({
  forecastGateKind,
  forecastGateEpisodeId,
  forecastEligibility,
} = {}) {
  if (forecastGateKind !== FORECAST_GATE_KIND_POSTPARTUM_RETURN) return null;
  return {
    kind: FORECAST_GATE_KIND_POSTPARTUM_RETURN,
    sourcePostpartumEpisodeId: forecastGateEpisodeId || null,
    forecastAllowed: forecastEligibility?.allowed === true,
    forecastReason: forecastEligibility?.reason || FORECAST_ELIGIBILITY_REASON.POSTPARTUM_HISTORY_INSUFFICIENT,
  };
}
