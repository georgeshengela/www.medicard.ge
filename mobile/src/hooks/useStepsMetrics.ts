import { useCallback, useEffect, useState } from 'react';
import { keepPreviousData } from '@tanstack/react-query';
import { subscribeHealthRefresh } from '@/lib/healthDataSync';
import { isHealthPullCancelled } from '@/lib/healthPullCache.js';
import { fetchStepsMetrics } from '@/lib/stepsMetrics';
import { useAccountQuery } from '@/hooks/useAccountQuery';
import { accountKey, FRESH, queryClient } from '@/lib/queryClient';
import type { StepChartPeriod, StepsMetricsBundle } from '@/types/stepsMetrics';

const stepsKey = (period: StepChartPeriod) => ['health', 'steps', period];

/**
 * Steps are LIVE: every visit shows the last count at once and re-reads the device + server in
 * the background, so the number moves from 400 to 1 000 while you look at it. A device health
 * change (`requestHealthRefresh`) forces a fresh read for every period on screen.
 */
export function useStepsMetrics(initialPeriod: StepChartPeriod = '1d', opts: { enabled?: boolean } = {}) {
  const enabled = opts.enabled ?? true;
  const [period, setPeriodState] = useState<StepChartPeriod>(initialPeriod);
  const query = useAccountQuery<StepsMetricsBundle>({
    key: stepsKey(period),
    fetch: () => fetchStepsMetrics(period),
    staleTime: FRESH.LIVE,
    placeholderData: keepPreviousData,
    enabled,
  });

  const refresh = useCallback(async (nextPeriod?: StepChartPeriod, opts?: { force?: boolean }) => {
    const p = nextPeriod ?? period;
    if (nextPeriod) setPeriodState(nextPeriod);
    try {
      await queryClient.fetchQuery({
        queryKey: accountKey(...stepsKey(p)),
        queryFn: () => fetchStepsMetrics(p, opts),
        staleTime: 0,
      });
    } catch (err) {
      if (isHealthPullCancelled(err)) return;
    }
  }, [period]);

  useEffect(() => {
    // A paused steps module (Home) never re-reads the device on health changes.
    if (!enabled) return undefined;
    return subscribeHealthRefresh(() => {
      void queryClient
        .fetchQuery({
          queryKey: accountKey(...stepsKey(period)),
          queryFn: () => fetchStepsMetrics(period, { force: true }),
          staleTime: 0,
        })
        .catch(() => undefined);
    });
  }, [period, enabled]);

  const setPeriod = useCallback((next: StepChartPeriod) => setPeriodState(next), []);

  return {
    bundle: query.data ?? null,
    loading: enabled && !query.data && query.fetchStatus !== 'idle',
    period,
    setPeriod,
    refresh,
  };
}
