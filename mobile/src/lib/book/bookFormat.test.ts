/**
 * A phone in Europe/Brussels (UTC+2 in October) books at a Georgian business: every clock and day must be
 * Tbilisi's (fixed UTC+4) — the label the slot carried — whatever the phone's own zone says. On 2026-10-15 the
 * owner picked „11:30“ from Belgium and read „ხვალ · 09:30“; this pins the rule.
 */
process.env.TZ = 'Europe/Brussels';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { BookHours } from './bookTypes.ts';

const { addDays, clockOf, dayLabel, monthDay, tbilisiWeekday, tbilisiYmd, todayHoursLine, weekHours, weekdayOfYmd, weekdayShort, whenLabel } = await import('./bookFormat.ts');

const NOW = new Date('2026-10-15T10:00:00Z'); // Thursday: 14:00 in Tbilisi, 12:00 in Brussels
const PICK = '2026-10-16T07:30:00.000Z'; // the 11:30 slot on Friday in Tbilisi — 09:30 on a Brussels phone
const LATE = '2026-10-15T20:30:00.000Z'; // 22:30 on the 15th in Brussels, already 00:30 on the 16th in Tbilisi

test('the phone really runs in Brussels (the premise of this file)', () => {
  assert.equal(new Date(PICK).getHours(), 9);
});

test('the clock is the slot the person picked, never the phone’s', () => {
  assert.equal(clockOf(PICK), '11:30');
  assert.equal(clockOf(new Date(PICK)), '11:30');
  assert.equal(clockOf(LATE), '00:30');
  assert.equal(whenLabel(PICK, NOW), 'ხვალ · 11:30');
});

test('the day is Tbilisi’s day', () => {
  assert.equal(tbilisiYmd(PICK), '2026-10-16');
  assert.equal(tbilisiYmd(LATE), '2026-10-16');
  assert.equal(tbilisiWeekday(LATE), 5);
  assert.equal(dayLabel(LATE, NOW), 'ხვალ');
  // „now“ crosses midnight in Tbilisi first: at 20:30Z the 11:30 booking is already today.
  assert.equal(dayLabel(PICK, new Date(LATE)), 'დღეს');
  assert.equal(dayLabel('2026-10-14T07:30:00.000Z', NOW), 'გუშინ');
  assert.equal(dayLabel('2026-10-19T07:30:00.000Z', NOW), 'ორშ, 19 ოქტ');
});

test('a civil day from the strip or the waiting list is read as it is', () => {
  assert.equal(dayLabel('2026-10-16', NOW), 'ხვალ');
  assert.equal(dayLabel('2026-10-16', new Date(LATE)), 'დღეს');
  assert.equal(weekdayShort('2026-10-16'), 'პარ');
  assert.equal(weekdayOfYmd('2026-10-18'), 0);
  assert.equal(monthDay('2026-10-16'), '16 ოქტ');
  assert.equal(addDays('2026-10-31', 1), '2026-11-01');
  assert.equal(addDays('2026-10-16', -5), '2026-10-11');
  assert.equal(addDays('2026-03-29', 1), '2026-03-30'); // the Brussels DST day does not drift
});

test('opening hours mark Tbilisi’s today', () => {
  const hours: BookHours = { '4': [{ from: '10:00', to: '19:00' }], '5': [{ from: '09:00', to: '14:00' }] };
  assert.equal(todayHoursLine(hours, NOW), 'დღეს 10:00–19:00');
  assert.equal(todayHoursLine(hours, new Date(LATE)), 'დღეს 09:00–14:00');
  assert.deepEqual(weekHours(hours, new Date(LATE)).filter((r) => r.today).map((r) => r.day), ['პარასკევი']);
});
