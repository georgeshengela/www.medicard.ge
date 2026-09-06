import React from 'react';
import { Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useFigmaWeight } from '@/constants/figmaWeightLayout';

/** Figma 8927:182138 — 64px circular track, +N% in the center. */
const SIZE = 64;
const STROKE = 6;

type Props = {
  percent: number;
  label: string;
};

export function WeightCircleProgress({ percent, label }: Props) {
  const T = useFigmaWeight();
  const r = (SIZE - STROKE) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, percent / 100));
  const dash = c * pct;

  return (
    <View style={{ width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={SIZE} height={SIZE} style={{ position: 'absolute' }}>
        <Circle cx={SIZE / 2} cy={SIZE / 2} r={r} stroke={T.track} strokeWidth={STROKE} fill="none" />
        <Circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={r}
          stroke={T.brand}
          strokeWidth={STROKE}
          fill="none"
          strokeDasharray={`${dash} ${c}`}
          strokeLinecap="round"
          rotation={-90}
          origin={`${SIZE / 2}, ${SIZE / 2}`}
        />
      </Svg>
      <Text
        style={{
          fontFamily: 'NotoSansGeorgian_600SemiBold',
          fontSize: 16,
          lineHeight: 22,
          color: T.textPrimary,
        }}
      >
        {label}
      </Text>
    </View>
  );
}
