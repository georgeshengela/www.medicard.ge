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

type Tile = {
  key: string;
  title: string;
  detail: string;
  href: string;
  icon: LucideIcon;
  light: string;
  dark: string;
};

const TILES: Tile[] = [
  { key: 'consilium', title: 'AI კონსილიუმი', detail: 'ერთი კითხვა, რამდენიმე AI პერსპექტივა', href: '/chat/consilium', icon: Users, light: '#6B50A0', dark: '#C4B5FD' },
  { key: 'quest', title: 'MEDI QUEST', detail: 'მისიები, პროგრესი და ჯილდოები', href: '/medi-quest', icon: Trophy, light: '#B45309', dark: '#FCD34D' },
  { key: 'pets', title: 'ჩემი ცხოველები', detail: 'მოვლა, ჩანაწერები და Medi Vet', href: '/pets', icon: PawPrint, light: '#15803D', dark: '#86EFAC' },
  { key: 'pharmacy', title: 'აფთიაქი', detail: 'პროდუქტების მოძებნა', href: '/pharmacy', icon: ShoppingBag, light: '#0369A1', dark: '#7DD3FC' },
  { key: 'metrics', title: 'მაჩვენებლები', detail: 'ყველა გაზომვა ერთ ადგილას', href: '/health-metrics', icon: Activity, light: '#0F766E', dark: '#5EEAD4' },
  { key: 'explore', title: 'ყველა ფუნქცია', detail: 'სრული სია კატეგორიებით', href: '/explore', icon: LayoutGrid, light: '#374151', dark: '#D1D5DB' },
];

export function HomeDiscoverGrid() {
  const c = useThemeColors();
  const dark = useIsDark();
  const router = useRouter();
  return (
    <View style={s.grid}>
      {TILES.map((tile) => {
        const ink = dark ? tile.dark : tile.light;
        return (
          <Pressable
            key={tile.key}
            accessibilityRole="button"
            accessibilityLabel={`${tile.title}. ${tile.detail}`}
            onPress={() => router.push(tile.href as never)}
            style={[s.tile, { backgroundColor: c.surface }]}
          >
            <View style={[s.iconWrap, { backgroundColor: `${ink}${dark ? '26' : '14'}` }]}>
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
    borderRadius: 22,
    padding: 16,
    gap: 14,
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: 'NotoSansGeorgian_700Bold',
    fontSize: 14,
    lineHeight: 20,
  },
  detail: {
    fontFamily: 'NotoSansGeorgian_400Regular',
    fontSize: 12,
    lineHeight: 17,
  },
});
