import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { mediWorldApi } from '@/lib/mediWorld/api';
import { useMediWorldAvailable } from '@/lib/mediWorld/enabled';
import {
  getWorldProfileSnapshot,
  rememberWorldProfile,
  subscribeWorldProfile,
} from '@/lib/mediWorld/worldEconomyCache.js';
import type { MediWorldProfileResponse } from '@/lib/mediWorld/types';
import { useOffline } from '@/hooks/useOffline';
import { getPreference, setPreference } from '@/lib/storage';
import { useSyncExternalStore } from 'react';

const SEEN_LEVEL_KEY = 'medicard.mediWorld.seenLevel';
export const PROFILE_CACHE_KEY = 'medicard.mediWorld.profileCache';

export function useMediWorldProfile() {
  const offline = useOffline();
  const enabled = useMediWorldAvailable();
  const payload = useSyncExternalStore(
    subscribeWorldProfile,
    getWorldProfileSnapshot,
    getWorldProfileSnapshot,
  ) as MediWorldProfileResponse | null;
  const [loading, setLoading] = useState(!payload);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [celebrationFrom, setCelebrationFrom] = useState<number | null>(null);

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
      if (!getWorldProfileSnapshot()) {
        const cachedRaw = await getPreference(PROFILE_CACHE_KEY);
        if (cachedRaw) {
          try {
            const cached = JSON.parse(cachedRaw) as MediWorldProfileResponse;
            if (cached?.profile) rememberWorldProfile(cached);
          } catch {
            /* ignore corrupt cache */
          }
        }
      }
      const next = await mediWorldApi.profile();
      rememberWorldProfile(next);
      await setPreference(PROFILE_CACHE_KEY, JSON.stringify(next));
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [enabled]);

  const dismissCelebration = useCallback(async () => {
    const level = payload?.profile?.worldLevel || payload?.profile?.foundation?.level || 1;
    await setPreference(SEEN_LEVEL_KEY, String(level));
    setCelebrationFrom(null);
  }, [payload]);

  useEffect(() => {
    if (!payload) return;
    void setPreference(PROFILE_CACHE_KEY, JSON.stringify(payload));
    const level = payload.profile?.worldLevel || payload.profile?.foundation?.level || 1;
    void getPreference(SEEN_LEVEL_KEY).then((seenRaw) => {
      const seen = Math.max(1, Number(seenRaw) || 1);
      if (level > seen) setCelebrationFrom(seen);
      else setCelebrationFrom(null);
    });
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
    refreshing,
    refresh,
    enabled,
    celebrationFrom,
    dismissCelebration,
  };
}
