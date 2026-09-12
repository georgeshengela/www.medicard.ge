/**
 * Cycle observation assessment (Phase 28).
 * Keep in lockstep with server/src/lib/cycleObservationAssessment.js.
 * Mobile uses this for editor restore and optimistic overlay — the server owns denominator validity.
 */

export const ASSESSMENT_STATES = Object.freeze({
  UNKNOWN: 'UNKNOWN',
  ABSENT: 'ABSENT',
  PRESENT: 'PRESENT',
});

export const ASSESSMENT_VALUE_ABSENT = 'ABSENT';

export const ASSESSMENT_ELIGIBLE_KEYS = Object.freeze([
  'nausea',
  'vomiting',
  'fatigue',
  'hot_flashes',
  'night_sweats',
]);

export const PREGNANCY_DAILY_ASSESSMENT_KEYS = Object.freeze(['nausea', 'vomiting', 'fatigue']);
export const PERIMENOPAUSE_DAILY_ASSESSMENT_KEYS = Object.freeze([
  'hot_flashes',
  'night_sweats',
  'fatigue',
]);

export function isAssessmentEligible(key) {
  return ASSESSMENT_ELIGIBLE_KEYS.includes(String(key));
}

function symptomList(log) {
  return Array.isArray(log?.symptoms) ? log.symptoms.map(String) : [];
}

export function hasPositiveObservation(log, key) {
  return symptomList(log).includes(String(key));
}

export function parseObservationAssessments(raw) {
  if (raw == null || raw === '') return {};
  if (typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!isAssessmentEligible(key)) continue;
    if (value === ASSESSMENT_VALUE_ABSENT) out[key] = ASSESSMENT_VALUE_ABSENT;
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

export function explicitAbsentKeys(log) {
  return Object.keys(parseObservationAssessments(log?.observationAssessments)).filter((key) => {
    return resolveObservationAssessment(log, key).state === ASSESSMENT_STATES.ABSENT;
  });
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

export function applySymptomChipToggle(form, id) {
  const has = (form.symptoms || []).includes(id);
  const symptoms = has ? (form.symptoms || []).filter((item) => item !== id) : [...(form.symptoms || []), id];
  const assessments = { ...(form.observationAssessments || {}) };
  delete assessments[id];
  return { symptoms, observationAssessments: assessments };
}

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
