import type { CycleBundle } from '@/lib/api';

/** Enough logged data to show PMS-by-day heatmap (≥2 cycles with PMS hits). */
export function hasPmsPattern(bundle: CycleBundle): boolean {
  return (bundle.trends?.pmsByDay?.length ?? 0) >= 2;
}

export function loggedCycleCount(bundle: CycleBundle): number {
  return (
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
