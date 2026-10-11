import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  clockMinutes,
  mergeNight,
  nightChanged,
  nightOf,
  nightTimesProblem,
  plannedBedtime,
  publicNight,
  sleepNightInput,
  sleepPlanInput,
  sleptMinutes,
  suggestedPlan,
} from './sleep.js';
import { fromNoon, nightScore, pickTips, regularityBand, sleepSummary, tipTriggers, toClock } from './sleepInsights.js';
import { SLEEP_TIP_SEED, SLEEP_TIP_TRIGGERS, normalizeSleepConfig } from './sleepContent.js';
import { sleepStatements } from '../../scripts/install-sleep.mjs';
import { readFileSync } from 'node:fs';

const TZ = 'Asia/Tbilisi'; // UTC+4, no DST
const at = (ymd, hhmm) => new Date(`${ymd}T${hhmm}:00+04:00`).toISOString();

describe('MEDISLEEP night date', () => {
  it('a night belongs to the morning it ends (18:00 → 18:00 local days)', () => {
    assert.equal(nightOf(at('2026-10-12', '07:10'), TZ), '2026-10-12');
    assert.equal(nightOf(at('2026-10-12', '16:30'), TZ), '2026-10-12'); // afternoon nap
    assert.equal(nightOf(at('2026-10-12', '18:30'), TZ), '2026-10-13');
    assert.equal(nightOf(at('2026-10-12', '23:55'), TZ), '2026-10-13'); // woke before midnight → next day's night
  });

  it('refuses impossible times', () => {
    const now = new Date('2026-10-12T10:00:00+04:00');
    assert.equal(nightTimesProblem(at('2026-10-11', '23:00'), at('2026-10-12', '07:00'), { now }), null);
    assert.ok(nightTimesProblem(at('2026-10-12', '07:00'), at('2026-10-11', '23:00'), { now }));
    assert.ok(nightTimesProblem(at('2026-10-11', '10:00'), at('2026-10-12', '07:00'), { now })); // 21 h
    assert.ok(nightTimesProblem(at('2026-10-11', '23:00'), at('2026-10-12', '11:00'), { now })); // future
    assert.ok(nightTimesProblem(at('2026-10-11', '23:00'), null, { now }));
  });
});

describe('MEDISLEEP night merge', () => {
  const now = new Date('2026-10-12T08:00:00+04:00');
  const mode = { kind: 'mode', bedAt: at('2026-10-11', '23:10'), wakeAt: at('2026-10-12', '07:05'), sounds: ['rain'] };
  const health = {
    kind: 'health', bedAt: at('2026-10-11', '23:30'), wakeAt: at('2026-10-12', '06:55'),
    asleepMinutes: 412, deepMinutes: 70, remMinutes: 95, coreMinutes: 247, awakeMinutes: 18,
  };

  it('sleep mode sets in-bed time; Health then wins the times and stages', () => {
    const a = mergeNight(null, mode, { now });
    assert.equal(a.inBedMinutes, 475);
    assert.equal(a.timesSource, 'mode');
    assert.deepEqual(a.sounds, ['rain']);
    const b = mergeNight(a, health, { now });
    assert.equal(b.timesSource, 'health');
    assert.equal(b.asleepMinutes, 412);
    assert.equal(b.inBedMinutes, 445);
    assert.deepEqual(b.sounds, ['rain'], 'Health keeps the sounds that played');
    // A later sleep-mode write cannot undo Health's times.
    const c = mergeNight(b, { kind: 'mode', bedAt: at('2026-10-11', '22:00'), wakeAt: at('2026-10-12', '07:00') }, { now });
    assert.equal(c.timesSource, 'health');
    assert.equal(c.asleepMinutes, 412);
  });

  it('a hand edit beats Health and clears its stages', () => {
    const b = mergeNight(mergeNight(null, mode, { now }), health, { now });
    const d = mergeNight(b, { kind: 'manual', bedAt: at('2026-10-11', '22:45'), wakeAt: at('2026-10-12', '06:45') }, { now });
    assert.equal(d.timesSource, 'manual');
    assert.equal(d.inBedMinutes, 480);
    assert.equal(d.asleepMinutes, null);
    assert.equal(d.deepMinutes, null);
    // Health can no longer move what she typed.
    const e = mergeNight(d, health, { now });
    assert.equal(e.inBedMinutes, 480);
  });

  it('Health never touches her check-in; a check-in never touches times', () => {
    const checked = mergeNight(null, { kind: 'checkin', quality: 4, factors: ['caffeine', 'caffeine', 'stress'], wakeups: 1 }, { now });
    assert.deepEqual(checked.factors, ['caffeine', 'stress']);
    assert.equal(checked.bedAt, null);
    assert.ok(checked.checkedInAt);
    const withHealth = mergeNight(checked, { ...health, quality: 1 }, { now });
    assert.equal(withHealth.quality, 4);
    assert.deepEqual(withHealth.factors, ['caffeine', 'stress']);
    assert.equal(withHealth.asleepMinutes, 412);
  });

  it('nightChanged spots no-op writes', () => {
    const a = mergeNight(null, mode, { now });
    const b = mergeNight(a, mode, { now });
    assert.equal(nightChanged(a, b), false);
    assert.equal(nightChanged(a, mergeNight(a, { kind: 'checkin', quality: 3 }, { now })), true);
  });

  it('slept minutes: Health asleep first, else in bed minus the minutes to fall asleep', () => {
    assert.equal(sleptMinutes({ asleepMinutes: 400, inBedMinutes: 480 }), 400);
    assert.equal(sleptMinutes({ asleepMinutes: null, inBedMinutes: 480, latencyMinutes: 30 }), 450);
    assert.equal(sleptMinutes({ inBedMinutes: null }), null);
  });

  it('publicNight exposes stages only when Health gave them', () => {
    const row = { id: 'x', night: new Date('2026-10-12T00:00:00Z'), ...mergeNight(null, mode, { now }) };
    assert.equal(publicNight(row).night, '2026-10-12');
    assert.equal(publicNight(row).stages, null);
    assert.equal(publicNight({ ...row, deepMinutes: 60, remMinutes: 80, coreMinutes: 200 }).stages.deep, 60);
  });
});

