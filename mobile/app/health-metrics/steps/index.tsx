import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  ArrowUp,
  Footprints,
  LayoutList,
  Plus,
  Sparkles,
} from 'lucide-react-native';
import { StepsBarChart } from '@/components/health/StepsBarChart';
import { StepsGoalCard, StepsReachedGoalsList, StepsSection } from '@/components/health/StepsGoalCard';
import { StepsHistoryRow } from '@/components/health/StepsHistoryRow';
import { StepsInsightGrid } from '@/components/health/StepsInsightGrid';
import { StepsPeriodTabs } from '@/components/health/StepsPeriodTabs';
import { useFigmaSteps } from '@/constants/figmaStepsLayout';
import { useStepsMetrics } from '@/hooks/useStepsMetrics';
import { ka } from '@/i18n/ka';
import { formatStepsCount } from '@/lib/stepsMetrics.shared';
import { fetchStepsTotalBetween } from '@/lib/stepsMetrics';
import { loadReachedStepsGoals } from '@/lib/stepsGoalHistory';
import { buildGoalProgress, loadStepsGoal, todayYmd } from '@/lib/stepsGoal';
import type { StepsGoalRecord } from '@/types/stepsGoal';
import type { StepChartPeriod } from '@/types/stepsMetrics';

/** Figma 8851:166841 — steps counter detail. */
export default function StepsDetailScreen() {
  const FIGMA_STEPS = useFigmaSteps();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { bundle, loading, period, refresh } = useStepsMetrics('1d');
  const [refreshing, setRefreshing] = useState(false);
  const [campaign, setCampaign] = useState<{ goal: number; current: number; remaining: number } | null>(null);
  const [reached, setReached] = useState<StepsGoalRecord[]>([]);

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        setReached(await loadReachedStepsGoals());
        const goal = await loadStepsGoal();
        if (!goal) {
          setCampaign(null);
          return;
        }
        const current = await fetchStepsTotalBetween(goal.startedYmd, todayYmd());
        const next = buildGoalProgress(goal, current);
        if (next.completed) {
          setCampaign(null);
          return;
        }
        setCampaign({ goal: goal.targetSteps, current: next.current, remaining: next.remaining });
      })();
    }, []),
  );

  const onPeriodChange = useCallback(
    (next: StepChartPeriod) => {
      void refresh(next);
    },
    [refresh],
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  const goalLine =
    bundle && period === '1d' ? Math.round(bundle.goal / 12) : undefined;

  return (
    <View style={{ flex: 1, backgroundColor: FIGMA_STEPS.pageBg, paddingTop: insets.top }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 16,
          paddingVertical: 8,
          minHeight: 56,
        }}
      >
        <Pressable accessibilityRole="button" onPress={() => router.back()} hitSlop={12}>
          <ArrowLeft size={24} color={FIGMA_STEPS.textPrimary} strokeWidth={2.2} />
        </Pressable>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              backgroundColor: FIGMA_STEPS.brandQuaternary,
              borderWidth: 1,
              borderColor: FIGMA_STEPS.brandLight,
              borderRadius: 10,
              paddingHorizontal: 10,
              paddingVertical: 6,
            }}
          >
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: FIGMA_STEPS.brand }} />
            <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 14, color: FIGMA_STEPS.brand }}>
              {ka.steps.optimalBadge}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/health-metrics/steps/goal' as never)}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: FIGMA_STEPS.brand,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Plus size={22} color="#FFFFFF" strokeWidth={2.5} />
          </Pressable>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={FIGMA_STEPS.brand} />
        }
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
      >
        <View style={{ paddingHorizontal: 16, paddingBottom: 16, gap: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
            <Footprints size={40} color={FIGMA_STEPS.brand} strokeWidth={2.2} />
            <Text
              style={{
                fontFamily: 'NotoSansGeorgian_700Bold',
                fontSize: 48,
                lineHeight: 52,
                color: FIGMA_STEPS.textPrimary,
                letterSpacing: -0.75,
              }}
            >
              {formatStepsCount(bundle?.todayTotal ?? 0)}
            </Text>
            <Text
              style={{
                fontFamily: 'NotoSansGeorgian_400Regular',
                fontSize: 22,
                lineHeight: 32,
                color: FIGMA_STEPS.textSecondary,
                paddingBottom: 4,
              }}
            >
              {ka.steps.unit}
            </Text>
          </View>
          <Text
            style={{
              fontFamily: 'NotoSansGeorgian_400Regular',
              fontSize: 16,
              lineHeight: 22,
              color: FIGMA_STEPS.textSecondary,
            }}
          >
            {bundle?.statusKa ?? ka.healthMetrics.noData}
          </Text>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, paddingTop: 4 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Footprints size={18} color={FIGMA_STEPS.textSecondary} strokeWidth={2} />
              <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 13, color: FIGMA_STEPS.textSecondary }}>
                {ka.steps.remaining(formatStepsCount(bundle?.remaining ?? 0))}
              </Text>
            </View>
            <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: FIGMA_STEPS.border }} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <ArrowUp size={18} color={FIGMA_STEPS.textSecondary} strokeWidth={2} />
              <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 13, color: FIGMA_STEPS.textSecondary }}>
                {ka.steps.peak(formatStepsCount(bundle?.peakHourly ?? 0))}
              </Text>
            </View>
            <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: FIGMA_STEPS.border }} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <LayoutList size={18} color={FIGMA_STEPS.textSecondary} strokeWidth={2} />
              <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 13, color: FIGMA_STEPS.textSecondary }}>
                {ka.steps.logsCount(bundle?.logCount ?? 0)}
              </Text>
            </View>
          </View>
        </View>

        <View style={{ paddingHorizontal: 16, paddingBottom: 8, gap: 12 }}>
          {loading && !bundle ? (
            <View style={{ height: 200, alignItems: 'center', justifyContent: 'center' }}>
              <ActivityIndicator color={FIGMA_STEPS.brand} />
            </View>
          ) : (
            <StepsBarChart bars={bundle?.chartBars ?? []} goalLine={goalLine} />
          )}
          <StepsPeriodTabs value={period} onChange={onPeriodChange} />
        </View>

        {bundle ? (
          <>
            <StepsSection title={ka.steps.goalTitle}>
              <Pressable onPress={() => router.push('/health-metrics/steps/goal' as never)}>
                <StepsGoalCard
                  goal={campaign?.goal ?? bundle.goal}
                  current={campaign?.current ?? bundle.todayTotal}
                  remaining={campaign?.remaining ?? bundle.remaining}
                />
              </Pressable>
            </StepsSection>

            <StepsSection title={ka.stepsGoal.reachedTitle}>
              <StepsReachedGoalsList records={reached} />
            </StepsSection>

            <StepsSection title={ka.steps.insightTitle} actionLabel={ka.common.seeAll}>
              <StepsInsightGrid insights={bundle.insights} />
            </StepsSection>

            <StepsSection
              title={ka.steps.historyTitle}
              actionLabel={ka.common.seeAll}
              onAction={() => router.push('/health-metrics/steps/history' as never)}
            >
              <View style={{ gap: 8 }}>
                {bundle.historyPreview.length ? (
                  bundle.historyPreview.map((log) => <StepsHistoryRow key={log.id} log={log} />)
                ) : (
                  <Text
                    style={{
                      fontFamily: 'NotoSansGeorgian_400Regular',
                      fontSize: 14,
                      color: FIGMA_STEPS.textSecondary,
                      textAlign: 'center',
                      paddingVertical: 16,
                    }}
                  >
                    {ka.healthMetrics.noData}
                  </Text>
                )}
              </View>
            </StepsSection>

            <StepsSection title={ka.steps.aiTitle} actionLabel={ka.common.seeAll}>
              <View
                style={{
                  backgroundColor: FIGMA_STEPS.cardBg,
                  borderRadius: FIGMA_STEPS.cardRadius,
                  borderWidth: 1,
                  borderColor: FIGMA_STEPS.border,
                  padding: 16,
                  minHeight: 120,
                  justifyContent: 'flex-end',
                }}
              >
                <View
                  style={{
                    alignSelf: 'flex-start',
                    backgroundColor: FIGMA_STEPS.brandQuaternary,
                    borderRadius: 8,
                    paddingHorizontal: 8,
                    paddingVertical: 4,
                    marginBottom: 8,
                  }}
                >
                  <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 12, color: FIGMA_STEPS.brand }}>
                    {ka.steps.aiTag}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Sparkles size={16} color={FIGMA_STEPS.brand} strokeWidth={2} />
                  <Text
                    style={{
                      flex: 1,
                      fontFamily: 'NotoSansGeorgian_600SemiBold',
                      fontSize: 14,
                      lineHeight: 20,
                      color: FIGMA_STEPS.textPrimary,
                    }}
                  >
                    {ka.steps.aiTip}
                  </Text>
                </View>
              </View>
            </StepsSection>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}
