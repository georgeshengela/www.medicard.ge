// Registration and „დაასრულე პროფილი“ (owner 2026-10-11 rework): the name is asked right after the SMS
// code, the goal question is gone, height and weight are two pages, the profile walks only unanswered
// questions and its summary edits one answer at a time.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const repoRead = (file) => fs.readFileSync(path.join(__dirname, '..', '..', file), 'utf8');

const DATE_MOCK = {
  '@/components/assessment/DateWheelPicker': {
    parseBirthDate: () => ({ month: 1, day: 1, year: 2000 }),
    birthDateIso: () => '2000-01-01',
    ageFromBirthDate: () => 26,
  },
};
const loadForm = () => require('./helpers/loadTs.cjs')(DATE_MOCK)('src/lib/assessmentForm.ts');
const loadSteps = () => require('./helpers/loadTs.cjs')()('src/constants/assessmentSteps.ts');

test('the placeholder name is no name: the name page starts empty; a real name splits into first and last', () => {
  const form = loadForm();
  const user = { gender: 'MALE', birthDate: '1990-01-01', fullName: 'Medicard მომხმარებელი' };
  const empty = form.formFromProfile({ extraAnswers: { legalName: 'Medicard მომხმარებელი' } }, user);
  assert.equal(empty.firstName, '');
  assert.equal(empty.lastName, '');
  const named = form.formFromProfile({ extraAnswers: {} }, { ...user, fullName: 'გიორგი  მაისურაძე' });
  assert.equal(named.firstName, 'გიორგი');
  assert.equal(named.lastName, 'მაისურაძე');
});

test('first and last name are both needed (2+ letters each)', () => {
  const form = loadForm();
  assert.equal(form.fullNameFromForm({ firstName: 'ნინო', lastName: '' }), null);
  assert.equal(form.fullNameFromForm({ firstName: 'ნ', lastName: 'ბერიძე' }), null);
  assert.equal(form.fullNameFromForm({ firstName: ' ნინო ', lastName: 'ბერიძე ' }), 'ნინო ბერიძე');
});

test('registration: no goal question, height and weight on two pages, old resume keys land on a real page', () => {
  const steps = loadSteps();
  assert.deepEqual([...steps.ONBOARDING_QUESTIONS], ['name', 'gender', 'birthdate', 'height', 'weight']);
  assert.equal(steps.onboardingResumeQuestion('o2-goal'), 'birthdate');
  assert.equal(steps.onboardingResumeQuestion('o4-body'), 'height');
  assert.equal(steps.onboardingResumeQuestion('o5-cycle'), 'weight');
  assert.equal(steps.onboardingResumeQuestion('o4-weight'), 'weight');
  assert.equal(steps.onboardingResumeQuestion(undefined), null);
  const screen = read('app/(auth)/assessment/index.tsx');
  // The name page only when the sign-in brought no real name (phone, Apple without a name).
  assert.match(screen, /realFullName\(user, extra\) \? \[\] : \['name' as const\]/);
  assert.match(screen, /api\.auth\.updateProfile\(\{ fullName \}\)/);
  assert.doesNotMatch(screen, /primaryGoal|primary-goal/);
});

test('„დაასრულე პროფილი“ walks only unanswered questions; MEDIPILL medicines count as answered', () => {
  const { answeredQuestions } = require('./helpers/loadTs.cjs')()('src/lib/profileCompletion.ts');
  const profile = { heightCm: 180, weightKg: 80, bloodType: 'A+', extraAnswers: { hasConditions: false } };
  const user = { gender: 'MALE', birthDate: '1990-01-01', fullName: 'Medicard მომხმარებელი' };
  const answered = answeredQuestions(profile, user, { pillCount: 2 });
  assert.equal(answered.name, false);
  assert.equal(answered['blood-type'], true);
  assert.equal(answered['conditions-gate'], true);
  assert.equal(answered['medications-gate'], true);
  assert.equal(answered.activity, false);
  assert.equal(answeredQuestions(profile, user)['medications-gate'], false);
  const screen = read('src/components/assessment/ProfileQuestionnaire.tsx');
  assert.match(screen, /PROFILE_QUESTIONS\.filter\(\(q\) => !LIST_QUESTIONS\.has\(q\) && !answered\[q\]\)/);
  // An edit from the summary goes back to the summary, never on through the list.
  assert.match(screen, /if \(mode\.kind === 'edit'\) \{\s*setMode\(opensList \? \{ kind: 'edit', key: list \} : \{ kind: 'summary' \}\);/);
});

test('„დაასრულე პროფილი“ finishes back where it was opened, not on the Profile tab', () => {
  const screen = read('src/components/assessment/ProfileQuestionnaire.tsx');
  assert.match(screen, /leaveProfileComplete\(router\)/);
  assert.doesNotMatch(screen, /router\.replace\('\/\(tabs\)\/profile'/);
});

test('one profile answer writes only its own fields', () => {
  const form = loadForm();
  const f = { ...form.defaultAssessmentForm(), confirmedSteps: ['blood-type'], bloodType: 'O+', allergies: ['penicillin'] };
  const blood = form.questionPayload('blood-type', f);
  assert.equal(blood.bloodType, 'O+');
  assert.equal('allergies' in blood, false);
  assert.equal('heightCm' in blood, false);
  const smoking = form.questionPayload('smoking', { ...f, habits: { ...f.habits, smoking: 'OCCASIONAL', smokingProducts: ['heated'] } });
  assert.equal(smoking.smokingStatus, 'OCCASIONAL');
  assert.deepEqual(smoking.extraAnswers.smokingProducts, ['heated']);
});

test('web /app onboarding asks first and last name and no goal', () => {
  const web = repoRead('server/public/app/js/onboarding.js');
  assert.match(web, /autocomplete: 'given-name'/);
  assert.match(web, /autocomplete: 'family-name'/);
  assert.doesNotMatch(web, /primaryGoal|state\.goal/);
});

test('a morning push without a name keeps no stray comma', () => {
  const load = require('./helpers/loadTs.cjs')({
    '@/lib/api': { api: {} },
    '@/lib/cycleNotificationContract.js': { redactCyclePushLog: (v) => v },
    '@/lib/storage': { getToken: async () => null },
  });
  const { interpolatePushCopy } = load('src/lib/pushCopy.ts');
  assert.equal(interpolatePushCopy('დილა მშვიდობისა, {firstName} ☀️', { firstName: '' }), 'დილა მშვიდობისა ☀️');
  assert.equal(interpolatePushCopy('დილა მშვიდობისა, {firstName} ☀️', { firstName: 'ნინო' }), 'დილა მშვიდობისა, ნინო ☀️');
  assert.equal(interpolatePushCopy('Good morning, {firstName} ☀️', { firstName: '' }), 'Good morning ☀️');
});
