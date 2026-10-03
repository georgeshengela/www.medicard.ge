import { test } from 'node:test';
import assert from 'node:assert/strict';
import { heroPeriodState, heroPlanWhileAsking, periodEndUndo, stillBleedingFlow } from './cyclePeriodStatus.ts';

const today = '2026-09-06';
const status = (state: 'active' | 'ended' | 'askStill') => ({ state, day: state === 'ended' ? null : 6, typicalLength: 5, autoEnded: state === 'ended' });
const base = { statusToday: today, today, todayFlow: null, enabled: true };

test('the question shows only on the askStill day with nothing logged today', () => {
  assert.deepEqual(heroPeriodState({ ...base, status: status('askStill') }), { onPeriod: false, loggedToday: false, askStill: true });
  for (const state of ['active', 'ended'] as const) {
    assert.equal(heroPeriodState({ ...base, status: status(state) }).askStill, false, state);
  }
});

test('any log today answers it: bleeding → on the period, none / spotting → normal hero', () => {
  assert.deepEqual(heroPeriodState({ ...base, status: status('askStill'), todayFlow: 'light' }), { onPeriod: true, loggedToday: true, askStill: false });
  for (const flow of ['none', 'spotting']) {
    assert.deepEqual(heroPeriodState({ ...base, status: status('askStill'), todayFlow: flow }), { onPeriod: false, loggedToday: false, askStill: false });
    assert.equal(heroPeriodState({ ...base, status: status('active'), todayFlow: flow }).onPeriod, false);
  }
});

test('active with nothing logged yet keeps the hero on the period; ended (auto or not) goes back to normal', () => {
  assert.deepEqual(heroPeriodState({ ...base, status: status('active') }), { onPeriod: true, loggedToday: false, askStill: false });
  assert.deepEqual(heroPeriodState({ ...base, status: status('ended') }), { onPeriod: false, loggedToday: false, askStill: false });
});

test('never outside the classic overview, without a status, or with a status for another day', () => {
  assert.equal(heroPeriodState({ ...base, status: status('askStill'), enabled: false }).askStill, false);
  assert.equal(heroPeriodState({ ...base, status: status('active'), enabled: false }).onPeriod, false);
  assert.equal(heroPeriodState({ ...base, status: null }).askStill, false);
  assert.equal(heroPeriodState({ ...base, status: undefined }).onPeriod, false);
  assert.equal(heroPeriodState({ ...base, status: status('askStill'), statusToday: '2026-09-05' }).askStill, false);
  assert.equal(heroPeriodState({ ...base, status: status('active'), statusToday: null }).onPeriod, false);
  // Logged bleeding is always a period day, gates or not (the old rule).
  assert.equal(heroPeriodState({ ...base, status: null, enabled: false, todayFlow: 'heavy' }).onPeriod, true);
});

test('„კი“ logs the last bleeding level before today, else light', () => {
  const logs = [
    { date: '2026-09-01', flow: 'heavy' },
    { date: '2026-09-03', flow: 'medium' },
    { date: '2026-09-04', flow: 'none' },
    { date: '2026-09-07', flow: 'heavy' },
  ];
  assert.equal(stillBleedingFlow(logs, today), 'medium');
  assert.equal(stillBleedingFlow([{ date: '2026-09-05', flow: 'spotting' }], today), 'light');
  assert.equal(stillBleedingFlow([], today), 'light');
  assert.equal(stillBleedingFlow(null, today), 'light');
});

test('undo of „დასრულდა“ restores the day exactly', () => {
  assert.deepEqual(periodEndUndo({ flow: 'heavy' }), { kind: 'restoreFlow', flow: 'heavy' });
  assert.deepEqual(periodEndUndo({ flow: null }), { kind: 'clearFlow' });
  assert.deepEqual(periodEndUndo(undefined), { kind: 'removeLog' });
  assert.deepEqual(periodEndUndo({ flow: 'none' }), { kind: 'keep' });
});

test('on the question day „მენსტრუაცია დაიწყო“ steps aside; other days the plan is unchanged', () => {
  assert.deepEqual(heroPlanWhileAsking({ primary: 'log', secondary: 'start' }, true), { primary: 'log', secondary: null });
  assert.deepEqual(heroPlanWhileAsking({ primary: 'start', secondary: 'log' }, true), { primary: 'log', secondary: null });
  assert.deepEqual(heroPlanWhileAsking({ primary: 'log', secondary: 'start' }, false), { primary: 'log', secondary: 'start' });
  assert.deepEqual(heroPlanWhileAsking({ primary: 'end', secondary: 'log' }, true), { primary: 'end', secondary: 'log' });
});
