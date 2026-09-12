import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  CYCLE_PROFILE_MODES,
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
