import React from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { APP_MODAL_OVERLAY, APP_MODAL_PROPS } from '@/components/ui/appModal';
import { Button } from '@/components/ui/Button';
import { QuestLevelHalo } from '@/components/quest/QuestLevelHalo';
import { QuestReward } from '@/components/quest/QuestReward';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { q } from '@/lib/quest/copy';
import { rankLabel } from '@/lib/quest/logic.js';
import { useIsDark, useThemeColors } from '@/theme/colors';

/**
 * Figma 8853:146377 — centered success modal. Halo is the Nightingale
 * dotted-ring score disc; copy stays Medi (never Nightingale).
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
  const colors = useThemeColors();
  const dark = useIsDark();
  const reduce = usePrefersReducedMotion();
  const rank = rankKey ? rankLabel(rankKey, locale) : '';
  const jumped = previousLevel != null ? level - previousLevel : 0;
  const reached = copy.levelUpBody ? copy.levelUpBody(level) : `${copy.levelUp} ${level}`;
  const body = rank ? `${rank}. ${reached}` : reached;

  return (
    <Modal visible={visible} {...APP_MODAL_PROPS} onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={copy.continue}
          onPress={onClose}
          style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: APP_MODAL_OVERLAY }}
        />
        <View style={{ paddingHorizontal: 16, alignItems: 'center' }}>
          <Animated.View
            entering={reduce ? undefined : FadeInDown.duration(280).springify().damping(18)}
            style={{
              width: '100%',
              backgroundColor: dark ? colors.surface : '#FFFFFF',
              borderWidth: 1,
              borderColor: colors.bg300,
              borderRadius: 32,
              padding: 16,
              gap: 24,
              shadowColor: '#000',
              shadowOpacity: 0.12,
              shadowRadius: 20,
              shadowOffset: { width: 0, height: 12 },
              elevation: 8,
            }}
          >
            <QuestLevelHalo level={level} visible={visible} />

            <View style={{ alignItems: 'center', gap: 8 }}>
              <Text
                style={{
                  fontFamily: 'NotoSansGeorgian_700Bold',
                  fontSize: 24,
                  lineHeight: 32,
                  letterSpacing: -0.25,
                  color: colors.text100,
                  textAlign: 'center',
                  width: '100%',
                }}
              >
                {copy.levelUp}
              </Text>
              <Text
                style={{
                  fontFamily: 'NotoSansGeorgian_400Regular',
                  fontSize: 16,
                  lineHeight: 26,
                  color: colors.text200,
                  textAlign: 'center',
                  width: '100%',
                }}
              >
                {jumped > 1 ? `${body} ${copy.levelsUp(jumped)}.` : body}
              </Text>
              {coins || xp ? (
                <View style={{ marginTop: 4 }}>
                  <QuestReward xp={xp || 0} coins={coins || 0} locale={locale} size="md" />
                </View>
              ) : null}
            </View>

            <Button label={copy.continue} onPress={onClose} />
          </Animated.View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={copy.continue}
            onPress={onClose}
            className="active:opacity-80"
            style={{
              marginTop: 16,
              width: 64,
              height: 64,
              borderRadius: 32,
              backgroundColor: dark ? '#FFFFFF' : '#1F2937',
              alignItems: 'center',
              justifyContent: 'center',
              shadowColor: '#000',
              shadowOpacity: 0.08,
              shadowRadius: 4,
              shadowOffset: { width: 0, height: 2 },
              elevation: 3,
            }}
          >
            <Svg width={32} height={32} viewBox="0 0 32 32">
              <Path
                d="M24.6262 5.95956C25.0168 5.56904 25.6498 5.56904 26.0403 5.95956C26.4307 6.35009 26.4308 6.98312 26.0403 7.37362L17.414 15.9999L26.0403 24.6262C26.4307 25.0168 26.4308 25.6498 26.0403 26.0403C25.6498 26.4308 25.0168 26.4307 24.6262 26.0403L15.9999 17.414L7.37362 26.0403C6.98312 26.4308 6.35009 26.4307 5.95956 26.0403C5.56904 25.6498 5.56904 25.0168 5.95956 24.6262L14.5859 15.9999L5.95956 7.37362C5.56904 6.9831 5.56904 6.35008 5.95956 5.95956C6.35008 5.56904 6.9831 5.56904 7.37362 5.95956L15.9999 14.5859L24.6262 5.95956Z"
                fill={dark ? '#1F2937' : '#FFFFFF'}
              />
            </Svg>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
