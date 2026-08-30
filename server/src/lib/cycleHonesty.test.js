import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCycleAiUserPrompt,
  buildCycleAlerts,
  buildLocalInsights,
  buildPredictions,
} from './cycle.js';
import {
  CYCLE_AI_HONESTY_RULES,
  cycleHonestyFlags,
  emptyCycleAiCache,
  latePeriodAlertKa,
  nextPeriodEstimateBody,
  pcosCautionKa,
  ttcReminderTone,
  ttcWindowBody,
} from './cycleHonesty.js';
import { buildPartnerPayload } from './cycleShare.js';

const HIGH = cycleHonestyFlags({ confidence: 'high' });
const MEDIUM = cycleHonestyFlags({ confidence: 'medium' });
const LOW = cycleHonestyFlags({ confidence: 'low' });
const IRREGULAR = cycleHonestyFlags({ confidence: 'high', isIrregular: true });
const PCOS = cycleHonestyFlags({ confidence: 'high', conditions: ['pcos'] });

const WINDOW = {
  fertileWindow: { start: '2026-03-10', end: '2026-03-16' },
  ovulationDate: '2026-03-15',
};

describe('cycleHonestyFlags', () => {
  it('keeps high confidence concise unless irregular or PCOS', () => {
    assert.equal(HIGH.cautious, false);
    assert.equal(HIGH.confidence, 'high');
    assert.equal(MEDIUM.cautious, false);
    assert.equal(LOW.cautious, true);
  });

  it('forces cautious copy for irregular cycles even if badge would be high', () => {
    assert.equal(IRREGULAR.cautious, true);
    assert.equal(IRREGULAR.irregular, true);
    assert.equal(ttcReminderTone(IRREGULAR), 'cautious');
  });

  it('forces cautious fertility wording for self-reported PCOS', () => {
    assert.equal(PCOS.cautious, true);
    assert.equal(PCOS.pcos, true);
    assert.equal(ttcReminderTone(PCOS), 'cautious');
    assert.equal(ttcReminderTone(HIGH), 'estimated');
  });
});

describe('confidence copy', () => {
  it('uses estimated language at every confidence level', () => {
    const high = nextPeriodEstimateBody('2026-09-09', HIGH);
    const medium = nextPeriodEstimateBody('2026-09-09', MEDIUM);
    const low = nextPeriodEstimateBody('2026-09-09', LOW);
    assert.match(high, /სავარაუდო თარიღი დაახლოებით 2026-09-09/);
    assert.doesNotMatch(high, /დაიწყება 2026-09-09/);
    assert.match(medium, /შეიძლება ოდნავ გადაიწიოს/);
    assert.match(low, /შეიძლება შეიცვალოს/);
  });

  it('makes irregular-cycle timing sound less precise', () => {
    const body = nextPeriodEstimateBody('2026-09-09', IRREGULAR);
    assert.match(body, /ნაკლებად საიმედოა/);
  });
});

describe('TTC and PCOS copy', () => {
  it('does not claim ovulation occurred', () => {
    const high = ttcWindowBody(WINDOW, HIGH);
    const cautious = ttcWindowBody(WINDOW, PCOS);
    assert.match(high, /სავარაუდო ნაყოფიერი ფანჯარა/);
    assert.match(high, /კალენდარული შეფასებაა/);
    assert.doesNotMatch(high, /ოვულირებთ/);
    assert.doesNotMatch(high, /დადგენილი ნაყოფიერება არ არის/);
    assert.match(cautious, /ნაკლებად საიმედოა/);
    assert.match(cautious, /არ ადასტურებს ოვულაციას/);
    assert.match(pcosCautionKa(), /PCOS/);
    assert.match(pcosCautionKa(), /არ არის კონტრაცეფციის მეთოდი/);
  });
});

describe('late period alert', () => {
  it('does not imply pregnancy', () => {
    const text = latePeriodAlertKa();
    assert.match(text, /გვიანია/);
    assert.doesNotMatch(text, /ორსულ/);
    const alerts = buildCycleAlerts({
      profile: { mode: 'TRACK_PERIOD', isIrregular: false, conditions: [] },
      logs: [{ date: '2026-01-01', flow: 'medium' }],
      predictions: {},
      inferred: { periodStarts: ['2026-01-01'] },
      today: '2026-02-15',
    });
    const late = alerts.find((a) => a.messageKa.includes('გვიანია'));
    assert.ok(late);
    assert.doesNotMatch(late.messageKa, /ორსულ/);
  });
});

