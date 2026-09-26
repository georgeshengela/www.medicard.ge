import type { Gender, HealthProfile } from '@/lib/api';
import type { PrimaryGoal } from '@/constants/assessmentSteps';
import {
  ageFromBirthDate,
  birthDateIso,
  parseBirthDate,
} from '@/components/assessment/DateWheelPicker';

export type AssessmentFormState = {
  confirmedSteps?: string[];
  legalName: string;
  birthMonth: number;
  birthDay: number;
  birthYear: number;
  gender: Gender | null;
  genderOther: string;
  bodyType: string | null;
  heightCm: number;
  heightUnit: 'cm' | 'ft';
  weightKg: number;
  weightUnit: 'kg' | 'lbs';
  bloodType: string | null;
  fitnessLevel: number;
  sleepLevel: number;
  smokingStatus: string | null;
  mood: string | null;
  dietType: string | null;
  takesMedications: boolean | null;
  medications: string[];
  allergies: string[];
  hasConditions: boolean | null;
  chronicConditions: string[];
  checkupFrequency: string | null;
  healthNote: string;
  healthGoals: string[];
  voiceRecorded: boolean;
  /** 7-step onboarding: what the person came for; drives Home order. */
  primaryGoal: PrimaryGoal | null;
  targetWeightKg: number;
  lastPeriodMonth: number;
  lastPeriodDay: number;
  lastPeriodYear: number;
};

export function defaultAssessmentForm(): AssessmentFormState {
  const { month, day, year } = parseBirthDate(null);
  return {
    legalName: '',
    birthMonth: month,
    birthDay: day,
    birthYear: year,
    gender: null,
    genderOther: '',
    bodyType: null,
    heightCm: 170,
    heightUnit: 'cm',
    weightKg: 70,
    weightUnit: 'kg',
    bloodType: null,
    fitnessLevel: 3,
    sleepLevel: 3,
    smokingStatus: null,
    mood: null,
    dietType: null,
    takesMedications: null,
    medications: [],
    allergies: [],
    hasConditions: null,
    chronicConditions: [],
    checkupFrequency: null,
    healthNote: '',
    healthGoals: [],
    voiceRecorded: false,
    primaryGoal: null,
    targetWeightKg: 67,
    ...lastPeriodDefault(),
  };
}

function lastPeriodDefault() {
  const d = new Date(Date.now() - 14 * 86400000);
  return { lastPeriodMonth: d.getMonth() + 1, lastPeriodDay: d.getDate(), lastPeriodYear: d.getFullYear() };
}

