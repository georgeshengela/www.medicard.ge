/**
 * Cycle observation assessment / exposure foundation (Phase 28).
 *
 * Three semantic states for assessment-eligible keys:
 *   UNKNOWN | ABSENT | PRESENT
 *
 * Positive canonical observation ⇒ PRESENT (even without assessment metadata).
 * ABSENT requires explicit user action stored on CycleLog.observationAssessments.
 * Historical missing and historical boolean false remain UNKNOWN.
 *
 * No percentages. No diagnosis. No AI.
 */

import {
  assessmentEligibleDefs,
  isAssessmentEligible,
} from './cycleObservationRegistry.js';

export const ASSESSMENT_STATES = Object.freeze({
  UNKNOWN: 'UNKNOWN',
  ABSENT: 'ABSENT',
  PRESENT: 'PRESENT',
});

export const ASSESSMENT_VALUE_ABSENT = 'ABSENT';

export const PREGNANCY_DAILY_ASSESSMENT_KEYS = Object.freeze(['nausea', 'vomiting', 'fatigue']);
export const PERIMENOPAUSE_DAILY_ASSESSMENT_KEYS = Object.freeze([
  'hot_flashes',
  'night_sweats',
  'fatigue',
]);

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function symptomList(log) {
  return Array.isArray(log?.symptoms) ? log.symptoms.map(String) : [];
}

export function hasPositiveObservation(log, key) {
  return symptomList(log).includes(String(key));
}

export function parseObservationAssessments(raw, { strict = false } = {}) {
  if (raw == null || raw === '') return {};
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    if (strict) throw httpError(400, 'აღრიცხვის შეფასება არასწორია.');
    return {};
  }
  const out = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!isAssessmentEligible(key)) {
      if (strict) throw httpError(400, 'უცნობი აღრიცხვა.');
      continue;
    }
    if (value === ASSESSMENT_VALUE_ABSENT) {
      out[key] = ASSESSMENT_VALUE_ABSENT;
      continue;
    }
    if (value == null || value === '' || value === false || value === ASSESSMENT_STATES.UNKNOWN) {
      continue;
    }
    if (strict) throw httpError(400, `არასწორი ${key}.`);
  }
  return out;
}

function hasLegacyFalse(log, key) {
  const bag = log?.observations;
  return Boolean(bag && typeof bag === 'object' && bag[key] === false);
}

export function resolveObservationAssessment(log, key) {
  if (!isAssessmentEligible(key)) {
    return { state: ASSESSMENT_STATES.UNKNOWN, source: 'ineligible' };
  }
  const positive = hasPositiveObservation(log, key);
  const absences = parseObservationAssessments(log?.observationAssessments);
  const explicitAbsent = absences[key] === ASSESSMENT_VALUE_ABSENT;

  if (positive && explicitAbsent) {
    console.warn(
      `[cycle-assessment] invariant: ${key} has a positive observation and ABSENT metadata; PRESENT wins`,
    );
    return { state: ASSESSMENT_STATES.PRESENT, source: 'positive_log', conflict: true };
  }
  if (positive) {
    return { state: ASSESSMENT_STATES.PRESENT, source: 'positive_log' };
  }
  if (explicitAbsent) {
    return { state: ASSESSMENT_STATES.ABSENT, source: 'explicit_assessment' };
  }
  if (hasLegacyFalse(log, key)) {
    return { state: ASSESSMENT_STATES.UNKNOWN, source: 'legacy_false' };
  }
  return { state: ASSESSMENT_STATES.UNKNOWN, source: 'legacy_unknown' };
}

export function stripAbsencesConflictingWithPresent(absences, symptoms) {
  const next = { ...absences };
  const present = new Set(Array.isArray(symptoms) ? symptoms.map(String) : []);
  for (const key of Object.keys(next)) {
    if (present.has(key)) delete next[key];
  }
  return next;
}

