import React from 'react';
import { Text, View } from 'react-native';
import { useThemeColors } from '@/theme/colors';
import { formatGoalPct } from '@/lib/tbilisiMoves/format';

export function TbilisiProgressBar({ ratio, label }: { ratio: number; label?: string }) {
  const colors = useThemeColors();
  const fill = Math.max(0, Math.min(1, Number.isFinite(ratio) ? ratio : 0));
  const text = label || `${formatGoalPct(ratio)}%`;
  return (
    <View>
      <View
        style={{
          height: 10,
          borderRadius: 999,
          backgroundColor: colors.bg300,
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            width: `${fill * 100}%`,
            height: 10,
            borderRadius: 999,
            backgroundColor: colors.primary200,
          }}
        />
      </View>
      <Text
        style={{
          marginTop: 6,
          fontFamily: 'NotoSansGeorgian_600SemiBold',
          fontSize: 13,
          color: colors.text200,
        }}
      >
        {text}
      </Text>
    </View>
  );
}
