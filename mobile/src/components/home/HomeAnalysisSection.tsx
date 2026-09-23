import React from 'react';
import { useThemeColors } from '@/theme/colors';
import { Pressable, Text, View } from 'react-native';
import { HomeSectionTitle } from '@/components/home/HomeSectionTitle';
import { useFigmaHomeDashboard } from '@/constants/figmaHomeDashboardLayout';
import { HOME_SPACE as S } from '@/constants/homeSpacing';
import { ka } from '@/i18n/ka';
import type { ModuleTile } from '@/constants/modules';

type Props = {
  tiles: ModuleTile[];
  onPress: (tile: ModuleTile) => void;
};

/** Figma 11423:86807 — analysis tools. No quota chip or upgrade entry. */
export function HomeAnalysisSection({ tiles, onPress }: Props) {
  const FIGMA = useFigmaHomeDashboard();

  if (!tiles.length) return null;

  return (
    <View style={{ marginTop: S.sectionTop }}>
      <HomeSectionTitle title={ka.home.analysisTools} />
      <View
        style={{
          backgroundColor: FIGMA.setupCardBg,
          borderWidth: 1,
          borderColor: FIGMA.border,
          borderRadius: 24,
          paddingHorizontal: 16,
          paddingVertical: 12,
        }}
      >
        {tiles.map((tile, index) => (
          <AnalysisRow
            key={tile.key}
            tile={tile}
            last={index === tiles.length - 1}
            onPress={() => onPress(tile)}
          />
        ))}
      </View>
    </View>
  );
}

function AnalysisRow({
  tile,
  last,
  onPress,
}: {
  tile: ModuleTile;
  last: boolean;
  onPress: () => void;
}) {
  const FIGMA = useFigmaHomeDashboard();
  const Icon = tile.icon;
  const colors = useThemeColors();

  return (
    <Pressable accessibilityRole="button" accessibilityLabel={tile.title} onPress={onPress} className="w-full active:opacity-88">
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          paddingVertical: 12,
        }}
      >
        <View
          style={{
            width: 48,
            height: 48,
            borderRadius: 16,
            backgroundColor: colors.accent100,
            borderWidth: 1,
            borderColor: FIGMA.borderTertiary,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon size={24} color={colors.primary200} strokeWidth={1.8} />
        </View>

        <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
          <Text
            style={{
              fontFamily: 'NotoSansGeorgian_600SemiBold',
              fontSize: 14,
              lineHeight: 20,
              color: FIGMA.textPrimary,
            }}
            numberOfLines={2}
          >
            {tile.title}
          </Text>
          <Text
            style={{
              fontFamily: 'NotoSansGeorgian_400Regular',
              fontSize: 14,
              lineHeight: 20,
              color: FIGMA.textSecondary,
            }}
            numberOfLines={2}
          >
            {tile.subtitle}
          </Text>
        </View>
      </View>
      {last ? null : <View style={{ height: 1, backgroundColor: FIGMA.border }} />}
    </Pressable>
  );
}
