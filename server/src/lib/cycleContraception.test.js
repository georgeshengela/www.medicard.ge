import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildPredictions, inferCycleStats, toDateKey } from './cycle.js';
import { buildCycleAiUserPrompt } from './cycle.js';
import { buildPartnerPayload, partnerPayloadHasLeak } from './cycleShare.js';
import { CYCLE_CONTRACEPTION_AI_RULES } from './cycleHonesty.js';
import {
  CONTRACEPTION_METHODS,
  interpretContraception,
  isContraceptionMethod,
  normalizeContraceptionMethod,
  predictionAvailabilityFor,
  presentPredictions,
  presentTodayPhase,
} from './cycleContraception.js';

const LMP = '2026-08-01';

function enginePredictions() {
  return buildPredictions({
    lastPeriodStart: LMP,
    avgCycleLength: 28,
    avgPeriodLength: 5,
    cycleCount: 3,
    logs: [{ date: LMP, flow: 'medium' }],
  });
}

describe('contraception data model', () => {
  it('covers every supported method enum', () => {
    assert.deepEqual(CONTRACEPTION_METHODS, [
      'NONE',
      'COMBINED_PILL',
      'PROGESTIN_PILL',
      'HORMONAL_IUD',
      'COPPER_IUD',
      'IMPLANT',
      'INJECTION',
      'PATCH',
      'VAGINAL_RING',
      'BARRIER',
      'FERTILITY_AWARENESS',
      'OTHER',
    ]);
    for (const method of CONTRACEPTION_METHODS) {
      assert.equal(isContraceptionMethod(method), true);
    }
  });

  it('treats null/empty as unset, not NONE', () => {
    assert.equal(normalizeContraceptionMethod(null), null);
    assert.equal(normalizeContraceptionMethod(''), null);
    const unset = interpretContraception({});
    const none = interpretContraception({ contraceptionMethod: 'NONE' });
    assert.equal(unset.set, false);
    assert.equal(unset.method, null);
    assert.equal(unset.predictionAvailability, 'NORMAL');
    assert.equal(none.set, true);
    assert.equal(none.method, 'NONE');
    assert.equal(none.predictionAvailability, 'NORMAL');
  });

  it('rejects invalid enum values', () => {
    assert.equal(normalizeContraceptionMethod('pill'), null);
    assert.equal(normalizeContraceptionMethod('SAFE_DAYS'), null);
    assert.equal(isContraceptionMethod('combined oral pill'), false);
  });

  it('keeps optional start date and drops invalid dates', () => {
    const withDate = interpretContraception({
      contraceptionMethod: 'BARRIER',
      contraceptionStartedAt: '2026-03-01',
    });
    assert.equal(withDate.startedAt, '2026-03-01');
    const unknown = interpretContraception({
      contraceptionMethod: 'BARRIER',
      contraceptionStartedAt: 'March 2026',
    });
    assert.equal(unknown.startedAt, null);
  });
});

describe('prediction availability mapping', () => {
  it('NONE and unset stay NORMAL', () => {
    assert.equal(predictionAvailabilityFor(null), 'NORMAL');
    assert.equal(predictionAvailabilityFor('NONE'), 'NORMAL');
  });

  it('barrier stays NORMAL', () => {
    assert.equal(interpretContraception({ contraceptionMethod: 'BARRIER' }).predictionAvailability, 'NORMAL');
    assert.equal(interpretContraception({ contraceptionMethod: 'BARRIER' }).presentation.showFertileWindow, true);
  });

  it('copper IUD does not disable natural-cycle fertility estimates', () => {
    const ctx = interpretContraception({ contraceptionMethod: 'COPPER_IUD' });
    assert.equal(ctx.predictionAvailability, 'NORMAL');
    assert.equal(ctx.presentation.showOvulationDate, true);
    assert.equal(ctx.presentation.emphasizeFertility, true);
  });

  it('combined pill / implant / injection are LIMITED', () => {
    for (const method of ['COMBINED_PILL', 'IMPLANT', 'INJECTION', 'PATCH', 'VAGINAL_RING', 'PROGESTIN_PILL']) {
      const ctx = interpretContraception({ contraceptionMethod: method });
      assert.equal(ctx.predictionAvailability, 'LIMITED', method);
      assert.equal(ctx.presentation.showFertilityMarkers, false, method);
      assert.equal(ctx.presentation.showOvulationDate, false, method);
    }
  });

  it('hormonal IUD is CAUTION, not LIMITED', () => {
    const ctx = interpretContraception({ contraceptionMethod: 'HORMONAL_IUD' });
    assert.equal(ctx.predictionAvailability, 'CAUTION');
    assert.equal(ctx.presentation.showFertileWindow, true);
    assert.equal(ctx.presentation.showContextCard, true);
  });
});

