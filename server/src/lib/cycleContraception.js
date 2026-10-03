/**
 * Cycle contraception interpretation — presentation/availability only.
 * Does not change cycle length, ovulation formula, or period inference.
 *
 * method null  = never asked (NOT_SET)
 * method NONE  = user said they use no contraception
 */

import { hideFertilePhase } from './cycleForecastHonesty.js';
import { resolveCycleTracking } from './cycleModeCapabilityMatrix.js';

export const CONTRACEPTION_METHODS = [
  'NONE',
  'COMBINED_PILL',
  'PROGESTIN_PILL',
  'HORMONAL_IUD',
  'COPPER_IUD',
  'IMPLANT',
  'INJECTION',
  'PATCH',
  'VAGINAL_RING',
  'BARRIER',
  'FERTILITY_AWARENESS',
  'OTHER',
];

const METHOD_SET = new Set(CONTRACEPTION_METHODS);

/** Systemic / implant hormones that commonly suppress or scramble ovulation timing. */
const LIMITED_METHODS = new Set([
  'COMBINED_PILL',
  'PROGESTIN_PILL',
  'IMPLANT',
  'INJECTION',
  'PATCH',
  'VAGINAL_RING',
]);

/** Hormonal IUD is often local; ovulation may continue — caution, not hide. */
const CAUTION_METHODS = new Set(['HORMONAL_IUD', 'FERTILITY_AWARENESS', 'OTHER']);

/** Generally inconsistent with trying to conceive. Barrier and FAM are not. */
const TTC_INCONSISTENT = new Set([
  'COMBINED_PILL',
  'PROGESTIN_PILL',
  'HORMONAL_IUD',
  'COPPER_IUD',
  'IMPLANT',
  'INJECTION',
  'PATCH',
  'VAGINAL_RING',
]);

const LIMITED_PHASE_KA = 'კალენდარული ფაზა ამ მეთოდისას ნაკლებად მნიშვნელოვანია';
const LIMITED_PHASE_EN = 'The calendar phase matters less with this method';

const limitedPhaseLabel = (lang) => (lang === 'en' ? LIMITED_PHASE_EN : LIMITED_PHASE_KA);

export function isContraceptionMethod(value) {
  return METHOD_SET.has(value);
}

export function normalizeContraceptionMethod(value) {
  if (value == null || value === '') return null;
  const key = String(value).trim().toUpperCase();
  return METHOD_SET.has(key) ? key : null;
}

export function contraceptionCategory(method) {
  if (method == null) return 'unset';
  if (method === 'NONE') return 'none';
  if (method === 'BARRIER') return 'barrier';
  if (method === 'COPPER_IUD') return 'copper_iud';
  if (method === 'HORMONAL_IUD') return 'hormonal_iud';
  if (method === 'FERTILITY_AWARENESS') return 'fam';
  if (method === 'OTHER') return 'other';
  if (LIMITED_METHODS.has(method)) return 'hormonal';
  return 'other';
}

export function predictionAvailabilityFor(method) {
  if (LIMITED_METHODS.has(method)) return 'LIMITED';
  if (CAUTION_METHODS.has(method)) return 'CAUTION';
  return 'NORMAL';
}

export function interpretContraception(profile = {}, { todayLog = null, lang = 'ka' } = {}) {
  const method = normalizeContraceptionMethod(profile.contraceptionMethod);
  const startedAt =
    typeof profile.contraceptionStartedAt === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(profile.contraceptionStartedAt)
      ? profile.contraceptionStartedAt
      : null;
  const availability = predictionAvailabilityFor(method);
  const category = contraceptionCategory(method);
  const loggedBleed =
    todayLog?.flow === 'light' || todayLog?.flow === 'medium' || todayLog?.flow === 'heavy';
  const limited = availability === 'LIMITED';
  const caution = availability === 'CAUTION';
  const mode = profile.mode || 'TRACK_PERIOD';
  const ttcConflict = mode === 'TRY_TO_CONCEIVE' && TTC_INCONSISTENT.has(method);

  return {
    method,
    startedAt,
    set: method != null,
    category,
    predictionAvailability: availability,
    ttcConflict,
    bleedingLabel: limited ? 'bleeding' : 'period',
    presentation: {
      showFertilityMarkers: !limited,
      showOvulationDate: !limited,
      showFertileWindow: !limited,
      showPhaseAsBiological: !limited,
      emphasizeFertility: availability === 'NORMAL',
      phaseLabelOverride: limited ? limitedPhaseLabel(lang) : null,
      loggedBleedKeepsPeriod: loggedBleed,
      famNotCertified: method === 'FERTILITY_AWARENESS',
      showContextCard: limited || caution,
      contextKind: limited ? 'limited' : caution ? 'caution' : null,
    },
  };
}

/**
 * „ნაყოფიერი დღეების ჩვენება“ + Tracking (brief §9 wave 2 item 17) on top of the contraception rules.
 * `prefs` = `{ expectsBleeding, fertilityDisplay }` (missing = defaults). The contraception rules stay the
 * single source of „hormonal contraception hides fertility“: when they already hide it the display is
 * forced off; otherwise her own „off“ (TRACK_PERIOD) or Tracking turns the same three presentation flags
 * off, so every reader of `presentation.showFertileWindow` — this app, older builds, the web portal,
 * insights — hides fertile days without knowing the new preference. TTC forces the display on.
 * Adds `presentation.fertilityDisplay` (`{ setting, effective, forcedBy, userCanChange }`) and
 * `presentation.fertilityHidden` (true only when this step hid fertility). Input is not mutated.
 */
