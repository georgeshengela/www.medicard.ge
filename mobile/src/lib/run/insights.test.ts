import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceSplits, personalRecords, recordsSetBy, routeThumbPath, splitDurations, walkStreak, weekBuckets } from './insights.ts';

const at = (y: number, m: number, d: number, h = 9) => new Date(y, m - 1, d, h).toISOString();
const now = new Date(2026, 8, 26, 18);

test('week buckets end today and sum every walk on a local day', () => {
  const days = weekBuckets([
    { startedAt: at(2026, 9, 26), meters: 1200 },
    { startedAt: at(2026, 9, 26, 20), meters: 300 },
    { startedAt: at(2026, 9, 20), meters: 900 },
    { startedAt: at(2026, 9, 19), meters: 5000 },
    { startedAt: 'nonsense', meters: 400 },
  ], now);
  assert.equal(days.length, 7);
  assert.equal(days[6].isToday, true);
  assert.equal(days[6].meters, 1500);
  assert.equal(days[0].meters, 900);
  assert.equal(days.reduce((s, d) => s + d.meters, 0), 2400);
});

test('streak survives an open today and breaks on a gap', () => {
  assert.equal(walkStreak([{ startedAt: at(2026, 9, 25), meters: 100 }, { startedAt: at(2026, 9, 24), meters: 100 }], now), 2);
  assert.equal(walkStreak([{ startedAt: at(2026, 9, 26), meters: 100 }, { startedAt: at(2026, 9, 24), meters: 100 }], now), 1);
  assert.equal(walkStreak([{ startedAt: at(2026, 9, 23), meters: 100 }], now), 0);
  assert.equal(walkStreak([{ startedAt: at(2026, 9, 26), meters: 0 }], now), 0);
});

test('records need a real distance for pace and the first walk sets none', () => {
  const a = { id: 'a', startedAt: at(2026, 9, 1), distanceM: 3000, movingMs: 1_800_000, paceSecPerKm: 600 };
  const b = { id: 'b', startedAt: at(2026, 9, 2), distanceM: 500, movingMs: 200_000, paceSecPerKm: 400 };
  const c = { id: 'c', startedAt: at(2026, 9, 3), distanceM: 4000, movingMs: 2_000_000, paceSecPerKm: 500 };
  assert.equal(personalRecords([a, b]).fastest?.id, 'a');
  assert.deepEqual(recordsSetBy(a, [a]), []);
  assert.deepEqual(recordsSetBy(c, [a, b, c]), ['distance', 'pace', 'time']);
  assert.deepEqual(recordsSetBy(b, [a, b, c]), []);
});

test('splits mark each kilometre once and carried-over kilometres stay unknown', () => {
  let splits = advanceSplits([], 999, 1000);
  assert.equal(splits.length, 0);
  splits = advanceSplits(splits, 1001, 400_000);
  const same = advanceSplits(splits, 1500, 500_000);
  assert.equal(same, splits);
  splits = advanceSplits(splits, 3010, 1_200_000);
  assert.deepEqual(splits, [400_000, 1_200_000, 1_200_000]);
  assert.deepEqual(splitDurations([400_000, 1_000_000]), [400_000, 600_000]);
  assert.deepEqual(splitDurations([-1, 500_000, 900_000]), [null, null, 400_000]);
});

test('route thumbnails keep separate segments and stay inside the box', () => {
  const d = routeThumbPath([[{ lat: 41.7, lng: 44.7 }, { lat: 41.71, lng: 44.71 }], [{ lat: 41.72, lng: 44.7 }, { lat: 41.73, lng: 44.72 }]], 100, 60);
  assert.equal((d.match(/M/g) || []).length, 2);
  for (const n of d.replace(/[ML]/g, ' ').trim().split(/\s+/).map(Number)) assert.ok(n >= 0 && n <= 100);
  assert.equal(routeThumbPath([[{ lat: 1, lng: 1 }]], 10, 10), '');
});
