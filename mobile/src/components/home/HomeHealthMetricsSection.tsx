import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Link2 } from 'lucide-react-native';
import { HomeSectionTitle } from '@/components/home/HomeSectionTitle';
import { HomeStepsAreaChart, type StepsDayPoint } from '@/components/home/HomeStepsAreaChart';
import { GoalDotsVertical, GoalTrendUp } from '@/components/health/steps-goal/StepsGoalIcons';
import { useFigmaHealthMetrics } from '@/constants/figmaHealthMetricsLayout';
import { useFigmaSteps } from '@/constants/figmaStepsLayout';
import { useStepsMetrics } from '@/hooks/useStepsMetrics';
import { ka } from '@/i18n/ka';
import {
  connectDeviceHealth,
  getHealthPlatform,
  isHealthPlatformSupported,
} from '@/lib/healthMetrics';
import { formatStepsCount } from '@/lib/stepsMetrics.shared';
import type { HealthConnectResult } from '@/lib/healthSync';
import type { HealthProfile } from '@/lib/api';

type Props = {
  profile: HealthProfile | null | undefined;
};

function explainFailure(result: Extract<HealthConnectResult, { ok: false }>): string {
  switch (result.reason) {
    case 'denied':
      return ka.cycle.healthDenied;
    case 'not_installed':
      return ka.cycle.healthNotInstalled;
    case 'expo_go':
      return ka.cycle.healthExpoGo;
    case 'unavailable':
      return ka.cycle.healthUnavailable;
    default:
      return result.message || ka.common.error;
  }
}

function weekdayIndex(date: Date) {
  return date.getDay() === 0 ? 6 : date.getDay() - 1;
}

export function HomeHealthMetricsSection({ profile: _profile }: Props) {
  const FIGMA_HEALTH_METRICS = useFigmaHealthMetrics();
  const FIGMA_STEPS = useFigmaSteps();
  const router = useRouter();
  const { bundle, loading, refresh } = useStepsMetrics('1w');
  const [connecting, setConnecting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const platform = getHealthPlatform();
  const platformLabel =
    platform === 'apple' ? ka.cycle.healthApple : platform === 'google' ? ka.cycle.healthGoogle : '';

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const connect = useCallback(async () => {
    setConnecting(true);
    setStatus(null);
    try {
      const result = await connectDeviceHealth();
      if (!result.ok) {
        setStatus(explainFailure(result));
        return;
      }
      setStatus(ka.cycle.healthConnected);
      await refresh();
    } finally {
      setConnecting(false);
    }
  }, [refresh]);

  const days = useMemo<StepsDayPoint[]>(() => {
    const bars = bundle?.chartBars ?? [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (!bars.length) {
      return Array.from({ length: 7 }, (_, index) => {
        const date = new Date(today);
        date.setDate(today.getDate() - (6 - index));
        return {
          label: ka.stepsGoal.weekdayShort[weekdayIndex(date)],
          value: 0,
          date,
        };
      });
    }
    return bars.map((bar, index) => {
      const date = new Date(today);
      date.setDate(today.getDate() - (bars.length - 1 - index));
      return {
        label: ka.stepsGoal.weekdayShort[weekdayIndex(date)] ?? bar.label,
        value: bar.value,
        date,
      };
    });
  }, [bundle?.chartBars]);

  const todayTotal = bundle?.todayTotal ?? 0;
  const previous = days.length >= 2 ? days[days.length - 2].value : 0;
  const trendPct = previous > 0 ? Math.round(((todayTotal - previous) / previous) * 1000) / 10 : null;
  const trendUp = trendPct == null ? true : trendPct >= 0;

  const openSteps = () => router.push('/health-metrics/steps' as never);

  return (
    <View style={{ paddingVertical: 4, gap: 8 }}>
      <HomeSectionTitle title={ka.home.activityTitle} style={{ marginHorizontal: 16, marginBottom: 0 }} />
      {!bundle?.connected && isHealthPlatformSupported() ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => void connect()}
          style={{
            marginHorizontal: 16,
            backgroundColor: FIGMA_HEALTH_METRICS.cardBg,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: FIGMA_HEALTH_METRICS.border,
            paddingHorizontal: 12,
            paddingVertical: 10,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <View
            style={{
              width: 32,
              height: 32,
              borderRadius: 10,
              backgroundColor: FIGMA_HEALTH_METRICS.brandQuaternary,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {connecting ? (
              <ActivityIndicator size="small" color={FIGMA_HEALTH_METRICS.brand} />
            ) : (
              <Link2 size={16} color={FIGMA_HEALTH_METRICS.brand} strokeWidth={2.2} />
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontFamily: 'NotoSansGeorgian_600SemiBold',
                fontSize: 13,
                color: FIGMA_HEALTH_METRICS.textPrimary,
              }}
            >
              {ka.healthMetrics.connectTitle(platformLabel)}
            </Text>
            {status ? (
              <Text
                style={{
                  fontFamily: 'NotoSansGeorgian_600SemiBold',
                  fontSize: 11,
                  color: FIGMA_HEALTH_METRICS.brand,
                  marginTop: 2,
                }}
              >
                {status}
              </Text>
            ) : null}
          </View>
        </Pressable>
      ) : null}

      {loading && !bundle ? (
        <View style={{ paddingVertical: 12, alignItems: 'center' }}>
          <ActivityIndicator size="small" color={FIGMA_HEALTH_METRICS.brand} />
        </View>
      ) : (
        <Pressable
          accessibilityRole="button"
          onPress={openSteps}
          style={{
            marginHorizontal: 16,
            backgroundColor: FIGMA_STEPS.cardBg,
            borderRadius: 24,
            borderWidth: 1,
            borderColor: FIGMA_STEPS.border,
            padding: 16,
            gap: 16,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.05,
            shadowRadius: 3,
            elevation: 1,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 16 }}>
            <View style={{ flex: 1, gap: 4 }}>
              <Text
                style={{
                  fontFamily: 'NotoSansGeorgian_700Bold',
                  fontSize: 24,
                  lineHeight: 32,
                  letterSpacing: -0.25,
                  color: FIGMA_STEPS.textPrimary,
                }}
              >
                {formatStepsCount(todayTotal)} {ka.steps.unit}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text
                  style={{
                    fontFamily: 'NotoSansGeorgian_400Regular',
                    fontSize: 14,
                    lineHeight: 20,
                    color: FIGMA_STEPS.textSecondary,
                  }}
                >
                  {bundle?.statusKa ?? ka.steps.statusLow}
                </Text>
                {trendPct != null ? (
                  <>
                    <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: FIGMA_STEPS.border }} />
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <View style={{ transform: [{ scaleY: trendUp ? 1 : -1 }] }}>
                        <GoalTrendUp size={18} color={trendUp ? '#22C55E' : '#F43F5E'} />
                      </View>
                      <Text
                        style={{
                          fontFamily: 'NotoSansGeorgian_600SemiBold',
                          fontSize: 14,
                          lineHeight: 20,
                          color: trendUp ? FIGMA_STEPS.trendUp : FIGMA_STEPS.trendDown,
                        }}
                      >
                        {Math.abs(trendPct)}%
                      </Text>
                    </View>
                  </>
                ) : null}
              </View>
            </View>
            <Pressable accessibilityRole="button" onPress={openSteps} hitSlop={8}>
              <GoalDotsVertical size={24} color={FIGMA_STEPS.textSecondary} />
            </Pressable>
          </View>

          <HomeStepsAreaChart days={days} />
        </Pressable>
      )}
    </View>
  );
}
