/**
 * Way-of-life answers from „დაასრულე პროფილი“ (app 2026-10-11) as plain Georgian lines for Medi's
 * account-holder block. The exact answers live in HealthProfile.extraAnswers (activeDays, exerciseFreq,
 * sleepBand, sleepFeel, smokingProducts, alcoholFreq, alcoholBinge, dietPatterns, produce,
 * eatingHabits); the coarse columns (activityLevel, smokingStatus, alcoholUse, dietType…) are the
 * fallback for older answers and Medi's own writes. Never a raw enum in the prompt.
 */

const ACTIVE_DAYS = { '0': 'არცერთ დღეს', '1-2': '1–2 დღე', '3-4': '3–4 დღე', '5+': '5 დღე ან მეტი' };
const ACTIVITY_LEVEL = { SEDENTARY: 'უმოძრაო', LIGHT: 'მცირე', MODERATE: 'ზომიერი', ACTIVE: 'აქტიური', VERY_ACTIVE: 'ძალიან აქტიური' };
const EXERCISE_FREQ = { none: 'არ ვარჯიშობს', '1': 'კვირაში ერთხელ', '2-3': 'კვირაში 2–3-ჯერ', '4+': 'კვირაში 4-ჯერ ან უფრო ხშირად' };
const EXERCISE_FREQUENCY = { NEVER: 'არ ვარჯიშობს', RARE: 'იშვიათად', WEEKLY: 'ყოველკვირა', DAILY: 'თითქმის ყოველდღე' };
const SLEEP_QUALITY = { EXCELLENT: 'ძალიან კარგი', GOOD: 'საკმაოდ კარგი', FAIR: 'საკმაოდ ცუდი', POOR: 'ძალიან ცუდი' };
const SMOKING = {
  CURRENT: 'ყოველდღე ეწევა',
  OCCASIONAL: 'ზოგჯერ ეწევა (კვირაში ან თვეში რამდენჯერმე)',
  FORMER: 'ადრე ეწეოდა, შეწყვიტა',
  NEVER: 'არ ეწევა',
};
const SMOKING_PRODUCTS = { cigarettes: 'სიგარეტი', heated: 'გაცხელებული თამბაქო (IQOS / glo)', ecig: 'ელექტრონული სიგარეტი', hookah: 'კალიანი' };
const ALCOHOL_FREQ = {
  never: 'არ სვამს',
  monthly: 'თვეში ერთხელ ან უფრო იშვიათად',
  '2-4-month': 'თვეში 2–4-ჯერ',
  '2-3-week': 'კვირაში 2–3-ჯერ',
  '4-week': 'კვირაში 4-ჯერ ან უფრო ხშირად',
};
const ALCOHOL_USE = { NEVER: 'არ სვამს', OCCASIONAL: 'იშვიათად', REGULAR: 'რეგულარულად' };
const ALCOHOL_BINGE = {
  never: 'არასოდეს',
  'less-monthly': 'თვეში ერთხელზე იშვიათად',
  monthly: 'თვეში ერთხელ',
  weekly: 'კვირაში ერთხელ',
  daily: 'თითქმის ყოველდღე',
};
const DIET_PATTERNS = {
  none: 'ყველაფერს ჭამს',
  fasting: 'იცავს საეკლესიო მარხვას',
  vegetarian: 'ვეგეტარიანელი',
  vegan: 'ვეგანი',
  pescatarian: 'თევზს ჭამს, ხორცს — არა',
  'low-carb': 'კეტო / დაბალნახშირწყლოვანი',
  intermittent: 'ინტერვალური შიმშილობა',
  'low-salt': 'ნაკლებმარილიანი',
  'low-sugar': 'ნაკლებშაქრიანი',
  'lactose-free': 'ულაქტოზო',
  'gluten-free': 'უგლუტენო',
};
const DIET_TYPE = { OMNIVORE: 'ყველაფერს ჭამს', VEGETARIAN: 'ვეგეტარიანელი', VEGAN: 'ვეგანი', KETO: 'კეტო' };
const PRODUCE = { '0': '0', '1-2': '1–2', '3-4': '3–4', '5+': '5 ან მეტი' };
const EATING_HABITS = {
  salty: 'ხშირად ჭამს მარილიან საკვებს',
  'sugary-drinks': 'ტკბილ სასმელებს თითქმის ყოველდღე სვამს',
  sweets: 'ტკბილეულს / ცომეულს თითქმის ყოველდღე ჭამს',
  'fast-food': 'ფასტფუდი ან მიტანილი საკვები კვირაში 2+-ჯერ',
  'skip-meals': 'ხშირად ტოვებს საუზმეს ან სადილს',
  'late-eating': 'ხშირად ჭამს გვიან ღამით',
};

function list(map, values) {
  return Array.isArray(values) ? values.map((v) => map[v]).filter(Boolean) : [];
}

/** Lines for the profile block ('- მოწევა: …'); none for questions never answered. */
export function lifestyleLines(hp) {
  if (!hp) return [];
  const extra = hp.extraAnswers && typeof hp.extraAnswers === 'object' ? hp.extraAnswers : {};
  const lines = [];

  const days = ACTIVE_DAYS[extra.activeDays];
  const level = ACTIVITY_LEVEL[hp.activityLevel];
  if (days) lines.push(`- აქტიური მოძრაობა (30+ წთ): ${days} კვირაში`);
  else if (level) lines.push(`- აქტივობა: ${level}`);
  const exercise = EXERCISE_FREQ[extra.exerciseFreq] ?? EXERCISE_FREQUENCY[hp.exerciseFrequency];
  if (exercise) lines.push(`- ვარჯიში / სპორტი: ${exercise}`);

  if (hp.sleepHours != null) {
    const quality = SLEEP_QUALITY[hp.sleepQuality];
    lines.push(`- ძილი: ~${hp.sleepHours} სთ დღე-ღამეში${quality ? `, ხარისხი: ${quality}` : ''}`);
  } else if (SLEEP_QUALITY[hp.sleepQuality]) {
    lines.push(`- ძილის ხარისხი: ${SLEEP_QUALITY[hp.sleepQuality]}`);
  }

  const smoking = SMOKING[hp.smokingStatus];
  if (smoking) {
    const products = hp.smokingStatus === 'NEVER' ? [] : list(SMOKING_PRODUCTS, extra.smokingProducts);
    lines.push(`- მოწევა: ${smoking}${products.length ? ` (${products.join(', ')})` : ''}`);
  }

  const alcohol = ALCOHOL_FREQ[extra.alcoholFreq] ?? ALCOHOL_USE[hp.alcoholUse];
  if (alcohol) {
    const binge = extra.alcoholFreq !== 'never' ? ALCOHOL_BINGE[extra.alcoholBinge] : null;
    lines.push(`- ალკოჰოლი: ${alcohol}${binge ? `; 6+ სასმისი ერთ ჯერზე: ${binge}` : ''}`);
  }

  const diet = list(DIET_PATTERNS, extra.dietPatterns);
  if (diet.length) lines.push(`- კვების რეჟიმი: ${diet.join(', ')}`);
  else if (DIET_TYPE[hp.dietType]) lines.push(`- კვების რეჟიმი: ${DIET_TYPE[hp.dietType]}`);

  if (PRODUCE[extra.produce]) {
    const habits = list(EATING_HABITS, extra.eatingHabits);
    lines.push(`- ხილი და ბოსტნეული: ${PRODUCE[extra.produce]} პორცია დღეში${habits.length ? `; ${habits.join('; ')}` : ''}`);
  }
  return lines;
}
