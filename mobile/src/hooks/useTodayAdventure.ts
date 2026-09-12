import { useCallback, useEffect, useRef, useState } from 'react';
import { mediWorldApi } from '@/lib/mediWorld/api';
import { isAdventureCacheExpired } from '@/lib/mediWorld/cacheExpiry';
import { useMediWorldAvailable } from '@/lib/mediWorld/enabled';
import type { AdventureResponse } from '@/lib/mediWorld/types';
import { useOffline } from '@/hooks/useOffline';
import { getPreference, setPreference } from '@/lib/storage';

const CACHE_KEY = 'medicard.mediWorld.adventureCache';

export function useTodayAdventure() {
  const offline = useOffline();
  const enabled = useMediWorldAvailable();
  const [payload, setPayload] = useState<AdventureResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [stale, setStale] = useState(false);
  const cacheHydrated = useRef(false);

  const apply = useCallback(async (next: AdventureResponse, fromCache = false) => {
    const expired = Boolean(next.adventure?.expired) || isAdventureCacheExpired(next.adventure);
    setPayload({
      ...next,
      adventure: {
        ...next.adventure,
        stale: fromCache || Boolean(next.adventure?.stale) || expired,
        expired,
      },
    });
    if (!fromCache && !expired) await setPreference(CACHE_KEY, JSON.stringify(next));
  }, []);

  const refresh = useCallback(async (silent = false) => {
    if (!enabled) {
      setLoading(false);
      setRefreshing(false);
      return;
    }
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      if (!cacheHydrated.current) {
        cacheHydrated.current = true;
        const cachedRaw = await getPreference(CACHE_KEY);
        if (cachedRaw) {
          try {
            const cached = JSON.parse(cachedRaw) as AdventureResponse;
            if (cached?.adventure) {
              await apply(cached, true);
              setStale(true);
            }
          } catch {
            /* ignore */
          }
        }
      }
      const next = await mediWorldApi.adventureToday();
      await apply(next, false);
      setStale(false);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [apply, enabled]);

  const mutate = useCallback(
    async (fn: () => Promise<AdventureResponse>) => {
      const next = await fn();
      await apply(next, false);
      setStale(false);
      setError(false);
      return next;
    },
    [apply],
  );

  useEffect(() => {
    void refresh(true);
  }, [refresh]);

  return {
    payload,
    loading,
    error,
    offline,
    stale: stale || Boolean(payload?.adventure?.stale),
    expired: Boolean(payload?.adventure?.expired),
    refreshing,
    refresh,
    mutate,
    enabled,
  };
}
