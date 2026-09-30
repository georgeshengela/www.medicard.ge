import React from 'react';
import { Image, View, type ImageSourcePropType, type ImageStyle, type StyleProp } from 'react-native';
import { Check } from 'lucide-react-native';
import { QUEST, type QuestAccentKind } from '@/theme/questTokens';
import { useIsDark, useThemeColors } from '@/theme/colors';
import { COIN_ART, missionArt } from './questArt';

/** Generated 3D artwork, square, decorative (screen readers use the parent's label). */
export function QuestArt({ source, size, style }: { source: ImageSourcePropType; size: number; style?: StyleProp<ImageStyle> }) {
  return (
    <Image
      source={source}
      resizeMode="contain"
      accessibilityIgnoresInvertColors
      accessible={false}
      style={[{ width: size, height: size }, style]}
    />
  );
}

/**
 * Category well with the mission's 3D artwork. Teal family tint; `ready` uses
 * the brand disc, `done` keeps the art with a small green check in the corner.
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
  const bg = ready && !done ? QUEST.accent[kind] : dark ? QUEST.wash.dark : QUEST.wash.light;
  const mark = Math.round(size * 0.42);
  return (
    <View style={{ width: size, height: size }}>
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
        <QuestArt source={missionArt(kind)} size={Math.round(size * 0.8)} />
      </View>
      {done ? (
        <View
          style={{
            position: 'absolute',
            right: -3,
            bottom: -3,
            width: mark,
            height: mark,
            borderRadius: 999,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.success,
            borderWidth: 2,
            borderColor: dark ? colors.surface : '#FFFFFF',
          }}
        >
          <Check size={Math.round(mark * 0.56)} color="#FFFFFF" strokeWidth={3.4} />
        </View>
      ) : null}
    </View>
  );
}

/**
 * Medi Coin — the 3D coin artwork. `color` / `filled` are kept for API
 * compatibility; `color` only dims the coin when it is a muted tone.
 */
export function QuestCoinMark({ size = 16, color, filled }: { size?: number; color?: string; filled?: boolean }) {
  const colors = useThemeColors();
  void filled;
  const muted = color != null && color === colors.text300;
  return <QuestArt source={COIN_ART} size={size} style={muted ? { opacity: 0.55 } : undefined} />;
}
