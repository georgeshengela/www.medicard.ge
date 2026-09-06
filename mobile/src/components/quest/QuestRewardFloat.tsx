import React from 'react';
import { Text } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { rewardFloatOverlayStyle } from '@/lib/quest/logic.js';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';

export function QuestRewardFloat({
  text,
  top,
}: {
  text: string | null;
  top: number;
}) {
  const reduce = usePrefersReducedMotion();
  if (!text) return null;
  return (
    <Animated.View
      pointerEvents="none"
      entering={FadeIn.duration(reduce ? 80 : 180)}
      exiting={FadeOut.duration(reduce ? 80 : 160)}
      style={[rewardFloatOverlayStyle(), { top, alignItems: 'center' }]}
    >
      <Text className="font-sans-semibold text-sm text-primary-200">{text}</Text>
    </Animated.View>
  );
}
