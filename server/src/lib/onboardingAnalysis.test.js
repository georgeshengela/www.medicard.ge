import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { computeHeuristicScore } from './onboardingAnalysis.js';

const youngUser = { birthDate: '1995-04-12' };

function healthyProfile() {
  return {
    heightCm: 170,
    weightKg: 62,
    smokingStatus: 'NEVER',
    sleepQuality: 'EXCELLENT',
    sleepHours: 8,
    stressLevel: 'LOW',
    activityLevel: 'ACTIVE',
    exerciseFrequency: 'DAILY',
    alcoholUse: 'NEVER',
    waterIntakeL: 2.4,
    restingHeartRate: 62,
    bloodPressureSystolic: 112,
    bloodPressureDiastolic: 72,
    chronicConditions: [],
    allergies: [],
    familyHistory: [],
    medications: [],
    healthGoals: ['energy'],
  };
}

function riskProfile() {
  return {
    heightCm: 170,
    weightKg: 98,
    smokingStatus: 'CURRENT',
    sleepQuality: 'POOR',
    sleepHours: 5,
    stressLevel: 'VERY_HIGH',
    activityLevel: 'SEDENTARY',
    exerciseFrequency: 'NEVER',
    alcoholUse: 'REGULAR',
    waterIntakeL: 0.8,
    restingHeartRate: 96,
    bloodPressureSystolic: 148,
    bloodPressureDiastolic: 94,
    chronicConditions: ['hypertension', 'diabetes'],
    allergies: ['penicillin'],
    familyHistory: ['heart disease'],
    medications: ['med-1', 'med-2', 'med-3', 'med-4', 'med-5'],
    healthGoals: [],
  };
}

describe('computeHeuristicScore', () => {
  it('raises the score when habits and metrics improve', () => {
    const low = computeHeuristicScore(riskProfile(), youngUser, { mood: 'SAD', fitnessLevel: 1, sleepLevel: 1 }, [
      { steps: 1800 },
    ]);
    const high = computeHeuristicScore(healthyProfile(), youngUser, { mood: 'GREAT', fitnessLevel: 5, sleepLevel: 5 }, [
      { steps: 9200 },
    ]);
    assert.ok(high > low + 20, `expected healthy ${high} to beat risk ${low} by more than 20`);
  });

  it('moves the score when the same person starts smoking and sleeping less', () => {
    const baseline = computeHeuristicScore(healthyProfile(), youngUser);
    const worse = computeHeuristicScore(
      { ...healthyProfile(), smokingStatus: 'CURRENT', sleepHours: 5, sleepQuality: 'POOR' },
      youngUser,
    );
    assert.ok(worse < baseline, `expected ${worse} < ${baseline}`);
  });
});
