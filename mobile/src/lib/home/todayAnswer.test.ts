import { test } from 'node:test';
import assert from 'node:assert/strict';
import { todayAnswer } from './todayAnswer.ts';

const at = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date(2026, 9, 4);
  d.setHours(h, m, 0, 0);
  return d;
};
const dose = (time: string, name = 'ასპირინი') => ({ time, name });
const steps = { total: 4000, goal: 8000 };
const water = { ml: 1000, goalMl: 2500 };

test('a dose that is due wins over everything', () => {
  const a = todayAnswer({ pendingDoses: [dose('09:00')], steps, water, now: at('09:30') });
  assert.equal(a.kind, 'dose_due');
  assert.match(a.title, /ასპირინი/);
});

test('a dose within the hour comes before steps; a later one after water', () => {
  assert.equal(todayAnswer({ pendingDoses: [dose('10:20')], steps, water, now: at('09:30') }).kind, 'dose_soon');
  assert.equal(todayAnswer({ pendingDoses: [dose('20:00')], steps, water, now: at('09:30') }).kind, 'steps');
  assert.equal(todayAnswer({ pendingDoses: [dose('20:00')], steps: { total: 9000, goal: 8000 }, water, now: at('09:30') }).kind, 'water');
  assert.equal(
    todayAnswer({ pendingDoses: [dose('20:00')], steps: { total: 9000, goal: 8000 }, water: { ml: 2600, goalMl: 2500 }, now: at('09:30') }).kind,
    'dose_later',
  );
});

test('steps left are counted, never negative', () => {
  const a = todayAnswer({ pendingDoses: [], steps: { total: 6760, goal: 10000 }, water: null, now: at('12:00') });
  assert.equal(a.kind, 'steps');
  assert.match(a.title, /3 240/);
});

test('all goals met → done; nothing tracked → start', () => {
  assert.equal(todayAnswer({ pendingDoses: [], steps: { total: 9000, goal: 8000 }, water: { ml: 2500, goalMl: 2500 }, now: at('18:00') }).kind, 'done');
  assert.equal(todayAnswer({ pendingDoses: [], steps: null, water: null, now: at('18:00') }).kind, 'start');
  assert.equal(todayAnswer({ pendingDoses: [], steps: { total: 0, goal: 0 }, water: null, now: at('18:00') }).kind, 'start');
});
