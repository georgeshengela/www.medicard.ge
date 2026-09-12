/**
 * Cycle observation registry — Phase 11.
 * Canonical types only. Mobile strings are not trusted.
 * New keys default AI=DENY, partner=DENY until explicitly reviewed.
 * Unknown keys are rejected on write and excluded from AI/partner reads.
 */

export const OBSERVATION_SCHEMA_VERSION = 1;

export const TREND_MIN_OCCURRENCES = 2;
export const TREND_MIN_POINTS = 3;
export const TREND_RECURRENCE_OCCURRENCES = 3;

export const TREND_GROUPS = Object.freeze({
  PAIN: 'pain',
  ENERGY: 'energy',
  DIGESTION: 'digestion',
  SKIN: 'skin',
  PHYSICAL: 'physical',
});

export const VALUE_TYPES = Object.freeze({
  BOOLEAN: 'BOOLEAN',
  ENUM: 'ENUM',
  SEVERITY: 'SEVERITY',
  NUMBER: 'NUMBER',
  MEASUREMENT: 'MEASUREMENT',
  TEXT: 'TEXT',
});

export const OBSERVATION_CATEGORIES = Object.freeze({
  MENSTRUAL: 'menstrual',
  PHYSICAL: 'physical',
  PAIN: 'pain',
  MOOD: 'mood',
  ENERGY: 'energy',
  SLEEP: 'sleep',
  DIGESTION: 'digestion',
  SKIN: 'skin',
  HEADACHE: 'headache',
  DISCHARGE: 'discharge',
  FERTILITY: 'fertility_observation',
  SEXUAL_HEALTH: 'sexual_health',
  PREGNANCY_TEST: 'pregnancy_test',
  MEDICATION: 'medication_contraception',
  LIFESTYLE: 'lifestyle',
  FREE_TEXT: 'free_text',
  CUSTOM_TAG: 'custom_tag',
});

export const SENSITIVITY = Object.freeze({
  HEALTH: 'HEALTH',
  SENSITIVE: 'SENSITIVE',
  HIGHLY_SENSITIVE: 'HIGHLY_SENSITIVE',
});

export const CARDINALITY = Object.freeze({
  ONE: 'one',
  SET: 'set',
  MULTI: 'multi',
});

export const STORAGE = Object.freeze({
  COLUMN: 'column',
  SYMPTOMS: 'symptoms',
  MOODS: 'moods',
  PAIN: 'painEntries',
  OBSERVATIONS: 'observations',
  PROFILE: 'profile',
  TAGS: 'customTagIds',
});

export const ENGINE_ROLE = Object.freeze({
  INPUT: 'engine_input',
  PRESENTATION: 'presentation_only',
});

/** Clinician-facing Cycle doctor summary. New keys default EXCLUDE. */
export const DOCTOR_SUMMARY = Object.freeze({
  EXCLUDE: 'EXCLUDE',
  INCLUDE: 'INCLUDE',
  INCLUDE_IF_NONEMPTY: 'INCLUDE_IF_NONEMPTY',
  INCLUDE_WITH_REDACTION: 'INCLUDE_WITH_REDACTION',
  REQUIRES_EXPLICIT_USER_OPT_IN: 'REQUIRES_EXPLICIT_USER_OPT_IN',
});

export const UI_GROUPS = Object.freeze({
  PHYSICAL: 'physical',
  ENERGY: 'energy',
  MOOD: 'mood',
  DIGESTION: 'digestion',
  SKIN: 'skin',
  FERTILITY: 'fertility',
  PRIVATE: 'private',
});

export const PRODUCT_MODES = Object.freeze({
  CYCLE_TRACKING: 'CYCLE_TRACKING',
  TRYING_TO_CONCEIVE: 'TRYING_TO_CONCEIVE',
  PREGNANCY: 'PREGNANCY',
  PERIMENOPAUSE: 'PERIMENOPAUSE',
  POSTPARTUM: 'POSTPARTUM',
});

export const ENERGY_LEVELS = Object.freeze(['very_low', 'low', 'normal', 'high', 'very_high']);
export const SLEEP_QUALITIES = Object.freeze(['poor', 'okay', 'good']);
export const STRESS_LEVELS = Object.freeze(['low', 'medium', 'high']);
export const EXERCISE_LEVELS = Object.freeze(['none', 'light', 'moderate', 'intense']);
export const CAFFEINE_LEVELS = Object.freeze(['none', 'low', 'moderate', 'high']);
export const ALCOHOL_LEVELS = Object.freeze(['none', 'light', 'moderate', 'heavy']);
export const FLOW_VALUES = Object.freeze(['none', 'spotting', 'light', 'medium', 'heavy']);
export const MUCUS_VALUES = Object.freeze(['dry', 'sticky', 'creamy', 'watery', 'eggwhite']);
export const TEST_RESULTS = Object.freeze(['negative', 'positive', 'unclear']);
export const PAIN_TYPES = Object.freeze([
  'cramps',
  'pelvic',
  'lower_back',
  'headache',
  'breast',
  'ovulation_side',
  'other',
]);
export const PAIN_SEVERITIES = Object.freeze(['mild', 'moderate', 'severe']);

export const PAIN_MANAGED_SYMPTOM_IDS = Object.freeze([
  'cramps',
  'headache',
  'back_pain',
  'breast_tenderness',
  'pelvic_pain',
  'ovulation_pain',
]);

export const PAIN_SYMPTOM_TO_TYPE = Object.freeze({
  cramps: 'cramps',
  headache: 'headache',
  back_pain: 'lower_back',
  breast_tenderness: 'breast',
  pelvic_pain: 'pelvic',
  ovulation_pain: 'ovulation_side',
});

