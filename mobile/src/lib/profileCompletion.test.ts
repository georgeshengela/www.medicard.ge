import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { newQuestionsAfterUpdate, profileCompletion } from './profileCompletion.ts';

describe('profileCompletion', () => {
  it('registration leaves the profile questions for later', () => {
    const c = profileCompletion({ heightCm: 170, weightKg: 70, extraAnswers: {} }, { gender: 'FEMALE', birthDate: '1990-01-01', fullName: 'ნინო ბერიძე' });
    assert.equal(c.answered, 5);
    assert.equal(c.total, 15);
    assert.ok(c.missing.includes('allergies'));
    assert.ok(c.percent < 50);
  });

  it('"no allergies" and "no conditions" count as answered, not missing', () => {
    const c = profileCompletion({ allergies: [], extraAnswers: { confirmedSteps: ['allergies'], hasConditions: false, takesMedications: false } }, null);
    assert.ok(!c.missing.includes('allergies'));
    assert.ok(!c.missing.includes('conditions-gate'));
    assert.ok(!c.missing.includes('medications-gate'));
  });

  it('the placeholder name counts as missing, until it was asked once on Home', () => {
    const c = profileCompletion({ extraAnswers: {} }, { fullName: 'Medicard მომხმარებელი' });
    assert.ok(c.missing.includes('name'));
    const asked = profileCompletion({ extraAnswers: { namePromptAt: '2026-10-11T19:00:00Z' } }, { fullName: 'Medicard მომხმარებელი' });
    assert.ok(!asked.missing.includes('name'));
  });

  it('a complete profile is 100%', () => {
    const c = profileCompletion(
      { heightCm: 180, weightKg: 80, bloodType: 'A+', smokingStatus: 'NEVER', allergies: ['penicillin'],
        extraAnswers: { hasConditions: false, takesMedications: true, activeDays: '3-4', sleepBand: '7', alcoholFreq: 'never', dietPatterns: ['none'], produce: '3-4' } },
      { gender: 'MALE', birthDate: '1985-05-05', fullName: 'გიორგი ბერიძე' },
    );
    assert.equal(c.percent, 100);
    assert.deepEqual(c.missing, []);
  });

  it('an old questionnaire missing only the new way-of-life questions reads as an update, not a loss', () => {
    const profile = { heightCm: 180, weightKg: 80, bloodType: 'A+', smokingStatus: 'NEVER', allergies: ['penicillin'],
      extraAnswers: { hasConditions: false, takesMedications: false, fitnessLevel: 3, sleepLevel: 4, checkupFrequency: 'YEARLY' } };
    const user = { gender: 'MALE', birthDate: '1985-05-05', fullName: 'გიორგი ბერიძე' };
    assert.equal(newQuestionsAfterUpdate(profile, profileCompletion(profile, user)), 5);
    // A new account (no old answers) gets the usual card; so does someone still missing a medical question.
    assert.equal(newQuestionsAfterUpdate({ extraAnswers: {} }, profileCompletion({ extraAnswers: {} }, user)), 0);
    const noBlood = { ...profile, bloodType: null };
    assert.equal(newQuestionsAfterUpdate(noBlood, profileCompletion(noBlood, user)), 0);
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
