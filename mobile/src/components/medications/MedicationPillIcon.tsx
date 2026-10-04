import React from 'react';
import { View, type ViewStyle } from 'react-native';
import Svg, { ClipPath, Defs, Ellipse, G, Path, Rect } from 'react-native-svg';
import { PharmacyProductImage } from '@/components/pharmacy/PharmacyProductImage';
import { useThemeColors } from '@/theme/colors';
import type { PillShape } from '@/types/medications';
import { pillShapePath } from '@/lib/medications.shared';

type Props = {
  color?: string;
  shape?: PillShape;
  size?: number;
  /** Sit the artwork on a quiet round tile so it reads on any card. */
  border?: boolean;
  variant?: 'figma' | 'tinted';
  imageUrl?: string | null;
  style?: ViewStyle;
};

export function MedicationPillIcon({
  color = '#3B82F6',
  shape = 'long',
  size = 48,
  border,
  variant = 'figma',
  imageUrl,
  style,
}: Props) {
  const c = useThemeColors();

  if (imageUrl) {
    return (
      <View style={style}>
        <PharmacyProductImage uri={imageUrl} size={size} rounded={Math.max(10, Math.round(size * 0.22))} fit="cover" />
      </View>
    );
  }

  // Her pill in her colour (owner 2026-10-04: the grey placeholder art never showed the chosen colour):
  // the shape filled with the colour, a soft sheen, and a capsule's two halves — on a tile tinted
  // with the same colour. `variant` is kept for older callers; both draw this.
  void variant;
  const path = pillShapePath(shape);
  const light = isNearWhite(color);
  const capsule = shape === 'long' || shape === 'rectangle';
  const clipId = `pill-${shape}`;
  return (
    <View
      style={[
        {
          width: size,
          height: size,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: border ? 999 : size / 3.2,
          backgroundColor: light ? c.bg200 : `${color}1F`,
        },
        style,
      ]}
    >
      <Svg width={size * 0.66} height={size * 0.66} viewBox="0 0 24 24">
        <Defs>
          <ClipPath id={clipId}>
            <Path d={path} />
          </ClipPath>
        </Defs>
        <Path d={path} fill={color} stroke={light ? c.bg300 : 'none'} strokeWidth={light ? 1.2 : 0} />
        <G clipPath={`url(#${clipId})`}>
          {capsule ? <Rect x={12} y={0} width={12} height={24} fill="#FFFFFF" opacity={0.38} /> : null}
          <Ellipse cx={8} cy={7} rx={7} ry={3.2} fill="#FFFFFF" opacity={0.32} />
        </G>
      </Svg>
    </View>
  );
}

function isNearWhite(hex: string): boolean {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return false;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return (r * 299 + g * 587 + b * 114) / 1000 > 215;
}
