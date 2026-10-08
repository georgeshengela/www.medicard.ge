/**
 * Cycle AI / partner field classification.
 * Unknown keys are excluded by default. Do not pass raw CycleLog to EvidenceMD.
 * What may travel is decided by the registry (`observationAiContextAllowed`: HEALTH sensitivity and
 * aiDefaultAllowed), never by a hand list — BBT, ovulation / pregnancy tests, mucus, the ovulation
 * mark, sex and sex drive, intimate symptoms, notes and tags never reach an AI prompt (W3-5).
 */

import {
  OBSERVATION_CATEGORIES,
  OBSERVATION_REGISTRY,
  getObservationDef,
  observationAiContextAllowed,
  stripPainManagedSymptoms,
} from './cycleObservationRegistry.js';
import { parsePainEntries } from './cycleObservations.js';

export const CYCLE_FIELD_CATEGORIES = Object.freeze({
  GENERAL_CYCLE: 'general_cycle',
  GENERAL_WELLNESS: 'general_wellness',
  PAIN: 'pain',
  MOOD: 'mood',
  BLEEDING: 'bleeding',
  FERTILITY: 'fertility',
  SEXUAL_HEALTH: 'sexual_health',
  TTC: 'ttc',
  PREGNANCY: 'pregnancy',
  FREE_TEXT: 'free_text',
  PRIVATE_NOTES: 'private_notes',
  UNKNOWN: 'unknown',
});

/** Sex chips currently stored inside CycleLog.symptoms. Never AI/partner-visible. */
export const CYCLE_SEXUAL_SYMPTOM_KEYS = Object.freeze(
  Object.values(OBSERVATION_REGISTRY)
    .filter((item) => item.category === OBSERVATION_CATEGORIES.SEXUAL_HEALTH && item.storage === 'symptoms')
    .map((item) => item.key),
);

const SEXUAL_SET = new Set(CYCLE_SEXUAL_SYMPTOM_KEYS);

/** Physical / wellness chips that may enter CYCLE_WELLNESS. */
export const CYCLE_AI_SYMPTOM_ALLOWLIST = Object.freeze(
  Object.values(OBSERVATION_REGISTRY)
    .filter((item) => item.storage === 'symptoms' && observationAiContextAllowed(item.key))
    .map((item) => item.key),
);

export const CYCLE_AI_MOOD_ALLOWLIST = Object.freeze(
  Object.values(OBSERVATION_REGISTRY)
    .filter((item) => item.storage === 'moods' && observationAiContextAllowed(item.key))
    .map((item) => item.key),
);

const SYMPTOM_SET = new Set(CYCLE_AI_SYMPTOM_ALLOWLIST);
const MOOD_SET = new Set(CYCLE_AI_MOOD_ALLOWLIST);

/** Georgian labels for every AI-allowed symptom / mood key (same words as the app's chips). */
const SYMPTOM_KA = {
  cramps: 'სპაზმები', headache: 'თავის ტკივილი', back_pain: 'წელის ტკივილი', breast_tenderness: 'მკერდის მგრძნობელობა',
  pelvic_pain: 'მენჯის ტკივილი', ovulation_pain: 'ოვულაციის ტკივილი', migraine: 'მიგრენი', joint_pain: 'სახსრების ტკივილი',
  muscle_pain: 'კუნთების ტკივილი', leg_cramps: 'ფეხის სპაზმები', bloating: 'შებერილობა', nausea: 'გულისრევა', vomiting: 'ღებინება',
  constipation: 'ყაბზობა', diarrhea: 'დიარეა', gas: 'გაზები', heartburn: 'გულძმარვა', appetite_up: 'მადის მატება',
  appetite_down: 'მადის კლება', cravings: 'საკვების ლტოლვა', acne: 'აკნე', dry_skin: 'მშრალი კანი', itchy_skin: 'ქავილი',
  hair_loss: 'თმის ცვენა', fatigue: 'დაღლილობა', insomnia: 'უძილობა', oversleep: 'ძილიანობა', breast_swelling: 'მკერდის შეშუპება',
  dizziness: 'თავბრუსხვევა', hot_flashes: 'ცხელი ტალღები', chills: 'შეცივება', sweating: 'ოფლიანობა', swelling: 'შეშუპება',
  water_retention: 'წყლის შეკავება', sensitive_smell: 'სუნის მგრძნობელობა', tinnitus: 'ყურებში ხმაური', palpitations: 'გულის ფრიალი',
  short_breath: 'სუნთქვის სიმძიმე', frequent_urination: 'ხშირი შარდვა', uti_feel: 'შარდის დისკომფორტი', fever: 'ცხელება',
  cold_symptoms: 'გაციების სიმპტომები',
  energetic: 'ენერგიული', calm: 'მშვიდი', happy: 'ბედნიერი', confident: 'თავდაჯერებული', sensitive: 'მგრძნობიარე', anxious: 'შფოთვა',
  irritable: 'გაღიზიანება', angry: 'გაბრაზებული', sad: 'სევდიანი', tearful: 'ცრემლიანი', mood_swings: 'განწყობის ცვლა',
  focused: 'კონცენტრირებული', unfocused: 'გაფანტული', tired_mood: 'დაღლილი', apathetic: 'აპათიური', stressed: 'სტრესი',
  romantic: 'რომანტიკული', lonely: 'მარტოობა',
};

