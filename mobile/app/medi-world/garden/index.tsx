import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';
import { APP_MODAL_OVERLAY, APP_MODAL_PROPS } from '@/components/ui/appModal';
import { CareMediFigure } from '@/components/world/CareMediFigure';
import { GardenPlantVisual } from '@/components/world/GardenPlantVisual';
import { useGarden, GARDEN_INTRO_KEY, newIdempotencyKey } from '@/hooks/useGarden';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { gardenCopy, gardenReactionText } from '@/i18n/world/garden.js';
import { worldCopy } from '@/i18n/world/catalog.js';
import { mediWorldApi } from '@/lib/mediWorld/api';
import { useMediWorldGardenAvailable } from '@/lib/mediWorld/enabled';
import { getPreference } from '@/lib/storage';
import { ApiError } from '@/lib/api';
import { QUEST } from '@/theme/questTokens';
import { useIsDark, useThemeColors } from '@/theme/colors';
import type { GardenCatalogItem, GardenPlot } from '@/lib/mediWorld/types';

export default function GardenScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const dark = useIsDark();
  const reduce = usePrefersReducedMotion();
  const enabled = useMediWorldGardenAvailable();
  const { payload, loading, error, offline, stale, refreshing, refresh, mutate, canMutate } = useGarden();
  const [locale, setLocale] = useState<'ka' | 'en'>('ka');
  const copy = useMemo(() => gardenCopy(locale), [locale]);
  const energyCopy = useMemo(() => worldCopy(locale), [locale]);
  const [plot, setPlot] = useState<GardenPlot | null>(null);
  const [catalog, setCatalog] = useState<GardenCatalogItem[] | null>(null);
  const [pick, setPick] = useState<GardenCatalogItem | null>(null);
  const [success, setSuccess] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void getPreference(GARDEN_INTRO_KEY).then((seen) => {
      if (!seen) router.replace('/medi-world/garden/intro' as never);
    });
  }, [router]);

  const fontTitle = { fontFamily: 'NotoSansGeorgian_700Bold' as const };
  const fontBody = { fontFamily: 'NotoSansGeorgian_400Regular' as const };
  const fontMed = { fontFamily: 'NotoSansGeorgian_500Medium' as const };
  const reactionKey = payload?.mediReaction?.key || 'first_visit';
  const reaction = gardenReactionText(locale, reactionKey);
  const balances = payload?.world?.profile?.careEnergy;

  async function plant(item: GardenCatalogItem, plotIndex: number) {
    if (!canMutate || busy) return;
    setBusy(true);
    setNotice(null);
    try {
      await mutate(() => mediWorldApi.gardenPlant(plotIndex, item.key, newIdempotencyKey(`plant-${item.key}`)));
      setPick(null);
      setPlot(null);
      setSuccess(true);
    } catch (err) {
      const code = err instanceof ApiError ? err.code : '';
      setNotice(code === 'INSUFFICIENT_CARE_ENERGY' ? copy.insufficient : copy.loadError);
    } finally {
      setBusy(false);
    }
  }

  if (!enabled) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg100, padding: 24 }}>
        <Text style={{ ...fontBody, color: colors.text200 }}>{copy.loadError}</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg100 }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 8,
          paddingBottom: Math.max(insets.bottom, 24) + 32,
          paddingHorizontal: 16,
        }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh(true, { spinner: true })} tintColor={colors.primary200} />}
      >
        <Pressable accessibilityRole="button" accessibilityLabel={copy.back} onPress={() => router.back()} className="active:opacity-75" style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' }}>
          <ArrowLeft size={22} color={colors.text100} strokeWidth={2.2} />
        </Pressable>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
          <Pressable onPress={() => setLocale('ka')} className="active:opacity-75" style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, backgroundColor: locale === 'ka' ? colors.bg200 : 'transparent' }}>
            <Text style={{ ...fontMed, color: colors.text100 }}>ქარ</Text>
          </Pressable>
          <Pressable onPress={() => setLocale('en')} className="active:opacity-75" style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, backgroundColor: locale === 'en' ? colors.bg200 : 'transparent' }}>
            <Text style={{ ...fontMed, color: colors.text100 }}>EN</Text>
          </Pressable>
        </View>
        <Text accessibilityRole="header" maxFontSizeMultiplier={1.6} style={{ ...fontTitle, fontSize: 28, lineHeight: 36, color: colors.text100, marginTop: 16 }}>
          {copy.title}
        </Text>
        <Text maxFontSizeMultiplier={1.6} style={{ ...fontBody, fontSize: 15, lineHeight: 22, color: colors.text200, marginTop: 8 }}>
          {offline || stale ? copy.offline : reaction}
        </Text>
        <View style={{ marginTop: 18, borderRadius: 28, backgroundColor: dark ? '#0B1220' : '#ECFDF5', minHeight: 280, padding: 16, overflow: 'hidden' }}>
          <Text style={{ ...fontMed, fontSize: 13, color: colors.text300 }}>
            {copy[`atmosphere_${payload?.atmosphere || 'quiet_beginning'}` as 'atmosphere_quiet_beginning'] || copy.atmosphere_quiet_beginning}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: 12 }}>
            {(payload?.plots || []).map((row) => (
              <Pressable
                key={row.index}
                accessibilityRole="button"
                accessibilityLabel={row.unlocked ? (row.plant ? row.plant.catalogKey : copy.emptyPlot) : copy.lockedPlot}
                onPress={() => {
                  setPlot(row);
                  if (row.unlocked && !row.plant) {
                    void mediWorldApi.gardenCatalog().then((res) => setCatalog(res.items)).catch(() => setCatalog([]));
                  }
                }}
                className="active:opacity-75"
                style={{
                  width: '31%',
                  aspectRatio: 0.9,
                  marginBottom: 10,
                  borderRadius: 18,
                  backgroundColor: row.unlocked ? (dark ? '#111827' : '#FFFFFF') : colors.bg200,
                  opacity: row.unlocked ? 1 : 0.55,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {row.plant ? (
                  <GardenPlantVisual catalogKey={row.plant.catalogKey} stage={row.plant.stage} size={64} reducedMotion={reduce} />
                ) : (
                  <Text style={{ ...fontBody, fontSize: 12, color: colors.text300 }}>{row.unlocked ? copy.emptyPlot : copy.lockedPlot}</Text>
                )}
              </Pressable>
            ))}
          </View>
          <View style={{ alignItems: 'center', marginTop: 4 }}>
            <CareMediFigure size={88} reducedMotion={reduce} accent />
          </View>
        </View>
        <Pressable onPress={() => router.push('/medi-world/garden/catalog' as never)} className="active:opacity-75" style={{ marginTop: 16, minHeight: 48, borderRadius: 16, backgroundColor: colors.surface, justifyContent: 'center', paddingHorizontal: 16 }}>
          <Text style={{ ...fontTitle, fontSize: 16, color: colors.text100 }}>{copy.catalog}</Text>
        </Pressable>
        <Pressable onPress={() => router.push('/medi-world/garden/stored' as never)} className="active:opacity-75" style={{ marginTop: 10, minHeight: 48, borderRadius: 16, backgroundColor: colors.surface, justifyContent: 'center', paddingHorizontal: 16 }}>
          <Text style={{ ...fontTitle, fontSize: 16, color: colors.text100 }}>{copy.stored}</Text>
        </Pressable>
        <Pressable onPress={() => router.push('/medi-world/garden/history' as never)} className="active:opacity-75" style={{ marginTop: 10, minHeight: 48, borderRadius: 16, backgroundColor: colors.surface, justifyContent: 'center', paddingHorizontal: 16 }}>
          <Text style={{ ...fontTitle, fontSize: 16, color: colors.text100 }}>{copy.history}</Text>
        </Pressable>
        {error || loading ? (
          <Text style={{ ...fontBody, color: colors.text300, marginTop: 16 }}>{loading ? copy.stale : copy.loadError}</Text>
        ) : null}
        {notice ? <Text style={{ ...fontBody, color: colors.primary200, marginTop: 12 }}>{notice}</Text> : null}
      </ScrollView>

      <Modal visible={Boolean(plot)} {...APP_MODAL_PROPS} onRequestClose={() => { setPlot(null); setPick(null); }}>
        <Pressable style={{ flex: 1, backgroundColor: APP_MODAL_OVERLAY, justifyContent: 'flex-end' }} onPress={() => { setPlot(null); setPick(null); }}>
          <Pressable onPress={() => {}} style={{ backgroundColor: colors.surfaceRaised, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: QUEST.pad, paddingBottom: insets.bottom + 16 }}>
            {plot && !plot.unlocked ? (
              <>
                <Text style={{ ...fontTitle, fontSize: 20, color: colors.text100 }}>{copy.lockedPlot}</Text>
                <Text style={{ ...fontBody, fontSize: 15, color: colors.text200, marginTop: 8 }}>{copy.lockedPlotBody} {plot.unlockLevel}</Text>
              </>
            ) : null}
            {plot?.unlocked && !plot.plant && !pick ? (
              <>
                <Text style={{ ...fontTitle, fontSize: 20, color: colors.text100 }}>{copy.emptyPlot}</Text>
                <Text style={{ ...fontBody, fontSize: 15, color: colors.text200, marginTop: 8 }}>{copy.emptyPlotBody}</Text>
                {(catalog || []).map((item) => {
                  const have = balances?.[item.category] ?? 0;
                  return (
                    <Pressable key={item.key} onPress={() => setPick(item)} className="active:opacity-75" style={{ marginTop: 10, padding: 12, borderRadius: 14, backgroundColor: colors.bg200 }}>
                      <Text style={{ ...fontMed, color: colors.text100 }}>{copy[item.nameKey as 'pulse_fern_name']}</Text>
                      <Text style={{ ...fontBody, fontSize: 13, color: colors.text300 }}>{energyCopy[item.category]} · {item.price} · {copy.balance} {have}</Text>
                    </Pressable>
                  );
                })}
              </>
            ) : null}
            {plot?.plant ? (
              <>
                <GardenPlantVisual catalogKey={plot.plant.catalogKey} stage={plot.plant.stage} size={88} reducedMotion={reduce} accessibilityLabel={`${copy[plot.plant.stage]} ${plot.plant.catalogKey}`} />
                <Text style={{ ...fontTitle, fontSize: 20, color: colors.text100, marginTop: 8 }}>{copy[`${plot.plant.catalogKey}_name` as 'pulse_fern_name']}</Text>
                <Text style={{ ...fontBody, color: colors.text200, marginTop: 6 }}>{copy.stage}: {copy[plot.plant.stage]} · {copy.daysKept} {plot.plant.nurtureDays}</Text>
                <Text style={{ ...fontBody, color: colors.text300, marginTop: 4 }}>{copy.nextDay}: {plot.plant.nextQualifyingDays} · {copy.noCountdown}</Text>
                <Pressable onPress={() => { router.push(`/medi-world/garden/plant/${plot.plant!.id}` as never); setPlot(null); }} className="active:opacity-75" style={{ marginTop: 12, minHeight: 48, borderRadius: 14, backgroundColor: colors.bg200, justifyContent: 'center', alignItems: 'center' }}>
                  <Text style={{ ...fontTitle, color: colors.text100 }}>{copy.growthDetail}</Text>
                </Pressable>
              </>
            ) : null}
            {pick && plot ? (
              <>
                <Text style={{ ...fontTitle, fontSize: 20, color: colors.text100 }}>{copy.plantConfirm}</Text>
                <Text style={{ ...fontBody, color: colors.text200, marginTop: 8 }}>{copy.plantConfirmBody}</Text>
                <Text style={{ ...fontBody, color: colors.text200, marginTop: 8 }}>{copy.energyNeeded}: {pick.price} {energyCopy[pick.category]}</Text>
                <Text style={{ ...fontBody, color: colors.text300 }}>{copy.balance}: {balances?.[pick.category] ?? 0}</Text>
                <Pressable disabled={!canMutate || busy} onPress={() => void plant(pick, plot.index)} className="active:opacity-75" style={{ marginTop: 16, minHeight: 48, borderRadius: 14, backgroundColor: colors.primary200, justifyContent: 'center', alignItems: 'center', opacity: canMutate ? 1 : 0.5 }}>
                  <Text style={{ ...fontTitle, color: '#042F2E' }}>{copy.plant}</Text>
                </Pressable>
              </>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={success} {...APP_MODAL_PROPS} onRequestClose={() => setSuccess(false)}>
        <Pressable style={{ flex: 1, backgroundColor: APP_MODAL_OVERLAY, justifyContent: 'center', padding: 24 }} onPress={() => setSuccess(false)}>
          <View style={{ backgroundColor: colors.surfaceRaised, borderRadius: 24, padding: 24 }}>
            <Text style={{ ...fontTitle, fontSize: 22, color: colors.text100 }}>{copy.plantSuccess}</Text>
            <Pressable onPress={() => setSuccess(false)} className="active:opacity-75" style={{ marginTop: 16, minHeight: 48, borderRadius: 14, backgroundColor: colors.primary200, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ ...fontTitle, color: '#042F2E' }}>{copy.continue}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}
