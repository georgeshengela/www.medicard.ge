import React from 'react';
import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

/** `#RRGGBB` + alpha 0–1 → `#RRGGBBAA`. */
export function withAlpha(hex: string, a: number): string {
  return `${hex}${Math.round(a * 255).toString(16).padStart(2, '0')}`;
}

/**
 * The module hero card's concentric rings drawn as thin strokes from a tile's top-right corner — the
 * „reverse“ brand tile (owner 2026-10-04: modules sheet, Home challenges). The parent clips (overflow hidden).
 */
export function OutlineRings({ ink, dark, size }: { ink: string; dark: boolean; size: number }) {
  const o = dark ? 1.25 : 1;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, right: 0, width: size, height: size }}>
      <Svg width={size} height={size}>
        <Circle cx={size} cy={0} r={size * 0.32} stroke={ink} strokeOpacity={0.22 * o} strokeWidth={1.2} fill="none" />
        <Circle cx={size} cy={0} r={size * 0.56} stroke={ink} strokeOpacity={0.14 * o} strokeWidth={1.2} fill="none" />
        <Circle cx={size} cy={0} r={size * 0.8} stroke={ink} strokeOpacity={0.08 * o} strokeWidth={1.2} fill="none" />
      </Svg>
    </View>
  );
}
