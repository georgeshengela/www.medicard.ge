/**
 * Which options the postpartum and perimenopause quick logs offer — each mode keeps its own short
 * lists (owner copy, unchanged by the tile redesign of 2026-10-03). Pure: node tests check every id
 * is a real option in `constants/cycle.ts` and has a glyph in `cycleIconMap`. The pregnancy lists
 * live in `pregnancyObservationPresent.ts`.
 */
import type { CyclePainType } from '@/lib/api';
import { tx } from '../i18n/locale.js';

export const PREGNANCY_QUICK_DIGESTION = ['nausea', 'vomiting', 'bloating', 'constipation', 'diarrhea', 'heartburn'] as const;
export const PREGNANCY_QUICK_BODY = ['dizziness', 'swelling', 'short_breath', 'frequent_urination', 'leg_cramps'] as const;
export const PREGNANCY_QUICK_ENERGY_CHIPS = ['fatigue'] as const;
export const PREGNANCY_PAIN_TYPES: readonly CyclePainType[] = ['cramps', 'pelvic', 'lower_back', 'headache', 'breast', 'other'];
export const PREGNANCY_FLOW_OPTIONS = [
  { id: 'none', label: tx('არა', 'None') },
  { id: 'spotting', label: tx('ლაქები', 'Spotting') },
  { id: 'light', label: tx('მსუბუქი', 'Light') },
  { id: 'medium', label: tx('ზომიერი', 'Medium') },
  { id: 'heavy', label: tx('ძლიერი', 'Heavy') },
] as const;

export const POSTPARTUM_BODY_KEYS = ['fatigue', 'dizziness', 'headache', 'migraine', 'swelling', 'frequent_urination'] as const;
export const POSTPARTUM_DIGEST_KEYS = ['nausea', 'constipation'] as const;
export const POSTPARTUM_MOOD_KEYS = ['tired_mood', 'anxious', 'irritable', 'sad', 'mood_swings'] as const;
export const POSTPARTUM_PAIN_TYPES: readonly CyclePainType[] = ['cramps', 'pelvic', 'lower_back', 'headache', 'breast', 'other'];

export const PERI_HEADACHE_SYMPTOMS = ['migraine'] as const;
export const PERI_BODY_MORE = ['dry_skin', 'hair_loss', 'breast_tenderness'] as const;
export const PERI_MOODS = ['irritable', 'anxious', 'mood_swings', 'tired_mood', 'unfocused'] as const;
export const PERI_PAIN: readonly CyclePainType[] = ['headache', 'cramps', 'lower_back', 'pelvic', 'other'];
