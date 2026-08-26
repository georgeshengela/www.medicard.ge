import React, { useMemo } from 'react';
import { View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import type { HealthMetricKey } from '@/types/healthMetrics';

type ChartKind = 'line' | 'bar' | 'step' | 'dots';

type Props = {
  values: (number | null)[];
  color: string;
  kind?: ChartKind;
  width?: number;
  height?: number;
};

function normalize(values: (number | null)[]): number[] {
  const nums = values.map((v) => (v == null ? 0 : v));
  const max = Math.max(...nums, 1);
  const min = Math.min(...nums.filter((v) => v > 0), max);
  const span = Math.max(max - min, 1);
  return nums.map((v) => (v <= 0 ? 0.08 : 0.12 + ((v - min) / span) * 0.88));
}

export function HealthMetricSparkline({
  values,
  color,
  kind = 'line',
  width = 120,
  height = 56,
}: Props) {
  const norm = useMemo(() => normalize(values), [values]);
  const pad = 4;
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;
  const step = innerW / Math.max(values.length - 1, 1);

  if (kind === 'bar') {
    const barW = innerW / values.length - 2;
    return (
      <Svg width={width} height={height}>
        {norm.map((h, i) => (
          <Rect
            key={i}
            x={pad + i * (barW + 2)}
            y={pad + innerH * (1 - h)}
            width={barW}
            height={Math.max(innerH * h, 2)}
            rx={3}
            fill={color}
            opacity={values[i] == null ? 0.25 : 0.85}
          />
        ))}
      </Svg>
    );
  }

  if (kind === 'dots') {
    const dot = innerW / values.length;
    return (
      <Svg width={width} height={height}>
        {norm.map((h, i) => (
          <Rect
            key={i}
            x={pad + i * dot + dot / 2 - 3}
            y={pad + innerH * (1 - h) - 3}
            width={6}
            height={6}
            rx={3}
            fill={color}
            opacity={values[i] == null ? 0.2 : 0.9}
          />
        ))}
      </Svg>
    );
  }

  const points = norm.map((h, i) => ({
    x: pad + i * step,
    y: pad + innerH * (1 - h),
  }));

  const linePath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ');

  const areaPath = `${linePath} L ${points[points.length - 1]?.x ?? pad} ${pad + innerH} L ${points[0]?.x ?? pad} ${pad + innerH} Z`;

  return (
    <Svg width={width} height={height}>
      {kind === 'step' ? (
        <Path d={areaPath} fill={color} opacity={0.18} />
      ) : null}
      <Path
        d={linePath}
        stroke={color}
        strokeWidth={2}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function metricChartKind(key: HealthMetricKey): ChartKind {
  switch (key) {
    case 'bloodPressure':
    case 'hydration':
      return 'bar';
    case 'nutrition':
      return 'dots';
    case 'heartRate':
      return 'step';
    default:
      return 'line';
  }
}
