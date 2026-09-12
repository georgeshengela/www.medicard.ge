/**
 * Phase 42 — client presentation helper for server-owned forecast eligibility.
 * Pending (no bundle / hydrating) is not allowed. Ordinary TRACK with no
 * field on a pre-Phase-42 cache remains allowed.
 */

export const FORECAST_ELIGIBILITY_REASON = Object.freeze({
  STANDARD: 'STANDARD',
  POSTPARTUM_HISTORY_INSUFFICIENT: 'POSTPARTUM_HISTORY_INSUFFICIENT',
  POSTPARTUM_HISTORY_READY: 'POSTPARTUM_HISTORY_READY',
});

export function forecastPresentationAllowed(bundle, { hydrating = false } = {}) {
  if (hydrating && !bundle) return false;
  if (!bundle) return false;
  const eligibility = bundle.forecastEligibility;
  if (!eligibility) return true;
  return eligibility.allowed === true;
}

export function isPostpartumReturnLearning(bundle) {
  return bundle?.forecastEligibility?.reason === FORECAST_ELIGIBILITY_REASON.POSTPARTUM_HISTORY_INSUFFICIENT
    && bundle.forecastEligibility.allowed === false;
}

/** Presentation only: hide stored/default cycle-length denominator while gated or pending. */
export function suppressCycleLengthChrome(bundle, opts) {
  return !forecastPresentationAllowed(bundle, opts);
}
