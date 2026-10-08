const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const loader = require('./helpers/loadTs.cjs');

// She taps „მივიღე“ on Home and then the undo: Home writes status „pending“ (the web undo writes the
// same). The calendar drew that day as a green „taken“ day and the schedule list hid the dose's
// Take / Reschedule / Skip as if it was answered. Only taken/skipped answer a dose.
const root = join(__dirname, '..');
const load = loader();
const dose = load('src/lib/doseAnswer.ts');
const row = (status) => ({ medicationId: 'm1', date: '2026-10-08', time: '09:00', status, updatedAt: '2026-10-08T05:00:00.000Z' });

test('an undone („pending“) dose does not answer it', () => {
  assert.equal(dose.isDoseAnswered(row('pending')), false);
  assert.equal(dose.isDoseAnswered(undefined), false);
  assert.equal(dose.isDoseAnswered(row('taken')), true);
  assert.equal(dose.isDoseAnswered(row('skipped')), true);
});

test('a day with only an undone dose is not green in the calendar', () => {
  assert.equal(dose.calendarDayStatus([row('pending')]), null);
  assert.equal(dose.calendarDayStatus([row('pending'), row('pending')]), null);
  assert.equal(dose.calendarDayStatus([]), null);
});

test('taken, skipped and mixed days keep their marks; undone rows never change them', () => {
  assert.equal(dose.calendarDayStatus([row('taken')]), 'taken');
  assert.equal(dose.calendarDayStatus([row('taken'), row('pending')]), 'taken');
  assert.equal(dose.calendarDayStatus([row('skipped'), row('pending')]), 'skipped');
  assert.equal(dose.calendarDayStatus([row('taken'), row('skipped')]), 'mixed');
});

test('the calendar and the schedule list read the same rule', () => {
  const calendar = readFileSync(join(root, 'app/medications/reminders/calendar.tsx'), 'utf8');
  assert.match(calendar, /calendarDayStatus\(logs\)/);
  assert.doesNotMatch(calendar, /skipped \? 'skipped' : 'taken'\);/, 'no „everything else is taken“ fallback');

  const list = readFileSync(join(root, 'app/medications/reminders/index.tsx'), 'utf8');
  assert.match(list, /const log = isDoseAnswered\(found\) \? found : undefined;/, 'an undone dose gets its buttons back');
  assert.match(list, /const loggedCount = dayDoses\.filter\(\(dose\) => isDoseAnswered\(/, 'an undone dose is not counted as logged');
  assert.match(list, /answeredStatuses\(/, 'the week strip ignores undone doses');
});