export function applyAssessmentWrite(body = {}, existing = {}, nextFields = {}) {
  if (body.observationAssessments === undefined && nextFields.symptoms === undefined) {
    return {};
  }
  const symptoms =
    nextFields.symptoms !== undefined
      ? nextFields.symptoms
      : symptomList(existing);
  const absences =
    body.observationAssessments !== undefined
      ? parseObservationAssessments(body.observationAssessments, { strict: true })
      : parseObservationAssessments(existing.observationAssessments);
  return {
    observationAssessments: stripAbsencesConflictingWithPresent(absences, symptoms),
  };
}

export function resolveDailyAssessments(log) {
  const out = {};
  for (const defn of assessmentEligibleDefs()) {
    const resolved = resolveObservationAssessment(log, defn.key);
    if (resolved.state !== ASSESSMENT_STATES.UNKNOWN) {
      out[defn.key] = resolved.state;
    }
  }
  return out;
}

export function explicitAbsentKeys(log) {
  return Object.keys(parseObservationAssessments(log?.observationAssessments)).filter((key) => {
    return resolveObservationAssessment(log, key).state === ASSESSMENT_STATES.ABSENT;
  });
}

/**
 * Field-specific exposure counts. UNKNOWN days never enter the denominator.
 * Pass `dates` for a calendar window so missing logs count as UNKNOWN.
 * Do not use daysWithAnyLog or daysInMode as a denominator.
 */
export function aggregateObservationExposure(logs, key, { dates } = {}) {
  const empty = {
    presentDays: 0,
    absentDays: 0,
    assessedDays: 0,
    unknownDays: 0,
    firstAssessedDate: null,
    lastAssessedDate: null,
  };
  if (!isAssessmentEligible(key)) return empty;

  const byDate = new Map();
  for (const log of Array.isArray(logs) ? logs : []) {
    const date = String(log?.date || '');
    if (date) byDate.set(date, log);
  }
  const window = (Array.isArray(dates) && dates.length ? dates.map(String) : [...byDate.keys()]).slice();
  window.sort((a, b) => a.localeCompare(b));

  let presentDays = 0;
  let absentDays = 0;
  let unknownDays = 0;
  let firstAssessedDate = null;
  let lastAssessedDate = null;
  for (const date of window) {
    const log = byDate.get(date) || { date, symptoms: [], observationAssessments: {} };
    const { state } = resolveObservationAssessment(log, key);
    if (state === ASSESSMENT_STATES.PRESENT) {
      presentDays += 1;
      if (!firstAssessedDate) firstAssessedDate = date;
      lastAssessedDate = date;
    } else if (state === ASSESSMENT_STATES.ABSENT) {
      absentDays += 1;
      if (!firstAssessedDate) firstAssessedDate = date;
      lastAssessedDate = date;
    } else {
      unknownDays += 1;
    }
  }
  return {
    presentDays,
    absentDays,
    assessedDays: presentDays + absentDays,
    unknownDays,
    firstAssessedDate,
    lastAssessedDate,
  };
}

export function applyAssessmentState(form, key, state) {
  const symptoms = (form.symptoms || []).filter((item) => item !== key);
  const assessments = { ...(form.observationAssessments || {}) };
  delete assessments[key];
  if (state === ASSESSMENT_STATES.PRESENT) {
    return { symptoms: [...symptoms, key], observationAssessments: assessments };
  }
  if (state === ASSESSMENT_STATES.ABSENT) {
    return {
      symptoms,
      observationAssessments: { ...assessments, [key]: ASSESSMENT_VALUE_ABSENT },
    };
  }
  return { symptoms, observationAssessments: assessments };
}

/** Chip on/off never writes ABSENT. Removal → UNKNOWN. */
export function applySymptomChipToggle(form, id) {
  const has = (form.symptoms || []).includes(id);
  const symptoms = has ? (form.symptoms || []).filter((item) => item !== id) : [...(form.symptoms || []), id];
  const assessments = { ...(form.observationAssessments || {}) };
  delete assessments[id];
  return { symptoms, observationAssessments: assessments };
}
