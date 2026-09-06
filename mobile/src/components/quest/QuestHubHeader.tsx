import React from 'react';
import { Text, View } from 'react-native';
import { Flame } from 'lucide-react-native';
import { QuestAnimatedNumber } from '@/components/quest/QuestAnimatedNumber';
import { QuestCoinMark } from '@/components/quest/QuestIcon';
import { QuestLevelRing } from '@/components/quest/QuestLevelRing';
import { QuestProgressBar } from '@/components/quest/QuestProgressBar';
import { QuestStatChip } from '@/components/quest/QuestStatChip';
import { formatQuestNumber, levelRingProgress, rankLabel } from '@/lib/quest/logic.js';
import { q } from '@/lib/quest/copy';
import type { QuestProfile } from '@/lib/quest/api';
import { QUEST } from '@/theme/questTokens';
import { useIsDark, useThemeColors } from '@/theme/colors';

/**
 * Hub hero: 96px level ring on the left, rank + XP on the right, coins and
 * streak as two stat chips beneath. Sits in a 24px card with a brand wash so
 * it matches the Home card the user just tapped.
 */
export function QuestHubHeader({
  profile,
  locale = 'ka',
  displayCoins,
  onCoinsPress,
  onStreakPress,
}: {
  profile: QuestProfile;
  locale?: string;
  displayCoins?: number;
  onCoinsPress?: () => void;
  onStreakPress?: () => void;
}) {
  const colors = useThemeColors();
  const dark = useIsDark();
  const copy = q(locale);
  const ring = levelRingProgress(profile);
  const nextXp = profile.levelProgress.nextLevelXp;
  const coins = displayCoins ?? profile.coinBalance;
  const streak = profile.currentStreak;
  const rank = rankLabel(profile.rankKey, locale);

  return (
    <View
      style={{
        backgroundColor: dark ? colors.surface : '#FFFFFF',
        borderWidth: 1,
        borderColor: colors.bg300,
        borderRadius: QUEST.radius,
        padding: QUEST.pad,
        overflow: 'hidden',
      }}
    >
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: -60,
          top: -70,
          width: 220,
          height: 220,
          borderRadius: 110,
          backgroundColor: dark ? QUEST.wash.dark : QUEST.wash.light,
          opacity: dark ? 0.85 : 0.5,
        }}
      />

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
        <QuestLevelRing
          percent={ring.percent}
          label={String(profile.level)}
          caption={copy.level}
          size={QUEST.ringHub}
          accessibilityLabel={`${copy.level} ${profile.level}`}
        />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            numberOfLines={1}
            style={{
              fontFamily: 'NotoSansGeorgian_600SemiBold',
              fontSize: 11,
              lineHeight: 15,
              letterSpacing: 1,
              textTransform: 'uppercase',
              color: colors.text300,
            }}
          >
            {copy.level} {profile.level}
          </Text>
          <Text
            numberOfLines={2}
            style={{
              fontFamily: 'NotoSansGeorgian_700Bold',
              fontSize: 22,
              lineHeight: 28,
              letterSpacing: -0.4,
              color: colors.text100,
              marginTop: 2,
            }}
          >
            {rank}
          </Text>
          <Text
            numberOfLines={1}
            style={{
              fontFamily: 'NotoSansGeorgian_600SemiBold',
              fontSize: 13,
              lineHeight: 18,
              color: colors.text200,
              marginTop: 6,
            }}
          >
            {formatQuestNumber(profile.totalXp, locale)}
            {nextXp != null ? ` / ${formatQuestNumber(nextXp, locale)}` : ''} {copy.xp}
          </Text>
          <View style={{ marginTop: 6 }}>
            <QuestProgressBar percent={ring.percent} height={QUEST.barXp - 2} delay={200} />
          </View>
          <Text
            numberOfLines={1}
            style={{
              fontFamily: 'NotoSansGeorgian_500Medium',
              fontSize: 11,
              lineHeight: 15,
              color: colors.text300,
              marginTop: 4,
            }}
          >
            {ring.maxed ? copy.maxLevel : copy.xpToNext(formatQuestNumber(ring.remaining ?? 0, locale))}
          </Text>
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
        <QuestStatChip
          icon={<QuestCoinMark size={18} color={dark ? QUEST.pill.coinInkDark : QUEST.pill.coinInkLight} />}
          wellColor={dark ? QUEST.pill.coinDark : QUEST.pill.coinLight}
          value={
            <QuestAnimatedNumber
              value={coins}
              locale={locale}
              numberOfLines={1}
              style={{
                fontFamily: 'NotoSansGeorgian_700Bold',
                fontSize: 16,
                lineHeight: 22,
                letterSpacing: -0.2,
                color: colors.text100,
              }}
            />
          }
          label={copy.coinsName}
          onPress={onCoinsPress}
          accessibilityLabel={`${copy.wallet}: ${formatQuestNumber(coins, locale)} ${copy.coinsName}`}
        />
        <QuestStatChip
          icon={
            <Flame
              size={18}
              color={streak > 0 ? colors.warning : colors.text300}
              fill={streak > 0 ? colors.warning : 'transparent'}
              strokeWidth={2.2}
            />
          }
          wellColor={streak > 0 ? colors.warningBg : colors.bg200}
          value={streak > 0 ? copy.streakDays(streak) : '—'}
          label={copy.streakLabel}
          onPress={onStreakPress}
          accessibilityLabel={streak > 0 ? copy.streakHint : copy.streakStart}
        />
      </View>
    </View>
  );
}
