/**
 * Phase 26 — denominator-safe Perimenopause observation summaries.
 * Current mode only. Last 30 civil days. Positive-presence counts. No percentages.
 * No episode model. Does not change Phase 23, Phase 13, forecast, or doctor summary.
 */

import { addDays, toDateKey } from './cycle.js';
import {
  PAIN_SYMPTOM_TO_TYPE,
  PAIN_TYPES,
  getObservationDef,
  isSensitiveObservation,
  stripPainManagedSymptoms,
} from './cycleObservationRegistry.js';
import { parsePainEntries } from './cycleObservations.js';
import { attachExposureIfEligible, listCivilDates } from './cycleObservationExposureRates.js';
import { attachExposureComparisons } from './cycleObservationExposureComparison.js';
import { attachObservationExplainability } from './cycleObservationExplainability.js';

export const PERI_SUMMARY_RECENT_DAYS = 30;
export const PERI_SUMMARY_QUERY_CAP_DAYS = 90;
export const PERI_SUMMARY_MIN_OCCURRENCES = 2;
export const PERI_SUMMARY_UI_LIMIT = 4;
export const PERI_SUMMARY_EXPAND_DATES = 8;
export const PERI_SUMMARY_VERSION = 'cycle-perimenopause-observation-summaries-v1';

export const PERI_SUMMARY_TYPES = Object.freeze({
  RECENT_OCCURRENCE: 'RECENT_OCCURRENCE',
  RECENT_SEVERITY_DISTRIBUTION: 'RECENT_SEVERITY_DISTRIBUTION',
  RECENT_BLEEDING_OCCURRENCE: 'RECENT_BLEEDING_OCCURRENCE',
  RECENT_CATEGORY_DISTRIBUTION: 'RECENT_CATEGORY_DISTRIBUTION',
});

export const PERI_SUMMARY_FAMILIES = Object.freeze({
  BLEEDING: 'bleeding',
  VASOMOTOR: 'vasomotor',
  WELLNESS: 'wellness',
  PAIN: 'pain',
  MOOD: 'mood',
  DIGESTION: 'digestion',
  BODY: 'body',
});

const FAMILY_RANK = Object.freeze({
  [PERI_SUMMARY_FAMILIES.BLEEDING]: 10,
  [PERI_SUMMARY_FAMILIES.VASOMOTOR]: 20,
  [PERI_SUMMARY_FAMILIES.WELLNESS]: 40,
  [PERI_SUMMARY_FAMILIES.PAIN]: 50,
  [PERI_SUMMARY_FAMILIES.BODY]: 60,
  [PERI_SUMMARY_FAMILIES.DIGESTION]: 70,
  [PERI_SUMMARY_FAMILIES.MOOD]: 80,
});

const KEY_RANK = Object.freeze({
  flow: 10,
  hot_flashes: 20,
  night_sweats: 30,
  'sleep.poor': 40,
  'energy.low': 41,
  fatigue: 42,
  'pain.headache': 50,
  'pain.cramps': 51,
  'pain.pelvic': 52,
  'pain.lower_back': 53,
  'pain.breast': 54,
  'pain.other': 55,
  'pain.ovulation_side': 56,
  migraine: 57,
  dizziness: 60,
  swelling: 61,
  bloating: 70,
  heartburn: 71,
  constipation: 72,
  diarrhea: 73,
  irritable: 80,
  sad: 81,
});

const DIGESTION_KEYS = new Set(['heartburn', 'bloating', 'constipation', 'diarrhea']);
const MOOD_KEYS = new Set(['irritable', 'sad']);
const VASOMOTOR_KEYS = new Set(['hot_flashes', 'night_sweats']);
const WELLNESS_CHIP_KEYS = new Set(['fatigue']);
const LOW_ENERGY = new Set(['low', 'very_low']);
const POOR_SLEEP = new Set(['poor']);
const BLEED_FLOWS = new Set(['spotting', 'light', 'medium', 'heavy']);
const SEVERITIES = ['mild', 'moderate', 'severe'];
const PAIN_TYPE_SET = new Set(PAIN_TYPES);

function civilDate(value) {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return toDateKey(value);
}

function eligible(key) {
  const defn = getObservationDef(key);
  return Boolean(defn?.enabled && defn.perimenopauseSummaryEligible);
}

function familyForKey(key) {
  if (key === 'flow') return PERI_SUMMARY_FAMILIES.BLEEDING;
  if (VASOMOTOR_KEYS.has(key)) return PERI_SUMMARY_FAMILIES.VASOMOTOR;
  if (key === 'energy.low' || key === 'sleep.poor' || WELLNESS_CHIP_KEYS.has(key)) {
    return PERI_SUMMARY_FAMILIES.WELLNESS;
  }
  if (key.startsWith('pain.') || key === 'migraine') return PERI_SUMMARY_FAMILIES.PAIN;
  if (MOOD_KEYS.has(key)) return PERI_SUMMARY_FAMILIES.MOOD;
  if (DIGESTION_KEYS.has(key)) return PERI_SUMMARY_FAMILIES.DIGESTION;
  return PERI_SUMMARY_FAMILIES.BODY;
}

