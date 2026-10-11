import React, { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Rect, Stop, Text as SvgText } from 'react-native-svg';
import { tx } from '@/i18n/locale';
import { formatHoursCompact, hhmm } from '@/lib/sleep/sleepTime';
import type { SleepNight } from '@/lib/sleep/sleepTypes';
import { useThemeColors } from '@/theme/colors';
import { MOON, ORCHID } from './SleepKit';

const WEEKDAYS = [tx('კვი', 'Sun'), tx('ორშ', 'Mon'), tx('სამ', 'Tue'), tx('ოთხ', 'Wed'), tx('ხუთ', 'Thu'), tx('პარ', 'Fri'), tx('შაბ', 'Sat')];

const fromNoon = (minutesOfDay: number) => (((minutesOfDay - 720) % 1440) + 1440) % 1440;
const localMinutes = (iso: string) => {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
};
const weekdayOf = (night: string) => new Date(`${night}T12:00:00`).getDay();

/**
 * „ძილის რიტმი“: one column per night, the bar from bedtime to wake-up on a clock axis (20:00 at the top, 11:00 at
 * the bottom), over the planned window as a soft band. Bars that line up = a regular rhythm — the thing that
 * matters most — without a single word. Short nights are dimmer; a night with no data shows an empty slot.
 */
export function SleepRhythmChart({
  days,
  nights,
  plannedBed,
  plannedWake,
  goalMinutes,
  height = 200,
  onPressNight,
}: {
  /** Night dates (YYYY-MM-DD), oldest first. */
  days: string[];
  nights: SleepNight[];
  plannedBed: number | null;
  plannedWake: number | null;
  goalMinutes: number;
  height?: number;
  onPressNight?: (night: string) => void;
}) {
  const c = useThemeColors();
  const [width, setWidth] = useState(0);
  const byNight = useMemo(() => new Map(nights.map((n) => [n.night, n])), [nights]);
  // The axis fits the nights shown (and the plan), whole hours, so the bars use the height.
  const rel = useMemo(() => {
    const values: number[] = [];
    for (const day of days) {
      const n = byNight.get(day);
      if (!n?.bedAt || !n?.wakeAt) continue;
      const b = fromNoon(localMinutes(n.bedAt));
      let w = fromNoon(localMinutes(n.wakeAt));
      if (w < b) w += 1440;
      values.push(b, Math.min(1439, w));
    }
    if (plannedBed != null) values.push(fromNoon(plannedBed));
    if (plannedWake != null) values.push(fromNoon(plannedWake));
    if (!values.length) values.push(fromNoon(22 * 60), fromNoon(8 * 60));
    const lo = Math.max(fromNoon(18 * 60), Math.floor((Math.min(...values) - 30) / 60) * 60);
    const hi = Math.min(1439, Math.ceil((Math.max(...values) + 30) / 60) * 60);
    return { lo, hi: Math.max(hi, lo + 360) };
  }, [days, byNight, plannedBed, plannedWake]);
  const top = rel.lo;
  const bottom = rel.hi;
  const span = bottom - top;
  const plotTop = 8;
  const plotH = height - 50;
  const y = (r: number) => plotTop + ((Math.max(top, Math.min(bottom, r)) - top) / span) * plotH;
  const colW = (width - 34) / Math.max(1, days.length);
  const barW = Math.min(22, colW * 0.46);
  const stepMin = span > 600 ? 240 : 120;
  const gridHours: number[] = [];
  for (let r = Math.ceil(top / stepMin) * stepMin; r <= bottom; r += stepMin) gridHours.push((r + 720) % 1440);

  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={{ height }}>
      {width > 0 ? (
        <Svg width={width} height={height}>
          <Defs>
            <LinearGradient id="rhythmBar" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={MOON} />
              <Stop offset="1" stopColor={ORCHID} />
            </LinearGradient>
          </Defs>
          {gridHours.map((m) => (
            <React.Fragment key={m}>
              <Line x1={0} x2={width} y1={y(fromNoon(m))} y2={y(fromNoon(m))} stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
              <SvgText x={width - 2} y={y(fromNoon(m)) - 3} fill={c.text300} fontSize={9} textAnchor="end">{hhmm(m)}</SvgText>
            </React.Fragment>
          ))}
          {plannedBed != null && plannedWake != null ? (
            <Rect
              x={0}
              width={width}
              y={y(fromNoon(plannedBed))}
              height={Math.max(2, y(fromNoon(plannedWake) < fromNoon(plannedBed) ? fromNoon(plannedWake) + 1440 : fromNoon(plannedWake)) - y(fromNoon(plannedBed)))}
              fill={ORCHID}
              opacity={0.07}
            />
          ) : null}
          {days.map((day, i) => {
            const n = byNight.get(day);
            const cxCol = colW * i + colW / 2;
            const label = WEEKDAYS[weekdayOf(day)];
            if (!n?.bedAt || !n?.wakeAt) {
              return (
                <React.Fragment key={day}>
                  <Rect x={cxCol - barW / 2} y={y(fromNoon(23 * 60))} width={barW} height={plotH * 0.42} rx={barW / 2} fill="none" stroke="rgba(255,255,255,0.12)" strokeDasharray="3,4" />
                  <SvgText x={cxCol} y={height - 24} fill={c.text300} fontSize={11} textAnchor="middle">{label}</SvgText>
                  <SvgText x={cxCol} y={height - 8} fill={c.text300} fontSize={10} textAnchor="middle">{n?.sleptMinutes ? formatHoursCompact(n.sleptMinutes) : '—'}</SvgText>
                </React.Fragment>
              );
            }
            const b = fromNoon(localMinutes(n.bedAt));
            let w = fromNoon(localMinutes(n.wakeAt));
            if (w < b) w += 1440;
            const short = (n.sleptMinutes ?? 0) < goalMinutes - 15;
            const y1 = y(b);
            const y2 = Math.max(y1 + barW, y(w));
            return (
              <React.Fragment key={day}>
                <Rect
                  x={cxCol - barW / 2} y={y1} width={barW} height={y2 - y1} rx={barW / 2}
                  fill="url(#rhythmBar)" opacity={short ? 0.55 : 1}
                  onPress={onPressNight ? () => onPressNight(day) : undefined}
                />
                <SvgText x={cxCol} y={height - 24} fill={c.text200} fontSize={11} fontWeight="600" textAnchor="middle">{label}</SvgText>
                <SvgText x={cxCol} y={height - 8} fill={short ? c.text300 : c.text100} fontSize={10} textAnchor="middle">{formatHoursCompact(n.sleptMinutes)}</SvgText>
              </React.Fragment>
            );
          })}
        </Svg>
      ) : null}
    </View>
  );
}

