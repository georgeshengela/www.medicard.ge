import React, { useEffect, useRef } from 'react';
import { Animated, Dimensions, Easing, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle } from 'react-native-svg';

/** Figma 8846:211832 — brand wash + three overlapping ring bands. */
const FIGMA_W = 375;
const FIGMA_H = 812;
const BRAND_500 = '#14B8A6';
const BRAND_400 = '#2DD4BF';
const RING = '#5EEAD4';

const RINGS = [
  { cx: -321.5, cy: 268.5, r: 652.5, opacity: 0.64 },
  { cx: 373.5, cy: 443.5, r: 321.5, opacity: 1 },
  { cx: -78, cy: 222, r: 273, opacity: 0.32 },
] as const;

export function AnalyzingBackdrop() {
  const spin = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const { width, height } = Dimensions.get('window');

  useEffect(() => {
    Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 32000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    ).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 2200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 2200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, [spin, pulse]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.04] });

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient
        colors={[BRAND_500, BRAND_400, BRAND_500]}
        locations={[0, 0.48, 1]}
        style={StyleSheet.absoluteFill}
      />
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { transform: [{ rotate }, { scale }] },
        ]}
      >
        <Svg width={width} height={height} viewBox={`0 0 ${FIGMA_W} ${FIGMA_H}`}>
          {RINGS.map((ring, i) => (
            <Circle
              key={i}
              cx={ring.cx}
              cy={ring.cy}
              r={ring.r}
              stroke={RING}
              strokeWidth={48}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
              opacity={ring.opacity}
            />
          ))}
        </Svg>
      </Animated.View>
      <LinearGradient
        colors={['rgba(20,184,166,0)', BRAND_500]}
        style={styles.bottomFade}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  bottomFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 200,
  },
});
