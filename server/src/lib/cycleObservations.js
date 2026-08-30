/**
 * Phase 9 daily observations — user-logged only.
 * Must never change cycle length, period inference, ovulation, fertile window,
 * phase, confidence, or contraception presentation.
 */

export const PAIN_TYPES = [
  'cramps',
  'pelvic',
  'lower_back',
  'headache',
  'breast',
  'ovulation_side',
  'other',
];

export const PAIN_SEVERITIES = ['mild', 'moderate', 'severe'];

export const SLEEP_QUALITIES = ['poor', 'okay', 'good'];
export const STRESS_LEVELS = ['low', 'medium', 'high'];
export const EXERCISE_LEVELS = ['none', 'light', 'moderate', 'intense'];
export const CAFFEINE_LEVELS = ['none', 'low', 'moderate', 'high'];
export const ALCOHOL_LEVELS = ['none', 'light', 'moderate', 'heavy'];

export const CYCLE_NOTE_MAX = 2000;
export const CYCLE_TAG_NAME_MAX = 48;
export const CYCLE_TAG_ACTIVE_MAX = 30;
export const CYCLE_TAGS_PER_DAY_MAX = 8;
export const CYCLE_PAIN_MAX = 7;
export const OBSERVATION_PATTERN_MIN = 5;

export const PAIN_MANAGED_SYMPTOM_IDS = [
  'cramps',
  'headache',
  'back_pain',
  'breast_tenderness',
  'pelvic_pain',
  'ovulation_pain',
];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isClientUuid(id) {
  return typeof id === 'string' && UUID_RE.test(id.trim());
}

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function inSet(value, allowed) {
  return typeof value === 'string' && allowed.includes(value);
}

export function parseEnumOrNull(value, allowed, { strict = false, field = 'value' } = {}) {
  if (value == null || value === '') return null;
  if (inSet(value, allowed)) return value;
  if (strict) throw httpError(400, `არასწორი ${field}.`);
  return null;
}

export function parsePainEntries(raw, { strict = false } = {}) {
  if (raw == null) return [];
  if (!Array.isArray(raw)) {
    if (strict) throw httpError(400, 'ტკივილის ჩანაწერი არასწორია.');
    return [];
  }
  if (raw.length > CYCLE_PAIN_MAX) {
    if (strict) throw httpError(400, 'ტკივილის ჩანაწერების ლიმიტი გადაჭარბებულია.');
    raw = raw.slice(0, CYCLE_PAIN_MAX);
  }
  const seen = new Set();
  const out = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') {
      if (strict) throw httpError(400, 'ტკივილის ჩანაწერი არასწორია.');
      continue;
    }
    const type = item.type;
    const severity = item.severity;
    if (!inSet(type, PAIN_TYPES) || !inSet(severity, PAIN_SEVERITIES)) {
      if (strict) throw httpError(400, 'ტკივილის ტიპი ან სიმძიმე არასწორია.');
      continue;
    }
    if (seen.has(type)) continue;
    seen.add(type);
    out.push({ type, severity });
  }
  return out;
}

export function parseCustomTagIds(raw, { strict = false } = {}) {
  if (raw == null) return [];
  if (!Array.isArray(raw)) {
    if (strict) throw httpError(400, 'ნიშნები არასწორია.');
    return [];
  }
  const out = [];
  const seen = new Set();
  for (const id of raw) {
    if (!isClientUuid(id)) {
      if (strict) throw httpError(400, 'ნიშნის იდენტიფიკატორი არასწორია.');
      continue;
    }
    const key = String(id).trim();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(key);
    if (out.length > CYCLE_TAGS_PER_DAY_MAX) {
      if (strict) throw httpError(400, 'დღიურ ნიშნების ლიმიტი გადაჭარბებულია.');
      return out.slice(0, CYCLE_TAGS_PER_DAY_MAX);
    }
  }
  return out;
}

export function parseCycleNote(raw, { strict = false } = {}) {
  if (raw == null) return null;
  const notes = String(raw).trim();
  if (!notes) return null;
  if (notes.length > CYCLE_NOTE_MAX) {
    if (strict) throw httpError(400, `ჩანაწერი მაქსიმუმ ${CYCLE_NOTE_MAX} სიმბოლოა.`);
    return notes.slice(0, CYCLE_NOTE_MAX);
  }
  return notes;
}

export function normalizeTagName(raw) {
  const name = String(raw ?? '')
    .normalize('NFC')
    .trim()
    .replace(/\s+/g, ' ');
  if (!name) return { ok: false, error: 'empty' };
  if (name.length > CYCLE_TAG_NAME_MAX) return { ok: false, error: 'too_long' };
  return { ok: true, name, nameNormalized: name.toLocaleLowerCase('ka') };
}

