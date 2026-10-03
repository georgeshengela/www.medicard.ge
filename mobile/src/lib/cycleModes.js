/**
 * Cycle product-mode helpers for mobile presentation.
 * Mirrors server/src/lib/cycleModes.js. Mode changes presentation, not arithmetic.
 *
 * Domain/lifecycle still uses isTtcMode / isPregnancyMode / isPerimenopauseMode / isPostpartumMode.
 * Presentation must use cycleModeCapabilities / supportsCycleCapability.
 */

import {
  presentationCapabilitiesFor,
  presentationCapabilitiesForProfileMode,
  supportsCycleCapability,
} from './cycleModeCapabilityMatrix.js';
import { cycleTrackingFromBundle } from './cycleForecastEligibility.js';

export { supportsCycleCapability };

export function isTtcMode(mode) {
  return mode === 'TRY_TO_CONCEIVE';
}

export function isPregnancyMode(mode) {
  return mode === 'PREGNANCY';
}

export function isPerimenopauseMode(mode) {
  return mode === 'PERIMENOPAUSE';
}

export function isPostpartumMode(mode) {
  return mode === 'POSTPARTUM';
}

export function cycleModeCapabilities(mode) {
  return presentationCapabilitiesForProfileMode(mode);
}

/**
 * The mode's row narrowed by the bundle's Tracking / fertile-days display (brief §9 wave 2 item 17):
 * `showTrackingOverview`, and no next-period / late / fertile / ovulation flags when they are off.
 * Note `showFertileEstimates` here means „fertile days are shown“ — mode-only layers (e.g. dashed
 * expected periods on the calendar) keep using `cycleModeCapabilities`.
 */
export function cycleBundleCapabilities(bundle) {
  const mode = bundle?.profile?.mode ?? null;
  const tracking = cycleTrackingFromBundle(bundle);
  return presentationCapabilitiesFor(
    mode,
    { expectsBleeding: !tracking.trackingOnly, fertilityDisplay: tracking.fertility.effective === 'off' ? 'off' : 'auto' },
    { contraceptionHidesFertility: tracking.fertility.forcedBy === 'contraception' },
  );
}

/** @deprecated Use cycleModeCapabilities. Kept so older imports keep working. */
export function ttcCapabilities(mode) {
  return cycleModeCapabilities(mode);
}
