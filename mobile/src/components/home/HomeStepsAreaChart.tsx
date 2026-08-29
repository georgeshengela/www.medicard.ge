import React, { useMemo, useState } from 'react';
import { LayoutChangeEvent, Pressable, Text, View } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop } from 'react-native-svg';
import { useFigmaSteps } from '@/constants/figmaStepsLayout';
import { ka } from '@/i18n/ka';
import { formatStepsCount } from '@/lib/stepsMetrics.shared';

export type StepsDayPoint = {
  label: string;
  value: number;
  date: Date;
};

type Props = {
  days: StepsDayPoint[];
};

const PLOT_H = 162;
const AXIS_H = 16;
const Y_W = 28;
const PAD_Y = 8;

function niceMax(value: number) {
  if (value <= 0) return 100;
  const mag = 10 ** Math.floor(Math.log10(value));
  const n = value / mag;
  const nice = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return nice * mag;
}

function formatAxis(value: number) {
  if (value >= 1000) return `${Math.round(value / 1000)}კ`;
  return String(Math.round(value));
}

function smoothPath(points: { x: number; y: number }[]) {
  if (!points.length) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)} ${c2x.toFixed(1)} ${c2y.toFixed(1)} ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

function toPoints(values: number[], width: number, max: number) {
  const innerH = PLOT_H - PAD_Y * 2;
  const step = values.length > 1 ? width / (values.length - 1) : width;
  return values.map((value, i) => ({
    x: i * step,
    y: PAD_Y + innerH * (1 - value / max),
  }));
}

