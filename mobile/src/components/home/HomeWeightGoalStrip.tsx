import React from 'react';
import { Text, View } from 'react-native';
import { Target } from 'lucide-react-native';
import { useFigmaHealthMetrics } from '@/constants/figmaHealthMetricsLayout';
import { ka } from '@/i18n/ka';
import type { WeightGoalProgress } from '@/types/weightGoal';

type Props = {
  progress: WeightGoalProgress;
};

export function HomeWeightGoalStrip({ progress }: Props) {
  const tokens = useFigmaHealthMetrics();
  const pct = Math.max(0, Math.min(100, progress.percent));

  return (
    <View style={{ gap: 8, paddingTop: 4 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
          <Target size={14} color={tokens.brand} strokeWidth={2.2} />
          <Text
            numberOfLines={1}
            style={{
              flex: 1,
              fontFamily: 'NotoSansGeorgian_600SemiBold',
              fontSize: 12,
              lineHeight: 16,
              color: tokens.textPrimary,
            }}
          >
            {ka.weight.goalProgress}
          </Text>
        </View>
        <Text
          style={{
            fontFamily: 'NotoSansGeorgian_600SemiBold',
            fontSize: 12,
            lineHeight: 16,
            color: tokens.brand,
          }}
        >
          {ka.weightGoal.homeGoalCompact(pct, String(progress.goal.targetKg))}
        </Text>
      </View>
      <View
        style={{
          height: 6,
          borderRadius: 99,
          backgroundColor: tokens.border,
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            width: `${Math.max(6, pct)}%`,
            height: 6,
            borderRadius: 99,
            backgroundColor: tokens.brand,
          }}
        />
      </View>
    </View>
  );
}
