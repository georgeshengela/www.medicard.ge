import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  latestUserLog,
  pickCurrentWeight,
  sparklinePoints,
  weighInWhen,
  weightEta,
  weightGoalView,
  weightSeries,
} from './weightProgress.ts';

const TODAY = '2026-10-02';
const goal = (startKg: number, targetKg: number) =>
  ({
    id: 'g',
    startKg,
    targetKg,
    startedYmd: '2026-08-15',
    deadlineYmd: '2027-02-01',
    paceKgPerWeek: 0.5,
    pace: 'moderate',
    reminderEnabled: true,
    reminderDays: [1],
    reminderHour: 12,
    reminderMinute: 0,
  }) as never;
const log = (id: string, date: string, kg: number, at = `${date}T08:00:00.000Z`) => ({ id, date, kg, at });

test('latestUserLog ignores seeds and future dates', () => {
  const logs = [log('wseed-x', '2026-10-02', 90), log('wlog-1', '2026-09-30', 92.8), log('wlog-2', '2026-10-01', 92.6), log('wlog-3', '2026-10-05', 91)];
  assert.equal(latestUserLog(logs, TODAY)?.id, 'wlog-2');
  assert.equal(latestUserLog([], TODAY), null);
});

test('current weight: saved > newer local log > server > profile', () => {
  const server = { kg: 92.4, date: '2026-10-01', source: 'measurement' };
  assert.deepEqual(pickCurrentWeight({ server, logs: [], profileKg: 95, today: TODAY }), { kg: 92.4, date: '2026-10-01', source: 'measurement' });
  assert.deepEqual(
    pickCurrentWeight({ server, logs: [log('wlog-1', TODAY, 92.1)], profileKg: 95, today: TODAY }),
    { kg: 92.1, date: TODAY, source: 'weight_log' },
    'a log typed here today beats yesterday on the server',
  );
  assert.equal(pickCurrentWeight({ server, logs: [log('wlog-1', '2026-10-01', 92.9)], profileKg: 95, today: TODAY })?.kg, 92.4, 'tie → server');
  assert.deepEqual(pickCurrentWeight({ server, logs: [], profileKg: 95, saved: { kg: 91.9, date: TODAY }, today: TODAY }), {
    kg: 91.9,
    date: TODAY,
    source: 'weight_log',
  });
  assert.deepEqual(pickCurrentWeight({ server: { kg: 95, date: null, source: 'profile' }, logs: [], profileKg: 95, today: TODAY }), {
    kg: 95,
    date: null,
    source: 'profile',
  });
  assert.deepEqual(pickCurrentWeight({ server: null, logs: [], profileKg: 80, today: TODAY }), { kg: 80, date: null, source: 'profile' });
  assert.equal(pickCurrentWeight({ server: null, logs: [], profileKg: null, today: TODAY }), null);
});

test('weigh-in label: profile, today, yesterday, a date', () => {
  assert.deepEqual(weighInWhen({ kg: 90, date: null, source: 'profile' }, TODAY), { kind: 'profile' });
  assert.deepEqual(weighInWhen({ kg: 90, date: TODAY, source: 'weight_log' }, TODAY), { kind: 'today' });
  assert.deepEqual(weighInWhen({ kg: 90, date: '2026-10-01', source: 'measurement' }, TODAY), { kind: 'yesterday' });
  assert.deepEqual(weighInWhen({ kg: 90, date: '2026-09-28', source: 'measurement' }, TODAY), { kind: 'date', date: '2026-09-28' });
});

test('goal view: losing toward the goal', () => {
  const v = weightGoalView(goal(96, 85), 92.4);
  assert.equal(v.kind, 'progress');
  if (v.kind !== 'progress') return;
  assert.equal(v.movedKg, 3.6);
  assert.equal(v.remainingKg, 7.4);
  assert.equal(v.percent, 33);
});

test('goal view: moving away never shows negative progress', () => {
  const v = weightGoalView(goal(96, 85), 97.2);
  assert.equal(v.kind, 'progress');
  if (v.kind !== 'progress') return;
  assert.equal(v.movedKg, 0);
  assert.equal(v.percent, 0);
  assert.equal(v.remainingKg, 12.2);
});