export const PAIN_TYPE_TO_SYMPTOM = Object.freeze({
  cramps: 'cramps',
  headache: 'headache',
  lower_back: 'back_pain',
  breast: 'breast_tenderness',
  pelvic: 'pelvic_pain',
  ovulation_side: 'ovulation_pain',
});

const ALL_MODES = Object.freeze(Object.values(PRODUCT_MODES));

function def(key, spec) {
  return Object.freeze({
    key,
    category: spec.category,
    valueType: spec.valueType,
    allowedValues: spec.allowedValues ? Object.freeze([...spec.allowedValues]) : null,
    storage: spec.storage,
    column: spec.column || null,
    cardinality: spec.cardinality,
    sensitivity: spec.sensitivity,
    aiDefaultAllowed: Boolean(spec.aiDefaultAllowed),
    partnerDefaultAllowed: Boolean(spec.partnerDefaultAllowed),
    analyticsAllowed: Boolean(spec.analyticsAllowed),
    trendEligible: spec.trendEligible === true,
    pregnancyTrendEligible: spec.pregnancyTrendEligible === true,
    perimenopauseSummaryEligible: spec.perimenopauseSummaryEligible === true,
    assessmentEligible: spec.assessmentEligible === true,
    exposureRateEligible: spec.exposureRateEligible === true,
    exposureComparisonEligible: spec.exposureComparisonEligible === true,
    trendGroup: spec.trendGroup || null,
    minimumOccurrences: spec.minimumOccurrences ?? TREND_MIN_OCCURRENCES,
    minimumObservedDays: spec.minimumObservedDays ?? TREND_MIN_OCCURRENCES,
    displayPriority: spec.displayPriority ?? 100,
    engineRole: spec.engineRole || ENGINE_ROLE.PRESENTATION,
    modeVisibility: Object.freeze([...(spec.modeVisibility || ALL_MODES)]),
    uiGroup: spec.uiGroup || null,
    uiVisible: spec.uiVisible !== false,
    enabled: spec.enabled !== false,
    sourceDefault: spec.sourceDefault || 'manual',
    doctorSummary: spec.doctorSummary || DOCTOR_SUMMARY.EXCLUDE,
  });
}

function chip(key, category, extras = {}) {
  return def(key, {
    category,
    valueType: VALUE_TYPES.BOOLEAN,
    storage: STORAGE.SYMPTOMS,
    cardinality: CARDINALITY.SET,
    sensitivity: extras.sensitivity || SENSITIVITY.HEALTH,
    aiDefaultAllowed: Boolean(extras.ai),
    partnerDefaultAllowed: extras.partner ?? Boolean(extras.ai),
    analyticsAllowed: extras.analytics ?? Boolean(extras.ai),
    trendEligible: extras.trend === true,
    pregnancyTrendEligible: extras.pregnancyTrend === true,
    perimenopauseSummaryEligible: extras.periSummary === true,
    assessmentEligible: extras.assessment === true,
    exposureRateEligible: extras.exposureRate === true,
    exposureComparisonEligible: extras.exposureComparison === true,
    trendGroup: extras.trendGroup || null,
    minimumOccurrences: extras.minimumOccurrences,
    minimumObservedDays: extras.minimumObservedDays,
    displayPriority: extras.displayPriority,
    doctorSummary: extras.doctor,
    uiGroup: extras.uiGroup || UI_GROUPS.PHYSICAL,
    uiVisible: extras.uiVisible,
    enabled: extras.enabled,
  });
}

function mood(key, extras = {}) {
  return def(key, {
    category: OBSERVATION_CATEGORIES.MOOD,
    valueType: VALUE_TYPES.BOOLEAN,
    storage: STORAGE.MOODS,
    cardinality: CARDINALITY.SET,
    sensitivity: SENSITIVITY.HEALTH,
    aiDefaultAllowed: extras.ai !== false,
    partnerDefaultAllowed: extras.partner !== false,
    analyticsAllowed: extras.analytics !== false,
    perimenopauseSummaryEligible: extras.periSummary === true,
    uiGroup: UI_GROUPS.MOOD,
  });
}

