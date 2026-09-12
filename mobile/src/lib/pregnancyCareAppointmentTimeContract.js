/**
 * Phase 35 — optional owner-entered prenatal appointment clock time.
 *
 * plannedTime is user metadata on an already-planned civil date.
 * Never invented. Not a medical recommendation.
 * Phase 33 DATE_BASED reminders ignore plannedTime.
 * Phase 36 exact-time reminders require explicit EXACT_TIME (separate contract).
 */

import { isCivilDateKey } from './pregnancyCareCatalog.js';

export const PLANNED_TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
export const CALENDAR_TIMED_EVENT_TECHNICAL_DURATION_MINUTES = 30;
export const CALENDAR_EXPORT_MODE = Object.freeze({
  ALL_DAY: 'ALL_DAY',
  TIMED: 'TIMED',
});

export function isClockTime(value) {
  return typeof value === 'string' && PLANNED_TIME_PATTERN.test(value);
}

export function parseClockTime(value) {
  if (!isClockTime(value)) return null;
  const [hour, minute] = value.split(':').map(Number);
  return { hour, minute };
}

export function formatClockTime(hour, minute) {
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export function clockToMinutes(value) {
  const parsed = parseClockTime(value);
  if (!parsed) return null;
  return parsed.hour * 60 + parsed.minute;
}

export function localNowMinutes(now = new Date()) {
  return now.getHours() * 60 + now.getMinutes();
}

/** Date-only plan if date exists and time is absent. */
export function resolvePlannedTime({ plannedDate, plannedTime } = {}) {
  if (!isCivilDateKey(plannedDate)) return null;
  return isClockTime(plannedTime) ? plannedTime : null;
}

export function defaultPlannedTime() {
  return null;
}

export function inventedAppointmentTimes() {
  return Object.freeze(['09:00', '10:00', '12:00']);
}

export function timeRequiresPlannedDate() {
  return true;
}

export function calendarTechnicalDurationIsMedical() {
  return false;
}

export function reminderSchedulingUsesPlannedTime() {
  return false;
}

export function exactTimeReminderAdded() {
  return false;
}

export function addMinutesToClock(time, minutes) {
  const start = clockToMinutes(time);
  if (start == null) return null;
  const total = start + Number(minutes);
  const dayOffset = Math.floor(total / (24 * 60));
  const wrapped = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
  return {
    time: formatClockTime(Math.floor(wrapped / 60), wrapped % 60),
    dayOffset,
  };
}

export function rejectMalformedPlannedTime(value) {
  if (value == null || value === '') return null;
  if (!isClockTime(value)) {
    const err = new Error('დაგეგმილი დრო არასწორია.');
    err.status = 400;
    throw err;
  }
  return value;
}

/**
 * Atomic resolve: no orphan time. Clearing date always clears time.
 * If plannedTime is omitted, keep existing time only when the resolved date remains.
 */
export function resolvePlannedDateAndTime({ plannedDate, plannedTime, existing } = {}) {
  const nextDate = plannedDate === undefined ? existing?.plannedDate ?? null : plannedDate;
  const date = isCivilDateKey(nextDate) ? nextDate : null;
  if (!date) return { plannedDate: null, plannedTime: null };
  const incoming = plannedTime === undefined ? existing?.plannedTime ?? null : plannedTime;
  if (incoming == null || incoming === '') return { plannedDate: date, plannedTime: null };
  return { plannedDate: date, plannedTime: rejectMalformedPlannedTime(incoming) };
}

export function exportModeForPlan({ plannedDate, plannedTime } = {}) {
  return resolvePlannedTime({ plannedDate, plannedTime })
    ? CALENDAR_EXPORT_MODE.TIMED
    : CALENDAR_EXPORT_MODE.ALL_DAY;
}

/**
 * New export eligibility. Date-only today stays allowed (Phase 34).
 * Today + past plannedTime: no new V1 export.
 * Past civil date: still suppressed.
 */
export function isTimedPlanInThePast({ plannedDate, plannedTime, today, nowMinutes } = {}) {
  if (!isCivilDateKey(plannedDate) || !isCivilDateKey(today)) return false;
  if (plannedDate < today) return true;
  const time = resolvePlannedTime({ plannedDate, plannedTime });
  if (plannedDate > today || !time) return false;
  if (!Number.isInteger(nowMinutes)) return false;
  const minutes = clockToMinutes(time);
  return minutes != null && minutes <= nowMinutes;
}

export function displayPlannedTime(value) {
  return isClockTime(value) ? value : null;
}
