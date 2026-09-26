import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { profileCompletion } from './profileCompletion.ts';

describe('profileCompletion', () => {
  it('a fresh 7-step onboarding leaves the long questions for later', () => {
    const c = profileCompletion({ heightCm: 170, weightKg: 70, extraAnswers: {} }, { gender: 'FEMALE', birthDate: '1990-01-01' });
    assert.equal(c.answered, 4);
    assert.equal(c.total, 13);
    assert.ok(c.missing.includes('allergies'));
    assert.ok(c.percent < 50);
  });

  it('"no allergies" and "no conditions" count as answered, not missing', () => {
    const c = profileCompletion({ allergies: [], extraAnswers: { confirmedSteps: ['allergies'], hasConditions: false, takesMedications: false } }, null);
    assert.ok(!c.missing.includes('allergies'));
    assert.ok(!c.missing.includes('conditions-gate'));
    assert.ok(!c.missing.includes('medications-gate'));
  });

  it('a complete profile is 100%', () => {
    const c = profileCompletion(
      { heightCm: 180, weightKg: 80, bloodType: 'A+', smokingStatus: 'NEVER', dietType: 'OMNIVORE', allergies: ['penicillin'],
        extraAnswers: { hasConditions: false, takesMedications: true, fitnessLevel: 3, sleepLevel: 4, checkupFrequency: 'YEARLY' } },
      { gender: 'MALE', birthDate: '1985-05-05' },
    );
    assert.equal(c.percent, 100);
    assert.deepEqual(c.missing, []);
  });

  it('tolerates a missing profile', () => {
    assert.equal(profileCompletion(null, null).answered, 0);
  });
});

import { suggestTargetWeight } from './profileCompletion.ts';
describe('suggestTargetWeight', () => {
  it('suggests a small loss for a typical BMI and a small gain when BMI is low', () => {
    assert.equal(suggestTargetWeight(168, 80), 77);
    assert.equal(suggestTargetWeight(170, 52), 54); // BMI 18
    assert.equal(suggestTargetWeight(150, 36), 38);
    assert.equal(suggestTargetWeight(190, 36), 38);
  });
});
