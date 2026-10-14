import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  HOME_DEFAULT_ORDER, HOME_LAYOUTS, HOME_RECOMMENDED_ORDER, HOME_SECTIONS, mergeOrder, publicHomeConfig, sanitizeHomeConfig,
} from './homeSections.js';

/** The app's HOME_LAYOUT_ORDER, read from the TypeScript source. */
function appOrders() {
  const src = readFileSync(new URL('../../../mobile/src/lib/home/homeSectionOrder.ts', import.meta.url), 'utf8');
  const block = src.slice(src.indexOf('export const HOME_LAYOUT_ORDER'), src.indexOf('export const HOME_LAYOUT_SPOTLIGHT'));
  const out = {};
  for (const m of block.matchAll(/(\w+): \[([^\]]*)\]/g)) out[m[1]] = [...m[2].matchAll(/'(\w+)'/g)].map((x) => x[1]);
  return out;
}

test('home sections: server defaults mirror the app', () => {
  const app = appOrders();
  for (const layout of HOME_LAYOUTS) assert.deepEqual(HOME_DEFAULT_ORDER[layout], app[layout], layout);
});

test('home sections: every id has an admin label; recommended orders are permutations', () => {
  for (const layout of HOME_LAYOUTS) {
    for (const id of HOME_DEFAULT_ORDER[layout]) assert.ok(HOME_SECTIONS[id]?.label, id);
    assert.deepEqual([...HOME_RECOMMENDED_ORDER[layout]].sort(), [...HOME_DEFAULT_ORDER[layout]].sort(), layout);
    assert.equal(HOME_RECOMMENDED_ORDER[layout][0], 'dashboard');
    assert.equal(HOME_RECOMMENDED_ORDER[layout].at(-1), 'disclaimer');
  }
});

test('home sections: sanitize keeps only usable ids and drops defaults', () => {
  const cfg = sanitizeHomeConfig({
    layouts: {
      standard: { hidden: ['doors', 'dashboard', 'cycleHero', 'nope', 'doors'] },
      women: { order: [...HOME_DEFAULT_ORDER.women] },
      bogus: { hidden: ['news'] },
      active: { order: ['medirun', 'dashboard', 'medirun', 'x', ...HOME_DEFAULT_ORDER.active.filter((id) => id !== 'medirun')] },
    },
  });
  assert.deepEqual(cfg.layouts.standard, { hidden: ['doors'] });
  assert.equal(cfg.layouts.women, undefined, 'default order is no row');
  assert.equal(cfg.layouts.bogus, undefined);
  const order = cfg.layouts.active.order;
  assert.equal(order[0], 'dashboard');
  assert.equal(order.at(-1), 'disclaimer');
  assert.equal(order[1], 'medirun');
  assert.deepEqual([...order].sort(), [...HOME_DEFAULT_ORDER.active].sort());
});

test('home sections: missing ids go back after their default predecessor', () => {
  const d = ['dashboard', 'a', 'b', 'c', 'd', 'disclaimer'];
  assert.deepEqual(mergeOrder(d, ['c', 'a']), ['dashboard', 'c', 'd', 'a', 'b', 'disclaimer']);
  assert.deepEqual(mergeOrder(d, []), d);
});

test('home sections: public payload', () => {
  assert.deepEqual(publicHomeConfig(null), { v: 0, layouts: {} });
  assert.deepEqual(publicHomeConfig({ version: 3, config: { layouts: { weight: { hidden: ['news'] } } } }), { v: 3, layouts: { weight: { hidden: ['news'] } } });
});
