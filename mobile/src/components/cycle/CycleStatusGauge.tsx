import { CyclePressable as Pressable } from '@/components/cycle/CyclePressable';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, Text, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, Defs, G, Line, Path, RadialGradient, Stop } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import Animated, {
  Easing,
  FadeIn,
  ZoomIn,
  useAnimatedProps,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { Info } from 'lucide-react-native';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { ka } from '@/i18n/ka';
import { cycleHexAlpha, useCycleColors } from '@/theme/cycle';

/**
 * Cycle dial (2026-09-29 redesign).
 *  - One ring of phase arcs: bleeding (rose) → follicular (apricot) → fertile window (turquoise) → luteal (lilac).
 *    Days already lived are full colour, days ahead are a soft tint of the same phase.
 *  - Inside, a watch-like day scale: one tick per day, longer every 7th; logged bleeding ticks are rose.
 *  - Today is a white knob on the ring that slowly breathes.
 *  - Scrub: drag a finger along the ring to preview any day (date, cycle day, phase) with a light haptic
 *    per day; let go and it returns to today. Tapping the fertile arc still explains the window.
 */
const VB = 300;
const C = VB / 2;
const R = 120;
const BAND = 18;
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export type GaugeCenter = { top?: string | null; value: string; bottom?: string | null; tone?: 'period' | 'ink' };

type Props = {
  day: number | null;
  cycleLength: number;
  /** Usual bleeding length — draws the rose arc when nothing is logged yet this cycle. */
  periodLength?: number;
  hideLengthChrome?: boolean;
  phaseHint?: string;
  periodActive?: boolean;
  recordedPeriodDays?: number[];
  pmsPattern?: boolean;
  fertileDays?: { from: number; to: number } | null;
  a11yLabel?: string;
  center?: GaugeCenter;
  phase?: string;
  /** What the centre shows while the finger rests on cycle day `d`. */
  describeDay?: (d: number) => GaugeCenter | null;
  onInfo?: () => void;
  onPressFertile?: () => void;
};

const toRad = (deg: number) => (deg * Math.PI) / 180;
const point = (deg: number, r = R) => ({ x: C + r * Math.cos(toRad(deg)), y: C + r * Math.sin(toRad(deg)) });
/** Day d (1-based) occupies the slot [d-1, d) of the circle, starting at 12 o'clock. */
const slotDeg = (pos: number, count: number) => -90 + (pos / count) * 360;

function arc(fromDeg: number, toDeg: number, r = R) {
  if (toDeg - fromDeg <= 0.2) return null;
  const p0 = point(fromDeg, r);
  const p1 = point(toDeg, r);
  return `M ${p0.x} ${p0.y} A ${r} ${r} 0 ${toDeg - fromDeg > 180 ? 1 : 0} 1 ${p1.x} ${p1.y}`;
}

export function CycleStatusGauge({
  day,
  cycleLength,
  periodLength = 5,
  hideLengthChrome,
  phaseHint,
  periodActive,
  recordedPeriodDays = [],
  pmsPattern = false,
  fertileDays,
  a11yLabel,
  center,
  phase,
  describeDay,
  onInfo,
  onPressFertile,
}: Props) {
  const c = useCycleColors();
  const reduceMotion = usePrefersReducedMotion();
  const { width: screenW, height: screenH, fontScale } = useWindowDimensions();
  const compact = fontScale >= 1.25 || screenH < 720;
  const size = Math.min(screenW - 72, compact ? 220 : 252);
  const length = hideLengthChrome ? 0 : Math.max(14, Math.round(cycleLength) || 28);
  // A late cycle grows the dial instead of wrapping today back onto day 1.
  const count = length ? Math.max(length, day ?? 0) : 28;
  const recorded = useMemo(() => new Set(recordedPeriodDays), [recordedPeriodDays]);
  const [scrub, setScrub] = useState<number | null>(null);
  const scrubRef = useRef<number | null>(null);

  /** Phase runs over cycle days (bleeding uses logged days when present, else the usual length). */
  const phases = useMemo(() => {
    if (!length) return [];
    const early = recordedPeriodDays.filter((d) => d <= 12);
    const loggedMax = early.length ? Math.max(...early) : 0;
    const periodEnd = Math.max(1, Math.min(loggedMax || periodLength, count));
    const fStart = fertileDays ? Math.min(fertileDays.from, fertileDays.to) : null;
    const fEnd = fertileDays ? Math.max(fertileDays.from, fertileDays.to) : null;
    const out: { kind: 'period' | 'follicular' | 'fertile' | 'luteal'; from: number; to: number }[] = [
      { kind: 'period', from: 1, to: periodEnd },
    ];
    if (fStart != null && fEnd != null && fStart > periodEnd) {
      if (fStart - 1 > periodEnd) out.push({ kind: 'follicular', from: periodEnd + 1, to: fStart - 1 });
      out.push({ kind: 'fertile', from: fStart, to: Math.min(fEnd, count) });
      if (fEnd < count) out.push({ kind: 'luteal', from: fEnd + 1, to: count });
    } else if (periodEnd < count) {
      out.push({ kind: 'follicular', from: periodEnd + 1, to: count });
    }
    return out;
  }, [length, recordedPeriodDays, periodLength, count, fertileDays]);

  const phaseColor = { period: c.period, follicular: c.follicularFill, fertile: c.fertileFill, luteal: c.luteal };
  // Round caps reach half a band past the arc end; pull each end in so neighbours keep a small gap.
  const capDeg = ((BAND / 2 + 2) / R) * (180 / Math.PI);

  const knobDay = scrub ?? (hideLengthChrome ? null : day);
  const knobAt = knobDay != null ? point(slotDeg(knobDay - 0.5, count)) : null;
  const knobPhase = knobDay != null ? phases.find((p) => knobDay >= p.from && knobDay <= p.to)?.kind : undefined;
  const knobColor = knobDay != null && recorded.has(knobDay) ? c.period : knobPhase ? phaseColor[knobPhase] : c.todayRing;

  const glow =
    periodActive || phase === 'period'
      ? c.period
      : phase === 'fertile' || phase === 'ovulation'
        ? c.fertileFill
        : phase === 'luteal'
          ? c.luteal
          : phase === 'follicular'
            ? c.follicularFill
            : c.mutedSoft;

  const breath = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion) {
      breath.value = 0;
      return;
    }
    breath.value = withRepeat(withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [breath, reduceMotion]);
  const haloProps = useAnimatedProps(() => ({ r: BAND * (0.78 + breath.value * 0.28), opacity: 0.28 - breath.value * 0.16 }));

  /** Finger on the ring → cycle day under it (only near the band, so page scrolling still works). */
  const dayAt = (x: number, y: number) => {
    const scale = VB / size;
    const dx = x * scale - C;
    const dy = y * scale - C;
    const dist = Math.hypot(dx, dy);
    if (dist < R - BAND * 2.2 || dist > R + BAND * 1.6) return null;
    let deg = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
    if (deg < 0) deg += 360;
    return Math.min(count, Math.floor((deg / 360) * count) + 1);
  };
  const setScrubDay = (d: number | null) => {
    if (d === scrubRef.current) return;
    scrubRef.current = d;
    setScrub(d);
    if (d != null) Haptics.selectionAsync().catch(() => undefined);
  };
  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: (e) => Boolean(length && describeDay && dayAt(e.nativeEvent.locationX, e.nativeEvent.locationY) != null),
        onMoveShouldSetPanResponder: () => false,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (e) => setScrubDay(dayAt(e.nativeEvent.locationX, e.nativeEvent.locationY)),
        onPanResponderMove: (e) => {
          const d = dayAt(e.nativeEvent.locationX, e.nativeEvent.locationY);
          if (d != null) setScrubDay(d);
        },
        onPanResponderRelease: () => setScrubDay(null),
        onPanResponderTerminate: () => setScrubDay(null),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- geometry inputs only
    [size, count, length, describeDay],
  );

  const scrubCenter = scrub != null && describeDay ? describeDay(scrub) : null;
  const shown = scrubCenter ?? center;
  const valueSize = Math.round(size * 0.24);
  const centerValue = shown?.value ?? (hideLengthChrome ? '—' : day != null ? String(day) : '—');
  // A word („დღეს“) or a range („3–7“) needs less than a lone numeral; adjustsFontSizeToFit is native-only.
  const valueFont = /[^\d]/.test(centerValue) ? Math.round(valueSize * (centerValue.length > 3 ? 0.56 : 0.8)) : valueSize;
  const centerTop = shown ? shown.top : ka.cycle.cycleDay;
  const centerBottom = shown ? shown.bottom : hideLengthChrome ? null : ka.cycle.outOf(length);
  const tickR = R - BAND / 2 - 9;

  return (
    <Animated.View entering={reduceMotion ? undefined : FadeIn.duration(420)} style={{ alignItems: 'center', width: '100%' }}>
      <View
        accessible
        accessibilityRole="image"
        accessibilityLabel={a11yLabel}
        accessibilityHint={describeDay ? ka.cycle.dialHint : undefined}
        style={{ width: size, height: size }}
        {...pan.panHandlers}
      >
        <Animated.View entering={reduceMotion ? undefined : ZoomIn.duration(560).easing(Easing.out(Easing.cubic))} pointerEvents="box-none">
          <Svg width={size} height={size} viewBox={`0 0 ${VB} ${VB}`}>
            <Defs>
              <RadialGradient id="dialGlow" cx="50%" cy="50%" r="50%">
                <Stop offset="0" stopColor={glow} stopOpacity={0.18} />
                <Stop offset="0.75" stopColor={glow} stopOpacity={0.04} />
                <Stop offset="1" stopColor={glow} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Circle cx={C} cy={C} r={tickR - 6} fill="url(#dialGlow)" />

            {/* Watch-like day scale; logged bleeding days are rose ticks. */}
            {length
              ? Array.from({ length: count }, (_, i) => {
                  const d = i + 1;
                  const deg = slotDeg(i + 0.5, count);
                  const long = d === 1 || d % 7 === 0;
                  const logged = recorded.has(d);
                  const p0 = point(deg, tickR);
                  const p1 = point(deg, tickR - (long ? 7 : logged ? 5 : 3));
                  return (
                    <Line
                      key={`t${d}`}
                      x1={p0.x}
                      y1={p0.y}
                      x2={p1.x}
                      y2={p1.y}
                      stroke={logged ? c.period : cycleHexAlpha(c.ink, long ? 0.35 : 0.16)}
                      strokeWidth={logged ? 2.4 : long ? 1.6 : 1.1}
                      strokeLinecap="round"
                    />
                  );
                })
              : null}

            {/* Phase arcs: soft tint for the whole phase, full colour for the days already lived. */}
            {phases.map((p) => {
              const from = slotDeg(p.from - 1, count) + capDeg;
              const to = slotDeg(p.to, count) - capDeg;
              const livedTo = day != null && !hideLengthChrome ? Math.min(to, slotDeg(Math.min(day, p.to), count) - capDeg) : null;
              const base = arc(from, Math.max(from, to));
              const lived = livedTo != null && day != null && day >= p.from ? arc(from, Math.max(from, livedTo)) : null;
              const color = phaseColor[p.kind];
              return (
                <G key={p.kind} onPress={p.kind === 'fertile' ? onPressFertile : undefined}>
                  {base ? <Path d={base} stroke={cycleHexAlpha(color, 0.24)} strokeWidth={BAND} strokeLinecap="round" fill="none" /> : null}
                  {lived ? <Path d={lived} stroke={color} strokeWidth={BAND} strokeLinecap="round" fill="none" /> : null}
                </G>
              );
            })}
            {!length ? <Circle cx={C} cy={C} r={R} fill="none" stroke={cycleHexAlpha(c.ink, 0.06)} strokeWidth={BAND} /> : null}

            {knobAt ? (
              <G>
                {scrub == null ? <AnimatedCircle cx={knobAt.x} cy={knobAt.y} fill={knobColor} animatedProps={haloProps} /> : null}
                <Circle cx={knobAt.x} cy={knobAt.y} r={BAND / 2 + 5} fill={c.card} />
                <Circle cx={knobAt.x} cy={knobAt.y} r={BAND / 2 + 1} fill="none" stroke={knobColor} strokeWidth={3.5} />
                <Circle cx={knobAt.x} cy={knobAt.y} r={3} fill={knobColor} />
              </G>
            ) : null}
          </Svg>
        </Animated.View>

        <View
          pointerEvents="none"
          style={{ position: 'absolute', left: size * 0.2, right: size * 0.2, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}
        >
          {centerTop ? (
            <Text numberOfLines={1} adjustsFontSizeToFit style={{ color: c.muted, fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 13, lineHeight: 18, textAlign: 'center' }}>
              {centerTop}
            </Text>
          ) : null}
          <Animated.Text
            key={centerValue}
            entering={reduceMotion || scrub != null ? undefined : ZoomIn.duration(360)}
            numberOfLines={1}
            adjustsFontSizeToFit
            style={{
              color: shown?.tone === 'period' ? c.period : c.ink,
              fontFamily: 'NotoSansGeorgian_700Bold',
              fontSize: valueFont,
              lineHeight: Math.round(valueSize * 1.18),
              letterSpacing: -1.5,
              textAlign: 'center',
              fontVariant: ['tabular-nums'],
            }}
          >
            {centerValue}
          </Animated.Text>
          {centerBottom ? (
            <Text numberOfLines={2} style={{ color: c.mutedSoft, fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 12, lineHeight: 17, textAlign: 'center' }}>
              {centerBottom}
            </Text>
          ) : null}
        </View>
      </View>

      {phaseHint || pmsPattern ? (
        <Pressable
          onPress={onInfo}
          disabled={!onInfo}
          accessibilityRole={onInfo ? 'button' : undefined}
          accessibilityLabel={onInfo ? `${phaseHint ?? ''}. ${ka.cycle.howCalculated}` : undefined}
          style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 8, minHeight: 44, paddingHorizontal: 8 }}
        >
          {phaseHint ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: periodActive ? c.periodSoft : c.cardSoft }}>
              <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: periodActive ? c.period : glow }} />
              <Text numberOfLines={2} style={{ color: periodActive ? c.period : c.ink, fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 12, lineHeight: 17, flexShrink: 1 }}>
                {phaseHint}
              </Text>
              {onInfo ? <Info size={14} color={c.muted} strokeWidth={2} /> : null}
            </View>
          ) : null}
          {pmsPattern ? (
            <View style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: c.cardSoft }}>
              <Text style={{ color: c.muted, fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 12, lineHeight: 17 }}>{ka.cycle.gaugePmsPattern}</Text>
            </View>
          ) : null}
        </Pressable>
      ) : null}
    </Animated.View>
  );
}
