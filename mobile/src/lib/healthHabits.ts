/**
 * Lifestyle questions of „დაასრულე პროფილი“ (owner 2026-10-11: the old fitness / sleep / smoking / diet
 * questions were vague and their answers were never read). Each question follows a standard survey item:
 *  - activity: days a week with ≥ 30 min that raise breathing — any movement counts (adapted from the
 *    Milton single item; WHO counts work, transport and housework too). 5+ days ≈ WHO's 150 min.
 *  - exercise: how often sport / training on top of that (the owner's „რამდენად ხშირად ვარჯიშობ?“).
 *  - sleep: hours in 24 h (CDC BRFSS) + overall quality (PSQI item 9), never mixed in one scale.
 *  - tobacco: every day / some days / former / never (CDC NHIS) + which products (IQOS and vapes are common).
 *  - alcohol: AUDIT-C questions 1 and 3 (6+ drinks at once = the STEPS heavy-drinking threshold).
 *  - diet: eating pattern incl. church fasting (multi-select) + fruit/veg portions and the habits that
 *    matter most for advice (salt, sugary drinks, sweets, fast food, skipped meals, late eating).
 * The exact answers live in `extraAnswers`; the coarse server columns Medi and MEDIFOOD already read
 * (activityLevel, exerciseFrequency, sleepHours, sleepQuality, smokingStatus, alcoholUse, dietType) are
 * derived from them here. Pure apart from `tx`, so node tests load it directly.
 */
import { tx } from '../i18n/locale.js';

export type Option<K extends string> = { key: K; label: string; sub?: string };

export const ACTIVE_DAYS = ['0', '1-2', '3-4', '5+'] as const;
export type ActiveDays = (typeof ACTIVE_DAYS)[number];
export const EXERCISE_FREQ = ['none', '1', '2-3', '4+'] as const;
export type ExerciseFreq = (typeof EXERCISE_FREQ)[number];
export const SLEEP_BANDS = ['5', '6', '7', '8', '9', '10'] as const;
export type SleepBand = (typeof SLEEP_BANDS)[number];
export const SLEEP_FEEL = ['very-good', 'fairly-good', 'fairly-bad', 'very-bad'] as const;
export type SleepFeel = (typeof SLEEP_FEEL)[number];
export const SMOKING = ['CURRENT', 'OCCASIONAL', 'FORMER', 'NEVER'] as const;
export type Smoking = (typeof SMOKING)[number];
export const SMOKING_PRODUCTS = ['cigarettes', 'heated', 'ecig', 'hookah'] as const;
export type SmokingProduct = (typeof SMOKING_PRODUCTS)[number];
export const ALCOHOL_FREQ = ['never', 'monthly', '2-4-month', '2-3-week', '4-week'] as const;
export type AlcoholFreq = (typeof ALCOHOL_FREQ)[number];
export const ALCOHOL_BINGE = ['never', 'less-monthly', 'monthly', 'weekly', 'daily'] as const;
export type AlcoholBinge = (typeof ALCOHOL_BINGE)[number];
export const DIET_PATTERNS = [
  'none',
  'fasting',
  'vegetarian',
  'vegan',
  'pescatarian',
  'low-carb',
  'intermittent',
  'low-salt',
  'low-sugar',
  'lactose-free',
  'gluten-free',
] as const;
export type DietPattern = (typeof DIET_PATTERNS)[number];
export const PRODUCE = ['0', '1-2', '3-4', '5+'] as const;
export type Produce = (typeof PRODUCE)[number];
export const EATING_HABITS = ['salty', 'sugary-drinks', 'sweets', 'fast-food', 'skip-meals', 'late-eating', 'none'] as const;
export type EatingHabit = (typeof EATING_HABITS)[number];

/** The lifestyle answers as the form holds them (null / [] = not answered). */
export type HabitAnswers = {
  activeDays: ActiveDays | null;
  exerciseFreq: ExerciseFreq | null;
  sleepBand: SleepBand | null;
  sleepFeel: SleepFeel | null;
  smoking: Smoking | null;
  smokingProducts: SmokingProduct[];
  alcoholFreq: AlcoholFreq | null;
  alcoholBinge: AlcoholBinge | null;
  dietPatterns: DietPattern[];
  produce: Produce | null;
  eatingHabits: EatingHabit[];
};