function energyValue(log) {
  const bag = log?.observations && typeof log.observations === 'object' ? log.observations : {};
  return bag.energy || log?.energy || null;
}

export function periSummaryWindow({ today } = {}) {
  const day = civilDate(today);
  if (!day) {
    return { from: null, to: null, empty: true, fetchFrom: null };
  }
  const recentFrom = addDays(day, -(PERI_SUMMARY_RECENT_DAYS - 1));
  const fetchFrom = addDays(day, -(PERI_SUMMARY_QUERY_CAP_DAYS - 1));
  return {
    from: recentFrom,
    to: day,
    empty: recentFrom > day,
    fetchFrom,
  };
}

function emptyPayload({ from = null, to = null, today = null } = {}) {
  return {
    version: PERI_SUMMARY_VERSION,
    window: {
      from,
      to,
      recentDays: PERI_SUMMARY_RECENT_DAYS,
      queryCapDays: PERI_SUMMARY_QUERY_CAP_DAYS,
    },
    summaries: [],
    generatedAt: today ? `${today}T00:00:00.000Z` : null,
  };
}

function collectFacts(log) {
  const date = civilDate(log?.date);
  if (!date) return [];
  const facts = [];

  if (eligible('flow') && BLEED_FLOWS.has(log.flow)) {
    facts.push({
      key: 'flow',
      family: PERI_SUMMARY_FAMILIES.BLEEDING,
      date,
      flow: log.flow,
    });
  }

  const pain = parsePainEntries(log?.painEntries);
  const covered = new Set();
  if (eligible('pain')) {
    for (const entry of pain) {
      if (!PAIN_TYPE_SET.has(entry.type)) continue;
      covered.add(entry.type);
      facts.push({
        key: `pain.${entry.type}`,
        family: PERI_SUMMARY_FAMILIES.PAIN,
        date,
        severity: SEVERITIES.includes(entry.severity) ? entry.severity : null,
      });
    }
  }

  const symptoms = stripPainManagedSymptoms(Array.isArray(log?.symptoms) ? log.symptoms : [], pain);
  for (const id of symptoms) {
    const mapped = PAIN_SYMPTOM_TO_TYPE[id];
    if (mapped) {
      if (eligible('pain') && !covered.has(mapped) && PAIN_TYPE_SET.has(mapped)) {
        covered.add(mapped);
        facts.push({
          key: `pain.${mapped}`,
          family: PERI_SUMMARY_FAMILIES.PAIN,
          date,
          severity: null,
        });
      }
      continue;
    }
    const defn = getObservationDef(id);
    if (!defn || !defn.enabled || !defn.perimenopauseSummaryEligible) continue;
    if (isSensitiveObservation(id)) continue;
    facts.push({
      key: id,
      family: familyForKey(id),
      date,
    });
  }

  const moods = Array.isArray(log?.moods) ? log.moods : [];
  for (const id of moods) {
    if (!eligible(id) || isSensitiveObservation(id)) continue;
    facts.push({
      key: id,
      family: PERI_SUMMARY_FAMILIES.MOOD,
      date,
    });
  }

  if (eligible('energy') && LOW_ENERGY.has(energyValue(log))) {
    facts.push({
      key: 'energy.low',
      family: PERI_SUMMARY_FAMILIES.WELLNESS,
      date,
    });
  }

  if (eligible('sleepQuality') && POOR_SLEEP.has(log.sleepQuality)) {
    facts.push({
      key: 'sleep.poor',
      family: PERI_SUMMARY_FAMILIES.WELLNESS,
      date,
    });
  }

  return facts;
}

function makeBucket(fact) {
  return {
    key: fact.key,
    family: fact.family,
    dates: new Set(),
    severities: { mild: 0, moderate: 0, severe: 0 },
    severitySample: 0,
    flowCounts: { spotting: 0, light: 0, medium: 0, heavy: 0 },
  };
}

/**
 * @param {{ logs: object[], today: string, mode?: string }} input
 */
