import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CYCLE_CANDIDATE_TYPES } from './cycleNotificationContract.js';
import { maskedCopyIsSafe } from './cycleNotificationContract.js';
import {
  PREGNANCY_CARE_REMINDER_FAMILY,
  PREGNANCY_CARE_REMINDER_MEANING,
  PREGNANCY_CARE_REMINDER_SUPPRESSION,
  PREGNANCY_CARE_REMINDER_TYPE,
  assertPregnancyCareMaskedCopySafe,
  buildPregnancyCareReminderCandidates,
  pregnancyCareMaskedCopy,
  pregnancyCareReminderCandidateId,
  pregnancyCareReminderCopy,
  pregnancyCareReminderRoute,
  revalidatePregnancyCareReminder,
  reminderFireCivilDate,
} from './pregnancyCareReminderContract.js';

const TODAY = '2026-09-10';
const USER = 'user-a';
const EPISODE = 'ep-a';

function plannedItem(extra = {}) {
  return {
    id: extra.id || 'anatomy_ultrasound',
    timing: { relation: extra.relation || 'IN_WINDOW', startWeek: 18, endWeek: 22 },
    userState: {
      status: extra.status || 'PLANNED',
      plannedDate: extra.plannedDate === undefined ? '2026-09-18' : extra.plannedDate,
      reminderEnabled: extra.reminderEnabled === undefined ? true : extra.reminderEnabled,
      reminderOffset: extra.offset === undefined ? 1 : extra.offset,
      note: extra.note || null,
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
    now: extra.now || new Date('2026-09-10T08:00:00'),
    items: extra.items || [plannedItem()],
  };
}

function build(extra = {}) {
  return buildPregnancyCareReminderCandidates({
    userId: USER,
    episodeId: EPISODE,
    mode: extra.mode || 'PREGNANCY',
    pregnancyActive: extra.pregnancyActive !== false,
    episodeStatus: extra.episodeStatus || 'ACTIVE',
    items: extra.items || [plannedItem(extra)],
    today: extra.today || TODAY,
    now: extra.now || new Date('2026-09-10T08:00:00'),
  });
}

describe('pregnancy care reminder contract', () => {
  it('is a Brain sibling family, not a frozen Cycle calendar type', () => {
    assert.equal(CYCLE_CANDIDATE_TYPES.includes(PREGNANCY_CARE_REMINDER_TYPE), false);
    assert.equal(PREGNANCY_CARE_REMINDER_FAMILY, 'pregnancyCareReminder');
    assert.equal(PREGNANCY_CARE_REMINDER_MEANING, 'USER_PLANNED_EVENT');
  });

  it('M: plannedTime does not change reminder fire date or copy', () => {
    const rows = build({ plannedDate: '2026-09-18', offset: 1, reminderEnabled: true });
    const timedItem = plannedItem({ plannedDate: '2026-09-18', offset: 1, reminderEnabled: true });
    timedItem.userState.plannedTime = '14:30';
    const timed = buildPregnancyCareReminderCandidates({
      userId: USER,
      episodeId: EPISODE,
      mode: 'PREGNANCY',
      today: TODAY,
      now: new Date('2026-09-10T08:00:00'),
      pregnancyActive: true,
      episodeStatus: 'ACTIVE',
      items: [timedItem],
    });
    assert.equal(rows[0].eventDate, reminderFireCivilDate('2026-09-18', 1));
    assert.equal(timed[0].eventDate, rows[0].eventDate);
    assert.doesNotMatch(JSON.stringify(timed[0]), /14:30/);
  });

  it('A: planned date without opt-in creates no candidate', () => {
    assert.equal(build({ reminderEnabled: false }).length, 0);
  });

  it('B: explicit opt-in + future date is eligible for offset', () => {
    const rows = build({ plannedDate: '2026-09-18', offset: 1, reminderEnabled: true });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].eventDate, '2026-09-17');
    assert.equal(rows[0].route, pregnancyCareReminderRoute('anatomy_ultrasound'));
  });

  it('C: IN_WINDOW without planned date creates no candidate', () => {
    assert.equal(
      build({
        items: [
          {
            id: 'anatomy_ultrasound',
            timing: { relation: 'IN_WINDOW' },
            userState: null,
          },
        ],
      }).length,
      0,
    );
  });

  it('D: AFTER_WINDOW without planned date creates no push', () => {
    assert.equal(
      build({
        items: [
          {
            id: 'first_booking',
            timing: { relation: 'AFTER_WINDOW' },
            userState: { status: 'PLANNED', plannedDate: null, reminderEnabled: true, reminderOffset: 1 },
          },
        ],
      }).length,
      0,
    );
  });

  it('E: completed suppresses', () => {
    assert.equal(build({ status: 'COMPLETED', reminderEnabled: true }).length, 0);
  });

  it('F: dismissed suppresses', () => {
    assert.equal(build({ status: 'DISMISSED' }).length, 0);
  });

  it('G: not-applicable suppresses', () => {
    assert.equal(build({ status: 'NOT_APPLICABLE' }).length, 0);
  });

  it('H: date change invalidates old candidate', () => {
    const candidate = build()[0];
    const check = revalidatePregnancyCareReminder(candidate, live({
      items: [plannedItem({ plannedDate: '2026-09-22' })],
    }));
    assert.equal(check.ok, false);
    assert.equal(check.reason, PREGNANCY_CARE_REMINDER_SUPPRESSION.DATE_CHANGED);
  });

  it('I: reminder disabled yields no candidate', () => {
    const candidate = build()[0];
    const check = revalidatePregnancyCareReminder(candidate, live({
      items: [plannedItem({ reminderEnabled: false })],
    }));
    assert.equal(check.reason, PREGNANCY_CARE_REMINDER_SUPPRESSION.USER_DISABLED);
  });

  it('J: ended episode suppresses', () => {
    assert.equal(build({ pregnancyActive: false, episodeStatus: 'ENDED' }).length, 0);
  });

  it('K: new pregnancy episode does not keep old candidate', () => {
    const candidate = build()[0];
    const check = revalidatePregnancyCareReminder(candidate, live({ episodeId: 'ep-b' }));
    assert.equal(check.reason, PREGNANCY_CARE_REMINDER_SUPPRESSION.EPISODE_ENDED);
  });

  it('L: cross-user candidate is rejected', () => {
    const candidate = build()[0];
    const check = revalidatePregnancyCareReminder(candidate, live({ userId: 'user-b' }));
    assert.equal(check.reason, PREGNANCY_CARE_REMINDER_SUPPRESSION.CROSS_USER);
  });

  it('M: deep link is planner item focus', () => {
    assert.equal(pregnancyCareReminderRoute('anatomy_ultrasound'), '/cycle/pregnancy/care-plan?item=anatomy_ultrasound');
  });

  it('N: cleared item is a safe miss', () => {
    const candidate = build()[0];
    const check = revalidatePregnancyCareReminder(candidate, live({ items: [] }));
    assert.equal(check.reason, PREGNANCY_CARE_REMINDER_SUPPRESSION.CLEARED);
  });

  it('S/T: past planned date does not schedule', () => {
    assert.equal(build({ plannedDate: '2026-09-01', offset: 0 }).length, 0);
  });

  it('U: today after 09:00 is not a catch-up send', () => {
    assert.equal(
      build({
        plannedDate: TODAY,
        offset: 0,
        now: new Date(2026, 8, 10, 15, 0, 0),
      }).length,
      0,
    );
  });

  it('dedupe key includes user, episode, item, date, offset', () => {
    const a = pregnancyCareReminderCandidateId({
      userId: USER,
      episodeId: EPISODE,
      careItemId: 'anatomy_ultrasound',
      plannedDate: '2026-09-18',
      offset: 1,
    });
    const b = pregnancyCareReminderCandidateId({
      userId: USER,
      episodeId: EPISODE,
      careItemId: 'anatomy_ultrasound',
      plannedDate: '2026-09-19',
      offset: 1,
    });
    assert.notEqual(a, b);
    assert.equal(reminderFireCivilDate('2026-09-18', 3), '2026-09-15');
  });

  it('copy is user-plan language, not medical-due', () => {
    const copy = pregnancyCareReminderCopy({ offset: 1, itemTitle: 'ანატომიის ულტრაბგერა' });
    assert.match(copy.body, /შენ დაგეგმე/);
    assert.doesNotMatch(copy.body, /დროა|გჭირდება|აუცილებელია|ვადა|აგვიანდება/);
    const masked = pregnancyCareMaskedCopy();
    assert.equal(assertPregnancyCareMaskedCopySafe(), true);
    assert.equal(maskedCopyIsSafe(masked.title, masked.body), true);
    assert.doesNotMatch(masked.body, /ორსულ|ანატომ|სკან/);
  });

  it('TRACK/TTC/PERI cannot emit candidates', () => {
    assert.equal(build({ mode: 'TRACK_PERIOD' }).length, 0);
    assert.equal(build({ mode: 'TRY_TO_CONCEIVE' }).length, 0);
    assert.equal(build({ mode: 'PERIMENOPAUSE' }).length, 0);
  });
});
