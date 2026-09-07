'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  SMART_CONTEXT_KEYS,
  movementContextState,
  smartContextSeed,
  weatherContextKey,
  whyTargetKind,
  showWhyTarget,
} = require('./smartContext.js');
const { pickStableVariant } = require('./logic.js');
const { questCopy } = require('../../i18n/quest/catalog.js');

function move(overrides = {}) {
  return {
    kind: 'movement',
    status: 'ACTIVE',
    reasonKey: 'PERSONAL_BASELINE',
    targetSource: 'PERSONALIZED',
    progressPercent: 30,
    hour: 14,
    weather: null,
    loggedPain: false,
    ...overrides,
  };
}

describe('phase 5 movement context state', () => {
  it('only active movement quests get a context line', () => {
    assert.equal(movementContextState(move({ kind: 'hydration' })), null);
    assert.equal(movementContextState(move({ kind: 'medi' })), null);
    assert.equal(movementContextState(move({ status: 'COMPLETED' })), null);
    assert.equal(movementContextState(move({ status: 'CLAIMED' })), null);
    assert.equal(movementContextState(move()).key, 'PERSONAL_BASELINE');
  });

  it('pain suppression beats everything, including outdoor encouragement (§26)', () => {
    const state = movementContextState(
      move({
        loggedPain: true,
        progressPercent: 90,
        weather: { category: 'excellent_outdoor', severity: 'calm', bestOutdoorWindow: { start: '16:00', end: '18:00' } },
      }),
    );
    assert.equal(state.key, 'PAIN_NEUTRAL');
  });

  it('comeback copy wins over weather and progress (§29)', () => {
    const state = movementContextState(
      move({
        reasonKey: 'COMEBACK_EASY',
        targetSource: 'COMEBACK',
        weather: { category: 'rainy', severity: 'caution', bestOutdoorWindow: null },
      }),
    );
    assert.equal(state.key, 'COMEBACK_EASY');
  });

  it('evening pressure rule: after 20:00 with <50% → gentle, numeric progress untouched (§68)', () => {
    assert.equal(movementContextState(move({ hour: 20, progressPercent: 49 })).key, 'EVENING_GENTLE');
    assert.equal(movementContextState(move({ hour: 23, progressPercent: 10 })).key, 'EVENING_GENTLE');
    assert.notEqual(movementContextState(move({ hour: 20, progressPercent: 50 })).key, 'EVENING_GENTLE');
    assert.notEqual(movementContextState(move({ hour: 19, progressPercent: 49 })).key, 'EVENING_GENTLE');
  });

  it('near completion: ≥80% before 20:00, no fear-based copy after 20:00 (§69)', () => {
    assert.equal(movementContextState(move({ hour: 17, progressPercent: 80 })).key, 'NEAR_COMPLETION');
    assert.notEqual(movementContextState(move({ hour: 20, progressPercent: 85 })).key, 'NEAR_COMPLETION');
    assert.notEqual(movementContextState(move({ hour: 17, progressPercent: 79 })).key, 'NEAR_COMPLETION');
  });

  it('weather shapes copy only: rain / UV / wind / severe / good window (§23–§25)', () => {
    const w = (category, severity = 'caution', bestOutdoorWindow = null) => ({ category, severity, bestOutdoorWindow });
    assert.equal(movementContextState(move({ weather: w('rainy') })).key, 'RAIN_INDOOR');
    assert.equal(movementContextState(move({ weather: w('rain_soon') })).key, 'RAIN_INDOOR');
    assert.equal(movementContextState(move({ weather: w('heavy_rain') })).key, 'RAIN_INDOOR');
    assert.equal(movementContextState(move({ weather: w('high_uv') })).key, 'HIGH_UV');
    assert.equal(movementContextState(move({ weather: w('very_hot') })).key, 'HIGH_UV');
    assert.equal(movementContextState(move({ weather: w('very_windy') })).key, 'WINDY');
    assert.equal(movementContextState(move({ weather: w('storm', 'avoid') })).key, 'SEVERE_INDOOR');
    assert.equal(movementContextState(move({ weather: w('cold', 'avoid') })).key, 'SEVERE_INDOOR');

    const good = movementContextState(
      move({ weather: w('good_outdoor', 'calm', { start: '16:00', end: '18:00' }) }),
    );
    assert.equal(good.key, 'GOOD_WEATHER_WINDOW');
    assert.deepEqual(good.window, { start: '16:00', end: '18:00' });
  });

  it('weather unavailable / stale / unremarkable → quest still works, context falls through (§34)', () => {
    assert.equal(weatherContextKey(null), null);
    assert.equal(weatherContextKey({ category: 'rainy', severity: 'caution', stale: true }), null);
    assert.equal(weatherContextKey({ category: 'okay_outdoor', severity: 'calm' }), null);
    // good outdoor but no canonical window → no second best-window algorithm (§33)
    assert.equal(weatherContextKey({ category: 'good_outdoor', severity: 'calm', bestOutdoorWindow: null }), null);
    assert.equal(movementContextState(move({ weather: null })).key, 'PERSONAL_BASELINE');
  });

  it('struggling → achievable copy; default targets get morning/default lines', () => {
    assert.equal(movementContextState(move({ reasonKey: 'STRUGGLING_ADJUSTED' })).key, 'STRUGGLING_ADJUSTED');
    const def = { reasonKey: 'DEFAULT_TARGET', targetSource: 'DEFAULT' };
    assert.equal(movementContextState(move({ ...def, hour: 9 })).key, 'MORNING_CALM');
    assert.equal(movementContextState(move({ ...def, hour: 14 })).key, 'DEFAULT_TARGET');
  });
});