describe('engine is unchanged by contraception', () => {
  it('buildPredictions output does not depend on contraception fields', () => {
    const a = enginePredictions();
    const b = buildPredictions({
      lastPeriodStart: LMP,
      avgCycleLength: 28,
      avgPeriodLength: 5,
      cycleCount: 3,
      logs: [{ date: LMP, flow: 'medium' }],
    });
    assert.equal(a.ovulationDate, b.ovulationDate);
    assert.deepEqual(a.fertileWindow, b.fertileWindow);
    assert.equal(a.nextPeriodStart, b.nextPeriodStart);
    const inferred = inferCycleStats([{ date: LMP, flow: 'medium' }, { date: '2026-08-02', flow: 'light' }], 28, 5);
    assert.equal(inferred.lastPeriodStart, LMP);
    assert.ok(inferred.periodRanges?.length >= 1);
  });

  it('presentation layer strips fertility marks without mutating the engine object', () => {
    const raw = enginePredictions();
    const ovulation = raw.ovulationDate;
    const ctx = interpretContraception({ contraceptionMethod: 'COMBINED_PILL' });
    const presented = presentPredictions(raw, ctx);
    assert.equal(raw.ovulationDate, ovulation);
    const rawHasFertile = Object.values(raw.calendar || {}).some((m) => m.fertile || m.ovulation);
    assert.equal(rawHasFertile, true);
    const presentedHasFertile = Object.values(presented.calendar || {}).some((m) => m.fertile || m.ovulation);
    assert.equal(presentedHasFertile, false);
    assert.equal(presented.ovulationDate, ovulation);
  });
});

describe('TTC conflict is a prompt flag only', () => {
  it('flags TTC + combined pill and does not change mode', () => {
    const ctx = interpretContraception({
      mode: 'TRY_TO_CONCEIVE',
      contraceptionMethod: 'COMBINED_PILL',
    });
    assert.equal(ctx.ttcConflict, true);
    assert.equal(ctx.method, 'COMBINED_PILL');
  });

  it('does not flag TTC + barrier or FAM', () => {
    assert.equal(
      interpretContraception({ mode: 'TRY_TO_CONCEIVE', contraceptionMethod: 'BARRIER' }).ttcConflict,
      false,
    );
    assert.equal(
      interpretContraception({ mode: 'TRY_TO_CONCEIVE', contraceptionMethod: 'FERTILITY_AWARENESS' }).ttcConflict,
      false,
    );
  });
});

describe('partner privacy — contraception stays off the payload', () => {
  it('serialized partner payload has no contraception fields', () => {
    const payload = buildPartnerPayload({
      profile: {
        avgCycleLength: 28,
        avgPeriodLength: 5,
        lastPeriodStart: LMP,
        isIrregular: false,
        contraceptionMethod: 'COMBINED_PILL',
        contraceptionStartedAt: '2026-01-01',
      },
      logs: [{ date: LMP, flow: 'medium', notes: 'private' }],
      permissions: { period: true, cyclePhase: true, fertileWindow: true, symptoms: true },
      today: '2026-08-10',
    });
    const text = JSON.stringify(payload);
    assert.equal(text.includes('contraceptionMethod'), false);
    assert.equal(text.includes('contraceptionStartedAt'), false);
    assert.equal(text.includes('COMBINED_PILL'), false);
    assert.equal(partnerPayloadHasLeak({ ...payload, contraceptionMethod: 'COMBINED_PILL' }), true);
    assert.equal(partnerPayloadHasLeak(payload), false);
  });
});

