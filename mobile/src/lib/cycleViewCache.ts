/**
 * The cycle view (local-first bundle from `loadCycleView`) in the shared server-data cache.
 * One key for Home's cycle card and every cycle screen, so a visit shows the last view at once.
 * Offline queue writes invalidate 'cycle' (enqueueCycleOp) and push their optimistic view here
 * (`putCycleView`), so a logged day appears before the server answers.
 */
import type { CycleBundle } from '@/lib/api';
import { loadCycleView, type CycleView } from '@/lib/cycleOffline';
import { isCompleteCycleBundle } from '@/lib/cycleOfflineCore';
import { CYCLE_QUERY_KEYS } from '@/lib/cycleQueryKeys';
import { localAccountId } from '@/lib/localAccount';
import { accountKey, FRESH, invalidate, queryClient } from '@/lib/queryClient';
import { useAccountQuery } from '@/hooks/useAccountQuery';

export const CYCLE_VIEW_KEY = CYCLE_QUERY_KEYS.view;

/** Same data for every reader of CYCLE_VIEW_KEY (Home card, cycle screens). */
export function fetchCycleView(userId: string): Promise<CycleView> {
  return loadCycleView(userId);
}

/** Cycle view for the signed-in account (enabled only when the privacy gate has let the caller through). */
export function useCycleView(userId: string | null | undefined, enabled = true) {
  return useAccountQuery<CycleView>({
    key: [...CYCLE_VIEW_KEY],
    staleTime: FRESH.SHORT,
    enabled: Boolean(userId) && enabled,
    fetch: () => fetchCycleView(userId as string),
  });
}

/**
 * The cached view of the signed-in account without subscribing (a tap handler on Home reads it once —
 * Home keeps its single subscriber per key). Undefined when nothing is cached yet.
 */
export function peekCycleView(): CycleView | undefined {
  return queryClient.getQueryData<CycleView>(accountKey(...CYCLE_VIEW_KEY));
}

/** After a save: show the returned (optimistic or synced) view everywhere at once. Scoped to its owner. */
export function putCycleView(userId: string, view: CycleView | null | undefined): void {
  if (!view || !userId || localAccountId() !== userId) return;
  queryClient.setQueryData<CycleView>(accountKey(...CYCLE_VIEW_KEY), view);
}

/**
 * An online write that answered with a fresh bundle (profile / last period / contraception). A write
 * whose reload failed answers `null` (older servers: a partial `{ profile, meta }`): that is never shown
 * as the view (CYC-06) — the cycle views are fetched again instead.
 */
export function putCycleBundle(userId: string, bundle: CycleBundle | null | undefined): void {
  if (!userId || localAccountId() !== userId) return;
  if (!isCompleteCycleBundle(bundle)) {
    void invalidate('cycle');
    return;
  }
  queryClient.setQueryData<CycleView>(accountKey(...CYCLE_VIEW_KEY), (old) =>
    old
      ? { ...old, display: bundle, canonical: bundle }
      : {
          display: bundle,
          canonical: bundle,
          stale: false,
          reachable: true,
          cachedAt: new Date().toISOString(),
          pendingCount: 0,
          pendingDates: [],
          syncState: 'synced',
          lastError: null,
          persistedLocally: false,
          attention: [],
          pendingLastPeriodStart: null,
        },
  );
}
