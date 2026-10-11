/**
 * "დაასრულე პროფილი" — how much of the health profile is answered. Registration asks only the
 * essentials (name, sex, birth date, height, weight); the medical basics and the way-of-life questions
 * are completed later from this card. Keys match the questions in PROFILE_QUESTIONS. Pure: no I/O.
 */
import { realFullName } from './displayName.ts';
import { habitsFromProfile } from './healthHabits.ts';

type ProfileLike = {
  heightCm?: number | null;
  weightKg?: number | null;
  bloodType?: string | null;
  smokingStatus?: string | null;
  allergies?: string[] | null;
  chronicConditions?: string[] | null;
  medications?: string[] | null;
  extraAnswers?: Record<string, unknown> | null;
} | null | undefined;

type UserLike = { gender?: string | null; birthDate?: string | null; fullName?: string | null } | null | undefined;

export type ProfileCompletion = { answered: number; total: number; percent: number; missing: string[] };

/** Which profile questions already have an answer (MEDIPILL medicines count for „do you take any“). */
export function answeredQuestions(profile: ProfileLike, user: UserLike, opts: { pillCount?: number } = {}): Record<string, boolean> {
  const extra = (profile?.extraAnswers ?? {}) as Record<string, unknown>;
  const confirmed = new Set(Array.isArray(extra.confirmedSteps) ? (extra.confirmedSteps as unknown[]).filter((v) => typeof v === 'string') as string[] : []);
  const habits = habitsFromProfile(profile);
  return {
    name: realFullName(user, extra) !== '',
    gender: !!user?.gender,
    birthdate: !!user?.birthDate,
    height: profile?.heightCm != null,
    weight: profile?.weightKg != null,
    'blood-type': !!profile?.bloodType,
    allergies: confirmed.has('allergies') || (profile?.allergies?.length ?? 0) > 0,
    'conditions-gate': typeof extra.hasConditions === 'boolean' || (profile?.chronicConditions?.length ?? 0) > 0,
    'medications-gate': typeof extra.takesMedications === 'boolean' || (profile?.medications?.length ?? 0) > 0 || (opts.pillCount ?? 0) > 0,
    activity: habits.activeDays !== null,
    sleep: habits.sleepBand !== null,
    smoking: habits.smoking !== null,
    alcohol: habits.alcoholFreq !== null,
    diet: habits.dietPatterns.length > 0,
    eating: habits.produce !== null,
  };
}

export function profileCompletion(profile: ProfileLike, user: UserLike, opts: { pillCount?: number } = {}): ProfileCompletion {
  const checks = Object.entries(answeredQuestions(profile, user, opts));
  const answered = checks.filter(([, ok]) => ok).length;
  return {
    answered,
    total: checks.length,
    percent: Math.round((answered / checks.length) * 100),
    missing: checks.filter(([, ok]) => !ok).map(([key]) => key),
  };
}

/** Starting point for a weight goal: a small, safe step from today's weight. */
export function suggestTargetWeight(heightCm: number, weightKg: number): number {
  const m = heightCm / 100;
  const bmi = heightCm > 0 ? weightKg / (m * m) : null;
  const next = bmi != null && bmi < 20 ? weightKg + 2 : weightKg - 3;
  return Math.min(200, Math.max(35, Math.round(next)));
}