const DEFINITIONS = [
  def('flow', {
    category: OBSERVATION_CATEGORIES.MENSTRUAL,
    valueType: VALUE_TYPES.ENUM,
    allowedValues: FLOW_VALUES,
    storage: STORAGE.COLUMN,
    column: 'flow',
    cardinality: CARDINALITY.ONE,
    sensitivity: SENSITIVITY.HEALTH,
    aiDefaultAllowed: true,
    partnerDefaultAllowed: true,
    analyticsAllowed: true,
    engineRole: ENGINE_ROLE.INPUT,
    pregnancyTrendEligible: true,
    perimenopauseSummaryEligible: true,
    uiGroup: null,
    doctorSummary: DOCTOR_SUMMARY.INCLUDE,
  }),

  def('pain', {
    category: OBSERVATION_CATEGORIES.PAIN,
    valueType: VALUE_TYPES.SEVERITY,
    allowedValues: PAIN_SEVERITIES,
    storage: STORAGE.PAIN,
    column: 'painEntries',
    cardinality: CARDINALITY.MULTI,
    sensitivity: SENSITIVITY.HEALTH,
    aiDefaultAllowed: true,
    partnerDefaultAllowed: false,
    analyticsAllowed: true,
    trendEligible: true,
    pregnancyTrendEligible: true,
    perimenopauseSummaryEligible: true,
    trendGroup: TREND_GROUPS.PAIN,
    displayPriority: 10,
    uiGroup: UI_GROUPS.PHYSICAL,
    doctorSummary: DOCTOR_SUMMARY.INCLUDE,
  }),

  chip('cramps', OBSERVATION_CATEGORIES.PAIN, { ai: true, uiGroup: UI_GROUPS.PHYSICAL, uiVisible: false }),
  chip('headache', OBSERVATION_CATEGORIES.HEADACHE, { ai: true, uiGroup: UI_GROUPS.PHYSICAL, uiVisible: false }),
  chip('back_pain', OBSERVATION_CATEGORIES.PAIN, { ai: true, uiVisible: false }),
  chip('breast_tenderness', OBSERVATION_CATEGORIES.PAIN, { ai: true, uiVisible: false }),
  chip('pelvic_pain', OBSERVATION_CATEGORIES.PAIN, { ai: true, uiVisible: false }),
  chip('ovulation_pain', OBSERVATION_CATEGORIES.PAIN, { ai: true, uiVisible: false }),
  chip('migraine', OBSERVATION_CATEGORIES.HEADACHE, {
    ai: true,
    trend: true,
    pregnancyTrend: true,
    periSummary: true,
    trendGroup: TREND_GROUPS.PHYSICAL,
    displayPriority: 50,
    doctor: DOCTOR_SUMMARY.INCLUDE,
  }),
  chip('joint_pain', OBSERVATION_CATEGORIES.PAIN, { ai: true }),
  chip('muscle_pain', OBSERVATION_CATEGORIES.PAIN, { ai: true }),
  chip('leg_cramps', OBSERVATION_CATEGORIES.PAIN, { ai: true, pregnancyTrend: true }),

  chip('bloating', OBSERVATION_CATEGORIES.DIGESTION, {
    ai: true,
    uiGroup: UI_GROUPS.DIGESTION,
    trend: true,
    pregnancyTrend: true,
    periSummary: true,
    trendGroup: TREND_GROUPS.DIGESTION,
    displayPriority: 30,
    doctor: DOCTOR_SUMMARY.INCLUDE,
  }),
  chip('nausea', OBSERVATION_CATEGORIES.DIGESTION, {
    ai: true,
    uiGroup: UI_GROUPS.DIGESTION,
    trend: true,
    pregnancyTrend: true,
    assessment: true,
    exposureRate: true,
    exposureComparison: true,
    trendGroup: TREND_GROUPS.DIGESTION,
    displayPriority: 30,
    doctor: DOCTOR_SUMMARY.INCLUDE,
  }),
  chip('vomiting', OBSERVATION_CATEGORIES.DIGESTION, {
    ai: true,
    uiGroup: UI_GROUPS.DIGESTION,
    trend: true,
    pregnancyTrend: true,
    assessment: true,
    exposureRate: true,
    exposureComparison: true,
    trendGroup: TREND_GROUPS.DIGESTION,
    displayPriority: 30,
    doctor: DOCTOR_SUMMARY.INCLUDE,
  }),
  chip('constipation', OBSERVATION_CATEGORIES.DIGESTION, {
    ai: true,
    uiGroup: UI_GROUPS.DIGESTION,
    trend: true,
    pregnancyTrend: true,
    periSummary: true,
    trendGroup: TREND_GROUPS.DIGESTION,
    displayPriority: 30,
    doctor: DOCTOR_SUMMARY.INCLUDE,
  }),
  chip('diarrhea', OBSERVATION_CATEGORIES.DIGESTION, {
    ai: true,
    uiGroup: UI_GROUPS.DIGESTION,
    trend: true,
    pregnancyTrend: true,
    periSummary: true,
    trendGroup: TREND_GROUPS.DIGESTION,
    displayPriority: 30,
    doctor: DOCTOR_SUMMARY.INCLUDE,
  }),
  chip('heartburn', OBSERVATION_CATEGORIES.DIGESTION, {
    ai: false,
    partner: false,
    analytics: false,
    pregnancyTrend: true,
    periSummary: true,
    uiGroup: UI_GROUPS.DIGESTION,
  }),
  chip('gas', OBSERVATION_CATEGORIES.DIGESTION, {
    ai: true,
    uiGroup: UI_GROUPS.DIGESTION,
    trend: true,
    trendGroup: TREND_GROUPS.DIGESTION,
    displayPriority: 30,
  }),
  chip('appetite_up', OBSERVATION_CATEGORIES.DIGESTION, { ai: true, uiGroup: UI_GROUPS.DIGESTION }),
  chip('appetite_down', OBSERVATION_CATEGORIES.DIGESTION, { ai: true, uiGroup: UI_GROUPS.DIGESTION }),
  chip('cravings', OBSERVATION_CATEGORIES.DIGESTION, { ai: true, uiGroup: UI_GROUPS.DIGESTION }),

  chip('acne', OBSERVATION_CATEGORIES.SKIN, {
    ai: true,
    uiGroup: UI_GROUPS.SKIN,
    trend: true,
    trendGroup: TREND_GROUPS.SKIN,
    displayPriority: 40,
    doctor: DOCTOR_SUMMARY.INCLUDE,
  }),
  chip('dry_skin', OBSERVATION_CATEGORIES.SKIN, {
    ai: true,
    uiGroup: UI_GROUPS.SKIN,
    trend: true,
    trendGroup: TREND_GROUPS.SKIN,
    displayPriority: 40,
  }),
  chip('oily_skin', OBSERVATION_CATEGORIES.SKIN, {
    ai: false,
    uiGroup: UI_GROUPS.SKIN,
    trend: true,
    trendGroup: TREND_GROUPS.SKIN,
    displayPriority: 40,
  }),
  chip('itchy_skin', OBSERVATION_CATEGORIES.SKIN, {
    ai: true,
    uiGroup: UI_GROUPS.SKIN,
    trend: true,
    trendGroup: TREND_GROUPS.SKIN,
    displayPriority: 40,
  }),
  chip('hair_loss', OBSERVATION_CATEGORIES.SKIN, {
    ai: true,
    uiGroup: UI_GROUPS.SKIN,
    trend: true,
    trendGroup: TREND_GROUPS.SKIN,
    displayPriority: 40,
    doctor: DOCTOR_SUMMARY.INCLUDE,
  }),

  chip('fatigue', OBSERVATION_CATEGORIES.ENERGY, {
    ai: true,
    uiGroup: UI_GROUPS.ENERGY,
    trend: true,
    pregnancyTrend: true,
    periSummary: true,
    assessment: true,
    exposureRate: true,
    exposureComparison: true,
    trendGroup: TREND_GROUPS.PHYSICAL,
    displayPriority: 50,
    doctor: DOCTOR_SUMMARY.INCLUDE,
  }),
  chip('insomnia', OBSERVATION_CATEGORIES.SLEEP, { ai: true, uiGroup: UI_GROUPS.ENERGY }),
  chip('oversleep', OBSERVATION_CATEGORIES.SLEEP, { ai: true, uiGroup: UI_GROUPS.ENERGY }),

  chip('breast_swelling', OBSERVATION_CATEGORIES.PHYSICAL, { ai: true }),
  chip('dizziness', OBSERVATION_CATEGORIES.PHYSICAL, {
    ai: true,
    trend: true,
    pregnancyTrend: true,
    periSummary: true,
    trendGroup: TREND_GROUPS.PHYSICAL,
    displayPriority: 50,
    doctor: DOCTOR_SUMMARY.INCLUDE,
  }),
  chip('hot_flashes', OBSERVATION_CATEGORIES.PHYSICAL, {
    ai: true,
    trend: true,
    periSummary: true,
    assessment: true,
    exposureRate: true,
    exposureComparison: true,
    trendGroup: TREND_GROUPS.PHYSICAL,
    displayPriority: 50,
    doctor: DOCTOR_SUMMARY.INCLUDE,
  }),
  chip('night_sweats', OBSERVATION_CATEGORIES.PHYSICAL, {
    ai: false,
    periSummary: true,
    assessment: true,
    exposureRate: true,
    exposureComparison: true,
  }),
  chip('chills', OBSERVATION_CATEGORIES.PHYSICAL, { ai: true }),
  chip('sweating', OBSERVATION_CATEGORIES.PHYSICAL, { ai: true }),
  chip('swelling', OBSERVATION_CATEGORIES.PHYSICAL, { ai: true, pregnancyTrend: true, periSummary: true }),
  chip('water_retention', OBSERVATION_CATEGORIES.PHYSICAL, { ai: true }),
  chip('sensitive_smell', OBSERVATION_CATEGORIES.PHYSICAL, { ai: true }),
  chip('tinnitus', OBSERVATION_CATEGORIES.PHYSICAL, { ai: true }),
  chip('palpitations', OBSERVATION_CATEGORIES.PHYSICAL, { ai: true }),
  chip('short_breath', OBSERVATION_CATEGORIES.PHYSICAL, { ai: true, pregnancyTrend: true }),
  chip('frequent_urination', OBSERVATION_CATEGORIES.PHYSICAL, { ai: true, pregnancyTrend: true }),
  chip('uti_feel', OBSERVATION_CATEGORIES.PHYSICAL, { ai: true }),
  chip('fever', OBSERVATION_CATEGORIES.PHYSICAL, { ai: true }),
  chip('cold_symptoms', OBSERVATION_CATEGORIES.PHYSICAL, { ai: true }),

  chip('discharge', OBSERVATION_CATEGORIES.DISCHARGE, {
    ai: false,
    partner: false,
    analytics: false,
    sensitivity: SENSITIVITY.SENSITIVE,
    uiGroup: UI_GROUPS.PHYSICAL,
    doctor: DOCTOR_SUMMARY.INCLUDE,
  }),
  chip('vaginal_dryness', OBSERVATION_CATEGORIES.SEXUAL_HEALTH, {
    ai: false,
    partner: false,
    analytics: false,
    sensitivity: SENSITIVITY.SENSITIVE,
    uiGroup: UI_GROUPS.PRIVATE,
    doctor: DOCTOR_SUMMARY.REQUIRES_EXPLICIT_USER_OPT_IN,
  }),
  chip('itching_vulva', OBSERVATION_CATEGORIES.SEXUAL_HEALTH, {
    ai: false,
    partner: false,
    analytics: false,
    sensitivity: SENSITIVITY.SENSITIVE,
    uiGroup: UI_GROUPS.PRIVATE,
    doctor: DOCTOR_SUMMARY.REQUIRES_EXPLICIT_USER_OPT_IN,
  }),

  chip('protected', OBSERVATION_CATEGORIES.SEXUAL_HEALTH, {
    ai: false,
    partner: false,
    analytics: false,
    sensitivity: SENSITIVITY.HIGHLY_SENSITIVE,
    uiGroup: UI_GROUPS.PRIVATE,
    doctor: DOCTOR_SUMMARY.REQUIRES_EXPLICIT_USER_OPT_IN,
  }),
  chip('unprotected', OBSERVATION_CATEGORIES.SEXUAL_HEALTH, {
    ai: false,
    partner: false,
    analytics: false,
    sensitivity: SENSITIVITY.HIGHLY_SENSITIVE,
    uiGroup: UI_GROUPS.PRIVATE,
    doctor: DOCTOR_SUMMARY.REQUIRES_EXPLICIT_USER_OPT_IN,
  }),
  chip('high_drive', OBSERVATION_CATEGORIES.SEXUAL_HEALTH, {
    ai: false,
    partner: false,
    analytics: false,
    sensitivity: SENSITIVITY.HIGHLY_SENSITIVE,
    uiGroup: UI_GROUPS.PRIVATE,
    doctor: DOCTOR_SUMMARY.REQUIRES_EXPLICIT_USER_OPT_IN,
  }),
  chip('low_drive', OBSERVATION_CATEGORIES.SEXUAL_HEALTH, {
    ai: false,
    partner: false,
    analytics: false,
    sensitivity: SENSITIVITY.HIGHLY_SENSITIVE,
    uiGroup: UI_GROUPS.PRIVATE,
    doctor: DOCTOR_SUMMARY.REQUIRES_EXPLICIT_USER_OPT_IN,
  }),
  chip('orgasm', OBSERVATION_CATEGORIES.SEXUAL_HEALTH, {
    ai: false,
    partner: false,
    analytics: false,
    sensitivity: SENSITIVITY.HIGHLY_SENSITIVE,
    uiGroup: UI_GROUPS.PRIVATE,
    doctor: DOCTOR_SUMMARY.REQUIRES_EXPLICIT_USER_OPT_IN,
  }),
  chip('pain_sex', OBSERVATION_CATEGORIES.SEXUAL_HEALTH, {
    ai: false,
    partner: false,
    analytics: false,
    sensitivity: SENSITIVITY.HIGHLY_SENSITIVE,
    uiGroup: UI_GROUPS.PRIVATE,
    doctor: DOCTOR_SUMMARY.REQUIRES_EXPLICIT_USER_OPT_IN,
  }),
  chip('sex', OBSERVATION_CATEGORIES.SEXUAL_HEALTH, {
    ai: false,
    partner: false,
    analytics: false,
    sensitivity: SENSITIVITY.HIGHLY_SENSITIVE,
    uiGroup: UI_GROUPS.PRIVATE,
    doctor: DOCTOR_SUMMARY.REQUIRES_EXPLICIT_USER_OPT_IN,
    uiVisible: false,
  }),
  chip('intercourse', OBSERVATION_CATEGORIES.SEXUAL_HEALTH, {
    ai: false,
    partner: false,
    analytics: false,
    sensitivity: SENSITIVITY.HIGHLY_SENSITIVE,
    uiGroup: UI_GROUPS.PRIVATE,
    doctor: DOCTOR_SUMMARY.REQUIRES_EXPLICIT_USER_OPT_IN,
    uiVisible: false,
  }),
  chip('sexual', OBSERVATION_CATEGORIES.SEXUAL_HEALTH, {
    ai: false,
    partner: false,
    analytics: false,
    sensitivity: SENSITIVITY.HIGHLY_SENSITIVE,
    uiGroup: UI_GROUPS.PRIVATE,
    doctor: DOCTOR_SUMMARY.REQUIRES_EXPLICIT_USER_OPT_IN,
    uiVisible: false,
  }),

  mood('energetic'),
  mood('calm'),
  mood('happy'),
  mood('confident'),
  mood('sensitive'),
  mood('anxious'),
  mood('irritable', { periSummary: true }),
  mood('angry'),
  mood('sad', { periSummary: true }),
  mood('tearful'),
  mood('mood_swings'),
  mood('focused'),
  mood('unfocused'),
  mood('tired_mood'),
  mood('apathetic'),
  mood('stressed'),
  mood('romantic'),
  mood('lonely'),

  def('energy', {
    category: OBSERVATION_CATEGORIES.ENERGY,
    valueType: VALUE_TYPES.ENUM,
    allowedValues: ENERGY_LEVELS,
    storage: STORAGE.OBSERVATIONS,
    cardinality: CARDINALITY.ONE,
    sensitivity: SENSITIVITY.HEALTH,
    aiDefaultAllowed: false,
    partnerDefaultAllowed: false,
    analyticsAllowed: false,
    trendEligible: true,
    pregnancyTrendEligible: true,
    perimenopauseSummaryEligible: true,
    trendGroup: TREND_GROUPS.ENERGY,
    displayPriority: 20,
    uiGroup: UI_GROUPS.ENERGY,
    doctorSummary: DOCTOR_SUMMARY.INCLUDE,
  }),
  def('sleepQuality', {
    category: OBSERVATION_CATEGORIES.SLEEP,
    valueType: VALUE_TYPES.ENUM,
    allowedValues: SLEEP_QUALITIES,
    storage: STORAGE.COLUMN,
    column: 'sleepQuality',
    cardinality: CARDINALITY.ONE,
    sensitivity: SENSITIVITY.HEALTH,
    aiDefaultAllowed: true,
    partnerDefaultAllowed: false,
    analyticsAllowed: true,
    perimenopauseSummaryEligible: true,
    uiGroup: UI_GROUPS.ENERGY,
    doctorSummary: DOCTOR_SUMMARY.INCLUDE,
  }),
  def('stressLevel', {
    category: OBSERVATION_CATEGORIES.MOOD,
    valueType: VALUE_TYPES.ENUM,
    allowedValues: STRESS_LEVELS,
    storage: STORAGE.COLUMN,
    column: 'stressLevel',
    cardinality: CARDINALITY.ONE,
    sensitivity: SENSITIVITY.HEALTH,
    aiDefaultAllowed: true,
    partnerDefaultAllowed: false,
    analyticsAllowed: true,
    uiGroup: UI_GROUPS.ENERGY,
    doctorSummary: DOCTOR_SUMMARY.INCLUDE,
  }),
  def('exerciseLevel', {
    category: OBSERVATION_CATEGORIES.LIFESTYLE,
    valueType: VALUE_TYPES.ENUM,
    allowedValues: EXERCISE_LEVELS,
    storage: STORAGE.COLUMN,
    column: 'exerciseLevel',
    cardinality: CARDINALITY.ONE,
    sensitivity: SENSITIVITY.HEALTH,
    aiDefaultAllowed: false,
    partnerDefaultAllowed: false,
    analyticsAllowed: true,
    uiGroup: UI_GROUPS.PHYSICAL,
  }),
  def('caffeine', {
    category: OBSERVATION_CATEGORIES.LIFESTYLE,
    valueType: VALUE_TYPES.ENUM,
    allowedValues: CAFFEINE_LEVELS,
    storage: STORAGE.COLUMN,
    column: 'caffeine',
    cardinality: CARDINALITY.ONE,
    sensitivity: SENSITIVITY.HEALTH,
    aiDefaultAllowed: false,
    partnerDefaultAllowed: false,
    analyticsAllowed: true,
    uiGroup: UI_GROUPS.PHYSICAL,
  }),
  def('alcohol', {
    category: OBSERVATION_CATEGORIES.LIFESTYLE,
    valueType: VALUE_TYPES.ENUM,
    allowedValues: ALCOHOL_LEVELS,
    storage: STORAGE.COLUMN,
    column: 'alcohol',
    cardinality: CARDINALITY.ONE,
    sensitivity: SENSITIVITY.HEALTH,
    aiDefaultAllowed: false,
    partnerDefaultAllowed: false,
    analyticsAllowed: true,
    uiGroup: UI_GROUPS.PHYSICAL,
  }),

  def('sexualActivity', {
    category: OBSERVATION_CATEGORIES.SEXUAL_HEALTH,
    valueType: VALUE_TYPES.BOOLEAN,
    storage: STORAGE.COLUMN,
    column: 'sexualActivity',
    cardinality: CARDINALITY.ONE,
    sensitivity: SENSITIVITY.HIGHLY_SENSITIVE,
    aiDefaultAllowed: false,
    partnerDefaultAllowed: false,
    analyticsAllowed: false,
    uiGroup: UI_GROUPS.PRIVATE,
    doctorSummary: DOCTOR_SUMMARY.REQUIRES_EXPLICIT_USER_OPT_IN,
  }),
  def('libido', {
    category: OBSERVATION_CATEGORIES.SEXUAL_HEALTH,
    valueType: VALUE_TYPES.NUMBER,
    storage: STORAGE.COLUMN,
    column: 'libido',
    cardinality: CARDINALITY.ONE,
    sensitivity: SENSITIVITY.HIGHLY_SENSITIVE,
    aiDefaultAllowed: false,
    partnerDefaultAllowed: false,
    analyticsAllowed: false,
    uiGroup: UI_GROUPS.PRIVATE,
    doctorSummary: DOCTOR_SUMMARY.REQUIRES_EXPLICIT_USER_OPT_IN,
  }),

  def('ovulationTest', {
    category: OBSERVATION_CATEGORIES.FERTILITY,
    valueType: VALUE_TYPES.ENUM,
    allowedValues: TEST_RESULTS,
    storage: STORAGE.COLUMN,
    column: 'ovulationTest',
    cardinality: CARDINALITY.ONE,
    sensitivity: SENSITIVITY.SENSITIVE,
    aiDefaultAllowed: true,
    partnerDefaultAllowed: false,
    analyticsAllowed: false,
    uiGroup: UI_GROUPS.FERTILITY,
    doctorSummary: DOCTOR_SUMMARY.REQUIRES_EXPLICIT_USER_OPT_IN,
  }),
  def('bbt', {
    category: OBSERVATION_CATEGORIES.FERTILITY,
    valueType: VALUE_TYPES.MEASUREMENT,
    storage: STORAGE.COLUMN,
    column: 'bbt',
    cardinality: CARDINALITY.ONE,
    sensitivity: SENSITIVITY.SENSITIVE,
    aiDefaultAllowed: true,
    partnerDefaultAllowed: false,
    analyticsAllowed: false,
    uiGroup: UI_GROUPS.FERTILITY,
    doctorSummary: DOCTOR_SUMMARY.REQUIRES_EXPLICIT_USER_OPT_IN,
  }),
  def('cervicalMucus', {
    category: OBSERVATION_CATEGORIES.FERTILITY,
    valueType: VALUE_TYPES.ENUM,
    allowedValues: MUCUS_VALUES,
    storage: STORAGE.COLUMN,
    column: 'cervicalMucus',
    cardinality: CARDINALITY.ONE,
    sensitivity: SENSITIVITY.SENSITIVE,
    aiDefaultAllowed: true,
    partnerDefaultAllowed: false,
    analyticsAllowed: false,
    uiGroup: UI_GROUPS.FERTILITY,
    doctorSummary: DOCTOR_SUMMARY.REQUIRES_EXPLICIT_USER_OPT_IN,
  }),
  def('pregnancyTest', {
    category: OBSERVATION_CATEGORIES.PREGNANCY_TEST,
    valueType: VALUE_TYPES.ENUM,
    allowedValues: TEST_RESULTS,
    storage: STORAGE.COLUMN,
    column: 'pregnancyTest',
    cardinality: CARDINALITY.ONE,
    sensitivity: SENSITIVITY.SENSITIVE,
    aiDefaultAllowed: true,
    partnerDefaultAllowed: false,
    analyticsAllowed: false,
    uiGroup: UI_GROUPS.FERTILITY,
    doctorSummary: DOCTOR_SUMMARY.REQUIRES_EXPLICIT_USER_OPT_IN,
  }),

  def('notes', {
    category: OBSERVATION_CATEGORIES.FREE_TEXT,
    valueType: VALUE_TYPES.TEXT,
    storage: STORAGE.COLUMN,
    column: 'notes',
    cardinality: CARDINALITY.ONE,
    sensitivity: SENSITIVITY.HIGHLY_SENSITIVE,
    aiDefaultAllowed: false,
    partnerDefaultAllowed: false,
    analyticsAllowed: false,
    trendEligible: false,
    uiGroup: UI_GROUPS.PRIVATE,
    doctorSummary: DOCTOR_SUMMARY.REQUIRES_EXPLICIT_USER_OPT_IN,
  }),
  def('customTagIds', {
    category: OBSERVATION_CATEGORIES.CUSTOM_TAG,
    valueType: VALUE_TYPES.TEXT,
    storage: STORAGE.TAGS,
    column: 'customTagIds',
    cardinality: CARDINALITY.SET,
    sensitivity: SENSITIVITY.HIGHLY_SENSITIVE,
    aiDefaultAllowed: false,
    partnerDefaultAllowed: false,
    analyticsAllowed: false,
    trendEligible: false,
    uiGroup: UI_GROUPS.PRIVATE,
    doctorSummary: DOCTOR_SUMMARY.EXCLUDE,
  }),

  def('contraceptionMethod', {
    category: OBSERVATION_CATEGORIES.MEDICATION,
    valueType: VALUE_TYPES.ENUM,
    storage: STORAGE.PROFILE,
    column: 'contraceptionMethod',
    cardinality: CARDINALITY.ONE,
    sensitivity: SENSITIVITY.SENSITIVE,
    aiDefaultAllowed: false,
    partnerDefaultAllowed: false,
    analyticsAllowed: false,
    uiVisible: false,
    enabled: true,
    doctorSummary: DOCTOR_SUMMARY.INCLUDE_IF_NONEMPTY,
  }),
  def('missed_pill', {
    category: OBSERVATION_CATEGORIES.MEDICATION,
    valueType: VALUE_TYPES.BOOLEAN,
    storage: STORAGE.OBSERVATIONS,
    cardinality: CARDINALITY.ONE,
    sensitivity: SENSITIVITY.SENSITIVE,
    aiDefaultAllowed: false,
    partnerDefaultAllowed: false,
    analyticsAllowed: false,
    uiVisible: false,
    enabled: false,
  }),
];

