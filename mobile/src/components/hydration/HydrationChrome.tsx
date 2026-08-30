import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { ChevronLeft, Plus } from 'lucide-react-native';
import { useFigmaHydration } from '@/constants/figmaHydrationLayout';
import { ka } from '@/i18n/ka';
import { hydrationLevel } from '@/lib/hydration';
import type { StepChartPeriod } from '@/types/stepsMetrics';

const PERIODS: StepChartPeriod[] = ['1d', '1w', '1m', '1y', 'all'];

export function HydrationAppBar({
  onBack,
  onAdd,
  todayMl,
  goalMl,
  title,
}: {
  onBack: () => void;
  onAdd?: () => void;
  todayMl?: number;
  goalMl?: number;
  title?: string;
}) {
  const T = useFigmaHydration();
  const hydrated = todayMl != null && goalMl != null && hydrationLevel(todayMl, goalMl) >= 4;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 8, minHeight: 56 }}>
      <Pressable accessibilityRole="button" onPress={onBack} hitSlop={12}>
        <ChevronLeft size={24} color={T.textPrimary} strokeWidth={2.2} />
      </Pressable>
      {title ? (
        <Text style={{ flex: 1, textAlign: 'center', fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 18, color: T.textPrimary }}>
          {title}
        </Text>
      ) : (
        <View style={{ flex: 1 }} />
      )}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        {todayMl != null && goalMl != null ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              backgroundColor: T.brandQuaternary,
              borderWidth: 1,
              borderColor: T.brandLight,
              borderRadius: 10,
              paddingHorizontal: 10,
              paddingVertical: 6,
              ...T.shadowXs,
            }}
          >
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: T.brand }} />
            <Text style={{ fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 14, color: T.brand }}>
              {hydrated ? ka.hydration.badgeHydrated : ka.hydration.badgeLow}
            </Text>
          </View>
        ) : null}
        {onAdd ? (
          <Pressable
            accessibilityRole="button"
            onPress={onAdd}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: T.brand,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Plus size={24} color="#FFFFFF" strokeWidth={2.4} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

/** Figma 9017:196580 — hydration hub tabs only. Do not reuse on steps. */
export function HydrationPeriodTabs({
  value,
  onChange,
}: {
  value: StepChartPeriod;
  onChange: (period: StepChartPeriod) => void;
}) {
  const T = useFigmaHydration();
  return (
    <View
      style={{
        flexDirection: 'row',
        height: 40,
        backgroundColor: T.tabTrack,
        borderRadius: 14,
        padding: 4,
      }}
    >
      {PERIODS.map((period) => {
        const active = period === value;
        return (
          <Pressable
            key={period}
            accessibilityRole="button"
            onPress={() => onChange(period)}
            style={{
              flex: 1,
              borderRadius: 10,
              backgroundColor: active ? T.tabActive : 'transparent',
              alignItems: 'center',
              justifyContent: 'center',
              ...(active ? T.shadowMd : null),
            }}
          >
            <Text
              style={{
                fontFamily: 'NotoSansGeorgian_600SemiBold',
                fontSize: 14,
                lineHeight: 20,
                color: active ? T.textPrimary : T.textSecondary,
              }}
            >
              {ka.steps.periods[period]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
