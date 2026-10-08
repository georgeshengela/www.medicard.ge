const test = require('node:test');
const assert = require('node:assert/strict');
const load = require('./helpers/loadTs.cjs')({
  '@/components/assessment/DateWheelPicker': {
    parseBirthDate: () => ({ month: 1, day: 1, year: 2000 }),
    birthDateIso: () => '2000-01-01', ageFromBirthDate: () => 26,
  },
});
const { defaultAssessmentForm, fullProfilePayload, completePayload, formFromProfile } = load('src/lib/assessmentForm.ts');
const { visibleAssessmentIndices, ACTIVE_ASSESSMENT_STEPS } = load('src/constants/assessmentSteps.ts');
test('untouched display defaults are never sent as health answers', () => {
  const payload = fullProfilePayload(defaultAssessmentForm(), 1);
  for (const key of ['heightCm', 'weightKg', 'birthDate', 'bloodType']) assert.equal(payload[key], undefined);
  assert.equal(payload.extraAnswers.fitnessLevel, undefined);
  assert.equal(payload.extraAnswers.sleepLevel, undefined);
});
test('explicit measurement confirmation persists the value', () => {
  const form = { ...defaultAssessmentForm(), weightKg: 82, confirmedSteps: ['weight'] };
  assert.equal(fullProfilePayload(form, 7).weightKg, 82);
  assert.equal(fullProfilePayload(form, 7).heightCm, undefined);
});
test('completion preserves omitted optional measurements', () => {
  const form = { ...defaultAssessmentForm(), gender: 'FEMALE', confirmedSteps: ['birthdate'] };
  const payload = completePayload(form);
  assert.equal('heightCm' in payload, false);
  assert.equal('weightKg' in payload, false);
  assert.equal(payload.gender, 'FEMALE');
});
test('completion rejects an unconfirmed date', () => {
  assert.throws(() => completePayload({ ...defaultAssessmentForm(), gender: 'FEMALE' }), /birthdate/);
});
test('existing measured answers and diet survive a resumed questionnaire', () => {
  const form = formFromProfile({ heightCm: 180, weightKg: 80, dietType: 'OMNIVORE', extraAnswers: { fitnessLevel: 4, sleepLevel: 2 } }, { birthDate: '2000-01-01', gender: 'FEMALE' });
  const payload = fullProfilePayload(form, 8);
  assert.equal(payload.heightCm, 180);
  assert.equal(payload.weightKg, 80);
  assert.equal(payload.dietType, 'OMNIVORE');
  assert.equal(payload.extraAnswers.fitnessLevel, 4);
  assert.equal(payload.extraAnswers.sleepLevel, 2);
});
test('conditional questions appear only after yes and stored indices stay stable', () => {
  const types = (form) => visibleAssessmentIndices(form).map((i) => ACTIVE_ASSESSMENT_STEPS[i].type);
  for (const flag of [null, false, undefined]) {
    assert.equal(types({ takesMedications: flag, hasConditions: flag }).includes('medications-list'), false);
    assert.equal(types({ takesMedications: flag, hasConditions: flag }).includes('conditions-list'), false);
  }
  assert.equal(types({ takesMedications: true, hasConditions: true }).includes('medications-list'), true);
  assert.equal(types({ takesMedications: true, hasConditions: true }).includes('conditions-list'), true);
  assert.equal(types({}).includes('body-type'), false);
  assert.equal(ACTIVE_ASSESSMENT_STEPS[5].type, 'body-type');
});
test('the last onboarding step sends nothing to AI and shows no health score (2026-10-08)', () => {
  const { readFileSync, existsSync } = require('node:fs');
  const { join } = require('node:path');
  const root = join(__dirname, '..');
  const analyzing = readFileSync(join(root, 'app', '(auth)', 'profile-setup', 'analyzing.tsx'), 'utf8');
  assert.doesNotMatch(analyzing, /onboardingAnalysis|from '@\/lib\/api'/);
  assert.match(analyzing, /finishOnboarding\(healthProfile, user\)/);
  assert.doesNotMatch(readFileSync(join(root, 'src', 'lib', 'api.ts'), 'utf8'), /onboarding-analysis/);
  assert.equal(existsSync(join(root, 'app', '(auth)', 'profile-setup', 'results.tsx')), false, 'the score page stays removed');
});
