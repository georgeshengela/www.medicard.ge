import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useIsFocused } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';

/** Deterministic pseudo-random numbers, so the sky looks the same on every visit. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s ^ (s >>> 15), 2246822507) + 0x6d2b79f5) >>> 0;
    return ((s ^ (s >>> 13)) >>> 0) / 4294967296;
  };
}

function useAppActive() {
  const [active, setActive] = useState(AppState.currentState !== 'background');
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => setActive(next === 'active'));
    return () => sub.remove();
  }, []);
  return active;
}

const Twinkle = memo(function Twinkle({ x, y, r, delay, period }: { x: number; y: number; r: number; delay: number; period: number }) {
  const o = useSharedValue(0.25);
  useEffect(() => {
    o.value = withDelay(delay, withRepeat(withSequence(
      withTiming(1, { duration: period, easing: Easing.inOut(Easing.sin) }),
      withTiming(0.2, { duration: period, easing: Easing.inOut(Easing.sin) }),
    ), -1, false));
  }, [o, delay, period]);
  const style = useAnimatedStyle(() => ({ opacity: o.value, transform: [{ scale: 0.7 + o.value * 0.5 }] }));
  const s = r * 6;
  return (
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: x - s / 2, top: y - s / 2, width: s, height: s, alignItems: 'center', justifyContent: 'center' }, style]}>
      <View style={{ position: 'absolute', width: s, height: 1, backgroundColor: 'rgba(255,248,230,0.55)' }} />
      <View style={{ position: 'absolute', width: 1, height: s, backgroundColor: 'rgba(255,248,230,0.55)' }} />
      <View style={{ width: r * 1.6, height: r * 1.6, borderRadius: r, backgroundColor: '#FFF8E6' }} />
    </Animated.View>
  );
});

type Shot = { key: number; x: number; y: number; angle: number; travel: number; len: number };

/** One shooting star at a time: a fading streak that crosses the upper sky every few seconds. */
const ShootingStars = memo(function ShootingStars({ width, height, running }: { width: number; height: number; running: boolean }) {
  const [shot, setShot] = useState<Shot | null>(null);
  const p = useSharedValue(0);
  const random = useRef(rng(Date.now() % 100000)).current;
  useEffect(() => {
    if (!running) return undefined;
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const next = (first = false) => {
      timer = setTimeout(() => {
        if (!alive) return;
        const travel = width * (0.35 + random() * 0.3);
        setShot({ key: Date.now(), x: width * (0.35 + random() * 0.7), y: height * (0.02 + random() * 0.32), angle: 200 + random() * 22, travel, len: 70 + random() * 70 });
        p.value = 0;
        p.value = withTiming(1, { duration: 950 + random() * 500, easing: Easing.out(Easing.quad) });
        next();
      }, first ? 1200 : 2600 + random() * 4200);
    };
    next(true);
    return () => { alive = false; clearTimeout(timer); };
  }, [running, width, height, p, random]);
  const style = useAnimatedStyle(() => {
    if (!shot) return { opacity: 0 };
    const rad = (shot.angle * Math.PI) / 180;
    const d = p.value * shot.travel;
    const opacity = p.value < 0.15 ? p.value / 0.15 : p.value > 0.7 ? Math.max(0, (1 - p.value) / 0.3) : 1;
    return {
      opacity,
      transform: [{ translateX: shot.x + Math.cos(rad) * d }, { translateY: shot.y - Math.sin(rad) * d }, { rotate: `${-shot.angle}deg` }],
    };
  }, [shot]);
  if (!shot) return null;
  return (
    // The streak's right end is its bright head: it sits on (0,0) before the transform, which moves it along the path.
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: -shot.len, top: -1, width: shot.len, height: 2, transformOrigin: 'right center' }, style]}>
      <LinearGradient colors={['rgba(255,248,230,0)', 'rgba(255,248,230,0.35)', '#FFF8E6']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={{ flex: 1, borderRadius: 1 }} />
    </Animated.View>
  );
});

/**
 * MEDIHOROSCOPE's night: a fixed lapis sky behind the page — a still field of stars (same every visit), a few
 * that twinkle, and now and then a shooting star. Reduced motion keeps only the still sky; everything pauses
 * off-screen and in the background.
 */
export const StarrySky = memo(function StarrySky({ density = 1 }: { density?: number }) {
  const { width, height } = useWindowDimensions();
  const reduced = usePrefersReducedMotion();
  const focused = useIsFocused();
  const active = useAppActive();
  const running = !reduced && focused && active;
  const stars = useMemo(() => {
    const r = rng(1013);
    const count = Math.round(130 * density);
    return Array.from({ length: count }, () => {
      const y = r() ** 1.35 * height; // denser towards the top, like a real night above a city
      return { x: r() * width, y, r: 0.35 + r() ** 3 * 1.1, o: 0.18 + r() * 0.7 };
    });
  }, [width, height, density]);
  const twinkles = useMemo(() => {
    const r = rng(77);
    return Array.from({ length: 9 }, (_, i) => ({ id: i, x: r() * width, y: r() ** 1.5 * height * 0.75, r: 1 + r() * 0.8, delay: Math.round(r() * 3000), period: 1400 + Math.round(r() * 1800) }));
  }, [width, height]);
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <LinearGradient colors={['#03061A', '#0A1134', '#141B48']} locations={[0, 0.55, 1]} style={StyleSheet.absoluteFill} />
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id="hzGlowA" cx="85%" cy="8%" r="55%">
            <Stop offset="0" stopColor="#C99A45" stopOpacity="0.16" />
            <Stop offset="1" stopColor="#C99A45" stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="hzGlowB" cx="10%" cy="70%" r="60%">
            <Stop offset="0" stopColor="#5B4FBF" stopOpacity="0.14" />
            <Stop offset="1" stopColor="#5B4FBF" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect x={0} y={0} width={width} height={height} fill="url(#hzGlowA)" />
        <Rect x={0} y={0} width={width} height={height} fill="url(#hzGlowB)" />
        {stars.map((s, i) => <Circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#FFF8E6" opacity={s.o} />)}
      </Svg>
      {running ? twinkles.map((t) => <Twinkle key={t.id} {...t} />) : null}
      <ShootingStars width={width} height={height} running={running} />
    </View>
  );
});
