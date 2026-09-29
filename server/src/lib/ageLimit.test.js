import test from 'node:test';
import assert from 'node:assert/strict';
import { birthDateAgeError, birthDateInputSchema, birthDateSchema, MIN_USER_AGE, MIN_USER_AGE_MESSAGE } from './patient.js';

const ymd = (d) => d.toISOString().slice(0, 10);
const yearsAgo = (n, extraDays = 0) => {
  const d = new Date();
  d.setUTCFullYear(d.getUTCFullYear() - n);
  d.setUTCDate(d.getUTCDate() + extraDays);
  return ymd(d);
};

test('accounts are 18+: an adult passes, a 17-year-old is refused with a clear message', () => {
  assert.equal(MIN_USER_AGE, 18);
  assert.ok(birthDateSchema.safeParse(yearsAgo(30)).success);
  assert.ok(birthDateSchema.safeParse(yearsAgo(18, -1)).success); // 18th birthday was yesterday
  const minor = birthDateSchema.safeParse(yearsAgo(18, 2)); // turns 18 in two days
  assert.equal(minor.success, false);
  assert.ok(minor.error.issues.some((i) => i.message === MIN_USER_AGE_MESSAGE));
  assert.equal(birthDateSchema.safeParse(yearsAgo(12)).success, false);
});

test('the other birth-date rules still apply', () => {
  assert.equal(birthDateSchema.safeParse(yearsAgo(130)).success, false);
  assert.equal(birthDateSchema.safeParse('2001-02-30').success, false);
});

test('edits: a stored under-18 date does not block unrelated saves, a new one is refused', () => {
  const minor = birthDateInputSchema.parse(yearsAgo(15));
  const adult = birthDateInputSchema.parse(yearsAgo(40));
  // Account created before the rule re-sends its stored date with an unrelated change.
  assert.equal(birthDateAgeError(minor, new Date(`${yearsAgo(15)}T00:00:00.000Z`)), null);
  assert.equal(birthDateAgeError(undefined, null), null);
  // Setting or changing to an under-18 date is refused; an adult date is fine.
  assert.equal(birthDateAgeError(minor, null), MIN_USER_AGE_MESSAGE);
  assert.equal(birthDateAgeError(minor, new Date(`${yearsAgo(40)}T00:00:00.000Z`)), MIN_USER_AGE_MESSAGE);
  assert.equal(birthDateAgeError(adult, null), null);
});

test('the 18+ message is English for English requests', () => {
  const minor = new Date(`${yearsAgo(15)}T00:00:00.000Z`);
  assert.equal(birthDateAgeError(minor, null, 'en'), 'You must be 18 or older to use MEDICARD.');
});
