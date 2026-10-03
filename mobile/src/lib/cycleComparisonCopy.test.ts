import { test } from 'node:test';
import assert from 'node:assert/strict';
import { comparisonA11y, comparisonLine, comparisonRows, comparisonStartLabel } from './cycleComparisonCopy.ts';

const cmp = (lengths: number[], usual: number | null, periodDays = 5) => ({
  cycles: lengths.map((length, i) => ({ start: `2026-0${i + 1}-0${i + 1}`, length, periodDays, latest: i === lengths.length - 1 })),
  latestDays: lengths[lengths.length - 1],
  usualDays: usual,
  diffDays: usual == null ? null : lengths[lengths.length - 1] - usual,
});

test('longer than her usual: the brief’s sentence, her own median only', () => {
  assert.equal(comparisonLine(cmp([28, 27, 29, 28, 31], 28)), 'ბოლო ციკლი 31 დღე იყო — შენს ჩვეულზე (28) 3 დღით გრძელი');
});

test('shorter and equal', () => {
  assert.equal(comparisonLine(cmp([30, 31, 29, 26], 30)), 'ბოლო ციკლი 26 დღე იყო — შენს ჩვეულზე (30) 4 დღით მოკლე');
  assert.equal(comparisonLine(cmp([28, 29, 28], 28)), 'ბოლო ციკლი 28 დღე იყო — შენი ჩვეულის (28) ტოლი');
});

test('never a verdict or a population norm', () => {
  for (const line of [comparisonLine(cmp([28, 27, 45], 28)), comparisonLine(cmp([28, 27, 21], 28))]) {
    assert.doesNotMatch(String(line), /ნორმ|ტიპურ|არარეგულარ|ანომალ|normal|typical|irregular/i);
  }
});

test('two cycles: the length, and when the comparison starts', () => {
  assert.equal(comparisonLine(cmp([28, 31], null)), 'ბოლო ციკლი 31 დღე იყო. შენს ჩვეულს 3 ციკლიდან შევადარებთ.');
});

test('no data, one cycle: nothing', () => {
  assert.equal(comparisonLine(null), null);
  assert.equal(comparisonLine(cmp([28], null)), null);
  assert.deepEqual(comparisonRows(cmp([28], null)), []);
});

test('rows: newest first, one scale, period share of each bar', () => {
  const rows = comparisonRows(cmp([28, 56, 35], 42, 7));
  assert.deepEqual(rows.map((r) => r.length), [35, 56, 28]);
  assert.equal(rows[0].latest, true);
  assert.equal(rows[1].widthRatio, 1);
  assert.equal(rows[2].widthRatio, 0.5);
  assert.equal(rows[2].periodRatio, 0.25);
  assert.equal(rows[1].periodDays, 7);
});

test('rows keep at most six cycles and clamp period days to the cycle', () => {
  const many = cmp([28, 29, 30, 31, 32, 33, 34], 31, 40);
  const rows = comparisonRows(many);
  assert.equal(rows.length, 6);
  assert.equal(rows.at(-1)!.length, 29);
  assert.ok(rows.every((r) => r.periodDays <= r.length && r.periodRatio <= 1));
});

test('labels and the screen-reader summary', () => {
  assert.equal(comparisonStartLabel('2026-09-08'), '8 სექ');
  const a11y = comparisonA11y(comparisonRows(cmp([28, 31], null)));
  assert.match(a11y, /31 დღე, მენსტრუაცია 5 დღე/);
});
