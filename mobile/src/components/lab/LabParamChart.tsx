import React, { useId, useMemo, useState } from 'react';
import { LayoutChangeEvent, Pressable, Text, View } from 'react-native';
import Svg, { ClipPath, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { LabCheckMark, LabFlaskTriangle } from '@/components/lab/LabIcons';
import { useFigmaLab } from '@/constants/figmaLabLayout';
import { downsampleLabPoints, LAB_CHART_INSET, LAB_CHART_PLOT_H, makeLabChartScale } from '@/lib/labChartScale';
import { formatLabDateKa } from '@/lib/labExtract';
import { ka } from '@/i18n/ka';
import type { LabFlag, LabParameter } from '@/types/lab';

type Point = { date: string; param: LabParameter };
type Period = '1d' | '1w' | '1m' | '1y' | 'all';

const PERIODS: Period[] = ['1d', '1w', '1m', '1y', 'all'];
const PLOT_H = LAB_CHART_PLOT_H;
const AXIS_H = 24;
const Y_W = 48;
const INSET = LAB_CHART_INSET;

export function LabParamChart({ points }: { points: Point[] }) {
  const T = useFigmaLab();
  const [period, setPeriod] = useState<Period>('all');
  const [plotW, setPlotW] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);

  const filtered = useMemo(() => filterByPeriod(points, period), [period, points]);
  const series = useMemo(() => downsampleLabPoints(filtered, 12, (row) => row.param.value), [filtered]);
  const last = filtered[filtered.length - 1] ?? points[points.length - 1];
  const values = filtered.map((row) => row.param.value);
  const minV = values.length ? Math.min(...values) : 0;
  const maxV = values.length ? Math.max(...values) : 0;
  const headline =
    filtered.length > 1 && minV !== maxV ? `${fmt(minV)} – ${fmt(maxV)}` : last ? last.param.display : '—';
  const unit = last?.param.unit ?? '';
  const flag = last?.param.flag ?? 'U';
  const badge = badgeFor(flag, T);
  const dateFrom = filtered[0]?.date ?? points[0]?.date;
  const dateTo = filtered[filtered.length - 1]?.date ?? points[points.length - 1]?.date;
  const refLow = last?.param.refLow ?? null;
  const refHigh = last?.param.refHigh ?? null;
  const normal = refLow != null && refHigh != null ? (refLow + refHigh) / 2 : (refLow ?? refHigh);

  const scale = useMemo(
    () => makeLabChartScale(filtered.map((row) => row.param.value), { normal, refLow, refHigh }),
    [filtered, normal, refHigh, refLow],
  );
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const clipId = `${uid}-clip`;
  const main = useMemo(() => toPts(series.map((row) => row.param.value), plotW, scale), [plotW, scale, series]);
  const compare = useMemo(() => {
    const vals = series.map((row) => row.param.value);
    if (vals.length < 3) return [];
    return toPts([vals[0], ...vals.slice(0, -1)], plotW, scale);
  }, [plotW, scale, series]);
  const active = selected != null ? main[Math.min(selected, main.length - 1)] ?? null : null;
  const normalY = normal != null ? scale.y(normal) : null;
  const laneTop = refHigh != null ? scale.y(refHigh) : null;
  const laneBottom = refLow != null ? scale.y(refLow) : null;
  const markTop = laneTop != null && laneBottom != null ? Math.min(laneTop, laneBottom) : normalY;
  const markBottom = laneTop != null && laneBottom != null ? Math.max(laneTop, laneBottom) : normalY;
  const markMid = markTop != null && markBottom != null ? (markTop + markBottom) / 2 : null;
  const markH = markTop != null && markBottom != null ? Math.max(markBottom - markTop, 8) : 0;

  return (
    <View style={{ gap: 20 }}>
      <View style={{ gap: 12, zIndex: 1, elevation: 0 }}>
        <View
          style={{
            alignSelf: 'flex-start',
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            backgroundColor: badge.bg,
            borderWidth: 1,
            borderColor: badge.border,
            borderRadius: 8,
            paddingHorizontal: 8,
            paddingVertical: 4,
            ...T.shadowXs,
          }}
        >
          {flag === 'N' ? <LabCheckMark color={badge.fg} /> : null}
          <Text style={{ fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 14, lineHeight: 20, color: badge.fg }}>
            {badge.label}
          </Text>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6 }}>
          <LabFlaskTriangle color={T.chartViolet} />
          <Text
            style={{
              flexShrink: 1,
              fontFamily: 'NotoSansGeorgian_700Bold',
              fontSize: 34,
              lineHeight: 42,
              letterSpacing: -0.5,
              color: T.textPrimary,
            }}
          >
            {headline}
          </Text>
          {unit ? (
            <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 16, lineHeight: 22, color: T.textSecondary, paddingBottom: 6 }}>
              {unit}
            </Text>
          ) : null}
        </View>

        <View style={{ gap: 8 }}>
          <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 16, lineHeight: 22, color: T.textPrimary }}>
            {trendCopy(filtered)}
          </Text>
          {dateFrom && dateTo ? (
            <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 12, lineHeight: 16, color: T.textSecondary }}>
              {dateFrom === dateTo ? formatLabDateKa(dateFrom) : ka.lab.rangeFromTo(shortDate(dateFrom), shortDate(dateTo))}
            </Text>
          ) : null}
        </View>
      </View>

      <View
        style={{
          flexDirection: 'row',
          backgroundColor: T.tabTrack,
          borderRadius: 14,
          padding: 4,
          overflow: 'hidden',
          elevation: 0,
          zIndex: 0,
        }}
      >
        {PERIODS.map((item) => {
          const on = item === period;
          return (
            <Pressable
              key={item}
              onPress={() => {
                setPeriod(item);
                setSelected(null);
              }}
              style={{
                flex: 1,
                minHeight: 36,
                borderRadius: 10,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: on ? T.tabSelected : 'transparent',
              }}
            >
              <Text
                style={{
                  fontFamily: 'NotoSansGeorgian_600SemiBold',
                  fontSize: 13,
                  lineHeight: 18,
                  color: on ? T.textPrimary : T.textSecondary,
                }}
              >
                {ka.lab.periods[item]}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View
        style={{
          backgroundColor: T.cardBg,
          borderRadius: 16,
          paddingTop: 12,
          paddingBottom: 8,
          paddingHorizontal: 8,
          overflow: 'hidden',
          zIndex: 0,
          elevation: 0,
        }}
      >
      <View style={{ flexDirection: 'row', height: PLOT_H + AXIS_H }}>
        <View style={{ width: Y_W, height: PLOT_H, position: 'relative' }}>
          {scale.ticks.map((tick) => (
            <Text
              key={tick}
              numberOfLines={1}
              style={{
                position: 'absolute',
                right: 0,
                top: Math.min(Math.max(scale.y(tick) - 7, 0), PLOT_H - 14),
                width: Y_W,
                fontFamily: 'NotoSansGeorgian_400Regular',
                fontSize: 11,
                lineHeight: 14,
                color: T.textSecondary,
                textAlign: 'right',
              }}
            >
              {fmt(tick)}
            </Text>
          ))}
        </View>

        <View style={{ flex: 1, marginLeft: 8, overflow: 'hidden' }} onLayout={(e: LayoutChangeEvent) => setPlotW(e.nativeEvent.layout.width)}>
          {plotW > 0 ? (
            <Svg width={plotW} height={PLOT_H}>
              <Defs>
                <ClipPath id={clipId}>
                  <Rect x={0} y={0} width={plotW} height={PLOT_H} rx={12} />
                </ClipPath>
                <LinearGradient id={`${uid}-main`} x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={T.brand} stopOpacity="0.28" />
                  <Stop offset="1" stopColor={T.brand} stopOpacity="0" />
                </LinearGradient>
                <LinearGradient id={`${uid}-cmp`} x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={T.brandLight} stopOpacity="0.35" />
                  <Stop offset="1" stopColor={T.brandLight} stopOpacity="0" />
                </LinearGradient>
              </Defs>
              <Rect x={0} y={0} width={plotW} height={PLOT_H} rx={12} fill={T.cardBg} />
              {scale.ticks.map((tick) => (
                <Path
                  key={`grid-${tick}`}
                  d={`M ${INSET} ${scale.y(tick)} H ${plotW - INSET}`}
                  stroke={T.chartGrid}
                  strokeWidth={1}
                  strokeLinecap="round"
                  clipPath={`url(#${clipId})`}
                />
              ))}
              {markTop != null && markBottom != null ? (
                <>
                  <Rect
                    x={4}
                    y={markH >= 8 ? markTop : markMid! - 4}
                    width={8}
                    height={markH >= 8 ? markH : 8}
                    rx={4}
                    fill={T.brand}
                    fillOpacity={0.22}
                  />
                  <Path
                    d={
                      markH >= 12
                        ? `M 16 ${markTop} H 6 V ${markBottom} H 16`
                        : `M 4 ${markMid} H 16`
                    }
                    stroke={T.brand}
                    strokeWidth={2}
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </>
              ) : null}
              {compare.length ? (
                <>
                  <Path d={areaPath(compare)} fill={`url(#${uid}-cmp)`} clipPath={`url(#${clipId})`} />
                  <Path
                    d={smoothPath(compare)}
                    stroke={T.brandLight}
                    strokeWidth={2}
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    clipPath={`url(#${clipId})`}
                  />
                </>
              ) : null}
              {main.length ? (
                <>
                  <Path d={areaPath(main)} fill={`url(#${uid}-main)`} clipPath={`url(#${clipId})`} />
                  <Path
                    d={smoothPath(main)}
                    stroke={T.brand}
                    strokeWidth={2.5}
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    clipPath={`url(#${clipId})`}
                  />
                </>
              ) : null}
            </Svg>
          ) : null}

          {plotW > 0 ? (
            <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, top: 0, height: PLOT_H }}>
              {main.map((pt, index) => (
                <Pressable
                  key={`hit-${index}`}
                  onPress={() => setSelected(index)}
                  style={{ position: 'absolute', left: Math.max(0, pt.x - 18), top: 0, width: 36, height: PLOT_H }}
                />
              ))}
              {markMid != null && !active ? (
                <View
                  pointerEvents="none"
                  style={{
                    position: 'absolute',
                    left: 18,
                    top: Math.min(
                      Math.max(markBottom != null && markBottom > PLOT_H - 36 ? markTop! - 24 : markMid - 11, 4),
                      PLOT_H - 26,
                    ),
                  }}
                >
                  <View style={{ backgroundColor: T.brand, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                    <Text style={{ fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 12, lineHeight: 16, color: '#FFFFFF' }}>
                      {ka.lab.normal}
                    </Text>
                  </View>
                </View>
              ) : null}
              {active ? (
                <View
                  pointerEvents="none"
                  style={{
                    position: 'absolute',
                    left: Math.min(Math.max(active.x - 28, 4), Math.max(plotW - 60, 4)),
                    top: Math.max(active.y - 42, 4),
                    width: 56,
                    alignItems: 'center',
                  }}
                >
                  <View style={{ backgroundColor: T.tooltipBg, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 6, width: '100%' }}>
                    <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 14, lineHeight: 20, color: T.tooltipText, textAlign: 'center' }}>
                      {fmt(active.value)}
                    </Text>
                  </View>
                </View>
              ) : null}
            </View>
          ) : null}

          <View style={{ height: AXIS_H, flexDirection: 'row', paddingHorizontal: INSET, alignItems: 'center' }}>
            {axisLabels(series).map((label, i) => (
              <Text
                key={`${label}-${i}`}
                numberOfLines={1}
                style={{
                  flex: 1,
                  textAlign: 'center',
                  fontFamily: 'NotoSansGeorgian_400Regular',
                  fontSize: 11,
                  lineHeight: 14,
                  color: T.textSecondary,
                }}
              >
                {label}
              </Text>
            ))}
          </View>
        </View>
      </View>
      </View>
    </View>
  );
}

