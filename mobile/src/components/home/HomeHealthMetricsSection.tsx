import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { ChevronRight, Footprints, Link2, Lock } from 'lucide-react-native';
import { HealthMetricCard } from '@/components/health/HealthMetricCard';
import { FIGMA_HEALTH_METRICS } from '@/constants/figmaHealthMetricsLayout';
import { FIGMA_STEPS } from '@/constants/figmaStepsLayout';
import { useHealthMetrics } from '@/hooks/useHealthMetrics';
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
  onOpenAll: () => void;
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

export function HomeHealthMetricsSection({ profile, onOpenAll }: Props) {
  const router = useRouter();
  const { bundle, loading, refresh } = useHealthMetrics(profile);
  const { bundle: stepsBundle, refresh: refreshSteps } = useStepsMetrics('1d');
  const [connecting, setConnecting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const platform = getHealthPlatform();
  const platformLabel =
    platform === 'apple' ? ka.cycle.healthApple : platform === 'google' ? ka.cycle.healthGoogle : '';

  useFocusEffect(
    useCallback(() => {
      void refresh();
      void refreshSteps();
    }, [refresh, refreshSteps]),
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
      await Promise.all([refresh(), refreshSteps()]);
    } finally {
      setConnecting(false);
    }
  }, [refresh, refreshSteps]);

  const previewMetrics =
    bundle?.metrics.filter((m) => m.value != null).slice(0, 4) ?? bundle?.metrics.slice(0, 4) ?? [];

  return (
    <View style={{ paddingVertical: 4, gap: 8 }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 16,
        }}
      >
        <Text
          style={{
            fontFamily: 'NotoSansGeorgian_600SemiBold',
            fontSize: 14,
            color: FIGMA_HEALTH_METRICS.textPrimary,
          }}
        >
          {ka.healthMetrics.overview}
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={onOpenAll}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}
        >
          <Text
            style={{
              fontFamily: 'NotoSansGeorgian_600SemiBold',
              fontSize: 12,
              color: FIGMA_HEALTH_METRICS.brand,
            }}
          >
            {ka.common.seeAll}
          </Text>
          <ChevronRight size={16} color={FIGMA_HEALTH_METRICS.brand} strokeWidth={2.2} />
        </Pressable>
      </View>

      {!bundle?.connected && isHealthPlatformSupported() ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => void connect()}
          style={{
            marginHorizontal: 16,
            backgroundColor: '#FFFFFF',
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
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
        >
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/health-metrics/steps' as never)}
            style={{
              minWidth: 108,
              backgroundColor: FIGMA_STEPS.brandQuaternary,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: FIGMA_STEPS.brandLight,
              paddingHorizontal: 10,
              paddingVertical: 8,
              gap: 4,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Footprints size={14} color={FIGMA_STEPS.brand} strokeWidth={2.2} />
              <Text
                style={{
                  fontFamily: 'NotoSansGeorgian_600SemiBold',
                  fontSize: 11,
                  color: FIGMA_STEPS.textPrimary,
                }}
              >
                {ka.steps.homePreview}
              </Text>
            </View>
            <Text
              style={{
                fontFamily: 'NotoSansGeorgian_700Bold',
                fontSize: 16,
                color: FIGMA_STEPS.textPrimary,
              }}
            >
              {formatStepsCount(stepsBundle?.todayTotal ?? 0)}
            </Text>
          </Pressable>

          {previewMetrics.map((metric) => (
            <HealthMetricCard key={metric.key} metric={metric} mini onPress={onOpenAll} />
          ))}
        </ScrollView>
      )}

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 20, paddingTop: 2 }}>
        <Lock size={11} color={FIGMA_HEALTH_METRICS.textSecondary} strokeWidth={2} />
        <Text
          style={{
            flex: 1,
            fontFamily: 'NotoSansGeorgian_400Regular',
            fontSize: 10,
            lineHeight: 14,
            color: FIGMA_HEALTH_METRICS.textSecondary,
          }}
        >
          {ka.healthMetrics.privacyNote}
        </Text>
      </View>
    </View>
  );
}