export function emptyHabits(): HabitAnswers {
  return {
    activeDays: null,
    exerciseFreq: null,
    sleepBand: null,
    sleepFeel: null,
    smoking: null,
    smokingProducts: [],
    alcoholFreq: null,
    alcoholBinge: null,
    dietPatterns: [],
    produce: null,
    eatingHabits: [],
  };
}

export function activeDaysOptions(): Option<ActiveDays>[] {
  return [
    { key: '0', label: tx('არცერთ დღეს', 'None') },
    { key: '1-2', label: tx('1–2 დღე', '1–2 days') },
    { key: '3-4', label: tx('3–4 დღე', '3–4 days') },
    { key: '5+', label: tx('5 დღე ან მეტი', '5 days or more') },
  ];
}

export function exerciseOptions(): Option<ExerciseFreq>[] {
  return [
    { key: 'none', label: tx('არ ვვარჯიშობ', 'No exercise') },
    { key: '1', label: tx('კვირაში ერთხელ', 'Once a week') },
    { key: '2-3', label: tx('2–3-ჯერ', '2–3 times') },
    { key: '4+', label: tx('4-ჯერ ან უფრო ხშირად', '4 times or more') },
  ];
}

/** Tiles: the number is the label, the hour word is shared. */
export function sleepBandOptions(): Option<SleepBand>[] {
  return [
    { key: '5', label: '≤5' },
    { key: '6', label: '6' },
    { key: '7', label: '7' },
    { key: '8', label: '8' },
    { key: '9', label: '9' },
    { key: '10', label: '10+' },
  ];
}

export function sleepFeelOptions(): Option<SleepFeel>[] {
  return [
    { key: 'very-good', label: tx('ძალიან კარგად', 'Very well') },
    { key: 'fairly-good', label: tx('საკმაოდ კარგად', 'Fairly well') },
    { key: 'fairly-bad', label: tx('საკმაოდ ცუდად', 'Fairly badly') },
    { key: 'very-bad', label: tx('ძალიან ცუდად', 'Very badly') },
  ];
}

export function smokingOptions(): Option<Smoking>[] {
  return [
    { key: 'CURRENT', label: tx('ყოველდღე ვეწევი', 'Every day') },
    { key: 'OCCASIONAL', label: tx('ზოგჯერ ვეწევი', 'Sometimes'), sub: tx('კვირაში ან თვეში რამდენჯერმე', 'A few times a week or a month') },
    { key: 'FORMER', label: tx('ადრე ვეწეოდი', 'I used to'), sub: tx('შევწყვიტე მოწევა', 'I quit') },
    { key: 'NEVER', label: tx('არა, არასოდეს', 'No, never'), sub: tx('არასოდეს არ მიმიწევია', 'I have never smoked') },
  ];
}

export function smokingProductOptions(): Option<SmokingProduct>[] {
  return [
    { key: 'cigarettes', label: tx('სიგარეტი', 'Cigarettes') },
    { key: 'heated', label: 'IQOS / glo' },
    { key: 'ecig', label: tx('ელექტრონული სიგარეტი', 'E-cigarette / vape') },
    { key: 'hookah', label: tx('კალიანი', 'Hookah') },
  ];
}

export function alcoholOptions(): Option<AlcoholFreq>[] {
  return [
    { key: 'never', label: tx('არ ვსვამ', 'I don’t drink') },
    { key: 'monthly', label: tx('თვეში ერთხელ ან უფრო იშვიათად', 'Monthly or less') },
    { key: '2-4-month', label: tx('თვეში 2–4-ჯერ', '2–4 times a month') },
    { key: '2-3-week', label: tx('კვირაში 2–3-ჯერ', '2–3 times a week') },
    { key: '4-week', label: tx('კვირაში 4-ჯერ ან უფრო ხშირად', '4 or more times a week') },
  ];
}

