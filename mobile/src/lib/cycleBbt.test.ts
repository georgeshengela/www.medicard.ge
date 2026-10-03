import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BBT_COUNT,
  BBT_DEFAULT,
  BBT_MAX,
  BBT_MIN,
  bbtAt,
  bbtFromForm,
  bbtIndex,
  bbtStorage,
  bbtValues,
  clampBbt,
  formatBbt,
  lastLoggedBbt,
  roundBbt,
  spokenBbt,
  stepBbt,
  wheelStart,
} from './cycleBbt.ts';

test('the wheel holds 35.50 … 38.00 in 0.05 steps, without float noise', () => {
  const values = bbtValues();
  assert.equal(BBT_COUNT, 51);
  assert.equal(values.length, 51);
  assert.equal(values[0], 35.5);
  assert.equal(values[50], 38);
  assert.equal(values[21], 36.55);
  for (const v of values) assert.ok(Math.abs(v * 100 - Math.round(v * 100)) < 1e-9, `${v} has more than two decimals`);
});

test('clamp, round and index agree', () => {
  assert.equal(clampBbt(34), BBT_MIN);
  assert.equal(clampBbt(40), BBT_MAX);
  assert.equal(clampBbt(Number.NaN), BBT_DEFAULT);
  assert.equal(roundBbt(36.63), 36.65);
  assert.equal(roundBbt(36.62), 36.6);
  assert.equal(roundBbt(34.9), 35.5);
  assert.equal(roundBbt(38.4), 38);
  assert.equal(bbtIndex(36.5), 20);
  assert.equal(bbtAt(bbtIndex(37.15)), 37.15);
  assert.equal(bbtAt(-3), 35.5);
  assert.equal(bbtAt(99), 38);
  assert.equal(stepBbt(36.5, 1), 36.55);
  assert.equal(stepBbt(36.5, -1), 36.45);
  assert.equal(stepBbt(38, 1), 38);
  assert.equal(stepBbt(35.5, -1), 35.5);
});

test('storage keeps the shape parseBbt reads; the form string round-trips', () => {
  assert.equal(bbtStorage(36.5), '36.50');
  assert.equal(bbtStorage(36.55), '36.55');
  assert.equal(bbtFromForm('36.55'), 36.55);
  assert.equal(bbtFromForm('36,6'), 36.6);
  assert.equal(bbtFromForm(''), null);
  assert.equal(bbtFromForm('  '), null);
  assert.equal(bbtFromForm('abc'), null);
  assert.equal(bbtFromForm(undefined), null);
});

test('format and spoken value', () => {
  assert.equal(formatBbt(36.55, 'ka'), '36.55°');
  assert.equal(formatBbt(36.5, 'en'), '36.50°');
  assert.equal(spokenBbt(36.55, 'en'), '36.55 degrees Celsius');
  assert.match(spokenBbt(36.55, 'ka'), /^36\.55 გრადუსი/);
});

test('the wheel starts at the day value, else the last BBT before the day, else 36.50', () => {
  const logs = [
    { date: '2026-09-28', bbt: 36.41 },
    { date: '2026-09-30', bbt: 36.72 },
    { date: '2026-10-01', bbt: null },
    { date: '2026-10-03', bbt: 36.9 },
    { date: '2026-10-05', bbt: 37.1 },
  ];
  assert.equal(lastLoggedBbt(logs, '2026-10-02'), 36.7);
  assert.equal(lastLoggedBbt(logs, '2026-10-03'), 36.7, 'the day itself never counts as „last“');
  assert.equal(lastLoggedBbt(logs, '2026-09-01'), 37.1, 'nothing before → the most recent at all');
  assert.equal(lastLoggedBbt([], '2026-10-02'), null);
  assert.equal(lastLoggedBbt(null, '2026-10-02'), null);
  assert.equal(wheelStart('36.63', 36.2), 36.65);
  assert.equal(wheelStart('', 36.2), 36.2);
  assert.equal(wheelStart('', null), 36.5);
});
