/**
 * Phase 34 — owner-opted prenatal care OS calendar export.
 *
 * One-way LOCAL DEVICE INTEGRATION of a user-owned plannedDate.
 * Not a medical scheduling engine. Catalog windows never create events.
 * No OS calendar scanning. No completion inference. No AI.
 */

import { isCivilDateKey } from './pregnancyCareCatalog.js';
import {
  CALENDAR_EXPORT_MODE,
  CALENDAR_TIMED_EVENT_TECHNICAL_DURATION_MINUTES,
  addMinutesToClock,
  exportModeForPlan,
  isTimedPlanInThePast,
  resolvePlannedTime,
} from './pregnancyCareAppointmentTimeContract.js';

export const PREGNANCY_CARE_CALENDAR_PREF_BASE = 'medicard.pregnancy.careCalendar.v1';
export const PREGNANCY_CARE_CALENDAR_STORE_VERSION = 1;

export const CALENDAR_GENERIC_TITLE = 'Medicard — დაგეგმილი ვიზიტი';
export const CALENDAR_EVENT_NOTES = 'Created from Medicard care planner.';

export const CALENDAR_TITLE_MODE = Object.freeze({
  GENERIC: 'generic',
  DETAILED: 'detailed',
});

export const CALENDAR_EXPORT_UI = Object.freeze({
  HIDDEN: 'HIDDEN',
  NOT_EXPORTED: 'NOT_EXPORTED',
  PAST_NO_EXPORT: 'PAST_NO_EXPORT',
  EXPORTED: 'EXPORTED',
  DATE_DIFFERS: 'DATE_DIFFERS',
  EVENT_UNAVAILABLE: 'EVENT_UNAVAILABLE',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  PERMISSION_REVOKED: 'PERMISSION_REVOKED',
});

/** Medicard never searches device calendars for these (or any medical) terms. */
export const CALENDAR_SCAN_FORBIDDEN_TERMS = Object.freeze([
  'pregnancy',
  'ultrasound',
  'hospital',
  'screening',
  'doctor',
  'care-item',
]);