export function alcoholBingeOptions(): Option<AlcoholBinge>[] {
  return [
    { key: 'never', label: tx('არასოდეს', 'Never') },
    { key: 'less-monthly', label: tx('თვეში ერთხელზე იშვიათად', 'Less than monthly') },
    { key: 'monthly', label: tx('თვეში ერთხელ', 'Monthly') },
    { key: 'weekly', label: tx('კვირაში ერთხელ', 'Weekly') },
    { key: 'daily', label: tx('თითქმის ყოველდღე', 'Almost daily') },
  ];
}

export function dietPatternOptions(): Option<DietPattern>[] {
  return [
    { key: 'none', label: tx('ყველაფერს ვჭამ', 'I eat everything') },
    { key: 'fasting', label: tx('ვმარხულობ', 'Church fasting') },
    { key: 'vegetarian', label: tx('ვეგეტარიანელი', 'Vegetarian') },
    { key: 'vegan', label: tx('ვეგანი', 'Vegan') },
    { key: 'pescatarian', label: tx('თევზი კი, ხორცი არა', 'Fish, no meat') },
    { key: 'low-carb', label: tx('კეტო / დაბალნახშირწყლოვანი', 'Keto / low-carb') },
    { key: 'intermittent', label: tx('ინტერვალური შიმშილობა', 'Intermittent fasting') },
    { key: 'low-salt', label: tx('ნაკლებმარილიანი', 'Low-salt') },
    { key: 'low-sugar', label: tx('ნაკლებშაქრიანი', 'Low-sugar') },
    { key: 'lactose-free', label: tx('ულაქტოზო', 'Lactose-free') },
    { key: 'gluten-free', label: tx('უგლუტენო', 'Gluten-free') },
  ];
}

export function produceOptions(): Option<Produce>[] {
  return [
    { key: '0', label: '0' },
    { key: '1-2', label: '1–2' },
    { key: '3-4', label: '3–4' },
    { key: '5+', label: '5+' },
  ];
}

export function eatingHabitOptions(): Option<EatingHabit>[] {
  return [
    { key: 'salty', label: tx('ხშირად ვჭამ მარილიან საკვებს', 'I often eat salty food'), sub: tx('მწნილი, მარილიანი ყველი, აჯიკა, შებოლილი ხორცი', 'Pickles, salty cheese, adjika, smoked meat') },
    { key: 'sugary-drinks', label: tx('ტკბილ სასმელებს თითქმის ყოველდღე ვსვამ', 'Sugary drinks most days'), sub: tx('ლიმონათი, კოლა, წვენი, ენერგეტიკული სასმელები', 'Lemonade, cola, juice, energy drinks') },
    { key: 'sweets', label: tx('ტკბილეულს ან ცომეულს თითქმის ყოველდღე ვჭამ', 'Sweets or pastries most days') },
    { key: 'fast-food', label: tx('ხშირად ვჭამ ფასტფუდს', 'I often eat fast food'), sub: tx('ან მიტანილ საკვებს — კვირაში 2-ჯერ ან უფრო ხშირად', 'Or takeaway — twice a week or more') },
    { key: 'skip-meals', label: tx('ხშირად ვტოვებ საუზმეს ან სადილს', 'I often skip breakfast or lunch') },
    { key: 'late-eating', label: tx('ხშირად ვჭამ გვიან ღამით', 'I often eat late at night') },
    { key: 'none', label: tx('არცერთი', 'None of these') },
  ];
}

/** Eating patterns about *when*, not *what*: they go with „ყველაფერს ვჭამ“. */
const TIMING_PATTERNS: DietPattern[] = ['fasting', 'intermittent'];

/**
 * Diet chips: „ყველაფერს ვჭამ“ (no restriction) goes with church or intermittent fasting, but not with
 * a restriction of what is eaten (vegetarian, keto, gluten-free…) — picking one drops the other.
 */
export function toggleDietPattern(list: DietPattern[], key: DietPattern): DietPattern[] {
  if (list.includes(key)) return list.filter((k) => k !== key);
  if (key === 'none') return [...list.filter((k) => TIMING_PATTERNS.includes(k)), 'none'];
  if (TIMING_PATTERNS.includes(key)) return [...list, key];
  return [...list.filter((k) => k !== 'none'), key];
}

