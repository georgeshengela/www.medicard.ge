import React from 'react';
import { Text, View } from 'react-native';
import { GEO } from '@/components/tbilisiMoves/copyStyles';
import { rankTone } from '@/components/tbilisiMoves/tbilisiMovesRank';
import { useIsDark, useThemeColors } from '@/theme/colors';

export function TbilisiMovesRankBadge({
  rank,
  size = 36,
}: {
  rank: number | null | undefined;
  size?: number;
}) {
  const colors = useThemeColors();
  const dark = useIsDark();
  const tone = rankTone(rank, dark);
  const placed = rank != null && rank >= 1;
  const fontSize = size >= 40 ? 16 : size >= 32 ? 14 : 12;

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: tone?.fill || colors.bg200,
        borderWidth: tone ? 1.5 : 1,
        borderColor: tone?.ring || colors.bg300,
        flexShrink: 0,
      }}
    >
      <Text
        style={{
          fontFamily: GEO.title,
          fontSize,
          lineHeight: fontSize + 4,
          color: tone?.ink || colors.text200,
        }}
      >
        {placed ? rank : '—'}
      </Text>
    </View>
  );
}
