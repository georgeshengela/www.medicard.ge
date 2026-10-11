import React, { useEffect, useMemo } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withSequence, withTiming, Easing } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

/**
 * The night behind MEDISLEEP's big moments (the hub hero, sleep mode): a deep gradient, a soft glow and a field
 * of stars. A few stars breathe slowly — the only motion, off with Reduce Motion. Deterministic (seeded), so the
 * sky does not jump between renders.
 */
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

type Star = { x: number; y: number; r: number; o: number };

function Twinkle({ star, delay }: { star: Star; delay: number }) {
  const reduce = useReducedMotion();
  const v = useSharedValue(star.o);
  useEffect(() => {
    if (reduce) return;
    v.value = withDelay(delay, withRepeat(withSequence(
      withTiming(Math.min(1, star.o + 0.55), { duration: 2200, easing: Easing.inOut(Easing.sin) }),
      withTiming(star.o * 0.6, { duration: 2600, easing: Easing.inOut(Easing.sin) }),
    ), -1, true));
  }, [reduce, delay, star.o, v]);
  const style = useAnimatedStyle(() => ({ opacity: v.value }));
  const d = star.r * 2 + 2;
  return (
    <Animated.View
      pointerEvents="none"
      style={[{ position: 'absolute', left: `${star.x * 100}%`, top: `${star.y * 100}%`, width: d, height: d, borderRadius: d / 2, backgroundColor: '#FFFFFF', shadowColor: '#FFFFFF', shadowOpacity: 0.9, shadowRadius: 4, shadowOffset: { width: 0, height: 0 } }, style]}
    />
  );
}

export function NightSky({
  style,
  colors = ['#100B2E', '#1F1452', '#3A1D6E'],
  glow = 'rgba(217,168,255,0.28)',
  stars = 46,
  twinkles = 7,
  seed = 7,
  glowAt = { x: 0.82, y: 0.12 },
}: {
  style?: StyleProp<ViewStyle>;
  colors?: [string, string, string];
  glow?: string;
  stars?: number;
  twinkles?: number;
  seed?: number;
  glowAt?: { x: number; y: number };
}) {
  const field = useMemo(() => {
    const rnd = seeded(seed);
    return Array.from({ length: stars }, () => ({ x: rnd(), y: rnd() * 0.92, r: rnd() < 0.85 ? 0.6 + rnd() * 0.6 : 1.2 + rnd() * 0.6, o: 0.25 + rnd() * 0.55 }));
  }, [stars, seed]);
  const bright = field.filter((s) => s.r > 1).slice(0, twinkles);
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, style]}>
      <LinearGradient colors={colors} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} style={StyleSheet.absoluteFill} />
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id="skyGlow" cx={`${glowAt.x * 100}%`} cy={`${glowAt.y * 100}%`} r="60%">
            <Stop offset="0" stopColor={glow} stopOpacity={1} />
            <Stop offset="1" stopColor={glow} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#skyGlow)" />
        {field.filter((s) => s.r <= 1).map((s, i) => (
          <Circle key={i} cx={`${s.x * 100}%`} cy={`${s.y * 100}%`} r={s.r} fill="#FFFFFF" opacity={s.o} />
        ))}
      </Svg>
      {bright.map((s, i) => (
        <Twinkle key={i} star={s} delay={i * 900} />
      ))}
    </View>
  );
}
