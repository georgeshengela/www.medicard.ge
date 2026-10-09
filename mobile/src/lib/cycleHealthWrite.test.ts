import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { continuesLoggedPeriod, planCycleHealthWrite } from './cycleHealthWrite.ts';
import { EMPTY_CYCLE_LOG, formFromCycleLog } from './cycleLogForm.ts';
import type { CycleLog } from './api.ts';

const D = '2026-10-07';
const log = (date: string, patch: Partial<CycleLog> = {}): CycleLog =>
  ({ date, flow: null, symptoms: [], moods: [], sexualActivity: null, libido: null, bbt: null, cervicalMucus: null, notes: null, ...patch }) as CycleLog;
// Period from 10-05: day 1, 2 and today (day 3) bleeding.
const LOGS = [log('2026-10-05', { flow: 'heavy' }), log('2026-10-06', { flow: 'medium' }), log(D, { flow: 'medium' })];

test('CYC-03: a mood on period day 3 writes nothing (no new cycle start, no duplicate flow)', () => {
  const base = formFromCycleLog(LOGS[2]);
  assert.equal(planCycleHealthWrite({ date: D, form: { ...base, moods: ['calm'] } as typeof base, base, continuesPeriod: continuesLoggedPeriod(LOGS, D) }), null);
});

test('CYC-03: the ♥ one-tap and its undo on a bleeding day write nothing', () => {
  const before = formFromCycleLog(LOGS[2]);
  assert.equal(planCycleHealthWrite({ date: D, form: { ...before, sexual: true }, base: before, continuesPeriod: true }), null);
  assert.equal(planCycleHealthWrite({ date: D, form: before, base: before, continuesPeriod: true }), null);
});

test('CYC-03: re-saving the same day twice writes nothing the second time', () => {
  const base = formFromCycleLog(log(D, { flow: 'medium', bbt: 36.6, cervicalMucus: 'creamy' }));
  assert.equal(planCycleHealthWrite({ date: D, form: { ...base }, base, continuesPeriod: false }), null);
  // The same BBT typed again in another notation is the same value.
  assert.equal(planCycleHealthWrite({ date: D, form: { ...base, bbt: '36,60' }, base, continuesPeriod: false }), null);
});

test('CYC-03: day 1 of a new period is a cycle start — from the button or from bleeding after a dry day', () => {
  const empty = formFromCycleLog(undefined);
  assert.deepEqual(planCycleHealthWrite({ date: D, form: { ...empty, flow: 'medium' }, base: empty, markStart: true }), {
    date: D,
    flow: 'medium',
    bbt: null,
    cervicalMucus: null,
    isPeriodStart: true,
  });
  const inferred = planCycleHealthWrite({ date: D, form: { ...empty, flow: 'light' }, base: empty, continuesPeriod: continuesLoggedPeriod([log('2026-10-06', { flow: 'none' })], D) });
  assert.equal(inferred?.isPeriodStart, true);
  assert.equal(inferred?.flow, 'light');
  // No bleeding logged in the days before is a new period too.
  assert.equal(planCycleHealthWrite({ date: D, form: { ...empty, flow: 'light' }, base: empty, continuesPeriod: continuesLoggedPeriod([], D) })?.isPeriodStart, true);
});

test('CYC-03: bleeding added on day 3 after day 2 bled is flow only, never a start', () => {
  const empty = formFromCycleLog(undefined);
  const plan = planCycleHealthWrite({ date: D, form: { ...empty, flow: 'medium' }, base: empty, continuesPeriod: continuesLoggedPeriod(LOGS, D) });
  assert.deepEqual(plan, { date: D, flow: 'medium', bbt: null, cervicalMucus: null, isPeriodStart: false });
  // A changed flow on a day that already bled: the new flow, no start.
  const heavier = planCycleHealthWrite({ date: D, form: { ...formFromCycleLog(LOGS[2]), flow: 'heavy' }, base: formFromCycleLog(LOGS[2]), continuesPeriod: false });
  assert.deepEqual(heavier, { date: D, flow: 'heavy', bbt: null, cervicalMucus: null, isPeriodStart: false });
});

