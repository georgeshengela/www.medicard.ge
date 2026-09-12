import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  CYCLE_PRESENTATION_CAPABILITIES,
  CYCLE_PROFILE_MODES,
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
