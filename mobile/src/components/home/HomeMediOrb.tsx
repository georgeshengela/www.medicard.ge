import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { AudioLines } from 'lucide-react-native';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';

const PULSE_MS = 2000;

/** Medi's entry point, with a slow breathing ring so the assistant reads as present, not static. */
export function HomeMediOrb({
  size = 60,
  background,
  ringColor,
  iconColor,
}: {
  size?: number;
  background: string;
  ringColor: string;
  iconColor: string;
}) {
  const reduceMotion = usePrefersReducedMotion();
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    pulse.value = withRepeat(withTiming(1, { duration: PULSE_MS, easing: Easing.out(Easing.cubic) }), -1, false);
  }, [pulse, reduceMotion]);

  const ringStyle = useAnimatedStyle(() => ({
    opacity: reduceMotion ? 0.25 : interpolate(pulse.value, [0, 1], [0.45, 0]),
    transform: [{ scale: reduceMotion ? 1.1 : interpolate(pulse.value, [0, 1], [1, 1.4]) }],
  }));

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: 'absolute',
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: 1.5,
            borderColor: ringColor,
          },
          ringStyle,
        ]}
      />
      <View
        style={{
          width: size - 8,
          height: size - 8,
          borderRadius: (size - 8) / 2,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: background,
        }}
      >
        <AudioLines size={size * 0.5} strokeWidth={1.8} color={iconColor} />
      </View>
    </View>
  );
}