test('CYC-03: a skipped logging day inside a period is never a new cycle start (the server bridges it)', () => {
  const empty = formFromCycleLog(undefined);
  const plan = (logs: CycleLog[]) =>
    planCycleHealthWrite({ date: D, form: { ...empty, flow: 'medium' }, base: empty, continuesPeriod: continuesLoggedPeriod(logs, D) });
  // Day 1 bled, day 2 not logged, day 3 bleeds: one period — flow only.
  assert.deepEqual(plan([log('2026-10-05', { flow: 'heavy' })]), { date: D, flow: 'medium', bbt: null, cervicalMucus: null, isPeriodStart: false });
  // Two unlogged days, or spotting in between, still continue it.
  assert.equal(plan([log('2026-10-04', { flow: 'light' })])?.isPeriodStart, false);
  assert.equal(plan([log('2026-10-04', { flow: 'light' }), log('2026-10-05', { flow: 'spotting' }), log('2026-10-06', { flow: 'spotting' })])?.isPeriodStart, false);
  // Three days without bleeding, or an explicit „no bleeding“ day in between: a new period.
  assert.equal(plan([log('2026-10-03', { flow: 'heavy' })])?.isPeriodStart, true);
  assert.equal(plan([log('2026-10-05', { flow: 'heavy' }), log('2026-10-06', { flow: 'none' })])?.isPeriodStart, true);
  assert.equal(continuesLoggedPeriod([log('2026-10-04', { flow: 'heavy' }), log('2026-10-05', { flow: 'none' })], D), false);
  assert.equal(continuesLoggedPeriod(undefined, D), undefined);
  assert.equal(continuesLoggedPeriod([], 'not-a-date'), undefined);
});

test('CYC-03: unknown logs or an unknown stored day never infer a start', () => {
  const empty = formFromCycleLog(undefined);
  assert.equal(planCycleHealthWrite({ date: D, form: { ...empty, flow: 'medium' }, base: empty, continuesPeriod: continuesLoggedPeriod(undefined, D) })?.isPeriodStart, false);
  assert.equal(planCycleHealthWrite({ date: D, form: { ...empty, flow: 'medium' }, continuesPeriod: false })?.isPeriodStart, false);
  // The button still says so.
  assert.equal(planCycleHealthWrite({ date: D, form: { ...empty, flow: 'medium' }, markStart: true })?.isPeriodStart, true);
});

test('CYC-03: only the changed sample type is written', () => {
  const base = formFromCycleLog(log(D, { flow: 'medium', bbt: 36.5, cervicalMucus: 'sticky' }));
  assert.deepEqual(planCycleHealthWrite({ date: D, form: { ...base, bbt: '36.7' }, base, continuesPeriod: true }), {
    date: D,
    flow: null,
    bbt: 36.7,
    cervicalMucus: null,
    isPeriodStart: false,
  });
  assert.deepEqual(planCycleHealthWrite({ date: D, form: { ...base, mucus: 'eggwhite' }, base, continuesPeriod: true }), {
    date: D,
    flow: null,
    bbt: null,
    cervicalMucus: 'eggwhite',
    isPeriodStart: false,
  });
  // Clearing a value writes nothing (Medicard never deletes Health samples).
  assert.equal(planCycleHealthWrite({ date: D, form: { ...base, flow: 'none', bbt: '', mucus: null }, base, continuesPeriod: false }), null);
});

test('CYC-03: spotting is written once; a BBT that came from Health is never written back', () => {
  const empty = { ...EMPTY_CYCLE_LOG };
  assert.equal(planCycleHealthWrite({ date: D, form: { ...empty, flow: 'spotting' }, base: empty, continuesPeriod: false })?.flow, 'spotting');
  assert.equal(planCycleHealthWrite({ date: D, form: { ...empty, flow: 'spotting' }, base: { ...empty, flow: 'spotting' }, continuesPeriod: false }), null);
  const imported = formFromCycleLog(log(D, { bbt: 36.4, observations: { bbtSource: 'health' } } as Partial<CycleLog>));
  assert.equal(imported.bbtFromHealth, 36.4);
  assert.equal(planCycleHealthWrite({ date: D, form: imported, base: { ...empty } }), null);
});

test('CYC-03: the save path is fire-and-forget and gated on the plan', () => {
  const save = readFileSync(new URL('./cycleLogSave.ts', import.meta.url), 'utf8');
  // Never awaited: Health can never delay or fail the cycle save.
  assert.doesNotMatch(save, /await\s+syncCycleLogToHealth/);
  assert.match(save, /if \(health\) void syncCycleLogToHealth\(health\)\.catch\(\(\) => undefined\)/);
  assert.match(save, /cyclePersistFeedback\(result\) !== 'fail'/);
  // The old rule (every bleeding day is a start) is gone; the planner decides.
  assert.doesNotMatch(save, /isPeriodStart:/);
  // This path never asks for Health access.
  assert.doesNotMatch(save, /connectHealth|requestAuthorization|requestPermission/);
  // HealthKit gets an explicit start flag on every flow sample (true only for a real start).
  const ios = readFileSync(new URL('./healthSyncPlatform.ios.ts', import.meta.url), 'utf8');
  assert.match(ios, /\{ HKMenstrualCycleStart: payload\.isPeriodStart === true \}/);
});
