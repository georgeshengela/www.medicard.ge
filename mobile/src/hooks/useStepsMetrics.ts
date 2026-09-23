import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { subscribeHealthRefresh } from '@/lib/healthDataSync';
import { isHealthPullCancelled } from '@/lib/healthPullCache.js';
import { fetchStepsMetrics } from '@/lib/stepsMetrics';
import type { StepChartPeriod, StepsMetricsBundle } from '@/types/stepsMetrics';

export function useStepsMetrics(initialPeriod: StepChartPeriod = '1d') {
  const [period, setPeriod] = useState<StepChartPeriod>(initialPeriod);
  const [bundle, setBundle] = useState<StepsMetricsBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const periodRef = useRef(period);
  periodRef.current = period;
  const bundleRef = useRef(bundle);
  bundleRef.current = bundle;
  const pullGenRef = useRef(0);

  const refresh = useCallback(async (nextPeriod?: StepChartPeriod, opts?: { force?: boolean }) => {
    const gen = ++pullGenRef.current;
    const p = nextPeriod ?? periodRef.current;
    if (!bundleRef.current) setLoading(true);
    try {
      const data = await fetchStepsMetrics(p, opts);
      if (gen !== pullGenRef.current) return;
      setBundle(data);
      if (nextPeriod) setPeriod(nextPeriod);
    } catch (err) {
      if (isHealthPullCancelled(err)) return;
    } finally {
      if (gen === pullGenRef.current) setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  useEffect(() => subscribeHealthRefresh(() => {
    void refresh(undefined, { force: true });
  }), [refresh]);

  return { bundle, loading, period, setPeriod, refresh };
}
