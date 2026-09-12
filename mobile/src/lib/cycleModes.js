/**
 * Cycle product-mode helpers for mobile presentation.
 * Mirrors server/src/lib/cycleModes.js. Mode changes presentation, not arithmetic.
 *
 * Domain/lifecycle still uses isTtcMode / isPregnancyMode / isPerimenopauseMode / isPostpartumMode.
 * Presentation must use cycleModeCapabilities / supportsCycleCapability.
 */

import {
  presentationCapabilitiesForProfileMode,
  supportsCycleCapability,
} from './cycleModeCapabilityMatrix.js';

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

/** @deprecated Use cycleModeCapabilities. Kept so older imports keep working. */
export function ttcCapabilities(mode) {
  return cycleModeCapabilities(mode);
}
