import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  Activity,
  LayoutGrid,
  PawPrint,
  ShoppingBag,
  Trophy,
  Users,
  type LucideIcon,
} from 'lucide-react-native';
import { useIsDark, useThemeColors } from '@/theme/colors';
import { HUB, hubInk, hubText, hubTint, type HubInk } from '@/theme/hub';

type Tile = {
  key: string;
  title: string;
  detail: string;
  href: string;
  icon: LucideIcon;
  ink: HubInk;
};

const TILES: Tile[] = [
  { key: 'consilium', title: 'AI კონსილიუმი', detail: 'რამდენიმე AI პერსპექტივა ერთად', href: '/chat/consilium', icon: Users, ink: 'violet' },
  { key: 'quest', title: 'MEDI QUEST', detail: 'მისიები, პროგრესი და ჯილდოები', href: '/medi-quest', icon: Trophy, ink: 'amber' },
  { key: 'pets', title: 'ჩემი ცხოველები', detail: 'მოვლა, ჩანაწერები და Medi Vet', href: '/pets', icon: PawPrint, ink: 'green' },
  { key: 'pharmacy', title: 'აფთიაქი', detail: 'პროდუქტების მოძებნა', href: '/pharmacy', icon: ShoppingBag, ink: 'sky' },
  { key: 'metrics', title: 'მაჩვენებლები', detail: 'ყველა გაზომვა ერთ ადგილას', href: '/health-metrics', icon: Activity, ink: 'teal' },
  { key: 'explore', title: 'ყველა ფუნქცია', detail: 'სრული სია კატეგორიებით', href: '/explore', icon: LayoutGrid, ink: 'neutral' },
];

export function HomeDiscoverGrid() {
  const c = useThemeColors();
  const dark = useIsDark();
  const router = useRouter();
  return (
    <View style={s.grid}>
      {TILES.map((tile) => {
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
              <Text numberOfLines={2} style={[s.detail, { color: c.text200 }]}>
                {tile.detail}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  tile: {
    // Two columns: a little under half so the 12px gap always fits.
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
  detail: hubText.caption,
});
