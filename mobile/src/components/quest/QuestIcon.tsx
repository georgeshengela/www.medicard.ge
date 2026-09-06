import React from 'react';
import { View } from 'react-native';
import { Check, Droplets, Footprints, MessageCircle, Target } from 'lucide-react-native';
import { QUEST, type QuestAccentKind } from '@/theme/questTokens';
import { useIsDark, useThemeColors } from '@/theme/colors';

/**
 * Category well. Teal family only; `done` flips to a solid success disc with a
 * white check so a finished row reads instantly in a list.
 */
export function QuestIcon({
  kind,
  done,
  ready,
  size = QUEST.icon,
}: {
  kind: QuestAccentKind;
  done?: boolean;
  /** Completed, reward waiting — solid brand disc. */
  ready?: boolean;
  size?: number;
}) {
  const colors = useThemeColors();
  const dark = useIsDark();
  const Icon = done
    ? Check
    : kind === 'hydration'
      ? Droplets
      : kind === 'medi'
        ? MessageCircle
        : kind === 'weekly'
          ? Target
          : Footprints;
  const solid = done || ready;
  const bg = done ? colors.success : ready ? QUEST.accent[kind] : dark ? QUEST.wash.dark : QUEST.wash.light;
  const ink = solid ? '#FFFFFF' : dark ? colors.primary100 : QUEST.accent[kind];
  const glyph = Math.round(size * 0.475);
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.3),
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: bg,
      }}
    >
      <Icon size={glyph} color={ink} strokeWidth={done ? 2.8 : 2.2} />
    </View>
  );
}

/** Medi Coin — ring with a solid center dot. */
export function QuestCoinMark({ size = 16, color, filled }: { size?: number; color?: string; filled?: boolean }) {
  const colors = useThemeColors();
  const stroke = color || colors.primary200;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: Math.max(1.4, size * 0.1),
        borderColor: stroke,
        backgroundColor: filled ? stroke : 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <View
        style={{
          width: size * 0.34,
          height: size * 0.34,
          borderRadius: size,
          backgroundColor: filled ? '#FFFFFF' : stroke,
        }}
      />
    </View>
  );
}
