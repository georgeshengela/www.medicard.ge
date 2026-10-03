import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  cycleVerdictsReady,
  FERTILITY_MIN_CYCLES,
  fertilityGate,
  fertilityGateFromBundle,
  fertilityLearning,
  fertilityWide,
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

// Same table as server/src/lib/cycleForecastHonesty.test.js („3-cycle gate — shared cases“).
const GATE_CASES = [
  { cycleCount: 0, mode: 'TRACK_PERIOD', status: 'LEARNING', completed: 0 },
  { cycleCount: 2, mode: 'TRACK_PERIOD', status: 'LEARNING', completed: 2 },
  { cycleCount: 2.9, mode: null, status: 'LEARNING', completed: 2 },
  { cycleCount: 3, mode: 'TRACK_PERIOD', status: 'READY', completed: 3 },
  { cycleCount: 6, mode: 'TRY_TO_CONCEIVE', status: 'READY', completed: 6 },
  { cycleCount: 0, mode: 'TRY_TO_CONCEIVE', status: 'WIDE', completed: 0 },
  { cycleCount: 1, mode: 'TRY_TO_CONCEIVE', status: 'WIDE', completed: 1 },
  { cycleCount: undefined, mode: 'PERIMENOPAUSE', status: 'LEARNING', completed: 0 },
  { cycleCount: -4, mode: 'TRACK_PERIOD', status: 'LEARNING', completed: 0 },
];

describe('3-cycle gate — shared cases (mobile mirror)', () => {
  it('matches the server rule case by case', () => {
    for (const row of GATE_CASES) {
      const gate = fertilityGate({ cycleCount: row.cycleCount, mode: row.mode });
      assert.equal(gate.status, row.status, JSON.stringify(row));
      assert.equal(gate.completedCycles, row.completed, JSON.stringify(row));
      assert.equal(gate.requiredCycles, FERTILITY_MIN_CYCLES);
    }
    assert.equal(FERTILITY_MIN_CYCLES, 3);
  });

  it('prefers the server gate, falls back to the bundle count and mode', () => {
    const sent = { predictions: { fertility: { status: 'WIDE', completedCycles: 1, requiredCycles: 3, window: 'wide', ovulationSource: null } } };
    assert.equal(fertilityGateFromBundle(sent).status, 'WIDE');
    assert.equal(fertilityWide(sent), true);
    assert.equal(fertilityLearning(sent), false);
    const cached = { averages: { cycleCount: 2 }, profile: { mode: 'TRACK_PERIOD' }, predictions: {} };
    assert.equal(fertilityGateFromBundle(cached).status, 'LEARNING');
    assert.equal(fertilityLearning(cached), true);
    assert.equal(fertilityGateFromBundle({ averages: { cycleCount: 4 }, profile: { mode: 'TRACK_PERIOD' } }).status, 'READY');
    // Her own OPK / mark opened a standard band this cycle: not „wide“ any more.
    assert.equal(fertilityWide({ predictions: { fertility: { status: 'WIDE', completedCycles: 1, requiredCycles: 3, window: 'standard', ovulationSource: 'opk' } } }), false);
  });

  it('verdicts („✓ ტიპური“) wait for 3 completed cycles', () => {
    assert.equal(cycleVerdictsReady(2), false);
    assert.equal(cycleVerdictsReady(3), true);
    assert.equal(cycleVerdictsReady(undefined), false);
  });
});
