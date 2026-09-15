import React, { useMemo, useState } from 'react';
import { LayoutChangeEvent, Pressable, Text, View } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop } from 'react-native-svg';
import { TrendingDown, TrendingUp } from 'lucide-react-native';
import { PetPhoto } from '@/components/pets/PetPhoto';
import { useFigmaWeight } from '@/constants/figmaWeightLayout';
import { ka } from '@/i18n/ka';
import { formatCycleDateKa } from '@/lib/cycleCivilDateKa';
import type { Pet, PetWeightLog } from '@/lib/api';
import { petWeightDeltaPercent, petWeightWeekSeries, sortWeightChronological, weightTrendAccessibleText } from '@/lib/petsHealth';

const PLOT_H = 178;
const AXIS_H = 16;
const Y_W = 28;
const PAD_Y = 8;

function formatTick(value: number, max: number) {
  if (max >= 10) return String(Math.round(value));
  const rounded = Math.round(value * 10) / 10;
  return String(rounded);
}

function niceMax(value: number) {
  if (value <= 0) return 10;
  const mag = 10 ** Math.floor(Math.log10(value));
  const n = value / mag;
  const nice = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return nice * mag;
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

export function PetWeightTrend({ items, pet }: { items: PetWeightLog[]; pet?: Pet | null }) {
  const T = useFigmaWeight();
  const [width, setWidth] = useState(0);
  const points = useMemo(() => sortWeightChronological(items), [items]);
  const week = useMemo(() => petWeightWeekSeries(items), [items]);
  const delta = useMemo(() => petWeightDeltaPercent(items), [items]);
  const latest = points[points.length - 1];
  const label = weightTrendAccessibleText(points, formatCycleDateKa, ka.pets);
  const [selected, setSelected] = useState(Math.max(0, week.length - 1));

  const values = week.map((day) => day.value ?? 0);
  const hasAny = week.some((day) => day.value != null);
  const max = niceMax(Math.max(...values, 1));
  const ticks = useMemo(() => [max, max * (5 / 6), max * (4 / 6), max * (3 / 6), max * (2 / 6), max / 6], [max]);
  const plotW = Math.max(0, width - Y_W - 8);
  const compare = values.length ? [values[0], ...values.slice(0, -1)] : [];
  const mainPts = toPoints(values, plotW, max);
  const comparePts = toPoints(compare, plotW, max);
  const mainPath = smoothPath(mainPts);
  const comparePath = smoothPath(comparePts);
  const area = (path: string, pts: { x: number; y: number }[]) => {
    if (!pts.length) return '';
    return `${path} L ${pts[pts.length - 1].x.toFixed(1)} ${PLOT_H} L ${pts[0].x.toFixed(1)} ${PLOT_H} Z`;
  };
  const activePt = mainPts[selected];
  const kgLabel = latest ? (Number.isInteger(latest.weightKg) ? String(latest.weightKg) : latest.weightKg.toFixed(1)) : '—';
  const status =
    delta == null ? ka.pets.weightOnePoint : delta > 0 ? ka.pets.weightTrendUp : delta < 0 ? ka.pets.weightTrendDown : ka.pets.weightStable;
  const TrendIcon = delta != null && delta < 0 ? TrendingDown : TrendingUp;
  const trendColor = delta == null ? T.textTertiary : delta < 0 ? '#B91C1C' : '#166534';

  if (!points.length) return null;

  return (
    <View
      accessible
      accessibilityRole="summary"
      accessibilityLabel={label}
      style={{
        backgroundColor: T.cardBg,
        borderWidth: 1,
        borderColor: T.border,
        borderRadius: 20,
        padding: 12,
        gap: 12,
        ...T.shadowXs,
      }}
    >
      {pet ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <PetPhoto photoUrl={pet.photoUrl || null} name={pet.name} size={40} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 14, lineHeight: 20, color: T.textPrimary }}>
              {pet.name}
            </Text>
            <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 12, lineHeight: 16, color: T.textSecondary }}>
              {latest ? formatCycleDateKa(latest.recordedOn) : ''}
            </Text>
          </View>
        </View>
      ) : null}

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingBottom: 8 }}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 13 }}>
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              backgroundColor: T.brandSoft,
              borderWidth: 1,
              borderColor: T.brand,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text
              style={{
                fontFamily: 'NotoSansGeorgian_600SemiBold',
                fontSize: kgLabel.length > 3 ? 16 : 20,
                lineHeight: 28,
                letterSpacing: -0.25,
                color: T.brand,
              }}
            >
              {kgLabel}
            </Text>
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 14, lineHeight: 20, color: T.textPrimary }}>
              {ka.pets.weightTitle}
            </Text>
            <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 12, lineHeight: 16, color: T.textPrimary }} numberOfLines={2}>
              {status}
            </Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <TrendIcon size={18} color={trendColor} strokeWidth={2.2} />
          <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 14, lineHeight: 20, color: trendColor }}>
            {delta == null ? '—' : `${delta > 0 ? '+' : ''}${delta}%`}
          </Text>
        </View>
      </View>

      {hasAny ? (
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
                    color: T.textSecondary,
                    textAlign: 'right',
                  }}
                >
                  {formatTick(tick, max)}
                </Text>
              ))}
            </View>
            <View style={{ flex: 1, marginLeft: 8 }}>
              {plotW > 0 ? (
                <Svg width={plotW} height={PLOT_H}>
                  <Defs>
                    <LinearGradient id="petWeightFillMain" x1="0" y1="0" x2="0" y2="1">
                      <Stop offset="0" stopColor={T.brand} stopOpacity="0.28" />
                      <Stop offset="1" stopColor={T.brand} stopOpacity="0" />
                    </LinearGradient>
                    <LinearGradient id="petWeightFillCompare" x1="0" y1="0" x2="0" y2="1">
                      <Stop offset="0" stopColor={T.brandLight} stopOpacity="0.45" />
                      <Stop offset="1" stopColor={T.brandLight} stopOpacity="0" />
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
                        stroke={T.border}
                        strokeWidth={1}
                      />
                    );
                  })}
                  {comparePath ? (
                    <>
                      <Path d={area(comparePath, comparePts)} fill="url(#petWeightFillCompare)" />
                      <Path
                        d={comparePath}
                        stroke={T.brandLight}
                        strokeWidth={2}
                        fill="none"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </>
                  ) : null}
                  {mainPath ? (
                    <>
                      <Path d={area(mainPath, mainPts)} fill="url(#petWeightFillMain)" />
                      <Path
                        d={mainPath}
                        stroke={T.brand}
                        strokeWidth={2.5}
                        fill="none"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </>
                  ) : null}
                  {activePt ? (
                    <>
                      <Circle cx={activePt.x} cy={activePt.y} r={7} fill={T.surface} />
                      <Circle cx={activePt.x} cy={activePt.y} r={5} fill={T.brand} />
                    </>
                  ) : null}
                </Svg>
              ) : null}
              <View style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, flexDirection: 'row' }}>
                {week.map((day, index) => (
                  <Pressable
                    key={day.ymd}
                    accessibilityRole="button"
                    onPress={() => setSelected(index)}
                    style={{ flex: 1 }}
                  />
                ))}
              </View>
            </View>
          </View>
          <View style={{ flexDirection: 'row', paddingLeft: Y_W + 8, marginTop: 2 }}>
            {week.map((day) => (
              <Text
                key={`x-${day.ymd}`}
                style={{
                  flex: 1,
                  textAlign: 'center',
                  fontFamily: 'NotoSansGeorgian_400Regular',
                  fontSize: 12,
                  lineHeight: 16,
                  color: T.textSecondary,
                }}
              >
                {ka.auth.weekdays[day.weekdayIndex]}
              </Text>
            ))}
          </View>
        </View>
      ) : (
        <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 13, color: T.textTertiary }}>{ka.pets.weightOnePoint}</Text>
      )}
    </View>
  );
}
