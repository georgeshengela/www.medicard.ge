import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CYCLE_REMINDER_HOUR, CYCLE_REMINDER_MINUTE, maskedCopyIsSafe } from './cycleNotificationContract.js';
import {
  EXACT_REMINDER_DEFAULT_MINUTES,
  EXACT_REMINDER_OFFSET_MINUTES,
  PREGNANCY_CARE_REMINDER_SUPPRESSION,
  REMINDER_MODE,
  addingPlannedTimeAutoUpgradesReminder,
  buildPregnancyCareReminderCandidates,
  canonicalizeReminderMode,
  catalogWindowNeverReminds,
  dateBasedQuietHoursBump,
  exactQuietHoursFollowVisitAlarms,
  exactTimeRequiresExplicitSelection,
  isExactReminderOffsetMinutes,
  normalizeExactReminderOffsetMinutes,
  pregnancyCareMaskedCopy,
  pregnancyCareReminderCandidateId,
  pregnancyCareReminderCopy,
  revalidatePregnancyCareReminder,
  resolvePrenatalCareReminderSchedule,
  subtractMinutesFromWallClock,
  wallClockInstant,
} from './pregnancyCareReminderContract.js';
import {
  exactTimeReminderAdded,
  reminderSchedulingUsesPlannedTime as phase35ReminderUsesPlannedTime,
} from './pregnancyCareAppointmentTimeContract.js';
import { medicardAddsOsCalendarAlarm } from './pregnancyCareCalendarExportContract.js';

const TODAY = '2026-09-10';
const USER = 'user-a';
const EPISODE = 'ep-a';
const TZ = 'Europe/Brussels';

function plannedItem(extra = {}) {
  return {
    id: extra.id || 'anatomy_ultrasound',
    timing: { relation: extra.relation || 'IN_WINDOW', startWeek: 18, endWeek: 22 },
    userState: {
      status: extra.status || 'PLANNED',
      plannedDate: extra.plannedDate === undefined ? '2026-09-22' : extra.plannedDate,
      plannedTime: extra.plannedTime === undefined ? null : extra.plannedTime,
      reminderEnabled: extra.reminderEnabled === undefined ? true : extra.reminderEnabled,
      reminderOffset: extra.offset === undefined ? 1 : extra.offset,
      reminderMode: extra.reminderMode,
      exactReminderOffsetMinutes: extra.exactMinutes === undefined ? null : extra.exactMinutes,
    },
  };
}

function live(extra = {}) {
  return {
    userId: extra.userId || USER,
    mode: extra.mode || 'PREGNANCY',
    pregnancyActive: extra.pregnancyActive !== false,
    episodeStatus: extra.episodeStatus || 'ACTIVE',
    episodeId: extra.episodeId || EPISODE,
    today: extra.today || TODAY,
    now: extra.now || new Date(2026, 8, 10, 8, 0, 0),
    timeZone: extra.timeZone,
    items: extra.items || [plannedItem(extra)],
  };
}

function build(extra = {}) {
  return buildPregnancyCareReminderCandidates({
    userId: extra.userId || USER,
    episodeId: extra.episodeId || EPISODE,
    mode: extra.mode || 'PREGNANCY',
    pregnancyActive: extra.pregnancyActive !== false,
    episodeStatus: extra.episodeStatus || 'ACTIVE',
    items: extra.items || [plannedItem(extra)],
    today: extra.today || TODAY,
    now: extra.now || new Date(2026, 8, 10, 8, 0, 0),
    timeZone: extra.timeZone,
  });
}

function exactState(extra = {}) {
  return {
    plannedDate: extra.plannedDate || '2026-09-22',
    plannedTime: extra.plannedTime || '14:30',
    reminderEnabled: true,
    reminderOffset: 1,
    reminderMode: REMINDER_MODE.EXACT_TIME,
    exactReminderOffsetMinutes: extra.exactMinutes === undefined ? 60 : extra.exactMinutes,
  };
}

