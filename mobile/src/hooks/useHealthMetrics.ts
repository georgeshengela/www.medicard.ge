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
  const bundleRef = useRef(bundle);
  bundleRef.current = bundle;
  const pullGenRef = useRef(0);
  const key = profileKey(profile);

  const refresh = useCallback(async (opts?: { force?: boolean }) => {
    const gen = ++pullGenRef.current;
    if (!bundleRef.current) setLoading(true);
    try {
      const data = await fetchHealthMetrics(profileRef.current, opts);
      if (gen !== pullGenRef.current) return;
      setBundle(data);
    } catch (err) {
      if (isHealthPullCancelled(err)) return;
    } finally {
      if (gen === pullGenRef.current) setLoading(false);
    }
  }, [key]);

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
