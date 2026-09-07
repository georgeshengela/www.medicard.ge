import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  HOME_PRIORITY,
  buildHomeSectionOrder,
  homeOrderForScenario,
  homeSectionPriority,
} from './homeSectionOrder.ts';

const LIVE_ORDER = [
  'dashboard',
  'nextDose',
  'steps',
  'hydration',
  'weight',
  'mediQuest',
  'cycle',
  'lab',
  'weather',
  'run',
  'symptom',
  'analysis',
  'consilium',
  'recentActivity',
  'disclaimer',
] as const;

describe('homeSectionOrder', () => {
  it('canonical live order: Today before Quest, Quest before Health Context', () => {
    const order = buildHomeSectionOrder({
      mountNextDoseSlot: true,
      includeConsilium: true,
      includeCycle: true,
    });
    assert.deepEqual(order, [...LIVE_ORDER]);
  });

  it('puts core Today metrics before Quest (health-first)', () => {
    const order = buildHomeSectionOrder({ includeCycle: true });
    assert.ok(order.indexOf('steps') < order.indexOf('mediQuest'));
    assert.ok(order.indexOf('hydration') < order.indexOf('mediQuest'));
    assert.ok(order.indexOf('weight') < order.indexOf('mediQuest'));
  });

  it('keeps Quest prominent after Today (not buried in discovery)', () => {
    const order = buildHomeSectionOrder({ includeCycle: true });
    assert.ok(order.indexOf('mediQuest') < order.indexOf('cycle'));
    assert.ok(order.indexOf('mediQuest') < order.indexOf('weather'));
    assert.ok(order.indexOf('mediQuest') < order.indexOf('run'));
    assert.ok(order.indexOf('mediQuest') < order.indexOf('symptom'));
  });

  it('puts nextDose before Today when mounted', () => {
    const order = buildHomeSectionOrder();
    assert.ok(order.indexOf('nextDose') < order.indexOf('steps'));
    assert.ok(order.indexOf('nextDose') < order.indexOf('mediQuest'));
  });

  it('medicationDue includes nextDose; noAttention / new / normal omit it', () => {
    assert.ok(homeOrderForScenario('medicationDue').includes('nextDose'));
    assert.equal(homeOrderForScenario('noAttention').includes('nextDose'), false);
    assert.equal(homeOrderForScenario('new').includes('nextDose'), false);
    assert.equal(homeOrderForScenario('normal').includes('nextDose'), false);
  });

  it('cycle enabled vs disabled', () => {
    assert.ok(homeOrderForScenario('cycleEnabled').includes('cycle'));
    assert.equal(homeOrderForScenario('cycleDisabled').includes('cycle'), false);
    assert.ok(homeOrderForScenario('power').includes('cycle'));
  });

  it('power user keeps health-first stack with dose + cycle', () => {
    const order = homeOrderForScenario('power');
    assert.deepEqual(order, [
      'dashboard',
      'nextDose',
      'steps',
      'hydration',
      'weight',
      'mediQuest',
      'cycle',
      'lab',
      'weather',
      'run',
      'symptom',
      'analysis',
      'consilium',
      'recentActivity',
      'disclaimer',
    ]);
  });

  it('classifies Quest as MEDI_ENGAGEMENT, not IMMEDIATE/TODAY', () => {
    assert.equal(homeSectionPriority('mediQuest'), HOME_PRIORITY.MEDI_ENGAGEMENT);
    assert.equal(homeSectionPriority('steps'), HOME_PRIORITY.TODAY);
    assert.equal(homeSectionPriority('hydration'), HOME_PRIORITY.TODAY);
    assert.equal(homeSectionPriority('weight'), HOME_PRIORITY.TODAY);
    assert.equal(homeSectionPriority('nextDose'), HOME_PRIORITY.IMMEDIATE);
    assert.equal(homeSectionPriority('cycle'), HOME_PRIORITY.HEALTH_CONTEXT);
    assert.equal(homeSectionPriority('lab'), HOME_PRIORITY.HEALTH_CONTEXT);
    assert.equal(homeSectionPriority('weather'), HOME_PRIORITY.WELLNESS);
    assert.equal(homeSectionPriority('run'), HOME_PRIORITY.WELLNESS);
    assert.equal(homeSectionPriority('symptom'), HOME_PRIORITY.DISCOVERY);
    assert.equal(homeSectionPriority('disclaimer'), HOME_PRIORITY.LEGAL);
  });

  it('stable ordering — identical context yields identical order', () => {
    const a = buildHomeSectionOrder({ hasPendingDoses: true, includeCycle: true });
    const b = buildHomeSectionOrder({ hasPendingDoses: true, includeCycle: true });
    assert.deepEqual(a, b);
  });

  it('live mount keeps nextDose slot even when scenario would omit it', () => {
    const live = buildHomeSectionOrder({ mountNextDoseSlot: true, hasPendingDoses: false });
    assert.ok(live.includes('nextDose'));
    const map = buildHomeSectionOrder({ mountNextDoseSlot: false, hasPendingDoses: false });
    assert.equal(map.includes('nextDose'), false);
  });
});
