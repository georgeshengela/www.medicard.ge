import React from 'react';
import { View } from 'react-native';
import { QUEST } from '@/theme/questTokens';
import { useThemeColors } from '@/theme/colors';
import { progressBarFill } from '@/lib/quest/logic.js';

export function QuestProgressBar({
  percent,
  height = QUEST.barDaily,
  color,
  near,
}: {
  percent: number;
  height?: number;
  color?: string;
  near?: boolean;
}) {
  const colors = useThemeColors();
  const fillState = progressBarFill(percent);
  const fill = color || (near ? QUEST.accent.movement : colors.primary200);
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: fillState.value }}
      style={{
        height,
        borderRadius: 999,
        backgroundColor: colors.bg300,
        overflow: 'hidden',
      }}
    >
      {fillState.visible ? (
        <View
          style={{
            width: `${fillState.widthPercent}%`,
            minWidth: fillState.minFill ? height : undefined,
            maxWidth: '100%',
            height: '100%',
            borderRadius: 999,
            backgroundColor: fill,
          }}
        />
      ) : null}
    </View>
  );
}
