import { ka } from '@/i18n/ka';
import { cycleChipLabel } from '@/lib/cycleLabels';
import type { CycleObservationTrend } from '@/lib/api';

const PAIN_PREFIX = 'pain.';

export function observationTrendLabel(key: string): string {
  if (key === 'energy.low') return ka.cycle.trendEnergyLowTitle;
  if (key.startsWith(PAIN_PREFIX)) {
    const type = key.slice(PAIN_PREFIX.length) as keyof typeof ka.cycle.painType;
    return ka.cycle.painType[type] ?? key;
  }
  return cycleChipLabel(key);
}

export function observationTrendGroupLabel(group: string): string {
  const map = ka.cycle.trendGroup as Record<string, string>;
  return map[group] ?? ka.cycle.trackGroup[group as keyof typeof ka.cycle.trackGroup] ?? group;
}

export function formatObservationTrendSummary(trend: CycleObservationTrend): string {
  const label = observationTrendLabel(trend.key);
  if (trend.key === 'energy.low' && trend.summaryType === 'RECENT_OCCURRENCE') {
    return ka.cycle.trendEnergyLowDays(Number(trend.summaryArgs.days) || 0);
  }
  if (trend.summaryType === 'PERIOD_EPISODE_RECURRENCE') {
    return ka.cycle.trendPeriodEpisodes(
      label,
      Number(trend.summaryArgs.episodeCount) || 0,
      Number(trend.summaryArgs.eligibleEpisodes) || 0,
    );
  }
  if (trend.summaryType === 'RECENT_SEVERITY_DISTRIBUTION') {
    const mode = String(trend.summaryArgs.mode || '');
    const modeLabel =
      ka.cycle.painSeverity[mode as keyof typeof ka.cycle.painSeverity] ?? mode;
    return ka.cycle.trendSeverityMostly(label, modeLabel);
  }
  return ka.cycle.trendRecentDays(
    label,
    Number(trend.summaryArgs.days) || trend.occurrenceCount,
    Number(trend.summaryArgs.windowDays) || 30,
  );
}

export function observationTrendA11y(trend: CycleObservationTrend): string {
  return formatObservationTrendSummary(trend);
}
