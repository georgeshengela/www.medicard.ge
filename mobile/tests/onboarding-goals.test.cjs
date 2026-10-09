// Onboarding goal step and first answers (launch hardening, train 2): the last period date is never
// dropped silently, Continue says why it is off, a man never keeps the hidden cycle goal, and
// „დაასრულე პროფილი“ returns where it was opened.
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

function loadGoals({ setLastPeriod, account = 'user-a' }) {
  const sent = { periods: [], weights: [], order: [] };
  const load = require('./helpers/loadTs.cjs')({
    ...DATE_MOCK,
    '@/lib/api': {
      api: {
        cycle: {
          setLastPeriod: async (ymd) => {
            sent.periods.push(ymd);
            sent.order.push(`setLastPeriod:${ymd}`);
            return setLastPeriod(ymd);
          },
        },
      },
    },
    '@/lib/cycleOffline': { discardQueuedStartRestores: async (userId) => void sent.order.push(`discard:${userId}`) },
    '@/lib/localAccount': { localAccountId: () => account },
    '@/lib/weightGoal': {
      createWeightDraft: (kg) => ({ startKg: kg }),
      deadlineFromPace: () => '2027-01-01',
      draftToGoal: (draft) => ({ ...draft }),
      saveWeightGoal: async (goal) => { sent.weights.push(goal); },
    },
  });
  return { ...load('src/lib/onboardingGoals.ts'), form: load('src/lib/assessmentForm.ts'), sent };
}

const loadForm = () => require('./helpers/loadTs.cjs')(DATE_MOCK)('src/lib/assessmentForm.ts');

function cycleForm(form, patch = {}) {
  const today = new Date();
  return {
    ...form.defaultAssessmentForm(),
    gender: 'FEMALE',
    primaryGoal: 'cycle',
    confirmedSteps: ['gender', 'primary-goal', 'birthdate', 'body', 'goal-cycle'],
    lastPeriodYear: today.getFullYear(),
    lastPeriodMonth: today.getMonth() + 1,
    lastPeriodDay: today.getDate(),
    ...patch,
  };
}

test('a failed last period save stops the finish (error on the step, Finish retries) instead of vanishing', async () => {
  const failing = loadGoals({ setLastPeriod: async () => { throw Object.assign(new Error('Server error'), { status: 502 }); } });
  await assert.rejects(failing.saveOnboardingGoal(cycleForm(failing.form)), /Server error/);
  assert.equal(failing.sent.periods.length, 1);

  const ok = loadGoals({ setLastPeriod: async () => ({ logs: [] }) });
  const form = cycleForm(ok.form);
  await ok.saveOnboardingGoal(form);
  assert.deepEqual(ok.sent.periods, [ok.form.lastPeriodYmd(form)]);
});

// IR3-3: a start restore an undo left queued on this phone must never replay over the date she answers.
test('her onboarding date drops a queued start restore first, then is sent', async () => {
  const goals = loadGoals({ setLastPeriod: async () => ({}) });
  const form = cycleForm(goals.form);
  await goals.saveOnboardingGoal(form);
  assert.deepEqual(goals.sent.order, ['discard:user-a', `setLastPeriod:${goals.form.lastPeriodYmd(form)}`]);

  const signedOut = loadGoals({ setLastPeriod: async () => ({}), account: null });
  await signedOut.saveOnboardingGoal(cycleForm(signedOut.form));
  assert.equal(signedOut.sent.order.filter((step) => step.startsWith('discard')).length, 0);
  assert.equal(signedOut.sent.periods.length, 1);
});

test('only the day she picked is ever sent: skipped, invalid, or not a woman → nothing', async () => {
  const goals = loadGoals({ setLastPeriod: async () => ({}) });
  const base = cycleForm(goals.form);
  await goals.saveOnboardingGoal({ ...base, confirmedSteps: ['gender', 'primary-goal'] });
  await goals.saveOnboardingGoal({ ...base, gender: 'MALE' });
  await goals.saveOnboardingGoal({ ...base, lastPeriodYear: base.lastPeriodYear + 1 });
  await goals.saveOnboardingGoal({ ...base, primaryGoal: 'general' });
  assert.deepEqual(goals.sent.periods, []);
});

