import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildHomeSectionOrder } from './homeSectionOrder.ts';

test('women-only sections are opt-in and do not reorder common destinations', () => {
  const standard = buildHomeSectionOrder();
  const withCycle = buildHomeSectionOrder({ includeCycle: true });
  assert.equal(standard.includes('cycle'), false);
  assert.equal(standard.includes('community'), false);
  assert.equal(withCycle.filter((id) => id === 'cycle').length, 1);
  assert.deepEqual(
    withCycle.filter((id) => !['cycle', 'community'].includes(id)),
    standard,
  );
});

test('today comes before discovery; scheduled care sits above quick actions', () => {
  const order = buildHomeSectionOrder({ includeCycle: true });
  assert.equal(order[0], 'dashboard');
  assert.ok(order.indexOf('hero') < order.indexOf('ask'));
  assert.ok(order.indexOf('nextDose') < order.indexOf('actions'));
  assert.ok(order.indexOf('actions') < order.indexOf('movement'));
  assert.ok(order.indexOf('discover') < order.indexOf('recentActivity'));
  assert.equal(order.at(-1), 'disclaimer');
  assert.equal(new Set(order).size, order.length);
});

test('caller mutation cannot alter subsequent home composition', () => {
  const order = buildHomeSectionOrder();
  const baseline = [...order];
  order.reverse();
  assert.deepEqual(buildHomeSectionOrder(), baseline);
});
