import React, { useCallback, useMemo, useState } from 'react';
import { View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Scale } from 'lucide-react-native';
import { NightingaleMetricCard } from '@/components/health/HealthMetricCard';
import { HomeSectionTitle } from '@/components/home/HomeSectionTitle';
import { MetricCardSkeleton } from '@/components/ui/Skeleton';
import { HomeWeightLogSheet } from '@/components/home/HomeWeightLogSheet';
import { useFigmaHealthMetrics } from '@/constants/figmaHealthMetricsLayout';
import { useHealthMetrics } from '@/hooks/useHealthMetrics';
import { ka } from '@/i18n/ka';
import { bmiCategory, bmiFromWeight } from '@/lib/bmi';
import { useAuth } from '@/store/AuthContext';
import type { HealthProfile } from '@/lib/api';

type Props = {
  profile: HealthProfile | null | undefined;
};

export function HomeBmiWeightSection({ profile }: Props) {
  const FIGMA_HEALTH_METRICS = useFigmaHealthMetrics();
  const { refreshHealthProfile } = useAuth();
  const { bundle, loading, refresh } = useHealthMetrics(profile);
  const [sheetOpen, setSheetOpen] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const weight = bundle?.metrics.find((metric) => metric.key === 'weight');
  const value = weight?.value ?? profile?.weightKg ?? null;
  const bmi = bmiFromWeight(value, profile?.heightCm) ?? profile?.bmi ?? null;
  const category = bmi != null ? bmiCategory(bmi) : null;
  const weekValues = weight?.weekValues ?? [];
  const initialKg = value ?? 70;

  const status = useMemo(() => {
    if (value == null) return ka.home.bmi.emptyTitle;
    if (bmi == null) return ka.home.bmi.noHeight;
    if (category === 'normal') return ka.healthMetrics.weightOptimal;
    if (category) return ka.home.bmi.categories[category];
    return ka.home.bmi.healthyBmi;
  }, [bmi, category, value]);

  const onSaved = useCallback(async () => {
    await Promise.all([refreshHealthProfile(), refresh()]);
  }, [refresh, refreshHealthProfile]);

  const openSheet = useCallback(() => {
    setTimeout(() => setSheetOpen(true), 0);
  }, []);

  return (
    <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
      <HomeSectionTitle title={ka.home.bmi.title} />
      {loading && !bundle && value == null ? (
        <MetricCardSkeleton />
      ) : (
        <NightingaleMetricCard
          Icon={Scale}
          color={FIGMA_HEALTH_METRICS.weight}
          title={ka.healthMetrics.metrics.weight}
          updatedLabel={weight?.updatedLabel ?? ka.healthMetrics.today}
          valueText={value != null ? value.toFixed(1) : '—'}
          unit={value != null ? ka.home.bmi.kg : null}
          status={status}
          weekValues={weekValues}
          onPress={openSheet}
        />
      )}

      <HomeWeightLogSheet
        visible={sheetOpen}
        profile={profile}
        initialKg={initialKg}
        onClose={() => setSheetOpen(false)}
        onSaved={() => void onSaved()}
      />
    </View>
  );
}
