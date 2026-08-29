import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, ChevronRight, Footprints, Link2, Lock } from 'lucide-react-native';
import { HealthMetricCard } from '@/components/health/HealthMetricCard';
import { useFigmaHealthMetrics } from '@/constants/figmaHealthMetricsLayout';
import { useFigmaSteps } from '@/constants/figmaStepsLayout';
import { useHealthMetrics } from '@/hooks/useHealthMetrics';
import { useStepsMetrics } from '@/hooks/useStepsMetrics';
import { ka } from '@/i18n/ka';
import {
  connectDeviceHealth,
  getHealthPlatform,
  isHealthPlatformSupported,
} from '@/lib/healthMetrics';
import { formatStepsCount } from '@/lib/stepsMetrics.shared';
import { openHealthAppSettings, type HealthConnectResult } from '@/lib/healthSync';
import { useAuth } from '@/store/AuthContext';

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

/** Figma 8848:112415 — full health metrics dashboard. */
export default function HealthMetricsScreen() {
  const FIGMA_HEALTH_METRICS = useFigmaHealthMetrics();
  const FIGMA_STEPS = useFigmaSteps();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { healthProfile } = useAuth();
  const { bundle, loading, refresh } = useHealthMetrics(healthProfile);
  const { bundle: stepsBundle, refresh: refreshSteps } = useStepsMetrics('1d');
  const [connecting, setConnecting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const platform = getHealthPlatform();
  const platformLabel =
    platform === 'apple' ? ka.cycle.healthApple : platform === 'google' ? ka.cycle.healthGoogle : '';

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refresh(), refreshSteps()]);
    setRefreshing(false);
  }, [refresh, refreshSteps]);

  const connect = async () => {
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
  };

  return (
    <View style={{ flex: 1, backgroundColor: FIGMA_HEALTH_METRICS.pageBg, paddingTop: insets.top }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingVertical: 12,
        }}
      >
        <Pressable
          accessibilityRole="button"
          onPress={() => router.back()}
          hitSlop={12}
          style={{
            width: 40,
            height: 40,
            borderRadius: 999,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: FIGMA_HEALTH_METRICS.cardBg,
            borderWidth: 1,
            borderColor: FIGMA_HEALTH_METRICS.border,
          }}
        >
          <ArrowLeft size={20} color={FIGMA_HEALTH_METRICS.textPrimary} strokeWidth={2.2} />
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={FIGMA_HEALTH_METRICS.brand} />
        }
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
      >
        <View style={{ paddingHorizontal: 16, paddingBottom: 16, gap: 8 }}>
          <Text
            style={{
              fontFamily: 'NotoSansGeorgian_700Bold',
              fontSize: 30,
              lineHeight: 38,
              color: FIGMA_HEALTH_METRICS.textPrimary,
              letterSpacing: -0.25,
            }}
          >
            {ka.healthMetrics.title}
          </Text>
          <Text
            style={{
              fontFamily: 'NotoSansGeorgian_400Regular',
              fontSize: 16,
              lineHeight: 26,
              color: FIGMA_HEALTH_METRICS.textSecondary,
            }}
          >
            {ka.healthMetrics.subtitle}
          </Text>
        </View>

        <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/health-metrics/steps' as never)}
            style={{
              backgroundColor: FIGMA_STEPS.brandQuaternary,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: FIGMA_STEPS.brandLight,
              paddingHorizontal: 14,
              paddingVertical: 12,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Footprints size={22} color={FIGMA_STEPS.brand} strokeWidth={2.2} />
              <View>
                <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 14, color: FIGMA_STEPS.textPrimary }}>
                  {ka.steps.homePreview}
                </Text>
                <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 20, color: FIGMA_STEPS.textPrimary }}>
                  {formatStepsCount(stepsBundle?.todayTotal ?? 0)}
                </Text>
              </View>
            </View>
            <ChevronRight size={20} color={FIGMA_STEPS.brand} strokeWidth={2.2} />
          </Pressable>
        </View>

        {!bundle?.connected && isHealthPlatformSupported() ? (
          <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
            <Pressable
              accessibilityRole="button"
              onPress={() => void connect()}
              style={{
                backgroundColor: FIGMA_HEALTH_METRICS.brand,
                borderRadius: 16,
                paddingVertical: 14,
                paddingHorizontal: 16,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
              }}
            >
              {connecting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Link2 size={20} color="#FFFFFF" strokeWidth={2.2} />
                  <Text
                    style={{
                      fontFamily: 'NotoSansGeorgian_600SemiBold',
                      fontSize: 16,
                      color: '#FFFFFF',
                    }}
                  >
                    {ka.healthMetrics.connectTitle(platformLabel)}
                  </Text>
                </>
              )}
            </Pressable>
            {status ? (
              <Text
                style={{
                  fontFamily: 'NotoSansGeorgian_600SemiBold',
                  fontSize: 13,
                  color: FIGMA_HEALTH_METRICS.brand,
                  textAlign: 'center',
                  marginTop: 10,
                }}
              >
                {status}
              </Text>
            ) : null}
          </View>
        ) : null}

        <View style={{ paddingHorizontal: 16, paddingVertical: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text
              style={{
                fontFamily: 'NotoSansGeorgian_600SemiBold',
                fontSize: 16,
                color: FIGMA_HEALTH_METRICS.textPrimary,
              }}
            >
              {ka.healthMetrics.overview}
            </Text>
            <Text
              style={{
                fontFamily: 'NotoSansGeorgian_600SemiBold',
                fontSize: 14,
                color: FIGMA_HEALTH_METRICS.brand,
              }}
            >
              {ka.healthMetrics.cardView}
            </Text>
          </View>
        </View>

        {loading && !bundle ? (
          <View style={{ paddingVertical: 40, alignItems: 'center' }}>
            <ActivityIndicator color={FIGMA_HEALTH_METRICS.brand} />
          </View>
        ) : (
          <View style={{ paddingHorizontal: 16, gap: 6 }}>
            {bundle?.metrics.map((metric) => (
              <HealthMetricCard key={metric.key} metric={metric} compact />
            ))}
          </View>
        )}

        {Platform.OS === 'android' && bundle?.connected ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => openHealthAppSettings().catch(() => undefined)}
            style={{ paddingHorizontal: 16, paddingTop: 16 }}
          >
            <Text
              style={{
                fontFamily: 'NotoSansGeorgian_600SemiBold',
                fontSize: 14,
                color: FIGMA_HEALTH_METRICS.brand,
                textAlign: 'center',
              }}
            >
              {ka.cycle.healthOpenSettings}
            </Text>
          </Pressable>
        ) : null}

        <View
          style={{
            paddingHorizontal: 24,
            paddingTop: 24,
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: 8,
            justifyContent: 'center',
          }}
        >
          <Lock size={14} color={FIGMA_HEALTH_METRICS.textSecondary} strokeWidth={2} style={{ marginTop: 2 }} />
          <Text
            style={{
              flex: 1,
              fontFamily: 'NotoSansGeorgian_400Regular',
              fontSize: 12,
              lineHeight: 17,
              color: FIGMA_HEALTH_METRICS.textSecondary,
              textAlign: 'center',
            }}
          >
            {ka.healthMetrics.privacyNote}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
