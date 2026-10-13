import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { MediMascot, type MascotMood } from '@/components/medi/mascot/MediMascot';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';

/**
 * The Oracle — Medi in a witch hat (MEDIHOROSCOPE's own assistant) standing in a soft moonlit halo that breathes
 * while it „reads the stars“ (`glow`). The hat moves with Medi's head in every clip.
 */
export function OracleMascot({ size = 120, mood = 'idle', glow = false, onPress, label }: { size?: number; mood?: MascotMood; glow?: boolean; onPress?: () => void; label?: string }) {
  const reduced = usePrefersReducedMotion();
  const pulse = useSharedValue(0);
  useEffect(() => {
    if (reduced || !glow) { pulse.value = withTiming(glow ? 0.6 : 0, { duration: 300 }); return; }
    pulse.value = withRepeat(withTiming(1, { duration: 1300, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [glow, reduced, pulse]);
  const halo = useAnimatedStyle(() => ({ opacity: 0.45 + pulse.value * 0.55, transform: [{ scale: 0.92 + pulse.value * 0.12 }] }));
  const w = size * 0.95;
  return (
    <View style={{ width: w, height: size, alignItems: 'center', justifyContent: 'flex-end' }}>
      <Animated.View pointerEvents="none" style={[{ position: 'absolute', bottom: -size * 0.08, width: w * 1.2, height: w * 1.2, alignSelf: 'center' }, halo]}>
        <Svg width="100%" height="100%" viewBox="0 0 100 100">
          <Defs>
            <RadialGradient id="oracleHalo" cx="50%" cy="58%" r="50%">
              <Stop offset="0" stopColor="#B9A6FF" stopOpacity="0.42" />
              <Stop offset="0.55" stopColor="#E9C77E" stopOpacity="0.12" />
              <Stop offset="1" stopColor="#E9C77E" stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Circle cx={50} cy={50} r={50} fill="url(#oracleHalo)" />
        </Svg>
      </Animated.View>
      <MediMascot mood={mood} size={size} crop="hat" hat="witch" onPress={onPress} accessibilityLabel={label} giggle={!onPress} />
    </View>
  );
}
