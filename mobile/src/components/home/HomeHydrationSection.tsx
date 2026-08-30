import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { HomeSectionTitle } from '@/components/home/HomeSectionTitle';
import { ChartCardSkeleton } from '@/components/ui/Skeleton';
import { HydrationWeekChart } from '@/components/hydration/HydrationWeekChart';
import { GoalTrendUp } from '@/components/health/steps-goal/StepsGoalIcons';
import { useFigmaHydration } from '@/constants/figmaHydrationLayout';
import { useHydration } from '@/hooks/useHydration';
import { ka } from '@/i18n/ka';
import { formatMl } from '@/lib/hydration';
import { HYDRATION_DROP_ML } from '@/types/hydration';

export function HomeHydrationSection() {
  const T = useFigmaHydration();
  const router = useRouter();
  const { todayMl, weekTotals, lastWeekTotals, weekTrend, best, loading } = useHydration();
  const up = weekTrend == null ? true : weekTrend >= 0;
  const glasses = best ? Math.max(1, Math.round(best.ml / HYDRATION_DROP_ML)) : 0;
  const bestLabel = best
    ? new Date(`${best.date}T12:00:00`).toLocaleDateString('ka-GE', { month: 'short', day: 'numeric', year: 'numeric' })
    : '';

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
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push('/health-metrics/hydration' as never)}
        style={{
          marginHorizontal: 16,
          backgroundColor: T.cardBg,
          borderRadius: 24,
          borderWidth: 1,
          borderColor: T.border,
          padding: 16,
          gap: 16,
          ...T.shadowXs,
        }}
      >
        <View style={{ gap: 8 }}>
          <Text
            style={{
              fontFamily: 'NotoSansGeorgian_600SemiBold',
              fontSize: 30,
              lineHeight: 38,
              letterSpacing: -0.25,
              color: T.textPrimary,
            }}
          >
            {formatMl(todayMl).replace(' ', '')}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <View style={{ transform: [{ scaleY: up ? 1 : -1 }] }}>
                <GoalTrendUp size={20} color={up ? T.successText : T.destructive} />
              </View>
              <Text
                style={{
                  fontFamily: 'NotoSansGeorgian_600SemiBold',
                  fontSize: 16,
                  lineHeight: 22,
                  color: up ? T.successText : T.destructive,
                }}
              >
                {weekTrend == null ? 0 : Math.abs(weekTrend)}%
              </Text>
            </View>
            <Text
              numberOfLines={1}
              style={{
                flex: 1,
                fontFamily: 'NotoSansGeorgian_400Regular',
                fontSize: 16,
                lineHeight: 22,
                color: T.textSecondary,
              }}
            >
              {ka.hydration.weekMore}
            </Text>
          </View>
        </View>
        <HydrationWeekChart values={weekTotals} compareValues={lastWeekTotals} />
        <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 14, lineHeight: 22, color: T.textSecondary }}>
          {best ? ka.hydration.bestDay(bestLabel, glasses) : ka.hydration.noWeekData}
        </Text>
      </Pressable>
    </View>
  );
}