describe('MEDISLEEP inputs', () => {
  it('plan bounds', () => {
    assert.ok(sleepPlanInput.safeParse({ goalMinutes: 480, wakeTime: '07:00' }).success);
    assert.equal(sleepPlanInput.safeParse({ goalMinutes: 480, wakeTime: '7:00' }).success, false);
    assert.equal(sleepPlanInput.safeParse({ goalMinutes: 200, wakeTime: '07:00' }).success, false);
    assert.equal(sleepPlanInput.safeParse({ goalMinutes: 480, wakeTime: '07:00', extra: 1 }).success, false);
  });
  it('night input allows only known factors', () => {
    assert.ok(sleepNightInput.safeParse({ kind: 'checkin', quality: 5, factors: ['alcohol'] }).success);
    assert.equal(sleepNightInput.safeParse({ kind: 'checkin', factors: ['tv'] }).success, false);
    assert.equal(sleepNightInput.safeParse({ kind: 'checkin', quality: 6 }).success, false);
  });
});

describe('MEDISLEEP plan suggestion', () => {
  const now = new Date('2026-10-12T00:00:00Z');
  it('uses age and the registration answers', () => {
    const s = suggestedPlan({ birthDate: '1990-05-01', extraAnswers: { sleepBand: '6', sleepFeel: 'fairly-bad' } }, { now });
    assert.equal(s.plan.goalMinutes, 480);
    assert.equal(s.basis.usualHours, 6);
    assert.equal(s.basis.feel, 'fairly-bad');
    assert.equal(suggestedPlan({ birthDate: '1950-01-01' }, { now }).plan.goalMinutes, 450);
    assert.equal(suggestedPlan({}, { now }).basis.age, null);
  });
  it('bedtime = wake − goal − 15 min, weekend wake respected', () => {
    assert.equal(clockMinutes('07:00'), 420);
    assert.equal(plannedBedtime({ goalMinutes: 480, wakeTime: '07:00' }), 22 * 60 + 45);
    assert.equal(plannedBedtime({ goalMinutes: 480, wakeTime: '07:00', weekendWakeTime: '09:00' }, { weekend: true }), 45);
  });
});