export function addCivilDays(key, n) {
  if (!isCivilDateKey(key)) return null;
  const [y, m, d] = key.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + Number(n)));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(
    dt.getUTCDate(),
  ).padStart(2, '0')}`;
}

export function isTodayOrFutureCivilDate(plannedDate, today) {
  return isCivilDateKey(plannedDate) && isCivilDateKey(today) && plannedDate >= today;
}

export function isPastCivilDate(plannedDate, today) {
  return isCivilDateKey(plannedDate) && isCivilDateKey(today) && plannedDate < today;
}

/**
 * New export eligibility. Catalog timing is ignored.
 * reviewRequired does not block a user-owned plannedDate.
 */
export function canOfferNewCalendarExport({
  plannedDate,
  plannedTime,
  today,
  nowMinutes,
  catalogRelation,
  reviewRequired,
} = {}) {
  void catalogRelation;
  void reviewRequired;
  if (!isTodayOrFutureCivilDate(plannedDate, today)) return false;
  if (isTimedPlanInThePast({ plannedDate, plannedTime, today, nowMinutes })) return false;
  return true;
}

export function catalogWindowAloneNeverCreatesEvent({ relation, plannedDate } = {}) {
  if (plannedDate) return false;
  return relation === 'BEFORE_WINDOW' || relation === 'IN_WINDOW' || relation === 'AFTER_WINDOW';
}

export function shouldAutoExportCalendar(trigger = {}) {
  void trigger;
  return false;
}

export function shouldAutoDeleteCalendarEvent(reason = {}) {
  void reason;
  return false;
}

export function shouldSilentUpdateCalendarOnDateChange() {
  return false;
}

export function shouldSilentUpdateCalendarOnTimeChange() {
  return false;
}

export function medicardAddsOsCalendarAlarm() {
  return false;
}

export function calendarExportMutatesReminder() {
  return false;
}

export function calendarExportReminderPatch() {
  return Object.freeze({});
}

export function calendarOwnershipIdentity({ userId, episodeId, careItemId } = {}) {
  if (!userId || !episodeId || !careItemId) return null;
  return `${userId}:${episodeId}:${careItemId}`;
}

export function calendarEventTitle({ titleMode, itemTitle } = {}) {
  if (titleMode === CALENDAR_TITLE_MODE.DETAILED && typeof itemTitle === 'string' && itemTitle.trim()) {
    return `Medicard — ${itemTitle.trim()}`;
  }
  return CALENDAR_GENERIC_TITLE;
}

export function genericTitleIsPrivacySafe(title = CALENDAR_GENERIC_TITLE) {
  return !/(ორსულ|ანატომ|სკან|სკრინინგ|GBS|გენეტიკ|ულტრაბგერ)/i.test(title);
}

export function calendarEventNotes({ plannerNote, sources, pregnancyWeek, sourceUrls } = {}) {
  void plannerNote;
  void sources;
  void pregnancyWeek;
  void sourceUrls;
  return CALENDAR_EVENT_NOTES;
}

export function notesFirewallHolds(notes, { plannerNote, sourceUrl } = {}) {
  if (notes !== CALENDAR_EVENT_NOTES) return false;
  if (plannerNote && notes.includes(plannerNote)) return false;
  if (sourceUrl && notes.includes(sourceUrl)) return false;
  return true;
}

export function allDayCivilRange(plannedDate) {
  if (!isCivilDateKey(plannedDate)) return null;
  return {
    startDate: plannedDate,
    endDate: addCivilDays(plannedDate, 1),
    allDay: true,
    alarms: [],
  };
}

export function eventPayloadHasInventedClock(payload, { plannedTime } = {}) {
  if (!payload) return true;
  if (Array.isArray(payload.alarms) && payload.alarms.length > 0) return true;
  const userTime = resolvePlannedTime({ plannedDate: payload.startDate, plannedTime });
  if (payload.allDay === true) {
    return Boolean(payload.startTime) || typeof payload.hour === 'number' || typeof payload.minute === 'number';
  }
  if (!userTime) return true;
  return payload.startTime !== userTime;
}

export function buildCalendarEventPayload({ plannedDate, plannedTime, titleMode, itemTitle } = {}) {
  if (!isCivilDateKey(plannedDate)) return null;
  const time = resolvePlannedTime({ plannedDate, plannedTime });
  const base = {
    title: calendarEventTitle({ titleMode, itemTitle }),
    notes: calendarEventNotes(),
    alarms: [],
    timeZone: 'device-local',
  };
  if (!time) {
    const range = allDayCivilRange(plannedDate);
    if (!range) return null;
    return {
      ...base,
      startDate: range.startDate,
      endDate: range.endDate,
      allDay: true,
      exportMode: CALENDAR_EXPORT_MODE.ALL_DAY,
    };
  }
  const end = addMinutesToClock(time, CALENDAR_TIMED_EVENT_TECHNICAL_DURATION_MINUTES);
  return {
    ...base,
    startDate: plannedDate,
    startTime: time,
    endDate: end?.dayOffset ? addCivilDays(plannedDate, end.dayOffset) : plannedDate,
    endTime: end?.time || time,
    allDay: false,
    durationMinutes: CALENDAR_TIMED_EVENT_TECHNICAL_DURATION_MINUTES,
    durationIsTechnicalOnly: true,
    exportMode: CALENDAR_EXPORT_MODE.TIMED,
  };
}

export function shouldCreateDuplicateEvent({ ownership, eventExists } = {}) {
  if (!ownership?.eventId) return false;
  if (eventExists === false) return false;
  return true;
}

export function calendarDateDiffers(ownership, plannedDate) {
  if (!ownership?.eventId || !isCivilDateKey(ownership.plannedDate) || !isCivilDateKey(plannedDate)) {
    return false;
  }
  return ownership.plannedDate !== plannedDate;
}

export function calendarTimeDiffers(ownership, { plannedDate, plannedTime } = {}) {
  if (!ownership?.eventId) return false;
  const exported = resolvePlannedTime({
    plannedDate: ownership.plannedDate,
    plannedTime: ownership.plannedTime,
  });
  const current = resolvePlannedTime({ plannedDate, plannedTime });
  const exportedMode = ownership.exportMode || exportModeForPlan({
    plannedDate: ownership.plannedDate,
    plannedTime: ownership.plannedTime,
  });
  const currentMode = exportModeForPlan({ plannedDate, plannedTime });
  return exported !== current || exportedMode !== currentMode;
}

export function calendarPlanDiffers(ownership, { plannedDate, plannedTime } = {}) {
  if (!ownership?.eventId) return false;
  return calendarDateDiffers(ownership, plannedDate) || calendarTimeDiffers(ownership, { plannedDate, plannedTime });
}

/**
 * Destination picker: writable default/personal. Never scans events.
 * Prefer isPrimary, then local account, then owner-access. No title search.
 */
export function pickWritableDestinationCalendar(calendars = []) {
  const writable = (calendars || []).filter((row) => row && row.allowsModifications && row.id);
  if (!writable.length) return null;
  const access = (row) => String(row.accessLevel || '').toLowerCase();
  const looksShared = (row) => {
    const level = access(row);
    return level === 'contributor' || level === 'editor' || level === 'read' || level === 'freebusy';
  };
  const owned = writable.filter((row) => !looksShared(row));
  const pool = owned.length ? owned : writable;
  return (
    pool.find((row) => row.isPrimary) ||
    pool.find((row) => row.source?.isLocalAccount) ||
    pool[0] ||
    null
  );
}

export function osCalendarScanQueries() {
  return [];
}

export function emptyOwnershipStore(userId) {
  return {
    version: PREGNANCY_CARE_CALENDAR_STORE_VERSION,
    userId: userId || null,
    items: {},
  };
}

export function parseOwnershipStore(raw, userId) {
  if (!userId) return emptyOwnershipStore(null);
  let parsed = raw;
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return emptyOwnershipStore(userId);
    }
  }
  if (!parsed || typeof parsed !== 'object') return emptyOwnershipStore(userId);
  if (parsed.userId && parsed.userId !== userId) return emptyOwnershipStore(userId);
  const items = parsed.items && typeof parsed.items === 'object' ? parsed.items : {};
  return {
    version: PREGNANCY_CARE_CALENDAR_STORE_VERSION,
    userId,
    items,
  };
}

export function readOwnedEvent(store, { userId, episodeId, careItemId } = {}) {
  if (!userId || !episodeId || !careItemId) return null;
  const parsed = parseOwnershipStore(store, userId);
  const row = parsed.items?.[episodeId]?.[careItemId];
  if (!row?.eventId) return null;
  return {
    eventId: String(row.eventId),
    calendarId: row.calendarId ? String(row.calendarId) : null,
    plannedDate: isCivilDateKey(row.plannedDate) ? row.plannedDate : null,
    plannedTime: resolvePlannedTime({ plannedDate: row.plannedDate, plannedTime: row.plannedTime }),
    exportMode: row.exportMode === CALENDAR_EXPORT_MODE.TIMED ? CALENDAR_EXPORT_MODE.TIMED : CALENDAR_EXPORT_MODE.ALL_DAY,
    titleMode: row.titleMode === CALENDAR_TITLE_MODE.DETAILED ? CALENDAR_TITLE_MODE.DETAILED : CALENDAR_TITLE_MODE.GENERIC,
    exportedAt: typeof row.exportedAt === 'string' ? row.exportedAt : null,
  };
}

export function upsertOwnedEvent(store, { userId, episodeId, careItemId, record } = {}) {
  const parsed = parseOwnershipStore(store, userId);
  if (!userId || !episodeId || !careItemId || !record?.eventId) return parsed;
  const episode = { ...(parsed.items[episodeId] || {}) };
  episode[careItemId] = {
    eventId: String(record.eventId),
    calendarId: record.calendarId ? String(record.calendarId) : null,
    plannedDate: isCivilDateKey(record.plannedDate) ? record.plannedDate : null,
    plannedTime: resolvePlannedTime({ plannedDate: record.plannedDate, plannedTime: record.plannedTime }),
    exportMode:
      record.exportMode === CALENDAR_EXPORT_MODE.TIMED ||
      resolvePlannedTime({ plannedDate: record.plannedDate, plannedTime: record.plannedTime })
        ? CALENDAR_EXPORT_MODE.TIMED
        : CALENDAR_EXPORT_MODE.ALL_DAY,
    titleMode: record.titleMode === CALENDAR_TITLE_MODE.DETAILED ? CALENDAR_TITLE_MODE.DETAILED : CALENDAR_TITLE_MODE.GENERIC,
    exportedAt: record.exportedAt || new Date().toISOString(),
  };
  return {
    ...parsed,
    userId,
    items: { ...parsed.items, [episodeId]: episode },
  };
}

export function clearOwnedEvent(store, { userId, episodeId, careItemId } = {}) {
  const parsed = parseOwnershipStore(store, userId);
  if (!episodeId || !careItemId) return parsed;
  const episode = { ...(parsed.items[episodeId] || {}) };
  delete episode[careItemId];
  const items = { ...parsed.items };
  if (Object.keys(episode).length) items[episodeId] = episode;
  else delete items[episodeId];
  return { ...parsed, items };
}

export function clearEpisodeOwnership(store, { userId, episodeId } = {}) {
  const parsed = parseOwnershipStore(store, userId);
  if (!episodeId) return parsed;
  const items = { ...parsed.items };
  delete items[episodeId];
  return { ...parsed, items };
}

export function ownershipLeaksAcrossUsers(store, fromUserId, toUserId) {
  const a = readOwnedEvent(store, { userId: fromUserId, episodeId: 'ep-a', careItemId: 'anatomy_ultrasound' });
  const b = readOwnedEvent(store, { userId: toUserId, episodeId: 'ep-a', careItemId: 'anatomy_ultrasound' });
  return Boolean(a) && Boolean(b);
}

export function resolveCalendarExportUi({
  plannedDate,
  plannedTime,
  today,
  nowMinutes,
  ownership,
  eventExists,
  permission,
  episodeId,
} = {}) {
  const hasOwnership = Boolean(ownership?.eventId);
  if (!episodeId && !hasOwnership) return CALENDAR_EXPORT_UI.HIDDEN;

  if (hasOwnership && permission === 'denied') {
    return CALENDAR_EXPORT_UI.PERMISSION_REVOKED;
  }

  if (hasOwnership && eventExists === false) {
    return CALENDAR_EXPORT_UI.EVENT_UNAVAILABLE;
  }

  if (
    hasOwnership &&
    eventExists !== false &&
    calendarPlanDiffers(ownership, { plannedDate, plannedTime })
  ) {
    return CALENDAR_EXPORT_UI.DATE_DIFFERS;
  }

  if (hasOwnership && eventExists !== false) {
    return CALENDAR_EXPORT_UI.EXPORTED;
  }

  if (!isCivilDateKey(plannedDate)) return CALENDAR_EXPORT_UI.HIDDEN;
  if (isPastCivilDate(plannedDate, today)) return CALENDAR_EXPORT_UI.PAST_NO_EXPORT;
  if (isTimedPlanInThePast({ plannedDate, plannedTime, today, nowMinutes })) {
    return CALENDAR_EXPORT_UI.PAST_NO_EXPORT;
  }
  if (permission === 'denied') return CALENDAR_EXPORT_UI.PERMISSION_DENIED;
  return CALENDAR_EXPORT_UI.NOT_EXPORTED;
}

export function personalExportIncludesDeviceEventId() {
  return false;
}

export function completionFromCalendarEvent() {
  return false;
}

export function missedCareFromCalendarEvent() {
  return false;
}
