import React, { useEffect } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Gift } from 'lucide-react-native';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { useIsDark, useThemeColors } from '@/theme/colors';

type Props = {
  label: string;
  onPress?: () => void;
  loading?: boolean;
  disabled?: boolean;
  size?: 'sm' | 'md';
};

/**
 * The one "reward" CTA in Quest. Filled brand, press-scale spring, and a slow
 * sheen sweep while idle so a waiting reward catches the eye without shouting.
 */
export function QuestClaimButton({ label, onPress, loading, disabled, size = 'md' }: Props) {
  const colors = useThemeColors();
  const dark = useIsDark();
  const reduce = usePrefersReducedMotion();
  const inactive = Boolean(disabled || loading);
  const scale = useSharedValue(1);
  const sheen = useSharedValue(-1);

  useEffect(() => {
    if (reduce || inactive) {
      cancelAnimation(sheen);
      sheen.value = -1;
      return;
    }
    sheen.value = withRepeat(
      withSequence(
        withTiming(1.4, { duration: 1100, easing: Easing.inOut(Easing.quad) }),
        withTiming(1.4, { duration: 2400 }),
        withTiming(-1, { duration: 0 }),
      ),
      -1,
      false,
    );
    return () => cancelAnimation(sheen);
  }, [reduce, inactive, sheen]);

  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const sheenStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: sheen.value * 260 }, { rotate: '22deg' }],
  }));

  const height = size === 'md' ? 48 : 40;
  const fill = dark ? '#0D9488' : colors.primary200;

  return (
    <Animated.View style={pressStyle}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled: inactive, busy: Boolean(loading) }}
        disabled={inactive}
        onPress={onPress}
        onPressIn={() => {
          if (!reduce) scale.value = withSpring(0.97, { damping: 18, stiffness: 320 });
        }}
        onPressOut={() => {
          if (!reduce) scale.value = withSpring(1, { damping: 14, stiffness: 260 });
        }}
        style={{
          height,
          borderRadius: 16,
          backgroundColor: fill,
          opacity: inactive && !loading ? 0.45 : 1,
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        {!reduce && !inactive ? (
          <Animated.View
            pointerEvents="none"
            style={[
              {
                position: 'absolute',
                left: 0,
                top: -24,
                bottom: -24,
                width: 26,
                backgroundColor: 'rgba(255,255,255,0.18)',
              },
              sheenStyle,
            ]}
          />
        ) : null}
        {loading ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Gift size={size === 'md' ? 18 : 16} color="#FFFFFF" strokeWidth={2.3} />
            <Text
              style={{
                fontFamily: 'NotoSansGeorgian_700Bold',
                fontSize: size === 'md' ? 15 : 14,
                lineHeight: size === 'md' ? 20 : 18,
                color: '#FFFFFF',
              }}
            >
              {label}
            </Text>
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}