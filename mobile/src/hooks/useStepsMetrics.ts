import { useCallback, useEffect, useState } from 'react';
import { fetchStepsMetrics } from '@/lib/stepsMetrics';
import type { StepChartPeriod, StepsMetricsBundle } from '@/types/stepsMetrics';

export function useStepsMetrics(initialPeriod: StepChartPeriod = '1d') {
  const [period, setPeriod] = useState<StepChartPeriod>(initialPeriod);
  const [bundle, setBundle] = useState<StepsMetricsBundle | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async (nextPeriod?: StepChartPeriod) => {
    const p = nextPeriod ?? period;
    setLoading(true);
    try {
      const data = await fetchStepsMetrics(p);
      setBundle(data);
      if (nextPeriod) setPeriod(nextPeriod);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { bundle, loading, period, setPeriod, refresh };
}
