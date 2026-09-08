import React, { useEffect, useId } from 'react';
import { Pressable, Text, useWindowDimensions, View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Path,
  Stop,
} from 'react-native-svg';
import Animated, {
  Easing,
  FadeIn,
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { MedicardLogoMark } from '@/components/ui/MedicardLogoMark';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { ka } from '@/i18n/ka';
import { useCycleColors } from '@/theme/cycle';

const AnimatedPath = Animated.createAnimatedComponent(Path);

/**
 * CycleStatusGauge — Phase 5 hero (docs/CYCLE_DESIGN.md §4.1).
 * Nightingale score-gauge geometry (Figma 9001:283189 / 9001:295435),
 * re-skinned to MediCard. The arc is one cycle; the knob is today;
 * estimated layers are dashed/hollow by the §24 honesty contract.
 */
const VB_W = 360;
const VB_H = 327;
const CX = 180;
const CY = 165.53;
const R = 128.2;
const START_DEG = 135;
const SWEEP_DEG = 270;
const TRACK_LEN = 603.185;

const GLOW_D =
  'M89.4903 255.841C71.5892 237.94 59.3984 215.132 54.4595 190.303C49.5206 165.473 52.0554 139.737 61.7434 116.348C71.4314 92.9586 87.8375 72.9678 108.887 58.9029C129.937 44.8381 154.684 37.3311 180 37.3311C205.316 37.3311 230.063 44.8381 251.113 58.9029C272.162 72.9678 288.569 92.9586 298.257 116.348C307.945 139.737 310.479 165.473 305.541 190.303C300.602 215.132 288.411 237.94 270.51 255.841';

const SEG_LEFT =
  'M89.4903 255.841C68.4284 234.779 55.3712 207.031 52.5681 177.377C49.7649 147.723 57.3914 118.02 74.1337 93.3844';
const SEG_RIGHT =
  'M270.51 255.841C291.572 234.779 304.629 207.031 307.432 177.377C310.235 147.723 302.609 118.02 285.866 93.3844';
const SEG_TOP =
  'M261.576 66.6938C238.623 47.7107 209.768 37.3268 179.982 37.3311C150.196 37.3353 121.344 47.7273 98.3957 66.7169';

const DASH_BL = 'M68.2771 276.973C45.7157 254.411 30.5135 225.548 24.6712 194.181';
const DASH_BR = 'M291.723 276.973C314.056 254.64 329.183 226.126 335.152 195.112';
const DASH_TL =
  'M22.7954 149.416C26.1748 115.862 40.201 84.2709 62.8226 59.261C85.4442 34.2512 115.474 17.1353 148.521 10.4166';
const DASH_TR =
  'M212.202 10.5654C245.217 17.4385 275.167 34.6946 297.672 59.8099C320.176 84.9252 334.054 116.582 337.277 150.151';

function clamp01(t: number) {
  return Math.min(1, Math.max(0, t));
}

function pointAt(t: number, radius = R) {
  const rad = ((START_DEG + clamp01(t) * SWEEP_DEG) * Math.PI) / 180;
  return { x: CX + radius * Math.cos(rad), y: CY + radius * Math.sin(rad) };
}

/** SVG arc path along the gauge circle between two 0..1 positions. */
function arcPath(from: number, to: number, radius = R) {
  const a = clamp01(Math.min(from, to));
  const b = clamp01(Math.max(from, to));
  if (b - a <= 0.001) return null;
  const p0 = pointAt(a, radius);
  const p1 = pointAt(b, radius);
  const largeArc = (b - a) * SWEEP_DEG > 180 ? 1 : 0;
  return `M ${p0.x} ${p0.y} A ${radius} ${radius} 0 ${largeArc} 1 ${p1.x} ${p1.y}`;
}

type Props = {
  day: number | null;
  cycleLength: number;
  /** Phase line inside the disc — already honesty-labeled by the caller. */
  phaseHint?: string;
  periodActive?: boolean;
  /** Estimated fertile window as 0..1 arc positions (server cycleDay / length). */
  fertileArc?: { from: number; to: number } | null;
  /** Estimated ovulation position 0..1. */
  ovulationT?: number | null;
  /** Predicted next-period start position 0..1 (hollow marker). */
  predictedPeriodT?: number | null;
  /** Concise screen-reader summary (§54). */
  a11yLabel?: string;
  /** Bottom badge tap — "how is this calculated". */
  onInfo?: () => void;
};

export function CycleStatusGauge({
  day,
  cycleLength,
  phaseHint,
  periodActive,
  fertileArc,
  ovulationT,
  predictedPeriodT,
  a11yLabel,
  onInfo,
}: Props) {
  const c = useCycleColors();
  const reduceMotion = usePrefersReducedMotion();
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const { width: screenW, fontScale } = useWindowDimensions();
  const largeText = fontScale >= 1.25;
  const width = Math.min(
    screenW - 48,
    largeText ? 208 : screenW < 380 ? 228 : 268,
  );
  const height = width * (VB_H / VB_W);
  const phaseOutside = largeText;
  const progress = day && cycleLength ? clamp01(day / cycleLength) : 0;
  const anim = useSharedValue(reduceMotion ? progress : 0);
  const knob = pointAt(progress);

  useEffect(() => {
    if (reduceMotion) {
      anim.value = progress;
      return;
    }
    anim.value = withTiming(progress, { duration: 700, easing: Easing.out(Easing.cubic) });
  }, [progress, anim, reduceMotion]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: TRACK_LEN * (1 - anim.value),
  }));

  const track = c.cardSoft;
  const dots = c.border;
  const dash = c.border;
  const fill = periodActive ? c.period : c.brand;
  const glow = c.card;

  const fertilePath = fertileArc ? arcPath(fertileArc.from, fertileArc.to) : null;
  const ovulationPoint = ovulationT != null ? pointAt(ovulationT) : null;
  const predictedPoint = predictedPeriodT != null ? pointAt(predictedPeriodT) : null;

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
        <Svg width={width} height={height} viewBox={`0 0 ${VB_W} ${VB_H}`}>
          <Defs>
            <LinearGradient id={`cycleFill-${uid}`} x1="180" y1="37.3311" x2="180" y2="293.331" gradientUnits="userSpaceOnUse">
              <Stop offset="0" stopColor={fill} stopOpacity={0} />
              <Stop offset="1" stopColor={fill} />
            </LinearGradient>
          </Defs>

          <Path d={DASH_BL} stroke={dash} strokeLinecap="round" strokeLinejoin="round" strokeDasharray="8 8" fill="none" />
          <Path d={DASH_BR} stroke={dash} strokeLinecap="round" strokeLinejoin="round" strokeDasharray="8 8" fill="none" />
          <Path d={DASH_TL} stroke={dash} strokeLinecap="round" strokeLinejoin="round" strokeDasharray="8 8" fill="none" />
          <Path d={DASH_TR} stroke={dash} strokeLinecap="round" strokeLinejoin="round" strokeDasharray="8 8" fill="none" />

          <Path
            d={GLOW_D}
            stroke={glow}
            strokeWidth={40}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            opacity={0.55}
          />

          {[SEG_LEFT, SEG_RIGHT, SEG_TOP].map((d) => (
            <Path
              key={d.slice(0, 18)}
              d={d}
              stroke={track}
              strokeWidth={32}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          ))}

          {[SEG_LEFT, SEG_RIGHT, SEG_TOP].map((d) => (
            <Path
              key={`dot-${d.slice(0, 12)}`}
              d={d}
              stroke={dots}
              strokeWidth={4}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="1 32"
              fill="none"
            />
          ))}

          <AnimatedPath
            d={GLOW_D}
            stroke={`url(#cycleFill-${uid})`}
            strokeWidth={32}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            strokeDasharray={`${TRACK_LEN} ${TRACK_LEN}`}
            animatedProps={animatedProps}
          />

          {/* Estimated fertile window — dashed violet, never solid (§24). */}
          {fertilePath ? (
            <Path
              d={fertilePath}
              stroke={c.fertile}
              strokeWidth={7}
              strokeLinecap="round"
              strokeDasharray="2 8"
              fill="none"
              opacity={0.95}
            />
          ) : null}

          {/* Estimated ovulation — open violet diamond (hollow). */}
          {ovulationPoint ? (
            <Path
              d={`M ${ovulationPoint.x} ${ovulationPoint.y - 8} L ${ovulationPoint.x + 8} ${ovulationPoint.y} L ${ovulationPoint.x} ${ovulationPoint.y + 8} L ${ovulationPoint.x - 8} ${ovulationPoint.y} Z`}
              stroke={c.ovulation}
              strokeWidth={2}
              fill={c.card}
            />
          ) : null}

          {/* Predicted next period — hollow rose ring, not a filled event. */}
          {predictedPoint ? (
            <Circle
              cx={predictedPoint.x}
              cy={predictedPoint.y}
              r={8}
              stroke={c.period}
              strokeWidth={2}
              strokeDasharray="3 3"
              fill={c.card}
            />
          ) : null}

          {/* Today knob — position marker (teal ring by contract). */}
          {progress > 0.02 ? (
            <>
              <Circle cx={knob.x} cy={knob.y} r={11} fill={c.white} />
              <Circle cx={knob.x} cy={knob.y} r={12} stroke={c.todayRing} strokeWidth={2.5} fill="none" />
            </>
          ) : null}

          <Circle cx={180} cy={165.332} r={93} fill={c.card} />
        </Svg>

        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width,
            height,
          }}
        >
          <View
            style={{
              position: 'absolute',
              left: (87 / VB_W) * width,
              top: (78 / VB_H) * height,
              width: (186 / VB_W) * width,
              height: (150 / VB_H) * height,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text
              style={{
                color: c.ink,
                fontFamily: 'NotoSansGeorgian_700Bold',
                fontSize: Math.round(60 * (width / VB_W)),
                lineHeight: Math.round(64 * (width / VB_W)),
                letterSpacing: -1,
                textAlign: 'center',
                fontVariant: ['tabular-nums'],
              }}
            >
              {day ?? '—'}
            </Text>
            <Text
              style={{
                color: c.muted,
                fontFamily: 'NotoSansGeorgian_600SemiBold',
                fontSize: Math.round(15 * (width / VB_W)),
                lineHeight: Math.round(20 * (width / VB_W)),
                marginTop: 2,
                textAlign: 'center',
              }}
            >
              {ka.cycle.outOf(cycleLength)}
            </Text>
            {phaseHint && !phaseOutside ? (
              <Text
                numberOfLines={2}
                style={{
                  color: periodActive ? c.period : c.ink,
                  fontFamily: 'NotoSansGeorgian_600SemiBold',
                  fontSize: Math.round(14 * (width / VB_W)),
                  lineHeight: Math.round(19 * (width / VB_W)),
                  marginTop: 6,
                  textAlign: 'center',
                  maxWidth: '96%',
                }}
              >
                {phaseHint}
              </Text>
            ) : null}
          </View>
        </View>
        </View>

        <Pressable
          onPress={onInfo}
          disabled={!onInfo}
          accessibilityRole={onInfo ? 'button' : undefined}
          accessibilityLabel={onInfo ? ka.cycle.howCalculated : undefined}
          style={{
            position: 'absolute',
            left: (152 / VB_W) * width,
            top: (230.251 / VB_H) * height,
            width: (56 / VB_W) * width,
            height: (56 / VB_W) * width,
            borderRadius: 999,
            backgroundColor: fill,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 3,
            borderColor: 'rgba(255,255,255,0.3)',
          }}
        >
          <MedicardLogoMark size={Math.round(28 * (width / VB_W))} tone="inverse" />
        </Pressable>
      </View>
      {phaseHint && phaseOutside ? (
        <Text
          numberOfLines={3}
          style={{
            color: periodActive ? c.period : c.ink,
            fontFamily: 'NotoSansGeorgian_600SemiBold',
            fontSize: 15,
            lineHeight: 21,
            marginTop: 4,
            marginBottom: 4,
            textAlign: 'center',
            paddingHorizontal: 16,
          }}
        >
          {phaseHint}
        </Text>
      ) : null}
    </Animated.View>
  );
}
