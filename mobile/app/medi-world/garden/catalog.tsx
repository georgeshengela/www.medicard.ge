import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';
import { GardenPlantVisual } from '@/components/world/GardenPlantVisual';
import { gardenCopy } from '@/i18n/world/garden.js';
import { worldCopy } from '@/i18n/world/catalog.js';
import { mediWorldApi } from '@/lib/mediWorld/api';
import { useThemeColors } from '@/theme/colors';
import type { GardenCatalogItem } from '@/lib/mediWorld/types';

export default function GardenCatalogScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const [locale, setLocale] = useState<'ka' | 'en'>('ka');
  const copy = useMemo(() => gardenCopy(locale), [locale]);
  const energy = useMemo(() => worldCopy(locale), [locale]);
  const [items, setItems] = useState<GardenCatalogItem[]>([]);
  const fontTitle = { fontFamily: 'NotoSansGeorgian_700Bold' as const };
  const fontBody = { fontFamily: 'NotoSansGeorgian_400Regular' as const };

  useEffect(() => {
    void mediWorldApi.gardenCatalog().then((res) => setItems(res.items)).catch(() => setItems([]));
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg100 }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 24, paddingHorizontal: 16 }}>
        <Pressable onPress={() => router.back()} className="active:opacity-75" style={{ width: 44, height: 44, justifyContent: 'center' }}>
          <ArrowLeft size={22} color={colors.text100} />
        </Pressable>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
          <Pressable onPress={() => setLocale('ka')}><Text style={{ color: colors.text100 }}>ქარ</Text></Pressable>
          <Pressable onPress={() => setLocale('en')}><Text style={{ color: colors.text100 }}>EN</Text></Pressable>
        </View>
        <Text accessibilityRole="header" maxFontSizeMultiplier={1.6} style={{ ...fontTitle, fontSize: 26, color: colors.text100, marginTop: 16 }}>{copy.catalog}</Text>
        {items.map((item) => (
          <View key={item.key} style={{ marginTop: 14, borderRadius: 18, backgroundColor: colors.surface, padding: 16 }}>
            <GardenPlantVisual catalogKey={item.key} stage="bloom" size={72} accessibilityLabel={copy[item.a11yKey as 'pulse_fern_a11y']} />
            <Text style={{ ...fontTitle, fontSize: 18, color: colors.text100, marginTop: 8 }}>{copy[item.nameKey as 'pulse_fern_name']}</Text>
            <Text style={{ ...fontBody, color: colors.text200, marginTop: 6 }}>{copy[item.descriptionKey as 'pulse_fern_desc']}</Text>
            <Text style={{ ...fontBody, color: colors.text300, marginTop: 6 }}>{energy[item.category]} · {item.price}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
