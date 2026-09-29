import { useCallback, useEffect, useState } from 'react';
import {
  achievementApi,
  type AchievementClaimResult,
  type AchievementsOverview,
} from '@/lib/quest/achievements';
import { readAchievementsCache, writeAchievementsCache } from '@/lib/quest/cache';
import { beginClaimLock, endClaimLock } from '@/lib/quest/logic.js';
import {
  buildQuestDevAchievements,
  claimAchievementDevFixture,
  getQuestDevScenario,
  isQuestDevEnabled,
  subscribeQuestDevScenario,
} from '@/lib/quest/devFixture';
import { localAccountId } from '@/lib/localAccount';
import { useAccountQuery } from '@/hooks/useAccountQuery';
import { useDeviceSeed, useStaleWhenFallback } from '@/hooks/queryFallback';
import { FRESH } from '@/lib/queryClient';

const claimLocks = new Set<string>();

type AchievementsSnapshot = { overview: AchievementsOverview; fallback: boolean };

/** Invalidated by `requestQuestRefresh()` ('quest') and `requestAchievementsRefresh()` (socket unlocks/claims). */
const ACH_KEY = ['quest', 'achievements'] as const;

async function fetchAchievements(): Promise<AchievementsSnapshot> {
  const owner = localAccountId();
  try {
    const overview = await achievementApi.overview();
    // Scoped preference: write only while the account that asked is still signed in.
    if (owner && owner === localAccountId()) await writeAchievementsCache(overview);
    return { overview, fallback: false };
  } catch (error) {
    const cached = owner && owner === localAccountId() ? await readAchievementsCache() : null;
    if (cached) return { overview: cached.overview, fallback: true };
    throw error;
  }
}

async function readSeed(owner: string): Promise<AchievementsSnapshot | null> {
  const cached = await readAchievementsCache();
  return cached && owner === localAccountId() ? { overview: cached.overview, fallback: true } : null;
}

/** Phase 4 — achievements collection. Server-authoritative; the device copy is a read-only fallback. */
export function useAchievements() {
  const [devScenario, setDevScenario] = useState(() => (isQuestDevEnabled() ? getQuestDevScenario() : 'LIVE'));

  useEffect(() => {
    if (!isQuestDevEnabled()) return;
    const off = subscribeQuestDevScenario(setDevScenario);
    return () => {
      off();
    };
  }, []);

  const devActive = isQuestDevEnabled() && devScenario !== 'LIVE';
  // Unlocks arrive through the socket / Quest refresh signal (both invalidate this key).
  const query = useAccountQuery<AchievementsSnapshot>({
    key: [...ACH_KEY],
    fetch: fetchAchievements,
    staleTime: FRESH.SHORT,
    enabled: !devActive,
  });
  useStaleWhenFallback([...ACH_KEY], query.data);
  const seed = useDeviceSeed(readSeed, !devActive && query.data === undefined);
  const snapshot = query.data ?? seed;

  const { refetch } = query;
  const refresh = useCallback(async (_silent = false) => {
    await refetch();
  }, [refetch]);

  const presented: { overview: AchievementsOverview | null; loading: boolean; error: boolean; stale: boolean } =
    devActive
      ? devScenario === 'ERROR'
        ? { overview: null, loading: false, error: true, stale: false }
        : { overview: buildQuestDevAchievements() as AchievementsOverview, loading: false, error: false, stale: devScenario === 'OFFLINE' }
      : {
          overview: snapshot?.overview ?? null,
          loading: query.isPending && query.fetchStatus !== 'idle',
          error: !snapshot && query.isError,
          stale: Boolean(snapshot && (snapshot.fallback || query.isError)),
        };

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
      const { invalidateMediCoinBalance } = await import('@/lib/quest/cache');
      if (Number.isFinite(Number(coins))) invalidateMediCoinBalance({ coins: Number(coins) });
      else invalidateMediCoinBalance();
      await refetch();
      return result;
    } catch {
      return null;
    } finally {
      endClaimLock(claimLocks, id);
    }
  }, [refetch]);

  return {
    overview: presented.overview,
    loading: presented.loading,
    error: presented.error,
    stale: presented.stale,
    refresh,
    claim,
  };
}
