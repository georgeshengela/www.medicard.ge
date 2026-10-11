import React, { useEffect, useMemo, useState } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import Animated, { Easing, cancelAnimation, useAnimatedProps, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { ecgStrip } from '@/components/welcome/ecgTrace';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';

const AnimatedPath = Animated.createAnimatedComponent(Path);

type Props = {
  /** The light that runs along the line. */
  color: string;
  /** The resting line under it. */
  trackColor: string;
  height?: number;
  /** Points between two heartbeats. */
  spacing?: number;
  /** Beats per minute: the light crosses one heartbeat per beat (the heart-rate card). */
  bpm?: number;
  /** Points per second when no `bpm` is given. */
  speed?: number;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

/**
 * The welcome screen's heartbeat, as a thin line across any width: a resting ECG trace with a short
 * light running along it. Used where the app is busy (MEDISCAN reading a file) and where a real pulse
 * is shown (heart rate, at the person's own beats per minute). Still under reduced motion.
 */
export function PulseLine({ color, trackColor, height = 32, spacing = 120, bpm, speed = 200, style, accessibilityLabel }: Props) {
  const reduceMotion = usePrefersReducedMotion();
  const [width, setWidth] = useState(0);
  const strip = useMemo(() => (width > 0 ? ecgStrip(width, height, spacing) : null), [width, height, spacing]);
  const seg = strip ? Math.min(56, strip.beatLength * 0.45) : 0;
  const pace = strip && bpm ? (strip.beatLength * bpm) / 60 : speed;
  const period = strip ? strip.length + seg : 0;

  const s = useSharedValue(0);
  useEffect(() => {
    if (!strip || pace <= 0) return undefined;
    if (reduceMotion) {
      cancelAnimation(s);
      s.value = strip.beatLength * 0.6;
      return undefined;
    }
    s.value = 0;
    s.value = withRepeat(withTiming(period, { duration: (period / pace) * 1000, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(s);
  }, [strip, pace, period, reduceMotion, s]);

  const dash = useAnimatedProps(() => ({ strokeDashoffset: seg - s.value }));

  return (
    <View
      accessible={!!accessibilityLabel}
      accessibilityLabel={accessibilityLabel}
      onLayout={(e) => setWidth(Math.round(e.nativeEvent.layout.width))}
      style={[{ height }, style]}
    >
      {strip ? (
        <Svg width={width} height={height}>
          <Path d={strip.d} fill="none" stroke={trackColor} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
          <AnimatedPath
            d={strip.d}
            fill="none"
            stroke={color}
            strokeOpacity={0.25}
            strokeWidth={6}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={[seg, strip.length + seg]}
            animatedProps={dash}
          />
          <AnimatedPath
            d={strip.d}
            fill="none"
            stroke={color}
            strokeWidth={2.2}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={[seg, strip.length + seg]}
            animatedProps={dash}
          />
        </Svg>
      ) : null}
    </View>
  );
}
