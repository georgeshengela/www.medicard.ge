import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GardenPlantVisual } from '@/components/world/GardenPlantVisual';
import { WorldHeader, useWorldLocale } from '@/components/world/WorldChrome';
import { gardenCopy } from '@/i18n/world/garden.js';
import { worldCopy } from '@/i18n/world/catalog.js';
import { mediWorldApi } from '@/lib/mediWorld/api';
import { QUEST } from '@/theme/questTokens';
import { useThemeColors } from '@/theme/colors';
import { useWorldStitch } from '@/theme/worldStitch';
import type { GardenCatalogItem } from '@/lib/mediWorld/types';

export default function GardenCatalogScreen() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const t = useWorldStitch();
  const { locale } = useWorldLocale();
  const copy = useMemo(() => gardenCopy(locale), [locale]);
  const energy = useMemo(() => worldCopy(locale), [locale]);
  const [items, setItems] = useState<GardenCatalogItem[]>([]);
  const fontTitle = { fontFamily: 'NotoSansGeorgian_700Bold' as const };
  const fontBody = { fontFamily: 'NotoSansGeorgian_400Regular' as const };

  useEffect(() => {
    void mediWorldApi.gardenCatalog().then((res) => setItems(res.items)).catch(() => setItems([]));
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: t.surface }}>
      <WorldHeader title={copy.catalog} backLabel={copy.back} />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24, paddingHorizontal: 16 }}>
        {items.map((item) => (
          <View
            key={item.key}
            style={{
              marginTop: 14,
              borderRadius: QUEST.radius,
              borderWidth: 1,
              borderColor: colors.bg300,
              backgroundColor: colors.surface,
              padding: QUEST.pad,
              flexDirection: 'row',
              gap: 12,
              alignItems: 'flex-start',
            }}
          >
            <GardenPlantVisual catalogKey={item.key} stage="bloom" size={72} accessibilityLabel={copy[item.a11yKey as 'pulse_fern_a11y']} />
            <View style={{ flex: 1 }}>
              <Text style={{ ...fontTitle, fontSize: 18, color: colors.text100 }}>{copy[item.nameKey as 'pulse_fern_name']}</Text>
              <Text style={{ ...fontBody, color: colors.text200, marginTop: 6 }}>{copy[item.descriptionKey as 'pulse_fern_desc']}</Text>
              <Text style={{ ...fontBody, color: colors.text300, marginTop: 6 }}>{energy[item.category]} · {item.price}</Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
