// Relative so node tests (`cycleFullLog.test.ts`) can load this module; Metro resolves it the same way.
import { MOOD_OPTIONS, PHYSICAL_SYMPTOMS, SEXUAL_OPTIONS } from '../constants/cycle.ts';

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

/**
 * Keys of the `observations` JSON bag — mirror of the server registry's STORAGE.OBSERVATIONS rows
 * (server/src/lib/cycleObservationRegistry.js; parity test in cycleForecastCopy.test.ts). An unknown key
 * is refused by the server, so a key is added here and there together.
 */
export const OBSERVATION_BAG_KEYS = Object.freeze({
  energy: { sensitivity: 'HEALTH', ai: false, partner: false, analytics: false },
  // „ოვულაცია ამ დღეს იყო“ — private like OPK / mucus; centres that cycle's ovulation band on the server.
  ovulationMarked: { sensitivity: 'SENSITIVE', ai: false, partner: false, analytics: false },
} as const);

/**
 * What a cycle screen may hand to Medi as context (W2-8, brief §7 pillar 2 [კ-10]): today's pain
 * (the `pain` row — place + strength) and today's moods. A mirror of the server registry rows
 * (server/src/lib/cycleObservationRegistry.js) with their sensitivity and AI flag; the context builder
 * (`cycleMediContext.ts`) keeps only keys for which `isAiContextKey` is true — HEALTH sensitivity with
 * the server's `aiDefaultAllowed`. Sex and sex drive, intimate symptoms, discharge, mucus, OPK /
 * pregnancy tests, BBT and notes are SENSITIVE / HIGHLY_SENSITIVE or not here at all, so they can never
 * travel. Parity with the server is tested in cycleMediContext.test.ts: a mood the server makes
 * private stops travelling from here too.
 */
export const AI_CONTEXT_REGISTRY: Readonly<Record<string, { storage: 'painEntries' | 'moods'; sensitivity: 'HEALTH' | 'SENSITIVE' | 'HIGHLY_SENSITIVE'; ai: boolean }>> =
  Object.freeze({
    pain: { storage: 'painEntries', sensitivity: 'HEALTH', ai: true },
    ...Object.fromEntries(
      MOOD_OPTIONS.map((o) => [o.id, { storage: 'moods' as const, sensitivity: 'HEALTH' as const, ai: !SENSITIVE_SHORTCUT_IDS.has(o.id) }]),
    ),
  });

/** Pain places and strengths (server PAIN_TYPES / PAIN_SEVERITIES — parity tested). */
export const AI_CONTEXT_PAIN_TYPES = Object.freeze(['cramps', 'pelvic', 'lower_back', 'headache', 'breast', 'ovulation_side', 'other'] as const);
export const AI_CONTEXT_PAIN_SEVERITIES = Object.freeze(['mild', 'moderate', 'severe'] as const);

/** True only for an everyday (HEALTH) observation the server registry lets AI read. */
export function isAiContextKey(key: string): boolean {
  const row = Object.prototype.hasOwnProperty.call(AI_CONTEXT_REGISTRY, key) ? AI_CONTEXT_REGISTRY[key] : null;
  return Boolean(row && row.ai && row.sensitivity === 'HEALTH' && !SENSITIVE_SHORTCUT_IDS.has(key));
}

export const OVULATION_MARK_KEY = 'ovulationMarked';

export function isOvulationMarked(observations: { ovulationMarked?: boolean | null } | null | undefined): boolean {
  return observations?.ovulationMarked === true;
}

/** What a save sends for the mark: true → set, false → clear (null), untouched → nothing. */
export function ovulationMarkPatch(value: boolean | null | undefined): { ovulationMarked?: true | null } {
  if (value === true) return { ovulationMarked: true };
  if (value === false) return { ovulationMarked: null };
  return {};
}

export function observationsEnergy(observations: { energy?: string | null } | null | undefined): string | null {
  const value = observations?.energy;
  return ENERGY_LEVELS.includes(value as CycleEnergyLevel) ? (value as string) : null;
}
