import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HEAVY_STREAK_DAYS, LONG_RUN_DAYS, heavyBleedingSignal, showHeavyBleedingCard } from './cycleHeavyBleeding.ts';

function addDays(key: string, n: number): string {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

const today = '2026-10-03';
/** Bleed days ending today: flows[0] is the oldest day, flows.at(-1) is today. */
function run(flows: (string | null)[], end = today) {
  return flows.map((flow, i) => ({ date: addDays(end, -(flows.length - 1 - i)), flow }));
}

test('constants match the brief (3 heavy days, more than 7 days)', () => {
  assert.equal(HEAVY_STREAK_DAYS, 3);
  assert.equal(LONG_RUN_DAYS, 7);
});

test('a normal period never shows the card', () => {
  const logs = run(['medium', 'heavy', 'medium', 'light', 'light']);
  const s = heavyBleedingSignal(logs, today);
  assert.equal(s.show, false);
  assert.equal(s.runDays, 5);
  assert.equal(s.heavyStreak, 1);
  assert.equal(s.reason, null);
  assert.equal(showHeavyBleedingCard(logs, today), false);
});

test('three consecutive heavy days show the card; two with a medium day between do not', () => {
  assert.deepEqual(heavyBleedingSignal(run(['heavy', 'heavy', 'heavy']), today), {
    show: true,
    runDays: 3,
    heavyStreak: 3,
    reason: 'heavy',
  });
  const broken = heavyBleedingSignal(run(['heavy', 'heavy', 'medium', 'heavy', 'heavy']), today);
  assert.equal(broken.show, false);
  assert.equal(broken.heavyStreak, 2);
});

test('a run longer than 7 days shows the card even with light flow; exactly 7 does not', () => {
  const eight = heavyBleedingSignal(run(Array(8).fill('light')), today);
  assert.equal(eight.show, true);
  assert.equal(eight.runDays, 8);
  assert.equal(eight.reason, 'long');
  const seven = heavyBleedingSignal(run(Array(7).fill('light')), today);
  assert.equal(seven.show, false);
  assert.equal(seven.runDays, 7);
});

test('both rules → reason heavy', () => {
  assert.equal(heavyBleedingSignal(run(Array(9).fill('heavy')), today).reason, 'heavy');
});

test('the run may end yesterday (today not logged yet) but not earlier', () => {
  const yesterday = run(['heavy', 'heavy', 'heavy'], addDays(today, -1));
  assert.equal(heavyBleedingSignal(yesterday, today).show, true);
  const twoDaysAgo = run(['heavy', 'heavy', 'heavy'], addDays(today, -2));
  assert.equal(heavyBleedingSignal(twoDaysAgo, today).show, false);
  assert.equal(heavyBleedingSignal(twoDaysAgo, today).runDays, 0);
});

test('spotting, none or an unlogged day ends the run', () => {
  // heavy heavy [spotting] heavy → current run is one day
  const spotting = heavyBleedingSignal(run(['heavy', 'heavy', 'spotting', 'heavy']), today);
  assert.equal(spotting.runDays, 1);
  assert.equal(spotting.show, false);
  const none = heavyBleedingSignal(run(['heavy', 'heavy', 'heavy', 'none', 'light']), today);
  assert.equal(none.runDays, 1);
  // a gap in dates
  const gap = [
    ...run(['light', 'light', 'light', 'light', 'light'], addDays(today, -2)),
    { date: today, flow: 'light' },
  ];
  assert.equal(heavyBleedingSignal(gap, today).runDays, 1);
});

test('future dates and malformed input are ignored', () => {
  const logs = [...run(['heavy', 'heavy']), { date: addDays(today, 1), flow: 'heavy' }, { date: addDays(today, 2), flow: 'heavy' }];
  assert.equal(heavyBleedingSignal(logs, today).show, false);
  assert.equal(heavyBleedingSignal(logs, '').show, false);
  assert.equal(heavyBleedingSignal([], today).show, false);
  assert.equal(showHeavyBleedingCard(null, today), false);
  assert.equal(showHeavyBleedingCard(undefined, today), false);
});
