import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { Easing, cancelAnimation, interpolate, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient, Path, RadialGradient, Stop } from 'react-native-svg';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';

const DEEP = '#083344', CORE = '#0891B2', BRIGHT = '#22D3EE', ICE = '#CFFAFE';

/**
 * MEDISCAN's one bold element (owner 2026-10-04, replacing the flask viewfinder): a glass lens with a
 * soft breathing glow and one thin arc of light orbiting it, the way a scanner reads. Same family as
 * Medi's sphere. `scanning` speeds the orbit while something is being read.
 */
export function ScanLens({ size = 104, scanning = false }: { size?: number; scanning?: boolean }) {
  const reduceMotion = usePrefersReducedMotion();
  const orbit = useSharedValue(0);
  const breath = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion) { cancelAnimation(orbit); cancelAnimation(breath); return; }
    orbit.value = 0;
    orbit.value = withRepeat(withTiming(1, { duration: scanning ? 1600 : 5200, easing: Easing.linear }), -1, false);
    breath.value = withRepeat(withTiming(1, { duration: 2400, easing: Easing.inOut(Easing.sin) }), -1, true);
    return () => { cancelAnimation(orbit); cancelAnimation(breath); };
  }, [reduceMotion, scanning, orbit, breath]);
  const spin = useAnimatedStyle(() => ({ transform: [{ rotate: `${orbit.value * 360}deg` }] }));
  const halo = useAnimatedStyle(() => ({
    opacity: interpolate(breath.value, [0, 1], [0.55, 1]),
    transform: [{ scale: interpolate(breath.value, [0, 1], [0.94, 1.08]) }],
  }));
  const ring = size * 1.0;
  return (
    <View accessible={false} style={{ width: size * 1.7, height: size * 1.7, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View pointerEvents="none" style={[{ position: 'absolute', width: size * 1.7, height: size * 1.7 }, halo]}>
        <Svg width="100%" height="100%" viewBox="0 0 100 100">
          <Defs>
            <RadialGradient id="lensHalo" cx="50%" cy="50%" r="50%">
              <Stop offset="0.38" stopColor={BRIGHT} stopOpacity="0.42" />
              <Stop offset="0.66" stopColor={CORE} stopOpacity="0.12" />
              <Stop offset="1" stopColor={CORE} stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Circle cx="50" cy="50" r="50" fill="url(#lensHalo)" />
        </Svg>
      </Animated.View>
      <View style={{ width: ring, height: ring }}>
        <Svg width="100%" height="100%" viewBox="0 0 100 100">
          <Defs>
            <LinearGradient id="lensRing" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={ICE} stopOpacity="0.95" />
              <Stop offset="0.5" stopColor={BRIGHT} stopOpacity="0.9" />
              <Stop offset="1" stopColor={DEEP} stopOpacity="0.9" />
            </LinearGradient>
            <RadialGradient id="lensCore" cx="38%" cy="34%" r="70%">
              <Stop offset="0" stopColor={ICE} stopOpacity="1" />
              <Stop offset="0.35" stopColor={BRIGHT} stopOpacity="1" />
              <Stop offset="0.75" stopColor={CORE} stopOpacity="1" />
              <Stop offset="1" stopColor={DEEP} stopOpacity="1" />
            </RadialGradient>
          </Defs>
          {/* Glass ring, a faint inner ring, then the lit core with its highlight. */}
          <Circle cx="50" cy="50" r="44" fill="none" stroke="url(#lensRing)" strokeWidth="5" />
          <Circle cx="50" cy="50" r="34" fill="none" stroke={BRIGHT} strokeOpacity="0.28" strokeWidth="1" />
          <Circle cx="50" cy="50" r="24" fill="url(#lensCore)" />
          <Circle cx="42" cy="41" r="5" fill="#FFFFFF" fillOpacity="0.75" />
        </Svg>
        <Animated.View pointerEvents="none" style={[{ position: 'absolute', top: 0, left: 0, width: ring, height: ring }, spin]}>
          <Svg width="100%" height="100%" viewBox="0 0 100 100">
            <Path d="M 50 1.5 A 48.5 48.5 0 0 1 95.6 33.4" fill="none" stroke={ICE} strokeWidth="2.2" strokeLinecap="round" strokeOpacity="0.95" />
            <Circle cx="95.6" cy="33.4" r="2.6" fill="#FFFFFF" />
          </Svg>
        </Animated.View>
      </View>
    </View>
  );
}
