import { ka } from '@/i18n/ka';
import { isEn, tx } from '../i18n/locale.js';
import type { CycleCondition, CycleInsightCard, CycleLog, CycleMode } from '@/lib/api';
import type { CyclePhaseInfo } from '@/lib/cycleCanonical';
import { cycleHonestyFlags, fertileInsightCopy, type CycleHonestyConfidence } from '@/lib/cycleHonesty';
import { supportsCycleCapability } from '@/lib/cycleModes';

type AdviceCtx = {
  phase: CyclePhaseInfo;
  mode: CycleMode;
  conditions?: CycleCondition[];
  log?: CycleLog | null;
  confidence?: CycleHonestyConfidence | string | null;
  isIrregular?: boolean;
};

/** Client-side, cycle-aware tips — readable Georgian, not a diagnosis. */
/**
 * Everyday practical tips per phase (2026-09-29): movement, food, sleep, mood. Gentle, non-medical
 * wording ("helps some people"); three are shown a day and rotate with the cycle day.
 */
const DAILY_TIPS: Record<string, { tone: string; title: string; body: string }[]> = {
  period: [
    { tone: 'care', title: tx('სითბო ამშვიდებს', 'Warmth soothes'), body: tx('თბილი კომპრესი მუცელზე ან თბილი შხაპი კრუნჩხვისას ბევრს ეხმარება.', 'A warm pad on your belly or a warm shower helps many people with cramps.') },
    { tone: 'care', title: tx('რკინით მდიდარი საკვები', 'Iron-rich foods'), body: tx('ლობიო, ისპანახი, წითელი ხორცი ან თხილი რკინის მარაგის შენარჩუნებაში გეხმარება.', 'Beans, spinach, red meat or nuts help keep your iron up.') },
    { tone: 'energy', title: tx('მსუბუქი მოძრაობა', 'Gentle movement'), body: tx('ნელი სეირნობა ან გაწელვა ზოგს ტკივილს უმსუბუქებს — მოუსმინე სხეულს.', 'A slow walk or stretching eases pain for some people — listen to your body.') },
    { tone: 'calm', title: tx('წყალი და თბილი ჩაი', 'Water and warm tea'), body: tx('საკმარისი სითხე შებერილობას ამცირებს, თბილი ჩაი კი სიმშვიდეს გმატებს.', 'Enough fluids ease bloating, and warm tea adds a little calm.') },
    { tone: 'calm', title: tx('დასვენება ნორმალურია', 'Resting is normal'), body: tx('ენერგია დაბალია? დღეს ადრე დაძინება კარგი არჩევანია.', 'Low on energy? Going to bed early tonight is a good choice.') },
  ],
  follicular: [
    { tone: 'energy', title: tx('ენერგიის დღეები', 'Energy days'), body: tx('ენერგია ხშირად იზრდება — კარგი დროა აქტიური ვარჯიშისთვის ან ახალი გეგმისთვის.', 'Energy often rises — a good time for an active workout or a new plan.') },
    { tone: 'care', title: tx('ცილა და ბოსტნეული', 'Protein and veggies'), body: tx('ცილა, ბოსტნეული და მთლიანი მარცვლეული ენერგიას დღის განმავლობაში სტაბილურად ინარჩუნებს.', 'Protein, vegetables and whole grains keep your energy steady through the day.') },
    { tone: 'mood', title: tx('ფოკუსის დრო', 'Focus time'), body: tx('ამ დღეებში კონცენტრაცია ხშირად უფრო ადვილია — რთული საქმეები ახლა დაგეგმე.', 'Focusing is often easier these days — plan harder tasks now.') },
    { tone: 'energy', title: tx('სცადე რამე ახალი', 'Try something new'), body: tx('ახალი ვარჯიში, რეცეპტი ან ჰობი — ბევრი ქალი ამ ფაზაში უფრო ცნობისმოყვარედ გრძნობს თავს.', 'A new workout, recipe or hobby — many women feel more curious in this phase.') },
    { tone: 'calm', title: tx('ძილის რიტმი', 'Sleep rhythm'), body: tx('ერთსა და იმავე დროს დაძინება მთელი ციკლის განმავლობაში ენერგიას აწონასწორებს.', 'Going to bed at the same time throughout your cycle helps balance your energy.') },
  ],
  fertile: [
    { tone: 'energy', title: tx('აქტიური დღეები', 'Active days'), body: tx('ბევრი ქალი ამ დღეებში ყველაზე ენერგიულად და თავდაჯერებულად გრძნობს თავს.', 'Many women feel their most energetic and confident these days.') },
    { tone: 'calm', title: tx('საკმარისი წყალი', 'Enough water'), body: tx('დღეში 6–8 ჭიქა სითხე ენერგიასა და კონცენტრაციას ეხმარება.', '6–8 glasses of fluids a day help your energy and focus.') },
    { tone: 'care', title: tx('სხეულის ნიშნები', 'Body signs'), body: tx('გამონადენის ცვლილებები ამ დღეებში ჩვეულებრივია — შეგიძლია აღრიცხო და პატერნს დაინახავ.', 'Changes in discharge are common these days — log them and you’ll see your pattern.') },
    { tone: 'mood', title: tx('სოციალური დღეები', 'Social days'), body: tx('ურთიერთობები ახლა ხშირად უფრო მარტივია — კარგი დროა შეხვედრებისთვის.', 'Connecting with people often feels easier now — a good time to meet up.') },
  ],
  luteal: [
    { tone: 'care', title: tx('მაგნიუმით მდიდარი საკვები', 'Magnesium-rich foods'), body: tx('მწვანე ფოთლოვანი ბოსტნეული, თხილეული და მუქი შოკოლადი მაგნიუმს შეიცავს — ზოგს PMS-ის შემსუბუქებაში ეხმარება.', 'Leafy greens, nuts and dark chocolate contain magnesium — it helps some people with PMS.') },
    { tone: 'calm', title: tx('ძილი უფრო მნიშვნელოვანია', 'Sleep matters more'), body: tx('ამ ფაზაში ძილი შეიძლება გაუარესდეს — ეკრანები დაძინებამდე ერთი საათით ადრე გამორთე.', 'Sleep can get worse in this phase — turn off screens an hour before bed.') },
    { tone: 'care', title: tx('ნაკლები მარილი და კოფეინი', 'Less salt and caffeine'), body: tx('შებერილობისა და მკერდის მგრძნობელობისას მარილისა და კოფეინის შემცირება ზოგს ეხმარება.', 'With bloating or breast tenderness, cutting back on salt and caffeine helps some people.') },
    { tone: 'energy', title: tx('ნაზი მოძრაობა', 'Gentle movement'), body: tx('იოგა, პილატესი ან სეირნობა განწყობასაც აუმჯობესებს და შებერილობასაც ამცირებს.', 'Yoga, Pilates or a walk can lift your mood and ease bloating.') },
    { tone: 'mood', title: tx('იყავი შენთვის კეთილი', 'Be kind to yourself'), body: tx('განწყობის რყევა ამ დღეებში ხშირია — დაგეგმე პატარა სასიამოვნო რამ საკუთარი თავისთვის.', 'Mood swings are common these days — plan something small and nice for yourself.') },
  ],
};

