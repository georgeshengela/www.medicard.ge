import React, { useEffect } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Sparkles } from 'lucide-react-native';
import { APP_MODAL_OVERLAY, APP_MODAL_PROPS } from '@/components/ui/appModal';
import { Button } from '@/components/ui/Button';
import { QuestLevelRing } from '@/components/quest/QuestLevelRing';
import { QuestReward } from '@/components/quest/QuestReward';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { q } from '@/lib/quest/copy';
import { rankLabel } from '@/lib/quest/logic.js';
import { QUEST } from '@/theme/questTokens';
import { useIsDark, useThemeColors } from '@/theme/colors';

/**
 * Level-up: the ring fills to 100%, the new level number springs in, then rank
 * and reward fade up. One quiet celebration — no confetti.
 */
export function QuestLevelUpSheet({
  visible,
  level,
  previousLevel,
  rankKey,
  coins,
  xp,
  locale = 'ka',
  onClose,
}: {
  visible: boolean;
  level: number;
  previousLevel?: number;
  rankKey?: string;
  coins?: number;
  xp?: number;
  locale?: string;
  onClose: () => void;
}) {
  const copy = q(locale);
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const dark = useIsDark();
  const reduce = usePrefersReducedMotion();
  const rank = rankKey ? rankLabel(rankKey, locale) : '';
  const jumped = previousLevel != null ? level - previousLevel : 0;

  return (
    <Modal visible={visible} {...APP_MODAL_PROPS} onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable style={{ flex: 1, backgroundColor: APP_MODAL_OVERLAY }} onPress={onClose} />
        <Animated.View
          entering={reduce ? undefined : FadeInDown.duration(QUEST.motion.base).springify().damping(18)}
          style={{
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            backgroundColor: colors.surface,
            paddingHorizontal: 24,
            paddingTop: 12,
            paddingBottom: Math.max(insets.bottom, 20) + 8,
            overflow: 'hidden',
          }}
        >
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              alignSelf: 'center',
              top: -120,
              width: 320,
              height: 320,
              borderRadius: 160,
              backgroundColor: dark ? QUEST.wash.dark : QUEST.wash.light,
              opacity: dark ? 0.8 : 0.5,
            }}
          />
          <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.bg300 }} />

          <View style={{ alignItems: 'center', marginTop: 24 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Sparkles size={14} color={colors.primary200} strokeWidth={2.4} />
              <Text
                style={{
                  fontFamily: 'NotoSansGeorgian_600SemiBold',
                  fontSize: 12,
                  lineHeight: 16,
                  letterSpacing: 1.4,
                  textTransform: 'uppercase',
                  color: colors.text300,
                }}
              >
                {copy.levelUp}
              </Text>
            </View>

            <LevelBadge level={level} visible={visible} reduce={reduce} />

            {rank ? (
              <Animated.Text
                entering={reduce ? undefined : FadeInDown.duration(QUEST.motion.base).delay(520)}
                style={{
                  fontFamily: 'NotoSansGeorgian_700Bold',
                  fontSize: 22,
                  lineHeight: 28,
                  letterSpacing: -0.4,
                  color: colors.text100,
                  textAlign: 'center',
                  marginTop: 16,
                }}
              >
                {rank}
              </Animated.Text>
            ) : null}
            {jumped > 1 ? (
              <Animated.Text
                entering={reduce ? undefined : FadeInDown.duration(QUEST.motion.base).delay(600)}
                style={{
                  fontFamily: 'NotoSansGeorgian_500Medium',
                  fontSize: 14,
                  lineHeight: 20,
                  color: colors.text300,
                  textAlign: 'center',
                  marginTop: 4,
                }}
              >
                {copy.levelsUp(jumped)}
              </Animated.Text>
            ) : null}
            {coins || xp ? (
              <Animated.View
                entering={reduce ? undefined : FadeInDown.duration(QUEST.motion.base).delay(680)}
                style={{ marginTop: 16 }}
              >
                <QuestReward xp={xp || 0} coins={coins || 0} locale={locale} size="md" />
              </Animated.View>
            ) : null}
          </View>

          <View style={{ marginTop: 28 }}>
            <Button label={copy.continue} onPress={onClose} />
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

function LevelBadge({ level, visible, reduce }: { level: number; visible: boolean; reduce: boolean }) {
  const scale = useSharedValue(reduce ? 1 : 0.6);
  const opacity = useSharedValue(reduce ? 1 : 0);

  useEffect(() => {
    if (!visible) return;
    if (reduce) {
      scale.value = 1;
      opacity.value = 1;
      return;
    }
    scale.value = 0.6;
    opacity.value = 0;
    opacity.value = withDelay(140, withTiming(1, { duration: QUEST.motion.fast }));
    scale.value = withDelay(
      140,
      withSequence(
        withSpring(1.08, { damping: 10, stiffness: 220 }),
        withTiming(1, { duration: 220, easing: Easing.out(Easing.quad) }),
      ),
    );
  }, [visible, reduce, scale, opacity]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={[{ marginTop: 18 }, style]}>
      <QuestLevelRing percent={100} label={String(level)} size={QUEST.ringSheet} stroke={9} delay={200} />
    </Animated.View>
  );
}
