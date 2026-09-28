import { CyclePressable as Pressable } from '@/components/cycle/CyclePressable';
import React, { useEffect, useMemo } from 'react';
import { Text, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, Defs, G, Path, RadialGradient, Stop } from 'react-native-svg';
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
 * Cycle ring (2026-09-28 redesign): one bead per cycle day, read clockwise from the top.
 * Grammar shared with the day strip and calendar — logged = solid, estimated = outline:
 *  - logged bleeding: solid clay bead
 *  - estimated fertile window: soft blue bead (tap → explanation) — same blue as the calendar
 *  - days already lived: quiet filled bead; days ahead: track bead
 *  - today: a larger teal marker
 * The centre carries one number and its words; the hero decides which (countdown or cycle day).
 */
const VB = 300;
const C = VB / 2;
const R = 128;

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
/** Width of the soft phase band the beads sit on. */
const BAND = 22;

/** Arc through the bead positions of days a..b (1-based); butt ends so neighbouring bands meet cleanly. */
function arcPath(a: number, b: number, count: number) {
  const step = 360 / count;
  const d0 = -90 + ((a - 1) / count) * 360 - step * 0.47;
  const d1 = -90 + ((b - 1) / count) * 360 + step * 0.47;
  const p0 = { x: C + R * Math.cos((d0 * Math.PI) / 180), y: C + R * Math.sin((d0 * Math.PI) / 180) };
  const p1 = { x: C + R * Math.cos((d1 * Math.PI) / 180), y: C + R * Math.sin((d1 * Math.PI) / 180) };
  return `M ${p0.x} ${p0.y} A ${R} ${R} 0 ${d1 - d0 > 180 ? 1 : 0} 1 ${p1.x} ${p1.y}`;
}

export type GaugeCenter = { top?: string | null; value: string; bottom?: string | null; tone?: 'period' | 'ink' };

type Props = {
  day: number | null;
  cycleLength: number;
  hideLengthChrome?: boolean;
  phaseHint?: string;
  periodActive?: boolean;
  recordedPeriodDays?: number[];
  pmsPattern?: boolean;
  fertileDays?: { from: number; to: number } | null;
  a11yLabel?: string;
  center?: GaugeCenter;
  /** Current phase id (period / follicular / fertile / ovulation / luteal / unknown) — tints the centre glow. */
  phase?: string;
  onInfo?: () => void;
  onPressFertile?: () => void;
};

function beadPoint(index: number, count: number) {
  const deg = -90 + (index / count) * 360;
  const rad = (deg * Math.PI) / 180;
  return { x: C + R * Math.cos(rad), y: C + R * Math.sin(rad) };
}

