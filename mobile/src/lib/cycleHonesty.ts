import { ka } from '@/i18n/ka';
import type { CycleCondition } from '@/lib/api';

export type CycleHonestyConfidence = 'low' | 'medium' | 'high';

export type CycleHonestyFlags = {
  confidence: CycleHonestyConfidence;
  irregular: boolean;
  pcos: boolean;
  cautious: boolean;
  conditions: string[];
};

export function cycleHonestyFlags(input?: {
  confidence?: CycleHonestyConfidence | string | null;
  isIrregular?: boolean;
  conditions?: Array<CycleCondition | string> | null;
}): CycleHonestyFlags {
  const list = (input?.conditions ?? []).map(String);
  const pcos = list.includes('pcos');
  const irregular = Boolean(input?.isIrregular);
  const confidence: CycleHonestyConfidence =
    input?.confidence === 'high' || input?.confidence === 'medium' ? input.confidence : 'low';
  return {
    confidence,
    irregular,
    pcos,
    cautious: confidence === 'low' || irregular || pcos,
    conditions: list,
  };
}

export function displayPhaseLabel(
  phase: string,
  phaseKa: string,
  opts?: { loggedPeriod?: boolean },
) {
  if (phase === 'unknown') return phaseKa;
  if (phase === 'period') {
    return opts?.loggedPeriod ? ka.cycle.period : ka.cycle.legendPeriodPredicted;
  }
  return ka.cycle.estimatedPhase(phaseKa);
}

export function ovulationInsightCopy(flags: CycleHonestyFlags) {
  return {
    title: ka.cycle.estimatedOvulationTitle,
    body: flags.cautious ? ka.cycle.insightOvulationBodyLow : ka.cycle.insightOvulationBody,
  };
}

export function fertileInsightCopy(flags: CycleHonestyFlags, mode: string) {
  if (flags.cautious) {
    return { title: ka.cycle.estimatedFertileTitle, body: ka.cycle.insightFertileBodyLow };
  }
  if (mode === 'TRY_TO_CONCEIVE') {
    return { title: ka.cycle.estimatedFertileTitle, body: ka.cycle.insightFertileTtc };
  }
  return { title: ka.cycle.estimatedFertileTitle, body: ka.cycle.insightFertileBody };
}

export function ttcReminderCopy(kind: 'ovulation' | 'fertile', flags: CycleHonestyFlags) {
  if (kind === 'ovulation') {
    return {
      title: ka.cycle.remOvulation,
      body: flags.cautious ? ka.cycle.remOvulationBodyLow : ka.cycle.remOvulationBody,
    };
  }
  return {
    title: ka.cycle.remFertile,
    body: flags.cautious ? ka.cycle.remFertileBodyLow : ka.cycle.remFertileBody,
  };
}

export function periodSoonBody(days: number, flags: CycleHonestyFlags) {
  return flags.cautious ? ka.cycle.remPeriodSoonBodyLow(days) : ka.cycle.remPeriodSoonBody(days);
}

export function nextPeriodConfidenceCopy(flags: CycleHonestyFlags) {
  if (flags.cautious) return ka.cycle.confidenceLowExplain;
  if (flags.confidence === 'medium') return ka.cycle.confidenceMediumExplain;
  return ka.cycle.confidenceHighShort;
}
