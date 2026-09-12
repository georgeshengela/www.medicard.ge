import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  CALENDAR_EXPORT_MODE,
  CALENDAR_TIMED_EVENT_TECHNICAL_DURATION_MINUTES,
  calendarTechnicalDurationIsMedical,
  defaultPlannedTime,
  exactTimeReminderAdded,
  inventedAppointmentTimes,
  isClockTime,
  isTimedPlanInThePast,
  reminderSchedulingUsesPlannedTime,
  rejectMalformedPlannedTime,
  resolvePlannedDateAndTime,
  resolvePlannedTime,
  timeRequiresPlannedDate,
} from './pregnancyCareAppointmentTimeContract.js';
import {
  CALENDAR_EXPORT_UI,
  buildCalendarEventPayload,
  calendarPlanDiffers,
  canOfferNewCalendarExport,
  eventPayloadHasInventedClock,
  medicardAddsOsCalendarAlarm,
  resolveCalendarExportUi,
  shouldCreateDuplicateEvent,
  shouldSilentUpdateCalendarOnTimeChange,
} from './pregnancyCareCalendarExportContract.js';
import { reminderFireCivilDate } from './pregnancyCareReminderContract.js';

const TODAY = '2026-09-11';
const EPISODE = 'ep-a';

describe('pregnancy care appointment time contract', () => {
  it('A: date-only plan has null time and all-day calendar payload', () => {
    assert.equal(resolvePlannedTime({ plannedDate: '2026-09-22', plannedTime: null }), null);
    const payload = buildCalendarEventPayload({ plannedDate: '2026-09-22' });
    assert.equal(payload.allDay, true);
    assert.equal(payload.exportMode, CALENDAR_EXPORT_MODE.ALL_DAY);
    assert.equal(eventPayloadHasInventedClock(payload), false);
  });

  it('B: date + 14:30 builds a timed payload', () => {
    const payload = buildCalendarEventPayload({ plannedDate: '2026-09-22', plannedTime: '14:30' });
    assert.equal(payload.allDay, false);
    assert.equal(payload.startTime, '14:30');
    assert.equal(payload.durationMinutes, CALENDAR_TIMED_EVENT_TECHNICAL_DURATION_MINUTES);
    assert.equal(payload.durationIsTechnicalOnly, true);
    assert.equal(calendarTechnicalDurationIsMedical(), false);
    assert.deepEqual(payload.alarms, []);
  });

  it('C: no date rejects/clears time', () => {
    assert.equal(timeRequiresPlannedDate(), true);
    assert.deepEqual(
      resolvePlannedDateAndTime({ plannedDate: null, plannedTime: '14:30', existing: { plannedDate: '2026-09-22', plannedTime: '14:30' } }),
      { plannedDate: null, plannedTime: null },
    );
  });

  it('D: malformed time is rejected', () => {
    for (const value of ['25:00', '9:3', 'abc', '14:30:00']) {
      assert.equal(isClockTime(value), false);
      assert.throws(() => rejectMalformedPlannedTime(value), (err) => err.status === 400);
    }
  });

  it('E: midnight 00:00 is valid', () => {
    assert.equal(isClockTime('00:00'), true);
    assert.equal(resolvePlannedTime({ plannedDate: '2026-09-22', plannedTime: '00:00' }), '00:00');
  });

  it('F: 23:59 is valid', () => {
    assert.equal(isClockTime('23:59'), true);
  });

  it('G: adding time after all-day export is a mismatch, not a silent mutation', () => {
    assert.equal(shouldSilentUpdateCalendarOnTimeChange(), false);
    assert.equal(
      calendarPlanDiffers(
        { eventId: 'evt-1', plannedDate: '2026-09-22', plannedTime: null, exportMode: CALENDAR_EXPORT_MODE.ALL_DAY },
        { plannedDate: '2026-09-22', plannedTime: '14:30' },
      ),
      true,
    );
    assert.equal(
      resolveCalendarExportUi({
        plannedDate: '2026-09-22',
        plannedTime: '14:30',
        today: TODAY,
        episodeId: EPISODE,
        ownership: { eventId: 'evt-1', plannedDate: '2026-09-22', plannedTime: null },
        eventExists: true,
      }),
      CALENDAR_EXPORT_UI.DATE_DIFFERS,
    );
  });

  it('H/L: owned event still existing never creates a duplicate', () => {
    assert.equal(
      shouldCreateDuplicateEvent({
        ownership: { eventId: 'evt-1', plannedDate: '2026-09-22', plannedTime: null },
        eventExists: true,
      }),
      true,
    );
  });

  it('I: removing time is a mismatch until explicit update', () => {
    assert.equal(
      calendarPlanDiffers(
        { eventId: 'evt-1', plannedDate: '2026-09-22', plannedTime: '14:30', exportMode: CALENDAR_EXPORT_MODE.TIMED },
        { plannedDate: '2026-09-22', plannedTime: null },
      ),
      true,
    );
  });

  it('K: 14:30 → 16:00 requires explicit calendar update', () => {
    assert.equal(
      calendarPlanDiffers(
        { eventId: 'evt-1', plannedDate: '2026-09-22', plannedTime: '14:30' },
        { plannedDate: '2026-09-22', plannedTime: '16:00' },
      ),
      true,
    );
  });

  it('M: Phase 33 reminder fire date ignores plannedTime', () => {
    assert.equal(reminderSchedulingUsesPlannedTime(), false);
    assert.equal(exactTimeReminderAdded(), false);
    assert.equal(reminderFireCivilDate('2026-09-22', 1), '2026-09-21');
  });

  it('N: timed payload still has no Medicard alarm', () => {
    assert.equal(medicardAddsOsCalendarAlarm(), false);
    assert.deepEqual(buildCalendarEventPayload({ plannedDate: '2026-09-22', plannedTime: '14:30' }).alarms, []);
  });

  it('P: generic title is unchanged by time', () => {
    const allDay = buildCalendarEventPayload({ plannedDate: '2026-09-22' });
    const timed = buildCalendarEventPayload({ plannedDate: '2026-09-22', plannedTime: '14:30' });
    assert.equal(allDay.title, timed.title);
  });

  it('Q: today + future time allows new export', () => {
    assert.equal(
      canOfferNewCalendarExport({
        plannedDate: TODAY,
        plannedTime: '23:50',
        today: TODAY,
        nowMinutes: 10 * 60,
      }),
      true,
    );
  });

  it('R: today + past time suppresses new export', () => {
    assert.equal(
      isTimedPlanInThePast({
        plannedDate: TODAY,
        plannedTime: '14:30',
        today: TODAY,
        nowMinutes: 16 * 60,
      }),
      true,
    );
    assert.equal(
      canOfferNewCalendarExport({
        plannedDate: TODAY,
        plannedTime: '14:30',
        today: TODAY,
        nowMinutes: 16 * 60,
      }),
      false,
    );
    assert.equal(
      resolveCalendarExportUi({
        plannedDate: TODAY,
        plannedTime: '14:30',
        today: TODAY,
        nowMinutes: 16 * 60,
        episodeId: EPISODE,
      }),
      CALENDAR_EXPORT_UI.PAST_NO_EXPORT,
    );
  });

  it('S: past date still suppresses new export', () => {
    assert.equal(
      canOfferNewCalendarExport({ plannedDate: '2026-09-01', plannedTime: '14:30', today: TODAY }),
      false,
    );
  });

  it('T: outside-window user time is preserved unchanged', () => {
    const payload = buildCalendarEventPayload({ plannedDate: '2026-12-01', plannedTime: '08:15' });
    assert.equal(payload.startDate, '2026-12-01');
    assert.equal(payload.startTime, '08:15');
  });

  it('no invented default time', () => {
    assert.equal(defaultPlannedTime(), null);
    assert.equal(inventedAppointmentTimes().includes('09:00'), true);
    assert.notEqual(defaultPlannedTime(), '09:00');
  });

  it('atomic date+time: date change keeps time unless cleared', () => {
    assert.deepEqual(
      resolvePlannedDateAndTime({
        plannedDate: '2026-09-24',
        existing: { plannedDate: '2026-09-22', plannedTime: '14:30' },
      }),
      { plannedDate: '2026-09-24', plannedTime: '14:30' },
    );
  });
});
