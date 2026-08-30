import React, { useEffect, useId } from 'react';
import { Text, useWindowDimensions, View } from 'react-native';
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

/** Figma 9001:295435 — Nightingale score gauge, cycle day readout. */
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

function knobPoint(t: number) {
  const clamped = Math.min(1, Math.max(0, t));
  const rad = ((START_DEG + clamped * SWEEP_DEG) * Math.PI) / 180;
  return { x: CX + R * Math.cos(rad), y: CY + R * Math.sin(rad) };
}

type Props = {
  day: number | null;
  cycleLength: number;
  label: string;
  phaseHint?: string;
  periodActive?: boolean;
};

export function CycleRing({ day, cycleLength, label, phaseHint, periodActive }: Props) {
  const c = useCycleColors();
  const reduceMotion = usePrefersReducedMotion();
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const { width: screenW } = useWindowDimensions();
  const width = Math.min(screenW - 64, 320);
  const height = width * (VB_H / VB_W);
  const progress = day && cycleLength ? Math.min(1, Math.max(0, day / cycleLength)) : 0;
  const anim = useSharedValue(reduceMotion ? progress : 0);
  const knob = knobPoint(progress);

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

  return (
    <Animated.View entering={FadeIn.duration(500)} style={{ alignItems: 'center', width: '100%' }}>
      <View style={{ width, height }}>
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

          {progress > 0.02 ? (
            <>
              <Circle cx={knob.x} cy={knob.y} r={11} fill={c.white} />
              <Circle cx={knob.x} cy={knob.y} r={12} stroke={fill} strokeWidth={2} fill="none" />
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
              }}
            >
              {day ?? '—'}
            </Text>
            <Text
              style={{
                color: c.ink,
                fontFamily: 'NotoSansGeorgian_600SemiBold',
                fontSize: Math.round(16 * (width / VB_W)),
                lineHeight: Math.round(22 * (width / VB_W)),
                marginTop: 2,
                textAlign: 'center',
              }}
            >
              {ka.cycle.outOf(cycleLength)}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 }}>
              <Text
                style={{
                  color: c.muted,
                  fontFamily: 'NotoSansGeorgian_400Regular',
                  fontSize: 12,
                  lineHeight: 16,
                }}
              >
                {label}
              </Text>
              <Svg width={16} height={16} viewBox="0 0 16 16">
                <Path
                  d="M8 7.5C8.27614 7.5 8.5 7.72386 8.5 8V11.3333C8.5 11.6095 8.27614 11.8333 8 11.8333C7.72386 11.8333 7.5 11.6095 7.5 11.3333V8C7.5 7.72386 7.72386 7.5 8 7.5Z"
                  fill="#9CA3AF"
                />
                <Path
                  d="M8 4.66667C8.46024 4.66667 8.83333 5.03976 8.83333 5.5C8.83333 5.96024 8.46024 6.33333 8 6.33333C7.53976 6.33333 7.16667 5.96024 7.16667 5.5C7.16667 5.03976 7.53976 4.66667 8 4.66667Z"
                  fill="#9CA3AF"
                />
                <Path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M8 1.5C11.5899 1.5 14.5 4.41015 14.5 8C14.5 11.5899 11.5899 14.5 8 14.5C4.41015 14.5 1.5 11.5899 1.5 8C1.5 4.41015 4.41015 1.5 8 1.5ZM8 2.5C4.96243 2.5 2.5 4.96243 2.5 8C2.5 11.0376 4.96243 13.5 8 13.5C11.0376 13.5 13.5 11.0376 13.5 8C13.5 4.96243 11.0376 2.5 8 2.5Z"
                  fill="#9CA3AF"
                />
              </Svg>
            </View>
          </View>
        </View>

        <View
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
        </View>
      </View>

      {phaseHint ? (
        <View
          style={{
            marginTop: 4,
            maxWidth: '92%',
            backgroundColor: c.roseSoft,
            borderWidth: 1,
            borderColor: c.border,
            paddingHorizontal: 14,
            paddingVertical: 7,
            borderRadius: 999,
          }}
        >
          <Text
            style={{
              color: c.rose,
              fontFamily: 'NotoSansGeorgian_600SemiBold',
              fontSize: 13,
              textAlign: 'center',
              lineHeight: 18,
            }}
            numberOfLines={2}
          >
            {phaseHint}
          </Text>
        </View>
      ) : null}
    </Animated.View>
  );
}
