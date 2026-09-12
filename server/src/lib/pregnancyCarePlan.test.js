import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { addDays } from './cycle.js';
import { buildCycleAiUserPrompt } from './cycle.js';
import { buildCycleExportPayload } from './cycleLifecycle.js';
import { buildCycleDoctorSummaryData, doctorSummaryHasSensitiveLeak } from './cycleDoctorSummary.js';
import { partnerPayloadHasLeak } from './cycleShare.js';
import { gestationalAgeFromReference, presentPregnancyDating } from './cyclePregnancy.js';
import {
  buildPregnancyCarePlannerSummary,
  presentPregnancyCarePlan,
  serializeCarePlanStateForExport,
  validateCarePlanWrite,
  resolveCarePlanReminderFields,
  resolveCarePlanPlaceFields,
} from './pregnancyCarePlan.js';
import { careWindowRelation } from '../../../mobile/src/lib/pregnancyCareCatalog.js';
import { PLANNED_PLACE_MAX } from '../../../mobile/src/lib/pregnancyCareVisitPlaceContract.js';

const TODAY = '2026-09-10';

function datingAt(week, day = 0) {
  const referenceDate = addDays(TODAY, -(week * 7 + day));
  return presentPregnancyDating({
    referenceDate,
    referenceType: 'LMP',
    today: TODAY,
  });
}

function planAt(week, day = 0, extra = {}) {
  const dating = extra.dating || datingAt(week, day);
  return presentPregnancyCarePlan({
    mode: extra.mode ?? 'PREGNANCY',
    pregnancyActive: extra.pregnancyActive ?? true,
    dating,
    states: extra.states || [],
  });
}

describe('Pregnancy care planner timing', () => {
  it('first trimester marks early booking/labs in-window, not anatomy', () => {
    const age = gestationalAgeFromReference(addDays(TODAY, -(8 * 7 + 2)), TODAY);
    assert.equal(age.week, 8);
    assert.equal(age.day, 2);
    const plan = planAt(8, 2);
    const byId = Object.fromEntries(plan.items.map((row) => [row.id, row]));
    assert.equal(plan.personalized, true);
    assert.equal(byId.first_booking.timing.relation, 'IN_WINDOW');
    assert.equal(byId.first_trimester_labs.timing.relation, 'IN_WINDOW');
    assert.equal(byId.dating_ultrasound.timing.relation, 'BEFORE_WINDOW');
    assert.equal(byId.anatomy_ultrasound.timing.relation, 'BEFORE_WINDOW');
    assert.equal(byId.gdm_screening_discussion.timing.relation, 'BEFORE_WINDOW');
    assert.equal(buildPregnancyCarePlannerSummary(plan).next.id, 'first_booking');
  });

  it('second trimester marks anatomy current and not first-trimester current', () => {
    const plan = planAt(20, 0);
    const byId = Object.fromEntries(plan.items.map((row) => [row.id, row]));
    assert.equal(byId.anatomy_ultrasound.timing.relation, 'IN_WINDOW');
    assert.equal(byId.first_booking.timing.relation, 'AFTER_WINDOW');
    assert.equal(byId.dating_ultrasound.timing.relation, 'AFTER_WINDOW');
    assert.equal(byId.gdm_screening_discussion.timing.relation, 'BEFORE_WINDOW');
    assert.equal(buildPregnancyCarePlannerSummary(plan).next.id, 'anatomy_ultrasound');
  });

  it('third trimester marks later planning items, not anatomy as current', () => {
    const plan = planAt(32, 1);
    const byId = Object.fromEntries(plan.items.map((row) => [row.id, row]));
    assert.equal(byId.third_trimester_followup.timing.relation, 'IN_WINDOW');
    assert.equal(byId.birth_planning.timing.relation, 'IN_WINDOW');
    assert.equal(byId.postpartum_newborn_prep.timing.relation, 'IN_WINDOW');
    assert.equal(byId.anatomy_ultrasound.timing.relation, 'AFTER_WINDOW');
    assert.equal(byId.first_booking.timing.relation, 'AFTER_WINDOW');
    assert.equal(byId.gbs_screening_discussion.timing.relation, 'BEFORE_WINDOW');
  });

  it('reviewRequired suppresses personalized now/next but still lists the catalog', () => {
    const dating = presentPregnancyDating({
      referenceDate: addDays(TODAY, -320),
      referenceType: 'LMP',
      today: TODAY,
    });
    assert.equal(dating.reviewRequired, true);
    const plan = presentPregnancyCarePlan({
      mode: 'PREGNANCY',
      pregnancyActive: true,
      dating,
      states: [],
    });
    assert.equal(plan.personalized, false);
    assert.equal(plan.reviewRequired, true);
    assert.ok(plan.items.length >= 8);
    assert.equal(plan.items.every((row) => row.timing.relation === null), true);
    assert.equal(buildPregnancyCarePlannerSummary(plan).next, null);
  });

  it('window start is the first completed-week day; one day before is BEFORE', () => {
    const start = datingAt(18, 0);
    assert.equal(start.estimatedGestationalAge.week, 18);
    assert.equal(start.estimatedGestationalAge.day, 0);
    assert.equal(
      careWindowRelation({
        week: start.estimatedGestationalAge.week,
        startWeek: 18,
        endWeek: 22,
        reviewRequired: false,
      }),
      'IN_WINDOW',
    );
    const before = datingAt(17, 6);
    assert.equal(before.estimatedGestationalAge.week, 17);
    assert.equal(before.estimatedGestationalAge.day, 6);
    assert.equal(
      careWindowRelation({
        week: before.estimatedGestationalAge.week,
        startWeek: 18,
        endWeek: 22,
        reviewRequired: false,
      }),
      'BEFORE_WINDOW',
    );
  });

  it('window end is the last completed-week day; one day after is AFTER', () => {
    const end = datingAt(22, 6);
    assert.equal(end.estimatedGestationalAge.week, 22);
    assert.equal(end.estimatedGestationalAge.day, 6);
    assert.equal(
      careWindowRelation({
        week: 22,
        startWeek: 18,
        endWeek: 22,
        reviewRequired: false,
      }),
      'IN_WINDOW',
    );
    const after = datingAt(23, 0);
    assert.equal(after.estimatedGestationalAge.week, 23);
    assert.equal(
      careWindowRelation({
        week: after.estimatedGestationalAge.week,
        startWeek: 18,
        endWeek: 22,
        reviewRequired: false,
      }),
      'AFTER_WINDOW',
    );
  });
});

