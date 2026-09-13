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
  const pullGenRef = useRef(0);

  const refresh = useCallback(async (nextPeriod?: StepChartPeriod, opts?: { force?: boolean }) => {
    const gen = ++pullGenRef.current;
    const p = nextPeriod ?? periodRef.current;
    setLoading(true);
    try {
      const data = await fetchStepsMetrics(p, opts);
      if (gen !== pullGenRef.current) return;
      setBundle(data);
      if (nextPeriod) setPeriod(nextPeriod);
    } catch (err) {
      if (isHealthPullCancelled(err)) {
        if (gen === pullGenRef.current) setBundle(null);
        return;
      }
    } finally {
      if (gen === pullGenRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

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