/** Multi-select where one key („none“) excludes the rest. */
export function toggleExclusive<K extends string>(list: K[], key: K, exclusive: K): K[] {
  if (key === exclusive) return list.includes(exclusive) ? [] : [exclusive];
  const rest = list.filter((k) => k !== exclusive);
  return rest.includes(key) ? rest.filter((k) => k !== key) : [...rest, key];
}

function oneOf<T extends string>(values: readonly T[], raw: unknown): T | null {
  return typeof raw === 'string' && (values as readonly string[]).includes(raw) ? (raw as T) : null;
}

function listOf<T extends string>(values: readonly T[], raw: unknown): T[] {
  return Array.isArray(raw) ? (raw.filter((v) => (values as readonly string[]).includes(v)) as T[]) : [];
}

type StoredProfile = {
  smokingStatus?: string | null;
  extraAnswers?: Record<string, unknown> | null;
} | null | undefined;

/** Answers as stored. Old builds' answers (fitnessLevel 1–5, sleepLevel, BALANCED diet…) are not reused: those questions were ambiguous. */
export function habitsFromProfile(profile: StoredProfile): HabitAnswers {
  const extra = (profile?.extraAnswers ?? {}) as Record<string, unknown>;
  return {
    activeDays: oneOf(ACTIVE_DAYS, extra.activeDays),
    exerciseFreq: oneOf(EXERCISE_FREQ, extra.exerciseFreq),
    sleepBand: oneOf(SLEEP_BANDS, extra.sleepBand),
    sleepFeel: oneOf(SLEEP_FEEL, extra.sleepFeel),
    // Smoking keeps older answers: never / former / current meant the same then.
    smoking: oneOf(SMOKING, profile?.smokingStatus),
    smokingProducts: listOf(SMOKING_PRODUCTS, extra.smokingProducts),
    alcoholFreq: oneOf(ALCOHOL_FREQ, extra.alcoholFreq),
    alcoholBinge: oneOf(ALCOHOL_BINGE, extra.alcoholBinge),
    dietPatterns: listOf(DIET_PATTERNS, extra.dietPatterns),
    produce: oneOf(PRODUCE, extra.produce),
    eatingHabits: listOf(EATING_HABITS, extra.eatingHabits),
  };
}

const ACTIVITY_LEVEL: Record<ActiveDays, string> = { '0': 'SEDENTARY', '1-2': 'LIGHT', '3-4': 'MODERATE', '5+': 'ACTIVE' };
const EXERCISE_FREQUENCY: Record<ExerciseFreq, string> = { none: 'NEVER', '1': 'RARE', '2-3': 'WEEKLY', '4+': 'DAILY' };
const SLEEP_QUALITY: Record<SleepFeel, string> = { 'very-good': 'EXCELLENT', 'fairly-good': 'GOOD', 'fairly-bad': 'FAIR', 'very-bad': 'POOR' };
const ALCOHOL_USE: Record<AlcoholFreq, string> = { never: 'NEVER', monthly: 'OCCASIONAL', '2-4-month': 'OCCASIONAL', '2-3-week': 'REGULAR', '4-week': 'REGULAR' };

/** MEDIFOOD's plan reads OMNIVORE / VEGETARIAN / VEGAN (else balanced); Medi reads the rest from extraAnswers. */
export function dietTypeFor(patterns: DietPattern[]): string | undefined {
  if (!patterns.length) return undefined;
  if (patterns.includes('vegan')) return 'VEGAN';
  if (patterns.includes('vegetarian')) return 'VEGETARIAN';
  if (patterns.includes('pescatarian')) return 'OTHER';
  if (patterns.includes('low-carb')) return 'KETO';
  return 'OMNIVORE';
}

/**
 * The profile write for the answered lifestyle questions: exact answers in extraAnswers, the coarse
 * columns derived. An unanswered question sends nothing (the server keeps what it has).
 */
