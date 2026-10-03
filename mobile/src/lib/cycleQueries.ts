/**
 * Cycle reads beyond the shared view, in the server-data cache (stale-while-revalidate).
 * A revisit shows the last answer at once; a focused screen re-reads only once the answer is older
 * than FRESH.SHORT (or right after a cycle write invalidated 'cycle'); hidden stack screens stay quiet.
 * The view itself lives in cycleViewCache.ts (it reads through the offline overlay).
 */
import {
  api,
  type CycleObservationTrendsPayload,
  type CyclePredictionHistory,
  type CyclePregnancyCarePlan,
  type CyclePregnancyPayload,
} from '@/lib/api';
import { CYCLE_QUERY_KEYS } from '@/lib/cycleQueryKeys';
import { localAccountId } from '@/lib/localAccount';
import { accountKey, FRESH, queryClient } from '@/lib/queryClient';
import { useAccountQuery } from '@/hooks/useAccountQuery';

/** Pregnancy payload (dating, timeline). Enable only in a mode that has the pregnancy overview. */
export function useCyclePregnancy(enabled: boolean) {
  return useAccountQuery<CyclePregnancyPayload>({
    key: [...CYCLE_QUERY_KEYS.pregnancy],
    staleTime: FRESH.SHORT,
    enabled,
    // 404 = no active pregnancy: an answer, not a hiccup — never retried.
    retry: 0,
    fetch: () => api.cycle.pregnancy(),
  });
}

/** Personal pregnancy care plan. Enable only online and in a mode with the care planner. */
export function useCyclePregnancyCarePlan(enabled: boolean) {
  return useAccountQuery<CyclePregnancyCarePlan>({
    key: [...CYCLE_QUERY_KEYS.pregnancyCarePlan],
    staleTime: FRESH.SHORT,
    enabled,
    retry: 0,
    fetch: () => api.cycle.pregnancyCarePlan(),
  });
}

/** Symptom / mood observations over cycles. */
export function useCycleObservationTrends(enabled = true) {
  return useAccountQuery<CycleObservationTrendsPayload>({
    key: [...CYCLE_QUERY_KEYS.observationTrends],
    staleTime: FRESH.SHORT,
    enabled,
    fetch: () => api.cycle.observationTrends(),
  });
}

/** How earlier estimates compared with the logged periods. */
export function useCyclePredictionHistory(enabled = true) {
  return useAccountQuery<CyclePredictionHistory>({
    key: [...CYCLE_QUERY_KEYS.predictionHistory],
    staleTime: FRESH.SHORT,
    enabled,
    fetch: () => api.cycle.predictionHistory(),
  });
}

/** After a care-plan save: show the returned plan at once (scoped to its owner, like putCycleView). */
export function putCyclePregnancyCarePlan(userId: string, plan: CyclePregnancyCarePlan | null | undefined): void {
  if (!plan || !userId || localAccountId() !== userId) return;
  queryClient.setQueryData<CyclePregnancyCarePlan>(accountKey(...CYCLE_QUERY_KEYS.pregnancyCarePlan), plan);
}
