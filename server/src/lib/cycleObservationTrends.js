/**
 * Phase 13 Journal observation trends.
 * Server-owned, deterministic, positive-presence only.
 * Does not change the forecast engine. No percentages. No causal copy.
 */

import { addDays, inferCycleStats, toDateKey } from './cycle.js';
import {
  PAIN_SYMPTOM_TO_TYPE,
  PAIN_TYPES,
  TREND_GROUPS,
  TREND_MIN_OCCURRENCES,
  TREND_RECURRENCE_OCCURRENCES,
  getObservationDef,
  stripPainManagedSymptoms,
} from './cycleObservationRegistry.js';

export const OBSERVATION_TREND_QUERY_DAYS = 180;
export const OBSERVATION_TREND_RECENT_DAYS = 30;
export const OBSERVATION_TREND_MAX_EPISODES = 6;
export const OBSERVATION_TREND_UI_LIMIT = 5;
export const OBSERVATION_TREND_EXPAND_DATES = 8;

export const TREND_TYPES = Object.freeze({
  RECENT_OCCURRENCE: 'RECENT_OCCURRENCE',
  PERIOD_EPISODE_RECURRENCE: 'PERIOD_EPISODE_RECURRENCE',
  RECENT_SEVERITY_DISTRIBUTION: 'RECENT_SEVERITY_DISTRIBUTION',
});

const GROUP_RANK = Object.freeze({
  [TREND_GROUPS.PAIN]: 10,
  [TREND_GROUPS.ENERGY]: 20,
  [TREND_GROUPS.DIGESTION]: 30,
  [TREND_GROUPS.SKIN]: 40,
  [TREND_GROUPS.PHYSICAL]: 50,
});

const LOW_ENERGY = new Set(['low', 'very_low']);

function civilDate(value) {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return toDateKey(value) || String(value || '').slice(0, 10);
}

function inRange(date, start, end) {
  return date >= start && date <= end;
}

function dateInPeriodRange(date, range) {
  return inRange(date, range.start, range.end);
}

/** Completed bleed episodes that overlap the query window. Predicted ranges are never passed in. */
export function completedPeriodEpisodes(periodRanges, { today, windowStart, limit = OBSERVATION_TREND_MAX_EPISODES } = {}) {
  const rows = (Array.isArray(periodRanges) ? periodRanges : [])
    .filter((range) => range?.start && range.end && range.end < today)
    .filter((range) => range.source !== 'predicted')
    .filter((range) => range.end >= windowStart && range.start <= today)
    .sort((a, b) => a.start.localeCompare(b.start));
  return rows.slice(Math.max(0, rows.length - limit));
}

function energyValue(log) {
  const bag = log?.observations && typeof log.observations === 'object' ? log.observations : {};
  return bag.energy || log?.energy || null;
}

function collectLogFacts(log) {
  const date = civilDate(log?.date);
  if (!date) return [];
  const facts = [];
  const pain = Array.isArray(log.painEntries) ? log.painEntries : [];
  const covered = new Set();
  for (const entry of pain) {
    if (!PAIN_TYPES.includes(entry?.type)) continue;
    covered.add(entry.type);
    facts.push({
      key: `pain.${entry.type}`,
      group: TREND_GROUPS.PAIN,
      date,
      severity: entry.severity || null,
    });
  }
  const symptoms = stripPainManagedSymptoms(Array.isArray(log.symptoms) ? log.symptoms : [], pain);
  for (const id of symptoms) {
    const mapped = PAIN_SYMPTOM_TO_TYPE[id];
    if (mapped) {
      if (!covered.has(mapped)) {
        covered.add(mapped);
        facts.push({ key: `pain.${mapped}`, group: TREND_GROUPS.PAIN, date, severity: null });
      }
      continue;
    }
    const defn = getObservationDef(id);
    if (!defn || !defn.enabled || !defn.trendEligible) continue;
    facts.push({
      key: id,
      group: defn.trendGroup || TREND_GROUPS.PHYSICAL,
      date,
      severity: null,
      priority: defn.displayPriority,
    });
  }
  if (getObservationDef('energy')?.trendEligible && LOW_ENERGY.has(energyValue(log))) {
    facts.push({ key: 'energy.low', group: TREND_GROUPS.ENERGY, date, severity: null, priority: 20 });
  }
  return facts;
}

function metadataForKey(key) {
  if (key === 'energy.low') {
    const defn = getObservationDef('energy');
    return {
      category: defn?.category || TREND_GROUPS.ENERGY,
      trendGroup: TREND_GROUPS.ENERGY,
      displayPriority: defn?.displayPriority ?? 20,
      minimumOccurrences: defn?.minimumOccurrences ?? TREND_MIN_OCCURRENCES,
    };
  }
  if (key.startsWith('pain.')) {
    const defn = getObservationDef('pain');
    return {
      category: defn?.category || TREND_GROUPS.PAIN,
      trendGroup: TREND_GROUPS.PAIN,
      displayPriority: defn?.displayPriority ?? 10,
      minimumOccurrences: defn?.minimumOccurrences ?? TREND_MIN_OCCURRENCES,
    };
  }
  const defn = getObservationDef(key);
  if (!defn || !defn.trendEligible) return null;
  return {
    category: defn.category,
    trendGroup: defn.trendGroup,
    displayPriority: defn.displayPriority,
    minimumOccurrences: defn.minimumOccurrences,
  };
}

function dominantSeverity(counts) {
  const entries = Object.entries(counts).filter(([, n]) => n > 0);
  if (!entries.length) return null;
  entries.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  if (entries.length > 1 && entries[0][1] === entries[1][1]) return null;
  return entries[0][0];
}

