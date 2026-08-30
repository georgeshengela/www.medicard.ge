import type { CycleAnalytics, CycleBundle, CyclePainPattern, CycleRecurringPattern } from '@/lib/api';

export function cycleAnalyticsOf(bundle: CycleBundle | null | undefined): CycleAnalytics | undefined {
  return bundle?.analytics;
}

export function pmsHeatmapRows(bundle: CycleBundle): { daysBefore: number; count: number; topSymptoms: { key: string; count: number }[] }[] {
  return bundle.analytics?.pmsByDaysBefore ?? bundle.trends?.pmsByDaysBefore ?? [];
}

/** Enough completed-cycle heatmap points to show the period-relative chart. */
export function hasPmsPattern(bundle: CycleBundle): boolean {
  return pmsHeatmapRows(bundle).length >= 2 && (bundle.analytics?.completedCycleCount ?? 0) >= 2;
}

export function loggedCycleCount(bundle: CycleBundle): number {
  return (
    bundle.analytics?.completedCycleCount ??
    bundle.averages?.cycleCount ??
    bundle.trends?.cycleCount ??
    bundle.trends?.cycleLengths?.length ??
    bundle.inferred?.periodStarts?.length ??
    0
  );
}

export function cycleConfidenceLabel(bundle: CycleBundle): 'low' | 'medium' | 'high' {
  return bundle.predictions?.confidence ?? bundle.summary?.confidence ?? bundle.trends?.confidence ?? 'low';
}

export function formatRecurrenceKa(
  pattern: CycleRecurringPattern | CyclePainPattern,
  label: string,
  template: (args: { label: string; n: number; m: number; range: string }) => string,
): string {
  const range =
    pattern.daysBeforeMin != null && pattern.daysBeforeMax != null
      ? pattern.daysBeforeMin === pattern.daysBeforeMax
        ? `${pattern.daysBeforeMin}`
        : `${pattern.daysBeforeMin}–${pattern.daysBeforeMax}`
      : '—';
  return template({
    label,
    n: pattern.cyclesWithObservation,
    m: pattern.eligibleCycles,
    range,
  });
}
