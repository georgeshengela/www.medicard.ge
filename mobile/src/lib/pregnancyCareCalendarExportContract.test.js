import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  CALENDAR_EVENT_NOTES,
  CALENDAR_EXPORT_UI,
  CALENDAR_GENERIC_TITLE,
  CALENDAR_TITLE_MODE,
  addCivilDays,
  allDayCivilRange,
  buildCalendarEventPayload,
  calendarDateDiffers,
  calendarEventNotes,
  calendarEventTitle,
  calendarExportMutatesReminder,
  calendarExportReminderPatch,
  calendarOwnershipIdentity,
  canOfferNewCalendarExport,
  catalogWindowAloneNeverCreatesEvent,
  clearOwnedEvent,
  completionFromCalendarEvent,
  emptyOwnershipStore,
  eventPayloadHasInventedClock,
  genericTitleIsPrivacySafe,
  medicardAddsOsCalendarAlarm,
  missedCareFromCalendarEvent,
  notesFirewallHolds,
  osCalendarScanQueries,
  parseOwnershipStore,
  personalExportIncludesDeviceEventId,
  pickWritableDestinationCalendar,
  readOwnedEvent,
  resolveCalendarExportUi,
  shouldAutoDeleteCalendarEvent,
  shouldAutoExportCalendar,
  shouldCreateDuplicateEvent,
  shouldSilentUpdateCalendarOnDateChange,
  upsertOwnedEvent,
} from './pregnancyCareCalendarExportContract.js';

const TODAY = '2026-09-10';
const USER = 'user-a';
const EPISODE = 'ep-a';
const ITEM = 'anatomy_ultrasound';

function owned(extra = {}) {
  return {
    eventId: extra.eventId || 'evt-1',
    calendarId: extra.calendarId || 'cal-1',
    plannedDate: extra.plannedDate || '2026-09-18',
    titleMode: extra.titleMode || CALENDAR_TITLE_MODE.GENERIC,
    exportedAt: extra.exportedAt || '2026-09-10T10:00:00.000Z',
  };
}

function storeWith(userId, episodeId, careItemId, record) {
  return upsertOwnedEvent(emptyOwnershipStore(userId), {
    userId,
    episodeId,
    careItemId,
    record,
  });
}

