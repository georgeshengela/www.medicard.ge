import { ka } from '@/i18n/ka';
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
    { tone: 'care', title: 'სითბო ამშვიდებს', body: 'თბილი საფენი მუცელზე ან თბილი შხაპი კრუნჩხვისას ბევრს ეხმარება.' },
    { tone: 'care', title: 'რკინით მდიდარი საკვები', body: 'ლობიო, ისპანახი, წითელი ხორცი ან თხილი რკინის მარაგის შენარჩუნებაში გეხმარება.' },
    { tone: 'energy', title: 'მსუბუქი მოძრაობა', body: 'ნელი სეირნობა ან გაწელვა ზოგს ტკივილს უმსუბუქებს — მოუსმინე სხეულს.' },
    { tone: 'calm', title: 'წყალი და თბილი ჩაი', body: 'საკმარისი სითხე შებერილობას ამცირებს, თბილი ჩაი კი სიმშვიდეს გმატებს.' },
    { tone: 'calm', title: 'დასვენება ნორმალურია', body: 'ენერგია დაბალია? დღეს ადრე დაძინება კარგი არჩევანია.' },
  ],
  follicular: [
    { tone: 'energy', title: 'ენერგიის დღეები', body: 'ენერგია ხშირად იზრდება — კარგი დროა აქტიური ვარჯიშისთვის ან ახალი გეგმისთვის.' },
    { tone: 'care', title: 'ცილა და ბოსტნეული', body: 'ცილა, ბოსტნეული და მთლიანი მარცვლეული ენერგიას დღის განმავლობაში სტაბილურად ინარჩუნებს.' },
    { tone: 'mood', title: 'ფოკუსის დრო', body: 'ამ დღეებში კონცენტრაცია ხშირად უფრო ადვილია — რთული საქმეები ახლა დაგეგმე.' },
    { tone: 'energy', title: 'სცადე რამე ახალი', body: 'ახალი ვარჯიში, რეცეპტი ან ჰობი — ბევრი ქალი ამ ფაზაში უფრო ცნობისმოყვარედ გრძნობს თავს.' },
    { tone: 'calm', title: 'ძილის რიტმი', body: 'ერთსა და იმავე დროს დაძინება მთელი ციკლის განმავლობაში ენერგიას აწონასწორებს.' },
  ],
  fertile: [
    { tone: 'energy', title: 'აქტიური დღეები', body: 'ბევრი ქალი ამ დღეებში ყველაზე ენერგიულად და თავდაჯერებულად გრძნობს თავს.' },
    { tone: 'calm', title: 'საკმარისი წყალი', body: 'დღეში 6–8 ჭიქა სითხე ენერგიასა და კონცენტრაციას ეხმარება.' },
    { tone: 'care', title: 'სხეულის ნიშნები', body: 'გამონადენის ცვლილებები ამ დღეებში ჩვეულებრივია — შეგიძლია აღრიცხო და პატერნს დაინახავ.' },
    { tone: 'mood', title: 'სოციალური დღეები', body: 'ურთიერთობები ახლა ხშირად უფრო მარტივია — კარგი დროა შეხვედრებისთვის.' },
  ],
  luteal: [
    { tone: 'care', title: 'მაგნიუმით მდიდარი საკვები', body: 'მწვანე ფოთლოვანი, თხილეული და მუქი შოკოლადი მაგნიუმს შეიცავს — ზოგს PMS-ის შემსუბუქებაში ეხმარება.' },
    { tone: 'calm', title: 'ძილი უფრო მნიშვნელოვანია', body: 'ამ ფაზაში ძილი შეიძლება გაუარესდეს — ეკრანები დაძინებამდე ერთი საათით ადრე გამორთე.' },
    { tone: 'care', title: 'ნაკლები მარილი და კოფეინი', body: 'შებერილობისა და მკერდის მგრძნობელობისას მარილისა და კოფეინის შემცირება ზოგს ეხმარება.' },
    { tone: 'energy', title: 'ნაზი მოძრაობა', body: 'იოგა, პილატესი ან სეირნობა განწყობასაც აუმჯობესებს და შებერილობასაც ამცირებს.' },
    { tone: 'mood', title: 'იყავი შენთვის კეთილი', body: 'განწყობის რყევა ამ დღეებში ხშირია — დაგეგმე პატარა სასიამოვნო რამ საკუთარი თავისთვის.' },
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
      action: 'დალიე წყალი და დაისვენე',
    });
  } else if (phase.phase === 'follicular') {
    cards.push({
      id: 'advice_follicular',
      tone: 'energy',
      title: ka.cycle.adviceFollicularTitle,
      body: ka.cycle.adviceFollicularBody(dayBit),
      action: 'მოკლე სეირნობა',
    });
  } else if (phase.phase === 'fertile' || phase.phase === 'ovulation') {
    const copy = fertileInsightCopy(flags, mode);
    cards.push({
      id: 'advice_fertile',
      tone: 'fertile',
      title: copy.title,
      body: `${dayBit}. ${copy.body}`,
      action: supportsCycleCapability(mode, 'showFertilityShortcuts')
        ? 'აღრიცხე BBT ან ლორწო'
        : 'გახსენი დღის აღრიცხვა',
    });
  } else if (phase.phase === 'luteal') {
    cards.push({
      id: 'advice_luteal',
      tone: 'calm',
      title: ka.cycle.adviceLutealTitle,
      body: ka.cycle.adviceLutealBody(dayBit),
      action: '5 წუთი სიღრმისეული სუნთქვა',
    });
  } else {
    cards.push({
      id: 'advice_unknown',
      tone: 'calm',
      title: ka.cycle.adviceUnknownTitle,
      body: ka.cycle.adviceUnknownBody,
      action: 'პარამეტრები',
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
      action: 'დალიე წყალი და დაისვენე',
    });
  }
  if (symptoms.includes('headache') || symptoms.includes('fatigue')) {
    cards.push({
      id: 'advice_fatigue',
      tone: 'calm',
      title: ka.cycle.adviceFatigueTitle,
      body: ka.cycle.adviceMoodBody,
      action: 'დალიე წყალი და დაისვენე',
    });
  }
  if (moods.some((m) => ['anxious', 'irritable', 'sad', 'mood_swings', 'stressed'].includes(m))) {
    cards.push({
      id: 'advice_mood',
      tone: 'mood',
      title: ka.cycle.adviceMoodTitle,
      body: ka.cycle.adviceMoodBody,
      action: '5 წუთი სიღრმისეული სუნთქვა',
    });
  }
  if (conditions.includes('pcos')) {
    cards.push({
      id: 'advice_pcos',
      tone: 'calm',
      title: ka.cycle.advicePcosTitle,
      body: ka.cycle.advicePcosBody,
      action: 'გახსენი დღის აღრიცხვა',
    });
  }
  if (conditions.includes('endometriosis')) {
    cards.push({
      id: 'advice_endo',
      tone: 'care',
      title: ka.cycle.adviceEndoTitle,
      body: ka.cycle.adviceEndoBody,
      action: 'გააზიარე Medi-სთან',
    });
  }
  if (conditions.includes('perimenopause')) {
    cards.push({
      id: 'advice_peri',
      tone: 'calm',
      title: ka.cycle.advicePeriTitle,
      body: ka.cycle.advicePeriBody,
      action: 'გახსენი დღის აღრიცხვა',
    });
  }

  // Practical everyday tips for the phase (not in pregnancy — its own guidance applies).
  const main = cards.slice(0, 4);
  if (!supportsCycleCapability(mode, 'showPregnancyOverview')) main.push(...dailyTips(phase.phase, phase.day));
  return main;
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
    out.push(card);
    if (out.length >= 5) break;
  }
  return out;
}