export function isSexualSymptomKey(key) {
  return SEXUAL_SET.has(String(key || ''));
}

export function classifyCycleSymptomKey(key) {
  const id = String(key || '');
  if (!id) return CYCLE_FIELD_CATEGORIES.UNKNOWN;
  const defn = getObservationDef(id);
  if (!defn) return CYCLE_FIELD_CATEGORIES.UNKNOWN;
  if (defn.category === OBSERVATION_CATEGORIES.SEXUAL_HEALTH) return CYCLE_FIELD_CATEGORIES.SEXUAL_HEALTH;
  if (!observationAiContextAllowed(id)) return CYCLE_FIELD_CATEGORIES.UNKNOWN;
  if (defn.storage === 'moods' || defn.category === OBSERVATION_CATEGORIES.MOOD) {
    return CYCLE_FIELD_CATEGORIES.MOOD;
  }
  return CYCLE_FIELD_CATEGORIES.GENERAL_WELLNESS;
}

export function partnerSafeSymptomKeys(keys = []) {
  return (Array.isArray(keys) ? keys : [])
    .map(String)
    .filter((key) => {
      const cat = classifyCycleSymptomKey(key);
      return cat === CYCLE_FIELD_CATEGORIES.GENERAL_WELLNESS || cat === CYCLE_FIELD_CATEGORIES.MOOD;
    });
}

function labelKey(key) {
  return SYMPTOM_KA[key] || key;
}

function addCat(set, cat) {
  if (cat) set.add(cat);
}

/** Fields the serializer itself formats (each gated by the registry rule). */
const SERIALIZED_LOG_FIELDS = new Set(['flow', 'symptoms', 'moods', 'painEntries', 'sleepQuality', 'stressLevel']);

/** Row bookkeeping that is not an observation. */
const NON_OBSERVATION_LOG_FIELDS = new Set([
  'id',
  'userId',
  'date',
  'createdAt',
  'updatedAt',
  'trackingContext',
  'schemaVersion',
  'source',
  'clientUpdatedAt',
  'user',
  'observationSchemaVersion',
  'observationAssessments',
  'postpartumEpisodeId',
]);

/**
 * CycleLog columns that hold fertility-tracking, intimate or private data. The serializer never reads
 * them; registered ones are SENSITIVE / HIGHLY_SENSITIVE in the registry, and columns without a
 * registry row (`bbtSource`, `wristTempDelta`) are pinned here explicitly. Tested.
 */
export const CYCLE_AI_PROTECTED_LOG_FIELDS = Object.freeze([
  'bbt',
  'bbtSource',
  'wristTempDelta',
  'ovulationTest',
  'pregnancyTest',
  'cervicalMucus',
  'sexualActivity',
  'libido',
  'notes',
  'customTagIds',
]);

const UNREGISTERED_FERTILITY_FIELDS = new Set(['bbtSource', 'wristTempDelta']);

function hasValue(value) {
  if (value == null || value === '') return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return true;
}

function observationBag(raw) {
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
}

