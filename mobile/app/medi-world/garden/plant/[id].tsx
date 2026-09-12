import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';
import { APP_MODAL_OVERLAY, APP_MODAL_PROPS } from '@/components/ui/appModal';
import { GardenPlantVisual } from '@/components/world/GardenPlantVisual';
import { useGarden, newIdempotencyKey } from '@/hooks/useGarden';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { gardenCopy } from '@/i18n/world/garden.js';
import { mediWorldApi } from '@/lib/mediWorld/api';
import { QUEST } from '@/theme/questTokens';
import { useThemeColors } from '@/theme/colors';

export default function GardenPlantDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const reduce = usePrefersReducedMotion();
  const { payload, mutate, canMutate } = useGarden();
  const [locale, setLocale] = useState<'ka' | 'en'>('ka');
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
        {plant ? (
          <>
            <View style={{ alignItems: 'center', marginTop: 24 }}>
              <GardenPlantVisual catalogKey={plant.catalogKey} stage={plant.stage} size={140} reducedMotion={reduce} accessibilityLabel={`${copy[plant.stage]} ${copy[`${plant.catalogKey}_a11y` as 'pulse_fern_a11y']}`} />
            </View>
            <Text accessibilityRole="header" maxFontSizeMultiplier={1.6} style={{ ...fontTitle, fontSize: 26, color: colors.text100, marginTop: 16 }}>{copy[`${plant.catalogKey}_name` as 'pulse_fern_name']}</Text>
            <Text style={{ ...fontBody, color: colors.text200, marginTop: 8 }}>{copy.growthDetail}: {copy[plant.stage]}</Text>
            <Text style={{ ...fontBody, color: colors.text200, marginTop: 6 }}>{copy.daysKept}: {plant.nurtureDays}</Text>
            <Text style={{ ...fontBody, color: colors.text300, marginTop: 6 }}>{copy.nextDay}: {plant.nextQualifyingDays} · {copy.noCountdown}</Text>
            <Pressable disabled={!canMutate} onPress={() => setMoveOpen(true)} className="active:opacity-75" style={{ marginTop: 18, minHeight: 48, borderRadius: 16, backgroundColor: colors.surface, justifyContent: 'center', paddingHorizontal: 16, opacity: canMutate ? 1 : 0.5 }}>
              <Text style={{ ...fontTitle, color: colors.text100 }}>{copy.move}</Text>
            </Pressable>
            <Pressable disabled={!canMutate} onPress={() => setStoreOpen(true)} className="active:opacity-75" style={{ marginTop: 10, minHeight: 48, borderRadius: 16, backgroundColor: colors.surface, justifyContent: 'center', paddingHorizontal: 16, opacity: canMutate ? 1 : 0.5 }}>
              <Text style={{ ...fontTitle, color: colors.text100 }}>{copy.store}</Text>
            </Pressable>
          </>
        ) : (
          <Text style={{ ...fontBody, color: colors.text300, marginTop: 24 }}>{copy.loadError}</Text>
        )}
      </ScrollView>
      <Modal visible={storeOpen} {...APP_MODAL_PROPS} onRequestClose={() => setStoreOpen(false)}>
        <Pressable style={{ flex: 1, backgroundColor: APP_MODAL_OVERLAY, justifyContent: 'flex-end' }} onPress={() => setStoreOpen(false)}>
          <View style={{ backgroundColor: colors.surfaceRaised, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: QUEST.pad, paddingBottom: insets.bottom + 16 }}>
            <Text style={{ ...fontTitle, fontSize: 20, color: colors.text100 }}>{copy.storeConfirm}</Text>
            <Text style={{ ...fontBody, color: colors.text200, marginTop: 8 }}>{copy.storeConfirmBody}</Text>
            <Pressable onPress={() => void store()} className="active:opacity-75" style={{ marginTop: 16, minHeight: 48, borderRadius: 14, backgroundColor: colors.primary200, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ ...fontTitle, color: '#042F2E' }}>{copy.store}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
      <Modal visible={moveOpen} {...APP_MODAL_PROPS} onRequestClose={() => setMoveOpen(false)}>
        <Pressable style={{ flex: 1, backgroundColor: APP_MODAL_OVERLAY, justifyContent: 'flex-end' }} onPress={() => setMoveOpen(false)}>
          <View style={{ backgroundColor: colors.surfaceRaised, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: QUEST.pad, paddingBottom: insets.bottom + 16 }}>
            <Text style={{ ...fontTitle, fontSize: 20, color: colors.text100 }}>{copy.move}</Text>
            {(payload?.plots || []).filter((row) => row.unlocked && !row.plant).map((row) => (
              <Pressable key={row.index} onPress={() => void moveTo(row.index)} className="active:opacity-75" style={{ marginTop: 10, minHeight: 44, borderRadius: 12, backgroundColor: colors.bg200, justifyContent: 'center', paddingHorizontal: 12 }}>
                <Text style={{ ...fontBody, color: colors.text100 }}>{copy.emptyPlot} {row.index + 1}</Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}