test('goal view: gain goals, reached and passed goals, maintain, no goal', () => {
  const gain = weightGoalView(goal(58, 62), 60);
  assert.equal(gain.kind, 'progress');
  if (gain.kind === 'progress') assert.equal(gain.movedKg, 2);
  assert.equal(weightGoalView(goal(96, 85), 85.1).kind, 'reached');
  assert.equal(weightGoalView(goal(96, 85), 84).kind, 'reached', 'below a loss goal reads as reached, not "1 kg to go"');
  assert.equal(weightGoalView(goal(58, 62), 63).kind, 'reached');
  assert.deepEqual(weightGoalView(goal(85.2, 85), 86), { kind: 'maintain', targetKg: 85 });
  assert.deepEqual(weightGoalView(null, 90), { kind: 'none' });
});

test('series: server history wins on a date, local fills gaps, current is the last point', () => {
  const series = weightSeries({
    history: [
      { date: '2026-09-20', weightKg: 93.6 },
      { date: '2026-09-27', weightKg: 93.0 },
    ],
    logs: [log('wlog-a', '2026-09-27', 99), log('wlog-b', '2026-09-24', 93.3)],
    current: { kg: 92.4, date: TODAY, source: 'weight_log' },
  });
  assert.deepEqual(series, [
    { date: '2026-09-20', kg: 93.6 },
    { date: '2026-09-24', kg: 93.3 },
    { date: '2026-09-27', kg: 93.0 },
    { date: TODAY, kg: 92.4 },
  ]);
  const capped = weightSeries({ history: Array.from({ length: 40 }, (_, i) => ({ date: `2026-08-${String(i + 1).padStart(2, '0')}`, weightKg: 90 })), logs: [], current: null, limit: 28 });
  assert.equal(capped.length, 28);
  assert.equal(weightSeries({ history: [], logs: [], current: { kg: 90, date: null, source: 'profile' } }).length, 0, 'a profile value is not a weigh-in');
});

test('sparkline points fit the box and never exaggerate small changes', () => {
  const pts = sparklinePoints([96, 95, 94], 300, 56, 6);
  assert.equal(pts.length, 3);
  assert.deepEqual(pts[0], { x: 6, y: 6 });
  assert.deepEqual(pts[2], { x: 294, y: 50 });
  const flat = sparklinePoints([90, 90.2, 90.1], 300, 56, 6);
  const ys = flat.map((p) => p.y);
  assert.ok(Math.max(...ys) - Math.min(...ys) <= (56 - 12) * 0.2 + 0.01, '0.2 kg spans at most 20 % of the height');
  assert.deepEqual(sparklinePoints([90], 300, 56), []);
  assert.deepEqual(sparklinePoints([90, 91], 10, 56), []);
});

test('ETA only with today\'s targets, an open goal and a projection for the same target', () => {
  const view = weightGoalView(goal(96, 85), 92.4);
  const base = {
    targets: { calories: 2180 },
    projection: { current: 92.4, target: 85, trendKgPerWeek: -0.5, trendEta: '2027-01-04', planEta: '2027-02-10', direction: 'down', remainingKg: 7.4 },
  } as never;
  assert.deepEqual(weightEta(base, view), { kind: 'trend', date: '2027-01-04' });
  assert.equal(weightEta({ ...(base as object), targets: null } as never, view), null, 'no plan targets → no ETA (hub rule)');
  assert.deepEqual(weightEta({ ...(base as object), projection: { ...(base as { projection: object }).projection, trendEta: null } } as never, view), {
    kind: 'plan',
    date: '2027-02-10',
  });
  assert.equal(weightEta({ ...(base as object), projection: { ...(base as { projection: object }).projection, target: 80 } } as never, view), null);
  assert.equal(weightEta(base, weightGoalView(goal(85.2, 85), 86)), null, 'maintain has no ETA');
  assert.equal(weightEta(null, view), null);
});