/**
 * Sleep length over time (the reference's wave): a smooth line through each night, the goal as a dashed line,
 * a soft fill below. Nights without data break nothing — the line joins the nights she logged.
 */
export function SleepWaveChart({ points, goalMinutes, height = 170 }: { points: { night: string; minutes: number | null }[]; goalMinutes: number; height?: number }) {
  const c = useThemeColors();
  const [width, setWidth] = useState(0);
  const valid = points.map((p, i) => ({ ...p, i })).filter((p) => p.minutes != null) as { night: string; minutes: number; i: number }[];
  const minY = 4 * 60;
  const maxY = Math.max(10 * 60, ...valid.map((p) => p.minutes + 30));
  const padX = 12;
  const plotH = height - 28;
  const x = (i: number) => padX + (points.length <= 1 ? 0 : (i / (points.length - 1)) * (width - padX * 2));
  const y = (m: number) => 18 + (1 - (Math.max(minY, Math.min(maxY, m)) - minY) / (maxY - minY)) * (plotH - 18);
  const path = (() => {
    if (valid.length < 2) return '';
    let d = `M ${x(valid[0].i)} ${y(valid[0].minutes)}`;
    for (let k = 1; k < valid.length; k++) {
      const a = valid[k - 1];
      const b = valid[k];
      const mx = (x(a.i) + x(b.i)) / 2;
      d += ` C ${mx} ${y(a.minutes)}, ${mx} ${y(b.minutes)}, ${x(b.i)} ${y(b.minutes)}`;
    }
    return d;
  })();
  const fill = path ? `${path} L ${x(valid[valid.length - 1].i)} ${plotH} L ${x(valid[0].i)} ${plotH} Z` : '';
  const ticks = [6 * 60, 8 * 60, 10 * 60].filter((m) => m <= maxY);
  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={{ height }}>
      {width > 0 ? (
        <Svg width={width} height={height}>
          <Defs>
            <LinearGradient id="waveFill" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={ORCHID} stopOpacity={0.35} />
              <Stop offset="1" stopColor={ORCHID} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          {ticks.map((m) => (
            <React.Fragment key={m}>
              <Line x1={padX} x2={width - padX} y1={y(m)} y2={y(m)} stroke="rgba(255,255,255,0.06)" />
              <SvgText x={padX} y={y(m) - 4} fill={c.text300} fontSize={10}>{tx(`${m / 60} სთ`, `${m / 60} h`)}</SvgText>
            </React.Fragment>
          ))}
          <Line x1={padX} x2={width - padX} y1={y(goalMinutes)} y2={y(goalMinutes)} stroke={MOON} strokeOpacity={0.6} strokeDasharray="4,5" />
          {fill ? <Path d={fill} fill="url(#waveFill)" /> : null}
          {path ? <Path d={path} stroke={ORCHID} strokeWidth={2.5} fill="none" strokeLinecap="round" /> : null}
          {valid.map((p) => (
            <Circle key={p.night} cx={x(p.i)} cy={y(p.minutes)} r={valid.length > 14 ? 2.5 : 4} fill={p.minutes >= goalMinutes - 15 ? MOON : ORCHID} />
          ))}
          {points.length ? (
            <>
              <SvgText x={padX} y={height - 6} fill={c.text300} fontSize={10}>{shortDate(points[0].night)}</SvgText>
              <SvgText x={width - padX} y={height - 6} fill={c.text300} fontSize={10} textAnchor="end">{shortDate(points[points.length - 1].night)}</SvgText>
            </>
          ) : null}
        </Svg>
      ) : null}
      {valid.length < 2 ? (
        <Text style={{ position: 'absolute', top: plotH / 2 - 10, left: 0, right: 0, textAlign: 'center', fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 13, color: c.text300 }}>
          {tx('ორი ღამის შემდეგ აქ გამოჩნდება შენი ძილის ტალღა', 'Your sleep curve appears here after two nights')}
        </Text>
      ) : null}
    </View>
  );
}

