import type {
  CycleAlcoholLevel,
  CycleCaffeineLevel,
  CycleCustomTag,
  CycleExerciseLevel,
  CyclePainEntry,
  CyclePainSeverity,
  CyclePainType,
  CycleSleepQuality,
  CycleStressLevel,
} from '@/lib/api';
import { ka } from '@/i18n/ka';

export const PAIN_TYPES: CyclePainType[] = [
  'cramps',
  'pelvic',
  'lower_back',
  'headache',
  'breast',
  'ovulation_side',
  'other',
];

export const PAIN_SEVERITIES: CyclePainSeverity[] = ['mild', 'moderate', 'severe'];
export const SLEEP_QUALITIES: CycleSleepQuality[] = ['poor', 'okay', 'good'];
export const STRESS_LEVELS: CycleStressLevel[] = ['low', 'medium', 'high'];
export const EXERCISE_LEVELS: CycleExerciseLevel[] = ['none', 'light', 'moderate', 'intense'];
export const CAFFEINE_LEVELS: CycleCaffeineLevel[] = ['none', 'low', 'moderate', 'high'];
export const ALCOHOL_LEVELS: CycleAlcoholLevel[] = ['none', 'light', 'moderate', 'heavy'];

export const PAIN_MANAGED_SYMPTOM_IDS = new Set([
  'cramps',
  'headache',
  'back_pain',
  'breast_tenderness',
  'pelvic_pain',
  'ovulation_pain',
]);

export const CYCLE_NOTE_MAX = 2000;
export const CYCLE_TAG_NAME_MAX = 48;

export function painTypeLabel(type: string): string {
  return ka.cycle.painType[type as CyclePainType] ?? type;
}

export function painSeverityLabel(severity: string): string {
  return ka.cycle.painSeverity[severity as CyclePainSeverity] ?? severity;
}

export function sleepLabel(value: string): string {
  return ka.cycle.sleepQuality[value as CycleSleepQuality] ?? value;
}

export function stressLabel(value: string): string {
  return ka.cycle.stressLevel[value as CycleStressLevel] ?? value;
}

export function exerciseLabel(value: string): string {
  return ka.cycle.exerciseLevel[value as CycleExerciseLevel] ?? value;
}

export function caffeineLabel(value: string): string {
  return ka.cycle.caffeineLevel[value as CycleCaffeineLevel] ?? value;
}

export function alcoholLabel(value: string): string {
  return ka.cycle.alcoholLevel[value as CycleAlcoholLevel] ?? value;
}

export function formatPainEntry(entry: CyclePainEntry): string {
  return `${painTypeLabel(entry.type)} — ${painSeverityLabel(entry.severity)}`;
}

export function upsertPainEntry(
  entries: CyclePainEntry[],
  type: CyclePainType,
  severity: CyclePainSeverity,
): CyclePainEntry[] {
  const rest = entries.filter((e) => e.type !== type);
  return [...rest, { type, severity }];
}

export function removePainEntry(entries: CyclePainEntry[], type: CyclePainType): CyclePainEntry[] {
  return entries.filter((e) => e.type !== type);
}

export function activeCustomTags(tags: CycleCustomTag[] | undefined): CycleCustomTag[] {
  return (tags || []).filter((tag) => !tag.archivedAt);
}

export function tagNameById(tags: CycleCustomTag[] | undefined, id: string): string {
  return (tags || []).find((tag) => tag.id === id)?.name ?? id;
}
