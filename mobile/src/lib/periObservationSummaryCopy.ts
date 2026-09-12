import { ka } from '@/i18n/ka';
import { cycleChipLabel } from '@/lib/cycleLabels';
import { formatCycleDateKa } from '@/lib/cycleCivilDateKa';
import type { CyclePerimenopauseObservationSummary } from '@/lib/api';

const PAIN_PREFIX = 'pain.';

export function periSummaryLabel(key: string): string {
  if (key === 'energy.low') return ka.cycle.energy;
  if (key === 'sleep.poor') return ka.cycle.sleep;
  if (key === 'flow') return ka.cycle.periBleeding;
  if (key === 'hot_flashes') return ka.cycle.periHotFlashes;
  if (key === 'night_sweats') return ka.cycle.periNightSweats;
  if (key.startsWith(PAIN_PREFIX)) {
    const type = key.slice(PAIN_PREFIX.length) as keyof typeof ka.cycle.painType;
    return ka.cycle.painType[type] ?? key;
  }
  return cycleChipLabel(key);
}

export function periSummaryFamilyLabel(family: string): string {
  const map = ka.cycle.periTrendFamily as Record<string, string>;
  return map[family] ?? family;
}

function flowSummary(row: CyclePerimenopauseObservationSummary): string {
  const counts = row.flowCounts || { spotting: 0, light: 0, medium: 0, heavy: 0 };
  const spotting = counts.spotting || 0;
  const bleed = (counts.light || 0) + (counts.medium || 0) + (counts.heavy || 0);
  if (spotting && !bleed) return ka.cycle.periTrendSpotting(spotting);
  if (bleed && !spotting) return ka.cycle.periTrendBleeding(bleed);
  const parts: string[] = [];
  (['spotting', 'light', 'medium', 'heavy'] as const).forEach((id) => {
    const n = counts[id] || 0;
    if (!n) return;
    parts.push(`${ka.cycle.periTrendFlow[id]}: ${n} ${ka.cycle.daysUnit}`);
  });
  return parts.join('; ');
}

export function formatPeriSummary(row: CyclePerimenopauseObservationSummary): string {
  if (row.key === 'energy.low') return ka.cycle.periTrendEnergy(row.occurrenceCount);
  if (row.key === 'sleep.poor') return ka.cycle.periTrendSleep(row.occurrenceCount);
  if (row.key === 'flow' || row.summaryType === 'RECENT_BLEEDING_OCCURRENCE') {
    return flowSummary(row);
  }
  return ka.cycle.periTrendDays(periSummaryLabel(row.key), row.occurrenceCount);
}

export function periSummaryA11y(row: CyclePerimenopauseObservationSummary, expanded: boolean): string {
  const summary = formatPeriSummary(row);
  const last = row.lastLoggedDate ? `, ${ka.cycle.periTrendLast(formatCycleDateKa(row.lastLoggedDate))}` : '';
  let extra = '';
  if (expanded && row.severityCounts) {
    const bits = (['mild', 'moderate', 'severe'] as const)
      .filter((id) => row.severityCounts?.[id])
      .map((id) => `${ka.cycle.painSeverity[id]} ${row.severityCounts?.[id]}`);
    if (bits.length) extra = `, ${bits.join(', ')}`;
  }
  return `${periSummaryFamilyLabel(row.family)}, ${summary}${last}${extra}`;
}
