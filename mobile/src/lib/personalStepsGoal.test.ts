import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as app from './personalStepsGoal.ts';
// The web app's plain-JS mirror (no build step); both must follow one rule.
import * as web from '../../../server/public/app/js/stepsGoal.js';

/** daily totals → expected goal */
const CASES: Array<[Array<number | null | undefined>, number]> = [
  [[], 4000],
  [[5000, 6000], 4000], // two days are not a typical day
  [[null, undefined, 0, -300, Number.NaN, Number.POSITIVE_INFINITY, 5000, 6000], 4000],
  [[3000, 5000, 7000], 5000],
  [[7000, 3000, 5000, 8000], 6000], // even count: mean of the middle two, any order
  [[6200, 6300, 6400], 6500], // nearest 500 (6 300 → 6 500)
  [[6240, 6240, 6240], 6000], // nearest 500 (6 240 → 6 000)
  [[6250, 6250, 6250], 6500], // half rounds up
  [[500, 800, 1200], 2000], // floor
  [[15000, 18000, 20000], 10000], // ceiling — never above 10 000
  [[2100, 2200, 30000, 31000, 2300], 2500], // one long hike does not move the typical day
];

test('personal goal: median of the days with steps, nearest 500, 2 000–10 000, else 4 000', () => {
  for (const [totals, expected] of CASES) {
    assert.equal(app.personalStepsGoal(totals), expected, `app ${JSON.stringify(totals)}`);
    assert.equal(web.personalStepsGoal(totals), expected, `web ${JSON.stringify(totals)}`);
  }
  assert.equal(app.STEPS_GOAL_FALLBACK, 4000);
  for (const key of ['STEPS_GOAL_FALLBACK', 'STEPS_GOAL_FLOOR', 'STEPS_GOAL_CEILING', 'STEPS_GOAL_ROUND', 'STEPS_GOAL_WINDOW_DAYS', 'STEPS_GOAL_MIN_DAYS'] as const) {
    assert.equal(web[key], app[key], key);
  }
});

test('goal window = the 14 completed days before today, oldest first', () => {
  const now = new Date(2026, 9, 3, 15, 30); // 3 Oct 2026, local
  const keys = app.goalWindowKeys(now);
  assert.equal(keys.length, 14);
  assert.equal(keys[0], '2026-09-19');
  assert.equal(keys[13], '2026-10-02');
  assert.ok(!keys.includes('2026-10-03'));
  assert.deepEqual(web.goalWindowKeys(now), keys);
});

test('goal from per-day sources: today and older days are ignored, the larger source wins', () => {
  const now = new Date(2026, 9, 3, 9, 0);
  const stored = new Map([
    ['2026-10-03', 40000], // today (partial / not counted)
    ['2026-09-10', 40000], // older than the window
    ['2026-10-02', 6000],
    ['2026-10-01', 5000],
    ['2026-09-30', 2000],
  ]);
  const device = { '2026-09-30': 7000 }; // the phone saw more than the last sync
  assert.equal(app.personalStepsGoalFor([stored, device], now), 6000);
  assert.equal(app.personalStepsGoalFor([stored], now), 5000);
  assert.equal(app.personalStepsGoalFor([new Map([['2026-10-02', 9000]])], now), 4000);

  const rows = [
    { date: '2026-10-03', steps: 40000 },
    { date: '2026-10-02', steps: 6000 },
    { date: '2026-10-01', steps: 5000 },
    { date: '2026-09-30', steps: 2000 },
    { date: '2026-09-29', steps: null },
  ];
  assert.equal(web.stepsGoalFromDaily(rows, now), 5000);
  assert.equal(web.stepsGoalFromDaily([], now), 4000);
  assert.equal(web.stepsGoalFromDaily(null, now), 4000);
});
