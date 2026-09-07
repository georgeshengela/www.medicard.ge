import React from 'react';
import { View } from 'react-native';
import {
  Award,
  CalendarCheck2,
  Check,
  Droplets,
  Flame,
  Footprints,
  HelpCircle,
  MessageCircle,
  Star,
  Trophy,
  Undo2,
} from 'lucide-react-native';
import { QuestCoinMark } from '@/components/quest/QuestIcon';
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

function glyphFor(item: Pick<AchievementItem, 'key' | 'category' | 'secret' | 'unlocked'>, size: number, color: string) {
  if (item.secret && !item.unlocked) return <HelpCircle size={size} color={color} strokeWidth={2.2} />;
  if (item.key === 'COMEBACK') return <Undo2 size={size} color={color} strokeWidth={2.4} />;
  switch (item.category) {
    case 'STREAK':
      return <Flame size={size} color={color} strokeWidth={2.2} />;
    case 'MOVEMENT':
      return <Footprints size={size} color={color} strokeWidth={2.2} />;
    case 'HYDRATION':
      return <Droplets size={size} color={color} strokeWidth={2.2} />;
    case 'MEDI':
      return <MessageCircle size={size} color={color} strokeWidth={2.2} />;
    case 'WEEKLY':
      return <CalendarCheck2 size={size} color={color} strokeWidth={2.2} />;
    case 'LEVEL':
      return <Star size={size} color={color} strokeWidth={2.2} />;
    case 'COINS':
      return <QuestCoinMark size={size} color={color} />;
    case 'SPECIAL':
      return <Award size={size} color={color} strokeWidth={2.2} />;
    default:
      return <Trophy size={size} color={color} strokeWidth={2.2} />;
  }
}

type Props = {
  item: Pick<AchievementItem, 'key' | 'category' | 'rarity' | 'secret' | 'unlocked' | 'claimed'>;
  size?: number;
  /** Show the small claimed check bubble in the corner. */
  showClaimedMark?: boolean;
};

/**
 * Rarity medallion — the single visual anchor of the Achievements system.
 * Unlocked: rarity fill + rarity ink. Locked: quiet neutral well.
 * Locked secret: dashed border with a "?" glyph.
 */
export function QuestAchievementBadge({ item, size = 48, showClaimedMark = true }: Props) {
  const colors = useThemeColors();
  const dark = useIsDark();
  const rarity = rarityColors(item.rarity, dark);
  const lockedSecret = item.secret && !item.unlocked;
  const glyphSize = Math.round(size * 0.44);

  const ink = item.unlocked ? rarity.ink : colors.text300;
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
        {glyphFor(item, glyphSize, ink)}
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
