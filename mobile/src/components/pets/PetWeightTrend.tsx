import React, { useMemo } from 'react';
import { Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { ka } from '@/i18n/ka';
import { formatCycleDateKa } from '@/lib/cycleCivilDateKa';
import type { PetWeightLog } from '@/lib/api';
import { sortWeightChronological, weightTrendAccessibleText } from '@/lib/petsHealth';
import { useThemeColors } from '@/theme/colors';

export function PetWeightTrend({ items }: { items: PetWeightLog[] }) {
  const colors = useThemeColors();
  const points = useMemo(() => sortWeightChronological(items), [items]);
  const label = weightTrendAccessibleText(points, formatCycleDateKa, ka.pets);

  if (!points.length) return null;

  if (points.length === 1) {
    return (
      <View accessible accessibilityRole="summary" accessibilityLabel={label} style={{ gap: 8 }}>
        <View
          style={{
            height: 88,
            borderRadius: 16,
            backgroundColor: colors.bg200,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: colors.primary200 }} />
        </View>
        <Text style={{ fontSize: 13, color: colors.text300 }}>{ka.pets.weightOnePoint}</Text>
      </View>
    );
  }

  const width = 320;
  const height = 96;
  const pad = 12;
  const kgs = points.map((row) => row.weightKg);
  const min = Math.min(...kgs);
  const max = Math.max(...kgs);
  const span = Math.max(max - min, 0.001);
  const coords = points.map((row, index) => {
    const x = pad + (index / (points.length - 1)) * (width - pad * 2);
    const y = pad + (1 - (row.weightKg - min) / span) * (height - pad * 2);
    return { x, y };
  });
  const line = coords.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' ');

  return (
    <View accessible accessibilityRole="summary" accessibilityLabel={label}>
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
        <Path d={line} stroke={colors.primary200} strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        {coords.map((point, index) => (
          <Circle key={points[index].id} cx={point.x} cy={point.y} r={4} fill={colors.primary200} />
        ))}
      </Svg>
    </View>
  );
}