export function lastPeriodYmd(form: AssessmentFormState): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${form.lastPeriodYear}-${p(form.lastPeriodMonth)}-${p(form.lastPeriodDay)}`;
}

const PRIMARY_GOALS: PrimaryGoal[] = ['medications', 'nutrition', 'cycle', 'general'];
export function primaryGoalFromProfile(profile: HealthProfile | null | undefined): PrimaryGoal | null {
  const raw = (profile?.extraAnswers as Record<string, unknown> | undefined)?.primaryGoal;
  return PRIMARY_GOALS.includes(raw as PrimaryGoal) ? (raw as PrimaryGoal) : null;
}

export function ageFromForm(form: AssessmentFormState): number {
  return ageFromBirthDate(form.birthMonth, form.birthDay, form.birthYear);
}

export function birthDateFromForm(form: AssessmentFormState): string {
  return birthDateIso(form.birthMonth, form.birthDay, form.birthYear);
}

export const LBS_PER_KG = 2.2046226218;

export function displayWeightForUnit(
  weightKg: number,
  unit: 'kg' | 'lbs',
): { value: string; unitLabel: string } {
  if (unit === 'lbs') {
    return {
      value: String(Math.round(weightKg * LBS_PER_KG)),
      unitLabel: 'lbs',
    };
  }
  return { value: String(Math.round(weightKg * 10) / 10), unitLabel: 'კგ' };
}

export function computeBmi(heightCm: number, weightKg: number): number | null {
  if (!heightCm || !weightKg) return null;
  const m = heightCm / 100;
  return Math.round((weightKg / (m * m)) * 10) / 10;
}

function extraFromProfile(
  profile: HealthProfile | null,
): Partial<AssessmentFormState> {
  const extra = (profile?.extraAnswers ?? {}) as Record<string, unknown>;
  return {
    legalName: typeof extra.legalName === 'string' ? extra.legalName : '',
    genderOther: typeof extra.genderOther === 'string' ? extra.genderOther : '',
    bodyType: typeof extra.bodyType === 'string' ? extra.bodyType : null,
    fitnessLevel:
      typeof extra.fitnessLevel === 'number' ? extra.fitnessLevel : 3,
    sleepLevel: typeof extra.sleepLevel === 'number' ? extra.sleepLevel : 3,
    mood: typeof extra.mood === 'string' ? extra.mood : null,
    takesMedications:
      typeof extra.takesMedications === 'boolean'
        ? extra.takesMedications
        : null,
    hasConditions:
      typeof extra.hasConditions === 'boolean' ? extra.hasConditions : null,
    checkupFrequency:
      typeof extra.checkupFrequency === 'string'
        ? extra.checkupFrequency
        : null,
    healthNote: typeof extra.healthNote === 'string' ? extra.healthNote : '',
    weightUnit: extra.weightUnit === 'lbs' ? 'lbs' : 'kg',
    heightUnit: extra.heightUnit === 'ft' ? 'ft' : 'cm',
    voiceRecorded: extra.voiceRecorded === true,
    primaryGoal: primaryGoalFromProfile(profile),
  };
}

export function formFromProfile(
  profile: HealthProfile | null,
  user: {
    gender: Gender | null;
    birthDate: string | null;
    name?: string;
    fullName?: string;
  },
): AssessmentFormState {
  const base = defaultAssessmentForm();
  const parsed = parseBirthDate(user.birthDate);
  const extra = extraFromProfile(profile);

  return {
    ...base,
    ...extra,
    confirmedSteps: Array.from(
      new Set([
        ...(Array.isArray(profile?.extraAnswers?.confirmedSteps)
          ? profile.extraAnswers.confirmedSteps.filter(
              (v): v is string => typeof v === 'string',
            )
          : []),
        ...(user.birthDate ? ['birthdate'] : []),
        ...(profile?.heightCm != null ? ['height'] : []),
        ...(profile?.weightKg != null ? ['weight'] : []),
        ...(typeof profile?.extraAnswers?.fitnessLevel === 'number'
          ? ['fitness-level']
          : []),
        ...(typeof profile?.extraAnswers?.sleepLevel === 'number'
          ? ['sleep-level']
          : []),
      ]),
    ),
    legalName: extra.legalName || user.fullName || user.name || '',
    birthMonth: parsed.month,
    birthDay: parsed.day,
    birthYear: parsed.year,
    gender: user.gender,
    heightCm: profile?.heightCm ?? base.heightCm,
    weightKg: profile?.weightKg ?? base.weightKg,
    smokingStatus: profile?.smokingStatus ?? null,
    dietType: profile?.dietType ?? null,
    medications: [...(profile?.medications ?? [])],
    allergies: [...(profile?.allergies ?? [])],
    chronicConditions: [...(profile?.chronicConditions ?? [])],
    bloodType: profile?.bloodType ?? null,
    healthGoals: [...(profile?.healthGoals ?? [])],
  };
}

export function extraAnswersPayload(
  form: AssessmentFormState,
): Record<string, unknown> {
  return {
    confirmedSteps: form.confirmedSteps ?? [],
    legalName: form.legalName,
    genderOther: form.genderOther,
    bodyType: form.bodyType,
    fitnessLevel: form.confirmedSteps?.includes('fitness-level')
      ? form.fitnessLevel
      : undefined,
    sleepLevel: form.confirmedSteps?.includes('sleep-level')
      ? form.sleepLevel
      : undefined,
    mood: form.mood,
    takesMedications: form.takesMedications,
    hasConditions: form.hasConditions,
    checkupFrequency: form.checkupFrequency,
    healthNote: form.healthNote,
    weightUnit: form.weightUnit,
    heightUnit: form.heightUnit,
    voiceRecorded: form.voiceRecorded,
    primaryGoal: form.primaryGoal ?? undefined,
  };
}

function mapDietType(diet: string | null): string | undefined {
  if (!diet) return undefined;
  const map: Record<string, string> = {
    BALANCED: 'OMNIVORE',
    OMNIVORE: 'OMNIVORE',
    VEGAN: 'VEGAN',
    KETO: 'KETO',
    OTHER: 'OTHER',
    VEGETARIAN: 'VEGETARIAN',
    PROTEIN: 'OTHER',
    GLUTEN_FREE: 'OTHER',
  };
  return map[diet] ?? 'OTHER';
}

export function fullProfilePayload(
  form: AssessmentFormState,
  stepIndex: number,
): Record<string, unknown> {
  return {
    currentStepIndex: stepIndex,
    gender: form.gender ?? undefined,
    birthDate: form.confirmedSteps?.includes('birthdate')
      ? birthDateFromForm(form)
      : undefined,
    heightCm: form.confirmedSteps?.includes('height') || form.confirmedSteps?.includes('body')
      ? form.heightCm
      : undefined,
    weightKg: form.confirmedSteps?.includes('weight') || form.confirmedSteps?.includes('body')
      ? form.weightKg
      : undefined,
    smokingStatus: form.smokingStatus ?? undefined,
    dietType: mapDietType(form.dietType),
    medications: form.medications,
    allergies: form.allergies,
    chronicConditions: form.chronicConditions,
    bloodType: form.bloodType ?? undefined,
    healthGoals: form.healthGoals,
    extraAnswers: extraAnswersPayload(form),
  };
}

export function completePayload(form: AssessmentFormState): {
  gender: Gender;
  birthDate: string;
  heightCm?: number;
  weightKg?: number;
} {
  if (!form.gender) throw new Error('gender required');
  if (!form.confirmedSteps?.includes('birthdate'))
    throw new Error('birthdate required');
  return {
    gender: form.gender,
    birthDate: birthDateFromForm(form),
    ...(form.confirmedSteps?.includes('height')
      ? { heightCm: form.heightCm }
      : {}),
    ...(form.confirmedSteps?.includes('weight')
      ? { weightKg: form.weightKg }
      : {}),
  };
}

export function patchPayloadForStep(
  form: AssessmentFormState,
  stepIndex: number,
): Record<string, unknown> {
  return fullProfilePayload(form, stepIndex);
}
