/**
 * Phase 34 — device-local OS calendar create/update/delete for a user-planned care date.
 *
 * Stores event ownership in a user-scoped preference. Never writes calendarEventId
 * to the personal health API. Never scans device events. Never adds OS alarms.
 */
import { Platform } from 'react-native';
import { deletePreference, getPreference, setPreferenceStrict } from '@/lib/storage';
import { localAccountId, scopedPrefKey } from '@/lib/localAccount';
import {
  CALENDAR_TITLE_MODE,
  PREGNANCY_CARE_CALENDAR_PREF_BASE,
  allDayCivilRange,
  buildCalendarEventPayload,
  canOfferNewCalendarExport,
  calendarPlanDiffers,
  clearOwnedEvent,
  emptyOwnershipStore,
  parseOwnershipStore,
  pickWritableDestinationCalendar,
  readOwnedEvent,
  shouldCreateDuplicateEvent,
  upsertOwnedEvent,
} from '@/lib/pregnancyCareCalendarExportContract.js';
import { parseClockTime } from '@/lib/pregnancyCareAppointmentTimeContract.js';

export type CalendarPermissionState = 'granted' | 'denied' | 'undetermined';

export type CareCalendarOwnership = {
  eventId: string;
  calendarId: string | null;
  plannedDate: string | null;
  plannedTime: string | null;
  exportMode?: 'ALL_DAY' | 'TIMED';
  titleMode: 'generic' | 'detailed';
  exportedAt: string | null;
};

export type CareCalendarActionResult =
  | { ok: true; ownership: CareCalendarOwnership | null; opened?: boolean }
  | { ok: false; reason: string };

function loadExpoCalendar(): typeof import('expo-calendar/legacy') | null {
  if (Platform.OS === 'web') return null;
  try {
    // Next API is stubbed in Expo Go. Legacy createEventAsync is the supported path.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-calendar/legacy');
  } catch {
    return null;
  }
}

function civilToLocalDate(key: string, dayOffset = 0): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d + dayOffset, 0, 0, 0, 0);
}

function prefKeyFor(userId: string | null): string | null {
  if (userId) return `${PREGNANCY_CARE_CALENDAR_PREF_BASE}.${userId}`;
  return scopedPrefKey(PREGNANCY_CARE_CALENDAR_PREF_BASE);
}

async function loadStore(userId: string | null) {
  if (!userId) return emptyOwnershipStore(null);
  const key = prefKeyFor(userId);
  if (!key) return emptyOwnershipStore(userId);
  const raw = await getPreference(key);
  return parseOwnershipStore(raw, userId);
}

async function saveStore(userId: string, store: ReturnType<typeof emptyOwnershipStore>) {
  const key = prefKeyFor(userId);
  if (!key) return;
  await setPreferenceStrict(key, JSON.stringify(store));
}

export async function wipePregnancyCareCalendarOwnership(userId?: string | null): Promise<void> {
  const key = prefKeyFor(userId || localAccountId());
  if (!key) return;
  await deletePreference(key);
}

export async function getCareCalendarOwnership(opts: {
  userId: string;
  episodeId: string;
  careItemId: string;
}): Promise<CareCalendarOwnership | null> {
  const store = await loadStore(opts.userId);
  return readOwnedEvent(store, opts);
}

export async function getCalendarPermissionStatus(): Promise<CalendarPermissionState> {
  const Calendar = loadExpoCalendar();
  if (!Calendar?.getCalendarPermissionsAsync) return 'denied';
  try {
    const current = await Calendar.getCalendarPermissionsAsync();
    if (current?.granted || current?.status === 'granted') return 'granted';
    if (current?.status === 'undetermined') return 'undetermined';
    return 'denied';
  } catch {
    return 'denied';
  }
}

