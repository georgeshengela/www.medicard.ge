import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { dietTypeFor, emptyHabits, habitsFromProfile, habitsPayload, smokingOptions, toggleDietPattern, toggleExclusive } from './healthHabits.ts';

describe('healthHabits', () => {
  it('nothing answered sends nothing', () => {
    assert.deepEqual(habitsPayload(emptyHabits()), { columns: {}, extra: {} });
  });

  it('exact answers stay in extraAnswers; the columns Medi and MEDIFOOD read are derived', () => {
    const { columns, extra } = habitsPayload({
      ...emptyHabits(),
      activeDays: '5+',
      exerciseFreq: '4+',
      sleepBand: '6',
      sleepFeel: 'fairly-bad',
      smoking: 'OCCASIONAL',
      smokingProducts: ['ecig'],
      alcoholFreq: '2-3-week',
      dietPatterns: ['none', 'fasting'],
      produce: '0',
      eatingHabits: ['sugary-drinks'],
    });
    assert.deepEqual(columns, {
      activityLevel: 'VERY_ACTIVE',
      exerciseFrequency: 'DAILY',
      sleepHours: 6,
      sleepQuality: 'FAIR',
      smokingStatus: 'OCCASIONAL',
      alcoholUse: 'REGULAR',
      dietType: 'OMNIVORE',
    });
    assert.equal(extra.activeDays, '5+');
    assert.deepEqual(extra.smokingProducts, ['ecig']);
    assert.deepEqual(extra.eatingHabits, ['sugary-drinks']);
  });

  it('a non-smoker keeps no stale products', () => {
    const { extra } = habitsPayload({ ...emptyHabits(), smoking: 'NEVER', smokingProducts: ['cigarettes'] });
    assert.deepEqual(extra.smokingProducts, []);
  });

  it('sometimes is its own smoking answer (e.g. two cigarettes a month)', () => {
    assert.deepEqual(smokingOptions().map((o) => o.key), ['CURRENT', 'OCCASIONAL', 'FORMER', 'NEVER']);
  });

  it('diet: eating everything goes with fasting, not with a food restriction', () => {
    assert.deepEqual(toggleDietPattern(['none'], 'fasting'), ['none', 'fasting']);
    assert.deepEqual(toggleDietPattern(['none', 'fasting'], 'vegetarian'), ['fasting', 'vegetarian']);
    assert.deepEqual(toggleDietPattern(['vegan', 'intermittent'], 'none'), ['intermittent', 'none']);
    assert.equal(dietTypeFor(['fasting']), 'OMNIVORE');
    assert.equal(dietTypeFor(['pescatarian']), 'OTHER');
    assert.equal(dietTypeFor(['low-carb', 'gluten-free']), 'KETO');
    assert.equal(dietTypeFor([]), undefined);
  });

  it('none of these excludes the habits and the other way round', () => {
    assert.deepEqual(toggleExclusive(['salty', 'sweets'], 'none', 'none'), ['none']);
    assert.deepEqual(toggleExclusive(['none'], 'salty', 'none'), ['salty']);
  });

  it('a clear older diet answer carries over; „balanced“ is asked again', () => {
    assert.deepEqual(habitsFromProfile({ dietType: 'VEGAN', extraAnswers: {} }).dietPatterns, ['vegan']);
    assert.deepEqual(habitsFromProfile({ dietType: 'OMNIVORE', extraAnswers: {} }).dietPatterns, []);
    assert.deepEqual(habitsFromProfile({ dietType: 'VEGAN', extraAnswers: { dietPatterns: ['none'] } }).dietPatterns, ['none']);
  });

  it('reads stored answers and ignores unknown values', () => {
    const h = habitsFromProfile({ smokingStatus: 'CURRENT', extraAnswers: { activeDays: '9', dietPatterns: ['vegan', 'paleo'] } });
    assert.equal(h.smoking, 'CURRENT');
    assert.equal(h.activeDays, null);
    assert.deepEqual(h.dietPatterns, ['vegan']);
  });
});
