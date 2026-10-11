import assert from 'node:assert/strict';
import { test } from 'node:test';
import { claimInLedger, isBackgroundAction, taskNotificationResponse } from './notificationTaps.ts';

const DAY = 24 * 60 * 60 * 1000;

test('a background button is claimed once per tap; other taps and old claims do not block it', () => {
  const now = Date.parse('2026-10-11T08:00:00Z');
  const first = claimInLedger(null, 'med:a|1|TAKE', now);
  assert.equal(first.claimed, true);
  assert.equal(claimInLedger(first.next, 'med:a|1|TAKE', now + 1_000).claimed, false);
  assert.equal(claimInLedger(first.next, 'med:a|2|TAKE', now + 1_000).claimed, true);
  assert.equal(claimInLedger(first.next, 'med:a|1|TAKE', now + 3 * DAY).claimed, true);
});

test('the ledger stays small and survives unreadable storage', () => {
  const now = Date.parse('2026-10-11T08:00:00Z');
  let raw: string | null = null;
  for (let i = 0; i < 80; i += 1) raw = claimInLedger(raw, `k${i}`, now + i).next;
  assert.equal(JSON.parse(raw as string).length, 60);
  assert.equal(claimInLedger(raw, 'k79', now + 100).claimed, false);
  assert.equal(claimInLedger('not json', 'k', now).claimed, true);
  assert.equal(claimInLedger('[["k", "x"], 5, null]', 'k', now).claimed, true);
});

test('Android task payload: a background button becomes the listener response, data parsed', () => {
  const data = { type: 'medication', medicationId: 'm1', time: '08:00', owner: 'u1' };
  const response = taskNotificationResponse({
    actionIdentifier: 'TAKE',
    notification: {
      date: 1_760_000_000_000,
      request: { identifier: 'med:m1:08:00', trigger: { type: 'daily' }, content: { title: 'წამალი', dataString: JSON.stringify(data) } },
    },
  });
  assert.ok(response);
  assert.equal(response.actionIdentifier, 'TAKE');
  assert.equal(response.notification.date, 1_760_000_000_000);
  assert.equal(response.notification.request.identifier, 'med:m1:08:00');
  assert.deepEqual(response.notification.request.content.data, data);
  assert.equal(response.notification.request.content.title, 'წამალი');
});

test('Android task payload: a received push, a button that opens the app or junk is not a background tap', () => {
  assert.equal(taskNotificationResponse({ data: { body: '{}' } }), null);
  assert.equal(taskNotificationResponse({ actionIdentifier: 'CHAT', notification: {} }), null);
  assert.equal(taskNotificationResponse({ actionIdentifier: 'expo.modules.notifications.actions.DEFAULT' }), null);
  assert.equal(taskNotificationResponse(null), null);
  assert.equal(taskNotificationResponse('TAKE'), null);
  const broken = taskNotificationResponse({ actionIdentifier: 'DRANK', notification: { request: { content: { dataString: '{' } } } });
  assert.deepEqual(broken?.notification.request.content.data, {});
  assert.equal(isBackgroundAction('SNOOZE'), true);
  assert.equal(isBackgroundAction('PET_DONE'), false);
});
