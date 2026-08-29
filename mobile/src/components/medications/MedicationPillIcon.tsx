import React from 'react';
import { Image, View, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { FIGMA_PILL_SHAPE_SOURCES } from '@/constants/medicationPillAssets';
import { FIGMA_MEDS, useFigmaMeds } from '@/constants/figmaMedicationsLayout';
import { PharmacyProductImage } from '@/components/pharmacy/PharmacyProductImage';
import type { PillShape } from '@/types/medications';
import { pillShapePath } from '@/lib/medications.shared';

type Props = {
  color?: string;
  shape?: PillShape;
  size?: number;
  border?: boolean;
  variant?: 'figma' | 'tinted';
  imageUrl?: string | null;
  style?: ViewStyle;
};

export function MedicationPillIcon({
  color = FIGMA_MEDS.brand,
  shape = 'long',
  size = 48,
  border,
  variant = 'figma',
  imageUrl,
  style,
}: Props) {
  const FIGMA_MEDS = useFigmaMeds();
  const source = FIGMA_PILL_SHAPE_SOURCES[shape] ?? FIGMA_PILL_SHAPE_SOURCES.long;

  if (imageUrl) {
    return (
      <View style={style}>
        <PharmacyProductImage uri={imageUrl} size={size} rounded={Math.max(10, Math.round(size * 0.22))} />
      </View>
    );
  }

  if (variant === 'figma') {
    return (
      <View
        style={[
          {
            width: size,
            height: size,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 999,
            backgroundColor: border ? FIGMA_MEDS.surface : 'transparent',
            borderWidth: border ? 1 : 0,
            borderColor: FIGMA_MEDS.border,
            overflow: 'hidden',
          },
          style,
        ]}
      >
        <Image source={source} style={{ width: size, height: size * 1.12 }} resizeMode="contain" />
      </View>
    );
  }

  const path = pillShapePath(shape);
  const fill = color === '#FFFFFF' ? '#FFFFFF' : color;

  return (
    <View
      style={[
        {
          width: size,
          height: size,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: size / 4,
          backgroundColor: color === '#FFFFFF' ? FIGMA_MEDS.cardBg : `${color}18`,
          borderWidth: border ? 1 : 0,
          borderColor: FIGMA_MEDS.border,
        },
        style,
      ]}
    >
      <Svg width={size * 0.65} height={size * 0.65} viewBox="0 0 24 24">
        <Path d={path} fill={fill} stroke={border ? FIGMA_MEDS.borderTertiary : 'none'} strokeWidth={border ? 1.5 : 0} />
      </Svg>
    </View>
  );
}
