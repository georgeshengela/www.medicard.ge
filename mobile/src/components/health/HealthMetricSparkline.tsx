import React, { useId, useMemo } from 'react';
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import type { HealthMetricKey } from '@/types/healthMetrics';

type ChartKind = 'line' | 'bar' | 'step' | 'dots';

type Props = {
  values: (number | null)[];
  color: string;
  kind?: ChartKind;
  width?: number;
  height?: number;
  compareValues?: (number | null)[];
};

function lagSeries(values: (number | null)[]): (number | null)[] {
  if (values.length < 2) return values;
  return [values[0], ...values.slice(0, -1)];
}

function normalizeTogether(main: (number | null)[], extra?: (number | null)[]): {
  main: number[];
  extra: number[] | null;
} {
  const combined = extra ? [...main, ...extra] : main;
  const nums = combined.map((v) => (v == null ? 0 : v));
  const positives = combined.filter((v): v is number => v != null && v > 0);
  const max = Math.max(...nums, 1);
  const min = positives.length ? Math.min(...positives) : max;
  const span = Math.max(max - min, 1);
  const map = (series: (number | null)[]) =>
    series.map((v) => (v == null || v <= 0 ? 0.08 : 0.12 + ((v - min) / span) * 0.88));
  return { main: map(main), extra: extra ? map(extra) : null };
}

export function HealthMetricSparkline({
  values,
  color,
  kind = 'line',
  width = 120,
  height = 56,
  compareValues,
}: Props) {
  const gradientId = `spark-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const compare =
    compareValues ?? (kind === 'line' && values.length >= 2 ? lagSeries(values) : undefined);
  const { main: norm, extra: compareNorm } = useMemo(
    () => normalizeTogether(values, compare),
    [compare, values],
  );
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

  if (!values.length) {
    return <Svg width={width} height={height} />;
  }

  const toPoints = (heights: number[]) =>
    heights.map((h, i) => ({
      x: pad + i * step,
      y: pad + innerH * (1 - h),
    }));

  const points = toPoints(norm);
  const comparePoints = compareNorm ? toPoints(compareNorm) : null;

  const toLine = (pts: { x: number; y: number }[]) =>
    pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');

  const linePath = toLine(points);
  const comparePath = comparePoints ? toLine(comparePoints) : null;
  const areaPath = `${linePath} L ${points[points.length - 1]?.x ?? pad} ${pad + innerH} L ${points[0]?.x ?? pad} ${pad + innerH} Z`;

  return (
    <Svg width={width} height={height}>
      <Defs>
        <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={color} stopOpacity="0.28" />
          <Stop offset="1" stopColor={color} stopOpacity="0" />
        </LinearGradient>
      </Defs>
      {kind === 'line' || kind === 'step' ? (
        <Path d={areaPath} fill={`url(#${gradientId})`} />
      ) : null}
      {kind === 'step' ? <Path d={areaPath} fill={color} opacity={0.12} /> : null}
      {comparePath ? (
        <Path
          d={comparePath}
          stroke={color}
          strokeWidth={2}
          fill="none"
          opacity={0.35}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
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
