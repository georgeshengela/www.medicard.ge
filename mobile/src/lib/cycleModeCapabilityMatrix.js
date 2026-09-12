/**
 * Cycle presentation capability matrix.
 * Profile mode → product availability. Not engine arithmetic. Not lifecycle.
 *
 * Keep in lockstep with server/src/lib/cycleModeCapabilityMatrix.js.
 */

export const CYCLE_PROFILE_MODES = Object.freeze([
  'TRACK_PERIOD',
  'TRY_TO_CONCEIVE',
  'PREGNANCY',
  'PERIMENOPAUSE',
  'POSTPARTUM',
]);

export const PRESENTATION_CAPABILITY_KEYS = Object.freeze([
  'showClassicCycleOverview',
  'showTtcOverview',
  'showPregnancyOverview',
  'showPregnancyTimeline',
  'showPregnancyWeekGuide',
  'showPregnancyObservations',
  'showPregnancyTrends',
  'showPregnancyCarePlanner',
  'showPerimenopauseTracking',
  'showVariabilityContext',
  'showPerimenopauseObservationSummaries',
  'showPostpartumOverview',
  'showPostpartumTracking',
  'showNextPeriodForecast',
  'showLatePeriod',
  'showFertileEstimates',
  'showOvulationEstimate',
  'showFertilityLogging',
  'showFertilityShortcuts',
  'showFertilityHistory',
  'showBbtHistory',
  'showOpkHistory',
  'showPregnancyTestLog',
]);

function expand(row) {
  return Object.freeze({
    showClassicCycleOverview: Boolean(row.showClassicCycleOverview),
    showTtcOverview: Boolean(row.showTtcOverview),
    showPregnancyOverview: Boolean(row.showPregnancyOverview),
    showPregnancyTimeline: Boolean(row.showPregnancyOverview),
    showPregnancyWeekGuide: Boolean(row.showPregnancyOverview),
    showPregnancyObservations: Boolean(row.showPregnancyOverview),
    showPregnancyTrends: Boolean(row.showPregnancyOverview),
    showPregnancyCarePlanner: Boolean(row.showPregnancyOverview),
    showPerimenopauseTracking: Boolean(row.showPerimenopauseTracking),
    showVariabilityContext: Boolean(row.showVariabilityContext),
    showPerimenopauseObservationSummaries: Boolean(row.showPerimenopauseTracking),
    showPostpartumOverview: Boolean(row.showPostpartumOverview),
    showPostpartumTracking: Boolean(row.showPostpartumTracking ?? row.showPostpartumOverview),
    showNextPeriodForecast: Boolean(row.showNextPeriodForecast),
    showLatePeriod: Boolean(row.showLatePeriod),
    showFertileEstimates: Boolean(row.showFertileEstimates),
    showOvulationEstimate: Boolean(row.showFertileEstimates),
    showFertilityLogging: Boolean(row.showFertilityLogging),
    showFertilityShortcuts: Boolean(row.showFertilityShortcuts),
    showFertilityHistory: Boolean(row.showFertilityHistory),
    showBbtHistory: Boolean(row.showFertilityHistory),
    showOpkHistory: Boolean(row.showFertilityHistory),
    showPregnancyTestLog: Boolean(row.showPregnancyTestLog),
  });
}

export const CYCLE_PRESENTATION_CAPABILITIES = Object.freeze({
  TRACK_PERIOD: expand({
    showClassicCycleOverview: true,
    showTtcOverview: false,
    showPregnancyOverview: false,
    showPerimenopauseTracking: false,
    showVariabilityContext: false,
    showPostpartumOverview: false,
    showPostpartumTracking: false,
    showNextPeriodForecast: true,
    showLatePeriod: true,
    showFertileEstimates: true,
    showFertilityLogging: true,
    showFertilityShortcuts: false,
    showFertilityHistory: false,
    showPregnancyTestLog: false,
  }),
  TRY_TO_CONCEIVE: expand({
    showClassicCycleOverview: true,
    showTtcOverview: true,
    showPregnancyOverview: false,
    showPerimenopauseTracking: false,
    showVariabilityContext: false,
    showPostpartumOverview: false,
    showPostpartumTracking: false,
    showNextPeriodForecast: true,
    showLatePeriod: true,
    showFertileEstimates: true,
    showFertilityLogging: true,
    showFertilityShortcuts: true,
    showFertilityHistory: true,
    showPregnancyTestLog: true,
  }),
  PREGNANCY: expand({
    showClassicCycleOverview: false,
    showTtcOverview: false,
    showPregnancyOverview: true,
    showPerimenopauseTracking: false,
    showVariabilityContext: false,
    showPostpartumOverview: false,
    showPostpartumTracking: false,
    showNextPeriodForecast: false,
    showLatePeriod: false,
    showFertileEstimates: false,
    showFertilityLogging: false,
    showFertilityShortcuts: false,
    showFertilityHistory: false,
    showPregnancyTestLog: true,
  }),
  PERIMENOPAUSE: expand({
    showClassicCycleOverview: false,
    showTtcOverview: false,
    showPregnancyOverview: false,
    showPerimenopauseTracking: true,
    showVariabilityContext: true,
    showPostpartumOverview: false,
    showPostpartumTracking: false,
    showNextPeriodForecast: true,
    showLatePeriod: false,
    showFertileEstimates: false,
    showFertilityLogging: false,
    showFertilityShortcuts: false,
    showFertilityHistory: false,
    showPregnancyTestLog: false,
  }),
  POSTPARTUM: expand({
    showClassicCycleOverview: false,
    showTtcOverview: false,
    showPregnancyOverview: false,
    showPerimenopauseTracking: false,
    showVariabilityContext: false,
    showPostpartumOverview: true,
    showPostpartumTracking: true,
    showNextPeriodForecast: false,
    showLatePeriod: false,
    showFertileEstimates: false,
    showFertilityLogging: false,
    showFertilityShortcuts: false,
    showFertilityHistory: false,
    showPregnancyTestLog: false,
  }),
});

export function presentationCapabilitiesForProfileMode(mode) {
  return (
    CYCLE_PRESENTATION_CAPABILITIES[mode] || CYCLE_PRESENTATION_CAPABILITIES.TRACK_PERIOD
  );
}

export function supportsCycleCapability(mode, capability) {
  return Boolean(presentationCapabilitiesForProfileMode(mode)[capability]);
}
