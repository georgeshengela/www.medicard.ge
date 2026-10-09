import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import {
  NOTIFICATION_ROUTE_ROOTS,
  canOpenNotificationRoute,
  isNotificationRoute,
  medicationCourseIncludesDate,
  notificationResponseKey,
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
    assert.equal(routeFromNotificationData({ type: 'quota_reset' }), '/assistant?mode=doctor');
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

describe('notification taps and routes', () => {
  it('holds a tapped notification until the signed-in shell has mounted', () => {
    const ready = { appReady: true, signedIn: true, segments: ['(tabs)', 'home'] };
    assert.equal(canOpenNotificationRoute(ready), true);
    assert.equal(canOpenNotificationRoute({ ...ready, appReady: false }), false);
    assert.equal(canOpenNotificationRoute({ ...ready, signedIn: false }), false);
    assert.equal(canOpenNotificationRoute({ ...ready, segments: [] }), false);
    assert.equal(canOpenNotificationRoute({ ...ready, segments: ['(auth)', 'assessment'] }), false);
  });

  it('keys the launch response and the listener callback for one tap the same way', () => {
    const tap = { actionIdentifier: 'expo.modules.notifications.actions.DEFAULT', notification: { date: 1700000000, request: { identifier: 'engage:weekly' } } };
    assert.equal(notificationResponseKey(tap), notificationResponseKey({ ...tap }));
    assert.notEqual(notificationResponseKey(tap), notificationResponseKey({ ...tap, actionIdentifier: 'OK' }));
    assert.equal(routeFromNotificationData({ type: 'medi_engage', family: 'weekly' }), '/week');
  });

  it('knows every top-level screen in mobile/app', () => {
    const screens = readdirSync(new URL('../../app/', import.meta.url))
      .map((name) => name.replace(/\.tsx$/, ''))
      // `+native-intent` etc. are expo-router hooks, not screens.
      .filter((name) => !['_layout', 'index', '(auth)'].includes(name) && !name.startsWith('+'));
    assert.deepEqual([...new Set(screens)].sort(), [...NOTIFICATION_ROUTE_ROOTS].sort());
  });

  it('never follows a mistyped or foreign route from a notification', () => {
    assert.equal(isNotificationRoute('/community?post=abc'), true);
    assert.equal(isNotificationRoute('/(tabs)/profile?action=question'), true);
    assert.equal(isNotificationRoute('/comunity'), false);
    assert.equal(isNotificationRoute('//evil.example'), false);
    assert.equal(isNotificationRoute('/(auth)/sign-in'), false);
    assert.equal(routeFromNotificationData({ type: 'admin_broadcast', route: '/comunity' }), '/(tabs)/home');
    assert.equal(routeFromNotificationData({ type: 'admin_broadcast' }), null);
    assert.equal(routeFromNotificationData({ type: 'pet_care', petId: 'p1', route: '/typo' }), '/pets/p1/care');
  });
});

it('a long running course repeats daily/weekly instead of running out of dated reminders', () => {
  const now = new Date(2026, 9, 2, 12);
  const daily = planMedicationReminderSlots('m', '09:00', undefined, { startDate: '2026-10-02', endDate: '2027-10-02' }, now);
  assert.deepEqual(daily.map((slot) => [slot.identifier, slot.date]), [['m:09:00', undefined]]);
  const weekly = planMedicationReminderSlots('m', '09:00', [0, 3], { startDate: '2026-09-01', endDate: '2027-09-01' }, now);
  assert.equal(weekly.length, 2);
  assert.ok(weekly.every((slot) => slot.weekday != null && !slot.date));
  // Near the end the course switches back to dated reminders that stop on the last day.
  const ending = planMedicationReminderSlots('m', '09:00', undefined, { startDate: '2026-01-01', endDate: '2026-10-20' }, now);
  assert.ok(ending.length > 0 && ending.every((slot) => slot.date));
});
