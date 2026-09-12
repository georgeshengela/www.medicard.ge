/**
 * Phase 23 — denominator-safe Pregnancy observation summaries.
 * Current ACTIVE episode only. Positive-presence counts. No percentages.
 * Does not change the forecast engine, dating, or Phase 13 generic trends.
 */

import { addDays } from './cycle.js';
import {
  PAIN_SYMPTOM_TO_TYPE,
  PAIN_TYPES,
  getObservationDef,
  isSensitiveObservation,
  stripPainManagedSymptoms,
} from './cycleObservationRegistry.js';
import { parsePainEntries } from './cycleObservations.js';
import {
  civilFromTimestamp,
  episodeObservationWindow,
  PREGNANCY_OBSERVATION_RECENT_DAYS,
} from './cyclePregnancyObservations.js';
import { attachExposureIfEligible, listCivilDates } from './cycleObservationExposureRates.js';
import { attachExposureComparisons } from './cycleObservationExposureComparison.js';
import { attachObservationExplainability } from './cycleObservationExplainability.js';

export const PREGNANCY_TREND_RECENT_DAYS = 30;
export const PREGNANCY_TREND_QUERY_CAP_DAYS = PREGNANCY_OBSERVATION_RECENT_DAYS;
export const PREGNANCY_TREND_MIN_OCCURRENCES = 2;
export const PREGNANCY_TREND_UI_LIMIT = 4;
export const PREGNANCY_TREND_EXPAND_DATES = 8;

export const PREGNANCY_TREND_TYPES = Object.freeze({
  RECENT_OCCURRENCE: 'RECENT_OCCURRENCE',
  RECENT_SEVERITY_DISTRIBUTION: 'RECENT_SEVERITY_DISTRIBUTION',
  RECENT_BLEEDING_OCCURRENCE: 'RECENT_BLEEDING_OCCURRENCE',
});

export const PREGNANCY_TREND_FAMILIES = Object.freeze({
  BLEEDING: 'bleeding',
  PAIN: 'pain',
  DIGESTION: 'digestion',
  ENERGY: 'energy',
  BODY: 'body',
});

const FAMILY_RANK = Object.freeze({
  [PREGNANCY_TREND_FAMILIES.BLEEDING]: 10,
  [PREGNANCY_TREND_FAMILIES.PAIN]: 20,
  [PREGNANCY_TREND_FAMILIES.DIGESTION]: 30,
  [PREGNANCY_TREND_FAMILIES.ENERGY]: 40,
  [PREGNANCY_TREND_FAMILIES.BODY]: 50,
});

const PAIN_TYPE_RANK = Object.freeze({
  cramps: 1,
  pelvic: 2,
  lower_back: 3,
  headache: 4,
  breast: 5,
  other: 6,
  ovulation_side: 7,
});

const DIGESTION_KEYS = new Set(['nausea', 'vomiting', 'bloating', 'heartburn', 'constipation', 'diarrhea']);
const ENERGY_CHIP_KEYS = new Set(['fatigue']);
const LOW_ENERGY = new Set(['low', 'very_low']);
const BLEED_FLOWS = new Set(['spotting', 'light', 'medium', 'heavy']);
const SEVERITIES = ['mild', 'moderate', 'severe'];
const PAIN_TYPE_SET = new Set(PAIN_TYPES);

function civilDate(value) {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return civilFromTimestamp(value);
}

function eligible(key) {
  const defn = getObservationDef(key);
  return Boolean(defn?.enabled && defn.pregnancyTrendEligible);
}

function familyForSymptom(key) {
  if (DIGESTION_KEYS.has(key)) return PREGNANCY_TREND_FAMILIES.DIGESTION;
  if (ENERGY_CHIP_KEYS.has(key) || key === 'energy.low') return PREGNANCY_TREND_FAMILIES.ENERGY;
  return PREGNANCY_TREND_FAMILIES.BODY;
}

function energyValue(log) {
  const bag = log?.observations && typeof log.observations === 'object' ? log.observations : {};
  return bag.energy || log?.energy || null;
}

function emptyPayload({ from = null, to = null, episodeFrom = null, today = null } = {}) {
  return {
    version: 'cycle-pregnancy-observation-trends-v1',
    window: {
      from,
      to,
      recentDays: PREGNANCY_TREND_RECENT_DAYS,
      episodeFrom,
      queryCapDays: PREGNANCY_TREND_QUERY_CAP_DAYS,
    },
    trends: [],
    generatedAt: today ? `${today}T00:00:00.000Z` : null,
  };
}

export function pregnancyTrendWindow({ episode, today } = {}) {
  const observation = episodeObservationWindow({
    episode,
    today,
    recentDays: PREGNANCY_TREND_QUERY_CAP_DAYS,
  });
  if (!today || observation.empty) {
    return { ...observation, recentFrom: null, recentTo: null, episodeFrom: civilFromTimestamp(episode?.startedAt) };
  }
  const episodeFrom = civilFromTimestamp(episode?.startedAt);
  const capRecent = addDays(today, -(PREGNANCY_TREND_RECENT_DAYS - 1));
  let recentFrom = observation.from;
  if (capRecent > recentFrom) recentFrom = capRecent;
  if (episodeFrom && episodeFrom > recentFrom) recentFrom = episodeFrom;
  return {
    from: observation.from,
    to: observation.to,
    empty: recentFrom > observation.to,
    recentFrom,
    recentTo: observation.to,
    episodeFrom,
  };
}