export function HomeStepsAreaChart({ days }: Props) {
  const FIGMA_STEPS = useFigmaSteps();
  const [width, setWidth] = useState(0);
  const [selected, setSelected] = useState(Math.max(0, days.length - 1));

  const max = useMemo(() => niceMax(Math.max(...days.map((d) => d.value), 1)), [days]);
  const ticks = useMemo(() => [max, max * 0.8, max * 0.6, max * 0.4, max * 0.2], [max]);
  const plotW = Math.max(0, width - Y_W - 8);

  const main = useMemo(() => days.map((d) => d.value), [days]);
  const compare = useMemo(
    () => (main.length ? [main[0], ...main.slice(0, -1)] : []),
    [main],
  );

  const mainPts = useMemo(() => toPoints(main, plotW, max), [main, max, plotW]);
  const comparePts = useMemo(() => toPoints(compare, plotW, max), [compare, max, plotW]);
  const mainPath = useMemo(() => smoothPath(mainPts), [mainPts]);
  const comparePath = useMemo(() => smoothPath(comparePts), [comparePts]);
  const area = (path: string, pts: { x: number; y: number }[]) => {
    if (!pts.length) return '';
    return `${path} L ${pts[pts.length - 1].x.toFixed(1)} ${PLOT_H} L ${pts[0].x.toFixed(1)} ${PLOT_H} Z`;
  };

  const active = days[selected];
  const activePt = mainPts[selected];
  const tooltipLabel = active
    ? active.date.toLocaleDateString('ka-GE', { weekday: 'short', month: 'short', day: 'numeric' })
    : '';

  return (
    <View style={{ height: PLOT_H + AXIS_H }} onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}>
      <View style={{ flexDirection: 'row', height: PLOT_H }}>
        <View style={{ width: Y_W, justifyContent: 'space-between', paddingVertical: PAD_Y }}>
          {ticks.map((tick) => (
            <Text
              key={tick}
              style={{
                fontFamily: 'NotoSansGeorgian_400Regular',
                fontSize: 12,
                lineHeight: 16,
                color: FIGMA_STEPS.textSecondary,
                textAlign: 'right',
              }}
            >
              {formatAxis(tick)}
            </Text>
          ))}
        </View>

        <View style={{ flex: 1, marginLeft: 8 }}>
          {plotW > 0 ? (
            <Svg width={plotW} height={PLOT_H}>
              <Defs>
                <LinearGradient id="stepsFillMain" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={FIGMA_STEPS.brand} stopOpacity="0.28" />
                  <Stop offset="1" stopColor={FIGMA_STEPS.brand} stopOpacity="0" />
                </LinearGradient>
                <LinearGradient id="stepsFillCompare" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={FIGMA_STEPS.brandLight} stopOpacity="0.45" />
                  <Stop offset="1" stopColor={FIGMA_STEPS.brandLight} stopOpacity="0" />
                </LinearGradient>
              </Defs>
              {ticks.map((tick) => {
                const y = PAD_Y + (PLOT_H - PAD_Y * 2) * (1 - tick / max);
                return (
                  <Line
                    key={`grid-${tick}`}
                    x1={0}
                    y1={y}
                    x2={plotW}
                    y2={y}
                    stroke={FIGMA_STEPS.border}
                    strokeWidth={1}
                  />
                );
              })}
              {comparePath ? (
                <>
                  <Path d={area(comparePath, comparePts)} fill="url(#stepsFillCompare)" />
                  <Path
                    d={comparePath}
                    stroke={FIGMA_STEPS.brandLight}
                    strokeWidth={2}
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </>
              ) : null}
              {mainPath ? (
                <>
                  <Path d={area(mainPath, mainPts)} fill="url(#stepsFillMain)" />
                  <Path
                    d={mainPath}
                    stroke={FIGMA_STEPS.brand}
                    strokeWidth={2.5}
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </>
              ) : null}
              {activePt ? (
                <>
                  <Line
                    x1={activePt.x}
                    y1={activePt.y}
                    x2={activePt.x}
                    y2={PLOT_H}
                    stroke={FIGMA_STEPS.brand}
                    strokeWidth={1}
                    strokeDasharray="4 4"
                  />
                  <Circle cx={activePt.x} cy={activePt.y} r={7} fill={FIGMA_STEPS.pointRing} />
                  <Circle cx={activePt.x} cy={activePt.y} r={5} fill={FIGMA_STEPS.brand} />
                </>
              ) : null}
            </Svg>
          ) : null}

          <View style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, flexDirection: 'row' }}>
            {days.map((day, index) => (
              <Pressable
                key={`${day.label}-${index}`}
                accessibilityRole="button"
                onPress={() => setSelected(index)}
                style={{ flex: 1 }}
              />
            ))}
          </View>

          {active && activePt && plotW > 0 ? (
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                top: Math.max(0, activePt.y - 58),
                left: Math.min(Math.max(activePt.x - 42, 0), plotW - 85),
                width: 85,
                alignItems: 'center',
              }}
            >
              <View
                style={{
                  backgroundColor: FIGMA_STEPS.tooltipBg,
                  borderRadius: 12,
                  paddingHorizontal: 8,
                  paddingVertical: 8,
                  minWidth: 48,
                  width: '100%',
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 8 },
                  shadowOpacity: 0.08,
                  shadowRadius: 14,
                  elevation: 4,
                }}
              >
                <Text
                  style={{
                    fontFamily: 'NotoSansGeorgian_400Regular',
                    fontSize: 12,
                    lineHeight: 16,
                    color: FIGMA_STEPS.textPrimary,
                    textAlign: 'center',
                  }}
                >
                  {tooltipLabel}
                </Text>
                <Text
                  style={{
                    fontFamily: 'NotoSansGeorgian_600SemiBold',
                    fontSize: 12,
                    lineHeight: 16,
                    color: FIGMA_STEPS.textPrimary,
                    textAlign: 'center',
                  }}
                >
                  {formatStepsCount(active.value)} {ka.steps.unit}
                </Text>
              </View>
              <View
                style={{
                  width: 0,
                  height: 0,
                  borderLeftWidth: 8,
                  borderRightWidth: 8,
                  borderTopWidth: 8,
                  borderLeftColor: 'transparent',
                  borderRightColor: 'transparent',
                  borderTopColor: FIGMA_STEPS.tooltipBg,
                }}
              />
            </View>
          ) : null}
        </View>
      </View>

      <View style={{ flexDirection: 'row', paddingLeft: Y_W + 8, marginTop: 2 }}>
        {days.map((day, index) => (
          <Text
            key={`x-${day.label}-${index}`}
            style={{
              flex: 1,
              textAlign: 'center',
              fontFamily: 'NotoSansGeorgian_400Regular',
              fontSize: 12,
              lineHeight: 16,
              color: FIGMA_STEPS.textSecondary,
            }}
          >
            {day.label}
          </Text>
        ))}
      </View>
    </View>
  );
}
