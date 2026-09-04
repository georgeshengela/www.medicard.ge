import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { ChevronRight, Scale } from 'lucide-react-native';
import { HomeBmiZoneBar } from '@/components/home/HomeBmiGauge';
import { HomeSectionTitle } from '@/components/home/HomeSectionTitle';
import { HomeWeightLogSheet } from '@/components/home/HomeWeightLogSheet';
import { MetricCardSkeleton } from '@/components/ui/Skeleton';
import { useFigmaHealthMetrics } from '@/constants/figmaHealthMetricsLayout';
import { useHealthMetrics } from '@/hooks/useHealthMetrics';
import { ka } from '@/i18n/ka';
import {
  BMI_ZONE_COLORS,
  bmiCategory,
  bmiFromWeight,
  healthyWeightRangeKg,
  kgFromHealthyRange,
  weightDeltaKg,
} from '@/lib/bmi';
import { useAuth } from '@/store/AuthContext';
import type { HealthProfile } from '@/lib/api';

type Props = {
  profile: HealthProfile | null | undefined;
};

export function HomeBmiWeightSection({ profile }: Props) {
  const tokens = useFigmaHealthMetrics();
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
  const heightCm = profile?.heightCm ?? null;
  const bmi = bmiFromWeight(value, heightCm) ?? profile?.bmi ?? null;
  const category = bmi != null ? bmiCategory(bmi) : null;
  const accent = category ? BMI_ZONE_COLORS[category] : tokens.brand;
  const weekValues = weight?.weekValues ?? [];
  const initialKg = value ?? 70;
  const range = heightCm != null ? healthyWeightRangeKg(heightCm) : null;
  const delta = value != null ? weightDeltaKg(weekValues, value) : null;

  const detail = useMemo(() => {
    if (value == null) return ka.home.bmi.emptyTitle;
    if (bmi == null || !range || heightCm == null) return ka.home.bmi.noHeight;
    const label = category ? ka.home.bmi.categories[category] : ka.home.bmi.bmiTitle;
    const offset = kgFromHealthyRange(value, heightCm);
    const band =
      offset === 0
        ? `${range.min}–${range.max} ${ka.home.bmi.kg}`
        : offset < 0
          ? ka.home.bmi.belowHealthy(-offset)
          : ka.home.bmi.aboveHealthy(offset);
    const trend =
      delta == null
        ? null
        : delta > 0
          ? ka.home.bmi.trendUp(delta)
          : delta < 0
            ? ka.home.bmi.trendDown(-delta)
            : null;
    return [label, band, trend].filter(Boolean).join(' · ');
  }, [bmi, category, delta, heightCm, range, value]);

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
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${ka.healthMetrics.metrics.weight} ${value != null ? `${value.toFixed(1)} ${ka.home.bmi.kg}` : ka.home.bmi.emptyTitle}${bmi != null ? `, BMI ${bmi.toFixed(1)}` : ''}`}
          onPress={openSheet}
          style={{
            backgroundColor: tokens.cardBg,
            borderRadius: tokens.cardRadius,
            borderWidth: 1,
            borderColor: tokens.border,
            padding: 16,
            gap: 16,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Scale size={20} color={tokens.weight} strokeWidth={2.2} />
              <Text
                style={{
                  flex: 1,
                  fontFamily: 'NotoSansGeorgian_600SemiBold',
                  fontSize: 14,
                  lineHeight: 20,
                  color: tokens.textPrimary,
                }}
              >
                {ka.healthMetrics.metrics.weight}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text
                style={{
                  fontFamily: 'NotoSansGeorgian_400Regular',
                  fontSize: 12,
                  color: tokens.textSecondary,
                }}
              >
                {weight?.updatedLabel ?? ka.healthMetrics.today}
              </Text>
              <ChevronRight size={20} color={tokens.textSecondary} strokeWidth={2} />
            </View>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56 }}>
            <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 2 }}>
                <Text
                  style={{
                    fontFamily: 'NotoSansGeorgian_700Bold',
                    fontSize: 24,
                    lineHeight: 32,
                    color: tokens.textPrimary,
                    letterSpacing: -0.25,
                  }}
                >
                  {value != null ? value.toFixed(1) : '—'}
                </Text>
                {value != null ? (
                  <Text
                    style={{
                      fontFamily: 'NotoSansGeorgian_500Medium',
                      fontSize: 14,
                      lineHeight: 20,
                      color: tokens.textPrimary,
                      paddingBottom: 2,
                    }}
                  >
                    {ka.home.bmi.kg}
                  </Text>
                ) : null}
              </View>
              <Text
                numberOfLines={1}
                style={{
                  fontFamily: 'NotoSansGeorgian_400Regular',
                  fontSize: 12,
                  lineHeight: 16,
                  color: accent,
                }}
              >
                {detail}
              </Text>
            </View>

            <View style={{ width: 108, height: 56, alignItems: 'center', justifyContent: 'center' }}>
              <Text
                style={{
                  fontFamily: 'NotoSansGeorgian_600SemiBold',
                  fontSize: 10,
                  lineHeight: 12,
                  color: tokens.textSecondary,
                  letterSpacing: 0.6,
                }}
              >
                {ka.home.bmi.bmiTitle}
              </Text>
              <Text
                style={{
                  fontFamily: 'NotoSansGeorgian_700Bold',
                  fontSize: 22,
                  lineHeight: 26,
                  color: bmi != null ? accent : tokens.textPrimary,
                  letterSpacing: -0.4,
                }}
              >
                {bmi != null ? bmi.toFixed(1) : '—'}
              </Text>
              <HomeBmiZoneBar bmi={bmi} category={category} width={108} />
            </View>
          </View>
        </Pressable>
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