export function CycleStatusGauge({
  day,
  cycleLength,
  hideLengthChrome,
  phaseHint,
  periodActive,
  recordedPeriodDays = [],
  pmsPattern = false,
  fertileDays,
  a11yLabel,
  center,
  phase,
  onInfo,
  onPressFertile,
}: Props) {
  const c = useCycleColors();
  const reduceMotion = usePrefersReducedMotion();
  const { width: screenW, height: screenH, fontScale } = useWindowDimensions();
  const compact = fontScale >= 1.25 || screenH < 720;
  const size = Math.min(screenW - 72, compact ? 212 : 244);
  const length = hideLengthChrome ? 0 : Math.max(14, Math.round(cycleLength) || 28);
  // Late cycles run past the usual length: grow the ring instead of wrapping today onto day 1.
  const count = length ? Math.max(length, day ?? 0) : 28;
  const beadR = Math.min(6.4, ((2 * Math.PI * R) / count) * 0.26);
  const recorded = useMemo(() => new Set(recordedPeriodDays), [recordedPeriodDays]);

  const beads = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const d = i + 1;
        const p = beadPoint(i, count);
        const isToday = !hideLengthChrome && day === d;
        const logged = recorded.has(d);
        const fertile = Boolean(fertileDays && d >= Math.min(fertileDays.from, fertileDays.to) && d <= Math.max(fertileDays.from, fertileDays.to));
        const lived = !hideLengthChrome && day != null && d < day;
        return { d, ...p, isToday, logged, fertile, lived };
      }),
    [count, day, hideLengthChrome, recorded, fertileDays],
  );

  const todayBead = beads.find((b) => b.isToday);

  /** Soft bands behind the beads: bleeding (rose), fertile window (turquoise), the days after it (lilac). */
  const bands = useMemo(() => {
    const fertileEnd = fertileDays ? Math.max(fertileDays.from, fertileDays.to) : null;
    const kindOf = (b: (typeof beads)[number]) =>
      b.logged ? 'period' : b.fertile ? 'fertile' : fertileEnd != null && b.d > fertileEnd ? 'luteal' : null;
    const runs: { kind: 'period' | 'fertile' | 'luteal'; from: number; to: number }[] = [];
    for (const b of beads) {
      const kind = kindOf(b);
      const last = runs[runs.length - 1];
      if (kind && last && last.kind === kind && last.to === b.d - 1) last.to = b.d;
      else if (kind) runs.push({ kind, from: b.d, to: b.d });
    }
    return runs;
  }, [beads, fertileDays]);
  const bandColor = { period: cycleHexAlpha(c.period, 0.13), fertile: cycleHexAlpha(c.fertileFill, 0.18), luteal: cycleHexAlpha(c.luteal, 0.11) };
  const glow =
    periodActive || phase === 'period'
      ? c.period
      : phase === 'fertile' || phase === 'ovulation'
        ? c.fertileFill
        : phase === 'luteal'
          ? c.luteal
          : phase === 'follicular'
            ? c.follicular
            : c.mutedSoft;

  // Today "breathes": a slow halo, still when the person prefers reduced motion.
  const breath = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion) {
      breath.value = 0;
      return;
    }
    breath.value = withRepeat(withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [breath, reduceMotion]);
  const haloProps = useAnimatedProps(() => ({
    r: beadR * (2.1 + breath.value * 0.7),
    opacity: 0.22 - breath.value * 0.12,
  }));
  const valueSize = Math.round(size * 0.25);
  const centerValue = center?.value ?? (hideLengthChrome ? '—' : day != null ? String(day) : '—');
  const centerTop = center ? center.top : ka.cycle.cycleDay;
  const centerBottom = center ? center.bottom : hideLengthChrome ? null : ka.cycle.outOf(length);

  return (
    <Animated.View entering={reduceMotion ? undefined : FadeIn.duration(420)} style={{ alignItems: 'center', width: '100%' }}>
      <View accessible accessibilityRole="image" accessibilityLabel={a11yLabel} style={{ width: size, height: size }}>
        <Animated.View entering={reduceMotion ? undefined : ZoomIn.duration(520).easing(Easing.out(Easing.cubic))}>
        <Svg width={size} height={size} viewBox={`0 0 ${VB} ${VB}`}>
          <Defs>
            <RadialGradient id="cycleGlow" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={glow} stopOpacity={0.16} />
              <Stop offset="0.7" stopColor={glow} stopOpacity={0.05} />
              <Stop offset="1" stopColor={glow} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          {/* Centre glow in the colour of today's phase, and a hairline that frames the number. */}
          <Circle cx={C} cy={C} r={R - BAND / 2 - 4} fill="url(#cycleGlow)" />
          <Circle cx={C} cy={C} r={R - BAND / 2 - 4} fill="none" stroke={cycleHexAlpha(c.ink, 0.06)} strokeWidth={1} />
          {/* Neutral track, then the phase bands. */}
          <Circle cx={C} cy={C} r={R} fill="none" stroke={cycleHexAlpha(c.ink, 0.035)} strokeWidth={BAND} />
          {bands.map((run) => (
            <Path
              key={`${run.kind}-${run.from}`}
              d={arcPath(run.from, run.to, count)}
              stroke={bandColor[run.kind]}
              strokeWidth={BAND}
              strokeLinecap="butt"
              fill="none"
            />
          ))}
          <G>
            {beads.map((b) => {
              if (b.isToday) return null;
              if (b.logged) return <Circle key={b.d} cx={b.x} cy={b.y} r={beadR} fill={c.period} />;
              if (b.fertile) {
                return (
                  <Circle
                    key={b.d}
                    cx={b.x}
                    cy={b.y}
                    r={beadR}
                    fill={c.fertileFill}
                    opacity={b.lived ? 0.45 : 1}
                    onPress={onPressFertile}
                  />
                );
              }
              return (
                <Circle
                  key={b.d}
                  cx={b.x}
                  cy={b.y}
                  r={beadR * (b.lived ? 0.7 : 0.55)}
                  fill={b.lived ? cycleHexAlpha(c.ink, 0.3) : cycleHexAlpha(c.ink, 0.16)}
                />
              );
            })}
          </G>
          {todayBead ? (
            <G>
              <AnimatedCircle cx={todayBead.x} cy={todayBead.y} fill={todayBead.logged ? c.period : c.todayRing} animatedProps={haloProps} />
              <Circle cx={todayBead.x} cy={todayBead.y} r={beadR * 1.55} fill={todayBead.logged ? c.period : c.todayRing} stroke={c.card} strokeWidth={3} />
            </G>
          ) : null}
        </Svg>
        </Animated.View>

        <View
          pointerEvents="none"
          style={{ position: 'absolute', left: size * 0.18, right: size * 0.18, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}
        >
          {centerTop ? (
            <Text numberOfLines={1} adjustsFontSizeToFit style={{ color: c.muted, fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 13, lineHeight: 18, textAlign: 'center' }}>
              {centerTop}
            </Text>
          ) : null}
          <Animated.Text
            key={centerValue}
            entering={reduceMotion ? undefined : ZoomIn.duration(360)}
            numberOfLines={1}
            adjustsFontSizeToFit
            style={{
              color: center?.tone === 'period' ? c.period : c.ink,
              fontFamily: 'NotoSansGeorgian_700Bold',
              fontSize: valueSize,
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
          style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 10, minHeight: 44, paddingHorizontal: 8 }}
        >
          {phaseHint ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: periodActive ? c.periodSoft : c.cardSoft }}>
              <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: periodActive ? c.period : c.luteal }} />
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
