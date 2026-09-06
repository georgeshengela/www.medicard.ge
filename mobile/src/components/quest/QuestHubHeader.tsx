import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Flame } from 'lucide-react-native';
import { QuestAnimatedNumber } from '@/components/quest/QuestAnimatedNumber';
import { QuestCoinMark } from '@/components/quest/QuestIcon';
import { QuestProgressBar } from '@/components/quest/QuestProgressBar';
import { formatQuestNumber, rankLabel } from '@/lib/quest/logic.js';
import { q } from '@/lib/quest/copy';
import type { QuestDashboard } from '@/lib/quest/api';
import { QUEST } from '@/theme/questTokens';
import { useThemeColors } from '@/theme/colors';

export function QuestHubHeader({
  dashboard,
  locale = 'ka',
  displayCoins,
  onCoinsPress,
  onStreakPress,
}: {
  dashboard: QuestDashboard;
  locale?: string;
  displayCoins?: number;
  onCoinsPress?: () => void;
  onStreakPress?: () => void;
}) {
  const colors = useThemeColors();
  const copy = q(locale);
  const profile = dashboard.profile;
  const nextXp = profile.levelProgress.nextLevelXp;
  const bar = profile.levelProgress.progressPercent ?? 0;
  const coins = displayCoins ?? profile.coinBalance;
  const streak = profile.currentStreak;

  return (
    <View>
      <Text className="font-sans-bold text-[22px] leading-7 text-text-100">
        {copy.level} {profile.level}
      </Text>
      <Text className="mt-1 font-sans text-[15px] text-text-200">{rankLabel(profile.rankKey, locale)}</Text>
      <Text className="mt-3 font-sans-semibold text-sm text-text-100">
        {formatQuestNumber(profile.totalXp, locale)}
        {nextXp != null ? ` / ${formatQuestNumber(nextXp, locale)}` : ''} {copy.xp}
      </Text>
      <View className="mt-2">
        <QuestProgressBar percent={bar} height={QUEST.barXp} />
      </View>

      <View className="mt-4 flex-row" style={{ gap: 10 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={copy.wallet}
          onPress={onCoinsPress}
          className="min-h-[44px] min-w-0 flex-1 flex-row items-center rounded-2xl bg-surface px-3 py-2 active:opacity-80"
          style={{ borderWidth: 1, borderColor: colors.bg300, gap: 8 }}
        >
          <QuestCoinMark size={16} />
          <QuestAnimatedNumber
            value={coins}
            locale={locale}
            className="min-w-0 shrink font-sans-semibold text-[15px] text-text-100"
          />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={copy.streakHint}
          onPress={onStreakPress}
          className="min-h-[44px] min-w-0 flex-1 flex-row items-center rounded-2xl bg-surface px-3 py-2 active:opacity-80"
          style={{ borderWidth: 1, borderColor: colors.bg300, gap: 8 }}
        >
          <Flame size={16} color={streak > 0 ? colors.warning : colors.text300} strokeWidth={2.2} />
          <Text className="min-w-0 shrink font-sans-semibold text-[15px] leading-5 text-text-100">
            {streak > 0 ? copy.streakDays(streak) : copy.streakStart}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
