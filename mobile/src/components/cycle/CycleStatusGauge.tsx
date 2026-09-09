import React, { useEffect, useMemo } from 'react';
import { Pressable, Text, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import Animated, {
  Easing,
  FadeIn,
  type SharedValue,
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Info } from 'lucide-react-native';
import { MedicardLogoMark } from '@/components/ui/MedicardLogoMark';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { ka } from '@/i18n/ka';
import { useIsDark } from '@/theme/colors';
import { useCycleColors } from '@/theme/cycle';

const AnimatedPath = Animated.createAnimatedComponent(Path);

/** Nightingale 9001:295435, closed to a circle. */
const VB = 316;
const CX = 158;
const CY = 158;
const R = 128;
const TRACK = 32;
const GLOW = 40;
const INNER_R = 93;
const SEGMENTS = 4;
const GAP_DEG = 16.2;
const SEG_SWEEP = (360 - SEGMENTS * GAP_DEG) / SEGMENTS;
const SEG_LEN = R * ((SEG_SWEEP * Math.PI) / 180);
const TRACK_FILL = '#FFE4E6';
const DOT_FILL = '#FDA4AF';

function clamp01(t: number) {
  return Math.min(1, Math.max(0, t));
}

function polar(deg: number, radius = R) {
  const rad = (deg * Math.PI) / 180;
  return { x: CX + radius * Math.cos(rad), y: CY + radius * Math.sin(rad) };
}

function segmentStartDeg(index: number) {
  return -90 + index * 90 - SEG_SWEEP / 2;
}

function segmentPath(index: number, radius = R) {
  const start = segmentStartDeg(index);
  const p0 = polar(start, radius);
  const p1 = polar(start + SEG_SWEEP, radius);
  return `M ${p0.x} ${p0.y} A ${radius} ${radius} 0 0 1 ${p1.x} ${p1.y}`;
}

function fertileSegmentPaths(fromDay: number, toDay: number, length: number) {
  const start = (Math.min(fromDay, toDay) - 1) / length;
  const end = Math.max(fromDay, toDay) / length;
  const out: string[] = [];
  for (let i = 0; i < SEGMENTS; i += 1) {
    const segA = i / SEGMENTS;
    const segB = (i + 1) / SEGMENTS;
    const a = Math.max(start, segA);
    const b = Math.min(end, segB);
    if (b - a < 0.002) continue;
    const t0 = (a - segA) * SEGMENTS;
    const t1 = (b - segA) * SEGMENTS;
    const deg0 = segmentStartDeg(i) + t0 * SEG_SWEEP;
    const deg1 = segmentStartDeg(i) + t1 * SEG_SWEEP;
    const p0 = polar(deg0);
    const p1 = polar(deg1);
    out.push(`M ${p0.x} ${p0.y} A ${R} ${R} 0 0 1 ${p1.x} ${p1.y}`);
  }
  return out;
}

function knobOnTrack(t: number) {
  const filledDeg = clamp01(t) * SEGMENTS * SEG_SWEEP;
  let remaining = filledDeg;
  for (let i = 0; i < SEGMENTS; i += 1) {
    const start = segmentStartDeg(i);
    if (remaining <= SEG_SWEEP + 0.0001) return polar(start + remaining);
    remaining -= SEG_SWEEP;
  }
  return polar(segmentStartDeg(SEGMENTS - 1) + SEG_SWEEP);
}

function SegmentFill({
  d,
  index,
  anim,
  color,
}: {
  d: string;
  index: number;
  anim: SharedValue<number>;
  color: string;
}) {
  const animatedProps = useAnimatedProps(() => {
    const filled = Math.min(SEG_LEN, Math.max(0, anim.value * SEG_LEN * SEGMENTS - index * SEG_LEN));
    return {
      strokeDashoffset: SEG_LEN - filled,
      opacity: filled > 0.35 ? 1 : 0,
    };
  });
  return (
    <AnimatedPath
      d={d}
      stroke={color}
      strokeWidth={TRACK}
      strokeLinecap="round"
      fill="none"
      strokeDasharray={`${SEG_LEN} ${SEG_LEN}`}
      animatedProps={animatedProps}
    />
  );
}

type Props = {
  day: number | null;
  cycleLength: number;
  phaseHint?: string;
  periodActive?: boolean;
  fertileDays?: { from: number; to: number } | null;
  a11yLabel?: string;
  onInfo?: () => void;
  onPressFertile?: () => void;
};

export function CycleStatusGauge({
  day,
  cycleLength,
  phaseHint,
  periodActive,
  fertileDays,
  a11yLabel,
  onInfo,
  onPressFertile,
}: Props) {
  const c = useCycleColors();
  const dark = useIsDark();
  const reduceMotion = usePrefersReducedMotion();
  const { width: screenW, fontScale } = useWindowDimensions();
  const largeText = fontScale >= 1.25;
  const width = Math.min(screenW - 24, largeText ? 240 : 316);
  const height = width;
  const phaseOutside = largeText;
  const length = Math.max(14, Math.round(cycleLength) || 28);
  const progress = day && length ? clamp01(day / length) : 0;
  const anim = useSharedValue(reduceMotion ? progress : 0);
  const knob = knobOnTrack(progress);
  const segments = useMemo(() => Array.from({ length: SEGMENTS }, (_, i) => segmentPath(i)), []);
  const track = dark ? c.blush : TRACK_FILL;
  const dots = dark ? c.rose : DOT_FILL;
  const fill = periodActive ? c.period : c.brand;
  const fertilePaths = useMemo(
    () =>
      fertileDays && length
        ? fertileSegmentPaths(fertileDays.from, fertileDays.to, length)
        : [],
    [fertileDays, length],
  );

  useEffect(() => {
    if (reduceMotion) {
      anim.value = progress;
      return;
    }
    anim.value = withTiming(progress, { duration: 700, easing: Easing.out(Easing.cubic) });
  }, [progress, anim, reduceMotion]);

  return (
    <Animated.View
      entering={reduceMotion ? undefined : FadeIn.duration(500)}
      style={{ alignItems: 'center', width: '100%' }}
    >
      <View style={{ width, height }}>
        <View
          accessible
          accessibilityRole="image"
          accessibilityLabel={a11yLabel}
          style={{ width, height }}
        >
          <Svg width={width} height={height} viewBox={`0 0 ${VB} ${VB}`}>
            <Circle
              cx={CX}
              cy={CY}
              r={158}
              stroke={c.blush}
              strokeWidth={1}
              strokeDasharray="2 10"
              fill="none"
              opacity={0.45}
            />
            <Circle cx={CX} cy={CY} r={R} stroke={c.white} strokeWidth={GLOW} fill="none" opacity={dark ? 0.08 : 0.95} />

            {segments.map((d, i) => (
              <Path
                key={`trk-${i}`}
                d={d}
                stroke={track}
                strokeWidth={TRACK}
                strokeLinecap="round"
                fill="none"
              />
            ))}
            {segments.map((d, i) => (
              <Path
                key={`dot-${i}`}
                d={d}
                stroke={dots}
                strokeWidth={4}
                strokeLinecap="round"
                strokeDasharray="1 32"
                fill="none"
                opacity={0.95}
              />
            ))}
            {segments.map((d, i) => (
              <SegmentFill key={`fill-${i}`} d={d} index={i} anim={anim} color={fill} />
            ))}
            {fertilePaths.map((d, i) => (
              <Path
                key={`fertile-${i}`}
                d={d}
                stroke={c.fertile}
                strokeWidth={TRACK}
                strokeLinecap="round"
                fill="none"
                opacity={0.94}
                onPress={onPressFertile}
              />
            ))}

            {progress > 0.015 ? (
              <>
                <Circle cx={knob.x} cy={knob.y} r={12} fill={c.white} />
                <Circle cx={knob.x} cy={knob.y} r={10} stroke={fill} strokeWidth={2.5} fill={c.white} />
              </>
            ) : null}

            <Circle cx={CX} cy={CY} r={INNER_R} fill={c.card} />
          </Svg>

          <View
            pointerEvents="box-none"
            style={{
              position: 'absolute',
              left: ((CX - INNER_R) / VB) * width,
              top: ((CY - INNER_R) / VB) * height,
              width: ((INNER_R * 2) / VB) * width,
              height: ((INNER_R * 2) / VB) * height,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <View pointerEvents="none" style={{ position: 'absolute', opacity: 0.08 }}>
              <MedicardLogoMark size={Math.round(96 * (width / VB))} color={fill} />
            </View>
            <Text
              style={{
                color: c.ink,
                fontFamily: 'NotoSansGeorgian_700Bold',
                fontSize: Math.round(60 * (width / VB)),
                lineHeight: Math.round(68 * (width / VB)),
                letterSpacing: -1,
                textAlign: 'center',
                fontVariant: ['tabular-nums'],
              }}
            >
              {day ?? '—'}
            </Text>
            <Text
              style={{
                color: c.ink,
                fontFamily: 'NotoSansGeorgian_600SemiBold',
                fontSize: Math.round(16 * (width / VB)),
                lineHeight: Math.round(22 * (width / VB)),
                marginTop: 4,
                textAlign: 'center',
              }}
            >
              {ka.cycle.outOf(length)}
            </Text>
            {phaseHint && !phaseOutside ? (
              onInfo ? (
                <Pressable
                  onPress={onInfo}
                  accessibilityRole="button"
                  accessibilityLabel={ka.cycle.howCalculated}
                  hitSlop={8}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 4,
                    marginTop: 8,
                    maxWidth: '90%',
                    paddingHorizontal: 4,
                    paddingVertical: 4,
                  }}
                >
                  <Text
                    numberOfLines={2}
                    style={{
                      color: periodActive ? c.period : c.muted,
                      fontFamily: 'NotoSansGeorgian_400Regular',
                      fontSize: Math.round(12 * (width / VB)),
                      lineHeight: Math.round(16 * (width / VB)),
                      textAlign: 'center',
                      flexShrink: 1,
                    }}
                  >
                    {phaseHint}
                  </Text>
                  <Info size={16} color={c.muted} strokeWidth={2} />
                </Pressable>
              ) : (
                <Text
                  numberOfLines={2}
                  style={{
                    color: periodActive ? c.period : c.muted,
                    fontFamily: 'NotoSansGeorgian_400Regular',
                    fontSize: Math.round(12 * (width / VB)),
                    lineHeight: Math.round(16 * (width / VB)),
                    marginTop: 8,
                    textAlign: 'center',
                    maxWidth: '88%',
                  }}
                >
                  {phaseHint}
                </Text>
              )
            ) : onInfo ? (
              <Pressable
                onPress={onInfo}
                accessibilityRole="button"
                accessibilityLabel={ka.cycle.howCalculated}
                hitSlop={10}
                style={{ marginTop: 8, padding: 6 }}
              >
                <Info size={16} color={c.muted} strokeWidth={2} />
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>
      {phaseHint && phaseOutside ? (
        <Pressable
          onPress={onInfo}
          disabled={!onInfo}
          accessibilityRole={onInfo ? 'button' : undefined}
          accessibilityLabel={onInfo ? ka.cycle.howCalculated : undefined}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            marginTop: 4,
            marginBottom: 4,
            paddingHorizontal: 16,
          }}
        >
          <Text
            numberOfLines={3}
            style={{
              color: periodActive ? c.period : c.ink,
              fontFamily: 'NotoSansGeorgian_600SemiBold',
              fontSize: 15,
              lineHeight: 21,
              textAlign: 'center',
              flexShrink: 1,
            }}
          >
            {phaseHint}
          </Text>
          {onInfo ? <Info size={16} color={c.muted} strokeWidth={2} /> : null}
        </Pressable>
      ) : null}
    </Animated.View>
  );
}