export const OBSERVATION_REGISTRY = Object.freeze(
  Object.fromEntries(DEFINITIONS.map((item) => [item.key, item])),
);

export function getObservationDef(key) {
  return OBSERVATION_REGISTRY[String(key || '')] || null;
}

export function isKnownObservationKey(key) {
  return Boolean(getObservationDef(key));
}

export function isEnabledObservationKey(key) {
  const defn = getObservationDef(key);
  return Boolean(defn?.enabled);
}

export function observationKeysByStorage(storage) {
  return Object.values(OBSERVATION_REGISTRY)
    .filter((item) => item.storage === storage && item.enabled)
    .map((item) => item.key);
}

export function observationKeysByGroup(group) {
  return Object.values(OBSERVATION_REGISTRY)
    .filter((item) => item.uiGroup === group && item.uiVisible && item.enabled)
    .map((item) => item.key);
}

export function isSensitiveObservation(key) {
  const defn = getObservationDef(key);
  if (!defn) return true;
  return (
    defn.sensitivity === SENSITIVITY.SENSITIVE || defn.sensitivity === SENSITIVITY.HIGHLY_SENSITIVE
  );
}

export function trendEligibleDefs() {
  return Object.values(OBSERVATION_REGISTRY).filter((item) => item.trendEligible && item.enabled);
}

