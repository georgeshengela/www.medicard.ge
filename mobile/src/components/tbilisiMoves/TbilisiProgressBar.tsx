import React from 'react';
import { Text, View } from 'react-native';
import { GEO } from '@/components/tbilisiMoves/copyStyles';
import { formatGoalPct } from '@/lib/tbilisiMoves/format';
import { useThemeColors } from '@/theme/colors';

export function TbilisiProgressBar({ ratio, label }: { ratio: number; label?: string | null }) {
  const colors = useThemeColors();
  const fill = Math.max(0, Math.min(1, Number.isFinite(ratio) ? ratio : 0));
  const text = label === null ? null : label || `${formatGoalPct(ratio)}%`;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <View
        style={{
          flex: 1,
          height: 10,
          borderRadius: 999,
          backgroundColor: colors.bg200,
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            width: `${fill * 100}%`,
            height: 10,
            borderRadius: 999,
            backgroundColor: fill >= 1 ? colors.success : colors.primary200,
          }}
        />
      </View>
      {text ? (
        <Text
          style={{
            fontFamily: GEO.semibold,
            fontSize: 13,
            lineHeight: 18,
            color: colors.text200,
            minWidth: 44,
            textAlign: 'right',
          }}
        >
          {text}
        </Text>
      ) : null}
    </View>
  );
}