function shortDate(night: string): string {
  const d = new Date(`${night}T12:00:00`);
  return `${d.getDate()}.${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Average sleep per weekday as small horizontal bars (weekend pattern at a glance). */
export function WeekdayBars({ weekday, goalMinutes }: { weekday: (number | null)[]; goalMinutes: number }) {
  const c = useThemeColors();
  const order = [1, 2, 3, 4, 5, 6, 0];
  const max = Math.max(goalMinutes + 60, ...weekday.filter((v): v is number => v != null));
  return (
    <View style={{ gap: 8 }}>
      {order.map((d) => {
        const v = weekday[d];
        return (
          <View key={d} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Text style={{ width: 34, fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 12, color: c.text200 }}>{WEEKDAYS[d]}</Text>
            <View style={{ flex: 1, height: 10, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
              {v != null ? <View style={{ width: `${Math.min(100, (v / max) * 100)}%`, height: '100%', borderRadius: 5, backgroundColor: v >= goalMinutes - 15 ? MOON : ORCHID, opacity: v >= goalMinutes - 15 ? 0.9 : 0.7 }} /> : null}
            </View>
            <Text style={{ width: 40, textAlign: 'right', fontVariant: ['tabular-nums'], fontSize: 12, color: v != null ? c.text100 : c.text300 }}>{v != null ? formatHoursCompact(v) : '—'}</Text>
          </View>
        );
      })}
    </View>
  );
}