export function foreignTagIds(requestedIds, ownedIds) {
  const owned = new Set(ownedIds);
  return (requestedIds || []).filter((id) => !owned.has(id));
}

export function shapeLogObservations(log) {
  return {
    painEntries: parsePainEntries(log?.painEntries),
    sleepQuality: parseEnumOrNull(log?.sleepQuality, SLEEP_QUALITIES),
    stressLevel: parseEnumOrNull(log?.stressLevel, STRESS_LEVELS),
    exerciseLevel: parseEnumOrNull(log?.exerciseLevel, EXERCISE_LEVELS),
    caffeine: parseEnumOrNull(log?.caffeine, CAFFEINE_LEVELS),
    alcohol: parseEnumOrNull(log?.alcohol, ALCOHOL_LEVELS),
    customTagIds: parseCustomTagIds(log?.customTagIds),
    notes: parseCycleNote(log?.notes),
  };
}

export function logHasPhase9Extras(log) {
  if (!log) return false;
  const shaped = shapeLogObservations(log);
  return (
    shaped.painEntries.length > 0 ||
    Boolean(shaped.sleepQuality) ||
    Boolean(shaped.stressLevel) ||
    Boolean(shaped.exerciseLevel) ||
    Boolean(shaped.caffeine) ||
    Boolean(shaped.alcohol) ||
    shaped.customTagIds.length > 0
  );
}

export function observationAiBits(log) {
  if (!log) return [];
  const bits = [];
  const pain = parsePainEntries(log.painEntries);
  if (pain.length) {
    bits.push(`ტკივილი=${pain.map((p) => `${p.type}:${p.severity}`).join(',')}`);
  }
  const sleep = parseEnumOrNull(log.sleepQuality, SLEEP_QUALITIES);
  if (sleep) bits.push(`ძილი=${sleep}`);
  const stress = parseEnumOrNull(log.stressLevel, STRESS_LEVELS);
  if (stress) bits.push(`სტრესი=${stress}`);
  return bits;
}

