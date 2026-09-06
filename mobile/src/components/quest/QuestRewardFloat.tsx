import React from 'react';
import { Text, View, type ViewStyle } from 'react-native';
import Animated, { Easing, FadeOutUp, withDelay, withSpring, withTiming } from 'react-native-reanimated';
import { Sparkles } from 'lucide-react-native';
import { QuestCoinMark } from '@/components/quest/QuestIcon';
import { rewardFloatOverlayStyle } from '@/lib/quest/logic.js';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { QUEST } from '@/theme/questTokens';
import { useIsDark, useThemeColors } from '@/theme/colors';

/**
 * "+30 · +50 XP" pill that pops in, drifts upward and fades. Absolutely
 * positioned with pointerEvents none so it never nudges the layout below.
 */
export function QuestRewardFloat({
  text,
  top,
  align = 'center',
  inset = 0,
}: {
  text: string | null;
  top: number;
  /** `end` keeps the pill off the card title (Home hub card). */
  align?: 'center' | 'end';
  /** Horizontal padding from the overlay edge when `align="end"`. */
  inset?: number;
}) {
  const reduce = usePrefersReducedMotion();
  const colors = useThemeColors();
  const dark = useIsDark();
  if (!text) return null;

  const entering = reduce
    ? undefined
    : () => {
        'worklet';
        return {
          initialValues: {
            opacity: 0,
            transform: [{ translateY: 18 }, { scale: 0.86 }],
          },
          animations: {
            opacity: withTiming(1, { duration: QUEST.motion.fast }),
            transform: [
              { translateY: withDelay(80, withTiming(-10, { duration: 900, easing: Easing.out(Easing.quad) })) },
              { scale: withSpring(1, { damping: 12, stiffness: 240 }) },
            ],
          },
        };
      };

  return (
    <Animated.View
      pointerEvents="none"
      entering={entering}
      exiting={reduce ? undefined : FadeOutUp.duration(QUEST.motion.fast)}
      style={[
        rewardFloatOverlayStyle() as ViewStyle,
        { top, alignItems: align === 'end' ? 'flex-end' : 'center', paddingHorizontal: inset },
      ]}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          paddingHorizontal: 14,
          paddingVertical: 8,
          borderRadius: 999,
          backgroundColor: dark ? '#0D9488' : colors.primary200,
          shadowColor: '#000',
          shadowOpacity: dark ? 0.35 : 0.12,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 4 },
          elevation: 4,
        }}
      >
        <Sparkles size={14} color="#FFFFFF" strokeWidth={2.4} />
        <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 14, lineHeight: 20, color: '#FFFFFF' }}>{text}</Text>
        <QuestCoinMark size={14} color="#FFFFFF" />
      </View>
    </Animated.View>
  );
}
