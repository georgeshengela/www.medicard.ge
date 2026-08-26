import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { FIGMA_STEPS } from '@/constants/figmaStepsLayout';
import { ka } from '@/i18n/ka';
import type { StepChartPeriod } from '@/types/stepsMetrics';

const PERIODS: StepChartPeriod[] = ['1d', '1w', '1m', '1y', 'all'];

type Props = {
  value: StepChartPeriod;
  onChange: (period: StepChartPeriod) => void;
};

export function StepsPeriodTabs({ value, onChange }: Props) {
  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: FIGMA_STEPS.cardBg,
        borderRadius: 12,
        padding: 4,
        gap: 2,
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
              paddingVertical: 8,
              borderRadius: 10,
              backgroundColor: active ? '#FFFFFF' : 'transparent',
              alignItems: 'center',
              shadowColor: active ? '#000' : 'transparent',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: active ? 0.06 : 0,
              shadowRadius: 2,
              elevation: active ? 1 : 0,
            }}
          >
            <Text
              style={{
                fontFamily: active ? 'NotoSansGeorgian_600SemiBold' : 'NotoSansGeorgian_400Regular',
                fontSize: 13,
                color: active ? FIGMA_STEPS.textPrimary : FIGMA_STEPS.textSecondary,
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
