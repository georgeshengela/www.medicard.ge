import test from 'node:test';
import assert from 'node:assert/strict';
import { phoneCountry, presenceCountries } from './sitePresence.js';

test('phone numbers map to their country by the longest dial code', () => {
  assert.equal(phoneCountry('+995 555 12 34 56'), 'GE');
  assert.equal(phoneCountry('+32470123456'), 'BE');
  assert.equal(phoneCountry('+380501234567'), 'UA');
  assert.equal(phoneCountry('+3741'), 'AM');
  assert.equal(phoneCountry('+12025550123'), 'US');
  assert.equal(phoneCountry('555123456'), null);
  assert.equal(phoneCountry(''), null);
});

test('presence merges location and phone countries, unique and sorted, codes only', () => {
  assert.deepEqual(presenceCountries(['be', 'BE', null, 'xxx'], ['+9955', '+3247', 'bad']), ['BE', 'GE']);
  assert.deepEqual(presenceCountries([], []), []);
});
