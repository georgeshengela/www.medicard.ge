import type { Gender, HealthProfile } from '@/lib/api';
import type { PrimaryGoal } from '@/constants/assessmentSteps';
import {
  ageFromBirthDate,
  birthDateIso,
  parseBirthDate,
} from '@/components/assessment/DateWheelPicker';
import { realFullName } from '@/lib/displayName';
import { emptyHabits, habitsFromProfile, habitsPayload, type HabitAnswers } from '@/lib/healthHabits';
import { tx } from '../i18n/locale.js';

/** Registration and „დაასრულე პროფილი“ answers while they are being given. */
export type AssessmentFormState = {
  /** Question keys the person answered (or confirmed a default of) — untouched defaults are never saved. */
  confirmedSteps: string[];
  firstName: string;
  lastName: string;
  birthMonth: number;
  birthDay: number;
  birthYear: number;
  gender: Gender | null;
  genderOther: string;
  heightCm: number;
  heightUnit: 'cm' | 'ft';
  weightKg: number;
  weightUnit: 'kg' | 'lbs';
  bloodType: string | null;
  takesMedications: boolean | null;
  medications: string[];
  allergies: string[];
  hasConditions: boolean | null;
  chronicConditions: string[];
  habits: HabitAnswers;
};

export function defaultAssessmentForm(): AssessmentFormState {
  const { month, day, year } = parseBirthDate(null);
  return {
    confirmedSteps: [],
    firstName: '',
    lastName: '',
    birthMonth: month,
    birthDay: day,
    birthYear: year,
    gender: null,
    genderOther: '',
    heightCm: 170,
    heightUnit: 'cm',
    weightKg: 70,
    weightUnit: 'kg',
    bloodType: null,
    takesMedications: null,
    medications: [],
    allergies: [],
    hasConditions: null,
    chronicConditions: [],
    habits: emptyHabits(),
  };
}

const PRIMARY_GOALS: PrimaryGoal[] = ['medications', 'nutrition', 'cycle', 'general'];
/** The goal older onboarding stored (accounts made before 2026-10-11); new accounts have none. */
export function primaryGoalFromProfile(profile: HealthProfile | null | undefined): PrimaryGoal | null {
  const raw = (profile?.extraAnswers as Record<string, unknown> | undefined)?.primaryGoal;
  return PRIMARY_GOALS.includes(raw as PrimaryGoal) ? (raw as PrimaryGoal) : null;
}

export function ageFromForm(form: Pick<AssessmentFormState, 'birthMonth' | 'birthDay' | 'birthYear'>): number {
  return ageFromBirthDate(form.birthMonth, form.birthDay, form.birthYear);
}

export function birthDateFromForm(form: Pick<AssessmentFormState, 'birthMonth' | 'birthDay' | 'birthYear'>): string {
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
  return { value: String(Math.round(weightKg * 10) / 10), unitLabel: tx('კგ', 'kg') };
}

export function computeBmi(heightCm: number, weightKg: number): number | null {
  if (!heightCm || !weightKg) return null;
  const m = heightCm / 100;
  return Math.round((weightKg / (m * m)) * 10) / 10;
}

/** „ნინო ბერიძე“ → first + last; the server's placeholder name is no name. */
export function splitFullName(full: string): { firstName: string; lastName: string } {
  const parts = full.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  return { firstName: parts[0] ?? '', lastName: parts.slice(1).join(' ') };
}

