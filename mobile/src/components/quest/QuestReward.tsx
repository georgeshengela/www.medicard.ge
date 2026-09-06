import React from 'react';
import { Text, View } from 'react-native';
import { Zap } from 'lucide-react-native';
import { QuestCoinMark } from '@/components/quest/QuestIcon';
import { formatQuestNumber } from '@/lib/quest/logic.js';
import { q } from '@/lib/quest/copy';
import { QUEST } from '@/theme/questTokens';
import { useIsDark, useThemeColors } from '@/theme/colors';

type Props = {
  xp: number;
  coins: number;
  locale?: string;
  muted?: boolean;
  /** `pill` (default) = tinted chips; `inline` = plain text row for tight spots. */
  variant?: 'pill' | 'inline';
  size?: 'sm' | 'md';
};

/** XP + Medi Coins as two soft pills: XP in brand wash, coins in warm amber. */
export function QuestReward({ xp, coins, locale = 'ka', muted, variant = 'pill', size = 'sm' }: Props) {
  const copy = q(locale);
  const colors = useThemeColors();
  const dark = useIsDark();

  if (variant === 'inline') {
    const tone = muted ? colors.text300 : colors.text200;
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 13, color: tone }}>
          +{formatQuestNumber(xp, locale)} {copy.xp}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 13, color: tone }}>
            +{formatQuestNumber(coins, locale)}
          </Text>
          <QuestCoinMark size={12} color={muted ? colors.text300 : undefined} />
        </View>
      </View>
    );
  }

  const fontSize = size === 'md' ? 14 : 12;
  const padV = size === 'md' ? 5 : 3;
  const padH = size === 'md' ? 10 : 8;
  const xpBg = dark ? QUEST.pill.xpDark : QUEST.pill.xpLight;
  const xpInk = colors.primary100;
  const coinBg = dark ? QUEST.pill.coinDark : QUEST.pill.coinLight;
  const coinInk = dark ? QUEST.pill.coinInkDark : QUEST.pill.coinInkLight;

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, opacity: muted ? 0.6 : 1 }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
          borderRadius: 999,
          paddingHorizontal: padH,
          paddingVertical: padV,
          backgroundColor: xpBg,
        }}
      >
        <Zap size={fontSize} color={xpInk} strokeWidth={2.4} fill={xpInk} />
        <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize, lineHeight: fontSize + 6, color: xpInk }}>
          +{formatQuestNumber(xp, locale)} {copy.xp}
        </Text>
      </View>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 5,
          borderRadius: 999,
          paddingHorizontal: padH,
          paddingVertical: padV,
          backgroundColor: coinBg,
        }}
      >
        <QuestCoinMark size={fontSize} color={coinInk} />
        <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize, lineHeight: fontSize + 6, color: coinInk }}>
          +{formatQuestNumber(coins, locale)}
        </Text>
      </View>
    </View>
  );
}
