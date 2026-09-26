/**
 * "დაასრულე პროფილი" — how much of the full health profile is answered.
 * The 7-step onboarding only asks the essentials; the rest (blood type, allergies,
 * conditions, habits…) is completed later from this card. Pure: no I/O.
 */
type ProfileLike = {
  heightCm?: number | null;
  weightKg?: number | null;
  bloodType?: string | null;
  smokingStatus?: string | null;
  dietType?: string | null;
  allergies?: string[] | null;
  healthGoals?: unknown;
  extraAnswers?: Record<string, unknown> | null;
} | null | undefined;

type UserLike = { gender?: string | null; birthDate?: string | null } | null | undefined;

export type ProfileCompletion = { answered: number; total: number; percent: number; missing: string[] };

export function profileCompletion(profile: ProfileLike, user: UserLike): ProfileCompletion {
  const extra = (profile?.extraAnswers ?? {}) as Record<string, unknown>;
  const confirmed = new Set(Array.isArray(extra.confirmedSteps) ? (extra.confirmedSteps as unknown[]).filter((v) => typeof v === 'string') as string[] : []);
  const checks: Array<[string, boolean]> = [
    ['gender', !!user?.gender],
    ['birthdate', !!user?.birthDate],
    ['height', profile?.heightCm != null],
    ['weight', profile?.weightKg != null],
    ['blood-type', !!profile?.bloodType],
    ['allergies', confirmed.has('allergies') || (profile?.allergies?.length ?? 0) > 0],
    ['conditions-gate', typeof extra.hasConditions === 'boolean'],
    ['medications-gate', typeof extra.takesMedications === 'boolean'],
    ['smoking', !!profile?.smokingStatus],
    ['diet-habits', !!profile?.dietType],
    ['fitness-level', typeof extra.fitnessLevel === 'number'],
    ['sleep-level', typeof extra.sleepLevel === 'number'],
    ['checkup-frequency', typeof extra.checkupFrequency === 'string'],
  ];
  const answered = checks.filter(([, ok]) => ok).length;
  return {
    answered,
    total: checks.length,
    percent: Math.round((answered / checks.length) * 100),
    missing: checks.filter(([, ok]) => !ok).map(([key]) => key),
  };
}

/** Starting point for the onboarding weight goal: a small, safe step from today's weight. */
export function suggestTargetWeight(heightCm: number, weightKg: number): number {
  const m = heightCm / 100;
  const bmi = heightCm > 0 ? weightKg / (m * m) : null;
  const next = bmi != null && bmi < 20 ? weightKg + 2 : weightKg - 3;
  return Math.min(200, Math.max(35, Math.round(next)));
}
