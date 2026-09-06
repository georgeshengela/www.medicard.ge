import React from 'react';
import { Text, View } from 'react-native';
import { QuestCoinMark } from '@/components/quest/QuestIcon';
import { formatQuestNumber } from '@/lib/quest/logic.js';
import { q } from '@/lib/quest/copy';

export function QuestReward({
  xp,
  coins,
  locale = 'ka',
  muted,
}: {
  xp: number;
  coins: number;
  locale?: string;
  muted?: boolean;
}) {
  const copy = q(locale);
  const tone = muted ? 'text-text-300' : 'text-text-200';
  return (
    <View className="flex-row flex-wrap items-center" style={{ gap: 10 }}>
      <Text className={`font-sans-semibold text-sm ${tone}`}>
        +{formatQuestNumber(xp, locale)} {copy.xp}
      </Text>
      <View className="flex-row items-center" style={{ gap: 4 }}>
        <Text className={`font-sans-semibold text-sm ${tone}`}>+{formatQuestNumber(coins, locale)}</Text>
        <QuestCoinMark size={12} />
      </View>
    </View>
  );
}
