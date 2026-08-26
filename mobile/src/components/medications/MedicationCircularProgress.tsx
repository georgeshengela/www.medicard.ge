import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { MedicationPillIcon } from '@/components/medications/MedicationPillIcon';
import { FIGMA_MEDS } from '@/constants/figmaMedicationsLayout';
import type { PillShape } from '@/types/medications';

type Props = {
  progress: number;
  size?: number;
  color?: string;
  shape?: PillShape;
  pillColor?: string;
};

export function MedicationCircularProgress({
  progress,
  size = 64,
  color = FIGMA_MEDS.brand,
  shape = 'long',
  pillColor,
}: Props) {
  const stroke = 5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, progress));
  const dash = c * pct;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={FIGMA_MEDS.border} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={`${dash} ${c}`}
          strokeLinecap="round"
          rotation={-90}
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      <MedicationPillIcon color={pillColor ?? color} shape={shape} size={size * 0.55} />
    </View>
  );
}

export function MedicationProgressTrack({ width = 288, height = 92 }: { width?: number; height?: number }) {
  return (
    <View style={{ width, height, borderRadius: FIGMA_MEDS.cardRadiusMd, overflow: 'hidden' }}>
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <Path d={`M0 0h${width}v${height}H0z`} fill={FIGMA_MEDS.white} />
      </Svg>
    </View>
  );
}
