import type { CycleDayMark, CycleLog } from '@/lib/api';
import { ka } from '@/i18n/ka';

export const CYCLE_TEST_RESULTS = ['negative', 'positive', 'unclear'] as const;
export type CycleTestResult = (typeof CYCLE_TEST_RESULTS)[number];

export function isCycleTestResult(value: unknown): value is CycleTestResult {
  return value === 'negative' || value === 'positive' || value === 'unclear';
}

export type CycleFertilityMark = CycleDayMark & {
  ovulationTest?: CycleTestResult | null;
  pregnancyTest?: CycleTestResult | null;
  hasBbt?: boolean;
  hasMucus?: boolean;
  hasSex?: boolean;
};

export function mergeFertilityMarks(
  calendar: Record<string, CycleDayMark> | undefined,
  logs: CycleLog[] | undefined,
): Record<string, CycleFertilityMark> {
  const next: Record<string, CycleFertilityMark> = { ...(calendar || {}) };
  for (const log of logs || []) {
    const prev = next[log.date] || {};
    next[log.date] = {
      ...prev,
      logged:
        Boolean(prev.logged) ||
        isCycleTestResult(log.ovulationTest) ||
        isCycleTestResult(log.pregnancyTest) ||
        log.bbt != null ||
        Boolean(log.cervicalMucus) ||
        Boolean(log.sexualActivity),
      ovulationTest: isCycleTestResult(log.ovulationTest) ? log.ovulationTest : prev.ovulationTest,
      pregnancyTest: isCycleTestResult(log.pregnancyTest) ? log.pregnancyTest : prev.pregnancyTest,
      hasBbt: log.bbt != null || prev.hasBbt,
      hasMucus: Boolean(log.cervicalMucus) || prev.hasMucus,
      hasSex: Boolean(log.sexualActivity) || prev.hasSex,
    };
  }
  return next;
}

export function fertilityA11yBits(mark: CycleFertilityMark | undefined): string[] {
  if (!mark) return [];
  const bits: string[] = [];
  if (mark.ovulation) bits.push(ka.cycle.legendOvulation);
  else if (mark.fertile) bits.push(ka.cycle.legendFertile);
  if (isCycleTestResult(mark.ovulationTest)) {
    bits.push(ka.cycle.a11yOpk(ka.cycle.testResult[mark.ovulationTest]));
  }
  if (mark.hasBbt) bits.push(ka.cycle.a11yBbt);
  if (mark.hasMucus) bits.push(ka.cycle.a11yMucus);
  if (mark.hasSex) bits.push(ka.cycle.a11ySex);
  if (isCycleTestResult(mark.pregnancyTest)) {
    bits.push(ka.cycle.a11yPreg(ka.cycle.testResult[mark.pregnancyTest]));
  }
  return bits;
}

export function hasFertilityObservation(mark: CycleFertilityMark | undefined): boolean {
  if (!mark) return false;
  return (
    isCycleTestResult(mark.ovulationTest) ||
    isCycleTestResult(mark.pregnancyTest) ||
    Boolean(mark.hasBbt || mark.hasMucus || mark.hasSex)
  );
}

export type TtcActionKey = 'opk' | 'bbt' | 'mucus' | 'sex' | 'pregnancy';

export function prioritizeTtcActions(log: CycleLog | undefined, mark?: CycleDayMark): TtcActionKey[] {
  const missing: TtcActionKey[] = [];
  if (!isCycleTestResult(log?.ovulationTest)) missing.push('opk');
  if (log?.bbt == null) missing.push('bbt');
  if (!log?.cervicalMucus) missing.push('mucus');
  if (!log?.sexualActivity) missing.push('sex');
  if (!isCycleTestResult(log?.pregnancyTest)) missing.push('pregnancy');
  if (mark?.fertile || mark?.ovulation) {
    const order: TtcActionKey[] = ['opk', 'bbt', 'mucus', 'sex', 'pregnancy'];
    return order.filter((key) => missing.includes(key)).slice(0, 3);
  }
  return missing.slice(0, 3);
}

export function fertilityTestHistory(logs: CycleLog[] | undefined) {
  const ovulationTests = (logs || [])
    .filter((l) => isCycleTestResult(l.ovulationTest))
    .map((l) => ({ date: l.date, result: l.ovulationTest as CycleTestResult }))
    .sort((a, b) => b.date.localeCompare(a.date));
  const pregnancyTests = (logs || [])
    .filter((l) => isCycleTestResult(l.pregnancyTest))
    .map((l) => ({ date: l.date, result: l.pregnancyTest as CycleTestResult }))
    .sort((a, b) => b.date.localeCompare(a.date));
  return { ovulationTests, pregnancyTests };
}

export function bbtSeriesWithGaps(
  points: { date: string; bbt: number }[],
): { date: string; bbt: number }[][] {
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
  const runs: { date: string; bbt: number }[][] = [];
  let current: { date: string; bbt: number }[] = [];
  let prev: string | null = null;
  for (const point of sorted) {
    if (prev) {
      const gap =
        (Date.parse(`${point.date}T00:00:00`) - Date.parse(`${prev}T00:00:00`)) / 86_400_000;
      if (gap > 1) {
        if (current.length) runs.push(current);
        current = [];
      }
    }
    current.push(point);
    prev = point.date;
  }
  if (current.length) runs.push(current);
  return runs;
}