export function collectPainObservations(logs = []) {
  const out = [];
  for (const log of logs) {
    for (const entry of parsePainEntries(log.painEntries)) {
      out.push({ date: log.date, type: entry.type, severity: entry.severity });
    }
  }
  return out.sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

export function lifestyleSummary(logs = []) {
  const sleep = { poor: 0, okay: 0, good: 0 };
  const stress = { low: 0, medium: 0, high: 0 };
  const exercise = { none: 0, light: 0, moderate: 0, intense: 0 };
  const caffeine = { none: 0, low: 0, moderate: 0, high: 0 };
  const alcohol = { none: 0, light: 0, moderate: 0, heavy: 0 };
  for (const log of logs) {
    const s = parseEnumOrNull(log.sleepQuality, SLEEP_QUALITIES);
    if (s) sleep[s] += 1;
    const t = parseEnumOrNull(log.stressLevel, STRESS_LEVELS);
    if (t) stress[t] += 1;
    const e = parseEnumOrNull(log.exerciseLevel, EXERCISE_LEVELS);
    if (e) exercise[e] += 1;
    const c = parseEnumOrNull(log.caffeine, CAFFEINE_LEVELS);
    if (c) caffeine[c] += 1;
    const a = parseEnumOrNull(log.alcohol, ALCOHOL_LEVELS);
    if (a) alcohol[a] += 1;
  }
  return { sleep, stress, exercise, caffeine, alcohol };
}

function bump(map, key) {
  map[key] = (map[key] || 0) + 1;
}

function hasHeadache(log) {
  const pain = parsePainEntries(log.painEntries);
  if (pain.some((p) => p.type === 'headache')) return true;
  const symptoms = Array.isArray(log.symptoms) ? log.symptoms : [];
  return symptoms.includes('headache') || symptoms.includes('migraine');
}

/**
 * Descriptive counts and cautious co-occurrence text.
 * No diagnosis. No percentages from tiny samples.
 */
export function buildObservationInsights(logs = [], options = {}) {
  const limited = options.predictionAvailability === 'LIMITED';
  const phasesByDate = options.phasesByDate || {};
  const sampleDays = logs.length;
  const severityCounts = { mild: 0, moderate: 0, severe: 0 };
  const typeCounts = {};
  const painDays = new Set();
  const recent = [];

  for (const log of logs) {
    const entries = parsePainEntries(log.painEntries);
    if (entries.length) painDays.add(log.date);
    for (const entry of entries) {
      severityCounts[entry.severity] += 1;
      bump(typeCounts, entry.type);
      recent.push({ date: log.date, type: entry.type, severity: entry.severity });
    }
  }
  recent.sort((a, b) => String(b.date).localeCompare(String(a.date)));

  const patterns = [];

  const highStressDays = logs.filter((l) => parseEnumOrNull(l.stressLevel, STRESS_LEVELS) === 'high');
  if (highStressDays.length >= OBSERVATION_PATTERN_MIN) {
    const withHeadache = highStressDays.filter(hasHeadache).length;
    if (withHeadache > 0) {
      patterns.push({
        id: 'stress_headache',
        sampleDays: highStressDays.length,
        numerator: withHeadache,
        denominator: highStressDays.length,
        textKa: `თავის ტკივილი აღირიცხა ${withHeadache} დღეს ${highStressDays.length}-დან, სადაც მაღალი სტრესიც იყო აღრიცხული.`,
      });
    }
  }

  const poorSleepDays = logs.filter((l) => parseEnumOrNull(l.sleepQuality, SLEEP_QUALITIES) === 'poor');
  if (poorSleepDays.length >= OBSERVATION_PATTERN_MIN) {
    const withFatigue = poorSleepDays.filter((l) =>
      (Array.isArray(l.symptoms) ? l.symptoms : []).includes('fatigue'),
    ).length;
    if (withFatigue > 0) {
      patterns.push({
        id: 'sleep_fatigue',
        sampleDays: poorSleepDays.length,
        numerator: withFatigue,
        denominator: poorSleepDays.length,
        textKa: `დაღლილობა აღირიცხა ${withFatigue} დღეს ${poorSleepDays.length}-დან, სადაც ძილი ცუდად იყო აღრიცხული.`,
      });
    }
  }

  if (!limited && painDays.size >= OBSERVATION_PATTERN_MIN) {
    const pelvicDays = logs.filter((l) =>
      parsePainEntries(l.painEntries).some((p) => p.type === 'pelvic' || p.type === 'cramps'),
    );
    if (pelvicDays.length >= OBSERVATION_PATTERN_MIN) {
      const luteal = pelvicDays.filter((l) => phasesByDate[l.date] === 'luteal').length;
      if (luteal >= 4 && luteal / pelvicDays.length >= 0.6) {
        patterns.push({
          id: 'pelvic_luteal',
          sampleDays: pelvicDays.length,
          numerator: luteal,
          denominator: pelvicDays.length,
          textKa: `მენჯის ტკივილი უფრო ხშირად აღირიცხა იმ დღეებზე, რომლებსაც Medicard ლუტეალურად აფასებს. ეს კორელაციაა, არა მიზეზი.`,
        });
      }
    }
  }

  const noteDates = logs
    .filter((l) => Boolean(parseCycleNote(l.notes)))
    .map((l) => l.date)
    .sort((a, b) => String(b).localeCompare(String(a)));

  return {
    pain: {
      daysLogged: painDays.size,
      sampleDays,
      severityCounts,
      typeCounts,
      recent: recent.slice(0, 20),
    },
    lifestyle: {
      ...lifestyleSummary(logs),
      patterns,
    },
    journal: {
      noteDays: noteDates.length,
      dates: noteDates.slice(0, 40),
    },
    limitedPhaseInsights: limited,
  };
}

export function parseObservationWrite(body = {}) {
  const out = {};
  if (body.painEntries !== undefined) {
    out.painEntries = parsePainEntries(body.painEntries, { strict: true });
  }
  if (body.sleepQuality !== undefined) {
    out.sleepQuality = parseEnumOrNull(body.sleepQuality, SLEEP_QUALITIES, {
      strict: true,
      field: 'sleepQuality',
    });
  }
  if (body.stressLevel !== undefined) {
    out.stressLevel = parseEnumOrNull(body.stressLevel, STRESS_LEVELS, {
      strict: true,
      field: 'stressLevel',
    });
  }
  if (body.exerciseLevel !== undefined) {
    out.exerciseLevel = parseEnumOrNull(body.exerciseLevel, EXERCISE_LEVELS, {
      strict: true,
      field: 'exerciseLevel',
    });
  }
  if (body.caffeine !== undefined) {
    out.caffeine = parseEnumOrNull(body.caffeine, CAFFEINE_LEVELS, {
      strict: true,
      field: 'caffeine',
    });
  }
  if (body.alcohol !== undefined) {
    out.alcohol = parseEnumOrNull(body.alcohol, ALCOHOL_LEVELS, {
      strict: true,
      field: 'alcohol',
    });
  }
  if (body.customTagIds !== undefined) {
    out.customTagIds = parseCustomTagIds(body.customTagIds, { strict: true });
  }
  if (body.notes !== undefined) {
    out.notes = parseCycleNote(body.notes, { strict: true });
  }
  return out;
}
