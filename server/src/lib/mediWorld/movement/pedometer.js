import { PEDOMETER_ADAPTER } from './rules.js';

/**
 * Optional step corroboration. Expo Go on the accepted Pixel 8 path has no
 * trusted pedometer in this repository. Do not fake proof. Wheelchair and
 * assistive modes must never use this adapter.
 */
export function getPedometerAdapter() {
  return { ...PEDOMETER_ADAPTER };
}

export function pedometerConfidence(_summary) {
  return { available: false, status: 'inactive', confidence: 'unavailable' };
}
