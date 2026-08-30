import { ka } from '@/i18n/ka';
import type { CycleCondition, CycleInsightCard, CycleLog, CycleMode } from '@/lib/api';
import type { CyclePhaseInfo } from '@/lib/cycleCanonical';
import { cycleHonestyFlags, fertileInsightCopy, type CycleHonestyConfidence } from '@/lib/cycleHonesty';

type AdviceCtx = {
  phase: CyclePhaseInfo;
  mode: CycleMode;
  conditions?: CycleCondition[];
  log?: CycleLog | null;
  confidence?: CycleHonestyConfidence | string | null;
  isIrregular?: boolean;
};

/** Client-side, cycle-aware tips — readable Georgian, not a diagnosis. */
export function buildCycleAdvice({
  phase,
  mode,
  conditions = [],
  log,
  confidence,
  isIrregular,
}: AdviceCtx): CycleInsightCard[] {
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
      action: mode === 'TRY_TO_CONCEIVE' ? 'აღრიცხე BBT ან ლორწო' : 'გახსენი დღის აღრიცხვა',
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

  if (mode === 'PREGNANCY') {
    cards.unshift({
      id: 'advice_pregnancy',
      tone: 'pregnancy',
      title: ka.cycle.advicePregnancyTitle,
      body: ka.cycle.advicePregnancyBody,
      action: 'გახსენი ორსულობის ჩეკლისტი',
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
      action: 'AI ექიმთან გაზიარება',
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

  return cards.slice(0, 4);
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
    if (seen.has(key) || seen.has(card.id)) continue;
    seen.add(card.id);
    seen.add(key);
    out.push(card);
    if (out.length >= 4) break;
  }
  return out;
}