type Scale = { y: (v: number) => number; ticks: number[] };
type Pt = { x: number; y: number; value: number };

function toPts(values: number[], width: number, scale: Scale): Pt[] {
  if (!width || !values.length) return [];
  const left = INSET;
  const right = width - INSET;
  if (values.length === 1) {
    const y = scale.y(values[0]);
    return [
      { x: left, y, value: values[0] },
      { x: right, y, value: values[0] },
    ];
  }
  const step = (right - left) / (values.length - 1);
  return values.map((value, i) => ({ x: left + i * step, y: scale.y(value), value }));
}

function smoothPath(points: Pt[]): string {
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

function areaPath(pts: Pt[]): string {
  if (!pts.length) return '';
  const base = PLOT_H - 2;
  return `${smoothPath(pts)} L ${pts[pts.length - 1].x.toFixed(1)} ${base} L ${pts[0].x.toFixed(1)} ${base} Z`;
}

function filterByPeriod(points: Point[], period: Period): Point[] {
  if (period === 'all' || points.length < 2) return points;
  const last = points[points.length - 1];
  const end = new Date(`${last.date}T12:00:00`);
  const days = period === '1d' ? 1 : period === '1w' ? 7 : period === '1m' ? 31 : 366;
  const start = new Date(end);
  start.setDate(start.getDate() - days + 1);
  const stamp = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`;
  const next = points.filter((row) => row.date >= stamp);
  return next.length ? next : points.slice(-1);
}

function axisLabels(points: Point[]): string[] {
  if (!points.length) return [];
  const labels = points.map((row) => shortDate(row.date));
  if (labels.length <= 5) return labels;
  const picks = [0, Math.floor((labels.length - 1) / 4), Math.floor((labels.length - 1) / 2), Math.floor(((labels.length - 1) * 3) / 4), labels.length - 1];
  return [...new Set(picks)].map((i) => labels[i]);
}

function trendCopy(points: Point[]): string {
  if (points.length < 2) return ka.lab.needMorePoints;
  const first = points[0].param.value;
  const last = points[points.length - 1].param.value;
  const pct = first !== 0 ? Math.round((Math.abs(last - first) / Math.abs(first)) * 100) : 0;
  if (pct <= 3) return ka.lab.rangeStable;
  return last > first ? ka.lab.wentUp(pct) : ka.lab.wentDown(pct);
}

function shortDate(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number);
  if (!y || !m || !d) return ymd;
  return new Date(y, m - 1, d).toLocaleDateString('ka-GE', { day: 'numeric', month: 'short' });
}

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(Math.abs(n) >= 10 ? 1 : 2).replace(/\.0$/, '');
}

function badgeFor(flag: LabFlag, T: ReturnType<typeof useFigmaLab>) {
  if (flag === 'H') return { label: ka.lab.above, bg: T.destructiveSoft, border: T.destructiveBorder, fg: T.destructive };
  if (flag === 'L') return { label: ka.lab.below, bg: T.destructiveSoft, border: T.destructiveBorder, fg: T.destructive };
  if (flag === 'N') return { label: ka.lab.normal, bg: T.brandSoft, border: T.brandLight, fg: T.brand };
  return { label: ka.lab.unknown, bg: T.cardBg, border: T.border, fg: T.textSecondary };
}
