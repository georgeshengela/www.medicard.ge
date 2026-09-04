import React, { useMemo } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { HomeSectionTitle } from '@/components/home/HomeSectionTitle';
import { HydrationFigmaCard } from '@/components/hydration/HydrationFigmaCard';
import { ChartCardSkeleton } from '@/components/ui/Skeleton';
import { useHydration } from '@/hooks/useHydration';
import { ka } from '@/i18n/ka';

export function HomeHydrationSection() {
  const router = useRouter();
  const { today, todayMl, goalMl, remainingMl, logs, loading } = useHydration();

  const updatedLabel = useMemo(() => {
    const last = logs.find((row) => row.date === today);
    if (!last?.at) return ka.common.today;
    const time = new Date(last.at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    return ka.hydration.cardToday(time);
  }, [logs, today]);

  if (loading) {
    return (
      <View style={{ paddingVertical: 4, gap: 8 }}>
        <HomeSectionTitle title={ka.home.hydrationTitle} style={{ marginHorizontal: 16, marginBottom: 0 }} />
        <View style={{ marginHorizontal: 16 }}>
          <ChartCardSkeleton />
        </View>
      </View>
    );
  }

  return (
    <View style={{ paddingVertical: 4, gap: 8 }}>
      <HomeSectionTitle title={ka.home.hydrationTitle} style={{ marginHorizontal: 16, marginBottom: 0 }} />
      <View style={{ marginHorizontal: 16 }}>
        <HydrationFigmaCard
          todayMl={todayMl}
          goalMl={goalMl}
          remainingMl={remainingMl}
          updatedLabel={updatedLabel}
          onPress={() => router.push('/health-metrics/hydration' as never)}
        />
      </View>
    </View>
  );
}
