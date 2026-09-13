import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import type { HealthProfile } from '@/lib/api';
import { subscribeHealthRefresh } from '@/lib/healthDataSync';
import { isHealthPullCancelled } from '@/lib/healthPullCache.js';
import { fetchHealthMetrics } from '@/lib/healthMetrics';
import type { HealthMetricsBundle } from '@/types/healthMetrics';

function profileKey(profile: HealthProfile | null | undefined) {
  if (!profile) return '';
  return `${profile.heightCm ?? ''}:${profile.weightKg ?? ''}:${profile.activityLevel ?? ''}`;
}

export function useHealthMetrics(profile: HealthProfile | null | undefined) {
  const [bundle, setBundle] = useState<HealthMetricsBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const profileRef = useRef(profile);
  profileRef.current = profile;
  const pullGenRef = useRef(0);
  const key = profileKey(profile);

  const refresh = useCallback(async (opts?: { force?: boolean }) => {
    const gen = ++pullGenRef.current;
    setLoading(true);
    try {
      const data = await fetchHealthMetrics(profileRef.current, opts);
      if (gen !== pullGenRef.current) return;
      setBundle(data);
    } catch (err) {
      if (isHealthPullCancelled(err)) {
        if (gen === pullGenRef.current) setBundle(null);
        return;
      }
    } finally {
      if (gen === pullGenRef.current) setLoading(false);
    }
  }, [key]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  useEffect(() => subscribeHealthRefresh(() => {
    void refresh({ force: true });
  }), [refresh]);

  return { bundle, loading, refresh };
}
