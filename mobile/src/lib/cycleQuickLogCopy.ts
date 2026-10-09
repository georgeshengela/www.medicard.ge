/**
 * „იგივე, რაც გუშინ“ — copies yesterday's everyday observations into today's empty form.
 * Never the private or fertility fields: sex and sex drive, intimate symptoms, tests, BBT, mucus,
 * notes and custom tags stay empty (owner's privacy rules; the shortcut must not re-log sex by accident).
 * Pure: node tests load it.
 */
import type { CyclePainEntry } from '@/lib/api';
import { formatCycleCivilDate } from './cycleCivilDateKa.js';
import { tx } from '../i18n/locale.js';

export type CopyableLog = {
  flow: string | null;
  symptoms: string[];
  moods: string[];
  painEntries: CyclePainEntry[];
  sleepQuality: string | null;
  stressLevel: string | null;
  exerciseLevel: string | null;
  caffeine: string | null;
  alcohol: string | null;
  energy: string | null;
};

const PRIVATE_SYMPTOMS = new Set(['vaginal_dryness', 'itching_vulva', 'discharge', 'pain_sex', 'protected', 'unprotected']);

/** The patch to apply to today's form. Bleeding is copied only when it was bleeding (a logged „არა“ is not a fact worth copying). */
export function copyFromYesterday(yesterday: CopyableLog): Partial<CopyableLog> {
  const flow = yesterday.flow && yesterday.flow !== 'none' ? yesterday.flow : null;
  return {
    flow,
    symptoms: yesterday.symptoms.filter((id) => !PRIVATE_SYMPTOMS.has(id)),
    moods: [...yesterday.moods],
    painEntries: yesterday.painEntries.map((e) => ({ type: e.type, severity: e.severity })),
    sleepQuality: yesterday.sleepQuality,
    stressLevel: yesterday.stressLevel,
    exerciseLevel: yesterday.exerciseLevel,
    caffeine: yesterday.caffeine,
    alcohol: yesterday.alcohol,
    energy: yesterday.energy,
  };
}

/** True when there is something everyday to copy (so the chip is worth showing). */
export function hasCopyableContent(yesterday: CopyableLog): boolean {
  const patch = copyFromYesterday(yesterday);
  return Boolean(patch.flow) || (patch.symptoms?.length ?? 0) > 0 || (patch.moods?.length ?? 0) > 0 || (patch.painEntries?.length ?? 0) > 0;
}

/** True when today's form has nothing logged yet (the chip only offers to fill an empty day). */
export function formIsEmpty(form: CopyableLog & { sexual?: boolean | null; notes?: string }): boolean {
  return (
    !form.flow &&
    form.symptoms.length === 0 &&
    form.moods.length === 0 &&
    form.painEntries.length === 0 &&
    !form.sleepQuality &&
    !form.stressLevel &&
    !form.exerciseLevel &&
    !form.caffeine &&
    !form.alcohol &&
    !form.energy &&
    form.sexual !== true &&
    !(form.notes && form.notes.trim())
  );
}

/** Pain strength cycle on a tile: nothing → moderate → severe → mild → nothing. */
export function nextPainSeverity(current: 'mild' | 'moderate' | 'severe' | null): 'mild' | 'moderate' | 'severe' | null {
  if (!current) return 'moderate';
  if (current === 'moderate') return 'severe';
  if (current === 'severe') return 'mild';
  return null;
}

export function painLevel(severity: 'mild' | 'moderate' | 'severe' | string | null | undefined): 1 | 2 | 3 | null {
  return severity === 'mild' ? 1 : severity === 'moderate' ? 2 : severity === 'severe' ? 3 : null;
}

/**
 * The quick-log sheet's title for another day (CYC-12): the date in words in the app language
 * („5 ოქტომბერი 2026“ / "5 October 2026"), never an ISO date. Null for today — the sheet then says
 * „დღის აღრიცხვა“ / "Log today".
 */
export function quickLogTitleDate(date: string, today: string, lang?: 'ka' | 'en'): string | null {
  if (date === today) return null;
  return formatCycleCivilDate(date, lang);
}

/** The day sheet's heading above its inline log: "Log today" only for today. */
export function quickLogHeading(date: string, today: string, todayLabel: string): string {
  return date === today ? todayLabel : tx('დღის აღრიცხვა', 'Log this day');
}
