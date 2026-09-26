import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronRight, type LucideIcon } from 'lucide-react-native';
import { useIsDark, useThemeColors } from '@/theme/colors';
import { HUB, hubInk, hubText, hubTint, type HubInk } from '@/theme/hub';

export type HubTile = {
  key: string;
  title: string;
  detail: string;
  href: string;
  icon: LucideIcon;
  ink: HubInk;
};

/** Two-column grid of destination tiles: tinted icon, title, one-line reason to tap. */
export function HubTileGrid({ tiles }: { tiles: HubTile[] }) {
  const c = useThemeColors();
  const dark = useIsDark();
  const router = useRouter();
  return (
    <View style={s.grid}>
      {tiles.map((tile) => {
        const ink = hubInk(tile.ink, dark);
        return (
          <Pressable
            key={tile.key}
            accessibilityRole="button"
            accessibilityLabel={`${tile.title}. ${tile.detail}`}
            onPress={() => router.push(tile.href as never)}
            style={[s.tile, { backgroundColor: c.surface }]}
          >
            <View style={[s.iconWrap, { backgroundColor: hubTint(ink, dark) }]}>
              <tile.icon size={21} color={ink} strokeWidth={1.8} />
            </View>
            <View style={{ gap: 3 }}>
              <Text numberOfLines={2} style={[s.title, { color: c.text100 }]}>
                {tile.title}
              </Text>
              <Text numberOfLines={2} style={[hubText.caption, { color: c.text200 }]}>
                {tile.detail}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

/** One-line destination card, for a secondary feature that belongs under a section but not in its grid. */
export function HubLinkRow({
  icon: Icon,
  ink,
  title,
  detail,
  href,
  style,
}: {
  icon: LucideIcon;
  ink: HubInk;
  title: string;
  detail: string;
  href: string;
  style?: object;
}) {
  const c = useThemeColors();
  const dark = useIsDark();
  const router = useRouter();
  const inkHex = hubInk(ink, dark);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${detail}`}
      onPress={() => router.push(href as never)}
      style={[s.row, { backgroundColor: c.surface }, style]}
    >
      <View style={[s.rowTile, { backgroundColor: hubTint(inkHex, dark) }]}>
        <Icon size={19} color={inkHex} strokeWidth={1.9} />
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text numberOfLines={1} style={[s.title, { color: c.text100 }]}>
          {title}
        </Text>
        <Text numberOfLines={1} style={[hubText.caption, { color: c.text200 }]}>
          {detail}
        </Text>
      </View>
      <ChevronRight size={17} color={c.text300} />
    </Pressable>
  );
}

const s = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  tile: {
    flexBasis: '47%',
    flexGrow: 1,
    minWidth: 140,
    borderRadius: HUB.cardRadius,
    padding: 16,
    gap: 14,
  },
  iconWrap: {
    width: HUB.tile,
    height: HUB.tile,
    borderRadius: HUB.tileRadius,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { ...hubText.cardTitle, fontSize: 14, lineHeight: 20 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: HUB.cardRadius,
    paddingVertical: 12,
    paddingHorizontal: 16,
    minHeight: 64,
  },
  rowTile: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