export function pregnancyTrendEligibleDefs() {
  return Object.values(OBSERVATION_REGISTRY).filter((item) => item.pregnancyTrendEligible && item.enabled);
}

export function isPregnancyTrendEligible(key) {
  return Boolean(getObservationDef(key)?.pregnancyTrendEligible && getObservationDef(key)?.enabled);
}

export function perimenopauseSummaryEligibleDefs() {
  return Object.values(OBSERVATION_REGISTRY).filter(
    (item) => item.perimenopauseSummaryEligible && item.enabled,
  );
}

export function isPerimenopauseSummaryEligible(key) {
  return Boolean(getObservationDef(key)?.perimenopauseSummaryEligible && getObservationDef(key)?.enabled);
}

export function assessmentEligibleDefs() {
  return Object.values(OBSERVATION_REGISTRY).filter((item) => item.assessmentEligible && item.enabled);
}

export function isAssessmentEligible(key) {
  return Boolean(getObservationDef(key)?.assessmentEligible && getObservationDef(key)?.enabled);
}

export function isExposureRateEligible(key) {
  const defn = getObservationDef(key);
  return Boolean(defn?.enabled && defn.assessmentEligible && defn.exposureRateEligible);
}

export function exposureRateEligibleDefs() {
  return Object.values(OBSERVATION_REGISTRY).filter(
    (item) => item.exposureRateEligible && item.assessmentEligible && item.enabled,
  );
}

