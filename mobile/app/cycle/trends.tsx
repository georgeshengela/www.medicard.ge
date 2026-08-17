import React, { useEffect, useLayoutEffect, useState } from 'react';
import { ScrollView, Text } from 'react-native';
import { useNavigation } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CycleTrendsCharts } from '@/components/cycle/CycleTrendsChart';
import { CycleAtmosphere, CycleLoading, cycleNavHeader } from '@/components/cycle/CycleUI';
import { ka } from '@/i18n/ka';
import { api, ApiError, type CycleBundle } from '@/lib/api';
import { useCycleColors } from '@/theme/cycle';

export default function CycleTrendsScreen() {
  const c = useCycleColors();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [bundle, setBundle] = useState<CycleBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useLayoutEffect(() => {
    navigation.setOptions(cycleNavHeader(c, ka.cycle.trendsTitle));
  }, [navigation, c]);

  useEffect(() => {
    api.cycle
      .get()
      .then(setBundle)
      .catch((err) => setError(err instanceof ApiError ? err.message : ka.common.error))
      .finally(() => setLoading(false));
  }, []);

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
        {bundle ? <CycleTrendsCharts bundle={bundle} /> : null}
      </ScrollView>
    </CycleAtmosphere>
  );
}
