import test from 'node:test';
import assert from 'node:assert/strict';
import { goalFromProgram, unifiedWeightGoal, programGoalChanged } from './weightGoalUnify.js';
import { mergeAppState } from './appState.js';

const program = (over = {}) => ({
  config: { weightKg: 90, targetKg: 80, mode: 'lose', pace: 'steady', heightCm: 180 },
  startedOn: new Date('2026-09-01T00:00:00Z'),
  updatedAt: new Date('2026-09-01T10:00:00Z'),
  active: true,
  goalLink: null,
  ...over,
});
const canonical = { id: 'g1', startKg: 92, targetKg: 78, startedYmd: '2026-08-01', deadlineYmd: '2026-12-01', paceKgPerWeek: 0.4, pace: 'moderate', reminderEnabled: true, reminderDays: [1], reminderHour: 8, reminderMinute: 0, updatedAt: '2026-08-01T09:00:00.000Z' };

test('a goal that only lives in an old nutrition plan is recovered, not lost', () => {
  const goal = unifiedWeightGoal(null, program());
  assert.equal(goal.targetKg, 80);
  assert.equal(goal.startKg, 90);
  assert.equal(goal.startedYmd, '2026-09-01');
  assert.equal(goal.pace, 'moderate');
  assert.equal(goal.deadlineYmd, '2027-02-23'); // 10 kg / 0.4 kg per week = 25 weeks = 175 days
});

test('the canonical weight goal always wins over the plan copy', () => {
  assert.equal(unifiedWeightGoal(canonical, program()), canonical);
});

test('paused plans and incomplete configs do not invent a goal', () => {
  assert.equal(unifiedWeightGoal(null, program({ active: false })), null);
  assert.equal(goalFromProgram(program({ config: { weightKg: 90 } })), null);
  assert.equal(unifiedWeightGoal(null, null), null);
});

test('a later goal set on the weight screen beats a recovered plan goal in the merge', () => {
  const recovered = unifiedWeightGoal(null, program());
  const edited = { ...recovered, id: 'new', targetKg: 75, updatedAt: '2026-09-02T08:00:00.000Z' };
  assert.equal(mergeAppState({ weightGoal: recovered }, { weightGoal: edited }).weightGoal.targetKg, 75);
});

test('old plans without goalLink still notice a moved goal', () => {
  assert.equal(programGoalChanged(program(), { ...canonical, targetKg: 80 }), false);
  assert.equal(programGoalChanged(program(), canonical), true);
  assert.equal(programGoalChanged(program(), null), false);
  assert.equal(programGoalChanged(program({ goalLink: { id: 'g1', targetKg: 78 } }), canonical), false);
  assert.equal(programGoalChanged(program({ goalLink: { id: 'g0', targetKg: 78 } }), canonical), true);
});

