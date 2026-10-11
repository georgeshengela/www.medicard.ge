/**
 * The questions of registration and of „დაასრულე პროფილი“ (owner 2026-10-11 rework).
 *
 * Registration asks only what the app needs to work: the name (when the sign-in did not bring a real
 * one — phone, Apple without a name), sex, birth date (18+), height, weight. Then the tail screens:
 * privacy + AI consent, notifications, Home layout. The „what do you need MEDICARD for?“ goal question
 * is gone (owner: „ვაბშე ამოიღე“) — the Home layout pick already personalises Home.
 *
 * „დაასრულე პროფილი“ walks only the questions still unanswered, then shows one summary where every
 * answer opens its own question and comes straight back (never the whole list again).
 */
export type QuestionKey =
  // registration
  | 'name'
  | 'gender'
  | 'birthdate'
  | 'height'
  | 'weight'
  // „დაასრულე პროფილი“
  | 'blood-type'
  | 'allergies'
  | 'conditions-gate'
  | 'conditions-list'
  | 'medications-gate'
  | 'medications-list'
  | 'activity'
  | 'sleep'
  | 'smoking'
  | 'alcohol'
  | 'diet'
  | 'eating';

/** Stored as `extraAnswers.onboardingStepKey` (resume + the server's „onboarding started“ check). */
export const ONBOARDING_STEP_KEYS: Record<'name' | 'gender' | 'birthdate' | 'height' | 'weight', string> = {
  name: 'o0-name',
  gender: 'o1-gender',
  birthdate: 'o3-birthdate',
  height: 'o4-height',
  weight: 'o4-weight',
};

/** Height and weight are two pages (owner 2026-10-11: one page for both looked crowded). */
export const ONBOARDING_QUESTIONS = ['name', 'gender', 'birthdate', 'height', 'weight'] as const satisfies readonly QuestionKey[];

/** Questions counted in the progress grooves (the name page reads as sign-up and is not counted). */
export const ONBOARDING_COUNTED_QUESTIONS = 4;

/** Keys written by older builds that point at steps which no longer exist. */
const RETIRED_RESUME: Record<string, (typeof ONBOARDING_QUESTIONS)[number]> = {
  'o2-goal': 'birthdate',
  'o4-body': 'height',
  'o5-medication': 'weight',
  'o5-weight': 'weight',
  'o5-cycle': 'weight',
};

/** Where a stored onboarding key resumes; null = start at the first question. */
export function onboardingResumeQuestion(stored: unknown): (typeof ONBOARDING_QUESTIONS)[number] | null {
  if (typeof stored !== 'string') return null;
  const current = (Object.keys(ONBOARDING_STEP_KEYS) as (keyof typeof ONBOARDING_STEP_KEYS)[]).find((k) => ONBOARDING_STEP_KEYS[k] === stored);
  return current ?? RETIRED_RESUME[stored] ?? null;
}

/** Steps 5 (privacy + AI consent), 6 (notifications) and 7 (Home layout) run after the questions. */
export const ONBOARDING_TAIL_STEPS = 3;

/** „დაასრულე პროფილი“ in asking order: the medical basics first, then the way of life. */
export const PROFILE_QUESTIONS = [
  'name',
  'blood-type',
  'allergies',
  'conditions-gate',
  'conditions-list',
  'medications-gate',
  'medications-list',
  'activity',
  'sleep',
  'smoking',
  'alcohol',
  'diet',
  'eating',
] as const satisfies readonly QuestionKey[];

/** A list question follows its yes/no gate and is never asked on its own. */
export const LIST_AFTER_GATE: Partial<Record<QuestionKey, QuestionKey>> = {
  'conditions-gate': 'conditions-list',
  'medications-gate': 'medications-list',
};

/** Older Home code still reads a stored onboarding goal (accounts made before 2026-10-11). */
export type PrimaryGoal = 'medications' | 'nutrition' | 'cycle' | 'general';
