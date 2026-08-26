import { useCallback, useEffect, useState } from 'react';
import type { HealthProfile } from '@/lib/api';
import { fetchHealthMetrics } from '@/lib/healthMetrics';
import type { HealthMetricsBundle } from '@/types/healthMetrics';

export function useHealthMetrics(profile: HealthProfile | null | undefined) {
  const [bundle, setBundle] = useState<HealthMetricsBundle | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchHealthMetrics(profile);
      setBundle(data);
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { bundle, loading, refresh };
}
