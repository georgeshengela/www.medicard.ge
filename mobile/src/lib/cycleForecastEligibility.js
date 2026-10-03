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

/*
 * Forecast honesty — mirror of server/src/lib/cycleForecastHonesty.js `fertilityGate` (brief §9 item 13).
 * The fertile window and ovulation are estimated only after 3 completed, logged cycles; before that
 * the app shows „ვსწავლობთ შენს რიტმს · N/3 ციკლი“, except while trying to conceive (one wide window).
 * Same constants and the same cases in both test files; the server's `predictions.fertility` wins
 * when present, this mirror covers bundles cached before the server sent it.
 */

export const FERTILITY_MIN_CYCLES = 3;

export const FERTILITY_STATUS = Object.freeze({
  READY: 'READY',
  LEARNING: 'LEARNING',
  WIDE: 'WIDE',
});

/** Identical to the server rule. */
export function fertilityGate({ cycleCount = 0, mode = null } = {}) {
  const completed = Math.max(0, Math.floor(Number(cycleCount) || 0));
  const base = { completedCycles: completed, requiredCycles: FERTILITY_MIN_CYCLES };
  if (completed >= FERTILITY_MIN_CYCLES) return { ...base, status: FERTILITY_STATUS.READY };
  if (mode === 'TRY_TO_CONCEIVE') return { ...base, status: FERTILITY_STATUS.WIDE };
  return { ...base, status: FERTILITY_STATUS.LEARNING };
}

/** The server's gate when it sent one, else the mirror from the bundle's own cycle count and mode. */
export function fertilityGateFromBundle(bundle) {
  const sent = bundle?.predictions?.fertility;
  if (sent && typeof sent.status === 'string') {
    return {
      status: sent.status,
      completedCycles: Number(sent.completedCycles) || 0,
      requiredCycles: Number(sent.requiredCycles) || FERTILITY_MIN_CYCLES,
      window: sent.window ?? null,
      ovulationSource: sent.ovulationSource ?? null,
    };
  }
  const gate = fertilityGate({
    cycleCount: bundle?.averages?.cycleCount ?? bundle?.inferred?.cycleCount ?? 0,
    mode: bundle?.profile?.mode ?? null,
  });
  return { ...gate, window: null, ovulationSource: null };
}

/** Before 3 cycles and not trying to conceive: nothing fertile is drawn — the quiet badge instead. */
export function fertilityLearning(bundle) {
  return fertilityGateFromBundle(bundle).status === FERTILITY_STATUS.LEARNING;
}

/** Trying to conceive before 3 cycles: the fertile days are one wide window (no ovulation day). */
export function fertilityWide(bundle) {
  const gate = fertilityGateFromBundle(bundle);
  return gate.status === FERTILITY_STATUS.WIDE && gate.window !== 'standard';
}

/** „✓ ტიპური“ and the other verdicts on the stats cards need 3 completed cycles (numbers show before). */
export function cycleVerdictsReady(cycleCount) {
  return (Number(cycleCount) || 0) >= FERTILITY_MIN_CYCLES;
}