/** Which excluded category a field / bag key reports under (names only — never values). */
function excludedCategoryFor(key) {
  if (UNREGISTERED_FERTILITY_FIELDS.has(key)) return CYCLE_FIELD_CATEGORIES.FERTILITY;
  const defn = getObservationDef(key);
  if (!defn) return CYCLE_FIELD_CATEGORIES.UNKNOWN;
  switch (defn.category) {
    case OBSERVATION_CATEGORIES.FERTILITY:
    case OBSERVATION_CATEGORIES.PREGNANCY_TEST:
      return CYCLE_FIELD_CATEGORIES.FERTILITY;
    case OBSERVATION_CATEGORIES.SEXUAL_HEALTH:
      return CYCLE_FIELD_CATEGORIES.SEXUAL_HEALTH;
    case OBSERVATION_CATEGORIES.FREE_TEXT:
      return CYCLE_FIELD_CATEGORIES.PRIVATE_NOTES;
    case OBSERVATION_CATEGORIES.LIFESTYLE:
      return key === 'pregnancyChecklist' ? CYCLE_FIELD_CATEGORIES.PREGNANCY : CYCLE_FIELD_CATEGORIES.GENERAL_WELLNESS;
    default:
      return CYCLE_FIELD_CATEGORIES.UNKNOWN;
  }
}

/**
 * Allowlisted daily line for AI prompts: flow, pain, everyday symptoms / moods, sleep and stress —
 * each only while its registry row passes `observationAiContextAllowed`. Every other field (BBT and
 * its source, wrist temperature, OPK / pregnancy tests, mucus, the observations bag, sex, libido,
 * notes, tags, lifestyle, unknown keys) is never read into the line, only counted as excluded.
 */
export function serializeCycleLogForAi(log) {
  if (!log || typeof log !== 'object') {
    return { line: null, included: [], excluded: [CYCLE_FIELD_CATEGORIES.UNKNOWN] };
  }
  const included = new Set();
  const excluded = new Set();
  const bits = [];

  if (observationAiContextAllowed('flow')) {
    const flow = log.flow || 'none';
    bits.push(`flow=${flow}`);
    addCat(included, CYCLE_FIELD_CATEGORIES.BLEEDING);
  }

  const painEntries = parsePainEntries(log.painEntries);
  const rawSymptoms = stripPainManagedSymptoms(
    Array.isArray(log.symptoms) ? log.symptoms.map(String) : [],
    painEntries,
  );
  const keptSymptoms = [];
  for (const key of rawSymptoms) {
    const cat = classifyCycleSymptomKey(key);
    if (cat === CYCLE_FIELD_CATEGORIES.GENERAL_WELLNESS || cat === CYCLE_FIELD_CATEGORIES.MOOD) {
      keptSymptoms.push(labelKey(key));
      addCat(included, cat);
    } else if (cat === CYCLE_FIELD_CATEGORIES.SEXUAL_HEALTH) {
      addCat(excluded, cat);
    } else {
      addCat(excluded, CYCLE_FIELD_CATEGORIES.UNKNOWN);
    }
  }

  const rawMoods = Array.isArray(log.moods) ? log.moods.map(String) : [];
  const keptMoods = [];
  for (const key of rawMoods) {
    const cat = classifyCycleSymptomKey(key);
    if (cat === CYCLE_FIELD_CATEGORIES.MOOD || cat === CYCLE_FIELD_CATEGORIES.GENERAL_WELLNESS) {
      keptMoods.push(labelKey(key));
      addCat(included, CYCLE_FIELD_CATEGORIES.MOOD);
    } else if (cat === CYCLE_FIELD_CATEGORIES.SEXUAL_HEALTH) {
      addCat(excluded, cat);
    } else {
      addCat(excluded, CYCLE_FIELD_CATEGORIES.UNKNOWN);
    }
  }

  bits.push(`სიმპტომები=${keptSymptoms.join(', ') || '—'}`);
  bits.push(`განწყობა=${keptMoods.join(', ') || '—'}`);

  const pain = observationAiContextAllowed('pain') ? painEntries : [];
  if (pain.length) {
    const parts = pain
      .filter((p) => p && typeof p === 'object' && p.type && p.severity)
      .map((p) => `${p.type}:${p.severity}`);
    if (parts.length) {
      bits.push(`ტკივილი=${parts.join(',')}`);
      addCat(included, CYCLE_FIELD_CATEGORIES.PAIN);
    }
  }

  if (log.sleepQuality && observationAiContextAllowed('sleepQuality')) {
    bits.push(`ძილი=${log.sleepQuality}`);
    addCat(included, CYCLE_FIELD_CATEGORIES.GENERAL_WELLNESS);
  }
  if (log.stressLevel && observationAiContextAllowed('stressLevel')) {
    bits.push(`სტრესი=${log.stressLevel}`);
    addCat(included, CYCLE_FIELD_CATEGORIES.GENERAL_WELLNESS);
  }

  // Everything else on the row is never read into the line; it is only named as an excluded category.
  for (const field of Object.keys(log)) {
    if (SERIALIZED_LOG_FIELDS.has(field) || NON_OBSERVATION_LOG_FIELDS.has(field)) continue;
    if (!hasValue(log[field])) continue;
    if (field === 'observations') {
      for (const [key, value] of Object.entries(observationBag(log.observations))) {
        if (hasValue(value)) addCat(excluded, excludedCategoryFor(key));
      }
      continue;
    }
    addCat(excluded, excludedCategoryFor(field));
  }

  addCat(included, CYCLE_FIELD_CATEGORIES.GENERAL_CYCLE);

  return {
    line: `${log.date}: ${bits.join('; ')}`,
    included: [...included],
    excluded: [...excluded],
  };
}

