import React, { useEffect } from 'react';
import { Pressable, Text } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Flame } from 'lucide-react-native';
import { useFigmaHomeDashboard } from '@/constants/figmaHomeDashboardLayout';
import { ka } from '@/i18n/ka';

type Props = {
  streak: number;
  onPress?: () => void;
};

/** Header streak chip — flickers while the daily login streak is live. */
export function HomeStreakChip({ streak, onPress }: Props) {
  const FIGMA_HOME_DASHBOARD = useFigmaHomeDashboard();
  const alive = streak > 0;
  const flicker = useSharedValue(1);

  useEffect(() => {
    if (!alive) {
      cancelAnimation(flicker);
      flicker.value = 1;
      return;
    }
    flicker.value = withRepeat(
      withSequence(
        withTiming(1.22, { duration: 260, easing: Easing.inOut(Easing.quad) }),
        withTiming(0.86, { duration: 200, easing: Easing.inOut(Easing.quad) }),
        withTiming(1.14, { duration: 180, easing: Easing.inOut(Easing.quad) }),
        withTiming(0.96, { duration: 240, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      false,
    );
    return () => cancelAnimation(flicker);
  }, [alive, flicker]);

  const flameStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: flicker.value },
      { rotate: `${interpolate(flicker.value, [0.86, 1.22], [-3, 5])}deg` },
    ],
  }));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={ka.checkIn.profileHint(streak)}
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: alive ? FIGMA_HOME_DASHBOARD.warning : 'rgba(255,255,255,0.22)',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
      }}
    >
      <Animated.View style={flameStyle}>
        <Flame size={16} color="#FFFFFF" fill={alive ? '#FFFFFF' : 'transparent'} strokeWidth={2.2} />
      </Animated.View>
      <Text
        style={{
          fontFamily: 'NotoSansGeorgian_500Medium',
          fontSize: 12,
          lineHeight: 16,
          color: '#FFFFFF',
        }}
      >
        {streak}
      </Text>
    </Pressable>
  );
}