export function isExposureComparisonEligible(key) {
  const defn = getObservationDef(key);
  return Boolean(
    defn?.enabled &&
      defn.assessmentEligible &&
      defn.exposureRateEligible &&
      defn.exposureComparisonEligible,
  );
}

export function exposureComparisonEligibleDefs() {
  return Object.values(OBSERVATION_REGISTRY).filter(
    (item) =>
      item.exposureComparisonEligible &&
      item.exposureRateEligible &&
      item.assessmentEligible &&
      item.enabled,
  );
}

export function isHighlySensitiveObservation(key) {
  return getObservationDef(key)?.sensitivity === SENSITIVITY.HIGHLY_SENSITIVE;
}

export function observationAiAllowed(key) {
  return Boolean(getObservationDef(key)?.aiDefaultAllowed);
}

export function observationPartnerAllowed(key) {
  return Boolean(getObservationDef(key)?.partnerDefaultAllowed);
}

export function observationDoctorSummary(key) {
  return getObservationDef(key)?.doctorSummary || DOCTOR_SUMMARY.EXCLUDE;
}

export function engineInputKeys() {
  return Object.values(OBSERVATION_REGISTRY)
    .filter((item) => item.engineRole === ENGINE_ROLE.INPUT)
    .map((item) => item.key);
}

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

