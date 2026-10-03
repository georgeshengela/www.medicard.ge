import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deviationCopy, deviationFindingLine, deviationLines, deviationRuleLines } from './cycleDeviationCopy.ts';
import { buildCycleDeviations } from '../../../server/src/lib/cycleDeviations.js';
import { addDays, inferCycleStats } from '../../../server/src/lib/cycle.js';

/** Names of conditions the card must never say (it states facts only). */
const CONDITION_WORDS = ['PCOS', 'პოლიკისტ', 'ენდომეტრიოზ', 'ამენორე', 'მენორაგ', 'მიომ', 'პოლიპ', 'ჰიპოთირეოზ', 'დარღვევა', 'დაავადება', 'სინდრომ'];

test('irregular line carries her numbers', () => {
  assert.equal(
    deviationFindingLine({ id: 'irregular', shortestDays: 22, longestDays: 41, spreadDays: 19, cycles: 5 }),
    'ბოლო 6 თვეში ციკლის სიგრძე 22-დან 41 დღემდე მერყეობს.',
  );
});

test('infrequent, prolonged and spotting lines', () => {
  assert.equal(deviationFindingLine({ id: 'infrequent', periods: 1 }), 'ბოლო 6 თვეში მხოლოდ ერთი მენსტრუაცია აღირიცხა.');
  assert.equal(deviationFindingLine({ id: 'infrequent', periods: 2 }), 'ბოლო 6 თვეში მხოლოდ ორი მენსტრუაცია აღირიცხა.');
  assert.equal(
    deviationFindingLine({ id: 'prolonged', periods: 2, longestDays: 12 }),
    'ბოლო 6 თვეში მენსტრუაცია 2-ჯერ გაგრძელდა 10 ან მეტი დღე (ყველაზე გრძელი — 12 დღე).',
  );
  assert.equal(deviationFindingLine({ id: 'spotting', cycles: 3, days: 4 }), 'ბოლო 6 თვეში ლაქები მენსტრუაციებს შორის 3 ციკლში აღინიშნა.');
});

test('lines follow a fixed order; null / empty / unknown ids → no lines (no card)', () => {
  const lines = deviationLines({
    version: 1,
    windowDays: 180,
    from: '2026-04-07',
    to: '2026-10-03',
    rulesOff: [],
    findings: [
      { id: 'spotting', cycles: 2, days: 2 },
      { id: 'future_rule' } as never,
      { id: 'irregular', shortestDays: 24, longestDays: 44, spreadDays: 20, cycles: 4 },
    ],
  });
  assert.equal(lines.length, 2);
  assert.match(lines[0], /24-დან 44/);
  assert.match(lines[1], /ლაქები/);
  assert.deepEqual(deviationLines(null), []);
  assert.deepEqual(deviationLines(undefined), []);
  assert.deepEqual(deviationLines({ version: 1, windowDays: 180, from: '', to: '', rulesOff: [], findings: [] }), []);
});

test('the doctor sentence and title are exact', () => {
  assert.equal(deviationCopy.title(), 'შენს ციკლში ცვლილება შევნიშნეთ');
  assert.equal(deviationCopy.doctorLine(), 'ეს დიაგნოზი არ არის — ესაუბრე ექიმს, თუ გაწუხებს.');
});

test('explain sheet: four rules in plain words; perimenopause drops the length rule and says why', () => {
  assert.equal(deviationRuleLines().length, 4);
  assert.equal(deviationRuleLines(true).length, 3);
  assert.ok(!deviationRuleLines(true).some((l) => l.startsWith('ციკლის სიგრძე')));
  const peri = deviationCopy.explainBody(['irregular']).join(' ');
  assert.match(peri, /პერიმენოპაუზის რეჟიმში/);
  assert.doesNotMatch(deviationCopy.explainBody([]).join(' '), /პერიმენოპაუზის რეჟიმში/);
  assert.match(deviationCopy.explainBody().join(' '), /90 დღის/);
});

test('no condition names, no „ინსაითი“/„პატერნი“, flow word is never „გამონადენი“', () => {
  const all = [
    deviationCopy.title(),
    deviationCopy.doctorLine(),
    ...deviationCopy.explainBody(['irregular']),
    ...deviationCopy.explainBody([]),
    deviationFindingLine({ id: 'irregular', shortestDays: 22, longestDays: 41, spreadDays: 19, cycles: 5 }),
    deviationFindingLine({ id: 'infrequent', periods: 2 }),
    deviationFindingLine({ id: 'prolonged', periods: 2, longestDays: 12 }),
    deviationFindingLine({ id: 'spotting', cycles: 2, days: 2 }),
  ].join(' ');
  for (const word of [...CONDITION_WORDS, 'ინსაით', 'პატერნ', 'გამონადენ']) assert.ok(!all.includes(word), word);
});

test('server → app: the real server output becomes the card lines', () => {
  const today = '2026-10-03';
  const gaps = [28, 28, 22, 41, 30, 25, 33];
  const starts = [addDays(today, -10)];
  for (let i = gaps.length - 1; i >= 0; i -= 1) starts.unshift(addDays(starts[0], -gaps[i]));
  const logs = starts.flatMap((s) => [0, 1, 2, 3, 4].map((d) => ({ date: addDays(s, d), flow: 'medium' })));
  const deviations = buildCycleDeviations({ today, periodRanges: inferCycleStats(logs).periodRanges, logs });
  assert.deepEqual(deviationLines(deviations), ['ბოლო 6 თვეში ციკლის სიგრძე 22-დან 41 დღემდე მერყეობს.']);
});
