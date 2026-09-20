import { CyclePressable as Pressable } from '@/components/cycle/CyclePressable';
import React, { useEffect, useMemo } from 'react';
import { Text, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import Animated, {
  Easing,
  FadeIn,
  type SharedValue,
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Cloud, Droplets, Info } from 'lucide-react-native';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { ka } from '@/i18n/ka';
import { useCycleColors } from '@/theme/cycle';

const AnimatedPath = Animated.createAnimatedComponent(Path);

/** Nightingale 9001:295435, closed to a circle. */
const VB = 316;
const CX = 158;
const CY = 158;
const R = 128;
const TRACK = 32;
const INNER_R = 93;
const SEGMENTS = 4;
const GAP_DEG = 16.2;
const SEG_SWEEP = (360 - SEGMENTS * GAP_DEG) / SEGMENTS;
const SEG_LEN = R * ((SEG_SWEEP * Math.PI) / 180);

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
  hideLengthChrome?: boolean;
  phaseHint?: string;
  periodActive?: boolean;
  recordedPeriodDays?: number[];
  pmsPattern?: boolean;
  fertileDays?: { from: number; to: number } | null;
  a11yLabel?: string;
  onInfo?: () => void;
  onPressFertile?: () => void;
};

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
  onInfo,
  onPressFertile,
}: Props) {
  const c = useCycleColors();
  const reduceMotion = usePrefersReducedMotion();
  const { width: screenW, height: screenH, fontScale } = useWindowDimensions();
  const largeText = fontScale >= 1.25;
  const shortScreen = screenH < 720;
  const width = Math.min(screenW - 48, largeText || shortScreen ? 204 : 240);
  const height = width;
  const length = hideLengthChrome ? 0 : Math.max(14, Math.round(cycleLength) || 28);
  const progress = hideLengthChrome || !day || !length ? 0 : clamp01(day / length);
  const anim = useSharedValue(reduceMotion ? progress : 0);
  const knob = knobOnTrack(progress);
  const segments = useMemo(() => Array.from({ length: SEGMENTS }, (_, i) => segmentPath(i)), []);
  const track = c.gaugeTrack;
  const fill = periodActive ? c.period : c.gaugeProgress;
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
            {fertilePaths.map((d,i) => <Path key={`estimate-pattern-${i}`} d={d} stroke={c.card}
              strokeWidth={3} strokeLinecap="round" strokeDasharray="1 10" fill="none" pointerEvents="none"/>)}
            {recordedPeriodDays.flatMap(d => fertileSegmentPaths(d, d, length)).map((d, i) => (
              <Path key={`recorded-${i}`} d={d} stroke={c.period} strokeWidth={TRACK} strokeLinecap="round" fill="none"/>
            ))}

            {progress > 0.015 ? (
              <>
                <Circle cx={knob.x} cy={knob.y} r={13} fill={c.card} />
                <Circle cx={knob.x} cy={knob.y} r={10} stroke={c.todayRing} strokeWidth={3} fill={c.card} />
                <Circle cx={knob.x} cy={knob.y} r={4} fill={c.todayRing} />
              </>
            ) : null}

            <Circle cx={CX} cy={CY} r={INNER_R} fill={c.card} stroke={c.gaugeProgress} strokeWidth={1} strokeOpacity={0.12} />
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
            <Text style={{color:c.mutedSoft,fontFamily:'NotoSansGeorgian_500Medium',fontSize:12,lineHeight:18,textAlign:'center'}}>{ka.cycle.cycleDay}</Text>
            <Text
              style={{
                color: c.ink,
                fontFamily: 'NotoSansGeorgian_700Bold',
                fontSize: Math.round(66 * (width / VB)),
                lineHeight: Math.round(76 * (width / VB)),
                letterSpacing: -1,
                textAlign: 'center',
                fontVariant: ['tabular-nums'],
              }}
            >
              {hideLengthChrome ? '—' : day ?? '—'}
            </Text>
            {hideLengthChrome ? null : (
            <Text
              style={{
                color: c.muted,
                fontFamily: 'NotoSansGeorgian_500Medium',
                fontSize: Math.round(16 * (width / VB)),
                lineHeight: Math.round(22 * (width / VB)),
                marginTop: 4,
                textAlign: 'center',
              }}
            >
              {ka.cycle.outOf(length)}
            </Text>
            )}

          </View>
        </View>
      </View>
      {periodActive || pmsPattern ? <View style={{flexDirection:'row',alignItems:'center',gap:8,paddingHorizontal:12,paddingVertical:6,borderRadius:16,backgroundColor:periodActive?c.periodSoft:c.cardSoft,marginTop:4}}>
        {periodActive?<Droplets size={16} color={c.period}/>:<Cloud size={16} color={c.muted}/>}
        <Text style={{color:periodActive?c.period:c.muted,fontSize:12,lineHeight:18,fontFamily:'NotoSansGeorgian_500Medium'}}>{periodActive?'სისხლდენა აღრიცხულია':'PMS · შენს წინა ჩანაწერებში'}</Text>
      </View> : null}
      {phaseHint ? (
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
            minHeight: 44,
          }}
        >
          <Text
            numberOfLines={3}
            style={{
              color: periodActive ? c.period : c.ink,
              fontFamily: 'NotoSansGeorgian_600SemiBold',
              fontSize: 13,
              lineHeight: 19,
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
