import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CYCLE_DEFAULT_ON_TYPES,
  CYCLE_OPTIONAL_TYPES,
  CYCLE_REMINDER_DEFAULTS,
  PERIOD_LATE_AFTER_DAYS,
  resolveCycleReminderPrefs,
} from './cycleReminderDefaults.ts';

test('fresh install: only the period family is on (brief §9 item 5)', () => {
  const p = resolveCycleReminderPrefs({});
  assert.equal(p.enabled, true);
  assert.equal(p.periodDaysBefore, 2);
  assert.equal(p.periodLate, true);
  assert.equal(p.ovulation, false);
  assert.equal(p.pms, false);
  assert.equal(p.dailyLog, false);
  assert.equal(p.opk, false);
  assert.equal(p.bbt, false);
  assert.equal(p.maskNotifications, false);
  assert.equal(p.maskStyle, 'neutral');
  assert.deepEqual(p, CYCLE_REMINDER_DEFAULTS);
});

test('TRY_TO_CONCEIVE profiles default ovulation + fertile reminders on; nothing else changes', () => {
  const ttc = resolveCycleReminderPrefs({}, 'TRY_TO_CONCEIVE');
  assert.equal(ttc.ovulation, true);
  assert.equal(ttc.pms, false);
  assert.equal(ttc.dailyLog, false);
  assert.equal(ttc.opk, false);
  for (const mode of ['TRACK_PERIOD', 'PREGNANCY', 'PERIMENOPAUSE', 'POSTPARTUM', null, undefined]) {
    assert.equal(resolveCycleReminderPrefs({}, mode).ovulation, false, `mode ${mode}`);
  }
});

test('a saved value always wins over the default, whatever the mode', () => {
  const kept = resolveCycleReminderPrefs(
    { ovulation: '1', pms: '1', dailyLog: '1', periodLate: '0', enabled: '0', maskNotifications: '1', maskStyle: 'notes' },
    'TRACK_PERIOD',
  );
  assert.equal(kept.ovulation, true);
  assert.equal(kept.pms, true);
  assert.equal(kept.dailyLog, true);
  assert.equal(kept.periodLate, false);
  assert.equal(kept.enabled, false);
  assert.equal(kept.maskNotifications, true);
  assert.equal(kept.maskStyle, 'notes');
  // A woman who switched ovulation off before moving to TTC keeps it off.
  assert.equal(resolveCycleReminderPrefs({ ovulation: '0' }, 'TRY_TO_CONCEIVE').ovulation, false);
});

test('periodDaysBefore: a stored 0 stays 0 (no period-soon reminder), garbage falls back, range 0–5', () => {
  assert.equal(resolveCycleReminderPrefs({ periodDaysBefore: '0' }).periodDaysBefore, 0);
  assert.equal(resolveCycleReminderPrefs({ periodDaysBefore: '3' }).periodDaysBefore, 3);
  assert.equal(resolveCycleReminderPrefs({ periodDaysBefore: '9' }).periodDaysBefore, 5);
  assert.equal(resolveCycleReminderPrefs({ periodDaysBefore: 'x' }).periodDaysBefore, 2);
  assert.equal(resolveCycleReminderPrefs({ periodDaysBefore: null }).periodDaysBefore, 2);
  assert.equal(resolveCycleReminderPrefs({ maskStyle: 'bogus' }).maskStyle, 'neutral');
});

test('families are declared and disjoint; the late check-in waits two days', () => {
  assert.deepEqual([...CYCLE_DEFAULT_ON_TYPES], ['period_soon', 'period_start', 'period_late']);
  for (const t of CYCLE_OPTIONAL_TYPES) assert.equal((CYCLE_DEFAULT_ON_TYPES as readonly string[]).includes(t), false);
  assert.equal(PERIOD_LATE_AFTER_DAYS, 2);
});
