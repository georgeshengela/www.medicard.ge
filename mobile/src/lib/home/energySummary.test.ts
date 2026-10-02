import { test } from 'node:test';
import assert from 'node:assert/strict';
import { energyView, groupDigits, mealTypeAt, nextPlannedMeal, recentMeals, streakFooter } from './energySummary.ts';

type Dash = Parameters<typeof energyView>[0];

function dash(over: Partial<Record<string, unknown>> = {}): Dash {
  return {
    program: { revision: 'r1', active: true, config: {}, targets: {}, startedOn: '2026-09-20' },
    targets: { calories: 2180, protein: 109, carbs: 273, fat: 73, maintenance: 2680, adjustment: -500, method: 'msj' },
    needsReview: false,
    reasons: [],
    date: '2026-10-02',
    today: { calories: 1240, protein: 85, carbs: 124, fat: 42 },
    remaining: 940,
    budget: 2180,
    rollover: 0,
    burned: { activities: 0, steps: 0, total: 0, counted: 0 },
    mealCount: 3,
    todayMeals: [],
    planned: [],
    ...over,
  } as unknown as Dash;
}

test('groupDigits uses a plain space and keeps the sign', () => {
  assert.equal(groupDigits(7842), '7 842');
  assert.equal(groupDigits(940), '940');
  assert.equal(groupDigits(1240.6), '1 241');
  assert.equal(groupDigits(-1240), '-1 240');
});

test('budget day: server remaining in the centre, ring filled by eaten / budget', () => {
  const v = energyView(dash());
  assert.equal(v.kind, 'budget');
  assert.equal(v.target, 2180);
  assert.deepEqual(v.centre, { value: 940, unit: 'left' });
  assert.equal(v.over, false);
  assert.ok(Math.abs(v.progress - 1240 / 2180) < 1e-9);
  assert.equal(v.empty, false);
  assert.deepEqual(
    v.macros.map((m) => [m.key, m.value, m.target]),
    [
      ['protein', 85, 109],
      ['carbs', 124, 273],
      ['fat', 42, 73],
    ],
  );
  assert.equal(v.breakdown, null);
});

test('over budget: positive number with "over", ring capped at full', () => {
  const v = energyView(dash({ today: { calories: 2300, protein: 120, carbs: 280, fat: 80 }, remaining: -120 }));
  assert.equal(v.over, true);
  assert.deepEqual(v.centre, { value: 120, unit: 'over' });
  assert.equal(v.progress, 1);
  assert.equal(v.macros[0].ratio, 1);
});

test('budget prefers the server budget over the plan target and explains the difference', () => {
  const v = energyView(dash({ budget: 2540, remaining: 1300, rollover: 0, burned: { activities: 360, steps: 0, total: 360, counted: 360 } }));
  assert.equal(v.target, 2540);
  assert.deepEqual(v.breakdown, { target: 2180, burned: 360, rollover: 0, budget: 2540 });
  const roll = energyView(dash({ budget: 2280, remaining: 1040, rollover: 100 }));
  assert.deepEqual(roll.breakdown, { target: 2180, burned: 0, rollover: 100, budget: 2280 });
});

test('no plan: empty state until something is logged, then eaten kcal without a target', () => {
  const none = energyView(dash({ program: null, targets: null, budget: null, remaining: null, mealCount: 0, today: { calories: 0, protein: 0, carbs: 0, fat: 0 } }));
  assert.equal(none.kind, 'noPlan');
  assert.equal(none.empty, true);
  assert.equal(none.centre, null);
  const logged = energyView(dash({ program: null, targets: null, budget: null, remaining: null }));
  assert.equal(logged.kind, 'noPlan');
  assert.equal(logged.empty, false);
  assert.deepEqual(logged.centre, { value: 1240, unit: 'kcal' });
  assert.equal(logged.progress, 0, 'no target → the ring never looks "full"');
  assert.ok(logged.macros.every((m) => m.target === null && m.ratio === 0));
});

test('program without today\'s target is a review state; reasons never leak into the view', () => {
  const v = energyView(dash({ targets: null, budget: null, remaining: null, needsReview: true, reasons: ['მიმდინარე წონა შეიცვალა.'] }));
  assert.equal(v.kind, 'review');
  assert.equal(v.needsReview, true);
  assert.equal(JSON.stringify(v).includes('წონა შეიცვალა'), false);
});

test('budget with nothing logged keeps the ring (full budget left), not the empty state', () => {
  const v = energyView(dash({ mealCount: 0, today: { calories: 0, protein: 0, carbs: 0, fat: 0 }, remaining: 2180 }));
  assert.equal(v.empty, false);
  assert.equal(v.logged, false);
  assert.deepEqual(v.centre, { value: 2180, unit: 'left' });
});

test('recentMeals keeps the latest three in eating order and counts the rest', () => {
  const meals = ['a', 'b', 'c', 'd', 'e'].map((id) => ({ id })) as never[];
  const r = recentMeals(meals);
  assert.deepEqual(
    r.shown.map((m: { id: string }) => m.id),
    ['c', 'd', 'e'],
  );
  assert.equal(r.more, 2);
  assert.deepEqual(recentMeals(meals.slice(0, 2)).more, 0);
  assert.deepEqual(recentMeals(undefined), { shown: [], more: 0 });
});

test('meal slot hours match the diary', () => {
  assert.equal(mealTypeAt(8), 'breakfast');
  assert.equal(mealTypeAt(11), 'lunch');
  assert.equal(mealTypeAt(16), 'dinner');
  assert.equal(mealTypeAt(21), 'snack');
});

test('next planned meal: current or later slot, uneaten, slot not already logged', () => {
  const p = (type: string, eaten = false) => ({ id: type, type, eaten, data: { title: type, totals: { calories: 500 } } });
  const planned = [p('breakfast', true), p('dinner'), p('lunch'), p('snack')] as never[];
  assert.equal(nextPlannedMeal(planned, [], 14)?.type, 'lunch');
  assert.equal(nextPlannedMeal(planned, [{ type: 'lunch' }] as never[], 14)?.type, 'dinner');
  assert.equal(nextPlannedMeal(planned, [], 22)?.type, 'snack');
  assert.equal(nextPlannedMeal([p('breakfast')] as never[], [], 14), null, 'a missed slot is not nagged about');
  assert.equal(nextPlannedMeal(undefined, [], 9), null);
});

test('streak footer only with a running streak; record only when above it', () => {
  assert.equal(streakFooter({ current: 0, best: 19, loggedToday: false, nextMilestone: 3, reached: [] }), null);
  assert.deepEqual(streakFooter({ current: 3, best: 19, loggedToday: true, nextMilestone: 7, reached: [3] }), { current: 3, best: 19 });
  assert.deepEqual(streakFooter({ current: 5, best: 5, loggedToday: true, nextMilestone: 7, reached: [3] }), { current: 5, best: null });
  assert.equal(streakFooter(undefined), null);
});
