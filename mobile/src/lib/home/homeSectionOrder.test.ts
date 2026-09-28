import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildHomeSectionOrder } from './homeSectionOrder.ts';

test('women-only section is opt-in and does not reorder common destinations', () => {
  const standard = buildHomeSectionOrder();
  const withCycle = buildHomeSectionOrder({ includeCycle: true });
  assert.equal(standard.includes('cycle'), false);
  assert.equal(withCycle.filter((id) => id === 'cycle').length, 1);
  assert.deepEqual(withCycle.filter((id) => id !== 'cycle'), standard);
});

test('today first, then daily habits, then discovery; every section is unique', () => {
  const order = buildHomeSectionOrder({ includeCycle: true });
  assert.equal(order[0], 'dashboard');
  assert.ok(order.indexOf('hero') < order.indexOf('ask'));
  assert.ok(order.indexOf('nextDose') < order.indexOf('cycle'));
  assert.ok(order.indexOf('cycle') < order.indexOf('nutrition'));
  assert.ok(order.indexOf('nutrition') < order.indexOf('checkup'));
  assert.ok(order.indexOf('checkup') < order.indexOf('services'));
  assert.equal(order.at(-1), 'disclaimer');
  assert.equal(new Set(order).size, order.length);
});

test('caller mutation cannot alter subsequent home composition', () => {
  const order = buildHomeSectionOrder();
  const baseline = [...order];
  order.reverse();
  assert.deepEqual(buildHomeSectionOrder(), baseline);
});

test('the onboarding goal moves its section right after ask Medi, nothing disappears', () => {
  const base = buildHomeSectionOrder({ includeCycle: true });
  const nutrition = buildHomeSectionOrder({ includeCycle: true, primaryGoal: 'nutrition' });
  assert.equal(nutrition[nutrition.indexOf('ask') + 1], 'news');
  assert.equal(nutrition[nutrition.indexOf('ask') + 2], 'nutrition');
  assert.deepEqual([...nutrition].sort(), [...base].sort());
  const cycle = buildHomeSectionOrder({ includeCycle: true, primaryGoal: 'cycle' });
  assert.equal(cycle[cycle.indexOf('ask') + 1], 'cycle');
  assert.deepEqual(buildHomeSectionOrder({ includeCycle: true, primaryGoal: 'general' }), base);
  assert.deepEqual(buildHomeSectionOrder({ includeCycle: true, primaryGoal: 'medications' }), base); // already right after ask
  // A man who somehow has the cycle goal does not get a cycle section.
  assert.ok(!buildHomeSectionOrder({ includeCycle: false, primaryGoal: 'cycle' }).includes('cycle'));
});

test('the trainer block sits with what is due today, before women’s health and nutrition', () => {
  const order = buildHomeSectionOrder({ includeCycle: true });
  assert.equal(order.indexOf('coach'), order.indexOf('nextDose') + 1);
  assert.ok(order.indexOf('coach') < order.indexOf('cycle'));
});

test('news sits directly above nutrition, wherever nutrition goes', () => {
  for (const primaryGoal of [undefined, 'nutrition', 'cycle', 'medications'] as const) {
    const order = buildHomeSectionOrder({ includeCycle: true, primaryGoal });
    assert.equal(order.indexOf('news') + 1, order.indexOf('nutrition'), String(primaryGoal));
  }
});

test('an admin-paused module drops its section and nothing else', () => {
  const base = buildHomeSectionOrder({ includeCycle: true });
  const paused = buildHomeSectionOrder({ includeCycle: true, hidden: new Set(['cycle', 'nutrition', 'coach']) });
  assert.deepEqual(paused, base.filter((id) => !['cycle', 'nutrition', 'coach'].includes(id)));
  // The goal of a paused module does not bring it back.
  assert.ok(!buildHomeSectionOrder({ includeCycle: true, primaryGoal: 'nutrition', hidden: new Set(['nutrition']) }).includes('nutrition'));
});
