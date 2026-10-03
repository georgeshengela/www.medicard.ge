import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  CYCLE_PRESENTATION_CAPABILITIES,
  CYCLE_PROFILE_MODES,
  FERTILITY_DISPLAY_FORCED_BY,
  FERTILITY_DISPLAY_VALUES,
  normalizeCycleTrackingPrefs,
  presentationCapabilitiesFor,
  resolveCycleTracking,
  resolveFertilityDisplay,
  trackingOnlyFor,
  PRESENTATION_CAPABILITY_KEYS,
  presentationCapabilitiesForProfileMode,
  supportsCycleCapability,
} from './cycleModeCapabilityMatrix.js';
import { capabilitiesForProfileMode } from './cycleModes.js';
import * as mobileMatrix from '../../../mobile/src/lib/cycleModeCapabilityMatrix.js';

/** Documented Phase 27 matrix after derived expansions. */
const EXPECTED = Object.freeze({
  TRACK_PERIOD: {
    showClassicCycleOverview: true,
    showTtcOverview: false,
    showPregnancyOverview: false,
    showPregnancyTimeline: false,
    showPregnancyWeekGuide: false,
    showPregnancyObservations: false,
    showPregnancyTrends: false,
    showPregnancyCarePlanner: false,
    showPerimenopauseTracking: false,
    showVariabilityContext: false,
    showPerimenopauseObservationSummaries: false,
    showPostpartumOverview: false,
    showPostpartumTracking: false,
    showNextPeriodForecast: true,
    showLatePeriod: true,
    showFertileEstimates: true,
    showOvulationEstimate: true,
    showFertilityLogging: true,
    showFertilityShortcuts: false,
    showFertilityHistory: false,
    showBbtHistory: false,
    showOpkHistory: false,
    showPregnancyTestLog: false,
    showTrackingOverview: false,
  },
  TRY_TO_CONCEIVE: {
    showClassicCycleOverview: true,
    showTtcOverview: true,
    showPregnancyOverview: false,
    showPregnancyTimeline: false,
    showPregnancyWeekGuide: false,
    showPregnancyObservations: false,
    showPregnancyTrends: false,
    showPregnancyCarePlanner: false,
    showPerimenopauseTracking: false,
    showVariabilityContext: false,
    showPerimenopauseObservationSummaries: false,
    showPostpartumOverview: false,
    showPostpartumTracking: false,
    showNextPeriodForecast: true,
    showLatePeriod: true,
    showFertileEstimates: true,
    showOvulationEstimate: true,
    showFertilityLogging: true,
    showFertilityShortcuts: true,
    showFertilityHistory: true,
    showBbtHistory: true,
    showOpkHistory: true,
    showPregnancyTestLog: true,
    showTrackingOverview: false,
  },
  PREGNANCY: {
    showClassicCycleOverview: false,
    showTtcOverview: false,
    showPregnancyOverview: true,
    showPregnancyTimeline: true,
    showPregnancyWeekGuide: true,
    showPregnancyObservations: true,
    showPregnancyTrends: true,
    showPregnancyCarePlanner: true,
    showPerimenopauseTracking: false,
    showVariabilityContext: false,
    showPerimenopauseObservationSummaries: false,
    showPostpartumOverview: false,
    showPostpartumTracking: false,
    showNextPeriodForecast: false,
    showLatePeriod: false,
    showFertileEstimates: false,
    showOvulationEstimate: false,
    showFertilityLogging: false,
    showFertilityShortcuts: false,
    showFertilityHistory: false,
    showBbtHistory: false,
    showOpkHistory: false,
    showPregnancyTestLog: true,
    showTrackingOverview: false,
  },
  PERIMENOPAUSE: {
    showClassicCycleOverview: false,
    showTtcOverview: false,
    showPregnancyOverview: false,
    showPregnancyTimeline: false,
    showPregnancyWeekGuide: false,
    showPregnancyObservations: false,
    showPregnancyTrends: false,
    showPregnancyCarePlanner: false,
    showPerimenopauseTracking: true,
    showVariabilityContext: true,
    showPerimenopauseObservationSummaries: true,
    showPostpartumOverview: false,
    showPostpartumTracking: false,
    showNextPeriodForecast: true,
    showLatePeriod: false,
    showFertileEstimates: false,
    showOvulationEstimate: false,
    showFertilityLogging: false,
    showFertilityShortcuts: false,
    showFertilityHistory: false,
    showBbtHistory: false,
    showOpkHistory: false,
    showPregnancyTestLog: false,
    showTrackingOverview: false,
  },
  POSTPARTUM: {
    showClassicCycleOverview: false,
    showTtcOverview: false,
    showPregnancyOverview: false,
    showPregnancyTimeline: false,
    showPregnancyWeekGuide: false,
    showPregnancyObservations: false,
    showPregnancyTrends: false,
    showPregnancyCarePlanner: false,
    showPerimenopauseTracking: false,
    showVariabilityContext: false,
    showPerimenopauseObservationSummaries: false,
    showPostpartumOverview: true,
    showPostpartumTracking: true,
    showNextPeriodForecast: false,
    showLatePeriod: false,
    showFertileEstimates: false,
    showOvulationEstimate: false,
    showFertilityLogging: false,
    showFertilityShortcuts: false,
    showFertilityHistory: false,
    showBbtHistory: false,
    showOpkHistory: false,
    showPregnancyTestLog: false,
    showTrackingOverview: false,
  },
});