function dailyTips(phase: string, day: number | null): CycleInsightCard[] {
  const key = phase === 'ovulation' ? 'fertile' : phase;
  const list = DAILY_TIPS[key];
  if (!list) return [];
  const start = (day ?? 0) % list.length;
  return [0, 1, 2].map((i) => {
    const idx = (start + i) % list.length;
    const tip = list[idx];
    return { id: `tip_${key}_${idx}`, tone: tip.tone, title: tip.title, body: tip.body, action: null };
  });
}

export function buildCycleAdvice({
  phase,
  mode,
  conditions = [],
  log,
  confidence,
  isIrregular,
}: AdviceCtx): CycleInsightCard[] {
  if (supportsCycleCapability(mode, 'showPerimenopauseTracking')) return [];
  const cards: CycleInsightCard[] = [];
  const dayBit = phase.day != null ? ka.cycle.cycleDayBit(phase.day) : ka.cycle.thisDayBit;
  const flags = cycleHonestyFlags({ confidence, isIrregular, conditions });

  if (phase.phase === 'period') {
    cards.push({
      id: 'advice_period',
      tone: 'care',
      title: ka.cycle.advicePeriodTitle,
      body: ka.cycle.advicePeriodBody(dayBit),
      action: tx('დალიე წყალი და დაისვენე', 'Drink water and rest'),
    });
  } else if (phase.phase === 'follicular') {
    cards.push({
      id: 'advice_follicular',
      tone: 'energy',
      title: ka.cycle.adviceFollicularTitle,
      body: ka.cycle.adviceFollicularBody(dayBit),
      action: tx('მოკლე სეირნობა', 'Short walk'),
    });
  } else if (phase.phase === 'fertile' || phase.phase === 'ovulation') {
    const copy = fertileInsightCopy(flags, mode);
    cards.push({
      id: 'advice_fertile',
      tone: 'fertile',
      title: copy.title,
      body: `${dayBit}. ${copy.body}`,
      action: supportsCycleCapability(mode, 'showFertilityShortcuts')
        ? tx('აღრიცხე BBT ან ლორწო', 'Add BBT or mucus')
        : tx('გახსენი დღის აღრიცხვა', 'Open today’s log'),
    });
  } else if (phase.phase === 'luteal') {
    cards.push({
      id: 'advice_luteal',
      tone: 'calm',
      title: ka.cycle.adviceLutealTitle,
      body: ka.cycle.adviceLutealBody(dayBit),
      action: tx('5 წუთი ღრმა სუნთქვა', '5 min deep breathing'),
    });
  } else {
    cards.push({
      id: 'advice_unknown',
      tone: 'calm',
      title: ka.cycle.adviceUnknownTitle,
      body: ka.cycle.adviceUnknownBody,
      action: tx('პარამეტრები', 'Settings'),
    });
  }

  if (supportsCycleCapability(mode, 'showPregnancyOverview')) {
    cards.unshift({
      id: 'advice_pregnancy',
      tone: 'pregnancy',
      title: ka.cycle.advicePregnancyTitle,
      body: ka.cycle.advicePregnancyBody,
      action: null,
    });
  }

  const symptoms = log?.symptoms ?? [];
  const moods = log?.moods ?? [];
  if (symptoms.includes('cramps') || symptoms.includes('back_pain') || symptoms.includes('pelvic_pain')) {
    cards.push({
      id: 'advice_cramps',
      tone: 'care',
      title: ka.cycle.adviceCrampsTitle,
      body: ka.cycle.adviceCrampsBody,
      action: tx('დალიე წყალი და დაისვენე', 'Drink water and rest'),
    });
  }
  if (symptoms.includes('headache') || symptoms.includes('fatigue')) {
    cards.push({
      id: 'advice_fatigue',
      tone: 'calm',
      title: ka.cycle.adviceFatigueTitle,
      body: ka.cycle.adviceMoodBody,
      action: tx('დალიე წყალი და დაისვენე', 'Drink water and rest'),
    });
  }
  if (moods.some((m) => ['anxious', 'irritable', 'sad', 'mood_swings', 'stressed'].includes(m))) {
    cards.push({
      id: 'advice_mood',
      tone: 'mood',
      title: ka.cycle.adviceMoodTitle,
      body: ka.cycle.adviceMoodBody,
      action: tx('5 წუთი ღრმა სუნთქვა', '5 min deep breathing'),
    });
  }
  if (conditions.includes('pcos')) {
    cards.push({
      id: 'advice_pcos',
      tone: 'calm',
      title: ka.cycle.advicePcosTitle,
      body: ka.cycle.advicePcosBody,
      action: tx('გახსენი დღის აღრიცხვა', 'Open today’s log'),
    });
  }
  if (conditions.includes('endometriosis')) {
    cards.push({
      id: 'advice_endo',
      tone: 'care',
      title: ka.cycle.adviceEndoTitle,
      body: ka.cycle.adviceEndoBody,
      action: tx('გააზიარე Medi-სთან', 'Share with Medi'),
    });
  }
  if (conditions.includes('perimenopause')) {
    cards.push({
      id: 'advice_peri',
      tone: 'calm',
      title: ka.cycle.advicePeriTitle,
      body: ka.cycle.advicePeriBody,
      action: tx('გახსენი დღის აღრიცხვა', 'Open today’s log'),
    });
  }

  // Practical everyday tips for the phase (not in pregnancy — its own guidance applies).
  const main = cards.slice(0, 4);
  if (!supportsCycleCapability(mode, 'showPregnancyOverview')) main.push(...dailyTips(phase.phase, phase.day));
  return main;
}

