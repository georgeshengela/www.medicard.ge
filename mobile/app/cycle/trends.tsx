import React, { useEffect, useLayoutEffect, useState } from 'react';
import { ScrollView, Text } from 'react-native';
import { useNavigation } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CycleObservationTrends } from '@/components/cycle/CycleObservationTrends';
import { CycleTrendsCharts } from '@/components/cycle/CycleTrendsChart';
import { CycleAtmosphere, CycleLoading, cycleNavHeader } from '@/components/cycle/CycleUI';
import { ka } from '@/i18n/ka';
import { ApiError, type CycleBundle } from '@/lib/api';
import { loadCycleView } from '@/lib/cycleOffline';
import { useAuth } from '@/store/AuthContext';
import { useCycleColors } from '@/theme/cycle';

export default function CycleTrendsScreen() {
  const { user } = useAuth();
  const c = useCycleColors();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [bundle, setBundle] = useState<CycleBundle | null>(null);
  const [stale, setStale] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useLayoutEffect(() => {
    navigation.setOptions(cycleNavHeader(c, ka.cycle.trendsTitle));
  }, [navigation, c]);

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    loadCycleView(user.id)
      .then((view) => {
        setBundle(view.canonical);
        setStale(view.stale);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : ka.common.error))
      .finally(() => setLoading(false));
  }, [user?.id]);

  if (loading) return <CycleLoading />;

  return (
    <CycleAtmosphere>
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
      >
        {error ? (
          <Text style={{ color: c.danger, fontWeight: '600', marginBottom: 12 }}>{error}</Text>
        ) : null}
        {stale ? (
          <Text style={{ color: c.muted, marginBottom: 12, lineHeight: 20 }}>
            {ka.cycle.offlineRefreshHint}
          </Text>
        ) : null}
        {bundle ? (
          <>
            <CycleObservationTrends
              refreshKey={(bundle.logs || [])
                .map((l) => `${l.date}:${(l.symptoms || []).join(',')}:${l.energy || l.observations?.energy || ''}`)
                .join('|')}
              showEmpty={
                (bundle.analytics?.completedCycleCount ?? 0) < 2 &&
                !(bundle.trends?.cycleLengths && bundle.trends.cycleLengths.length >= 3)
              }
            />
            <CycleTrendsCharts bundle={bundle} />
          </>
        ) : null}
      </ScrollView>
    </CycleAtmosphere>
  );
}
