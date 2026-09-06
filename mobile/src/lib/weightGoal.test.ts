import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  PACE_KG,
  buildWeightProgress,
  clampKg,
  deadlineFromPace,
  kgToLb,
  lbToKg,
  paceFromSlider,
  recommendWeightPace,
  resolveCurrentWeightKg,
  sliderFromPace,
} from './weightGoal.shared.ts';

describe('weightGoal math', () => {
  it('clamps and converts units', () => {
    assert.equal(clampKg(10), 30);
    assert.equal(clampKg(300), 250);
    assert.equal(Math.round(kgToLb(76.5)), 169);
    assert.equal(lbToKg(kgToLb(80)), 80);
  });

  it('maps slider thirds onto slow / moderate / fast', () => {
    assert.equal(paceFromSlider(0.1), 'slow');
    assert.equal(paceFromSlider(0.5), 'moderate');
    assert.equal(paceFromSlider(0.9), 'fast');
    assert.equal(sliderFromPace('fast'), 1);
    assert.ok(sliderFromPace('moderate') > sliderFromPace('slow'));
  });

  it('recommends a cautious pace for older or low-BMI loss', () => {
    const older = recommendWeightPace({
      startKg: 82,
      targetKg: 74,
      bmi: 27,
      age: 64,
      activityLevel: 'MODERATE',
    }, '2026-09-06');
    assert.equal(older.pace, 'slow');
    assert.ok(older.reasonKeys.includes('age'));
    assert.equal(older.deadlineYmd, deadlineFromPace(82, 74, 'slow', '2026-09-06'));

    const low = recommendWeightPace({
      startKg: 52,
      targetKg: 49,
      bmi: 18.2,
      age: 28,
    }, '2026-09-06');
    assert.equal(low.pace, 'slow');
    assert.ok(low.reasonKeys.includes('underweight'));
  });

  it('recommends moderate for a typical loss and never invents a year-long default', () => {
    const rec = recommendWeightPace({
      startKg: 78,
      targetKg: 72,
      bmi: 26.4,
      age: 32,
      activityLevel: 'MODERATE',
      fitnessLevel: 3,
    }, '2026-09-06');
    assert.equal(rec.pace, 'moderate');
    assert.equal(rec.weeks, Math.ceil(6 / 0.5));
    assert.ok(rec.weeks < 30);
  });

  it('builds progress toward a lower target', () => {
    const progress = buildWeightProgress(
      {
        id: 'g1',
        targetKg: 72,
        startKg: 75,
        startedYmd: '2026-08-01',
        deadlineYmd: deadlineFromPace(75, 72, 'moderate'),
        pace: 'moderate',
        paceKgPerWeek: PACE_KG.moderate,
        reminderEnabled: true,
        reminderDays: [1, 3],
        reminderHour: 12,
        reminderMinute: 0,
      },
      73.5,
    );
    assert.equal(progress.remaining, 1.5);
    assert.ok(progress.percent >= 40);
    assert.equal(progress.completed, false);
  });

  it('uses live metric/profile when a stale seed disagrees', () => {
    const logs = [{ id: 'wseed-2026-09-06-0', kg: 139, date: '2026-09-06' }];
    assert.equal(resolveCurrentWeightKg(logs, 133, 133, '2026-09-06'), 133);
    assert.equal(resolveCurrentWeightKg(logs, null, 133, '2026-09-06'), 133);
  });

  it('keeps today\'s user log as current weight', () => {
    const logs = [{ id: 'wlog-1', kg: 133, date: '2026-09-06' }];
    assert.equal(resolveCurrentWeightKg(logs, 139, 139, '2026-09-06'), 139);
    assert.equal(resolveCurrentWeightKg(logs, 133, 139, '2026-09-06'), 133);
  });

  it('marks a goal complete near the target', () => {
    const progress = buildWeightProgress(
      {
        id: 'g2',
        targetKg: 72,
        startKg: 75,
        startedYmd: '2026-08-01',
        deadlineYmd: '2026-10-01',
        pace: 'fast',
        paceKgPerWeek: PACE_KG.fast,
        reminderEnabled: false,
        reminderDays: [],
        reminderHour: 8,
        reminderMinute: 0,
      },
      72.1,
    );
    assert.equal(progress.completed, true);
  });
});
