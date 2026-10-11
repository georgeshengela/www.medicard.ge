import test from 'node:test';
import assert from 'node:assert/strict';
import { lifestyleLines } from './lifestyleProfile.js';
import { buildPatientProfile } from './patient.js';

test('the new way-of-life answers reach Medi as words, never raw enums', () => {
  const hp = {
    activityLevel: 'MODERATE',
    exerciseFrequency: 'WEEKLY',
    sleepHours: 7,
    sleepQuality: 'GOOD',
    smokingStatus: 'OCCASIONAL',
    alcoholUse: 'OCCASIONAL',
    dietType: 'OMNIVORE',
    extraAnswers: {
      activeDays: '3-4', exerciseFreq: '2-3', sleepBand: '7', sleepFeel: 'fairly-good', smokingProducts: ['cigarettes', 'heated'],
      alcoholFreq: '2-4-month', dietPatterns: ['none', 'fasting'], produce: '1-2', eatingHabits: ['salty', 'late-eating'],
    },
  };
  const text = lifestyleLines(hp).join('\n');
  assert.match(text, /3–4 დღე კვირაში/);
  assert.match(text, /კვირაში 2–3-ჯერ/);
  assert.match(text, /~7 სთ/);
  assert.match(text, /ზოგჯერ ეწევა.*სიგარეტი, გაცხელებული თამბაქო/);
  assert.match(text, /ალკოჰოლი: თვეში 2–4-ჯერ$/m);
  assert.match(text, /ყველაფერს ჭამს, იცავს საეკლესიო მარხვას/);
  assert.match(text, /1–2 პორცია დღეში; ხშირად ჭამს მარილიან საკვებს; ხშირად ჭამს გვიან ღამით/);
  assert.doesNotMatch(text, /MODERATE|WEEKLY|OCCASIONAL|OMNIVORE|GOOD/);
});

test('older answers (columns only) still read; unanswered questions add nothing', () => {
  assert.deepEqual(lifestyleLines(null), []);
  assert.deepEqual(lifestyleLines({ extraAnswers: {} }), []);
  const text = lifestyleLines({ activityLevel: 'SEDENTARY', smokingStatus: 'NEVER', alcoholUse: 'REGULAR', dietType: 'VEGAN', extraAnswers: { smokingProducts: ['cigarettes'] } }).join('\n');
  assert.match(text, /აქტივობა: უმოძრაო/);
  assert.match(text, /მოწევა: არ ეწევა$/m);
  assert.match(text, /ალკოჰოლი: რეგულარულად/);
  assert.match(text, /ვეგანი/);
});

test('the account-holder block carries the way of life', () => {
  const block = buildPatientProfile({ gender: 'MALE', birthDate: '1990-01-01', healthProfile: { smokingStatus: 'FORMER', extraAnswers: { alcoholFreq: 'never' } } });
  assert.match(block, /მოწევა: ადრე ეწეოდა/);
  assert.match(block, /ალკოჰოლი: არ სვამს/);
});
