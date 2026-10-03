/**
 * Which flat glyph (`constants/cycleIconSvg.ts`, Health Icons) stands for each thing a woman can log —
 * one family for every picker, instead of five chip systems and text-only rows. Pure: node tests
 * check that every option id in `constants/cycle.ts` has a glyph.
 *
 * Colour is not carried here: `CycleIconTile` tints the glyph by its group ink (bleeding = rose,
 * fertility = turquoise, everything else = ink), because colour means a fact or a phase, never a category.
 */
import type { CycleIconGlyph } from '../constants/cycleIconSvg.ts';

export type CycleIconGroup = 'bleeding' | 'fertility' | 'neutral';

const FLOW: Record<string, CycleIconGlyph> = { none: 'drop', spotting: 'drop', light: 'drop', medium: 'drop', heavy: 'drop' };

const PAIN: Record<string, CycleIconGlyph> = {
  cramps: 'belly',
  pelvic: 'uterus',
  lower_back: 'back',
  headache: 'head',
  breast: 'breasts',
  ovulation_side: 'pain',
  other: 'pain',
};

const MOOD: Record<string, CycleIconGlyph> = {
  energetic: 'ok',
  calm: 'calm',
  happy: 'happy',
  confident: 'ok',
  sensitive: 'notOk',
  anxious: 'nervous',
  irritable: 'angry',
  angry: 'angry',
  sad: 'sad',
  tearful: 'crying',
  mood_swings: 'woozy',
  focused: 'neutral',
  unfocused: 'confused',
  tired_mood: 'sleepy',
  apathetic: 'neutral',
  stressed: 'sweatingFace',
  romantic: 'happy',
  lonely: 'sad',
};

const SYMPTOM: Record<string, CycleIconGlyph> = {
  cramps: 'belly',
  headache: 'head',
  migraine: 'head',
  bloating: 'stomach',
  acne: 'skin',
  fatigue: 'sleepy',
  back_pain: 'back',
  breast_tenderness: 'breasts',
  breast_swelling: 'breasts',
  nausea: 'nausea',
  vomiting: 'vomiting',
  heartburn: 'stomach',
  dizziness: 'dizzy',
  insomnia: 'woozy',
  oversleep: 'sleepy',
  appetite_up: 'meal',
  appetite_down: 'meal',
  cravings: 'sugar',
  hot_flashes: 'fever',
  night_sweats: 'sweating',
  chills: 'chills',
  sweating: 'sweating',
  constipation: 'intestine',
  diarrhea: 'diarrhea',
  gas: 'colon',
  joint_pain: 'joints',
  muscle_pain: 'arm',
  pelvic_pain: 'uterus',
  ovulation_pain: 'uterus',
  leg_cramps: 'leg',
  swelling: 'water',
  water_retention: 'water',
  dry_skin: 'skin',
  oily_skin: 'skin',
  itchy_skin: 'skin',
  hair_loss: 'skin',
  sensitive_smell: 'nose',
  tinnitus: 'ear',
  palpitations: 'heartbeat',
  short_breath: 'lungs',
  frequent_urination: 'bladder',
  uti_feel: 'bladder',
  vaginal_dryness: 'female',
  discharge: 'discharge',
  itching_vulva: 'female',
  fever: 'thermometer',
  cold_symptoms: 'coughing',
};

const MUCUS: Record<string, CycleIconGlyph> = { dry: 'water', sticky: 'water', creamy: 'water', watery: 'water', eggwhite: 'water' };

const LIFESTYLE: Record<string, CycleIconGlyph> = {
  energy: 'bars',
  sleepQuality: 'sleepy',
  stressLevel: 'nervous',
  exerciseLevel: 'running',
  caffeine: 'meal',
  alcohol: 'alcohol',
};

const TESTS: Record<string, CycleIconGlyph> = { ovulationTest: 'rdt', pregnancyTest: 'rdtPositive', bbt: 'thermometer' };

export const ALL_FINE_ID = 'all_fine';

/** The glyph for a logged thing. `kind` disambiguates ids shared by groups (e.g. `headache` is a pain type and a symptom). */
export function cycleGlyphFor(kind: 'flow' | 'pain' | 'mood' | 'symptom' | 'mucus' | 'lifestyle' | 'test', id: string): CycleIconGlyph {
  if (id === ALL_FINE_ID) return 'yes';
  const table = kind === 'flow' ? FLOW : kind === 'pain' ? PAIN : kind === 'mood' ? MOOD : kind === 'symptom' ? SYMPTOM : kind === 'mucus' ? MUCUS : kind === 'lifestyle' ? LIFESTYLE : TESTS;
  return table[id] ?? 'pain';
}

/** Which ink a group takes: bleeding rose, fertility turquoise, everything else the plain ink. */
export function cycleIconGroup(kind: 'flow' | 'pain' | 'mood' | 'symptom' | 'mucus' | 'lifestyle' | 'test'): CycleIconGroup {
  if (kind === 'flow') return 'bleeding';
  if (kind === 'mucus' || kind === 'test') return 'fertility';
  return 'neutral';
}

/** Bleeding strength as glyph size and opacity (one drop, five amounts — Flo's drops). */
export function flowGlyphStyle(id: string): { scale: number; opacity: number; hollow: boolean } {
  switch (id) {
    case 'none':
      return { scale: 0.9, opacity: 0.55, hollow: true };
    case 'spotting':
      return { scale: 0.62, opacity: 0.8, hollow: false };
    case 'light':
      return { scale: 0.78, opacity: 0.85, hollow: false };
    case 'medium':
      return { scale: 0.92, opacity: 0.95, hollow: false };
    default:
      return { scale: 1.08, opacity: 1, hollow: false };
  }
}

export const KNOWN_GLYPH_IDS = { FLOW, PAIN, MOOD, SYMPTOM, MUCUS, LIFESTYLE, TESTS };
