import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { Easing, cancelAnimation, interpolate, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { CONSILIUM_SPHERE, MEDI_SPHERE } from './mediTheme';

type Sphere = typeof MEDI_SPHERE | typeof CONSILIUM_SPHERE;

/** One lit sphere: a light top-left, the body, a dark rim — reads as a living presence, not an icon. */
function Ball({ size, sphere, id }: { size: number; sphere: Sphere; id: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        <RadialGradient id={`${id}b`} cx="36%" cy="30%" r="74%">
          <Stop offset="0" stopColor={sphere.light} stopOpacity="1" />
          <Stop offset="0.48" stopColor={sphere.core} stopOpacity="1" />
          <Stop offset="1" stopColor={sphere.deep} stopOpacity="1" />
        </RadialGradient>
        <RadialGradient id={`${id}h`} cx="34%" cy="26%" r="30%">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.85" />
          <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Circle cx="50" cy="50" r="49" fill={`url(#${id}b)`} />
      <Circle cx="50" cy="50" r="49" fill={`url(#${id}h)`} />
    </Svg>
  );
}

/**
 * Medi's presence. One teal sphere; in consilium mode three indigo spheres sit together (specialists
 * reviewing as one). `breathing` adds a slow halo — used for the welcome hero and while Medi thinks.
 */
export function MediOrb({ size = 28, deep = false, breathing = false }: { size?: number; deep?: boolean; breathing?: boolean }) {
  const reduceMotion = usePrefersReducedMotion();
  const pulse = useSharedValue(0);
  const animate = breathing && !reduceMotion;
  useEffect(() => {
    if (!animate) { cancelAnimation(pulse); pulse.value = 0; return; }
    pulse.value = withRepeat(withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.sin) }), -1, true);
    return () => cancelAnimation(pulse);
  }, [animate, pulse]);
  const halo = useAnimatedStyle(() => ({
    opacity: interpolate(pulse.value, [0, 1], [0.55, 1]),
    transform: [{ scale: interpolate(pulse.value, [0, 1], [0.92, 1.12]) }],
  }));
  const sphere = deep ? CONSILIUM_SPHERE : MEDI_SPHERE;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {breathing ? (
        <Animated.View pointerEvents="none" style={[{ position: 'absolute', width: size * 1.9, height: size * 1.9 }, halo]}>
          <Svg width="100%" height="100%" viewBox="0 0 100 100">
            <Defs>
              <RadialGradient id={deep ? 'haloDeep' : 'haloMedi'} cx="50%" cy="50%" r="50%">
                <Stop offset="0.45" stopColor={sphere.light} stopOpacity="0.55" />
                <Stop offset="0.7" stopColor={sphere.core} stopOpacity="0.16" />
                <Stop offset="1" stopColor={sphere.core} stopOpacity="0" />
              </RadialGradient>
            </Defs>
            <Circle cx="50" cy="50" r="50" fill={`url(#${deep ? 'haloDeep' : 'haloMedi'})`} />
          </Svg>
        </Animated.View>
      ) : null}
      {deep ? (
        <View style={{ width: size, height: size }}>
          <View style={{ position: 'absolute', left: 0, top: size * 0.3 }}><Ball size={size * 0.58} sphere={sphere} id="c1" /></View>
          <View style={{ position: 'absolute', right: 0, top: size * 0.3 }}><Ball size={size * 0.58} sphere={sphere} id="c2" /></View>
          <View style={{ position: 'absolute', left: size * 0.21, top: 0 }}><Ball size={size * 0.58} sphere={sphere} id="c3" /></View>
        </View>
      ) : (
        <Ball size={size} sphere={sphere} id="m1" />
      )}
    </View>
  );
}
