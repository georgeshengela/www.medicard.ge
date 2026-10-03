// „საშუალოდან დამალვა“ (W3-2) — what the history list shows and what the one-tap toggle sends.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  MAX_HIDDEN_CYCLES,
  canToggleHiddenCycle,
  hiddenCycleCount,
  hiddenCyclesOf,
  isCycleHidden,
  nextHiddenCycles,
} from './cycleHiddenCycles.ts';
// @ts-expect-error — plain JS module, node test only
import { buildCycleReportHtmlFromSummary, doctorExcludedCycleLabel, doctorReportFactIds } from './cycleDoctorSummaryI18n.js';

const starts = ['2026-06-01', '2026-06-29', '2026-07-27', '2026-08-24'];
const bundle = (hidden: string[] | undefined) => ({
  profile: hidden === undefined ? {} : { hiddenCycles: hidden },
  inferred: { periodStarts: starts },
  periodRanges: starts.map((start) => ({ start, hidden: (hidden ?? []).includes(start) })),
});

describe('hidden cycles helpers', () => {
  it('reads the confirmed list (profile and the range marks), sorted and unique', () => {
    assert.deepEqual(hiddenCyclesOf(bundle(['2026-07-27', '2026-06-29'])), ['2026-06-29', '2026-07-27']);
    assert.deepEqual(hiddenCyclesOf({ profile: {}, periodRanges: [{ start: '2026-06-01', hidden: true }] }), ['2026-06-01']);
    assert.deepEqual(hiddenCyclesOf(null), []);
    assert.equal(hiddenCycleCount(bundle(['2026-06-29'])), 1);
    assert.equal(isCycleHidden(bundle(['2026-06-29']), '2026-06-29'), true);
    assert.equal(isCycleHidden(bundle(['2026-06-29']), '2026-06-01'), false);
  });

  it('one tap adds or removes exactly that start', () => {
    assert.deepEqual(nextHiddenCycles(['2026-07-27'], '2026-06-29', true), ['2026-06-29', '2026-07-27']);
    assert.deepEqual(nextHiddenCycles(['2026-06-29', '2026-07-27'], '2026-06-29', false), ['2026-07-27']);
    assert.deepEqual(nextHiddenCycles(['2026-06-29'], '2026-06-29', true), ['2026-06-29']);
  });

  it('the toggle shows only for logged starts the server knows about, within the cap', () => {
    assert.equal(canToggleHiddenCycle(bundle([]), '2026-06-29'), true);
    assert.equal(canToggleHiddenCycle(bundle([]), '2026-06-30'), false, 'not a logged start');
    assert.equal(canToggleHiddenCycle(bundle(undefined), '2026-06-29'), false, 'an older server: no toggle');
    const many = Array.from({ length: MAX_HIDDEN_CYCLES }, (_, i) => `2024-${String((i % 12) + 1).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`);
    const full = { profile: { hiddenCycles: many }, inferred: { periodStarts: [...many, '2026-06-29'] }, periodRanges: [] };
    assert.equal(canToggleHiddenCycle(full, '2026-06-29'), false, 'a 25th hide is not offered');
    assert.equal(canToggleHiddenCycle(full, many[0]), true, '„დაბრუნება“ always is');
  });
});

describe('doctor report lists hidden cycles without a reason', () => {
  const summary = {
    range: { from: '2026-04-01', to: '2026-09-09' },
    menstrualHistory: {
      episodes: [{ start: '2026-06-01', end: '2026-06-05', durationDays: 5, flowSequence: ['medium'], source: 'x' }],
      spottingDates: [],
      cycleLengths: [{ start: '2026-06-29', end: '2026-07-27', lengthDays: 28, source: 'x' }],
      excludedCycles: [{ start: '2026-06-01', end: '2026-06-29', lengthDays: 44, source: 'EXCLUDED_BY_USER' }],
      periodDayCount: 5,
    },
  };

  it('labels in every locale', () => {
    assert.equal(doctorExcludedCycleLabel(summary.menstrualHistory.excludedCycles[0], 'ka'), '1 ივნისი 2026 (44 დღე)');
    assert.equal(doctorExcludedCycleLabel({ start: '2026-06-01', lengthDays: null }, 'en'), '1 June 2026');
    const ka = buildCycleReportHtmlFromSummary(summary, 'ka');
    assert.match(ka, /გამორიცხული შენი არჩევით: 1 ივნისი 2026 \(44 დღე\)/);
    assert.match(buildCycleReportHtmlFromSummary(summary, 'en'), /Excluded by your choice: 1 June 2026 \(44 days\)/);
    assert.match(buildCycleReportHtmlFromSummary(summary, 'fr'), /Exclus selon votre choix/);
    assert.match(buildCycleReportHtmlFromSummary(summary, 'ru'), /Исключены по вашему выбору/);
    assert.deepEqual(doctorReportFactIds(summary).excludedCycleStarts, ['2026-06-01']);
  });

  it('no excluded cycles → no line', () => {
    const plain = { ...summary, menstrualHistory: { ...summary.menstrualHistory, excludedCycles: [] } };
    assert.doesNotMatch(buildCycleReportHtmlFromSummary(plain, 'ka'), /გამორიცხული/);
  });
});

describe('screens', () => {
  const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8');

  it('history: one tap, no confirm, undo pill, label on a hidden row', () => {
    const src = read('../components/cycle/CyclePeriodHistory.tsx');
    assert.match(src, /api\.cycle\.updateProfile\(\{ hiddenCycles: nextHiddenCycles\(hiddenCyclesOf\(bundle\), start, hide\) \}\)/);
    assert.ok(src.includes("tx('საშუალოდან დამალვა', 'Hide from averages')"));
    assert.ok(src.includes("tx('დაბრუნება', 'Bring back')"));
    assert.ok(src.includes("tx('დამალულია საშუალოდან', 'Hidden from averages')"));
    assert.match(src, /toggleHidden\(undo\.start, !undo\.hidden, true\)/);
    assert.doesNotMatch(src, /Alert\.alert|რატომ/);
  });

  it('stats card footnote', () => {
    const src = read('../components/cycle/CycleStatsCard.tsx');
    assert.ok(src.includes('ციკლი დამალულია'));
    assert.match(src, /hiddenCycleCount\(bundle\)/);
  });
});
