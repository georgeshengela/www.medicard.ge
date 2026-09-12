/**
 * Cycle AI / partner field classification.
 * Unknown keys are excluded by default. Do not pass raw CycleLog to EvidenceMD.
 */

import { formatCycleTestKa } from './cycleFertility.js';
import {
  OBSERVATION_CATEGORIES,
  OBSERVATION_REGISTRY,
  getObservationDef,
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
    .filter((item) => item.storage === 'symptoms' && item.aiDefaultAllowed)
    .map((item) => item.key),
);

export const CYCLE_AI_MOOD_ALLOWLIST = Object.freeze(
  Object.values(OBSERVATION_REGISTRY)
    .filter((item) => item.storage === 'moods' && item.aiDefaultAllowed)
    .map((item) => item.key),
);

const SYMPTOM_SET = new Set(CYCLE_AI_SYMPTOM_ALLOWLIST);
const MOOD_SET = new Set(CYCLE_AI_MOOD_ALLOWLIST);

const SYMPTOM_KA = {
  cramps: 'კრუნჩხვები',
  headache: 'თავის ტკივილი',
  bloating: 'შებერილობა',
  acne: 'აკნე',
  fatigue: 'დაღლილობა',
  back_pain: 'წელის ტკივილი',
  breast_tenderness: 'მკერდის მგრძნობელობა',
  nausea: 'გულისრევა',
  anxious: 'შფოთვა',
  irritable: 'გაღიზიანება',
  sensitive: 'მგრძნობიარე',
  energetic: 'ენერგიული',
  sad: 'სევდიანი',
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
  if (!defn.aiDefaultAllowed) return CYCLE_FIELD_CATEGORIES.UNKNOWN;
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

/**
 * Allowlisted daily line for EvidenceMD. Notes, sex chips, unknown keys, libido,
 * sexualActivity, custom tags, caffeine, alcohol, exercise are omitted.
 */
export function serializeCycleLogForAi(log) {
  if (!log || typeof log !== 'object') {
    return { line: null, included: [], excluded: [CYCLE_FIELD_CATEGORIES.UNKNOWN] };
  }
  const included = new Set();
  const excluded = new Set();
  const bits = [];

  const flow = log.flow || 'none';
  bits.push(`flow=${flow}`);
  addCat(included, CYCLE_FIELD_CATEGORIES.BLEEDING);

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

  const pain = painEntries;
  if (pain.length) {
    const parts = pain
      .filter((p) => p && typeof p === 'object' && p.type && p.severity)
      .map((p) => `${p.type}:${p.severity}`);
    if (parts.length) {
      bits.push(`ტკივილი=${parts.join(',')}`);
      addCat(included, CYCLE_FIELD_CATEGORIES.PAIN);
    }
  }

  if (log.sleepQuality) {
    bits.push(`ძილი=${log.sleepQuality}`);
    addCat(included, CYCLE_FIELD_CATEGORIES.GENERAL_WELLNESS);
  }
  if (log.stressLevel) {
    bits.push(`სტრესი=${log.stressLevel}`);
    addCat(included, CYCLE_FIELD_CATEGORIES.GENERAL_WELLNESS);
  }

  if (log.ovulationTest) {
    bits.push(`ოვულაციის ტესტი=${formatCycleTestKa(log.ovulationTest) || log.ovulationTest}`);
    addCat(included, CYCLE_FIELD_CATEGORIES.FERTILITY);
  }
  if (log.pregnancyTest) {
    bits.push(`ორსულობის ტესტი=${formatCycleTestKa(log.pregnancyTest) || log.pregnancyTest}`);
    addCat(included, CYCLE_FIELD_CATEGORIES.FERTILITY);
  }
  if (log.bbt != null && Number.isFinite(Number(log.bbt))) {
    bits.push(`BBT=${Number(log.bbt)}`);
    addCat(included, CYCLE_FIELD_CATEGORIES.FERTILITY);
  }
  if (log.cervicalMucus) {
    bits.push(`ლორწო=${log.cervicalMucus}`);
    addCat(included, CYCLE_FIELD_CATEGORIES.FERTILITY);
  }

  if (log.notes) addCat(excluded, CYCLE_FIELD_CATEGORIES.PRIVATE_NOTES);
  if (log.sexualActivity != null || log.libido != null) {
    addCat(excluded, CYCLE_FIELD_CATEGORIES.SEXUAL_HEALTH);
  }
  if (Array.isArray(log.customTagIds) && log.customTagIds.length) {
    addCat(excluded, CYCLE_FIELD_CATEGORIES.UNKNOWN);
  }
  if (log.exerciseLevel || log.caffeine || log.alcohol) {
    addCat(excluded, CYCLE_FIELD_CATEGORIES.GENERAL_WELLNESS);
  }
  if (log.energy || log.observations?.energy) {
    addCat(excluded, CYCLE_FIELD_CATEGORIES.UNKNOWN);
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
