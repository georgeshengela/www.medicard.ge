import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
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
    assert.equal(routeFromNotificationData({ type: 'cycle_tip' }), '/cycle');
    assert.equal(routeFromNotificationData({ type: 'cycle_reminder', route: '/cycle/log' }), '/cycle/log');
    assert.equal(routeFromNotificationData({ type: 'admin_push', route: '/(tabs)/home' }), '/(tabs)/home');
    assert.equal(routeFromNotificationData({ type: 'medi_engage', route: '/week' }), '/week');
    assert.equal(routeFromNotificationData({ type: 'medi_engage', family: 'hydration' }), '/health-metrics/hydration');
  });

  it('classifies scheduled identifiers', () => {
    assert.equal(prefixForNotificationId('med:1:09:00'), 'med');
    assert.equal(prefixForNotificationId('weight:goal:1'), 'weight');
    assert.equal(prefixForNotificationId('engage:weekly:2026-09-06'), 'engage');
    assert.equal(prefixForNotificationId('qa:medication:1'), 'qa');
  });
});