describe('pregnancy care calendar export contract', () => {
  it('A: no plannedDate → no new export', () => {
    assert.equal(canOfferNewCalendarExport({ plannedDate: null, today: TODAY }), false);
    assert.equal(
      resolveCalendarExportUi({ plannedDate: null, today: TODAY, episodeId: EPISODE }),
      CALENDAR_EXPORT_UI.HIDDEN,
    );
  });

  it('B: future plannedDate is eligible', () => {
    assert.equal(canOfferNewCalendarExport({ plannedDate: '2026-09-18', today: TODAY }), true);
    const payload = buildCalendarEventPayload({ plannedDate: '2026-09-18' });
    assert.equal(payload.allDay, true);
    assert.deepEqual(payload.alarms, []);
  });

  it('C: IN_WINDOW without plannedDate never creates an event', () => {
    assert.equal(
      catalogWindowAloneNeverCreatesEvent({ relation: 'IN_WINDOW', plannedDate: null }),
      true,
    );
    assert.equal(
      canOfferNewCalendarExport({ plannedDate: null, today: TODAY, catalogRelation: 'IN_WINDOW' }),
      false,
    );
  });

  it('D: duplicate tap does not create another event while ownership is valid', () => {
    assert.equal(
      shouldCreateDuplicateEvent({
        ownership: owned(),
        eventExists: true,
        plannedDate: '2026-09-18',
      }),
      true,
    );
  });

  it('E: permission denied is a failed export, not success', () => {
    assert.equal(
      resolveCalendarExportUi({
        plannedDate: '2026-09-18',
        today: TODAY,
        episodeId: EPISODE,
        permission: 'denied',
      }),
      CALENDAR_EXPORT_UI.PERMISSION_DENIED,
    );
  });

  it('F: default title is generic and pregnancy-safe', () => {
    const title = calendarEventTitle({ titleMode: CALENDAR_TITLE_MODE.GENERIC, itemTitle: 'ანატომიის ულტრაბგერა' });
    assert.equal(title, CALENDAR_GENERIC_TITLE);
    assert.equal(genericTitleIsPrivacySafe(title), true);
  });

  it('G: detailed title is opt-in only', () => {
    const title = calendarEventTitle({
      titleMode: CALENDAR_TITLE_MODE.DETAILED,
      itemTitle: 'ანატომიის ულტრაბგერა',
    });
    assert.equal(title, 'Medicard — ანატომიის ულტრაბგერა');
    assert.notEqual(calendarEventTitle({ itemTitle: 'ანატომიის ულტრაბგერა' }), title);
  });

  it('H: private planner note never enters notes', () => {
    const notes = calendarEventNotes({
      plannerNote: 'SECRET_PLANNER_NOTE',
      sourceUrls: ['https://www.nice.org.uk/guidance/ng201'],
      pregnancyWeek: 20,
    });
    assert.equal(notes, CALENDAR_EVENT_NOTES);
    assert.equal(
      notesFirewallHolds(notes, {
        plannerNote: 'SECRET_PLANNER_NOTE',
        sourceUrl: 'https://www.nice.org.uk/guidance/ng201',
      }),
      true,
    );
  });

  it('I: Medicard does not add an OS calendar alarm', () => {
    assert.equal(medicardAddsOsCalendarAlarm(), false);
    const payload = buildCalendarEventPayload({ plannedDate: '2026-09-22', plannedTime: '14:30' });
    assert.deepEqual(payload.alarms, []);
    assert.equal(payload.location, undefined);
    assert.equal(payload.structuredLocation, undefined);
    assert.deepEqual(allDayCivilRange('2026-09-18').alarms, []);
  });

  it('J: calendar export does not mutate Phase 33 reminder fields', () => {
    assert.equal(calendarExportMutatesReminder(), false);
    assert.deepEqual(calendarExportReminderPatch(), {});
  });

  it('K: date change is detected and is not a silent mutation', () => {
    assert.equal(shouldSilentUpdateCalendarOnDateChange(), false);
    assert.equal(calendarDateDiffers(owned({ plannedDate: '2026-09-18' }), '2026-09-22'), true);
    assert.equal(
      resolveCalendarExportUi({
        plannedDate: '2026-09-22',
        today: TODAY,
        episodeId: EPISODE,
        ownership: owned({ plannedDate: '2026-09-18' }),
        eventExists: true,
      }),
      CALENDAR_EXPORT_UI.DATE_DIFFERS,
    );
  });

  it('L: remove only targets the owned event id', () => {
    const row = readOwnedEvent(storeWith(USER, EPISODE, ITEM, owned({ eventId: 'evt-owned' })), {
      userId: USER,
      episodeId: EPISODE,
      careItemId: ITEM,
    });
    assert.equal(row.eventId, 'evt-owned');
    assert.notEqual(row.eventId, 'someone-elses-event');
  });

  it('M: missing OS event clears local ownership and does not auto-recreate', () => {
    assert.equal(
      resolveCalendarExportUi({
        plannedDate: '2026-09-18',
        today: TODAY,
        episodeId: EPISODE,
        ownership: owned(),
        eventExists: false,
      }),
      CALENDAR_EXPORT_UI.EVENT_UNAVAILABLE,
    );
    assert.equal(
      shouldCreateDuplicateEvent({ ownership: owned(), eventExists: false, plannedDate: '2026-09-18' }),
      false,
    );
  });

  it('N/O/P: completed, dismissed, episode end never auto-delete', () => {
    assert.equal(shouldAutoDeleteCalendarEvent({ completed: true }), false);
    assert.equal(shouldAutoDeleteCalendarEvent({ dismissed: true }), false);
    assert.equal(shouldAutoDeleteCalendarEvent({ notApplicable: true }), false);
    assert.equal(shouldAutoDeleteCalendarEvent({ cleared: true }), false);
    assert.equal(shouldAutoDeleteCalendarEvent({ episodeEnded: true }), false);
  });

  it('Q: new pregnancy episode does not inherit old ownership', () => {
    const store = storeWith(USER, EPISODE, ITEM, owned());
    assert.equal(
      readOwnedEvent(store, { userId: USER, episodeId: 'ep-b', careItemId: ITEM }),
      null,
    );
  });

  it('R/S: cross-user read is empty even if the JSON blob is reused', () => {
    const store = storeWith(USER, EPISODE, ITEM, owned());
    assert.equal(readOwnedEvent(store, { userId: 'user-b', episodeId: EPISODE, careItemId: ITEM }), null);
    assert.equal(parseOwnershipStore(store, 'user-b').items[EPISODE], undefined);
  });

  it('T: reviewRequired still allows export of a manual plannedDate', () => {
    assert.equal(
      canOfferNewCalendarExport({
        plannedDate: '2026-09-18',
        today: TODAY,
        reviewRequired: true,
      }),
      true,
    );
  });

  it('U: outside-window date is exported unchanged', () => {
    const payload = buildCalendarEventPayload({ plannedDate: '2026-12-01' });
    assert.equal(payload.startDate, '2026-12-01');
    assert.equal(addCivilDays('2026-12-01', 1), '2026-12-02');
  });

  it('V: past date suppresses new export', () => {
    assert.equal(canOfferNewCalendarExport({ plannedDate: '2026-09-01', today: TODAY }), false);
    assert.equal(
      resolveCalendarExportUi({ plannedDate: '2026-09-01', today: TODAY, episodeId: EPISODE }),
      CALENDAR_EXPORT_UI.PAST_NO_EXPORT,
    );
  });

  it('W: today is an allowed all-day export', () => {
    assert.equal(canOfferNewCalendarExport({ plannedDate: TODAY, today: TODAY }), true);
    const payload = buildCalendarEventPayload({ plannedDate: TODAY });
    assert.equal(payload.allDay, true);
    assert.equal(eventPayloadHasInventedClock(payload), false);
  });

  it('X/Y/Z: no device event id in personal export; no completion/missed inference', () => {
    assert.equal(personalExportIncludesDeviceEventId(), false);
    assert.equal(completionFromCalendarEvent(), false);
    assert.equal(missedCareFromCalendarEvent(), false);
  });

  it('never auto-exports on save, reminder, window, or pregnancy start', () => {
    assert.equal(shouldAutoExportCalendar({ plannedDateSaved: true }), false);
    assert.equal(shouldAutoExportCalendar({ reminderEnabled: true }), false);
    assert.equal(shouldAutoExportCalendar({ inWindow: true }), false);
    assert.equal(shouldAutoExportCalendar({ pregnancyStarted: true }), false);
  });

  it('does not scan OS calendars for medical terms', () => {
    assert.deepEqual(osCalendarScanQueries(), []);
  });

  it('identity is user + episode + care item', () => {
    assert.equal(
      calendarOwnershipIdentity({ userId: USER, episodeId: EPISODE, careItemId: ITEM }),
      'user-a:ep-a:anatomy_ultrasound',
    );
  });

  it('clears only the owned item from local store', () => {
    let store = storeWith(USER, EPISODE, ITEM, owned());
    store = upsertOwnedEvent(store, {
      userId: USER,
      episodeId: EPISODE,
      careItemId: 'gbs_screening',
      record: owned({ eventId: 'evt-2' }),
    });
    store = clearOwnedEvent(store, { userId: USER, episodeId: EPISODE, careItemId: ITEM });
    assert.equal(readOwnedEvent(store, { userId: USER, episodeId: EPISODE, careItemId: ITEM }), null);
    assert.equal(
      readOwnedEvent(store, { userId: USER, episodeId: EPISODE, careItemId: 'gbs_screening' }).eventId,
      'evt-2',
    );
  });

  it('prefers a writable primary/personal calendar and skips obvious shared access', () => {
    const dest = pickWritableDestinationCalendar([
      { id: 'work', allowsModifications: true, accessLevel: 'contributor', title: 'Work' },
      { id: 'mine', allowsModifications: true, isPrimary: true, accessLevel: 'owner', title: 'Phone' },
    ]);
    assert.equal(dest.id, 'mine');
  });

  it('logout with no userId cannot read ownership', () => {
    const store = storeWith(USER, EPISODE, ITEM, owned());
    assert.equal(readOwnedEvent(store, { userId: null, episodeId: EPISODE, careItemId: ITEM }), null);
  });
});