/** Request only in response to an explicit user tap. Do not loop-prompt. */
export async function requestCalendarPermissionOnce(): Promise<CalendarPermissionState> {
  const Calendar = loadExpoCalendar();
  if (!Calendar?.requestCalendarPermissionsAsync) return 'denied';
  const current = await getCalendarPermissionStatus();
  if (current === 'granted') return 'granted';
  try {
    const asked = await Calendar.requestCalendarPermissionsAsync();
    if (asked?.granted || asked?.status === 'granted') return 'granted';
    return 'denied';
  } catch {
    return 'denied';
  }
}

export async function resolveOwnedCalendarEvent(opts: {
  userId: string;
  episodeId: string;
  careItemId: string;
}): Promise<{ ownership: CareCalendarOwnership | null; eventExists: boolean | null; permission: CalendarPermissionState }> {
  const permission = await getCalendarPermissionStatus();
  const ownership = await getCareCalendarOwnership(opts);
  if (!ownership) return { ownership: null, eventExists: null, permission };
  if (permission !== 'granted') return { ownership, eventExists: null, permission };
  const existing = await fetchOwnedEvent(ownership.eventId);
  if (existing) return { ownership, eventExists: true, permission };
  const store = await loadStore(opts.userId);
  await saveStore(opts.userId, clearOwnedEvent(store, opts));
  return { ownership: null, eventExists: false, permission };
}

async function fetchOwnedEvent(eventId: string) {
  const Calendar = loadExpoCalendar();
  if (!Calendar?.getEventAsync || !eventId) return null;
  try {
    const event = await Calendar.getEventAsync(eventId);
    return event?.id ? event : null;
  } catch {
    return null;
  }
}

async function pickDestination() {
  const Calendar = loadExpoCalendar();
  if (!Calendar?.getCalendarsAsync) return null;
  const entity = Calendar.EntityTypes?.EVENT;
  const calendars = entity
    ? await Calendar.getCalendarsAsync(entity)
    : await Calendar.getCalendarsAsync();
  const existing = pickWritableDestinationCalendar(calendars);
  if (existing?.id) return existing;
  if (!Calendar.createCalendarAsync) return null;
  try {
    const source =
      Platform.OS === 'android'
        ? { isLocalAccount: true, name: 'Medicard', type: 'LOCAL' }
        : (calendars || []).find((row) => row?.source)?.source;
    const id = await Calendar.createCalendarAsync({
      title: 'Medicard',
      name: 'Medicard',
      color: '#14B8A6',
      entityType: entity,
      source: source || { isLocalAccount: true, name: 'Medicard', type: 'LOCAL' },
      ownerAccount: Platform.OS === 'android' ? 'personal' : undefined,
      accessLevel: Calendar.CalendarAccessLevel?.OWNER,
    });
    if (!id) return null;
    return { id, timeZone: null, allowsModifications: true };
  } catch {
    return null;
  }
}

function nativeEventDetails(
  plannedDate: string,
  plannedTime: string | null | undefined,
  titleMode: string,
  itemTitle: string,
  calendarTimeZone?: string | null,
) {
  const payload = buildCalendarEventPayload({ plannedDate, plannedTime, titleMode, itemTitle });
  if (!payload) return null;
  if (payload.allDay) {
    const range = allDayCivilRange(plannedDate);
    if (!range) return null;
    return {
      title: payload.title,
      notes: payload.notes,
      startDate: civilToLocalDate(range.startDate, 0),
      endDate: civilToLocalDate(range.startDate, 1),
      allDay: true,
      alarms: [],
      timeZone: calendarTimeZone || 'GMT',
      endTimeZone: calendarTimeZone || 'GMT',
    };
  }
  const clock = parseClockTime(payload.startTime);
  if (!clock) return null;
  const [y, m, d] = plannedDate.split('-').map(Number);
  const start = new Date(y, m - 1, d, clock.hour, clock.minute, 0, 0);
  const end = new Date(start.getTime() + (payload.durationMinutes || 30) * 60 * 1000);
  const zone = calendarTimeZone || Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
  return {
    title: payload.title,
    notes: payload.notes,
    startDate: start,
    endDate: end,
    allDay: false,
    alarms: [],
    timeZone: zone,
    endTimeZone: zone,
  };
}

