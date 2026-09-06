import React, { useEffect, useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { QUEST } from '@/theme/questTokens';
import { useThemeColors } from '@/theme/colors';
import { progressBarFill } from '@/lib/quest/logic.js';

/**
 * Rounded track + brand fill. Width eases to the new percent (measured in px so
 * Reanimated never has to animate a `%` width). Keeps a min round dot when
 * progress is > 0 but tiny so "started" is always visible.
 */
export function QuestProgressBar({
  percent,
  height = QUEST.barDaily,
  color,
  near,
  delay = 0,
}: {
  percent: number;
  height?: number;
  color?: string;
  near?: boolean;
  delay?: number;
}) {
  const colors = useThemeColors();
  const reduce = usePrefersReducedMotion();
  const fillState = progressBarFill(percent);
  const fill = color || (near ? QUEST.accent.movement : colors.primary200);
  const [trackW, setTrackW] = useState(0);
  const width = useSharedValue(0);

  useEffect(() => {
    if (!trackW) return;
    const raw = (fillState.widthPercent / 100) * trackW;
    const px = fillState.visible ? Math.max(fillState.minFill ? height : 0, Math.min(trackW, raw)) : 0;
    if (reduce) {
      width.value = px;
      return;
    }
    width.value = withDelay(
      delay,
      withTiming(px, {
        duration: QUEST.motion.slow,
        easing: Easing.out(Easing.cubic),
      }),
    );
  }, [trackW, fillState.widthPercent, fillState.visible, fillState.minFill, height, reduce, width, delay]);

  const fillStyle = useAnimatedStyle(() => ({ width: width.value }));
  const onLayout = (e: LayoutChangeEvent) => setTrackW(e.nativeEvent.layout.width);

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: fillState.value }}
      onLayout={onLayout}
      style={{
        height,
        borderRadius: 999,
        backgroundColor: colors.bg300,
        overflow: 'hidden',
      }}
    >
      <Animated.View
        style={[
          {
            height: '100%',
            borderRadius: 999,
            backgroundColor: fill,
          },
          fillStyle,
        ]}
      />
    </View>
  );
}
