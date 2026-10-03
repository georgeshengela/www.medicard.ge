import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
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
import { cycleModeCapabilities } from './cycleModes.js';

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

describe('Cycle presentation capability matrix (mobile)', () => {
  it('matches the documented five-mode matrix', () => {
    for (const mode of CYCLE_PROFILE_MODES) {
      assert.deepEqual(cycleModeCapabilities(mode), EXPECTED[mode], mode);
      assert.deepEqual(presentationCapabilitiesForProfileMode(mode), EXPECTED[mode]);
      for (const key of PRESENTATION_CAPABILITY_KEYS) {
        assert.equal(supportsCycleCapability(mode, key), EXPECTED[mode][key], `${mode}.${key}`);
      }
    }
  });

  it('does not store duplicate isXMode flags on the capability object', () => {
    const cap = cycleModeCapabilities('PREGNANCY');
    assert.equal(Object.hasOwn(cap, 'isPregnancyMode'), false);
    assert.equal(Object.hasOwn(cap, 'isTtcMode'), false);
    assert.equal(Object.hasOwn(cap, 'isPeriMode'), false);
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