describe('phase 5 copy rotation & catalog', () => {
  it('rotation is deterministic per quest/day/context (§66)', () => {
    const variants = ['a', 'b', 'c', 'd'];
    const seed = smartContextSeed('quest-1', '2026-09-06', 'PERSONAL_BASELINE');
    const picked = pickStableVariant(variants, seed);
    for (let i = 0; i < 5; i += 1) assert.equal(pickStableVariant(variants, seed), picked);
    // a different day may rotate — seed changes deterministically
    assert.notEqual(seed, smartContextSeed('quest-1', '2026-09-07', 'PERSONAL_BASELINE'));
  });

  it('every context key has copy in all four locales (§65)', () => {
    for (const locale of ['ka', 'en', 'fr', 'ru']) {
      const copy = questCopy(locale);
      for (const key of SMART_CONTEXT_KEYS) {
        if (key === 'GOOD_WEATHER_WINDOW') {
          const lines = copy.smartWindow('16:00', '18:00');
          assert.ok(Array.isArray(lines) && lines.length >= 2, `${locale} smartWindow`);
          assert.ok(lines.every((line) => line.includes('16:00') && line.includes('18:00')));
          continue;
        }
        const variants = copy.smart[key];
        assert.ok(Array.isArray(variants) && variants.length >= 2, `${locale} smart.${key}`);
        assert.ok(variants.every((line) => typeof line === 'string' && line.length > 0));
      }
      assert.ok(copy.whyTarget.button.length > 0, `${locale} whyTarget.button`);
      for (const kind of ['personalized', 'comeback', 'default']) {
        assert.ok(copy.whyTarget[kind].length > 0, `${locale} whyTarget.${kind}`);
      }
    }
  });

  it('common contexts offer 3–5 variants for rotation (§66)', () => {
    const copy = questCopy('ka');
    for (const key of ['PERSONAL_BASELINE', 'DEFAULT_TARGET', 'COMEBACK_EASY', 'EVENING_GENTLE', 'NEAR_COMPLETION', 'RAIN_INDOOR']) {
      assert.ok(copy.smart[key].length >= 3 && copy.smart[key].length <= 5, key);
    }
  });

  it('no false medical personalization in any smart line (§37)', () => {
    const banned = [/ჯანმრთელობ/i, /დიაგნოზ/i, /ექიმ/i, /health/i, /condition/i, /doctor/i, /médec/i, /santé/i, /diagnos/i, /здоров/i, /врач/i, /диагноз/i];
    for (const locale of ['ka', 'en', 'fr', 'ru']) {
      const copy = questCopy(locale);
      const all = [
        ...Object.values(copy.smart).flat(),
        ...copy.smartWindow('16:00', '18:00'),
        copy.whyTarget.personalized,
        copy.whyTarget.comeback,
        copy.whyTarget.default,
      ];
      for (const line of all) {
        for (const pattern of banned) {
          assert.ok(!pattern.test(line), `${locale}: "${line}" matches ${pattern}`);
        }
      }
    }
  });
});

describe('phase 5 why-target affordance', () => {
  it('maps targetSource to the sheet flavor without technical labels (§46)', () => {
    assert.equal(whyTargetKind('PERSONALIZED'), 'personalized');
    assert.equal(whyTargetKind('COMEBACK'), 'comeback');
    assert.equal(whyTargetKind('DEFAULT'), 'default');
    assert.equal(whyTargetKind(null), 'default');
  });

  it('shows only for active quests that actually carry smart metadata', () => {
    assert.equal(showWhyTarget({ status: 'ACTIVE', targetSource: 'PERSONALIZED' }), true);
    assert.equal(showWhyTarget({ status: 'ACTIVE', targetSource: 'COMEBACK' }), true);
    assert.equal(showWhyTarget({ status: 'ACTIVE', targetSource: null }), false);
    assert.equal(showWhyTarget({ status: 'COMPLETED', targetSource: 'PERSONALIZED' }), false);
    assert.equal(showWhyTarget(null), false);
  });
});
