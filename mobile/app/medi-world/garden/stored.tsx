import React, { useMemo } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GardenPlantVisual } from '@/components/world/GardenPlantVisual';
import { WorldButton, WorldHeader, useWorldLocale } from '@/components/world/WorldChrome';
import { useGarden, newIdempotencyKey } from '@/hooks/useGarden';
import { gardenCopy } from '@/i18n/world/garden.js';
import { mediWorldApi } from '@/lib/mediWorld/api';
import { QUEST } from '@/theme/questTokens';
import { useThemeColors } from '@/theme/colors';
import { useWorldStitch } from '@/theme/worldStitch';

export default function GardenStoredScreen() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const t = useWorldStitch();
  const { payload, mutate, canMutate } = useGarden();
  const { locale } = useWorldLocale();
  const copy = useMemo(() => gardenCopy(locale), [locale]);
  const fontTitle = { fontFamily: 'NotoSansGeorgian_700Bold' as const };
  const fontBody = { fontFamily: 'NotoSansGeorgian_400Regular' as const };
  const emptyPlot = payload?.plots.find((row) => row.unlocked && !row.plant);

  async function restore(plantId: string) {
    if (!emptyPlot || !canMutate) return;
    await mutate(() => mediWorldApi.gardenRestore(plantId, emptyPlot.index, newIdempotencyKey('restore')));
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.surface }}>
      <WorldHeader title={copy.stored} backLabel={copy.back} />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24, paddingHorizontal: 16 }}>
        {!emptyPlot && (payload?.stored || []).length ? (
          <Text style={{ ...fontBody, color: colors.text300, marginTop: 12 }}>{copy.restoreNeedsPlot}</Text>
        ) : null}
        {(payload?.stored || []).map((plant) => (
          <View
            key={plant.id}
            style={{
              marginTop: 14,
              borderRadius: QUEST.radius,
              borderWidth: 1,
              borderColor: colors.bg300,
              backgroundColor: colors.surface,
              padding: QUEST.pad,
            }}
          >
            <GardenPlantVisual
              catalogKey={plant.catalogKey}
              stage={plant.stage}
              size={72}
              accessibilityLabel={`${copy[`${plant.catalogKey}_name` as 'pulse_fern_name']} ${copy[plant.stage]}`}
            />
            <Text style={{ ...fontTitle, color: colors.text100, marginTop: 8 }}>{copy[`${plant.catalogKey}_name` as 'pulse_fern_name']}</Text>
            <Text style={{ ...fontBody, color: colors.text200 }}>{copy[plant.stage]} · {copy.daysKept} {plant.nurtureDays}</Text>
            <WorldButton
              label={copy.restore}
              disabled={!canMutate || !emptyPlot}
              onPress={() => void restore(plant.id)}
              secondary
            />
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