export async function exportCarePlanToCalendar(opts: {
  userId: string;
  episodeId: string;
  careItemId: string;
  plannedDate: string;
  plannedTime?: string | null;
  itemTitle: string;
  titleMode?: 'generic' | 'detailed';
  today: string;
  nowMinutes?: number;
}): Promise<CareCalendarActionResult> {
  if (!opts.userId || !opts.episodeId || !opts.careItemId) {
    return { ok: false, reason: 'not_eligible' };
  }
  if (
    !canOfferNewCalendarExport({
      plannedDate: opts.plannedDate,
      plannedTime: opts.plannedTime,
      today: opts.today,
      nowMinutes: opts.nowMinutes,
    })
  ) {
    return { ok: false, reason: 'not_eligible' };
  }

  const permission = await requestCalendarPermissionOnce();
  if (permission !== 'granted') return { ok: false, reason: 'permission_denied' };

  const existing = await getCareCalendarOwnership(opts);
  if (existing?.eventId) {
    const stillThere = await fetchOwnedEvent(existing.eventId);
    if (shouldCreateDuplicateEvent({ ownership: existing, eventExists: Boolean(stillThere) })) {
      return { ok: true, ownership: existing };
    }
    if (!stillThere) {
      const store = await loadStore(opts.userId);
      await saveStore(opts.userId, clearOwnedEvent(store, opts));
    }
  }

  const Calendar = loadExpoCalendar();
  if (!Calendar?.createEventAsync) return { ok: false, reason: 'unavailable' };

  const dest = await pickDestination();
  if (!dest?.id) return { ok: false, reason: 'no_calendar' };

  const titleMode = opts.titleMode === CALENDAR_TITLE_MODE.DETAILED ? CALENDAR_TITLE_MODE.DETAILED : CALENDAR_TITLE_MODE.GENERIC;
  const details = nativeEventDetails(opts.plannedDate, opts.plannedTime, titleMode, opts.itemTitle, dest.timeZone);
  if (!details) return { ok: false, reason: 'not_eligible' };

  let eventId: string;
  try {
    eventId = await Calendar.createEventAsync(dest.id, details);
  } catch (err) {
    if (__DEV__) {
      console.warn('[care-calendar] create failed', err instanceof Error ? err.message : err);
    }
    return { ok: false, reason: 'create_failed' };
  }
  if (!eventId) return { ok: false, reason: 'create_failed' };

  const payload = buildCalendarEventPayload({
    plannedDate: opts.plannedDate,
    plannedTime: opts.plannedTime,
    titleMode,
    itemTitle: opts.itemTitle,
  });
  const record: CareCalendarOwnership = {
    eventId,
    calendarId: dest.id,
    plannedDate: opts.plannedDate,
    plannedTime: payload?.allDay ? null : payload?.startTime || null,
    exportMode: payload?.allDay ? 'ALL_DAY' : 'TIMED',
    titleMode,
    exportedAt: new Date().toISOString(),
  };
  const store = await loadStore(opts.userId);
  await saveStore(opts.userId, upsertOwnedEvent(store, { ...opts, record }));
  return { ok: true, ownership: record };
}