export function assertKnownWriteKey(key) {
  const defn = getObservationDef(key);
  if (!defn || !defn.enabled) {
    throw httpError(400, 'უცნობი აღრიცხვა.');
  }
  return defn;
}

export function parseEnumValue(value, allowed, { strict = false, field = 'value' } = {}) {
  if (value == null || value === '') return null;
  if (typeof value === 'string' && allowed.includes(value)) return value;
  if (strict) throw httpError(400, `არასწორი ${field}.`);
  return null;
}

export function parseObservationBag(raw, { strict = false } = {}) {
  if (raw == null || raw === '') return {};
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    if (strict) throw httpError(400, 'აღრიცხვები არასწორია.');
    return {};
  }
  const out = {};
  for (const [key, value] of Object.entries(raw)) {
    const defn = getObservationDef(key);
    if (!defn || defn.storage !== STORAGE.OBSERVATIONS || !defn.enabled) {
      if (strict) throw httpError(400, 'უცნობი აღრიცხვა.');
      continue;
    }
    if (value == null || value === '') continue;
    if (defn.valueType === VALUE_TYPES.ENUM) {
      const parsed = parseEnumValue(value, defn.allowedValues, { strict, field: key });
      if (parsed) out[key] = parsed;
      continue;
    }
    if (defn.valueType === VALUE_TYPES.BOOLEAN) {
      if (typeof value !== 'boolean') {
        if (strict) throw httpError(400, `არასწორი ${key}.`);
        continue;
      }
      out[key] = value;
      continue;
    }
    if (strict) throw httpError(400, `არასწორი ${key}.`);
  }
  return out;
}

