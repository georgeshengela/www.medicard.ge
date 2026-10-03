import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildCycleCandidates, revalidateCycleCandidate } from './cycleNotificationContract.js';
import { cycleBundleCapabilities } from './cycleModes.js';
import {
  contraceptionHidesFertility,
  cycleReminderGates,
  cycleTrackingFromBundle,
  fertilityDisplayOn,
  FORECAST_ELIGIBILITY_REASON,
  isTrackingOnly,
  suggestNotExpectingBleeding,
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

/* „თვალყურის დევნება“ / Tracking + „ნაყოფიერი დღეების ჩვენება“ (brief §9 wave 2 item 17). */
describe('Tracking mirror', () => {
  const tracking = {
    profile: { mode: 'TRACK_PERIOD', expectsBleeding: false },
    forecastEligibility: { allowed: false, reason: 'NOT_EXPECTING_BLEEDING' },
  };

  it('the server reason and a just-saved profile both mean Tracking (no forecast, no length chrome)', () => {
    assert.equal(FORECAST_ELIGIBILITY_REASON.NOT_EXPECTING_BLEEDING, 'NOT_EXPECTING_BLEEDING');
    assert.equal(isTrackingOnly(tracking), true);
    assert.equal(forecastPresentationAllowed(tracking), false);
    assert.equal(isPostpartumReturnLearning(tracking), false);
    assert.equal(suppressCycleLengthChrome(tracking), true);
    // A cached bundle from before the server answered: the profile alone decides.
    const cached = { profile: { mode: 'TRACK_PERIOD', expectsBleeding: false }, forecastEligibility: { allowed: true, reason: 'STANDARD' } };
    assert.equal(isTrackingOnly(cached), true);
    assert.equal(forecastPresentationAllowed(cached), false);
  });

  it('older bundles (no fields) and other modes are never Tracking', () => {
    assert.equal(isTrackingOnly({ profile: { mode: 'TRACK_PERIOD' } }), false);
    assert.equal(isTrackingOnly({ profile: { mode: 'TRY_TO_CONCEIVE', expectsBleeding: false } }), false);
    assert.equal(isTrackingOnly(null), false);
    assert.equal(fertilityDisplayOn({ profile: { mode: 'TRACK_PERIOD' } }), true);
  });

  it('fertile-days display: her off, contraception, TTC, Tracking', () => {
    assert.equal(fertilityDisplayOn({ profile: { mode: 'TRACK_PERIOD', fertilityDisplay: 'off' } }), false);
    assert.equal(fertilityDisplayOn({ profile: { mode: 'TRY_TO_CONCEIVE', fertilityDisplay: 'off' } }), true);
    assert.equal(fertilityDisplayOn(tracking), false);
    const pill = { profile: { mode: 'TRACK_PERIOD' }, contraception: { presentation: { showFertileWindow: false } } };
    assert.equal(contraceptionHidesFertility(pill), true);
    assert.equal(cycleTrackingFromBundle(pill).fertility.forcedBy, 'contraception');
    // Her own „off“ on a new server is not „contraception“.
    const own = {
      profile: { mode: 'TRACK_PERIOD', fertilityDisplay: 'off' },
      contraception: { presentation: { showFertileWindow: false, fertilityDisplay: { effective: 'off', forcedBy: null, userCanChange: true } } },
    };
    assert.equal(contraceptionHidesFertility(own), false);
    assert.equal(cycleTrackingFromBundle(own).fertility.userCanChange, true);
    // Unsaved settings override the saved profile.
    assert.equal(cycleTrackingFromBundle(own, { fertilityDisplay: 'auto' }).fertility.effective, 'on');
    assert.equal(cycleTrackingFromBundle(own, { mode: 'TRY_TO_CONCEIVE' }).fertility.forcedBy, 'ttc');
  });

  it('the server’s tracking block wins over the mirror', () => {
    const sent = {
      profile: { mode: 'TRACK_PERIOD' },
      tracking: {
        expectsBleeding: true,
        fertilityDisplay: 'off',
        trackingOnly: false,
        fertility: { setting: 'off', effective: 'off', forcedBy: null, userCanChange: true },
      },
    };
    assert.equal(fertilityDisplayOn(sent), false);
    assert.equal(cycleBundleCapabilities(sent).showFertileEstimates, false);
    assert.equal(cycleBundleCapabilities(sent).showNextPeriodForecast, true);
    assert.equal(cycleBundleCapabilities(tracking).showTrackingOverview, true);
    assert.equal(cycleBundleCapabilities({ profile: { mode: 'TRACK_PERIOD' } }).showTrackingOverview, false);
  });

  it('onboarding suggests the switch only for methods that often stop bleeding', () => {
    for (const m of ['HORMONAL_IUD', 'IMPLANT', 'COMBINED_PILL', 'PROGESTIN_PILL']) assert.equal(suggestNotExpectingBleeding(m), true, m);
    for (const m of ['NONE', 'COPPER_IUD', 'BARRIER', null]) assert.equal(suggestNotExpectingBleeding(m), false, String(m));
  });
});

describe('Tracking / fertile-days display: reminder suppression', () => {
  const today = '2026-09-10';
  const predictions = {
    nextPeriodStart: '2026-09-20',
    ovulationDate: '2026-09-06',
    fertileWindow: { start: '2026-09-12', end: '2026-09-16' },
    estimated: true,
  };
  const prefs = { periodDaysBefore: 2, periodLate: true, ovulation: true, pms: true, opk: true, bbt: false, dailyLog: false };
  const types = (bundle, mode = 'TRACK_PERIOD') => {
    const gates = cycleReminderGates(bundle);
    return buildCycleCandidates({ today, mode, predictions, logs: [], prefs, fertilityStatus: 'READY', ...gates }).map((r) => r.type);
  };

  it('defaults keep period and PMS reminders', () => {
    const t = types({ profile: { mode: 'TRACK_PERIOD' } });
    assert.ok(t.includes('period_soon') && t.includes('period_start') && t.includes('period_late') && t.includes('pms'));
  });

  it('Tracking schedules no period (soon / today / late) and no fertile-based reminder', () => {
    const t = types({ profile: { mode: 'TRACK_PERIOD', expectsBleeding: false } });
    for (const type of ['period_soon', 'period_start', 'period_late', 'ovulation', 'fertile', 'pms', 'opk']) {
      assert.equal(t.includes(type), false, type);
    }
  });

  it('fertile-days display off keeps period reminders, drops fertile / ovulation / OPK / PMS', () => {
    const off = { profile: { mode: 'TRACK_PERIOD', fertilityDisplay: 'off' } };
    const t = types(off);
    assert.ok(t.includes('period_start'));
    for (const type of ['ovulation', 'fertile', 'pms', 'opk']) assert.equal(t.includes(type), false, type);
    // An already-scheduled fertile reminder is dropped at delivery too.
    const gates = cycleReminderGates(off);
    const check = revalidateCycleCandidate(
      { type: 'fertile', eventDate: '2026-09-12', candidateId: 'cycle:fertile:2026-09-12' },
      { today, mode: 'TRACK_PERIOD', ...gates, prefsEnabled: true, globalEnabled: true, logs: [] },
    );
    assert.equal(check.ok, false);
  });

  it('trying to conceive keeps fertile reminders even with a stored „off“', () => {
    const t = types({ profile: { mode: 'TRY_TO_CONCEIVE', fertilityDisplay: 'off' } }, 'TRY_TO_CONCEIVE');
    assert.ok(t.includes('fertile') && t.includes('ovulation'));
  });
});