describe('Phase 36 owner-opted exact-time prenatal reminders', () => {
  it('TEST A: legacy Phase 33 stays DATE_BASED 09:00 after plannedTime is added', () => {
    const withoutTime = build({
      plannedDate: '2026-09-22',
      offset: 1,
      reminderEnabled: true,
    });
    const withTime = build({
      plannedDate: '2026-09-22',
      plannedTime: '14:30',
      offset: 1,
      reminderEnabled: true,
    });
    assert.equal(withoutTime.length, 1);
    assert.equal(withTime.length, 1);
    assert.equal(withoutTime[0].candidateId, withTime[0].candidateId);
    assert.equal(withTime[0].reminderMode, REMINDER_MODE.DATE_BASED);
    assert.equal(withTime[0].eventDate, '2026-09-21');
    assert.equal(withTime[0].fireClock, '09:00');
    assert.equal(withTime[0].usesPlannedTime, false);
    assert.equal(addingPlannedTimeAutoUpgradesReminder(), false);
    assert.equal(phase35ReminderUsesPlannedTime(), false);
    assert.equal(exactTimeReminderAdded(), false);
  });

  it('TEST B: exact option is not eligible without plannedTime', () => {
    const rows = build({
      plannedDate: '2026-09-22',
      plannedTime: null,
      reminderMode: REMINDER_MODE.EXACT_TIME,
      exactMinutes: 60,
    });
    assert.equal(rows.length, 0);
    const schedule = resolvePrenatalCareReminderSchedule({
      plannedDate: '2026-09-22',
      plannedTime: null,
      reminderMode: REMINDER_MODE.EXACT_TIME,
      exactReminderOffsetMinutes: 60,
    });
    assert.equal(schedule.ok, false);
    assert.equal(schedule.reason, PREGNANCY_CARE_REMINDER_SUPPRESSION.NO_PLANNED_TIME);
  });

  it('null exact minutes is not AT_TIME (0)', () => {
    assert.equal(isExactReminderOffsetMinutes(null), false);
    assert.equal(isExactReminderOffsetMinutes(undefined), false);
    assert.equal(isExactReminderOffsetMinutes(''), false);
    assert.equal(isExactReminderOffsetMinutes(0), true);
    assert.equal(normalizeExactReminderOffsetMinutes(null), 60);
  });

  it('TEST C/F: explicit EXACT_TIME + 1 hour before fires at 13:30 local', () => {
    assert.equal(exactTimeRequiresExplicitSelection(), true);
    assert.equal(EXACT_REMINDER_DEFAULT_MINUTES, 60);
    const schedule = resolvePrenatalCareReminderSchedule(exactState({ exactMinutes: 60 }), { timeZone: TZ });
    assert.equal(schedule.ok, true);
    assert.equal(schedule.fireCivilDate, '2026-09-22');
    assert.equal(schedule.fireClock, '13:30');
    assert.equal(schedule.usesPlannedTime, true);
    const rows = build({
      plannedDate: '2026-09-22',
      plannedTime: '14:30',
      reminderMode: REMINDER_MODE.EXACT_TIME,
      exactMinutes: 60,
      timeZone: TZ,
    });
    assert.equal(rows.length, 1);
    assert.match(rows[0].candidateId, /:14:30:EXACT:60$/);
  });

  it('TEST D: AT_TIME fires at plannedTime', () => {
    const schedule = resolvePrenatalCareReminderSchedule(exactState({ exactMinutes: 0 }), { timeZone: TZ });
    assert.equal(schedule.fireClock, '14:30');
    assert.equal(schedule.fireCivilDate, '2026-09-22');
  });

  it('TEST E: 30 minutes before', () => {
    const schedule = resolvePrenatalCareReminderSchedule(exactState({ exactMinutes: 30 }), { timeZone: TZ });
    assert.equal(schedule.fireClock, '14:00');
  });

  it('TEST G: 2 hours before', () => {
    const schedule = resolvePrenatalCareReminderSchedule(exactState({ exactMinutes: 120 }), { timeZone: TZ });
    assert.equal(schedule.fireClock, '12:30');
    assert.deepEqual([...EXACT_REMINDER_OFFSET_MINUTES], [0, 30, 60, 120]);
  });

  it('TEST H: midnight crossover to previous civil day', () => {
    const oneHour = subtractMinutesFromWallClock('2026-09-22', '00:00', 60);
    assert.deepEqual(oneHour, { civilDate: '2026-09-21', clock: '23:00' });
    const thirty = subtractMinutesFromWallClock('2026-09-22', '00:30', 60);
    assert.deepEqual(thirty, { civilDate: '2026-09-21', clock: '23:30' });
    const atTime = resolvePrenatalCareReminderSchedule(
      exactState({ plannedTime: '23:59', exactMinutes: 0 }),
      { timeZone: TZ },
    );
    assert.equal(atTime.ok, true);
    assert.equal(atTime.fireClock, '23:59');
  });

  it('TEST I: changing plannedTime invalidates the old exact candidate', () => {
    const candidate = build({
      plannedTime: '14:30',
      reminderMode: REMINDER_MODE.EXACT_TIME,
      exactMinutes: 60,
      timeZone: TZ,
    })[0];
    const check = revalidatePregnancyCareReminder(
      candidate,
      live({
        items: [plannedItem({ plannedTime: '16:00', reminderMode: REMINDER_MODE.EXACT_TIME, exactMinutes: 60 })],
        timeZone: TZ,
      }),
    );
    assert.equal(check.ok, false);
    assert.equal(check.reason, PREGNANCY_CARE_REMINDER_SUPPRESSION.TIME_CHANGED);
  });

  it('TEST J: changing plannedDate invalidates the old candidate', () => {
    const candidate = build({
      plannedTime: '14:30',
      reminderMode: REMINDER_MODE.EXACT_TIME,
      exactMinutes: 60,
      timeZone: TZ,
    })[0];
    const check = revalidatePregnancyCareReminder(
      candidate,
      live({
        items: [
          plannedItem({
            plannedDate: '2026-09-23',
            plannedTime: '14:30',
            reminderMode: REMINDER_MODE.EXACT_TIME,
            exactMinutes: 60,
          }),
        ],
        timeZone: TZ,
      }),
    );
    assert.equal(check.ok, false);
    assert.equal(check.reason, PREGNANCY_CARE_REMINDER_SUPPRESSION.DATE_CHANGED);
  });

  it('TEST K: changing exact offset invalidates the old candidate', () => {
    const candidate = build({
      plannedTime: '14:30',
      reminderMode: REMINDER_MODE.EXACT_TIME,
      exactMinutes: 60,
      timeZone: TZ,
    })[0];
    const check = revalidatePregnancyCareReminder(
      candidate,
      live({
        items: [plannedItem({ plannedTime: '14:30', reminderMode: REMINDER_MODE.EXACT_TIME, exactMinutes: 30 })],
        timeZone: TZ,
      }),
    );
    assert.equal(check.ok, false);
    assert.equal(check.reason, PREGNANCY_CARE_REMINDER_SUPPRESSION.OFFSET_CHANGED);
  });

  it('TEST L: mode change leaves only one deliverable candidate', () => {
    const dateCandidate = build({
      plannedTime: '14:30',
      reminderMode: REMINDER_MODE.DATE_BASED,
      offset: 1,
    })[0];
    const exactLive = live({
      items: [plannedItem({ plannedTime: '14:30', reminderMode: REMINDER_MODE.EXACT_TIME, exactMinutes: 60 })],
      timeZone: TZ,
    });
    assert.equal(revalidatePregnancyCareReminder(dateCandidate, exactLive).reason, PREGNANCY_CARE_REMINDER_SUPPRESSION.MODE_CHANGED);
    const exactRows = buildPregnancyCareReminderCandidates({
      userId: USER,
      episodeId: EPISODE,
      mode: 'PREGNANCY',
      items: exactLive.items,
      today: TODAY,
      now: new Date(2026, 8, 10, 8, 0, 0),
      timeZone: TZ,
    });
    assert.equal(exactRows.length, 1);
    assert.equal(exactRows[0].reminderMode, REMINDER_MODE.EXACT_TIME);
    assert.notEqual(dateCandidate.candidateId, exactRows[0].candidateId);
  });

  it('TEST M: removing plannedTime does not fall back to 09:00', () => {
    const candidate = build({
      plannedTime: '14:30',
      reminderMode: REMINDER_MODE.EXACT_TIME,
      exactMinutes: 60,
      timeZone: TZ,
    })[0];
    const removed = plannedItem({
      plannedTime: null,
      reminderEnabled: false,
      reminderMode: REMINDER_MODE.DATE_BASED,
      exactMinutes: null,
    });
    const check = revalidatePregnancyCareReminder(candidate, live({ items: [removed] }));
    assert.equal(check.ok, false);
    assert.ok(
      check.reason === PREGNANCY_CARE_REMINDER_SUPPRESSION.USER_DISABLED ||
        check.reason === PREGNANCY_CARE_REMINDER_SUPPRESSION.NO_PLANNED_TIME ||
        check.reason === PREGNANCY_CARE_REMINDER_SUPPRESSION.MODE_CHANGED,
    );
    assert.equal(
      build({
        plannedTime: null,
        reminderMode: REMINDER_MODE.EXACT_TIME,
        exactMinutes: 60,
        reminderEnabled: true,
      }).length,
      0,
    );
  });

  it('TEST N: clearing plannedDate invalidates reminder', () => {
    const candidate = build({
      plannedTime: '14:30',
      reminderMode: REMINDER_MODE.EXACT_TIME,
      exactMinutes: 60,
      timeZone: TZ,
    })[0];
    const check = revalidatePregnancyCareReminder(
      candidate,
      live({
        items: [plannedItem({ plannedDate: null, plannedTime: null, reminderEnabled: false })],
      }),
    );
    assert.equal(check.ok, false);
  });

  it('TEST O/P/Q: completed, dismissed, notApplicable suppress', () => {
    for (const status of ['COMPLETED', 'DISMISSED', 'NOT_APPLICABLE']) {
      assert.equal(
        build({
          status,
          plannedTime: '14:30',
          reminderMode: REMINDER_MODE.EXACT_TIME,
          exactMinutes: 60,
        }).length,
        0,
      );
    }
  });

  it('TEST R/S: ended episode and new pregnancy suppress', () => {
    assert.equal(
      build({
        plannedTime: '14:30',
        reminderMode: REMINDER_MODE.EXACT_TIME,
        exactMinutes: 60,
        pregnancyActive: false,
        episodeStatus: 'ENDED',
      }).length,
      0,
    );
    const candidate = build({
      plannedTime: '14:30',
      reminderMode: REMINDER_MODE.EXACT_TIME,
      exactMinutes: 60,
      timeZone: TZ,
    })[0];
    assert.equal(
      revalidatePregnancyCareReminder(candidate, live({ episodeId: 'ep-b', timeZone: TZ })).reason,
      PREGNANCY_CARE_REMINDER_SUPPRESSION.EPISODE_ENDED,
    );
  });

  it('TEST T: cross-user candidate is rejected', () => {
    const candidate = build({
      plannedTime: '14:30',
      reminderMode: REMINDER_MODE.EXACT_TIME,
      exactMinutes: 60,
      timeZone: TZ,
    })[0];
    assert.equal(
      revalidatePregnancyCareReminder(candidate, live({ userId: 'user-b', timeZone: TZ })).reason,
      PREGNANCY_CARE_REMINDER_SUPPRESSION.CROSS_USER,
    );
  });

  it('TEST U: past exact fire time does not catch up', () => {
    const rows = build({
      plannedDate: TODAY,
      plannedTime: '14:30',
      reminderMode: REMINDER_MODE.EXACT_TIME,
      exactMinutes: 60,
      now: new Date(2026, 8, 10, 14, 0, 0),
    });
    assert.equal(rows.length, 0);
  });

  it('TEST V: today future exact fire is allowed', () => {
    const rows = build({
      plannedDate: TODAY,
      plannedTime: '14:30',
      reminderMode: REMINDER_MODE.EXACT_TIME,
      exactMinutes: 60,
      now: new Date(2026, 8, 10, 8, 0, 0),
    });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].fireClock, '13:30');
  });

  it('TEST X: lock-screen default stays privacy-minimal', () => {
    const masked = pregnancyCareMaskedCopy();
    assert.equal(maskedCopyIsSafe(masked.title, masked.body), true);
    assert.doesNotMatch(masked.body, /ორსულ|ანატომ|14:30|13:30|სკან/);
    const unmasked = pregnancyCareReminderCopy({
      reminderMode: REMINDER_MODE.EXACT_TIME,
      itemTitle: 'ანატომიის ულტრაბგერა',
    });
    assert.match(unmasked.body, /შენ დაგეგმე/);
    assert.doesNotMatch(unmasked.body, /იწყება|starts|ვადა/);
  });

  it('one reminder mode per item; catalog windows never create reminders', () => {
    assert.equal(canonicalizeReminderMode(null), REMINDER_MODE.DATE_BASED);
    assert.equal(canonicalizeReminderMode(undefined), REMINDER_MODE.DATE_BASED);
    const windowOnly = {
      id: 'anatomy_ultrasound',
      timing: { relation: 'IN_WINDOW', startWeek: 18, endWeek: 22 },
      userState: null,
    };
    assert.equal(
      buildPregnancyCareReminderCandidates({
        userId: USER,
        episodeId: EPISODE,
        mode: 'PREGNANCY',
        items: [windowOnly],
        today: TODAY,
        now: new Date(2026, 8, 10, 8, 0, 0),
      }).length,
      0,
    );
    assert.equal(catalogWindowNeverReminds({ relation: 'IN_WINDOW', userState: null }), true);
  });

  it('DATE_BASED still ignores plannedTime and uses 09:00', () => {
    const schedule = resolvePrenatalCareReminderSchedule({
      plannedDate: '2026-09-22',
      plannedTime: '14:30',
      reminderEnabled: true,
      reminderOffset: 1,
      reminderMode: REMINDER_MODE.DATE_BASED,
    });
    assert.equal(schedule.fireClock, `${String(CYCLE_REMINDER_HOUR).padStart(2, '0')}:${String(CYCLE_REMINDER_MINUTE).padStart(2, '0')}`);
    assert.equal(schedule.usesPlannedTime, false);
  });

  it('DST gap in Europe/Brussels fails closed; overlap uses first occurrence', () => {
    const gap = wallClockInstant('2026-03-29', '02:30', TZ);
    assert.equal(gap.ok, false);
    assert.equal(gap.reason, PREGNANCY_CARE_REMINDER_SUPPRESSION.NONEXISTENT_LOCAL_TIME);
    const overlap = wallClockInstant('2026-10-25', '02:30', TZ);
    assert.equal(overlap.ok, true);
    assert.equal(new Date(overlap.ms).getUTCHours(), 0);
    assert.equal(new Date(overlap.ms).getUTCMinutes(), 30);
  });

  it('quiet-hours: DATE_BASED bumps; EXACT_TIME follows visit alarms (no bump)', () => {
    assert.equal(dateBasedQuietHoursBump(), true);
    assert.equal(exactQuietHoursFollowVisitAlarms(), true);
    assert.equal(medicardAddsOsCalendarAlarm(), false);
  });

  it('dedupe identity includes time and exact offset only in EXACT_TIME', () => {
    const dateId = pregnancyCareReminderCandidateId({
      userId: USER,
      episodeId: EPISODE,
      careItemId: 'anatomy_ultrasound',
      plannedDate: '2026-09-22',
      offset: 1,
    });
    const exactId = pregnancyCareReminderCandidateId({
      userId: USER,
      episodeId: EPISODE,
      careItemId: 'anatomy_ultrasound',
      plannedDate: '2026-09-22',
      plannedTime: '14:30',
      reminderMode: REMINDER_MODE.EXACT_TIME,
      exactOffsetMinutes: 60,
    });
    assert.equal(dateId, `pregnancy_care:${USER}:${EPISODE}:anatomy_ultrasound:2026-09-22:1`);
    assert.equal(exactId, `pregnancy_care:${USER}:${EPISODE}:anatomy_ultrasound:2026-09-22:14:30:EXACT:60`);
  });
});
