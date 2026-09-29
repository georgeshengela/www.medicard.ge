import test from 'node:test';
import assert from 'node:assert/strict';
import { isMeaningfulDrop, inAlertWindow, planDispatch, alertCopy, dropPercent } from './priceDrop.js';

test('only real drops count: at least 10% and at least 0.50 ₾', () => {
  assert.equal(isMeaningfulDrop(20, 17.9), true);
  assert.equal(isMeaningfulDrop(20, 18.5), false); // 7.5%
  assert.equal(isMeaningfulDrop(3, 2.6), false); // 13% but only 0.40 ₾
  assert.equal(isMeaningfulDrop(null, 5), false); // first price seen is not a drop
  assert.equal(isMeaningfulDrop(10, 12), false);
});

test('alerts go out only in Tbilisi daytime (09:00–21:00, UTC+4)', () => {
  assert.equal(inAlertWindow(new Date('2026-09-27T05:00:00Z')), true); // 09:00
  assert.equal(inAlertWindow(new Date('2026-09-27T04:59:00Z')), false); // 08:59
  assert.equal(inAlertWindow(new Date('2026-09-27T16:59:00Z')), true); // 20:59
  assert.equal(inAlertWindow(new Date('2026-09-27T17:00:00Z')), false); // 21:00
});

test('one alert per person per day, the biggest drop, and nothing stale', () => {
  const pending = [
    { id: 'a', userId: 'u1', productId: 'p1', fromGel: 20, toGel: 17 },
    { id: 'b', userId: 'u1', productId: 'p2', fromGel: 10, toGel: 6 }, // 40% beats 15%
    { id: 'c', userId: 'u2', productId: 'p1', fromGel: 20, toGel: 17 },
    { id: 'd', userId: 'u3', productId: 'p3', fromGel: 30, toGel: 25 }, // price went back up
    { id: 'e', userId: 'u4', productId: 'p1', fromGel: 20, toGel: 17 }, // already alerted today
  ];
  const best = new Map([['p1', 17], ['p2', 6], ['p3', 29]]);
  const plan = planDispatch(pending, new Set(['u4']), best);
  assert.deepEqual(plan.send.map((r) => r.id).sort(), ['b', 'c']);
  assert.deepEqual(plan.skip, ['d']);
});

test('copy is informal Georgian with the real numbers', () => {
  const c = alertCopy({ medName: 'იბუპროფენი', fromGel: 10, toGel: 8 });
  assert.equal(dropPercent(10, 8), 20);
  assert.match(c.title, /იბუპროფენი გაიაფდა 20%-ით/);
  assert.match(c.body, /8\.00 ₾ \(იყო 10\.00 ₾\)/);
  assert.match(c.body, /ნახე/);
});

test('English readers get English copy with the same numbers', () => {
  const c = alertCopy({ medName: 'Ibuprofen', fromGel: 10, toGel: 8 }, 'en');
  assert.equal(c.title, 'Ibuprofen is 20% cheaper');
  assert.match(c.body, /Now 8\.00 ₾ \(was 10\.00 ₾\)/);
});