export async function updateCarePlanCalendarEvent(opts: {
  userId: string;
  episodeId: string;
  careItemId: string;
  plannedDate: string;
  plannedTime?: string | null;
  itemTitle: string;
  titleMode?: 'generic' | 'detailed';
  today: string;
}): Promise<CareCalendarActionResult> {
  const permission = await getCalendarPermissionStatus();
  if (permission !== 'granted') return { ok: false, reason: permission === 'denied' ? 'permission_revoked' : 'permission_denied' };

  const ownership = await getCareCalendarOwnership(opts);
  if (!ownership?.eventId) return { ok: false, reason: 'missing' };

  const existing = await fetchOwnedEvent(ownership.eventId);
  if (!existing) {
    const store = await loadStore(opts.userId);
    await saveStore(opts.userId, clearOwnedEvent(store, opts));
    return { ok: false, reason: 'missing' };
  }

  if (!opts.plannedDate) return { ok: false, reason: 'not_eligible' };

  const Calendar = loadExpoCalendar();
  if (!Calendar?.updateEventAsync) return { ok: false, reason: 'unavailable' };

  const titleMode =
    opts.titleMode === CALENDAR_TITLE_MODE.DETAILED
      ? CALENDAR_TITLE_MODE.DETAILED
      : opts.titleMode === CALENDAR_TITLE_MODE.GENERIC
        ? CALENDAR_TITLE_MODE.GENERIC
        : ownership.titleMode;
  const details = nativeEventDetails(opts.plannedDate, opts.plannedTime, titleMode, opts.itemTitle, existing.timeZone);
  if (!details) return { ok: false, reason: 'not_eligible' };

  try {
    await Calendar.updateEventAsync(ownership.eventId, details);
  } catch {
    return { ok: false, reason: 'update_failed' };
  }

  const payload = buildCalendarEventPayload({
    plannedDate: opts.plannedDate,
    plannedTime: opts.plannedTime,
    titleMode,
    itemTitle: opts.itemTitle,
  });
  const record: CareCalendarOwnership = {
    ...ownership,
    plannedDate: opts.plannedDate,
    plannedTime: payload?.allDay ? null : payload?.startTime || null,
    exportMode: payload?.allDay ? 'ALL_DAY' : 'TIMED',
    titleMode,
    exportedAt: new Date().toISOString(),
  };
  const store = await loadStore(opts.userId);
  await saveStore(opts.userId, upsertOwnedEvent(store, { ...opts, record }));
  return { ok: true, ownership: record };
}

export async function removeCarePlanCalendarEvent(opts: {
  userId: string;
  episodeId: string;
  careItemId: string;
}): Promise<CareCalendarActionResult> {
  const permission = await getCalendarPermissionStatus();
  const ownership = await getCareCalendarOwnership(opts);
  if (!ownership?.eventId) return { ok: true, ownership: null };
  if (permission !== 'granted') return { ok: false, reason: 'permission_revoked' };

  const Calendar = loadExpoCalendar();
  const existing = await fetchOwnedEvent(ownership.eventId);
  if (existing && Calendar?.deleteEventAsync) {
    try {
      await Calendar.deleteEventAsync(ownership.eventId);
    } catch {
      return { ok: false, reason: 'delete_failed' };
    }
  }

  const store = await loadStore(opts.userId);
  await saveStore(opts.userId, clearOwnedEvent(store, opts));
  return { ok: true, ownership: null };
}

export async function openCarePlanCalendarEvent(opts: {
  userId: string;
  episodeId: string;
  careItemId: string;
}): Promise<CareCalendarActionResult> {
  const permission = await getCalendarPermissionStatus();
  if (permission !== 'granted') return { ok: false, reason: 'permission_revoked' };
  const ownership = await getCareCalendarOwnership(opts);
  if (!ownership?.eventId) return { ok: false, reason: 'missing' };
  const existing = await fetchOwnedEvent(ownership.eventId);
  if (!existing) {
    const store = await loadStore(opts.userId);
    await saveStore(opts.userId, clearOwnedEvent(store, opts));
    return { ok: false, reason: 'missing' };
  }
  const Calendar = loadExpoCalendar();
  try {
    if (Calendar?.openEventInCalendarAsync) {
      await Calendar.openEventInCalendarAsync({ id: ownership.eventId });
      return { ok: true, ownership, opened: true };
    }
    if (Calendar?.openEventInCalendar) {
      Calendar.openEventInCalendar(ownership.eventId);
      return { ok: true, ownership, opened: true };
    }
  } catch {
    return { ok: false, reason: 'open_failed' };
  }
  return { ok: false, reason: 'open_failed' };
}

export function careCalendarDateDiffers(
  ownership: CareCalendarOwnership | null,
  plannedDate: string | null,
  plannedTime?: string | null,
) {
  return calendarPlanDiffers(ownership, { plannedDate, plannedTime });
}

export { canOfferNewCalendarExport, CALENDAR_TITLE_MODE };
