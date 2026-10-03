/**
 * Cycle presentation capability matrix.
 * Profile mode → product availability. Not engine arithmetic. Not lifecycle.
 *
 * Keep in lockstep with mobile/src/lib/cycleModeCapabilityMatrix.js.
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
  /** „თვალყურის დევნება“ — TRACK_PERIOD with `expectsBleeding: false` (never a base mode row). */
  'showTrackingOverview',
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
    showTrackingOverview: Boolean(row.showTrackingOverview),
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

/*
 * „თვალყურის დევნება“ / Tracking and the fertile-days display switch (brief §9 wave 2 item 17, [კ-7]).
 * Not a sixth mode: two profile preferences that narrow what a mode may show.
 *
 *  - `expectsBleeding` (default true). false = „მენსტრუაციას არ ველი“ (hormonal IUD, implant, continuous
 *    pill, amenorrhoea). Only in TRACK_PERIOD: no next-period forecast, no late state, no countdown, no
 *    fertile window / ovulation; the overview becomes the neutral Tracking state. A manual new cycle
 *    start stays possible and never re-enables forecasts.
 *  - `fertilityDisplay` 'auto' | 'off' (default 'auto'). Off hides every fertile / ovulation mark, text and
 *    reminder. Forced off while the contraception rules already hide fertility (cycleContraception
 *    `presentation.showFertileWindow === false`), forced on while trying to conceive.
 * Missing fields (older rows, older app builds) read as the defaults.
 */

export const FERTILITY_DISPLAY_VALUES = Object.freeze(['auto', 'off']);

export const FERTILITY_DISPLAY_FORCED_BY = Object.freeze({
  /** The mode never shows fertile days (pregnancy, perimenopause, postpartum). */
  MODE: 'mode',
  /** Hormonal contraception: the existing contraception rules hide fertility. */
  CONTRACEPTION: 'contraception',
  /** `expectsBleeding: false` — nothing cycle-based is estimated. */
  TRACKING: 'tracking',
  /** Trying to conceive: the fertile days are the point of the mode. */
  TTC: 'ttc',
});

/** Stored preferences with defaults: `{ expectsBleeding, fertilityDisplay }`. */
export function normalizeCycleTrackingPrefs(raw) {
  return {
    expectsBleeding: raw?.expectsBleeding !== false,
    fertilityDisplay: raw?.fertilityDisplay === 'off' ? 'off' : 'auto',
  };
}

/** True when „მენსტრუაციას არ ველი“ applies: TRACK_PERIOD (or an unknown mode) with expectsBleeding false. */
export function trackingOnlyFor(mode, prefs) {
  const { expectsBleeding } = normalizeCycleTrackingPrefs(prefs);
  if (expectsBleeding) return false;
  return presentationCapabilitiesForProfileMode(mode) === CYCLE_PRESENTATION_CAPABILITIES.TRACK_PERIOD;
}

/**
 * The effective fertile-days display for a mode + preferences.
 * `contraceptionHidesFertility` = the server's contraception presentation already hides the window.
 * Returns `{ effective: 'on' | 'off', forcedBy: null | FERTILITY_DISPLAY_FORCED_BY.*, userCanChange }`.
 */
export function resolveFertilityDisplay(mode, prefs, { contraceptionHidesFertility = false } = {}) {
  const { fertilityDisplay } = normalizeCycleTrackingPrefs(prefs);
  const base = presentationCapabilitiesForProfileMode(mode);
  const forced = (effective, forcedBy) => ({ effective, forcedBy, userCanChange: false });
  if (!base.showFertileEstimates) return forced('off', FERTILITY_DISPLAY_FORCED_BY.MODE);
  if (contraceptionHidesFertility) return forced('off', FERTILITY_DISPLAY_FORCED_BY.CONTRACEPTION);
  if (trackingOnlyFor(mode, prefs)) return forced('off', FERTILITY_DISPLAY_FORCED_BY.TRACKING);
  if (base.showTtcOverview) return forced('on', FERTILITY_DISPLAY_FORCED_BY.TTC);
  return { effective: fertilityDisplay === 'off' ? 'off' : 'on', forcedBy: null, userCanChange: true };
}

/**
 * Everything the app / server needs about the two preferences at once:
 * `{ expectsBleeding, fertilityDisplay, trackingOnly, fertility: resolveFertilityDisplay(...) }`.
 */
export function resolveCycleTracking(mode, prefs, opts = {}) {
  const stored = normalizeCycleTrackingPrefs(prefs);
  return {
    ...stored,
    trackingOnly: trackingOnlyFor(mode, stored),
    fertility: resolveFertilityDisplay(mode, stored, opts),
  };
}

/** The mode's capability row narrowed by the two preferences (a new frozen object, never the base row). */
export function presentationCapabilitiesFor(mode, prefs, opts = {}) {
  const base = presentationCapabilitiesForProfileMode(mode);
  const tracking = resolveCycleTracking(mode, prefs, opts);
  // Only a change narrows the row; otherwise the mode's own (frozen) row is returned as is.
  const fertilityOff = tracking.fertility.effective === 'off' && (base.showFertileEstimates || base.showOvulationEstimate);
  if (!tracking.trackingOnly && !fertilityOff) return base;
  return Object.freeze({
    ...base,
    showNextPeriodForecast: tracking.trackingOnly ? false : base.showNextPeriodForecast,
    showLatePeriod: tracking.trackingOnly ? false : base.showLatePeriod,
    showFertileEstimates: fertilityOff ? false : base.showFertileEstimates,
    showOvulationEstimate: fertilityOff ? false : base.showOvulationEstimate,
    showTrackingOverview: tracking.trackingOnly,
  });
}
