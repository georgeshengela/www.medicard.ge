import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  heroPeriodState,
  heroPlanWhileAsking,
  lastPeriodToRestore,
  periodEndUndo,
  periodStartUndo,
  stillBleedingFlow,
} from './cyclePeriodStatus.ts';

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

test('undo of the one-tap „მენსტრუაცია დაიწყო“ restores the day exactly (CYC-04)', () => {
  // No log before the tap: the row the start created goes away.
  assert.deepEqual(periodStartUndo(undefined, null), { day: { kind: 'removeLog' }, lastPeriodStart: null });
  assert.deepEqual(periodStartUndo(null, '2026-09-10'), { day: { kind: 'removeLog' }, lastPeriodStart: '2026-09-10' });
  // A spotting-only day stays spotting (it is never deleted), „none“ stays „none“.
  assert.deepEqual(periodStartUndo({ flow: 'spotting' }, '2026-09-10'), {
    day: { kind: 'restoreFlow', flow: 'spotting' },
    lastPeriodStart: '2026-09-10',
  });
  assert.deepEqual(periodStartUndo({ flow: 'none' }, null), { day: { kind: 'restoreFlow', flow: 'none' }, lastPeriodStart: null });
  // A day with only moods / cramps gets its empty flow back — never a false „no bleeding“.
  assert.deepEqual(periodStartUndo({ flow: null }, '2026-09-06'), { day: { kind: 'restoreFlow', flow: null }, lastPeriodStart: '2026-09-06' });
  assert.deepEqual(periodStartUndo({}, null), { day: { kind: 'restoreFlow', flow: null }, lastPeriodStart: null });
  // Bleeding was already logged: the start changed nothing, so the undo changes nothing (never „end“).
  for (const flow of ['light', 'medium', 'heavy']) {
    assert.deepEqual(periodStartUndo({ flow }, '2026-09-06'), { day: { kind: 'keep' }, lastPeriodStart: null }, flow);
  }
});

test('undo of the one-tap start writes back the last period start only when the server lost it', () => {
  const undo = periodStartUndo(null, '2026-09-10');
  // The onboarding date the tap replaced: the server fell back to nothing or an older logged start.
  assert.equal(lastPeriodToRestore(undo, null), '2026-09-10');
  assert.equal(lastPeriodToRestore(undo, '2026-08-01'), '2026-09-10');
  assert.equal(lastPeriodToRestore(undo, '2026-09-06'), '2026-09-10');
  // She answered „today“ in onboarding and then tapped the start: today is still her start.
  assert.equal(lastPeriodToRestore(periodStartUndo(null, '2026-09-06'), null), '2026-09-06');
  // Already right, nothing before, or nothing was changed by the tap.
  assert.equal(lastPeriodToRestore(undo, '2026-09-10'), null);
  assert.equal(lastPeriodToRestore(periodStartUndo(null, null), null), null);
  assert.equal(lastPeriodToRestore(periodStartUndo({ flow: 'heavy' }, '2026-09-10'), null), null);
});
