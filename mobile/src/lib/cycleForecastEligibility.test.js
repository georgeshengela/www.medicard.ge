import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  forecastPresentationAllowed,
  isPostpartumReturnLearning,
  suppressCycleLengthChrome,
} from './cycleForecastEligibility.js';

describe('forecastPresentationAllowed', () => {
  it('pending without a bundle is not allowed', () => {
    assert.equal(forecastPresentationAllowed(null), false);
    assert.equal(forecastPresentationAllowed(undefined, { hydrating: true }), false);
  });

  it('legacy TRACK cache without the field remains allowed', () => {
    assert.equal(forecastPresentationAllowed({ predictions: { nextPeriodStart: '2026-09-20' } }), true);
  });

  it('postpartum-return insufficient is not allowed', () => {
    const bundle = {
      forecastEligibility: { allowed: false, reason: 'POSTPARTUM_HISTORY_INSUFFICIENT' },
    };
    assert.equal(forecastPresentationAllowed(bundle), false);
    assert.equal(isPostpartumReturnLearning(bundle), true);
  });

  it('STANDARD and READY are allowed', () => {
    assert.equal(forecastPresentationAllowed({ forecastEligibility: { allowed: true, reason: 'STANDARD' } }), true);
    assert.equal(forecastPresentationAllowed({ forecastEligibility: { allowed: true, reason: 'POSTPARTUM_HISTORY_READY' } }), true);
  });

  it('A/H: gated and pending suppress cycle-length chrome', () => {
    assert.equal(suppressCycleLengthChrome(null), true);
    assert.equal(suppressCycleLengthChrome(undefined, { hydrating: true }), true);
    assert.equal(
      suppressCycleLengthChrome({
        forecastEligibility: { allowed: false, reason: 'POSTPARTUM_HISTORY_INSUFFICIENT' },
        averages: { usedCycleLength: 28 },
        profile: { avgCycleLength: 31 },
      }),
      true,
    );
  });

  it('D/E: ready and ordinary TRACK keep cycle-length chrome', () => {
    assert.equal(
      suppressCycleLengthChrome({ forecastEligibility: { allowed: true, reason: 'POSTPARTUM_HISTORY_READY' } }),
      false,
    );
    assert.equal(suppressCycleLengthChrome({ averages: { usedCycleLength: 28 } }), false);
    assert.equal(
      suppressCycleLengthChrome({ forecastEligibility: { allowed: true, reason: 'STANDARD' } }),
      false,
    );
  });
});