export function applyFertilityDisplay(contraception, { mode = null, prefs = null } = {}) {
  if (!contraception || typeof contraception !== 'object') return contraception;
  const presentation = contraception.presentation || {};
  const tracking = resolveCycleTracking(mode, prefs, {
    contraceptionHidesFertility: presentation.showFertileWindow === false,
  });
  const fertilityDisplay = {
    setting: tracking.fertilityDisplay,
    effective: tracking.fertility.effective,
    forcedBy: tracking.fertility.forcedBy,
    userCanChange: tracking.fertility.userCanChange,
  };
  // Only her choice and Tracking hide anything here; modes without fertile days are gated by the
  // capability matrix already, and contraception has hidden it above.
  const hide =
    tracking.fertility.effective === 'off' &&
    (tracking.fertility.forcedBy === null || tracking.fertility.forcedBy === 'tracking');
  return {
    ...contraception,
    presentation: {
      ...presentation,
      ...(hide
        ? {
            showFertilityMarkers: false,
            showOvulationDate: false,
            showFertileWindow: false,
            emphasizeFertility: false,
          }
        : {}),
      fertilityHidden: hide,
      fertilityDisplay,
    },
  };
}

/** Fertile / ovulation days and words gone, follicular / luteal kept (her „off“ or Tracking). */
function hideFertilityFromPredictions(predictions, { avgCycleLength, lang }) {
  const calendar = {};
  for (const [key, mark] of Object.entries(predictions.calendar || {})) {
    if (!mark || typeof mark !== 'object') {
      calendar[key] = mark;
      continue;
    }
    const { fertile, ovulation, ...rest } = mark;
    let copy = rest;
    if (copy.phase === 'fertile' || copy.phase === 'ovulation') {
      const info = hideFertilePhase({ day: copy.cycleDay ?? null, phase: copy.phase, phaseKa: copy.phaseKa }, { avgCycleLength, lang });
      copy = { ...copy, phase: info.phase, phaseKa: info.phaseKa };
    }
    // A day that was only a fertile estimate is no longer an estimate of anything.
    if ((fertile || ovulation) && !copy.period && copy.predicted !== false && copy.estimated) {
      copy = { ...copy, estimated: Boolean(copy.predicted) };
    }
    calendar[key] = copy;
  }
  return {
    ...predictions,
    ovulationDate: null,
    ovulationRange: null,
    fertileWindow: null,
    fertility: predictions.fertility
      ? { ...predictions.fertility, window: null, ovulationSource: null, retrospective: false, pastOvulations: [], hidden: true }
      : predictions.fertility,
    phases: (predictions.phases || []).map((p) => ({
      ...p,
      ovulation: null,
      ovulationStart: null,
      ovulationEnd: null,
      ovulationSource: null,
      fertileStart: null,
      fertileEnd: null,
      fertileWindowKind: null,
    })),
    calendar,
  };
}

/** Strip fertility emphasis from a predictions calendar. Engine output is not mutated. */
export function presentPredictions(predictions, contraception, lang = 'ka', { avgCycleLength = 28 } = {}) {
  if (!predictions) return predictions;
  const presented = {
    ...predictions,
    calendar: { ...(predictions.calendar || {}) },
  };
  if (contraception?.predictionAvailability !== 'LIMITED') {
    return contraception?.presentation?.fertilityHidden === true
      ? hideFertilityFromPredictions(presented, { avgCycleLength, lang })
      : presented;
  }

  const override = contraception.presentation?.phaseLabelOverride || limitedPhaseLabel(lang);
  for (const [key, mark] of Object.entries(presented.calendar)) {
    if (!mark || typeof mark !== 'object') continue;
    const copy = { ...mark };
    delete copy.fertile;
    delete copy.ovulation;
    if (
      copy.phase === 'fertile' ||
      copy.phase === 'ovulation' ||
      copy.phase === 'follicular' ||
      copy.phase === 'luteal'
    ) {
      copy.phase = 'unknown';
      copy.phaseKa = override;
    }
    presented.calendar[key] = copy;
  }
  // Hormonal methods: past cycles' own ovulation signals (temperature included) are not shown either.
  if (presented.fertility) presented.fertility = { ...presented.fertility, retrospective: false, pastOvulations: [] };
  return presented;
}

export function presentTodayPhase(todayPhase, contraception, lang = 'ka', { avgCycleLength = 28 } = {}) {
  if (!todayPhase) return { day: null, phase: 'unknown', phaseKa: lang === 'en' ? 'Unknown phase' : 'უცნობი ფაზა' };
  if (contraception?.predictionAvailability !== 'LIMITED') {
    return contraception?.presentation?.fertilityHidden === true
      ? hideFertilePhase(todayPhase, { avgCycleLength, lang })
      : todayPhase;
  }
  if (todayPhase.phase === 'period' || contraception.presentation?.loggedBleedKeepsPeriod) {
    return todayPhase;
  }
  return {
    day: todayPhase.day,
    phase: 'unknown',
    phaseKa: contraception.presentation?.phaseLabelOverride || limitedPhaseLabel(lang),
  };
}

export function contraceptionInsightsFilter(cards, contraception) {
  const list = Array.isArray(cards) ? cards : [];
  if (contraception?.presentation?.fertilityHidden === true) {
    return list.filter((card) => String(card?.id || '') !== 'ttc_window');
  }
  if (contraception?.predictionAvailability !== 'LIMITED') return list;
  return list.filter((card) => {
    const id = String(card?.id || '');
    return id !== 'ttc_window' && id !== 'phase_today';
  });
}

export { CYCLE_CONTRACEPTION_AI_RULES } from './cycleHonesty.js';