describe('Cycle presentation capability matrix (server)', () => {
  it('covers all five live modes and every documented key', () => {
    assert.deepEqual([...CYCLE_PROFILE_MODES], ['TRACK_PERIOD', 'TRY_TO_CONCEIVE', 'PREGNANCY', 'PERIMENOPAUSE', 'POSTPARTUM']);
    for (const mode of CYCLE_PROFILE_MODES) {
      const row = CYCLE_PRESENTATION_CAPABILITIES[mode];
      assert.deepEqual(row, EXPECTED[mode], mode);
      assert.deepEqual(presentationCapabilitiesForProfileMode(mode), EXPECTED[mode]);
      for (const key of PRESENTATION_CAPABILITY_KEYS) {
        assert.equal(typeof row[key], 'boolean', `${mode}.${key}`);
        assert.equal(supportsCycleCapability(mode, key), EXPECTED[mode][key]);
      }
    }
  });

  it('unknown mode falls back to TRACK_PERIOD, not a foreign mode', () => {
    assert.deepEqual(presentationCapabilitiesForProfileMode('MENOPAUSE'), EXPECTED.TRACK_PERIOD);
    assert.deepEqual(presentationCapabilitiesForProfileMode(null), EXPECTED.TRACK_PERIOD);
  });

  it('capabilitiesForProfileMode exposes the same presentation flags', () => {
    for (const mode of CYCLE_PROFILE_MODES) {
      const cap = capabilitiesForProfileMode(mode);
      for (const key of PRESENTATION_CAPABILITY_KEYS) {
        assert.equal(cap[key], EXPECTED[mode][key], `${mode}.${key}`);
      }
      assert.equal(cap.live, true);
      assert.deepEqual(cap.engineUsesObservations, ['flow']);
      assert.equal(Object.hasOwn(cap, 'isPregnant'), false);
      assert.equal(Object.hasOwn(cap, 'isTtc'), false);
      assert.equal(Object.hasOwn(cap, 'isPerimenopause'), false);
      assert.equal(Object.hasOwn(cap, 'isPostpartum'), false);
    }
  });

  it('TRACK has no TTC / Pregnancy / Perimenopause presentation leak', () => {
    const cap = EXPECTED.TRACK_PERIOD;
    assert.equal(cap.showTtcOverview, false);
    assert.equal(cap.showPregnancyOverview, false);
    assert.equal(cap.showPerimenopauseTracking, false);
    assert.equal(cap.showPregnancyTimeline, false);
    assert.equal(cap.showPregnancyTrends, false);
    assert.equal(cap.showPregnancyCarePlanner, false);
    assert.equal(cap.showVariabilityContext, false);
    assert.equal(cap.showFertilityShortcuts, false);
  });

  it('TTC has no Pregnancy / Perimenopause leak and keeps fertility presentation', () => {
    const cap = EXPECTED.TRY_TO_CONCEIVE;
    assert.equal(cap.showPregnancyOverview, false);
    assert.equal(cap.showPerimenopauseTracking, false);
    assert.equal(cap.showTtcOverview, true);
    assert.equal(cap.showFertileEstimates, true);
    assert.equal(cap.showLatePeriod, true);
  });

  it('Pregnancy has no TTC / peri / late / fertility leak', () => {
    const cap = EXPECTED.PREGNANCY;
    assert.equal(cap.showTtcOverview, false);
    assert.equal(cap.showPerimenopauseTracking, false);
    assert.equal(cap.showLatePeriod, false);
    assert.equal(cap.showFertileEstimates, false);
    assert.equal(cap.showOvulationEstimate, false);
    assert.equal(cap.showFertilityShortcuts, false);
    assert.equal(cap.showNextPeriodForecast, false);
  });

  it('Perimenopause has no TTC / Pregnancy / late / fertility leak', () => {
    const cap = EXPECTED.PERIMENOPAUSE;
    assert.equal(cap.showTtcOverview, false);
    assert.equal(cap.showPregnancyOverview, false);
    assert.equal(cap.showLatePeriod, false);
    assert.equal(cap.showFertileEstimates, false);
    assert.equal(cap.showFertilityShortcuts, false);
    assert.equal(cap.showNextPeriodForecast, true);
  });

  it('Postpartum has no classic forecast / pregnancy / TTC / peri leak', () => {
    const cap = EXPECTED.POSTPARTUM;
    assert.equal(cap.showPostpartumOverview, true);
    assert.equal(cap.showPostpartumTracking, true);
    assert.equal(cap.showClassicCycleOverview, false);
    assert.equal(cap.showTtcOverview, false);
    assert.equal(cap.showPregnancyOverview, false);
    assert.equal(cap.showPregnancyCarePlanner, false);
    assert.equal(cap.showPerimenopauseTracking, false);
    assert.equal(cap.showNextPeriodForecast, false);
    assert.equal(cap.showLatePeriod, false);
    assert.equal(cap.showFertileEstimates, false);
    assert.equal(cap.showOvulationEstimate, false);
    assert.equal(cap.showPregnancyTestLog, false);
  });
});