describe('Pregnancy care planner user state', () => {
  it('persists planned date even outside the catalog window', () => {
    const plan = planAt(20, 0, {
      states: [
        {
          careItemId: 'anatomy_ultrasound',
          status: 'PLANNED',
          plannedDate: '2026-12-01',
          completedDate: null,
          note: 'clinic A',
        },
      ],
    });
    const row = plan.items.find((item) => item.id === 'anatomy_ultrasound');
    assert.equal(row.userState.status, 'PLANNED');
    assert.equal(row.userState.plannedDate, '2026-12-01');
    assert.equal(row.plannedDateOutsideWindow, true);
    assert.equal(row.timing.relation, 'IN_WINDOW');
  });

  it('completed is factual user state only', () => {
    const plan = planAt(20, 0, {
      states: [
        {
          careItemId: 'anatomy_ultrasound',
          status: 'COMPLETED',
          completedDate: '2026-08-01',
        },
      ],
    });
    const row = plan.items.find((item) => item.id === 'anatomy_ultrasound');
    assert.equal(row.userState.status, 'COMPLETED');
    assert.equal(row.userState.completedDate, '2026-08-01');
    const summary = buildPregnancyCarePlannerSummary(plan);
    assert.notEqual(summary.next?.id, 'anatomy_ultrasound');
  });

  it('dismissed items are hidden from next but restorable via CLEAR', () => {
    const plan = planAt(8, 0, {
      states: [{ careItemId: 'first_booking', status: 'DISMISSED' }],
    });
    assert.notEqual(buildPregnancyCarePlannerSummary(plan).next?.id, 'first_booking');
    const cleared = validateCarePlanWrite({ status: 'CLEAR' }, { careItemId: 'first_booking', today: TODAY });
    assert.equal(cleared.action, 'CLEAR');
  });

  it('accepts a user date outside the informational window', () => {
    const parsed = validateCarePlanWrite(
      { status: 'PLANNED', plannedDate: '2025-01-01' },
      { careItemId: 'anatomy_ultrasound', today: TODAY },
    );
    assert.equal(parsed.action, 'UPSERT');
    assert.equal(parsed.plannedDate, '2025-01-01');
  });

  it('accepts optional HH:mm plannedTime, rejects malformed, and clears time with date', () => {
    const timed = validateCarePlanWrite(
      { status: 'PLANNED', plannedDate: '2026-09-22', plannedTime: '14:30' },
      { careItemId: 'anatomy_ultrasound', today: TODAY },
    );
    assert.equal(timed.plannedTime, '14:30');
    assert.throws(
      () =>
        validateCarePlanWrite(
          { status: 'PLANNED', plannedDate: '2026-09-22', plannedTime: '25:00' },
          { careItemId: 'anatomy_ultrasound', today: TODAY },
        ),
      (err) => err.status === 400,
    );
    const cleared = validateCarePlanWrite(
      { status: 'PLANNED', plannedDate: null, plannedTime: '14:30' },
      { careItemId: 'anatomy_ultrasound', today: TODAY },
    );
    assert.equal(cleared.plannedDate, null);
    assert.equal(cleared.plannedTime, null);
  });

  it('accepts optional plannedPlace only with a planned date', () => {
    const placed = validateCarePlanWrite(
      { status: 'PLANNED', plannedDate: '2026-09-22', plannedPlace: '  CHC MontLégia  ' },
      { careItemId: 'anatomy_ultrasound', today: TODAY },
    );
    assert.equal(placed.plannedPlace, 'CHC MontLégia');
    const noDate = validateCarePlanWrite(
      { status: 'PLANNED', plannedDate: null, plannedPlace: 'CHC' },
      { careItemId: 'anatomy_ultrasound', today: TODAY },
    );
    assert.equal(noDate.plannedPlace, null);
    assert.throws(
      () =>
        validateCarePlanWrite(
          { status: 'PLANNED', plannedDate: '2026-09-22', plannedPlace: 'ა'.repeat(PLANNED_PLACE_MAX + 1) },
          { careItemId: 'anatomy_ultrasound', today: TODAY },
        ),
      (err) => err.status === 400,
    );
    const kept = resolveCarePlanPlaceFields({
      parsed: { plannedDate: '2026-09-23' },
      existing: { plannedDate: '2026-09-22', plannedPlace: 'CHC MontLégia' },
      plannedDate: '2026-09-23',
    });
    assert.equal(kept, 'CHC MontLégia');
    const dateCleared = resolveCarePlanPlaceFields({
      parsed: { plannedDate: null, plannedPlace: 'CHC' },
      existing: { plannedDate: '2026-09-22', plannedPlace: 'CHC' },
      plannedDate: null,
    });
    assert.equal(dateCleared, null);
    const completed = planAt(20, 2, {
      states: [
        {
          careItemId: 'anatomy_ultrasound',
          status: 'COMPLETED',
          plannedDate: '2026-09-22',
          plannedPlace: 'CHC MontLégia',
        },
      ],
    });
    assert.equal(completed.items.find((row) => row.id === 'anatomy_ultrasound').userState.plannedPlace, 'CHC MontLégia');
    const review = presentPregnancyCarePlan({
      mode: 'PREGNANCY',
      pregnancyActive: true,
      dating: { ...datingAt(8, 0), reviewRequired: true, estimatedGestationalAge: null },
      episodeId: 'ep-a',
      states: [
        {
          careItemId: 'anatomy_ultrasound',
          status: 'PLANNED',
          plannedDate: '2026-09-22',
          plannedPlace: 'CHC MontLégia',
        },
      ],
    });
    assert.equal(review.reviewRequired, true);
    assert.equal(
      review.items.find((row) => row.id === 'anatomy_ultrasound').userState.plannedPlace,
      'CHC MontLégia',
    );
  });

  it('rejects unknown status strings and invalid dates', () => {
    assert.throws(
      () => validateCarePlanWrite({ status: 'OVERDUE' }, { careItemId: 'first_booking', today: TODAY }),
      (err) => err.status === 400,
    );
    assert.throws(
      () =>
        validateCarePlanWrite(
          { status: 'PLANNED', plannedDate: '10/09/2026' },
          { careItemId: 'first_booking', today: TODAY },
        ),
      (err) => err.status === 400,
    );
  });

  it('plannedDate does not auto-enable reminders; opt-in requires planned date', () => {
    const parsed = validateCarePlanWrite(
      { status: 'PLANNED', plannedDate: '2026-09-18' },
      { careItemId: 'anatomy_ultrasound', today: TODAY },
    );
    const resolved = resolveCarePlanReminderFields({ parsed, existing: null });
    assert.equal(resolved.reminderEnabled, false);
    const opted = validateCarePlanWrite(
      { status: 'PLANNED', plannedDate: '2026-09-18', reminderEnabled: true, reminderOffset: 1 },
      { careItemId: 'anatomy_ultrasound', today: TODAY },
    );
    const on = resolveCarePlanReminderFields({ parsed: opted, existing: null });
    assert.equal(on.reminderEnabled, true);
    assert.equal(on.reminderOffset, 1);
    const completed = resolveCarePlanReminderFields({
      parsed: validateCarePlanWrite({ status: 'COMPLETED' }, { careItemId: 'anatomy_ultrasound', today: TODAY }),
      existing: { plannedDate: '2026-09-18', reminderEnabled: true, reminderOffset: 1 },
    });
    assert.equal(completed.reminderEnabled, false);
  });

  it('adding plannedTime does not auto-upgrade DATE_BASED reminders', () => {
    const existing = {
      plannedDate: '2026-09-22',
      plannedTime: null,
      reminderEnabled: true,
      reminderOffset: 1,
      reminderMode: null,
      exactReminderOffsetMinutes: null,
    };
    const parsed = validateCarePlanWrite(
      { status: 'PLANNED', plannedDate: '2026-09-22', plannedTime: '14:30' },
      { careItemId: 'anatomy_ultrasound', today: TODAY },
    );
    const resolved = resolveCarePlanReminderFields({ parsed, existing, plannedTime: '14:30' });
    assert.equal(resolved.reminderEnabled, true);
    assert.equal(resolved.reminderMode, 'DATE_BASED');
    assert.equal(resolved.exactReminderOffsetMinutes, null);
  });

  it('EXACT_TIME without clock is disabled and does not fall back to 09:00', () => {
    const parsed = validateCarePlanWrite(
      { status: 'PLANNED', plannedDate: '2026-09-22', plannedTime: null },
      { careItemId: 'anatomy_ultrasound', today: TODAY },
    );
    const resolved = resolveCarePlanReminderFields({
      parsed,
      existing: {
        plannedDate: '2026-09-22',
        plannedTime: '14:30',
        reminderEnabled: true,
        reminderOffset: 1,
        reminderMode: 'EXACT_TIME',
        exactReminderOffsetMinutes: 60,
      },
      plannedTime: null,
    });
    assert.equal(resolved.reminderEnabled, false);
    assert.equal(resolved.reminderMode, 'DATE_BASED');
    assert.equal(resolved.exactReminderOffsetMinutes, null);
  });

  it('explicit EXACT_TIME with date+time stores minutes separately from day offset', () => {
    const parsed = validateCarePlanWrite(
      {
        status: 'PLANNED',
        plannedDate: '2026-09-22',
        plannedTime: '14:30',
        reminderEnabled: true,
        reminderMode: 'EXACT_TIME',
        exactReminderOffsetMinutes: 60,
      },
      { careItemId: 'anatomy_ultrasound', today: TODAY },
    );
    const resolved = resolveCarePlanReminderFields({ parsed, existing: null, plannedTime: '14:30' });
    assert.equal(resolved.reminderEnabled, true);
    assert.equal(resolved.reminderMode, 'EXACT_TIME');
    assert.equal(resolved.exactReminderOffsetMinutes, 60);
    assert.equal(resolved.reminderOffset, 1);
  });

  it('explicit EXACT_TIME without minutes defaults to 60, not AT_TIME', () => {
    const parsed = validateCarePlanWrite(
      {
        status: 'PLANNED',
        plannedDate: '2026-09-22',
        plannedTime: '14:30',
        reminderEnabled: true,
        reminderMode: 'EXACT_TIME',
      },
      { careItemId: 'anatomy_ultrasound', today: TODAY },
    );
    const resolved = resolveCarePlanReminderFields({ parsed, existing: null, plannedTime: '14:30' });
    assert.equal(resolved.exactReminderOffsetMinutes, 60);
    assert.notEqual(resolved.exactReminderOffsetMinutes, 0);
  });

  it('TRACK/TTC/PERI cannot get an active personalized planner', () => {
    for (const mode of ['TRACK_PERIOD', 'TRY_TO_CONCEIVE', 'PERIMENOPAUSE']) {
      const plan = planAt(20, 0, { mode, pregnancyActive: false });
      assert.equal(plan.available, false);
      assert.equal(plan.personalized, false);
      assert.equal(buildPregnancyCarePlannerSummary(plan).next, null);
    }
  });

  it('episode states do not leak across episode ids in the presenter', () => {
    const a = planAt(20, 0, {
      states: [{ careItemId: 'anatomy_ultrasound', status: 'COMPLETED', completedDate: TODAY }],
    });
    const b = planAt(8, 0, { states: [] });
    assert.equal(a.items.find((row) => row.id === 'anatomy_ultrasound').userState.status, 'COMPLETED');
    assert.equal(b.items.find((row) => row.id === 'anatomy_ultrasound').userState, null);
  });
});