test('the assessment screen no longer swallows the last period request', () => {
  const screen = read('app/(auth)/assessment/index.tsx');
  assert.doesNotMatch(screen, /setLastPeriod\([^\n]*\.catch\(\(\) => undefined\)/);
  assert.match(screen, /await saveOnboardingGoal\(currentForm\);\s*const result = await api\.healthProfile\.update\(/);
  assert.doesNotMatch(read('src/lib/onboardingGoals.ts'), /\.catch\(/);
});

test('the cycle goal step says why Continue is off (future day, more than 100 days back)', () => {
  const form = loadForm();
  const now = new Date(2026, 9, 8, 15).getTime();
  const day = (y, m, d) => ({ lastPeriodYear: y, lastPeriodMonth: m, lastPeriodDay: d });
  assert.equal(form.lastPeriodProblem(day(2026, 10, 8), now), null);
  assert.equal(form.lastPeriodProblem(day(2026, 9, 1), now), null);
  assert.equal(form.lastPeriodProblem(day(2026, 10, 9), now), 'future');
  assert.equal(form.lastPeriodProblem(day(2026, 6, 1), now), 'old');
  assert.equal(form.lastPeriodProblem(day(2026, 2, 30), now), 'invalid');
  assert.equal(form.lastPeriodValid(day(2026, 10, 9), now), false);
  for (const problem of ['future', 'old', 'invalid']) {
    assert.match(form.lastPeriodProblemText(problem), /[ა-ჿ]/, `${problem}: Georgian copy`);
  }
  const content = read('src/components/assessment/AssessmentStepContent.tsx');
  assert.match(content, /const problem = lastPeriodProblem\(form\);/);
  assert.match(content, /\{lastPeriodProblemText\(problem\)\}/);
  const en = require('./helpers/loadTs.cjs')({ ...DATE_MOCK, '../i18n/locale.js': { tx: (_ka, en) => en } })('src/lib/assessmentForm.ts');
  assert.equal(en.lastPeriodProblemText('future'), 'You can’t pick a future date.');
  assert.match(en.lastPeriodProblemText('old'), /More than 100 days ago\? Skip/);
});

test('switching to male drops the hidden cycle goal, and Continue needs a goal this sex is offered', () => {
  const form = loadForm();
  const steps = require('./helpers/loadTs.cjs')()('src/constants/assessmentSteps.ts');
  const woman = { ...form.defaultAssessmentForm(), gender: 'FEMALE', primaryGoal: 'cycle' };
  assert.equal(form.applyFormPatch(woman, { gender: 'MALE' }).primaryGoal, null);
  assert.equal(form.applyFormPatch(woman, { gender: 'FEMALE' }).primaryGoal, 'cycle');
  assert.equal(form.applyFormPatch({ ...woman, primaryGoal: 'nutrition' }, { gender: 'MALE' }).primaryGoal, 'nutrition');
  // Not a sex change: the goal stays as it is.
  assert.equal(form.applyFormPatch(woman, { birthYear: 1990 }).primaryGoal, 'cycle');
  assert.equal(steps.primaryGoalFits('cycle', 'MALE'), false);
  assert.equal(steps.primaryGoalFits('cycle', 'FEMALE'), true);
  assert.equal(steps.primaryGoalFits(null, 'FEMALE'), false);
  // A stored cycle goal on a man (from before this fix) is cleared by the next save, not merged back.
  const man = { ...woman, gender: 'MALE' };
  assert.equal(form.extraAnswersPayload(man).primaryGoal, null);
  assert.equal(form.extraAnswersPayload(woman).primaryGoal, 'cycle');
  assert.equal(form.extraAnswersPayload({ ...man, primaryGoal: null }).primaryGoal, undefined);
  // Sex not known (a partial local copy): never wipe a stored goal.
  assert.equal(form.extraAnswersPayload({ ...woman, gender: null }).primaryGoal, 'cycle');
  assert.match(read('src/components/assessment/AssessmentStepContent.tsx'), /case 'primary-goal':\s*\/\/[^\n]*\n\s*return primaryGoalFits\(form\.primaryGoal, form\.gender\);/);
  assert.match(read('app/(auth)/assessment/index.tsx'), /applyFormPatch\(current, patch\)/);
});

test('web /app onboarding: the same rule for the goal after a sex change', () => {
  const web = repoRead('server/public/app/js/onboarding.js');
  assert.match(web, /if \(!goalKeys\(gender\)\.includes\(state\.goal\)\) state\.goal = null;/);
  assert.match(web, /\(\) => setGender\('MALE'\)/);
  assert.match(web, /nav\(goals\.some\(\(\[v\]\) => v === state\.goal\)/);
  assert.doesNotMatch(web, /nav\(Boolean\(state\.goal\)/);
});

test('the profile name question starts empty for the placeholder name', () => {
  const form = loadForm();
  const user = { gender: 'MALE', birthDate: '1990-01-01', fullName: 'Medicard მომხმარებელი' };
  assert.equal(form.formFromProfile({ extraAnswers: { legalName: 'Medicard მომხმარებელი' } }, user).legalName, '');
  assert.equal(form.formFromProfile({ extraAnswers: {} }, { ...user, fullName: 'Giorgi Beridze' }).legalName, 'Giorgi Beridze');
  assert.equal(form.formFromProfile({ extraAnswers: { legalName: 'გიორგი ბერიძე' } }, user).legalName, 'გიორგი ბერიძე');
});

test('„დაასრულე პროფილი“ finishes back where it was opened, not on the Profile tab', () => {
  const screen = read('app/(auth)/assessment/index.tsx');
  assert.match(screen, /leaveProfileComplete\(router\);/);
  assert.doesNotMatch(screen, /router\.replace\('\/\(tabs\)\/profile'/);
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
