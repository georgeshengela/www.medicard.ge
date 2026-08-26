import React from 'react';
import { Text, View } from 'react-native';
import { Clock, Flame, Footprints, Timer } from 'lucide-react-native';
import { FIGMA_STEPS } from '@/constants/figmaStepsLayout';
import { ka } from '@/i18n/ka';
import type { StepsInsights } from '@/types/stepsMetrics';

type Props = {
  insights: StepsInsights;
};

const ITEMS = [
  { key: 'activeMinutes' as const, icon: Timer, label: () => ka.steps.insightActiveMinutes },
  { key: 'mostActiveTime' as const, icon: Clock, label: () => ka.steps.insightMostActive },
  { key: 'streakDays' as const, icon: Flame, label: () => ka.steps.insightStreak },
  { key: 'distanceKm' as const, icon: Footprints, label: () => ka.steps.insightDistance },
];

function formatValue(key: keyof StepsInsights, insights: StepsInsights): string {
  switch (key) {
    case 'activeMinutes':
      return ka.steps.minutesValue(insights.activeMinutes);
    case 'mostActiveTime':
      return insights.mostActiveTime;
    case 'streakDays':
      return ka.steps.daysValue(insights.streakDays);
    case 'distanceKm':
      return ka.steps.kmValue(insights.distanceKm);
    default:
      return '—';
  }
}

export function StepsInsightGrid({ insights }: Props) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {ITEMS.map(({ key, icon: Icon, label }) => (
        <View
          key={key}
          style={{
            width: '48%',
            flexGrow: 1,
            backgroundColor: FIGMA_STEPS.cardBg,
            borderRadius: FIGMA_STEPS.cardRadius,
            borderWidth: 1,
            borderColor: FIGMA_STEPS.border,
            padding: 14,
            gap: 8,
          }}
        >
          <Icon size={20} color={FIGMA_STEPS.brand} strokeWidth={2.2} />
          <Text
            style={{
              fontFamily: 'NotoSansGeorgian_400Regular',
              fontSize: 12,
              color: FIGMA_STEPS.textSecondary,
            }}
          >
            {label()}
          </Text>
          <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 18, color: FIGMA_STEPS.textPrimary }}>
            {formatValue(key, insights)}
          </Text>
        </View>
      ))}
    </View>
  );
}
