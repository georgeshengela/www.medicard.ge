import { MOOD_OPTIONS, PHYSICAL_SYMPTOMS, SEXUAL_OPTIONS } from '@/constants/cycle';

export const OBSERVATION_SCHEMA_VERSION = 1;

export const ENERGY_LEVELS = ['very_low', 'low', 'normal', 'high', 'very_high'] as const;
export type CycleEnergyLevel = (typeof ENERGY_LEVELS)[number];

export const UI_GROUPS = ['physical', 'energy', 'mood', 'digestion', 'skin', 'fertility', 'private'] as const;
export type CycleUiGroup = (typeof UI_GROUPS)[number];

export const PAIN_MANAGED_SYMPTOM_IDS = new Set([
  'cramps',
  'headache',
  'back_pain',
  'breast_tenderness',
  'pelvic_pain',
  'ovulation_pain',
]);

const DIGESTION_IDS = new Set([
  'bloating',
  'nausea',
  'vomiting',
  'constipation',
  'diarrhea',
  'heartburn',
  'gas',
  'appetite_up',
  'appetite_down',
  'cravings',
]);

const SKIN_IDS = new Set(['acne', 'dry_skin', 'oily_skin', 'itchy_skin', 'hair_loss']);
const ENERGY_CHIP_IDS = new Set(['fatigue', 'insomnia', 'oversleep']);
const PRIVATE_CHIP_IDS = new Set([
  ...SEXUAL_OPTIONS.map((o) => o.id),
  'vaginal_dryness',
  'itching_vulva',
]);

export const SENSITIVE_SHORTCUT_IDS = new Set([
  ...PRIVATE_CHIP_IDS,
  'discharge',
  'protected',
  'unprotected',
  'pain_sex',
]);

export function chipGroup(id: string): CycleUiGroup | null {
  if (PAIN_MANAGED_SYMPTOM_IDS.has(id)) return null;
  if (PRIVATE_CHIP_IDS.has(id)) return 'private';
  if (DIGESTION_IDS.has(id)) return 'digestion';
  if (SKIN_IDS.has(id)) return 'skin';
  if (ENERGY_CHIP_IDS.has(id)) return 'energy';
  if (PHYSICAL_SYMPTOMS.some((o) => o.id === id)) return 'physical';
  if (MOOD_OPTIONS.some((o) => o.id === id)) return 'mood';
  return null;
}

export function chipsForGroup(group: CycleUiGroup) {
  if (group === 'mood') return MOOD_OPTIONS;
  if (group === 'private') {
    return [
      ...SEXUAL_OPTIONS,
      ...PHYSICAL_SYMPTOMS.filter((o) => PRIVATE_CHIP_IDS.has(o.id)),
    ];
  }
  return PHYSICAL_SYMPTOMS.filter((o) => chipGroup(o.id) === group);
}

export function stripPainManagedSymptoms(
  symptoms: string[] | undefined,
  painEntries: { type: string }[] | undefined,
): string[] {
  const covered = new Set(
    (painEntries || [])
      .map((entry) => {
        if (entry.type === 'cramps') return 'cramps';
        if (entry.type === 'headache') return 'headache';
        if (entry.type === 'lower_back') return 'back_pain';
        if (entry.type === 'breast') return 'breast_tenderness';
        if (entry.type === 'pelvic') return 'pelvic_pain';
        if (entry.type === 'ovulation_side') return 'ovulation_pain';
        return null;
      })
      .filter(Boolean) as string[],
  );
  return (symptoms || []).filter((key) => !PAIN_MANAGED_SYMPTOM_IDS.has(key) || !covered.has(key));
}

export function recentObservationKeys(
  logs: Array<{ date?: string; symptoms?: string[]; moods?: string[]; observations?: { energy?: string | null } | null }>,
  { limit = 4, minDays = 2 } = {},
): string[] {
  const counts = new Map<string, Set<string>>();
  const lastSeen = new Map<string, string>();
  const rows = [...logs].sort((a, b) => String(b?.date || '').localeCompare(String(a?.date || '')));
  for (const log of rows) {
    const date = String(log?.date || '');
    const keys = stripPainManagedSymptoms(log.symptoms, []).filter((id) => !SENSITIVE_SHORTCUT_IDS.has(id));
    for (const mood of log.moods || []) keys.push(mood);
    for (const key of keys) {
      const seen = counts.get(key) || new Set();
      if (date) seen.add(date);
      counts.set(key, seen);
      if (!lastSeen.has(key)) lastSeen.set(key, date);
    }
  }
  return [...counts.entries()]
    .filter(([, dates]) => dates.size >= minDays)
    .sort((a, b) => String(lastSeen.get(b[0]) || '').localeCompare(String(lastSeen.get(a[0]) || '')))
    .slice(0, limit)
    .map(([key]) => key);
}

export function observationsEnergy(observations: { energy?: string | null } | null | undefined): string | null {
  const value = observations?.energy;
  return ENERGY_LEVELS.includes(value as CycleEnergyLevel) ? (value as string) : null;
}
