import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { APP_MODAL_OVERLAY, APP_MODAL_PROPS } from '@/components/ui/appModal';
import { GardenPlantVisual } from '@/components/world/GardenPlantVisual';
import { WorldButton, WorldHeader, useWorldLocale } from '@/components/world/WorldChrome';
import { useGarden, newIdempotencyKey } from '@/hooks/useGarden';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { gardenCopy } from '@/i18n/world/garden.js';
import { mediWorldApi } from '@/lib/mediWorld/api';
import { QUEST } from '@/theme/questTokens';
import { useThemeColors } from '@/theme/colors';
import { useWorldStitch } from '@/theme/worldStitch';

export default function GardenPlantDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const t = useWorldStitch();
  const reduce = usePrefersReducedMotion();
  const { payload, mutate, canMutate } = useGarden();
  const { locale } = useWorldLocale();
  const copy = useMemo(() => gardenCopy(locale), [locale]);
  const [storeOpen, setStoreOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const fontTitle = { fontFamily: 'NotoSansGeorgian_700Bold' as const };
  const fontBody = { fontFamily: 'NotoSansGeorgian_400Regular' as const };
  const plant = [...(payload?.plots || []).map((p) => p.plant), ...(payload?.stored || [])].find((row) => row?.id === id) || null;

  async function store() {
    if (!plant || !canMutate) return;
    await mutate(() => mediWorldApi.gardenStore(plant.id, newIdempotencyKey('store')));
    setStoreOpen(false);
    router.back();
  }

  async function moveTo(plotIndex: number) {
    if (!plant || !canMutate) return;
    await mutate(() => mediWorldApi.gardenMove(plant.id, plotIndex, newIdempotencyKey('move')));
    setMoveOpen(false);
  }

  const title = plant ? copy[`${plant.catalogKey}_name` as 'pulse_fern_name'] : copy.loadError;

  return (
    <View style={{ flex: 1, backgroundColor: t.surface }}>
      <WorldHeader title={title} backLabel={copy.back} />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24, paddingHorizontal: 16 }}>
        {plant ? (
          <>
            <View style={{ alignItems: 'center', marginTop: 16 }}>
              <GardenPlantVisual catalogKey={plant.catalogKey} stage={plant.stage} size={140} reducedMotion={reduce} accessibilityLabel={`${copy[plant.stage]} ${copy[`${plant.catalogKey}_a11y` as 'pulse_fern_a11y']}`} />
            </View>
            <Text style={{ ...fontBody, color: colors.text200, marginTop: 8 }}>{copy.growthDetail}: {copy[plant.stage]}</Text>
            <Text style={{ ...fontBody, color: colors.text200, marginTop: 6 }}>{copy.daysKept}: {plant.nurtureDays}</Text>
            <Text style={{ ...fontBody, color: colors.text300, marginTop: 6 }}>{copy.nextDay}: {plant.nextQualifyingDays} · {copy.noCountdown}</Text>
            <WorldButton label={copy.move} disabled={!canMutate} onPress={() => setMoveOpen(true)} secondary />
            <WorldButton label={copy.store} disabled={!canMutate} onPress={() => setStoreOpen(true)} secondary />
          </>
        ) : (
          <Text style={{ ...fontBody, color: colors.text300, marginTop: 24 }}>{copy.loadError}</Text>
        )}
      </ScrollView>
      <Modal visible={storeOpen} {...APP_MODAL_PROPS} onRequestClose={() => setStoreOpen(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={copy.close}
            onPress={() => setStoreOpen(false)}
            style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: APP_MODAL_OVERLAY }}
          />
          <View style={{ backgroundColor: colors.surfaceRaised, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: QUEST.pad, paddingBottom: insets.bottom + 16 }}>
            <Text style={{ ...fontTitle, fontSize: 20, color: colors.text100 }}>{copy.storeConfirm}</Text>
            <Text style={{ ...fontBody, fontSize: 15, lineHeight: 22, color: colors.text200, marginTop: 8 }}>{copy.storeConfirmBody}</Text>
            <WorldButton label={copy.store} onPress={() => void store()} />
          </View>
        </View>
      </Modal>
      <Modal visible={moveOpen} {...APP_MODAL_PROPS} onRequestClose={() => setMoveOpen(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={copy.close}
            onPress={() => setMoveOpen(false)}
            style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: APP_MODAL_OVERLAY }}
          />
          <View style={{ backgroundColor: colors.surfaceRaised, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: QUEST.pad, paddingBottom: insets.bottom + 16 }}>
            <Text style={{ ...fontTitle, fontSize: 20, color: colors.text100 }}>{copy.move}</Text>
            {(payload?.plots || []).filter((row) => row.unlocked && !row.plant).map((row) => (
              <Pressable key={row.index} onPress={() => void moveTo(row.index)} style={{ marginTop: 10, minHeight: 44, borderRadius: 12, backgroundColor: colors.bg200, justifyContent: 'center', paddingHorizontal: 12 }}>
                <Text style={{ ...fontBody, color: colors.text100 }}>{copy.emptyPlot} {row.index + 1}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </Modal>
    </View>
  );
}
