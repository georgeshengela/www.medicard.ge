import type { CycleCondition, CycleDayMark, CycleLog, CycleMode } from '@/lib/api';
import type { CyclePhaseInfo } from '@/lib/cycleCanonical';
import {
  cycleHonestyFlags,
  fertileInsightCopy,
  ovulationInsightCopy,
  type CycleHonestyConfidence,
} from '@/lib/cycleHonesty';
import { ka } from '@/i18n/ka';

export type { CyclePhaseInfo, CyclePhaseKind } from '@/lib/cycleCanonical';

export type CycleDayPrediction = {
  id: string;
  kind: 'logged' | 'estimated';
  tone: 'period' | 'fertile' | 'ovulation' | 'calm' | 'energy' | 'care' | 'mood' | 'log';
  title: string;
  body: string;
};

export function addDaysToKey(key: string, delta: number): string {
  const [y, m, d] = key.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + delta);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

export function parseDateKey(key: string) {
  const [y, m, d] = key.split('-').map(Number);
  return { y, m: m - 1, d };
}

export function daysBetween(fromKey: string, toKey: string) {
  const a = parseDateKey(fromKey);
  const b = parseDateKey(toKey);
  const ms = Date.UTC(b.y, b.m, b.d) - Date.UTC(a.y, a.m, a.d);
  return Math.round(ms / 86_400_000);
}

export function buildDayPredictions({
  date,
  today,
  mark,
  phase,
  mode,
  log,
  nextPeriodStart,
  ovulationDate,
  confidence,
  isIrregular,
  conditions,
}: {
  date: string;
  today: string;
  mark?: CycleDayMark;
  phase: CyclePhaseInfo;
  mode: CycleMode;
  log?: CycleLog | null;
  nextPeriodStart?: string | null;
  ovulationDate?: string | null;
  confidence?: CycleHonestyConfidence | string | null;
  isIrregular?: boolean;
  conditions?: Array<CycleCondition | string> | null;
}): CycleDayPrediction[] {
  const cards: CycleDayPrediction[] = [];
  const isToday = date === today;
  const dayLabel = isToday ? ka.cycle.jumpToday : ka.cycle.thisDay;
  const flags = cycleHonestyFlags({ confidence, isIrregular, conditions });

  if (mark?.ovulation) {
    const copy = ovulationInsightCopy(flags);
    cards.push({
      id: 'ovulation',
      kind: 'estimated',
      tone: 'ovulation',
      title: copy.title,
      body: copy.body,
    });
  } else if (mark?.fertile) {
    const copy = fertileInsightCopy(flags, mode);
    cards.push({
      id: 'fertile',
      kind: 'estimated',
      tone: 'fertile',
      title: copy.title,
      body: copy.body,
    });
  } else if (mark?.period) {
    cards.push({
      id: 'period',
      kind: mark.predicted ? 'estimated' : 'logged',
      tone: 'period',
      title: mark.predicted ? ka.cycle.legendPeriodPredicted : ka.cycle.period,
      body: mark.predicted ? ka.cycle.insightPredictedPeriod : ka.cycle.insightLoggedPeriod,
    });
  }

  if (phase.day != null && !mark?.ovulation && !mark?.fertile && !mark?.period) {
    if (phase.phase === 'follicular') {
      cards.push({
        id: 'follicular',
        kind: 'estimated',
        tone: 'energy',
        title: ka.cycle.estimatedPhase(phase.phaseKa),
        body: ka.cycle.insightFollicularBody(dayLabel, phase.day),
      });
    } else if (phase.phase === 'luteal') {
      cards.push({
        id: 'luteal',
        kind: 'estimated',
        tone: 'calm',
        title: ka.cycle.estimatedPhase(phase.phaseKa),
        body: ka.cycle.insightLutealBody(dayLabel, phase.day),
      });
    } else {
      cards.push({
        id: 'phase',
        kind: 'estimated',
        tone: 'calm',
        title: ka.cycle.estimatedPhase(phase.phaseKa),
        body: ka.cycle.insightPhaseBody(dayLabel, phase.day, phase.phaseKa),
      });
    }
  }

  if (nextPeriodStart && mode !== 'PREGNANCY' && !mark?.period) {
    const until = daysBetween(date, nextPeriodStart);
    if (until > 0 && until <= 3) {
      cards.unshift({
        id: 'period_prep',
        kind: 'estimated',
        tone: 'care',
        title: ka.cycle.periodPrepTitle,
        body: ka.cycle.periodPrepBody,
      });
    }
    if (until > 3 && until <= 7) {
      cards.push({
        id: 'period_soon',
        kind: 'estimated',
        tone: 'care',
        title: ka.cycle.insightPeriodSoonTitle(until),
        body: ka.cycle.insightPeriodSoonBody,
      });
    }
  }

  if (ovulationDate && mode === 'TRY_TO_CONCEIVE' && !mark?.ovulation && !mark?.fertile) {
    const untilOv = daysBetween(date, ovulationDate);
    if (untilOv > 0 && untilOv <= 3) {
      cards.push({
        id: 'ovulation_soon',
        kind: 'estimated',
        tone: 'fertile',
        title: ka.cycle.insightOvulationSoonTitle(untilOv),
        body: flags.cautious ? ka.cycle.insightOvulationBodyLow : ka.cycle.insightOvulationSoonBody,
      });
    }
  }

  if (log) {
    const bits: string[] = [];
    if (log.flow && log.flow !== 'none') bits.push(ka.cycle.loggedFlowBit(log.flow));
    if (log.symptoms?.length) bits.push(ka.cycle.loggedSymptomsBit(log.symptoms.length));
    if (log.moods?.length) bits.push(ka.cycle.loggedMoodsBit(log.moods.length));
    if (log.ovulationTest === 'negative' || log.ovulationTest === 'positive' || log.ovulationTest === 'unclear') {
      bits.push(ka.cycle.loggedOpk(ka.cycle.testResult[log.ovulationTest]));
    }
    if (log.bbt != null) bits.push(ka.cycle.loggedBbt(String(log.bbt)));
    if (log.cervicalMucus) bits.push(ka.cycle.loggedMucus(log.cervicalMucus));
    if (log.sexualActivity && mode === 'TRY_TO_CONCEIVE') bits.push(ka.cycle.loggedSex);
    if (log.pregnancyTest === 'negative' || log.pregnancyTest === 'positive' || log.pregnancyTest === 'unclear') {
      bits.push(ka.cycle.loggedPreg(ka.cycle.testResult[log.pregnancyTest]));
    }
    if (log.painEntries?.length) bits.push(ka.cycle.loggedPainBit(log.painEntries.length));
    if (log.sleepQuality || log.stressLevel || log.exerciseLevel || log.caffeine || log.alcohol) {
      bits.push(ka.cycle.loggedLifestyleBit);
    }
    if (log.customTagIds?.length) bits.push(ka.cycle.loggedTagsBit(log.customTagIds.length));
    if (log.notes?.trim()) bits.push(ka.cycle.loggedJournalBit);
    cards.unshift({
      id: 'logged',
      kind: 'logged',
      tone: 'log',
      title: isToday ? ka.cycle.loggedEntryToday : ka.cycle.loggedEntry,
      body: bits.length ? bits.join(' · ') : ka.cycle.loggedEntryEmpty,
    });
  } else if (isToday) {
    cards.push({
      id: 'log_today',
      kind: 'logged',
      tone: 'mood',
      title: ka.cycle.logToday,
      body: ka.cycle.logTodayEmpty,
    });
  }

  return cards.slice(0, 6);
}