export function mergeObservationBag(existing, incoming, { strict = false } = {}) {
  const base = parseObservationBag(existing, { strict: false });
  if (incoming === undefined) return base;
  if (incoming == null) return {};
  if (typeof incoming !== 'object' || Array.isArray(incoming)) {
    if (strict) throw httpError(400, 'აღრიცხვები არასწორია.');
    return base;
  }
  for (const [key, value] of Object.entries(incoming)) {
    const defn = getObservationDef(key);
    if (!defn || defn.storage !== STORAGE.OBSERVATIONS || !defn.enabled) {
      if (strict) throw httpError(400, 'უცნობი აღრიცხვა.');
      continue;
    }
    if (value == null || value === '') {
      delete base[key];
      continue;
    }
    const parsed = parseObservationBag({ [key]: value }, { strict });
    if (parsed[key] !== undefined) base[key] = parsed[key];
  }
  return base;
}

export function parseKeyedList(raw, storage, { strict = false } = {}) {
  if (raw == null) return [];
  if (!Array.isArray(raw)) {
    if (strict) throw httpError(400, 'აღრიცხვა არასწორია.');
    return [];
  }
  const out = [];
  const seen = new Set();
  for (const item of raw) {
    const key = String(item || '');
    if (!key || seen.has(key)) continue;
    const defn = getObservationDef(key);
    if (!defn || defn.storage !== storage || !defn.enabled) {
      if (strict) throw httpError(400, 'უცნობი აღრიცხვა.');
      continue;
    }
    seen.add(key);
    out.push(key);
  }
  return out;
}

export function stripPainManagedSymptoms(symptoms, painEntries = []) {
  const covered = new Set();
  for (const entry of Array.isArray(painEntries) ? painEntries : []) {
    const mapped = PAIN_TYPE_TO_SYMPTOM[entry?.type];
    if (mapped) covered.add(mapped);
  }
  return (Array.isArray(symptoms) ? symptoms : []).filter((key) => {
    if (!PAIN_MANAGED_SYMPTOM_IDS.includes(key)) return true;
    return !covered.has(key);
  });
}

export function visibleSymptomKeys(log, { includeSensitive = true } = {}) {
  const pain = Array.isArray(log?.painEntries) ? log.painEntries : [];
  const keys = stripPainManagedSymptoms(Array.isArray(log?.symptoms) ? log.symptoms : [], pain);
  return keys.filter((key) => {
    const defn = getObservationDef(key);
    if (!defn) return false;
    if (!includeSensitive && isSensitiveObservation(key)) return false;
    return true;
  });
}

export function recentObservationKeys(logs, { limit = 4, minDays = 2, excludeSensitive = true } = {}) {
  const counts = new Map();
  const lastSeen = new Map();
  const rows = Array.isArray(logs) ? [...logs] : [];
  rows.sort((a, b) => String(b?.date || '').localeCompare(String(a?.date || '')));
  for (const log of rows) {
    const date = String(log?.date || '');
    const keys = [
      ...visibleSymptomKeys(log, { includeSensitive: !excludeSensitive }),
      ...(Array.isArray(log?.moods) ? log.moods.map(String) : []),
    ];
    const bag = parseObservationBag(log?.observations);
    if (bag.energy) keys.push('energy');
    for (const key of keys) {
      if (excludeSensitive && isSensitiveObservation(key)) continue;
      if (PAIN_MANAGED_SYMPTOM_IDS.includes(key)) continue;
      const defn = getObservationDef(key);
      if (!defn?.uiVisible) continue;
      const seenDates = counts.get(key) || new Set();
      if (date) seenDates.add(date);
      counts.set(key, seenDates);
      if (!lastSeen.has(key)) lastSeen.set(key, date);
    }
  }
  return [...counts.entries()]
    .filter(([, dates]) => dates.size >= minDays)
    .sort((a, b) => String(lastSeen.get(b[0]) || '').localeCompare(String(lastSeen.get(a[0]) || '')))
    .slice(0, limit)
    .map(([key]) => key);
}

export function observationsHasValue(observations) {
  const bag = parseObservationBag(observations);
  return Object.keys(bag).length > 0;
}
