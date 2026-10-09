import { test } from 'node:test';
import assert from 'node:assert/strict';
import { medicationReminderNotice } from './medicationReminderNotice.ts';

const base = { permission: 'denied' as const, activeMedications: 1, remindersOn: true, native: true };

test('notifications denied with an active medication: open Settings', () => {
  assert.equal(medicationReminderNotice(base), 'settings');
});

test('the OS question was never asked: the one-button primer, never Settings', () => {
  assert.equal(medicationReminderNotice({ ...base, permission: 'undetermined' }), 'primer');
});

test('nothing to say when reminders can arrive or there is nothing to remind about', () => {
  assert.equal(medicationReminderNotice({ ...base, permission: 'granted' }), 'none');
  // Not read yet: no flash of a note that may be wrong.
  assert.equal(medicationReminderNotice({ ...base, permission: null }), 'none');
  // Only paused medications (or none): no reminder is due anyway.
  assert.equal(medicationReminderNotice({ ...base, activeMedications: 0 }), 'none');
  // She turned medication reminders off herself (Profile → შეტყობინებები): that is her choice, not a fault.
  assert.equal(medicationReminderNotice({ ...base, remindersOn: false }), 'none');
  assert.equal(medicationReminderNotice({ ...base, permission: 'undetermined', remindersOn: false }), 'none');
  // The web build has no local reminders.
  assert.equal(medicationReminderNotice({ ...base, native: false }), 'none');
});