export function buildPerimenopauseObservationSummaries({ logs = [], today, mode = 'PERIMENOPAUSE' } = {}) {
  const day = civilDate(today);
  if (!day || mode !== 'PERIMENOPAUSE') {
    return emptyPayload({ today: day });
  }

  const window = periSummaryWindow({ today: day });
  if (window.empty || !window.from) {
    return emptyPayload({ from: window.from, to: window.to, today: day });
  }

  const dates = listCivilDates(window.from, window.to);
  const buckets = new Map();
  for (const log of logs || []) {
    const date = civilDate(log?.date);
    if (!date || date < window.from || date > window.to) continue;
    if (window.fetchFrom && date < window.fetchFrom) continue;
    for (const fact of collectFacts(log)) {
      let bucket = buckets.get(fact.key);
      if (!bucket) {
        bucket = makeBucket(fact);
        buckets.set(fact.key, bucket);
      }
      const first = !bucket.dates.has(date);
      bucket.dates.add(date);
      if (first && fact.severity && SEVERITIES.includes(fact.severity)) {
        bucket.severities[fact.severity] += 1;
        bucket.severitySample += 1;
      }
      if (fact.flow && first && Object.hasOwn(bucket.flowCounts, fact.flow)) {
        bucket.flowCounts[fact.flow] += 1;
      }
    }
  }

  const summaries = [];
  for (const bucket of buckets.values()) {
    const occurrenceCount = bucket.dates.size;
    if (occurrenceCount < PERI_SUMMARY_MIN_OCCURRENCES) continue;
    const lastLoggedDate = [...bucket.dates].sort().at(-1);
    const recentDates = [...bucket.dates].sort().reverse().slice(0, PERI_SUMMARY_EXPAND_DATES);
    const isBleed = bucket.key === 'flow';
    const isPain = bucket.key.startsWith('pain.');
    const isSleep = bucket.key === 'sleep.poor';
    const summaryType = isBleed
      ? PERI_SUMMARY_TYPES.RECENT_BLEEDING_OCCURRENCE
      : isPain && bucket.severitySample >= PERI_SUMMARY_MIN_OCCURRENCES
        ? PERI_SUMMARY_TYPES.RECENT_SEVERITY_DISTRIBUTION
        : isSleep
          ? PERI_SUMMARY_TYPES.RECENT_CATEGORY_DISTRIBUTION
          : PERI_SUMMARY_TYPES.RECENT_OCCURRENCE;

    const row = {
      key: bucket.key,
      family: bucket.family,
      summaryType,
      occurrenceCount,
      lastLoggedDate,
      recentDates,
      summaryArgs: { days: occurrenceCount },
    };
    if (isPain && bucket.severitySample) {
      row.severityCounts = bucket.severities;
    }
    if (isBleed) {
      row.flowCounts = bucket.flowCounts;
    }
    summaries.push(attachExposureIfEligible(row, logs, dates));
  }

  summaries.sort((a, b) => {
    const fa = FAMILY_RANK[a.family] ?? 90;
    const fb = FAMILY_RANK[b.family] ?? 90;
    if (fa !== fb) return fa - fb;
    const ka = KEY_RANK[a.key] ?? 90;
    const kb = KEY_RANK[b.key] ?? 90;
    if (ka !== kb && a.occurrenceCount === b.occurrenceCount) return ka - kb;
    if (b.occurrenceCount !== a.occurrenceCount) return b.occurrenceCount - a.occurrenceCount;
    const da = a.lastLoggedDate || '';
    const db = b.lastLoggedDate || '';
    if (da !== db) return db.localeCompare(da);
    return a.key.localeCompare(b.key);
  });

  const ranked = attachObservationExplainability(
    attachExposureComparisons(summaries, logs, { today: day, allowedDates: dates }),
    logs,
    { today: day, allowedDates: dates },
  );

  return {
    version: PERI_SUMMARY_VERSION,
    window: {
      from: window.from,
      to: window.to,
      recentDays: PERI_SUMMARY_RECENT_DAYS,
      queryCapDays: PERI_SUMMARY_QUERY_CAP_DAYS,
    },
    summaries: ranked,
    generatedAt: `${day}T00:00:00.000Z`,
  };
}

export function periObservationSummaryHasSensitiveLeak(payload) {
  const text = JSON.stringify(payload || {});
  const forbidden = [
    'vaginal_dryness',
    'notes',
    'sexualActivity',
    'libido',
    'ovulationTest',
    'pregnancyTest',
    'bbt',
    'cervicalMucus',
    'discharge',
    'pain_sex',
    'unprotected',
    'protected',
    'customTagIds',
    'percent',
    'windowDays',
    'increasing',
    'decreasing',
    'improving',
    'worsening',
    'estrogen',
    'menopausal',
    'perimenopauseDiagnosis',
  ];
  return forbidden.some((key) => new RegExp(`"${key}"`).test(text));
}

export function periObservationSummaryHasDenominator(payload) {
  const clone = JSON.parse(JSON.stringify(payload || {}));
  for (const row of clone.summaries || []) {
    delete row.exposure;
    delete row.comparison;
    delete row.explainability;
  }
  const blob = JSON.stringify(clone);
  if (/%/.test(blob)) return true;
  if (/"windowDays"/.test(blob)) return true;
  if (/"ofDays"/.test(blob)) return true;
  if (/"percent":/.test(blob)) return true;
  if (/"eligibleDays"/.test(blob)) return true;
  return (payload?.summaries || []).some((row) => {
    const args = row.summaryArgs || {};
    return args.windowDays != null || args.percent != null || args.eligibleDays != null;
  });
}