function collectFacts(log) {
  const date = civilDate(log?.date);
  if (!date) return [];
  const facts = [];

  if (eligible('flow') && BLEED_FLOWS.has(log.flow)) {
    facts.push({
      key: 'flow',
      family: PREGNANCY_TREND_FAMILIES.BLEEDING,
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
        family: PREGNANCY_TREND_FAMILIES.PAIN,
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
          family: PREGNANCY_TREND_FAMILIES.PAIN,
          date,
          severity: null,
        });
      }
      continue;
    }
    const defn = getObservationDef(id);
    if (!defn || !defn.enabled || !defn.pregnancyTrendEligible) continue;
    if (isSensitiveObservation(id)) continue;
    facts.push({
      key: id,
      family: familyForSymptom(id),
      date,
    });
  }

  if (eligible('energy') && LOW_ENERGY.has(energyValue(log))) {
    facts.push({
      key: 'energy.low',
      family: PREGNANCY_TREND_FAMILIES.ENERGY,
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
 * @param {{ logs: object[], today: string, episode?: object, pregnancyActive?: boolean }} input
 */
export function buildPregnancyObservationTrends({
  logs = [],
  today,
  episode = null,
  pregnancyActive = false,
} = {}) {
  const day = civilDate(today);
  const episodeFrom = civilFromTimestamp(episode?.startedAt);
  if (!day || !pregnancyActive || episode?.status !== 'ACTIVE') {
    return emptyPayload({ today: day, episodeFrom });
  }

  const window = pregnancyTrendWindow({ episode, today: day });
  if (window.empty || !window.recentFrom) {
    return emptyPayload({
      from: window.recentFrom,
      to: window.recentTo,
      episodeFrom: window.episodeFrom,
      today: day,
    });
  }

  const dates = listCivilDates(window.recentFrom, window.recentTo);
  const buckets = new Map();
  for (const log of logs || []) {
    const date = civilDate(log?.date);
    if (!date || date < window.recentFrom || date > window.recentTo) continue;
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

  const trends = [];
  for (const bucket of buckets.values()) {
    const occurrenceCount = bucket.dates.size;
    if (occurrenceCount < PREGNANCY_TREND_MIN_OCCURRENCES) continue;
    const lastLoggedDate = [...bucket.dates].sort().at(-1);
    const recentDates = [...bucket.dates].sort().reverse().slice(0, PREGNANCY_TREND_EXPAND_DATES);
    const isBleed = bucket.key === 'flow';
    const isPain = bucket.key.startsWith('pain.');
    const summaryType = isBleed
      ? PREGNANCY_TREND_TYPES.RECENT_BLEEDING_OCCURRENCE
      : isPain && bucket.severitySample >= PREGNANCY_TREND_MIN_OCCURRENCES
        ? PREGNANCY_TREND_TYPES.RECENT_SEVERITY_DISTRIBUTION
        : PREGNANCY_TREND_TYPES.RECENT_OCCURRENCE;

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
    trends.push(attachExposureIfEligible(row, logs, dates));
  }

  trends.sort((a, b) => {
    const fa = FAMILY_RANK[a.family] ?? 90;
    const fb = FAMILY_RANK[b.family] ?? 90;
    if (fa !== fb) return fa - fb;
    if (a.family === PREGNANCY_TREND_FAMILIES.PAIN) {
      const pa = PAIN_TYPE_RANK[a.key.slice(5)] ?? 50;
      const pb = PAIN_TYPE_RANK[b.key.slice(5)] ?? 50;
      if (pa !== pb && a.occurrenceCount === b.occurrenceCount) return pa - pb;
    }
    if (b.occurrenceCount !== a.occurrenceCount) return b.occurrenceCount - a.occurrenceCount;
    const da = a.lastLoggedDate || '';
    const db = b.lastLoggedDate || '';
    if (da !== db) return db.localeCompare(da);
    return a.key.localeCompare(b.key);
  });

  const ranked = attachObservationExplainability(
    attachExposureComparisons(trends, logs, { today: day, allowedDates: dates }),
    logs,
    { today: day, allowedDates: dates },
  );

  return {
    version: 'cycle-pregnancy-observation-trends-v1',
    window: {
      from: window.recentFrom,
      to: window.recentTo,
      recentDays: PREGNANCY_TREND_RECENT_DAYS,
      episodeFrom: window.episodeFrom,
      queryCapDays: PREGNANCY_TREND_QUERY_CAP_DAYS,
    },
    trends: ranked,
    generatedAt: `${day}T00:00:00.000Z`,
  };
}

export function pregnancyObservationTrendPayloadHasSensitiveLeak(payload) {
  const text = JSON.stringify(payload || {});
  const forbidden = [
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
    'trimester',
    'increasing',
    'decreasing',
    'improving',
    'worsening',
  ];
  return forbidden.some((key) => new RegExp(`"${key}"`).test(text));
}

export function pregnancyObservationTrendHasDenominator(payload) {
  const clone = JSON.parse(JSON.stringify(payload || {}));
  for (const row of clone.trends || []) {
    delete row.exposure;
    delete row.comparison;
    delete row.explainability;
  }
  const blob = JSON.stringify(clone);
  if (/%/.test(blob)) return true;
  if (/"windowDays"/.test(blob)) return true;
  if (/"ofDays"/.test(blob)) return true;
  if (/"percent":/.test(blob)) return true;
  return (payload?.trends || []).some((row) => {
    const args = row.summaryArgs || {};
    return args.windowDays != null || args.percent != null || args.eligibleDays != null;
  });
}