describe('server / mobile capability parity', () => {
  it('mirrors the same keys, modes, and boolean matrix', () => {
    assert.deepEqual([...mobileMatrix.CYCLE_PROFILE_MODES], [...CYCLE_PROFILE_MODES]);
    assert.deepEqual([...mobileMatrix.PRESENTATION_CAPABILITY_KEYS], [...PRESENTATION_CAPABILITY_KEYS]);
    for (const mode of CYCLE_PROFILE_MODES) {
      assert.deepEqual(
        mobileMatrix.CYCLE_PRESENTATION_CAPABILITIES[mode],
        CYCLE_PRESENTATION_CAPABILITIES[mode],
        mode,
      );
    }
  });
});

/* Tracking (`expectsBleeding`) + fertile-days display — identical cases in the server and mobile test files. */
describe('Tracking + fertile-days display (brief §9 wave 2 item 17)', () => {
  it('missing preferences read as the defaults (older rows / older builds)', () => {
    assert.deepEqual(normalizeCycleTrackingPrefs(undefined), { expectsBleeding: true, fertilityDisplay: 'auto' });
    assert.deepEqual(normalizeCycleTrackingPrefs({ expectsBleeding: null, fertilityDisplay: 'weird' }), {
      expectsBleeding: true,
      fertilityDisplay: 'auto',
    });
    assert.deepEqual([...FERTILITY_DISPLAY_VALUES], ['auto', 'off']);
    for (const mode of CYCLE_PROFILE_MODES) {
      assert.equal(presentationCapabilitiesFor(mode, {}), presentationCapabilitiesForProfileMode(mode), mode);
    }
  });

  it('expectsBleeding false in TRACK_PERIOD: no forecast, no late, no fertile, Tracking overview', () => {
    const caps = presentationCapabilitiesFor('TRACK_PERIOD', { expectsBleeding: false });
    assert.equal(caps.showTrackingOverview, true);
    assert.equal(caps.showNextPeriodForecast, false);
    assert.equal(caps.showLatePeriod, false);
    assert.equal(caps.showFertileEstimates, false);
    assert.equal(caps.showOvulationEstimate, false);
    // Logging and the classic overview frame stay.
    assert.equal(caps.showClassicCycleOverview, true);
    assert.equal(caps.showFertilityLogging, true);
    assert.equal(trackingOnlyFor('TRACK_PERIOD', { expectsBleeding: false }), true);
    assert.equal(trackingOnlyFor(null, { expectsBleeding: false }), true);
    assert.deepEqual(resolveFertilityDisplay('TRACK_PERIOD', { expectsBleeding: false, fertilityDisplay: 'auto' }), {
      effective: 'off',
      forcedBy: FERTILITY_DISPLAY_FORCED_BY.TRACKING,
      userCanChange: false,
    });
  });

  it('expectsBleeding false is not a sixth mode: other modes keep their own rows', () => {
    for (const mode of ['TRY_TO_CONCEIVE', 'PREGNANCY', 'PERIMENOPAUSE', 'POSTPARTUM']) {
      assert.equal(trackingOnlyFor(mode, { expectsBleeding: false }), false, mode);
      assert.equal(presentationCapabilitiesFor(mode, { expectsBleeding: false }).showTrackingOverview, false, mode);
    }
    assert.deepEqual(
      presentationCapabilitiesFor('TRY_TO_CONCEIVE', { expectsBleeding: false }),
      presentationCapabilitiesForProfileMode('TRY_TO_CONCEIVE'),
    );
  });

  it('fertilityDisplay off in TRACK_PERIOD hides fertile + ovulation and keeps the forecast', () => {
    const caps = presentationCapabilitiesFor('TRACK_PERIOD', { fertilityDisplay: 'off' });
    assert.equal(caps.showFertileEstimates, false);
    assert.equal(caps.showOvulationEstimate, false);
    assert.equal(caps.showNextPeriodForecast, true);
    assert.equal(caps.showLatePeriod, true);
    assert.equal(caps.showTrackingOverview, false);
    assert.deepEqual(resolveFertilityDisplay('TRACK_PERIOD', { fertilityDisplay: 'off' }), {
      effective: 'off',
      forcedBy: null,
      userCanChange: true,
    });
    assert.deepEqual(resolveFertilityDisplay('TRACK_PERIOD', {}), { effective: 'on', forcedBy: null, userCanChange: true });
  });

  it('forced on while trying to conceive, forced off by contraception and by modes without fertile days', () => {
    assert.deepEqual(resolveFertilityDisplay('TRY_TO_CONCEIVE', { fertilityDisplay: 'off' }), {
      effective: 'on',
      forcedBy: FERTILITY_DISPLAY_FORCED_BY.TTC,
      userCanChange: false,
    });
    assert.equal(presentationCapabilitiesFor('TRY_TO_CONCEIVE', { fertilityDisplay: 'off' }).showFertileEstimates, true);
    assert.deepEqual(
      resolveFertilityDisplay('TRACK_PERIOD', { fertilityDisplay: 'auto' }, { contraceptionHidesFertility: true }),
      { effective: 'off', forcedBy: FERTILITY_DISPLAY_FORCED_BY.CONTRACEPTION, userCanChange: false },
    );
    // Contraception that hides fertility wins over TTC (the existing conflict rule), never the other way.
    assert.equal(
      resolveFertilityDisplay('TRY_TO_CONCEIVE', {}, { contraceptionHidesFertility: true }).forcedBy,
      FERTILITY_DISPLAY_FORCED_BY.CONTRACEPTION,
    );
    for (const mode of ['PREGNANCY', 'PERIMENOPAUSE', 'POSTPARTUM']) {
      assert.deepEqual(resolveFertilityDisplay(mode, {}), {
        effective: 'off',
        forcedBy: FERTILITY_DISPLAY_FORCED_BY.MODE,
        userCanChange: false,
      }, mode);
    }
  });

  it('resolveCycleTracking bundles the stored values with the effective state', () => {
    assert.deepEqual(resolveCycleTracking('TRACK_PERIOD', { expectsBleeding: false, fertilityDisplay: 'off' }), {
      expectsBleeding: false,
      fertilityDisplay: 'off',
      trackingOnly: true,
      fertility: { effective: 'off', forcedBy: FERTILITY_DISPLAY_FORCED_BY.TRACKING, userCanChange: false },
    });
  });
});

describe('server / mobile tracking parity', () => {
  it('the mobile copy resolves every mode × preference the same way', () => {
    const prefsList = [{}, { expectsBleeding: false }, { fertilityDisplay: 'off' }, { expectsBleeding: false, fertilityDisplay: 'off' }];
    for (const mode of [...CYCLE_PROFILE_MODES, null]) {
      for (const prefs of prefsList) {
        for (const contraceptionHidesFertility of [false, true]) {
          const opts = { contraceptionHidesFertility };
          assert.deepEqual(mobileMatrix.resolveCycleTracking(mode, prefs, opts), resolveCycleTracking(mode, prefs, opts));
          assert.deepEqual(mobileMatrix.presentationCapabilitiesFor(mode, prefs, opts), presentationCapabilitiesFor(mode, prefs, opts));
        }
      }
    }
  });
});
