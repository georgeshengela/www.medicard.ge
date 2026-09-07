import { useCallback, useEffect, useState } from 'react';
import {
  achievementApi,
  type AchievementClaimResult,
  type AchievementsOverview,
} from '@/lib/quest/achievements';
import {
  readAchievementsCache,
  subscribeAchievementsRefresh,
  subscribeQuestRefresh,
  writeAchievementsCache,
} from '@/lib/quest/cache';
import { beginClaimLock, endClaimLock } from '@/lib/quest/logic.js';
import {
  buildQuestDevAchievements,
  claimAchievementDevFixture,
  getQuestDevScenario,
  isQuestDevEnabled,
  subscribeQuestDevScenario,
} from '@/lib/quest/devFixture';

const claimLocks = new Set<string>();

/** Phase 4 — achievements collection. Server-authoritative; cache is read-only fallback. */
export function useAchievements() {
  const [overview, setOverview] = useState<AchievementsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [stale, setStale] = useState(false);
  const [devScenario, setDevScenario] = useState(() => (isQuestDevEnabled() ? getQuestDevScenario() : 'LIVE'));

  const apply = useCallback((next: AchievementsOverview, fromCache: boolean) => {
    setOverview(next);
    setStale(fromCache);
    setError(false);
  }, []);

  const refresh = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const next = await achievementApi.overview();
      apply(next, false);
      await writeAchievementsCache(next);
    } catch {
      const cached = await readAchievementsCache();
      if (cached) apply(cached.overview, true);
      else setError(true);
    } finally {
      setLoading(false);
    }
  }, [apply]);

  useEffect(() => {
    if (!isQuestDevEnabled()) return;
    const off = subscribeQuestDevScenario(setDevScenario);
    return () => {
      off();
    };
  }, []);

  useEffect(() => {
    let alive = true;
    void readAchievementsCache().then((cached) => {
      if (alive && cached) apply(cached.overview, true);
    });
    void refresh(true);
    const offAchievements = subscribeAchievementsRefresh(() => {
      void refresh(true);
    });
    const offQuests = subscribeQuestRefresh(() => {
      void refresh(true);
    });
    return () => {
      alive = false;
      offAchievements();
      offQuests();
    };
  }, [apply, refresh]);

  const devActive = isQuestDevEnabled() && devScenario !== 'LIVE';
  const presented: { overview: AchievementsOverview | null; loading: boolean; error: boolean; stale: boolean } =
    devActive
      ? devScenario === 'ERROR'
        ? { overview: null, loading: false, error: true, stale: false }
        : { overview: buildQuestDevAchievements() as AchievementsOverview, loading: false, error: false, stale: devScenario === 'OFFLINE' }
      : { overview, loading, error, stale };

  const claim = useCallback(async (id: string): Promise<AchievementClaimResult | null> => {
    if (!beginClaimLock(claimLocks, id)) return null;
    try {
      if (isQuestDevEnabled() && getQuestDevScenario() !== 'LIVE') {
        const fake = claimAchievementDevFixture(id) as AchievementClaimResult | null;
        if (fake) return fake;
        return null;
      }
      const result = await achievementApi.claim(id);
      const coins = result.profile?.coinBalance;
      if (Number.isFinite(Number(coins))) {
        const { invalidateMediCoinBalance } = await import('@/lib/quest/cache');
        invalidateMediCoinBalance({ coins: Number(coins) });
      } else {
        const { invalidateMediCoinBalance } = await import('@/lib/quest/cache');
        invalidateMediCoinBalance();
      }
      await refresh(true);
      return result;
    } catch {
      return null;
    } finally {
      endClaimLock(claimLocks, id);
    }
  }, [refresh]);

  return {
    overview: presented.overview,
    loading: presented.loading,
    error: presented.error,
    stale: presented.stale,
    refresh,
    claim,
  };
}
