/**
 * Cycle contraception interpretation — presentation/availability only.
 * Does not change cycle length, ovulation formula, or period inference.
 *
 * method null  = never asked (NOT_SET)
 * method NONE  = user said they use no contraception
 */

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

export function interpretContraception(profile = {}, { todayLog = null } = {}) {
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
      phaseLabelOverride: limited ? LIMITED_PHASE_KA : null,
      loggedBleedKeepsPeriod: loggedBleed,
      famNotCertified: method === 'FERTILITY_AWARENESS',
      showContextCard: limited || caution,
      contextKind: limited ? 'limited' : caution ? 'caution' : null,
    },
  };
}

/** Strip fertility emphasis from a predictions calendar. Engine output is not mutated. */
export function presentPredictions(predictions, contraception) {
  if (!predictions) return predictions;
  const presented = {
    ...predictions,
    calendar: { ...(predictions.calendar || {}) },
  };
  if (contraception?.predictionAvailability !== 'LIMITED') return presented;

  const override = contraception.presentation?.phaseLabelOverride || LIMITED_PHASE_KA;
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
  return presented;
}

export function presentTodayPhase(todayPhase, contraception) {
  if (!todayPhase) return { day: null, phase: 'unknown', phaseKa: 'უცნობი ფაზა' };
  if (contraception?.predictionAvailability !== 'LIMITED') return todayPhase;
  if (todayPhase.phase === 'period' || contraception.presentation?.loggedBleedKeepsPeriod) {
    return todayPhase;
  }
  return {
    day: todayPhase.day,
    phase: 'unknown',
    phaseKa: contraception.presentation?.phaseLabelOverride || LIMITED_PHASE_KA,
  };
}

export function contraceptionInsightsFilter(cards, contraception) {
  const list = Array.isArray(cards) ? cards : [];
  if (contraception?.predictionAvailability !== 'LIMITED') return list;
  return list.filter((card) => {
    const id = String(card?.id || '');
    return id !== 'ttc_window' && id !== 'phase_today';
  });
}

export { CYCLE_CONTRACEPTION_AI_RULES } from './cycleHonesty.js';