/** What the name question saves: both parts, tidied, at least 2 letters each. */
export function fullNameFromForm(form: Pick<AssessmentFormState, 'firstName' | 'lastName'>): string | null {
  const first = form.firstName.replace(/\s+/g, ' ').trim();
  const last = form.lastName.replace(/\s+/g, ' ').trim();
  if (first.length < 2 || last.length < 2) return null;
  return `${first} ${last}`;
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
  const extra = (profile?.extraAnswers ?? {}) as Record<string, unknown>;
  const stored = Array.isArray(extra.confirmedSteps) ? extra.confirmedSteps.filter((v): v is string => typeof v === 'string') : [];
  // The server's placeholder name („Medicard მომხმარებელი“, phone / Apple sign-ups) is no name.
  const { firstName, lastName } = splitFullName(realFullName({ fullName: user.fullName || user.name }, { legalName: extra.legalName }));

  return {
    ...base,
    confirmedSteps: Array.from(
      new Set([
        ...stored,
        ...(user.birthDate ? ['birthdate'] : []),
        ...(profile?.heightCm != null ? ['height'] : []),
        ...(profile?.weightKg != null ? ['weight'] : []),
      ]),
    ),
    firstName,
    lastName,
    birthMonth: parsed.month,
    birthDay: parsed.day,
    birthYear: parsed.year,
    gender: user.gender,
    genderOther: typeof extra.genderOther === 'string' ? extra.genderOther : '',
    heightCm: profile?.heightCm ?? base.heightCm,
    heightUnit: extra.heightUnit === 'ft' ? 'ft' : 'cm',
    weightKg: profile?.weightKg ?? base.weightKg,
    weightUnit: extra.weightUnit === 'lbs' ? 'lbs' : 'kg',
    bloodType: profile?.bloodType ?? null,
    takesMedications: typeof extra.takesMedications === 'boolean' ? extra.takesMedications : null,
    medications: [...(profile?.medications ?? [])],
    allergies: [...(profile?.allergies ?? [])],
    hasConditions: typeof extra.hasConditions === 'boolean' ? extra.hasConditions : null,
    chronicConditions: [...(profile?.chronicConditions ?? [])],
    habits: habitsFromProfile(profile),
  };
}

/** extraAnswers this form owns. The server merges extraAnswers, so keys left out keep their value. */
export function extraAnswersPayload(form: AssessmentFormState): Record<string, unknown> {
  return {
    confirmedSteps: form.confirmedSteps,
    genderOther: form.genderOther,
    weightUnit: form.weightUnit,
    heightUnit: form.heightUnit,
    ...(form.takesMedications !== null ? { takesMedications: form.takesMedications } : {}),
    ...(form.hasConditions !== null ? { hasConditions: form.hasConditions } : {}),
    ...habitsPayload(form.habits).extra,
  };
}

/** The whole answered profile; untouched display defaults (170 cm, 70 kg, today's date) are never sent. */
export function fullProfilePayload(form: AssessmentFormState): Record<string, unknown> {
  const confirmed = new Set(form.confirmedSteps);
  return {
    gender: form.gender ?? undefined,
    birthDate: confirmed.has('birthdate') ? birthDateFromForm(form) : undefined,
    heightCm: confirmed.has('height') ? form.heightCm : undefined,
    weightKg: confirmed.has('weight') ? form.weightKg : undefined,
    bloodType: form.bloodType ?? undefined,
    medications: form.medications,
    allergies: form.allergies,
    chronicConditions: form.chronicConditions,
    ...habitsPayload(form.habits).columns,
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
  if (!form.confirmedSteps.includes('birthdate')) throw new Error('birthdate required');
  return {
    gender: form.gender,
    birthDate: birthDateFromForm(form),
    ...(form.confirmedSteps.includes('height') ? { heightCm: form.heightCm } : {}),
    ...(form.confirmedSteps.includes('weight') ? { weightKg: form.weightKg } : {}),
  };
}

/**
 * The write for one „დაასრულე პროფილი“ answer: only that question's fields (+ the confirmed list), so
 * an answer never re-sends — or undoes — anything else. The name goes to the account separately.
 */
export function questionPayload(key: string, form: AssessmentFormState): Record<string, unknown> {
  const extra: Record<string, unknown> = { confirmedSteps: form.confirmedSteps };
  switch (key) {
    case 'name':
      return { extraAnswers: { ...extra, legalName: fullNameFromForm(form) ?? undefined } };
    case 'blood-type':
      return { bloodType: form.bloodType ?? undefined, extraAnswers: extra };
    case 'allergies':
      return { allergies: form.allergies, extraAnswers: extra };
    case 'conditions-gate':
    case 'conditions-list':
      return { chronicConditions: form.chronicConditions, extraAnswers: { ...extra, ...(form.hasConditions !== null ? { hasConditions: form.hasConditions } : {}) } };
    case 'medications-gate':
    case 'medications-list':
      return { medications: form.medications, extraAnswers: { ...extra, ...(form.takesMedications !== null ? { takesMedications: form.takesMedications } : {}) } };
    default: {
      const habits = habitsPayload(form.habits);
      return { ...habits.columns, extraAnswers: { ...extra, ...habits.extra } };
    }
  }
}
