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
  assert.ok(order.indexOf('checkup') < order.indexOf('movement'));
  assert.ok(order.indexOf('services') < order.indexOf('recentActivity'));
  assert.equal(order.at(-1), 'disclaimer');
  assert.equal(new Set(order).size, order.length);
});

test('caller mutation cannot alter subsequent home composition', () => {
  const order = buildHomeSectionOrder();
  const baseline = [...order];
  order.reverse();
  assert.deepEqual(buildHomeSectionOrder(), baseline);
});
