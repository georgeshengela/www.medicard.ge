/**
 * What /cycle/trends can honestly show. With too little data the charts would be blank or zero, so
 * the screen shows one calm empty card with a „დღის აღრიცხვა“ CTA instead (brief §9 wave 2 item 14).
 * Pure: node tests import it.
 */
import type { CycleBundle, CycleObservationTrendsPayload } from './api';
import { hasPmsPattern } from './cycleAnalytics.ts';

/** Same rule CycleTrendsCharts uses to render anything at all. */
export function cycleTrendsHasCharts(bundle: CycleBundle | null | undefined): boolean {
  if (!bundle) return false;
  const analytics = bundle.analytics;
  const trends = bundle.trends;
  if (!trends && !analytics) return false;
  const cycles = analytics?.cycleLengths?.filter((x) => x.length != null) ?? trends?.cycleLengths ?? [];
  const hasCycleStats = (analytics?.completedCycleCount ?? 0) >= 2 && Boolean(analytics?.cycleLengthStats?.count);
  const hasLifestyle =
    Boolean(analytics?.lifestylePatterns?.length) || Boolean(bundle.observationInsights?.lifestyle?.patterns?.length);
  return hasCycleStats || cycles.length >= 3 || hasPmsPattern(bundle) || hasLifestyle;
}

export type CycleTrendsScreenState = 'loading' | 'empty' | 'content';

/**
 * - `loading`: no bundle yet, or no charts and the observations have not answered yet (avoids a
 *   flash of the empty card before the first observation answer).
 * - `empty`: no chart to draw and no observation to list (a failed observation read counts as none).
 * - `content`: at least one chart or one observation.
 */
export function cycleTrendsScreenState(input: {
  bundle: CycleBundle | null | undefined;
  observations: CycleObservationTrendsPayload | null | undefined;
  observationsSettled: boolean;
}): CycleTrendsScreenState {
  if (!input.bundle) return 'loading';
  if (cycleTrendsHasCharts(input.bundle)) return 'content';
  if ((input.observations?.trends?.length ?? 0) > 0) return 'content';
  if (!input.observationsSettled) return 'loading';
  return 'empty';
}
