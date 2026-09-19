import React, { useEffect } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import {
  LANDING_RING_COLOR,
  LANDING_RING_STROKE,
  LANDING_RINGS,
  landingCanvasOffsetY,
  landingCanvasScale,
  landingRingBox,
  type LandingRing,
} from '@/constants/figmaWelcomeLayout';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';

const APPEAR_MS = 920;
const BREATHE_MS = 5600;
const HIGHLIGHT = {
  outer: { arc: 0.16, opacity: 0.42 },
  middle: { arc: 0.22, opacity: 0.78 },
  inner: { arc: 0.18, opacity: 0.5 },
} as const;

function Ring({
  ring,
  scale,
  offsetY,
  index,
  reduceMotion,
}: {
  ring: LandingRing;
  scale: number;
  offsetY: number;
  index: number;
  reduceMotion: boolean;
}) {
  const box = landingRingBox(ring, scale, offsetY);
  const circumference = 2 * Math.PI * ring.radius;
  const highlight = HIGHLIGHT[ring.id];
  const appear = useSharedValue(reduceMotion ? 1 : 0);
  const spin = useSharedValue(0);
  const breathe = useSharedValue(0);

  useEffect(() => {
    appear.value = withDelay(
      index * 120,
      withTiming(1, { duration: APPEAR_MS, easing: Easing.out(Easing.cubic) }),
    );
    if (reduceMotion) return;

    spin.value = withRepeat(
      withTiming(1, { duration: ring.durationMs, easing: Easing.linear }),
      -1,
      false,
    );
    breathe.value = withDelay(
      index * 180,
      withRepeat(
        withSequence(
          withTiming(1, { duration: BREATHE_MS, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: BREATHE_MS, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        false,
      ),
    );
  }, [appear, breathe, index, reduceMotion, ring.durationMs, spin]);

  const motionStyle = useAnimatedStyle(() => {
    const shown = appear.value;
    return {
      opacity: shown,
      transform: [
        { translateX: interpolate(breathe.value, [0, 1], [0, ring.driftX * scale]) },
        { translateY: interpolate(breathe.value, [0, 1], [0, ring.driftY * scale]) },
        { rotate: `${spin.value * 360 * ring.direction}deg` },
        {
          scale:
            interpolate(shown, [0, 1], [0.84, 1]) *
            interpolate(breathe.value, [0, 1], [1, ring.scaleTo]),
        },
      ],
    };
  });

  const cx = ring.viewBox / 2;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          left: box.left,
          top: box.top,
          width: box.size,
          height: box.size,
        },
        motionStyle,
      ]}
    >
      <Svg width={box.size} height={box.size} viewBox={`0 0 ${ring.viewBox} ${ring.viewBox}`}>
        <Circle
          cx={cx}
          cy={cx}
          r={ring.radius}
          fill="none"
          stroke={LANDING_RING_COLOR}
          strokeWidth={LANDING_RING_STROKE}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={ring.opacity}
        />
        <Circle
          cx={cx}
          cy={cx}
          r={ring.radius}
          fill="none"
          stroke="#CCFBF1"
          strokeWidth={LANDING_RING_STROKE}
          strokeLinecap="round"
          opacity={highlight.opacity}
          strokeDasharray={`${circumference * highlight.arc} ${circumference * (1 - highlight.arc)}`}
        />
      </Svg>
    </Animated.View>
  );
}

/** Figma 8846:211832 rings — GPU rotate / drift / scale, no SVG dash drawing. */
export function WelcomeCircleField() {
  const { width, height } = useWindowDimensions();
  const reduceMotion = usePrefersReducedMotion();
  const scale = landingCanvasScale(width);
  const offsetY = landingCanvasOffsetY(height, scale);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {LANDING_RINGS.map((ring, index) => (
        <Ring
          key={ring.id}
          ring={ring}
          scale={scale}
          offsetY={offsetY}
          index={index}
          reduceMotion={reduceMotion}
        />
      ))}
    </View>
  );
}