export function habitsPayload(h: HabitAnswers): { columns: Record<string, unknown>; extra: Record<string, unknown> } {
  const columns: Record<string, unknown> = {};
  const extra: Record<string, unknown> = {};
  if (h.activeDays) {
    extra.activeDays = h.activeDays;
    columns.activityLevel = h.activeDays === '5+' && h.exerciseFreq === '4+' ? 'VERY_ACTIVE' : ACTIVITY_LEVEL[h.activeDays];
  }
  if (h.exerciseFreq) {
    extra.exerciseFreq = h.exerciseFreq;
    columns.exerciseFrequency = EXERCISE_FREQUENCY[h.exerciseFreq];
  }
  if (h.sleepBand) {
    extra.sleepBand = h.sleepBand;
    columns.sleepHours = Number(h.sleepBand);
  }
  if (h.sleepFeel) {
    extra.sleepFeel = h.sleepFeel;
    columns.sleepQuality = SLEEP_QUALITY[h.sleepFeel];
  }
  if (h.smoking) {
    columns.smokingStatus = h.smoking;
    // Products only make sense for someone who smokes or smoked.
    extra.smokingProducts = h.smoking === 'NEVER' ? [] : h.smokingProducts;
  }
  if (h.alcoholFreq) {
    extra.alcoholFreq = h.alcoholFreq;
    extra.alcoholBinge = h.alcoholFreq === 'never' ? null : h.alcoholBinge;
    columns.alcoholUse = ALCOHOL_USE[h.alcoholFreq];
  }
  if (h.dietPatterns.length) {
    extra.dietPatterns = h.dietPatterns;
    columns.dietType = dietTypeFor(h.dietPatterns);
  }
  if (h.produce) {
    extra.produce = h.produce;
    extra.eatingHabits = h.eatingHabits;
  }
  return { columns, extra };
}

function labelOf<K extends string>(options: Option<K>[], key: K | null): string {
  return (key && options.find((o) => o.key === key)?.label) || '';
}

function labelsOf<K extends string>(options: Option<K>[], keys: K[]): string {
  return keys
    .map((k) => options.find((o) => o.key === k)?.label)
    .filter(Boolean)
    .join(', ');
}

/** One short line per answered question for the summary page ('' = not answered). */
export function habitSummary(h: HabitAnswers) {
  const activity = h.activeDays
    ? [
        labelOf(activeDaysOptions(), h.activeDays),
        h.exerciseFreq
          ? h.exerciseFreq === 'none'
            ? labelOf(exerciseOptions(), 'none')
            : tx(`ვარჯიში: ${labelOf(exerciseOptions(), h.exerciseFreq)}`, `Exercise: ${labelOf(exerciseOptions(), h.exerciseFreq).toLowerCase()}`)
          : '',
      ]
        .filter(Boolean)
        .join(' · ')
    : '';
  const sleep = h.sleepBand
    ? [
        tx(`${labelOf(sleepBandOptions(), h.sleepBand)} საათი`, `${labelOf(sleepBandOptions(), h.sleepBand)} hours`),
        labelOf(sleepFeelOptions(), h.sleepFeel),
      ]
        .filter(Boolean)
        .join(' · ')
    : '';
  const smoking = h.smoking
    ? [labelOf(smokingOptions(), h.smoking), h.smoking !== 'NEVER' ? labelsOf(smokingProductOptions(), h.smokingProducts) : '']
        .filter(Boolean)
        .join(' · ')
    : '';
  const alcohol = labelOf(alcoholOptions(), h.alcoholFreq);
  const diet = labelsOf(dietPatternOptions(), h.dietPatterns);
  const eating = h.produce
    ? [
        tx(`ხილი და ბოსტნეული: ${h.produce === '0' ? '0' : labelOf(produceOptions(), h.produce)} პორცია`, `Fruit & veg: ${labelOf(produceOptions(), h.produce)} a day`),
        h.eatingHabits.length && !h.eatingHabits.includes('none') ? tx(`${h.eatingHabits.length} ჩვევა`, `${h.eatingHabits.length} habit${h.eatingHabits.length === 1 ? '' : 's'}`) : '',
      ]
        .filter(Boolean)
        .join(' · ')
    : '';
  return { activity, sleep, smoking, alcohol, diet, eating };
}
