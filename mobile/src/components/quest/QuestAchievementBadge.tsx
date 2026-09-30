import React from 'react';
import { View } from 'react-native';
import { Check } from 'lucide-react-native';
import { QuestArt } from '@/components/quest/QuestIcon';
import { achievementArt } from '@/components/quest/questArt';
import type { AchievementItem } from '@/lib/quest/achievements';
import { QUEST, type QuestRarity } from '@/theme/questTokens';
import { useIsDark, useThemeColors } from '@/theme/colors';

export function rarityColors(rarity: string, dark: boolean) {
  const tone = QUEST.rarity[(rarity as QuestRarity) in QUEST.rarity ? (rarity as QuestRarity) : 'COMMON'];
  return {
    ink: dark ? tone.inkDark : tone.ink,
    fill: dark ? tone.fillDark : tone.fillLight,
  };
}

type Props = {
  item: Pick<AchievementItem, 'key' | 'category' | 'rarity' | 'secret' | 'unlocked' | 'claimed'>;
  size?: number;
  /** Show the small claimed check bubble in the corner. */
  showClaimedMark?: boolean;
};

/**
 * Rarity medallion — the single visual anchor of the Achievements system.
 * Unlocked: rarity fill + full-colour 3D art. Locked: quiet neutral well, dimmed art.
 * Locked secret: dashed border with the mystery-box art.
 */
export function QuestAchievementBadge({ item, size = 48, showClaimedMark = true }: Props) {
  const colors = useThemeColors();
  const dark = useIsDark();
  const rarity = rarityColors(item.rarity, dark);
  const lockedSecret = item.secret && !item.unlocked;
  const artSize = Math.round(size * 0.72);

  const fill = item.unlocked ? rarity.fill : dark ? colors.surfaceRaised : colors.bg200;

  return (
    <View style={{ width: size, height: size }}>
      <View
        style={{
          width: size,
          height: size,
          borderRadius: Math.round(size * 0.32),
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: fill,
          borderWidth: lockedSecret ? 1.5 : item.unlocked ? 0 : 1,
          borderStyle: lockedSecret ? 'dashed' : 'solid',
          borderColor: lockedSecret ? colors.bg300 : colors.bg300,
          opacity: !item.unlocked && !lockedSecret ? 0.9 : 1,
        }}
      >
        <QuestArt source={achievementArt(item)} size={artSize} style={item.unlocked ? undefined : { opacity: lockedSecret ? 0.7 : 0.4 }} />
      </View>
      {showClaimedMark && item.claimed ? (
        <View
          style={{
            position: 'absolute',
            right: -3,
            bottom: -3,
            width: Math.round(size * 0.36),
            height: Math.round(size * 0.36),
            borderRadius: 999,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.success,
            borderWidth: 2,
            borderColor: dark ? colors.surface : '#FFFFFF',
          }}
        >
          <Check size={Math.round(size * 0.2)} color="#FFFFFF" strokeWidth={3.4} />
        </View>
      ) : null}
    </View>
  );
}
