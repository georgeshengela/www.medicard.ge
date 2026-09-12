/**
 * Pregnancy observation presentation — Phase 22.
 * Canonical CycleLog facts only. No diagnosis, triage, or parallel store.
 */

import { addDays, CYCLE_TIMEZONE, todayInTimeZone } from './cycle.js';
import {
  getObservationDef,
  isSensitiveObservation,
  parseObservationBag,
  stripPainManagedSymptoms,
} from './cycleObservationRegistry.js';
import { parsePainEntries } from './cycleObservations.js';

export const PREGNANCY_OBSERVATION_RECENT_DAYS = 90;

/** Approved pregnancy display chips. Unknown stored keys never appear. */
export const PREGNANCY_DISPLAY_SYMPTOM_KEYS = Object.freeze([
  'nausea',
  'vomiting',
  'fatigue',
  'dizziness',
  'migraine',
  'bloating',
  'constipation',
  'diarrhea',
  'heartburn',
  'swelling',
  'breast_swelling',
  'short_breath',
  'frequent_urination',
  'leg_cramps',
  'discharge',
]);

export const PREGNANCY_QUICK_DIGESTION = Object.freeze([
  'nausea',
  'vomiting',
  'bloating',
  'constipation',
  'diarrhea',
  'heartburn',
]);

export const PREGNANCY_QUICK_BODY = Object.freeze([
  'dizziness',
  'swelling',
  'short_breath',
  'frequent_urination',
  'leg_cramps',
]);

export const PREGNANCY_QUICK_ENERGY_CHIPS = Object.freeze(['fatigue']);

export const PREGNANCY_PAIN_TYPES = Object.freeze([
  'cramps',
  'pelvic',
  'lower_back',
  'headache',
  'breast',
  'other',
]);

const DISPLAY_SET = new Set(PREGNANCY_DISPLAY_SYMPTOM_KEYS);
const BLEED_FLOWS = new Set(['spotting', 'light', 'medium', 'heavy']);
const PAIN_TYPES_OK = new Set([
  'cramps',
  'pelvic',
  'lower_back',
  'headache',
  'breast',
  'ovulation_side',
  'other',
]);
const SEVERITIES = new Set(['mild', 'moderate', 'severe']);
const ENERGY_OK = new Set(['very_low', 'low', 'normal', 'high', 'very_high']);
const SLEEP_OK = new Set(['poor', 'okay', 'good']);
const STRESS_OK = new Set(['low', 'medium', 'high']);

export function civilFromTimestamp(value, timeZone = CYCLE_TIMEZONE) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return todayInTimeZone(timeZone, d);
}

/**
 * Lower bound is ACTIVE episode startedAt (civil), not LMP/referenceDate.
 * Do not infer pregnancy onset from symptoms.
 */
export function episodeObservationWindow({
  episode,
  today,
  recentDays = PREGNANCY_OBSERVATION_RECENT_DAYS,
} = {}) {
  if (typeof today !== 'string') {
    return { from: null, to: null, empty: true };
  }
  const startedRaw = civilFromTimestamp(episode?.startedAt);
  const started = startedRaw && startedRaw > today ? today : startedRaw;
  const ended =
    episode?.status === 'ENDED' && episode?.endedAt ? civilFromTimestamp(episode.endedAt) : today;
  const capFrom = addDays(today, -(recentDays - 1));
  let from = capFrom;
  if (started && started > from) from = started;
  let to = today;
  if (ended && ended < to) to = ended;
  if (from > to) return { from, to, empty: true };
  return { from, to, empty: false };
}

export function pregnancyLogQueryFrom({ episode, today, historyDays = 280 } = {}) {
  const capFrom = addDays(today, -(historyDays - 1));
  const startedRaw = civilFromTimestamp(episode?.startedAt);
  const started = startedRaw && startedRaw > today ? today : startedRaw;
  if (started && started > capFrom) return started;
  return capFrom;
}

function knownDisplaySymptoms(log, { includeIntimate = false } = {}) {
  return stripPainManagedSymptoms(Array.isArray(log?.symptoms) ? log.symptoms : [], log?.painEntries).filter(
    (key) => {
      const defn = getObservationDef(key);
      if (!defn || !defn.enabled) return false;
      if (!DISPLAY_SET.has(key)) return false;
      if (key === 'discharge') return includeIntimate === true;
      if (isSensitiveObservation(key)) return false;
      return true;
    },
  );
}

export function presentPregnancyDay(log, { includeIntimate = false } = {}) {
  if (!log || typeof log.date !== 'string') return null;
  const bleeding = BLEED_FLOWS.has(log.flow) ? log.flow : null;
  const pain = parsePainEntries(log.painEntries)
    .filter((entry) => PAIN_TYPES_OK.has(entry.type) && SEVERITIES.has(entry.severity))
    .map((entry) => ({ type: entry.type, severity: entry.severity }));
  const symptoms = knownDisplaySymptoms(log, { includeIntimate });
  const bag = parseObservationBag(log.observations);
  const energyRaw = log.energy || bag.energy;
  const energy = ENERGY_OK.has(energyRaw) ? energyRaw : null;
  const sleepQuality = SLEEP_OK.has(log.sleepQuality) ? log.sleepQuality : null;
  const stressLevel = STRESS_OK.has(log.stressLevel) ? log.stressLevel : null;
  const wellness = {};
  if (energy) wellness.energy = energy;
  if (sleepQuality) wellness.sleepQuality = sleepQuality;
  if (stressLevel) wellness.stressLevel = stressLevel;

  if (!bleeding && !pain.length && !symptoms.length && !Object.keys(wellness).length) return null;

  return {
    date: log.date,
    spotting: bleeding === 'spotting',
    ...(bleeding ? { bleeding } : {}),
    pain,
    symptoms,
    wellness,
  };
}

export function presentPregnancyRecentObservations(
  logs,
  { from, to, includeIntimate = true, limit = PREGNANCY_OBSERVATION_RECENT_DAYS } = {},
) {
  const rows = [];
  for (const log of logs || []) {
    if (from && log.date < from) continue;
    if (to && log.date > to) continue;
    const presented = presentPregnancyDay(log, { includeIntimate });
    if (presented) rows.push(presented);
  }
  rows.sort((a, b) => b.date.localeCompare(a.date));
  return rows.slice(0, limit);
}
