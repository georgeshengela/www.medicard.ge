import { ka } from '@/i18n/ka';
import { cycleChipLabel } from '@/lib/cycleLabels';
import { formatCycleDateKa } from '@/lib/cycleCivilDateKa';
import type { CyclePregnancyObservationTrend } from '@/lib/api';

const PAIN_PREFIX = 'pain.';

export function pregnancyTrendLabel(key: string): string {
  if (key === 'energy.low') return ka.cycle.trendEnergyLowTitle;
  if (key === 'flow') return ka.cycle.pregnancyBleeding;
  if (key.startsWith(PAIN_PREFIX)) {
    const type = key.slice(PAIN_PREFIX.length) as keyof typeof ka.cycle.painType;
    return ka.cycle.painType[type] ?? key;
  }
  return cycleChipLabel(key);
}

export function pregnancyTrendFamilyLabel(family: string): string {
  const map = ka.cycle.pregnancyTrendFamily as Record<string, string>;
  return map[family] ?? family;
}

function flowSummary(trend: CyclePregnancyObservationTrend): string {
  const counts = trend.flowCounts || { spotting: 0, light: 0, medium: 0, heavy: 0 };
  const spotting = counts.spotting || 0;
  const bleed = (counts.light || 0) + (counts.medium || 0) + (counts.heavy || 0);
  if (spotting && !bleed) return ka.cycle.pregnancyTrendSpotting(spotting);
  if (bleed && !spotting) return ka.cycle.pregnancyTrendBleeding(bleed);
  const parts: string[] = [];
  (['spotting', 'light', 'medium', 'heavy'] as const).forEach((id) => {
    const n = counts[id] || 0;
    if (!n) return;
    parts.push(`${ka.cycle.pregnancyTrendFlow[id]}: ${n} ${ka.cycle.daysUnit}`);
  });
  return parts.join('; ');
}

export function formatPregnancyTrendSummary(trend: CyclePregnancyObservationTrend): string {
  if (trend.key === 'energy.low') return ka.cycle.pregnancyTrendEnergy(trend.occurrenceCount);
  if (trend.key === 'flow' || trend.summaryType === 'RECENT_BLEEDING_OCCURRENCE') {
    return flowSummary(trend);
  }
  return ka.cycle.pregnancyTrendDays(pregnancyTrendLabel(trend.key), trend.occurrenceCount);
}

export function pregnancyTrendA11y(trend: CyclePregnancyObservationTrend, expanded: boolean): string {
  const summary = formatPregnancyTrendSummary(trend);
  const last = trend.lastLoggedDate ? `, ${ka.cycle.pregnancyTrendLast(formatCycleDateKa(trend.lastLoggedDate))}` : '';
  let extra = '';
  if (expanded && trend.severityCounts) {
    const bits = (['mild', 'moderate', 'severe'] as const)
      .filter((id) => trend.severityCounts?.[id])
      .map((id) => `${ka.cycle.painSeverity[id]} ${trend.severityCounts?.[id]}`);
    if (bits.length) extra = `, ${bits.join(', ')}`;
  }
  return `${pregnancyTrendFamilyLabel(trend.family)}, ${summary}${last}${extra}`;
}