function pickSummaryType({ recentCount, episodeHits, eligibleEpisodes, severitySample, minOcc }) {
  const episodeReady =
    eligibleEpisodes >= TREND_RECURRENCE_OCCURRENCES && episodeHits >= minOcc;
  if (episodeReady) return TREND_TYPES.PERIOD_EPISODE_RECURRENCE;
  if (recentCount >= minOcc) return TREND_TYPES.RECENT_OCCURRENCE;
  if (severitySample >= TREND_RECURRENCE_OCCURRENCES) return TREND_TYPES.RECENT_SEVERITY_DISTRIBUTION;
  return null;
}

/**
 * @param {{ logs: object[], today: string, inferred?: { periodRanges?: object[] }, windowDays?: number }} input
 */
export function buildObservationTrends({
  logs = [],
  today,
  inferred = null,
  windowDays = OBSERVATION_TREND_QUERY_DAYS,
  recentDays = OBSERVATION_TREND_RECENT_DAYS,
} = {}) {
  const day = civilDate(today);
  if (!day) {
    return {
      window: { from: null, to: null, recentDays, queryDays: windowDays },
      trends: [],
      generatedAt: null,
    };
  }
  const windowStart = addDays(day, -(windowDays - 1));
  const recentStart = addDays(day, -(recentDays - 1));
  const periodRanges = inferCycleStats(logs).periodRanges;
  const episodes = completedPeriodEpisodes(inferred?.periodRanges || periodRanges, {
    today: day,
    windowStart,
  });

  const buckets = new Map();
  for (const log of logs || []) {
    const date = civilDate(log?.date);
    if (!date || date < windowStart || date > day) continue;
    for (const fact of collectLogFacts(log)) {
      const meta = metadataForKey(fact.key);
      if (!meta) continue;
      let bucket = buckets.get(fact.key);
      if (!bucket) {
        bucket = {
          key: fact.key,
          dates: new Set(),
          recentDates: new Set(),
          periodDates: new Set(),
          episodeHits: new Set(),
          severities: { mild: 0, moderate: 0, severe: 0 },
          severitySample: 0,
          meta,
        };
        buckets.set(fact.key, bucket);
      }
      bucket.dates.add(date);
      if (date >= recentStart) bucket.recentDates.add(date);
      for (let i = 0; i < episodes.length; i += 1) {
        if (dateInPeriodRange(date, episodes[i])) {
          bucket.periodDates.add(date);
          bucket.episodeHits.add(i);
        }
      }
      if (fact.severity && Object.hasOwn(bucket.severities, fact.severity)) {
        bucket.severities[fact.severity] += 1;
        bucket.severitySample += 1;
      }
    }
  }

  const trends = [];
  for (const bucket of buckets.values()) {
    const occurrenceCount = bucket.dates.size;
    const recentCount = bucket.recentDates.size;
    const episodeCount = bucket.episodeHits.size;
    const minOcc = bucket.meta.minimumOccurrences ?? TREND_MIN_OCCURRENCES;
    const summaryType = pickSummaryType({
      recentCount,
      episodeHits: episodeCount,
      eligibleEpisodes: episodes.length,
      severitySample: bucket.severitySample,
      minOcc,
    });
    if (!summaryType) continue;
    const lastLoggedDate = [...bucket.dates].sort().at(-1);
    const recentDateList = [...bucket.recentDates].sort().reverse().slice(0, OBSERVATION_TREND_EXPAND_DATES);
    const allDateList = [...bucket.dates].sort().reverse().slice(0, OBSERVATION_TREND_EXPAND_DATES);
    const severityMode = dominantSeverity(bucket.severities);
    const summaryArgs =
      summaryType === TREND_TYPES.PERIOD_EPISODE_RECURRENCE
        ? { episodeCount, eligibleEpisodes: episodes.length }
        : summaryType === TREND_TYPES.RECENT_SEVERITY_DISTRIBUTION
          ? { mode: severityMode, sample: bucket.severitySample }
          : { days: recentCount, windowDays: recentDays, periodDayCount: bucket.periodDates.size };

    trends.push({
      key: bucket.key,
      category: bucket.meta.category,
      trendGroup: bucket.meta.trendGroup,
      window: summaryType === TREND_TYPES.PERIOD_EPISODE_RECURRENCE ? 'completed_episodes' : 'recent_30d',
      occurrenceCount,
      episodeCount,
      lastLoggedDate,
      summaryType,
      summaryArgs,
      recentDates: recentDateList.length ? recentDateList : allDateList,
      ...(bucket.severitySample
        ? { severityCounts: bucket.severities, severityMode }
        : {}),
    });
  }

  trends.sort((a, b) => {
    const ga = GROUP_RANK[a.trendGroup] ?? 100;
    const gb = GROUP_RANK[b.trendGroup] ?? 100;
    if (ga !== gb) return ga - gb;
    if (b.occurrenceCount !== a.occurrenceCount) return b.occurrenceCount - a.occurrenceCount;
    const da = a.lastLoggedDate || '';
    const db = b.lastLoggedDate || '';
    if (da !== db) return db.localeCompare(da);
    return a.key.localeCompare(b.key);
  });

  return {
    window: { from: windowStart, to: day, recentDays, queryDays: windowDays },
    trends,
    generatedAt: `${day}T00:00:00.000Z`,
  };
}

export function observationTrendPayloadHasSensitiveLeak(payload) {
  const text = JSON.stringify(payload);
  const forbidden = [
    'notes',
    'sexualActivity',
    'libido',
    'ovulationTest',
    'pregnancyTest',
    'bbt',
    'cervicalMucus',
    'pain_sex',
    'unprotected',
    'protected',
    'customTagIds',
  ];
  return forbidden.some((key) => new RegExp(`"${key}"`).test(text));
}
