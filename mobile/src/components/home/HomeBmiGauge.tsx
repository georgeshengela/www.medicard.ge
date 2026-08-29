import React, { useMemo } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import {
  BMI_GAUGE_MAX,
  BMI_GAUGE_MIN,
  BMI_ZONE_COLORS,
  bmiGaugeT,
  type BmiCategory,
} from '@/lib/bmi';

const WIDTH = 148;
const HEIGHT = 92;
const CX = WIDTH / 2;
const CY = 78;
const RADIUS = 62;
const STROKE = 11;

type Zone = { from: number; to: number; color: string };

const ZONES: Zone[] = [
  { from: BMI_GAUGE_MIN, to: 18.5, color: BMI_ZONE_COLORS.underweight },
  { from: 18.5, to: 25, color: BMI_ZONE_COLORS.normal },
  { from: 25, to: 30, color: BMI_ZONE_COLORS.overweight },
  { from: 30, to: BMI_GAUGE_MAX, color: BMI_ZONE_COLORS.obese },
];

function polar(angle: number, radius: number) {
  return {
    x: CX + radius * Math.cos(angle),
    y: CY - radius * Math.sin(angle),
  };
}

function angleFor(bmi: number) {
  return Math.PI * (1 - bmiGaugeT(bmi));
}

function arcPath(fromBmi: number, toBmi: number, radius: number) {
  const start = polar(angleFor(fromBmi), radius);
  const end = polar(angleFor(toBmi), radius);
  return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${radius} ${radius} 0 0 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
}

type Props = {
  bmi: number | null;
  category: BmiCategory | null;
};

export function HomeBmiGauge({ bmi, category }: Props) {
  const needle = useMemo(() => {
    if (bmi == null) return null;
    const angle = angleFor(bmi);
    const tip = polar(angle, RADIUS - 6);
    return { angle, tip };
  }, [bmi]);

  const accent = category ? BMI_ZONE_COLORS[category] : '#14B8A6';

  return (
    <View style={{ width: WIDTH, height: HEIGHT }}>
      <Svg width={WIDTH} height={HEIGHT}>
        <Path
          d={arcPath(BMI_GAUGE_MIN, BMI_GAUGE_MAX, RADIUS)}
          stroke="#E5E7EB"
          strokeWidth={STROKE + 4}
          strokeLinecap="round"
          fill="none"
        />
        {ZONES.map((zone) => (
          <Path
            key={zone.color}
            d={arcPath(zone.from, zone.to, RADIUS)}
            stroke={zone.color}
            strokeWidth={STROKE}
            strokeLinecap="butt"
            fill="none"
            opacity={0.92}
          />
        ))}
        {needle ? (
          <>
            <Line
              x1={CX}
              y1={CY}
              x2={needle.tip.x}
              y2={needle.tip.y}
              stroke={accent}
              strokeWidth={3}
              strokeLinecap="round"
            />
            <Circle cx={CX} cy={CY} r={7} fill="#FFFFFF" stroke={accent} strokeWidth={3} />
            <Circle cx={needle.tip.x} cy={needle.tip.y} r={4} fill={accent} />
          </>
        ) : (
          <Circle cx={CX} cy={CY} r={6} fill="#FFFFFF" stroke="#D1D5DB" strokeWidth={2} />
        )}
      </Svg>
    </View>
  );
}
