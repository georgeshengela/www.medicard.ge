import React, { useId, useMemo, useRef, useState } from 'react';
import { LayoutChangeEvent, Pressable, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Svg, { Circle, ClipPath, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { useFigmaLab } from '@/constants/figmaLabLayout';
import { LAB_CHART_INSET, makeLabChartScale } from '@/lib/labChartScale';
import { formatLabDateKa } from '@/lib/labExtract';
import { ka } from '@/i18n/ka';
import type { LabParameter } from '@/types/lab';

type Point = { date: string; param: LabParameter };
type Period = '1d' | '1w' | '1m' | '1y' | 'all';
type Win = { start: number; end: number };

const PERIODS: Period[] = ['1d', '1w', '1m', '1y', 'all'];
const PLOT_H = 228;
const AXIS_H = 26;
const Y_W = 48;
const INSET = LAB_CHART_INSET;
const MIN_SPAN = 0.14;
const FULL: Win = { start: 0, end: 1 };

export function LabParamChart({ points }: { points: Point[] }) {
  const T = useFigmaLab();
  const [period, setPeriod] = useState<Period>('all');
  const [plotW, setPlotW] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [win, setWin] = useState<Win>(FULL);
  const pinchRef = useRef({ win: FULL, focal: 0.5 });
  const slideRef = useRef({ win: FULL });
  const winRef = useRef(win);
  winRef.current = win;

  const filtered = useMemo(() => filterByPeriod(points, period), [period, points]);
  const last = filtered[filtered.length - 1] ?? points[points.length - 1];
  const refLow = last?.param.refLow ?? null;
  const refHigh = last?.param.refHigh ?? null;
  const normal = refLow != null && refHigh != null ? (refLow + refHigh) / 2 : (refLow ?? refHigh);
  const scale = useMemo(
    () => makeLabChartScale(filtered.map((row) => row.param.value), { normal, refLow, refHigh }, PLOT_H, INSET),
    [filtered, normal, refHigh, refLow],
  );
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const clipId = `${uid}-clip`;
  const zoomed = win.end - win.start < 0.98;
  const main = useMemo(() => toPts(filtered, plotW, scale, win), [filtered, plotW, scale, win]);
  const activeIndex = selected != null ? Math.min(selected, main.length - 1) : main.length - 1;
  const active = main[activeIndex] ?? null;
  const laneTop = refHigh != null ? scale.y(refHigh) : null;
  const laneBottom = refLow != null ? scale.y(refLow) : null;
  const bandTop = laneTop != null && laneBottom != null ? Math.min(laneTop, laneBottom) : null;
  const bandH = laneTop != null && laneBottom != null ? Math.abs(laneBottom - laneTop) : 0;

  const applyWin = (next: Win) => {
    setWin(clampWin(next.start, next.end));
  };

  const xToT = (x: number, view = winRef.current) => {
    const left = INSET;
    const right = Math.max(left + 1, plotW - INSET);
    const u = Math.min(1, Math.max(0, (x - left) / (right - left)));
    return view.start + u * (view.end - view.start);
  };

  const selectAtX = (x: number) => {
    if (!filtered.length) return;
    const t = xToT(x);
    const lastI = filtered.length - 1;
    setSelected(Math.round(t * lastI));
  };

  const pinch = Gesture.Pinch()
    .runOnJS(true)
    .onStart((e) => {
      pinchRef.current = { win, focal: xToT(e.focalX) };
    })
    .onUpdate((e) => {
      const span = Math.max(MIN_SPAN, Math.min(1, (pinchRef.current.win.end - pinchRef.current.win.start) / Math.max(e.scale, 0.05)));
      const focal = pinchRef.current.focal;
      applyWin({ start: focal - span * 0.5, end: focal + span * 0.5 });
    });

  const slide = Gesture.Pan()
    .minPointers(2)
    .runOnJS(true)
    .onStart(() => {
      slideRef.current = { win };
    })
    .onUpdate((e) => {
      const span = slideRef.current.win.end - slideRef.current.win.start;
      const shift = plotW > 0 ? (-e.translationX / plotW) * span : 0;
      applyWin({ start: slideRef.current.win.start + shift, end: slideRef.current.win.end + shift });
    });

  const scrub = Gesture.Pan()
    .minPointers(1)
    .maxPointers(1)
    .activeOffsetX([-6, 6])
    .failOffsetY([-18, 18])
    .runOnJS(true)
    .onBegin((e) => {
      slideRef.current = { win: winRef.current };
      selectAtX(e.x);
    })
    .onUpdate((e) => {
      if (slideRef.current.win.end - slideRef.current.win.start < 0.98) {
        const span = slideRef.current.win.end - slideRef.current.win.start;
        const shift = plotW > 0 ? (-e.translationX / plotW) * span : 0;
        applyWin({ start: slideRef.current.win.start + shift, end: slideRef.current.win.end + shift });
      }
      selectAtX(e.x);
    });

  const tap = Gesture.Tap()
    .maxDistance(12)
    .runOnJS(true)
    .onEnd((e) => selectAtX(e.x));

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .runOnJS(true)
    .onEnd(() => {
      setWin(FULL);
      setSelected(null);
    });

  const composed = Gesture.Simultaneous(pinch, slide, Gesture.Exclusive(doubleTap, Gesture.Race(scrub, tap)));

  return (
    <View style={{ gap: 14 }}>
      <View
        style={{
          flexDirection: 'row',
          backgroundColor: T.tabTrack,
          borderRadius: 14,
          padding: 4,
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
                setWin(FULL);
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
              <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 13, lineHeight: 18, color: on ? T.textPrimary : T.textSecondary }}>
                {ka.lab.periods[item]}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View
        style={{
          backgroundColor: T.cardBg,
          borderRadius: 20,
          paddingTop: 14,
          paddingBottom: 10,
          paddingHorizontal: 8,
          borderWidth: 1,
          borderColor: T.border,
          overflow: 'hidden',
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8, paddingBottom: 8 }}>
          <Text style={{ flex: 1, fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 12, lineHeight: 16, color: T.textMuted }}>
            {ka.lab.chartHint}
          </Text>
          {zoomed ? (
            <Pressable
              onPress={() => {
                setWin(FULL);
                setSelected(null);
              }}
              style={{ backgroundColor: T.brandSoft, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 }}
            >
              <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 12, color: T.brand }}>{ka.lab.resetZoom}</Text>
            </Pressable>
          ) : null}
        </View>

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
              <GestureDetector gesture={composed}>
                <View>
                  <Svg width={plotW} height={PLOT_H}>
                    <Defs>
                      <ClipPath id={clipId}>
                        <Rect x={0} y={0} width={plotW} height={PLOT_H} rx={14} />
                      </ClipPath>
                      <LinearGradient id={`${uid}-main`} x1="0" y1="0" x2="0" y2="1">
                        <Stop offset="0" stopColor={T.brand} stopOpacity="0.38" />
                        <Stop offset="0.55" stopColor={T.brand} stopOpacity="0.12" />
                        <Stop offset="1" stopColor={T.brand} stopOpacity="0" />
                      </LinearGradient>
                    </Defs>
                    <Rect x={0} y={0} width={plotW} height={PLOT_H} rx={14} fill={T.cardBg} />
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
                    {bandTop != null && bandH > 0 ? (
                      <Rect
                        x={INSET}
                        y={bandTop}
                        width={Math.max(0, plotW - INSET * 2)}
                        height={bandH}
                        rx={6}
                        fill={T.brand}
                        fillOpacity={0.1}
                        clipPath={`url(#${clipId})`}
                      />
                    ) : null}
                    {main.length ? (
                      <>
                        <Path d={areaPath(main)} fill={`url(#${uid}-main)`} clipPath={`url(#${clipId})`} />
                        <Path
                          d={smoothPath(main)}
                          stroke={T.brand}
                          strokeWidth={3}
                          fill="none"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          clipPath={`url(#${clipId})`}
                        />
                      </>
                    ) : null}
                    {main.map((pt, index) => {
                      const lastDot = index === main.length - 1;
                      const on = index === activeIndex;
                      const show = lastDot || on || zoomed;
                      if (!show) return null;
                      return (
                        <Circle
                          key={`dot-${index}`}
                          cx={pt.x}
                          cy={pt.y}
                          r={lastDot ? 7 : on ? 6 : 3.5}
                          fill={lastDot || on ? T.brand : T.cardBg}
                          stroke={T.brand}
                          strokeWidth={lastDot || on ? 0 : 2}
                          clipPath={`url(#${clipId})`}
                        />
                      );
                    })}
                    {active ? (
                      <Path
                        d={`M ${active.x} 8 V ${PLOT_H - 8}`}
                        stroke={T.brand}
                        strokeWidth={1.5}
                        strokeDasharray="4 5"
                        strokeOpacity={0.7}
                        clipPath={`url(#${clipId})`}
                      />
                    ) : null}
                  </Svg>

                  {active ? (
                    <View
                      pointerEvents="none"
                      style={{
                        position: 'absolute',
                        left: Math.min(Math.max(active.x - 58, 4), Math.max(plotW - 116, 4)),
                        top: Math.max(active.y - 58, 6),
                        width: 112,
                        alignItems: 'center',
                      }}
                    >
                      <View
                        style={{
                          backgroundColor: T.tooltipBg,
                          borderRadius: 14,
                          paddingHorizontal: 10,
                          paddingVertical: 8,
                          width: '100%',
                          alignItems: 'center',
                          gap: 2,
                        }}
                      >
                        <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 16, lineHeight: 20, color: T.tooltipText }}>
                          {fmt(active.value)}
                        </Text>
                        <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 11, lineHeight: 14, color: T.tooltipText, opacity: 0.75 }}>
                          {formatLabDateKa(filtered[activeIndex]?.date ?? '')}
                        </Text>
                      </View>
                    </View>
                  ) : null}

                  <View style={{ height: AXIS_H, flexDirection: 'row', paddingHorizontal: INSET, alignItems: 'center' }}>
                    {axisLabels(filtered, win).map((label, i) => (
                      <Text
                        key={`${label}-${i}`}
                        numberOfLines={1}
                        style={{
                          flex: 1,
                          textAlign: i === 0 ? 'left' : i === 2 ? 'right' : 'center',
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
              </GestureDetector>
            ) : null}
          </View>
        </View>
      </View>
    </View>
  );
}

type Scale = { y: (v: number) => number };
type Pt = { x: number; y: number; value: number };

function clampWin(start: number, end: number): Win {
  const span = Math.max(MIN_SPAN, Math.min(1, end - start));
  let s = start;
  if (s < 0) s = 0;
  if (s + span > 1) s = 1 - span;
  return { start: s, end: s + span };
}

function toPts(points: Point[], width: number, scale: Scale, win: Win): Pt[] {
  if (!width || !points.length) return [];
  const left = INSET;
  const right = width - INSET;
  const lastI = Math.max(points.length - 1, 1);
  const span = Math.max(win.end - win.start, 1e-6);
  return points.map((row, i) => {
    const t = points.length === 1 ? 0.5 : i / lastI;
    return {
      x: left + ((t - win.start) / span) * (right - left),
      y: scale.y(row.param.value),
      value: row.param.value,
    };
  });
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

function axisLabels(points: Point[], win: Win): string[] {
  if (!points.length) return [];
  const lastI = Math.max(points.length - 1, 1);
  const picks = [win.start, (win.start + win.end) / 2, win.end].map((t) => {
    const i = Math.round(t * lastI);
    return shortDate(points[Math.min(Math.max(i, 0), points.length - 1)].date);
  });
  return picks;
}

function shortDate(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number);
  if (!y || !m || !d) return ymd;
  return new Date(y, m - 1, d).toLocaleDateString('ka-GE', { day: 'numeric', month: 'short' });
}

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(Math.abs(n) >= 10 ? 1 : 2).replace(/\.0$/, '');
}
