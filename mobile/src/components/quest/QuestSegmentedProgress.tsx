import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { QUEST } from '@/theme/questTokens';
import { useThemeColors } from '@/theme/colors';

export type QuestSegmentState = 'done' | 'ready' | 'active';

/**
 * One rounded segment per daily mission. Done = brand fill, ready = brand
 * outline pulse-free (claim waits), active = track. Segments fill in one
 * after another so a 2 / 3 day reads as a small win, not a fraction.
 */
export function QuestSegmentedProgress({
  segments,
  height = QUEST.barDaily + 2,
  gap = 4,
  accessibilityLabel,
}: {
  segments: QuestSegmentState[];
  height?: number;
  gap?: number;
  accessibilityLabel?: string;
}) {
  const colors = useThemeColors();
  if (!segments.length) return null;
  const done = segments.filter((s) => s !== 'active').length;
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: segments.length, now: done }}
      style={{ flexDirection: 'row', gap, height }}
    >
      {segments.map((state, index) => (
        <Segment key={index} state={state} index={index} height={height} track={colors.bg300} brand={colors.primary200} />
      ))}
    </View>
  );
}

function Segment({
  state,
  index,
  height,
  track,
  brand,
}: {
  state: QuestSegmentState;
  index: number;
  height: number;
  track: string;
  brand: string;
}) {
  const reduce = usePrefersReducedMotion();
  const filled = state !== 'active';
  const progress = useSharedValue(reduce ? (filled ? 1 : 0) : 0);

  useEffect(() => {
    const target = filled ? 1 : 0;
    if (reduce) {
      progress.value = target;
      return;
    }
    progress.value = withDelay(
      index * 90,
      withTiming(target, { duration: QUEST.motion.base, easing: Easing.out(Easing.cubic) }),
    );
  }, [filled, index, progress, reduce]);

  const fillStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: progress.value }],
    opacity: progress.value,
  }));

  return (
    <View style={{ flex: 1, height, borderRadius: 999, backgroundColor: track, overflow: 'hidden' }}>
      <Animated.View
        style={[
          {
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            bottom: 0,
            borderRadius: 999,
            backgroundColor: state === 'ready' ? QUEST.accent.movement : brand,
            transformOrigin: 'left',
          },
          fillStyle,
        ]}
      />
    </View>
  );
}
