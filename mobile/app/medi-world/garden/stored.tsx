import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';
import { GardenPlantVisual } from '@/components/world/GardenPlantVisual';
import { useGarden, newIdempotencyKey } from '@/hooks/useGarden';
import { gardenCopy } from '@/i18n/world/garden.js';
import { mediWorldApi } from '@/lib/mediWorld/api';
import { useThemeColors } from '@/theme/colors';

export default function GardenStoredScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const { payload, mutate, canMutate } = useGarden();
  const [locale, setLocale] = useState<'ka' | 'en'>('ka');
  const copy = useMemo(() => gardenCopy(locale), [locale]);
  const fontTitle = { fontFamily: 'NotoSansGeorgian_700Bold' as const };
  const fontBody = { fontFamily: 'NotoSansGeorgian_400Regular' as const };
  const emptyPlot = payload?.plots.find((row) => row.unlocked && !row.plant);

  async function restore(plantId: string) {
    if (!emptyPlot || !canMutate) return;
    await mutate(() => mediWorldApi.gardenRestore(plantId, emptyPlot.index, newIdempotencyKey('restore')));
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg100 }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 24, paddingHorizontal: 16 }}>
        <Pressable onPress={() => router.back()} className="active:opacity-75" style={{ width: 44, height: 44, justifyContent: 'center' }}>
          <ArrowLeft size={22} color={colors.text100} />
        </Pressable>
        <Text accessibilityRole="header" maxFontSizeMultiplier={1.6} style={{ ...fontTitle, fontSize: 26, color: colors.text100, marginTop: 16 }}>{copy.stored}</Text>
        {(payload?.stored || []).map((plant) => (
          <View key={plant.id} style={{ marginTop: 14, borderRadius: 18, backgroundColor: colors.surface, padding: 16 }}>
            <GardenPlantVisual catalogKey={plant.catalogKey} stage={plant.stage} size={72} />
            <Text style={{ ...fontTitle, color: colors.text100, marginTop: 8 }}>{copy[`${plant.catalogKey}_name` as 'pulse_fern_name']}</Text>
            <Text style={{ ...fontBody, color: colors.text200 }}>{copy[plant.stage]} · {copy.daysKept} {plant.nurtureDays}</Text>
            <Pressable disabled={!canMutate || !emptyPlot} onPress={() => void restore(plant.id)} className="active:opacity-75" style={{ marginTop: 10, minHeight: 44, borderRadius: 12, backgroundColor: colors.bg200, justifyContent: 'center', alignItems: 'center', opacity: canMutate && emptyPlot ? 1 : 0.45 }}>
              <Text style={{ ...fontTitle, color: colors.text100 }}>{copy.restore}</Text>
            </Pressable>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