describe('Pregnancy care planner privacy / regression', () => {
  it('personal export includes owner plan state', () => {
    const payload = buildCycleExportPayload({
      profile: { mode: 'PREGNANCY' },
      logs: [],
      pregnancyEpisodes: [{ id: 'ep-a', referenceDate: addDays(TODAY, -140), referenceType: 'LMP', status: 'ACTIVE' }],
      pregnancyCarePlan: [
        serializeCarePlanStateForExport({
          careItemId: 'anatomy_ultrasound',
          status: 'PLANNED',
          plannedDate: '2026-09-20',
          plannedTime: '14:30',
          plannedPlace: 'CHC MontLégia — Radiologie',
          completedDate: null,
          note: 'private note',
          reminderEnabled: true,
          reminderOffset: 1,
          reminderMode: 'EXACT_TIME',
          exactReminderOffsetMinutes: 60,
          catalogVersion: 'prenatal-care-v1',
          pregnancyEpisodeId: 'ep-a',
        }),
      ],
    });
    assert.equal(payload.pregnancyCarePlan[0].careItemId, 'anatomy_ultrasound');
    assert.equal(payload.pregnancyCarePlan[0].note, 'private note');
    assert.equal(payload.pregnancyCarePlan[0].reminderEnabled, true);
    assert.equal(payload.pregnancyCarePlan[0].reminderOffset, 1);
    assert.equal(payload.pregnancyCarePlan[0].plannedTime, '14:30');
    assert.equal(payload.pregnancyCarePlan[0].plannedPlace, 'CHC MontLégia — Radiologie');
    assert.equal(payload.pregnancyCarePlan[0].reminderMode, 'EXACT_TIME');
    assert.equal(payload.pregnancyCarePlan[0].exactReminderOffsetMinutes, 60);
    assert.equal(Object.hasOwn(payload.pregnancyCarePlan[0], 'calendarEventId'), false);
    assert.equal(Object.hasOwn(payload.pregnancyCarePlan[0], 'calendarExport'), false);
  });

  it('does not add planner state to partner, AI, or doctor summary', () => {
    const prompt = buildCycleAiUserPrompt({
      today: TODAY,
      profile: { mode: 'PREGNANCY', lastPeriodStart: addDays(TODAY, -140), avgCycleLength: 28, avgPeriodLength: 5 },
      logs: [],
      predictions: { nextPeriodStart: null, ovulationDate: null, fertileWindow: null, confidence: 'low' },
    });
    assert.doesNotMatch(prompt, /carePlanner|prenatal-care-v1|anatomy_ultrasound|careItemId|reminderEnabled|reminderOffset|reminderMode|exactReminderOffsetMinutes|calendarEventId|calendarExport|plannedTime|plannedPlace/);
    const partner = { estimated: true, permissions: { period: true } };
    assert.equal(partnerPayloadHasLeak({ ...partner, carePlannerSummary: { next: { id: 'x' } } }), true);
    assert.equal(partnerPayloadHasLeak({ ...partner, plannedPlace: 'CHC MontLégia' }), true);
    assert.equal(partnerPayloadHasLeak({ ...partner, reminderMode: 'EXACT_TIME' }), true);
    assert.equal(partnerPayloadHasLeak({ ...partner, exactReminderOffsetMinutes: 60 }), true);
    const doctor = buildCycleDoctorSummaryData({
      today: TODAY,
      profile: { mode: 'PREGNANCY' },
      logs: [],
    });
    assert.equal(Object.hasOwn(doctor, 'carePlannerSummary'), false);
    assert.equal(Object.hasOwn(doctor, 'pregnancyCarePlan'), false);
    assert.doesNotMatch(JSON.stringify(doctor), /prenatal-care-v1|careItemId|anatomy_ultrasound|calendarEventId|plannedTime|plannedPlace|reminderMode|exactReminderOffsetMinutes/);
    assert.equal(doctorSummaryHasSensitiveLeak({ ...doctor, carePlannerSummary: { next: true } }), true);
    assert.equal(doctorSummaryHasSensitiveLeak({ ...doctor, calendarEventId: 'evt-1' }), true);
    assert.equal(doctorSummaryHasSensitiveLeak({ ...doctor, plannedPlace: 'CHC MontLégia' }), true);
    assert.equal(doctorSummaryHasSensitiveLeak({ ...doctor, reminderMode: 'EXACT_TIME' }), true);
    assert.equal(doctorSummaryHasSensitiveLeak({ ...doctor, exactReminderOffsetMinutes: 60 }), true);
  });

  it('care-plan PUT route binds resolveCarePlanPlaceFields', () => {
    const src = fs.readFileSync(new URL('../routes/cycle.routes.js', import.meta.url), 'utf8');
    assert.match(src, /resolveCarePlanPlaceFields,/);
    assert.match(src, /plannedPlace: data\.plannedPlace/);
  });
});