const MONTHS_GEN = ['იანვარი', 'თებერვალი', 'მარტი', 'აპრილი', 'მაისი', 'ივნისი', 'ივლისი', 'აგვისტო', 'სექტემბერი', 'ოქტომბერი', 'ნოემბერი', 'დეკემბერი'];
const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** Any ISO date inside insight copy (older cached AI text) → '10 ოქტომბერი 2026'. */
export function humanizeDatesKa(text: string): string {
  return text.replace(/\b(\d{4})-(\d{2})-(\d{2})\b/g, (all, y, m, d) => {
    const month = (isEn() ? MONTHS_EN : MONTHS_GEN)[Number(m) - 1];
    return month ? `${Number(d)} ${month} ${y}` : all;
  });
}

export function mergeInsightCards(ai: CycleInsightCard[], local: CycleInsightCard[]): CycleInsightCard[] {
  const seen = new Set<string>();
  const out: CycleInsightCard[] = [];
  const norm = (id: string) =>
    id
      .replace(/^(advice_|phase_|preg_|ttc_|next_)/, '')
      .replace(/_care|_support|_today|_window|_week|_period|_flow|_fatigue|_peri/, '');
  for (const card of [...local.slice(0, 1), ...ai, ...local.slice(1)]) {
    const key = norm(card.id);
    const title = `title:${card.title.trim().toLowerCase()}`;
    if (seen.has(key) || seen.has(card.id) || seen.has(title)) continue;
    seen.add(card.id);
    seen.add(key);
    seen.add(title);
    out.push({ ...card, title: humanizeDatesKa(card.title), body: humanizeDatesKa(card.body) });
    if (out.length >= 5) break;
  }
  return out;
}
