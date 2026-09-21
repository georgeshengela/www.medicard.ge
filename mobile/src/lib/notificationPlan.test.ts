import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  medicationCourseIncludesDate,
  expoWeekdayFromMonday,
  isEveryWeekday,
  planMedicationReminderSlots,
  prefixForNotificationId,
  routeFromNotificationData,
} from './notificationPlan.ts';

describe('notificationPlan', () => {
  it('maps Monday-index weekdays to Expo Sunday-first weekdays', () => {
    assert.equal(expoWeekdayFromMonday(0), 2);
    assert.equal(expoWeekdayFromMonday(5), 7);
    assert.equal(expoWeekdayFromMonday(6), 1);
  });

  it('treats empty or full week as every day', () => {
    assert.equal(isEveryWeekday(undefined), true);
    assert.equal(isEveryWeekday([]), true);
    assert.equal(isEveryWeekday([0, 1, 2, 3, 4, 5, 6]), true);
    assert.equal(isEveryWeekday([0, 2, 4]), false);
  });

  it('plans one daily slot when every weekday is selected', () => {
    const slots = planMedicationReminderSlots('med-1', '09:30', [0, 1, 2, 3, 4, 5, 6]);
    assert.deepEqual(slots, [{ identifier: 'med-1:09:30', hour: 9, minute: 30 }]);
  });

  it('plans weekly slots only for selected days', () => {
    const slots = planMedicationReminderSlots('med-1', '21:00', [0, 2]);
    assert.equal(slots.length, 2);
    assert.equal(slots[0]?.weekday, 2);
    assert.equal(slots[1]?.weekday, 4);
    assert.equal(slots[0]?.identifier, 'med-1:21:00:0');
  });

  it('routes taps to the matching screen', () => {
    assert.equal(routeFromNotificationData({ type: 'medication', medicationId: 'abc' }), '/medications/abc');
    assert.equal(routeFromNotificationData({ type: 'weight-goal' }), '/health-metrics/weight');
    assert.equal(routeFromNotificationData({ type: 'steps-goal' }), '/health-metrics/steps');
    assert.equal(routeFromNotificationData({ type: 'visit_reminder' }), '/visits');
    assert.equal(routeFromNotificationData({ type: 'visit_reminder', visitId: 'v9' }), '/visits/editor?id=v9');
    assert.equal(routeFromNotificationData({ type: 'quota_reset' }), '/chat/DOCTOR');
    assert.equal(routeFromNotificationData({ type: 'cycle_tip' }), '/cycle');
    assert.equal(routeFromNotificationData({ type: 'cycle_reminder', route: '/cycle/log' }), '/cycle/log');
    assert.equal(routeFromNotificationData({ type: 'admin_push', route: '/(tabs)/home' }), '/(tabs)/home');
    assert.equal(routeFromNotificationData({ type: 'medi_engage', route: '/week' }), '/week');
    assert.equal(routeFromNotificationData({ type: 'medi_engage', family: 'hydration' }), '/health-metrics/hydration');
    assert.equal(
      routeFromNotificationData({
        type: 'pet_care',
        route: '/pets/abc/care/complete?scheduleId=s',
      }),
      '/pets/abc/care/complete?scheduleId=s',
    );
    assert.equal(routeFromNotificationData({ type: 'pet_care', petId: 'abc' }), '/pets/abc/care');
  });

  it('classifies scheduled identifiers', () => {
    assert.equal(prefixForNotificationId('med:1:09:00'), 'med');
    assert.equal(prefixForNotificationId('weight:goal:1'), 'weight');
    assert.equal(prefixForNotificationId('engage:weekly:2026-09-06'), 'engage');
    assert.equal(prefixForNotificationId('quota:reset'), 'quota');
    assert.equal(prefixForNotificationId('qa:medication:1'), 'qa');
    assert.equal(prefixForNotificationId('pets:user:pet:sched:r1|2026-09-20|date|0:due'), 'pets');
  });
});

describe('finite medication courses', () => {
  it('schedules exactly 14 local days, without a repeating trigger', () => {
    const slots = planMedicationReminderSlots('course', '09:00', undefined, { startDate:'2026-09-21', endDate:'2026-10-04' },new Date(2026,8,20,12));
    assert.equal(slots.length,14); assert.ok(slots.every(s=>s.date && !s.weekday));
    assert.equal(slots.at(-1)?.date?.getDate(),4);
  });
  it('never schedules elapsed or expired doses, and honors selected weekdays', () => {
    assert.equal(planMedicationReminderSlots('course','09:00',undefined,{startDate:'2026-09-01',endDate:'2026-09-20'},new Date(2026,8,21,12)).length,0);
    const slots=planMedicationReminderSlots('course','09:00',[0],{startDate:'2026-09-21',endDate:'2026-10-04'},new Date(2026,8,21,12));
    assert.equal(slots.length,1); assert.equal(slots[0].date?.getDate(),28);
  });
  it('rejects invalid dates/times and preserves local hour across daylight saving', () => {
    assert.equal(planMedicationReminderSlots('c','29:70').length,0);
    assert.equal(planMedicationReminderSlots('c','09:00',undefined,{endDate:'2026-02-30'}).length,0);
    const slots=planMedicationReminderSlots('c','09:00',undefined,{startDate:'2026-10-24',endDate:'2026-10-27'},new Date(2026,9,23,12));
    assert.equal(slots.length,4); assert.ok(slots.every(s=>s.date?.getHours()===9));
  });
});

it('home and calendar only show doses inside the inclusive course',()=>{
  const course={startDate:'2026-09-21',endDate:'2026-10-04'};
  assert.equal(medicationCourseIncludesDate(course,'2026-09-20'),false);
  assert.equal(medicationCourseIncludesDate(course,'2026-09-21'),true);
  assert.equal(medicationCourseIncludesDate(course,'2026-10-04'),true);
  assert.equal(medicationCourseIncludesDate(course,'2026-10-05'),false);
});
