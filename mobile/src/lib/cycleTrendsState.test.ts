import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cycleTrendsHasCharts, cycleTrendsScreenState } from './cycleTrendsState.ts';

const thin = { analytics: { completedCycleCount: 0, cycleLengths: [], lifestylePatterns: [] }, trends: { cycleLengths: [] } } as never;
const threeCycles = {
  analytics: {
    completedCycleCount: 1,
    cycleLengths: [{ length: 28 }, { length: 30 }, { length: 27 }],
    lifestylePatterns: [],
  },
} as never;
const stats = {
  analytics: { completedCycleCount: 2, cycleLengths: [{ length: 28 }], cycleLengthStats: { count: 2, average: 29 }, lifestylePatterns: [] },
} as never;
const pms = {
  analytics: {
    completedCycleCount: 2,
    cycleLengths: [],
    lifestylePatterns: [],
    pmsByDaysBefore: [
      { daysBefore: 1, count: 2, topSymptoms: [] },
      { daysBefore: 2, count: 1, topSymptoms: [] },
    ],
  },
} as never;
const observations = (n: number) => ({ trends: Array.from({ length: n }, (_, i) => ({ key: `t${i}` })) }) as never;

test('charts need two completed cycles with stats, three cycle lengths, a PMS pattern or a lifestyle pattern', () => {
  assert.equal(cycleTrendsHasCharts(null), false);
  assert.equal(cycleTrendsHasCharts({} as never), false);
  assert.equal(cycleTrendsHasCharts(thin), false);
  assert.equal(cycleTrendsHasCharts(threeCycles), true);
  assert.equal(cycleTrendsHasCharts(stats), true);
  assert.equal(cycleTrendsHasCharts(pms), true);
  assert.equal(
    cycleTrendsHasCharts({ analytics: { completedCycleCount: 0, cycleLengths: [], lifestylePatterns: [{ left: 'a' }] } } as never),
    true,
  );
});

test('too little data → one calm empty card, never a blank or zero chart', () => {
  assert.equal(cycleTrendsScreenState({ bundle: thin, observations: observations(0), observationsSettled: true }), 'empty');
  // A failed observation read counts as nothing to list.
  assert.equal(cycleTrendsScreenState({ bundle: thin, observations: undefined, observationsSettled: true }), 'empty');
});

test('the empty card waits for the first observation answer (no flash)', () => {
  assert.equal(cycleTrendsScreenState({ bundle: thin, observations: undefined, observationsSettled: false }), 'loading');
  assert.equal(cycleTrendsScreenState({ bundle: null, observations: observations(3), observationsSettled: true }), 'loading');
});

test('one observation or one chart is enough for content', () => {
  assert.equal(cycleTrendsScreenState({ bundle: thin, observations: observations(1), observationsSettled: true }), 'content');
  assert.equal(cycleTrendsScreenState({ bundle: threeCycles, observations: undefined, observationsSettled: false }), 'content');
});
