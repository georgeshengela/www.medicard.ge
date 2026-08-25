import type { Gender, HealthProfile } from '@/lib/api';
import { ageFromBirthDate, birthDateIso, parseBirthDate } from '@/components/assessment/DateWheelPicker';

export type AssessmentFormState = {
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
    bodyType: 'ECTOMORPH',
    heightCm: 170,
    heightUnit: 'cm',
    weightKg: 70,
    weightUnit: 'kg',
    bloodType: 'A-',
    fitnessLevel: 3,
    sleepLevel: 3,
    smokingStatus: null,
    mood: 'NEUTRAL',
    dietType: null,
    takesMedications: null,
    medications: [],
    allergies: [],
    hasConditions: null,
    chronicConditions: [],
    checkupFrequency: 'MONTHLY',
    healthNote: '',
    healthGoals: [],
    voiceRecorded: false,
  };
}

export function ageFromForm(form: AssessmentFormState): number {
  return ageFromBirthDate(form.birthMonth, form.birthDay, form.birthYear);
}

export function birthDateFromForm(form: AssessmentFormState): string {
  return birthDateIso(form.birthMonth, form.birthDay, form.birthYear);
}

export function computeBmi(heightCm: number, weightKg: number): number | null {
  if (!heightCm || !weightKg) return null;
  const m = heightCm / 100;
  return Math.round((weightKg / (m * m)) * 10) / 10;
}

function extraFromProfile(profile: HealthProfile | null): Partial<AssessmentFormState> {
  const extra = (profile?.extraAnswers ?? {}) as Record<string, unknown>;
  return {
    legalName: typeof extra.legalName === 'string' ? extra.legalName : '',
    genderOther: typeof extra.genderOther === 'string' ? extra.genderOther : '',
    bodyType: typeof extra.bodyType === 'string' ? extra.bodyType : 'ECTOMORPH',
    fitnessLevel: typeof extra.fitnessLevel === 'number' ? extra.fitnessLevel : 3,
    sleepLevel: typeof extra.sleepLevel === 'number' ? extra.sleepLevel : 3,
    mood: typeof extra.mood === 'string' ? extra.mood : null,
    takesMedications: typeof extra.takesMedications === 'boolean' ? extra.takesMedications : null,
    hasConditions: typeof extra.hasConditions === 'boolean' ? extra.hasConditions : null,
    checkupFrequency: typeof extra.checkupFrequency === 'string' ? extra.checkupFrequency : null,
    healthNote: typeof extra.healthNote === 'string' ? extra.healthNote : '',
    weightUnit: extra.weightUnit === 'lbs' ? 'lbs' : 'kg',
    heightUnit: extra.heightUnit === 'ft' ? 'ft' : 'cm',
    voiceRecorded: extra.voiceRecorded === true,
  };
}

export function formFromProfile(
  profile: HealthProfile | null,
  user: { gender: Gender | null; birthDate: string | null; name?: string },
): AssessmentFormState {
  const base = defaultAssessmentForm();
  const parsed = parseBirthDate(user.birthDate);
  const extra = extraFromProfile(profile);

  return {
    ...base,
    ...extra,
    legalName: extra.legalName || user.name || '',
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

export function extraAnswersPayload(form: AssessmentFormState): Record<string, unknown> {
  return {
    legalName: form.legalName,
    genderOther: form.genderOther,
    bodyType: form.bodyType,
    fitnessLevel: form.fitnessLevel,
    sleepLevel: form.sleepLevel,
    mood: form.mood,
    takesMedications: form.takesMedications,
    hasConditions: form.hasConditions,
    checkupFrequency: form.checkupFrequency,
    healthNote: form.healthNote,
    weightUnit: form.weightUnit,
    heightUnit: form.heightUnit,
    voiceRecorded: form.voiceRecorded,
  };
}

function mapDietType(diet: string | null): string | undefined {
  if (!diet) return undefined;
  const map: Record<string, string> = {
    BALANCED: 'OMNIVORE',
    VEGETARIAN: 'VEGETARIAN',
    PROTEIN: 'OTHER',
    GLUTEN_FREE: 'OTHER',
  };
  return map[diet] ?? 'OTHER';
}

export function fullProfilePayload(form: AssessmentFormState, stepIndex: number): Record<string, unknown> {
  return {
    currentStepIndex: stepIndex,
    gender: form.gender ?? undefined,
    birthDate: birthDateFromForm(form),
    heightCm: form.heightCm,
    weightKg: form.weightKg,
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
  heightCm: number;
  weightKg: number;
} {
  if (!form.gender) throw new Error('gender required');
  return {
    gender: form.gender,
    birthDate: birthDateFromForm(form),
    heightCm: form.heightCm,
    weightKg: form.weightKg,
  };
}

export function patchPayloadForStep(form: AssessmentFormState, stepIndex: number): Record<string, unknown> {
  return fullProfilePayload(form, stepIndex);
}
