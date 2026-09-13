import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useFocusEffect } from 'expo-router';
import { mediWorldApi } from '@/lib/mediWorld/api';
import { useMediWorldSocialAvailable } from '@/lib/mediWorld/enabled';
import {
  getSocialSnapshot,
  rememberSocial,
  subscribeSocial,
} from '@/lib/mediWorld/worldEconomyCache.js';
import { socialCacheKey, unwrapSocialDisk, wrapSocialDisk } from '@/lib/mediWorld/socialSession.js';
import type { SocialMe } from '@/lib/mediWorld/types';
import { useOffline } from '@/hooks/useOffline';
import { getPreference, setPreference } from '@/lib/storage';
import { useAuth } from '@/store/AuthContext';
import { onSocialInvalidate } from '@/lib/quest/socket';

export const SOCIAL_CACHE_KEY = 'medicard.mediWorld.socialCache';
export const SOCIAL_INTRO_KEY = 'medicard.mediWorld.socialIntroSeen';

export function useSocial() {
  const { user } = useAuth();
  const userId = user?.id || null;
  const offline = useOffline();
  const enabled = useMediWorldSocialAvailable();
  const payload = useSyncExternalStore(
    subscribeSocial,
    () => getSocialSnapshot(userId) as SocialMe | null,
    () => getSocialSnapshot(userId) as SocialMe | null,
  );
  const [loading, setLoading] = useState(!payload);
  const [error, setError] = useState(false);
  const [stale, setStale] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const refreshGenRef = useRef(0);

  const refresh = useCallback(async (silent = false) => {
    const gen = ++refreshGenRef.current;
    if (!enabled || !userId) {
      if (gen === refreshGenRef.current) {
        setLoading(false);
        setError(false);
      }
      return;
    }
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      if (!getSocialSnapshot(userId)) {
        const diskKey = socialCacheKey(userId);
        const cachedRaw = diskKey ? await getPreference(diskKey) : null;
        const cached = unwrapSocialDisk(cachedRaw, userId) as SocialMe | null;
        if (cached?.publicId && gen === refreshGenRef.current) {
          rememberSocial(cached, userId);
          setStale(true);
        }
      }
      if (offline) {
        if (gen === refreshGenRef.current) {
          setStale(true);
          setError(false);
        }
        return;
      }
      const next = await mediWorldApi.socialMe();
      if (gen !== refreshGenRef.current) return;
      rememberSocial(next, userId);
      const diskKey = socialCacheKey(userId);
      const wrapped = wrapSocialDisk(userId, next);
      if (diskKey && wrapped) await setPreference(diskKey, wrapped);
      setStale(false);
      setError(false);
    } catch {
      if (gen === refreshGenRef.current) setError(true);
    } finally {
      if (gen === refreshGenRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [enabled, offline, userId]);

  const mutate = useCallback(async <T,>(fn: () => Promise<T>) => {
    if (offline) {
      throw new Error('offline');
    }
    return fn();
  }, [offline]);

  useEffect(() => {
    if (!payload || !userId) return;
    const diskKey = socialCacheKey(userId);
    const wrapped = wrapSocialDisk(userId, payload);
    if (diskKey && wrapped) void setPreference(diskKey, wrapped);
  }, [payload, userId]);

  useFocusEffect(
    useCallback(() => {
      void refresh(true);
    }, [refresh]),
  );

  useEffect(() => {
    return onSocialInvalidate(() => {
      void refresh(true);
    });
  }, [refresh]);

  return {
    payload,
    loading,
    error,
    offline,
    stale,
    refreshing,
    refresh,
    mutate,
    canMutate: enabled && !offline,
    enabled,
  };
}

export function newSocialIdempotency(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
}
