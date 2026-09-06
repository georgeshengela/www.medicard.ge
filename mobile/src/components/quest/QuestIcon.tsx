import React from 'react';
import { View } from 'react-native';
import { Check, Droplets, Footprints, MessageCircle, Target } from 'lucide-react-native';
import { QUEST, type QuestAccentKind } from '@/theme/questTokens';
import { useThemeColors } from '@/theme/colors';

export function QuestIcon({
  kind,
  done,
}: {
  kind: QuestAccentKind;
  done?: boolean;
}) {
  const colors = useThemeColors();
  const Icon = done
    ? Check
    : kind === 'hydration'
      ? Droplets
      : kind === 'medi'
        ? MessageCircle
        : kind === 'weekly'
          ? Target
          : Footprints;
  const accent = done ? colors.success : QUEST.accent[kind];
  return (
    <View
      style={{
        width: QUEST.icon,
        height: QUEST.icon,
        borderRadius: QUEST.iconRadius,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.accent100,
      }}
    >
      <Icon size={QUEST.glyph} color={accent} strokeWidth={2.2} />
    </View>
  );
}

export function QuestCoinMark({ size = 16, color }: { size?: number; color?: string }) {
  const colors = useThemeColors();
  const stroke = color || colors.primary200;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: 1.6,
        borderColor: stroke,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <View
        style={{
          width: size * 0.34,
          height: size * 0.34,
          borderRadius: size,
          backgroundColor: stroke,
        }}
      />
    </View>
  );
}
