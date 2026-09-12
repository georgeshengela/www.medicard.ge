import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useSyncExternalStore } from 'react';
import { mediWorldApi } from '@/lib/mediWorld/api';
import { useMediWorldGardenAvailable } from '@/lib/mediWorld/enabled';
import {
  getGardenSnapshot,
  rememberGarden,
  subscribeGarden,
} from '@/lib/mediWorld/worldEconomyCache.js';
import type { GardenResponse } from '@/lib/mediWorld/types';
import { useOffline } from '@/hooks/useOffline';
import { getPreference, setPreference } from '@/lib/storage';

export const GARDEN_CACHE_KEY = 'medicard.mediWorld.gardenCache';
export const GARDEN_INTRO_KEY = 'medicard.mediWorld.gardenIntroSeen';

export function useGarden() {
  const offline = useOffline();
  const enabled = useMediWorldGardenAvailable();
  const payload = useSyncExternalStore(subscribeGarden, getGardenSnapshot, getGardenSnapshot) as GardenResponse | null;
  const [loading, setLoading] = useState(!payload);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [stale, setStale] = useState(false);

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
      if (!getGardenSnapshot()) {
        const cachedRaw = await getPreference(GARDEN_CACHE_KEY);
        if (cachedRaw) {
          try {
            const cached = JSON.parse(cachedRaw) as GardenResponse;
            if (cached?.plots) {
              rememberGarden({ ...cached, stale: true });
              setStale(true);
            }
          } catch {
            /* ignore */
          }
        }
      }
      if (offline) {
        setStale(true);
        setError(false);
        return;
      }
      const next = await mediWorldApi.garden();
      rememberGarden({ ...next, stale: false });
      await setPreference(GARDEN_CACHE_KEY, JSON.stringify(next));
      setStale(false);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [enabled, offline]);

  const mutate = useCallback(async (fn: () => Promise<GardenResponse>) => {
    if (offline) {
      const err = new Error('offline');
      throw err;
    }
    const next = await fn();
    rememberGarden({ ...next, stale: false });
    await setPreference(GARDEN_CACHE_KEY, JSON.stringify(next));
    return next;
  }, [offline]);

  useEffect(() => {
    if (!payload) return;
    void setPreference(GARDEN_CACHE_KEY, JSON.stringify(payload));
  }, [payload]);

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
    stale: stale || Boolean(payload?.stale),
    refreshing,
    refresh,
    mutate,
    canMutate: enabled && !offline,
  };
}

export function newIdempotencyKey(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
}
