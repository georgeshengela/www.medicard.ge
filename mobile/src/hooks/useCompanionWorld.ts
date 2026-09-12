import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { mediWorldApi } from '@/lib/mediWorld/api';
import { useMediWorldAvailable } from '@/lib/mediWorld/enabled';
import {
  getCompanionWorldSnapshot,
  rememberCompanionWorld,
  subscribeCompanionWorld,
} from '@/lib/mediWorld/worldEconomyCache.js';
import type { CompanionWorldState } from '@/lib/mediWorld/types';
import { useOffline } from '@/hooks/useOffline';
import { getPreference, setPreference } from '@/lib/storage';
import { useSyncExternalStore } from 'react';

const CACHE_KEY = 'medicard.mediWorld.companionCache';
const SEEN_STAGE_KEY = 'medicard.mediWorld.seenCompanionStage';

export function useCompanionWorld() {
  const offline = useOffline();
  const enabled = useMediWorldAvailable();
  const payload = useSyncExternalStore(
    subscribeCompanionWorld,
    getCompanionWorldSnapshot,
    getCompanionWorldSnapshot,
  ) as CompanionWorldState | null;
  const [loading, setLoading] = useState(!payload);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [evolutionFrom, setCelebration] = useState<string[] | null>(null);

  const apply = useCallback(async (next: CompanionWorldState) => {
    rememberCompanionWorld(next);
    await setPreference(CACHE_KEY, JSON.stringify(next));
    const seenRaw = await getPreference(SEEN_STAGE_KEY);
    const seen = new Set((seenRaw || '').split(',').filter(Boolean));
    const fresh = (next.evolution?.newlyUnlocked || []).filter((key) => !seen.has(key));
    if (fresh.length) setCelebration(fresh);
    const unlocked = next.evolution?.stages?.filter((row) => row.unlocked).map((row) => row.key) || [];
    await setPreference(SEEN_STAGE_KEY, unlocked.join(','));
  }, []);

  const refresh = useCallback(async (silent = false, { spinner = false } = {}) => {
    if (!enabled) {
      setError(false);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    if (!silent) setLoading(true);
    else if (spinner) setRefreshing(true);
    try {
      if (!getCompanionWorldSnapshot()) {
        const cachedRaw = await getPreference(CACHE_KEY);
        if (cachedRaw) {
          try {
            const cached = JSON.parse(cachedRaw) as CompanionWorldState;
            if (cached?.companion) rememberCompanionWorld(cached);
          } catch {
            /* ignore */
          }
        }
      }
      const next = await mediWorldApi.companion();
      await apply(next);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [apply, enabled]);

  const mutate = useCallback(
    async (fn: () => Promise<CompanionWorldState>) => {
      const next = await fn();
      await apply(next);
      setError(false);
      return next;
    },
    [apply],
  );

  const dismissEvolution = useCallback(() => setCelebration(null), []);

  useFocusEffect(
    useCallback(() => {
      void refresh(true);
    }, [refresh]),
  );

  return {
    payload,
    loading,
    error,
    offline,
    refreshing,
    refresh,
    mutate,
    evolutionFrom,
    dismissEvolution,
    enabled,
  };
}