describe('MEDISLEEP analytics', () => {
  const plan = { goalMinutes: 480, wakeTime: '07:00' };
  const night = (ymd, bed, wake, extra = {}) => {
    const prev = new Date(Date.parse(`${ymd}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
    const bedDay = bed >= '18:00' ? prev : ymd;
    const bedAt = at(bedDay, bed);
    const wakeAt = at(ymd, wake);
    return { night: ymd, bedAt, wakeAt, inBedMinutes: Math.round((Date.parse(wakeAt) - Date.parse(bedAt)) / 60000), ...extra };
  };

  it('noon-based clock keeps midnight continuous', () => {
    assert.equal(fromNoon(23 * 60 + 30) < fromNoon(30), true);
    assert.equal(toClock(fromNoon(30)), 30);
  });

  it('a steady week scores high, is regular and carries no debt', () => {
    const nights = ['06', '07', '08', '09', '10', '11', '12'].map((d) => night(`2026-10-${d}`, '22:45', '07:00', { quality: 4, checkedInAt: 'x' }));
    const s = sleepSummary(nights, { plan, timeZone: TZ, today: '2026-10-12', days: 7 });
    assert.equal(s.nightsLogged, 7);
    assert.equal(s.avgSleptMinutes, 495);
    assert.equal(s.regularity.band, 'steady');
    assert.equal(s.debtMinutes, 0);
    assert.ok(s.score >= 90, `score ${s.score}`);
    assert.equal(s.avgBedtime, 22 * 60 + 45);
    assert.equal(s.bedtimeVsPlanMinutes, 0);
  });

  it('short, irregular nights build debt, lower the score and pick the matching advice', () => {
    const nights = [
      night('2026-10-06', '01:30', '06:30'), night('2026-10-07', '23:00', '06:30'), night('2026-10-08', '02:00', '06:45'),
      night('2026-10-09', '00:30', '06:30'), night('2026-10-10', '03:00', '10:30'), night('2026-10-11', '02:30', '11:00'),
      night('2026-10-12', '00:45', '06:30'),
    ];
    const s = sleepSummary(nights, { plan, timeZone: TZ, today: '2026-10-12', days: 7 });
    assert.ok(s.debtMinutes > 600, `debt ${s.debtMinutes}`);
    assert.ok(s.score < 70, `score ${s.score}`);
    assert.ok(['variable', 'irregular'].includes(s.regularity.band));
    assert.ok(s.socialJetlagMinutes >= 60, `jetlag ${s.socialJetlagMinutes}`);
    const triggers = tipTriggers(s);
    for (const t of ['short', 'late', 'weekend']) assert.ok(triggers.includes(t), t);
    const tips = pickTips(SLEEP_TIP_SEED, s);
    assert.equal(tips.length, 3);
    assert.equal(tips[0].trigger, 'short');
  });

  it('a factor effect needs three nights on each side and a real difference', () => {
    const nights = [];
    for (let i = 1; i <= 10; i++) {
      const ymd = `2026-10-${String(i + 2).padStart(2, '0')}`;
      const coffee = i % 2 === 0;
      nights.push(night(ymd, coffee ? '23:50' : '22:50', '07:00', { factors: coffee ? ['caffeine'] : [], quality: coffee ? 2 : 4, checkedInAt: 'x' }));
    }
    const s = sleepSummary(nights, { plan, timeZone: TZ, today: '2026-10-12', days: 30 });
    assert.equal(s.factorEffects[0].factor, 'caffeine');
    assert.equal(s.factorEffects[0].sleptDiff, -60);
    assert.equal(s.factorEffects[0].qualityDiff, -2);
    assert.ok(tipTriggers(s).includes('caffeine'));
  });

  it('a night without a check-in is not punished (weights re-balance)', () => {
    const plain = night('2026-10-12', '22:45', '07:00');
    assert.equal(nightScore({ night: '2026-10-12', slept: 495, mid: null, quality: null }, [], plan), 100);
    assert.equal(regularityBand(null), null);
    assert.ok(plain);
  });

  it('steps effect compares active and quiet days (needs 8 nights)', () => {
    const nights = [];
    const steps = {};
    for (let i = 1; i <= 10; i++) {
      const ymd = `2026-10-${String(i + 2).padStart(2, '0')}`;
      const prev = `2026-10-${String(i + 1).padStart(2, '0')}`;
      const active = i % 2 === 1;
      steps[prev] = active ? 11000 : 3000;
      nights.push(night(ymd, active ? '22:45' : '23:30', '07:00'));
    }
    const s = sleepSummary(nights, { plan, timeZone: TZ, today: '2026-10-12', days: 30, stepsByDay: steps });
    assert.equal(s.stepsEffect.sleptDiff, 45);
  });
});

describe('MEDISLEEP content and install', () => {
  it('every seeded tip has a known trigger, both languages and a unique id', () => {
    const ids = new Set();
    for (const tip of SLEEP_TIP_SEED) {
      assert.ok(SLEEP_TIP_TRIGGERS.includes(tip.trigger), tip.id);
      assert.ok(tip.titleKa && tip.titleEn && tip.bodyKa && tip.bodyEn, tip.id);
      assert.doesNotMatch(tip.titleEn + tip.bodyEn, /[Ⴀ-ჿ]/, `${tip.id} English has Georgian`);
      assert.ok(!ids.has(tip.id));
      ids.add(tip.id);
    }
    assert.ok(SLEEP_TIP_SEED.some((t) => t.trigger === 'always'));
  });

  it('config normalisation keeps values in range', () => {
    const c = normalizeSleepConfig({ defaultTimerMinutes: 9999, maxLayers: 0, checkinFactors: ['caffeine', 'nope'], timerOptions: [30, 30, -5] });
    assert.equal(c.defaultTimerMinutes, 45);
    assert.equal(c.maxLayers, 3);
    assert.deepEqual(c.checkinFactors, ['caffeine']);
    assert.deepEqual(c.timerOptions, [30]);
  });

  it('the install SQL is additive and only touches Sleep* tables', () => {
    const sql = readFileSync(new URL('../../prisma/20261012-sleep.sql', import.meta.url), 'utf8');
    const statements = sleepStatements(sql);
    assert.ok(statements.length >= 9);
    assert.throws(() => sleepStatements('DROP TABLE "SleepNight";'));
    assert.throws(() => sleepStatements('CREATE TABLE IF NOT EXISTS "User" (id TEXT);'));
  });
});