describe('local insights', () => {
  it('uses estimate language for TTC window and next period', () => {
    const predictions = buildPredictions({
      lastPeriodStart: '2026-03-01',
      avgCycleLength: 28,
      avgPeriodLength: 5,
      cycleCount: 6,
    });
    const insights = buildLocalInsights({
      profile: { mode: 'TRY_TO_CONCEIVE', lastPeriodStart: '2026-03-01', avgCycleLength: 28, avgPeriodLength: 5 },
      logs: [],
      predictions,
      pregnancy: null,
      averages: { usedCycleLength: 28, usedPeriodLength: 5, source: 'inferred' },
      today: '2026-03-10',
    });
    const ttc = insights.cards.find((c) => c.id === 'ttc_window');
    const next = insights.cards.find((c) => c.id === 'next_period');
    assert.ok(ttc);
    assert.match(ttc.title, /სავარაუდო/);
    assert.doesNotMatch(ttc.body, /ოვულირებთ/);
    assert.match(next.body, /სავარაუდო თარიღი/);
    assert.match(insights.headline, /სავარაუდო/);
  });
});

describe('AI prompt categories', () => {
  it('separates logged facts, estimates, and self-reported conditions', () => {
    const predictions = buildPredictions({
      lastPeriodStart: '2026-08-01',
      avgCycleLength: 28,
      avgPeriodLength: 5,
      cycleCount: 3,
    });
    const prompt = buildCycleAiUserPrompt({
      profile: {
        mode: 'TRY_TO_CONCEIVE',
        lastPeriodStart: '2026-08-01',
        avgCycleLength: 28,
        avgPeriodLength: 5,
        isIrregular: false,
        conditions: ['pcos'],
      },
      logs: [{ date: '2026-08-10', flow: 'medium', symptoms: ['cramps'], moods: [] }],
      predictions,
      pregnancy: null,
      user: { age: 28 },
      averages: { usedCycleLength: 28, usedPeriodLength: 5, source: 'default' },
      today: '2026-08-14',
    });
    assert.match(prompt, /USER_LOGGED:/);
    assert.match(prompt, /ESTIMATED:/);
    assert.match(prompt, /CONDITIONS_SELF_REPORTED:/);
    assert.match(prompt, /pcos/);
    assert.match(prompt, /2026-08-10: flow=medium/);
    assert.match(prompt, /სავარაუდო ოვულაცია:/);
    assert.match(prompt, /HONESTY_RULES:/);
    for (const rule of CYCLE_AI_HONESTY_RULES) {
      assert.match(prompt, new RegExp(rule.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    }
  });
});

describe('AI cache invalidation helper', () => {
  it('clears both insight fields so mutations cannot keep stale Medi copy', () => {
    assert.deepEqual(emptyCycleAiCache(), { aiInsights: null, aiInsightsAt: null });
  });
});

describe('partner payload estimates', () => {
  it('marks derived period, phase, and fertile fields as estimated', () => {
    const payload = buildPartnerPayload({
      profile: { mode: 'TRACK_PERIOD', lastPeriodStart: '2026-08-01', avgCycleLength: 28, avgPeriodLength: 5, isIrregular: false },
      logs: [{ date: '2026-08-01', flow: 'medium', symptoms: ['cramps'] }],
      permissions: { period: true, cyclePhase: true, fertileWindow: true, symptoms: true },
      today: '2026-08-01',
    });
    assert.equal(payload.estimated, true);
    assert.equal(payload.period.nextPeriodEstimated, true);
    assert.equal(payload.period.inPeriodEstimated, false);
    assert.equal(payload.phase.estimated, true);
    assert.equal(payload.fertileWindow.estimated, true);

    const later = buildPartnerPayload({
      profile: { mode: 'TRACK_PERIOD', lastPeriodStart: '2026-08-01', avgCycleLength: 28, avgPeriodLength: 5, isIrregular: false },
      logs: [{ date: '2026-08-01', flow: 'medium', symptoms: [] }],
      permissions: { period: true, cyclePhase: true, fertileWindow: true, symptoms: false },
      today: '2026-08-03',
    });
    assert.equal(later.period.inPeriod, true);
    assert.equal(later.period.inPeriodEstimated, true);
  });
});