export function inspectCycleAiCategories({ logs = [] } = {}) {
  const included = new Set();
  const excluded = new Set([
    CYCLE_FIELD_CATEGORIES.FERTILITY,
    CYCLE_FIELD_CATEGORIES.SEXUAL_HEALTH,
    CYCLE_FIELD_CATEGORIES.PRIVATE_NOTES,
    CYCLE_FIELD_CATEGORIES.FREE_TEXT,
    CYCLE_FIELD_CATEGORIES.UNKNOWN,
  ]);
  for (const log of (logs || []).slice(0, 7)) {
    const row = serializeCycleLogForAi(log);
    row.included.forEach((c) => included.add(c));
    row.excluded.forEach((c) => excluded.add(c));
  }
  addCat(included, CYCLE_FIELD_CATEGORIES.GENERAL_CYCLE);
  return {
    includedCategories: [...included],
    excludedCategories: [...excluded],
  };
}

/**
 * Counts over a longer window for Medi (owner 2026-10-08: older history too), built from the same
 * allow-list as the daily line: everyday symptoms and moods by Georgian label, pain by place,
 * bleeding days. Sex, intimate symptoms and unknown keys are never counted.
 */
export function summarizeCycleLogsForAi(logs = []) {
  const symptoms = new Map();
  const moods = new Map();
  const pain = new Map();
  let bleedingDays = 0;
  const bump = (map, key) => map.set(key, (map.get(key) || 0) + 1);
  for (const log of Array.isArray(logs) ? logs : []) {
    if (!log || typeof log !== 'object') continue;
    if (observationAiContextAllowed('flow') && ['spotting', 'light', 'medium', 'heavy'].includes(log.flow)) bleedingDays++;
    const painEntries = parsePainEntries(log.painEntries);
    for (const key of stripPainManagedSymptoms(Array.isArray(log.symptoms) ? log.symptoms.map(String) : [], painEntries)) {
      const cat = classifyCycleSymptomKey(key);
      if (cat === CYCLE_FIELD_CATEGORIES.GENERAL_WELLNESS) bump(symptoms, labelKey(key));
      else if (cat === CYCLE_FIELD_CATEGORIES.MOOD) bump(moods, labelKey(key));
    }
    for (const key of Array.isArray(log.moods) ? log.moods.map(String) : []) {
      const cat = classifyCycleSymptomKey(key);
      if (cat === CYCLE_FIELD_CATEGORIES.MOOD || cat === CYCLE_FIELD_CATEGORIES.GENERAL_WELLNESS) bump(moods, labelKey(key));
    }
    if (observationAiContextAllowed('pain')) {
      for (const p of painEntries) if (p && typeof p === 'object' && p.type) bump(pain, String(p.type));
    }
  }
  const top = (map, n) => [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, c]) => `${k} ×${c}`);
  return { loggedDays: Array.isArray(logs) ? logs.length : 0, bleedingDays, symptoms: top(symptoms, 12), moods: top(moods, 8), pain: top(pain, 6) };
}