describe('AI contraception context', () => {
  it('sends contraception as SELF_REPORTED and keeps honesty rules', () => {
    const prompt = buildCycleAiUserPrompt({
      profile: {
        mode: 'TRACK_PERIOD',
        lastPeriodStart: LMP,
        avgCycleLength: 28,
        avgPeriodLength: 5,
        isIrregular: false,
        conditions: [],
        contraceptionMethod: 'COMBINED_PILL',
        contraceptionStartedAt: '2026-02-01',
      },
      logs: [{ date: LMP, flow: 'medium', symptoms: [], moods: [] }],
      predictions: enginePredictions(),
      pregnancy: null,
      user: { age: 28 },
      averages: { usedCycleLength: 28, usedPeriodLength: 5, source: 'default' },
      today: '2026-08-10',
    });
    assert.match(prompt, /CONTRACEPTION_SELF_REPORTED/);
    assert.match(prompt, /method: COMBINED_PILL/);
    assert.match(prompt, /SELF_REPORTED/);
    assert.equal(prompt.includes('MEASURED'), false);
    for (const rule of CYCLE_CONTRACEPTION_AI_RULES) {
      assert.ok(prompt.includes(rule), rule);
    }
    assert.match(prompt, /ნუ თქვი, რომ მომხმარებელი დაცულია/);
    assert.match(prompt, /ნუ დაითვლი კონტრაცეფციის ეფექტურობას/);
    assert.match(prompt, /ნუ უწოდებ კალენდარულ დღეებს უსაფრთხოს/);
    assert.match(prompt, /ნუ დაადასტურებ ოვულაციის ჩახშობას/);
    assert.match(prompt, /ნუ ურჩევ კონტრაცეფციის შეწყვეტას/);
  });

  it('does not send a contraception block when method is unset', () => {
    const prompt = buildCycleAiUserPrompt({
      profile: {
        mode: 'TRACK_PERIOD',
        lastPeriodStart: LMP,
        avgCycleLength: 28,
        avgPeriodLength: 5,
        conditions: [],
      },
      logs: [],
      predictions: enginePredictions(),
      pregnancy: null,
      user: { age: 28 },
      averages: { usedCycleLength: 28, usedPeriodLength: 5, source: 'default' },
      today: '2026-08-10',
    });
    assert.equal(prompt.includes('CONTRACEPTION_SELF_REPORTED:'), false);
  });
});

describe('today phase presentation', () => {
  it('keeps logged period visible under LIMITED', () => {
    const presented = presentTodayPhase(
      { day: 2, phase: 'period', phaseKa: 'მენსტრუაცია' },
      interpretContraception({ contraceptionMethod: 'COMBINED_PILL' }, { todayLog: { flow: 'medium' } }),
    );
    assert.equal(presented.phase, 'period');
  });

  it('downgrades fertile today to unknown under LIMITED', () => {
    const presented = presentTodayPhase(
      { day: 14, phase: 'fertile', phaseKa: 'ნაყოფიერი ფანჯარა' },
      interpretContraception({ contraceptionMethod: 'COMBINED_PILL' }),
    );
    assert.equal(presented.phase, 'unknown');
    assert.equal(presented.day, 14);
  });
});

describe('civil date helper still used for start dates', () => {
  it('toDateKey does not shift a UTC midnight date', () => {
    assert.equal(toDateKey(new Date('2026-03-01T00:00:00.000Z')), '2026-03-01');
  });
});
