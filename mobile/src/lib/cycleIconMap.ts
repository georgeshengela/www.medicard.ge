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

/** `PREGNANCY_CHECKLIST` (constants/cycle.ts) — habits and appointments, one object each. */
const CHECKLIST: Record<string, CycleIconGlyph> = {
  prenatal_vitamin: 'pill',
  folic_acid: 'pill',
  water_2l: 'water',
  walk: 'walking',
  doctor_appt: 'stethoscope',
  ultrasound: 'sonogram',
  blood_test: 'drop',
  no_alcohol: 'noAlcohol',
  no_smoking: 'noSmoking',
  rest: 'sleepy',
};

export const ALL_FINE_ID = 'all_fine';

export type CycleIconKind = 'flow' | 'pain' | 'mood' | 'symptom' | 'mucus' | 'lifestyle' | 'test' | 'checklist';

/** The glyph for a logged thing. `kind` disambiguates ids shared by groups (e.g. `headache` is a pain type and a symptom). */
export function cycleGlyphFor(kind: CycleIconKind, id: string): CycleIconGlyph {
  if (id === ALL_FINE_ID) return 'yes';
  const table =
    kind === 'flow' ? FLOW : kind === 'pain' ? PAIN : kind === 'mood' ? MOOD : kind === 'symptom' ? SYMPTOM : kind === 'mucus' ? MUCUS : kind === 'lifestyle' ? LIFESTYLE : kind === 'checklist' ? CHECKLIST : TESTS;
  return table[id] ?? 'pain';
}

/** Which ink a group takes: bleeding rose, fertility turquoise, everything else the plain ink. */
export function cycleIconGroup(kind: CycleIconKind): CycleIconGroup {
  if (kind === 'flow') return 'bleeding';
  if (kind === 'mucus' || kind === 'test') return 'fertility';
  return 'neutral';
}

/**
 * Level fields (energy, sleep, stress) are one row of tiles: the same glyph on every tile, the level
 * as dots under the label (1 of N … N of N) and a glyph that fades towards the low end. `levelOf` is
 * the 1-based position of `id` in the field's ordered options, or null when it is not an option.
 */
export function levelOf(options: readonly string[], id: string | null | undefined): number | null {
  if (!id) return null;
  const i = options.indexOf(id);
  return i < 0 ? null : i + 1;
}

/** Glyph opacity for level `level` of `max`: 0.45 at the lowest, 1 at the top (a ramp a glance can read). */
export function levelGlyphOpacity(level: number, max: number): number {
  if (max <= 1) return 1;
  const t = Math.min(1, Math.max(0, (level - 1) / (max - 1)));
  return Math.round((0.45 + 0.55 * t) * 100) / 100;
}

/** Which glyph stands for a whole level field (one glyph per field, never per option). */
export const LEVEL_FIELD_GLYPH: Record<'energy' | 'sleepQuality' | 'stressLevel', CycleIconGlyph> = {
  energy: 'bars',
  sleepQuality: 'sleepy',
  stressLevel: 'nervous',
};

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

export const KNOWN_GLYPH_IDS = { FLOW, PAIN, MOOD, SYMPTOM, MUCUS, LIFESTYLE, TESTS, CHECKLIST };

/**
 * Georgian words like „კონცენტრირებული“ or „თავბრუსხვევა“ are longer than a 76 pt label at 10.5 pt and
 * would break mid-word (Georgian has no hyphenation). The label shrinks with its longest word — a
 * Georgian glyph is ≈ 0.78 em wide — and a long one may spill 4 pt past the tile on each side;
 * neighbours' labels are centred, so they never meet. Pure, so the fit is tested in node.
 */
export function tileLabelFit(
  label: string,
  tileWidth: number,
): { fontSize: number; lineHeight: number; width: number; maxWidth: number; marginHorizontal: number; letterSpacing?: number } {
  const longest = Math.max(0, ...label.split(/\s+/).map((w) => w.length));
  // `maxWidth` overrides react-native-web's default 100 % cap on Text, so web matches native.
  if (longest <= 8) return { fontSize: 10.5, lineHeight: 13, width: tileWidth + 6, maxWidth: tileWidth + 6, marginHorizontal: -3 };
  // Measured in NotoSansGeorgian 500: 0.58–0.69 em per glyph, „დაღლილობა“ 0.78 — the fit assumes 0.8.
  const width = longest >= 14 ? tileWidth + 18 : tileWidth + 14;
  const letterSpacing = longest >= 14 ? -0.4 : undefined;
  const fontSize = Math.max(7.5, Math.min(10.5, Math.floor((width / (0.8 * longest)) * 2) / 2));
  return { fontSize, lineHeight: Math.round(fontSize + 2.5), width, maxWidth: width, marginHorizontal: -(width - tileWidth) / 2, letterSpacing };
}
