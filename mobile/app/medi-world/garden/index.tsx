import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Image, Modal, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Lock, Plus, Sprout } from 'lucide-react-native';
import { APP_MODAL_OVERLAY, APP_MODAL_PROPS } from '@/components/ui/appModal';
import { GardenPlotGlyph, gardenStageIndex } from '@/components/world/GardenPlotGlyph';
import { WorldButton, WorldHeader, WORLD_FONT_BODY, WORLD_FONT_MED, WORLD_FONT_TITLE, useWorldLocale } from '@/components/world/WorldChrome';
import { useGarden, GARDEN_INTRO_KEY, newIdempotencyKey } from '@/hooks/useGarden';
import { gardenCopy, gardenLockedPlotBody, gardenReactionText } from '@/i18n/world/garden.js';
import { interpretGardenPlantFailure } from '@/lib/mediWorld/gardenPlantClient.js';
import { rememberGarden } from '@/lib/mediWorld/worldEconomyCache.js';
import { worldCopy } from '@/i18n/world/catalog.js';
import { mediWorldApi } from '@/lib/mediWorld/api';
import { useMediWorldGardenAvailable } from '@/lib/mediWorld/enabled';
import { getPreference } from '@/lib/storage';
import { MEDI_WORLD_ART } from '@/lib/mediWorld/art';
import { ApiError } from '@/lib/api';
import { useWorldStitch, WORLD_SHADOW } from '@/theme/worldStitch';
import type { GardenCatalogItem, GardenPlot } from '@/lib/mediWorld/types';

export default function GardenScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const t = useWorldStitch();
  const enabled = useMediWorldGardenAvailable();
  const { payload, loading, error, offline, stale, refreshing, refresh, mutate, canMutate } = useGarden();
  const { locale } = useWorldLocale();
  const copy = useMemo(() => gardenCopy(locale), [locale]);
  const energyCopy = useMemo(() => worldCopy(locale), [locale]);
  const [plot, setPlot] = useState<GardenPlot | null>(null);
  const [catalog, setCatalog] = useState<GardenCatalogItem[] | null>(null);
  const [pick, setPick] = useState<GardenCatalogItem | null>(null);
  const [success, setSuccess] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const plantKeyRef = useRef<string | null>(null);

  useEffect(() => {
    void getPreference(GARDEN_INTRO_KEY).then((seen) => {
      if (!seen) router.replace('/medi-world/garden/intro' as never);
    });
  }, [router]);

  useEffect(() => {
    const nextPlots = payload?.plots || [];
    setPlot((current) => {
      if (current) return nextPlots.find((row) => row.index === current.index) || current;
      return nextPlots.find((row) => Boolean(row.plant)) || null;
    });
  }, [payload]);

  useEffect(() => {
    if (plot?.unlocked && !plot.plant) {
      void mediWorldApi.gardenCatalog().then((res) => setCatalog(res.items)).catch(() => setCatalog([]));
    }
  }, [plot]);

  const reactionKey = payload?.mediReaction?.key || 'first_visit';
  const reaction = gardenReactionText(locale, reactionKey);
  const balances = payload?.world?.profile?.careEnergy;
  const plots = payload?.plots || [];
  const unlocked = plots.filter((row) => row.unlocked).length;
  const selectedPlant = plot?.plant;
  const nextLocked = plots.find((row) => !row.unlocked);

  async function plant(item: GardenCatalogItem, plotIndex: number) {
    if (!canMutate || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setNotice(null);
    try {
      const key = plantKeyRef.current || newIdempotencyKey(`plant-${item.key}`);
      plantKeyRef.current = key;
      await mutate(() => mediWorldApi.gardenPlant(plotIndex, item.key, key));
      plantKeyRef.current = null;
      setPick(null);
      setPlot(null);
      setSuccess(true);
    } catch (err) {
      const code = err instanceof ApiError ? err.code : '';
      let gardenAfter = payload;
      if (code === 'GARDEN_PLOT_OCCUPIED') {
        try {
          gardenAfter = await mediWorldApi.garden();
          rememberGarden({ ...gardenAfter, stale: false });
        } catch {
          gardenAfter = payload;
        }
      }
      const outcome = interpretGardenPlantFailure(code, gardenAfter, plotIndex, item.key);
      if (outcome === 'planted') {
        plantKeyRef.current = null;
        setPick(null);
        setPlot(null);
        setSuccess(true);
        return;
      }
      setNotice(outcome === 'insufficient' ? copy.insufficient : copy.plantFail);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  function openPlot(row: GardenPlot) {
    setPlot(row);
    if (row.unlocked && !row.plant) {
      void mediWorldApi.gardenCatalog().then((res) => setCatalog(res.items)).catch(() => setCatalog([]));
    }
  }

  if (!enabled) {
    return (
      <View style={{ flex: 1, backgroundColor: t.surface, padding: 24 }}>
        <Text style={{ ...WORLD_FONT_BODY, color: t.onVariant }}>{copy.loadError}</Text>
      </View>
    );
  }

  const sheetOpen = Boolean(plot && (!plot.unlocked || !plot.plant || pick));

  return (
    <View style={{ flex: 1, backgroundColor: t.surface }}>
      <WorldHeader
        title={copy.title}
        hidePageTitle
        backLabel={copy.back}
        trailing={
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: t.surfaceHigh, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: t.cta }} />
            <Text style={{ ...WORLD_FONT_TITLE, fontSize: 10, color: t.secondary }}>
              {energyCopy.hubLevel} {payload?.worldLevel || 1} • {unlocked} {copy.plotLabel}
            </Text>
          </View>
        }
      />
      <ScrollView
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 24) + 32, paddingHorizontal: 20 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh(true, { spinner: true })} tintColor={t.cta} />}
      >
        <View style={{ paddingTop: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text accessibilityRole="header" style={{ ...WORLD_FONT_TITLE, fontSize: 26, lineHeight: 32, color: t.on }}>{copy.title}</Text>
            <Text style={{ ...WORLD_FONT_BODY, fontSize: 12, color: t.onVariant, marginTop: 4 }}>{offline || stale ? copy.offline : copy.growsHere}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: t.lowest, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 }}>
            <Image source={MEDI_WORLD_ART.stitchMedi} style={{ width: 24, height: 24 }} resizeMode="contain" />
            <Text style={{ ...WORLD_FONT_MED, fontSize: 10, color: t.onVariant }}>{copy.mediGreeting}</Text>
          </View>
        </View>

        <View style={{ marginTop: 8, borderRadius: 16, backgroundColor: t.surfaceLow, padding: 16 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Sprout size={20} color={t.primary} strokeWidth={2.4} />
              <Text style={{ ...WORLD_FONT_MED, fontSize: 13, color: t.secondary }}>{copy.terrace}</Text>
            </View>
            <Text style={{ ...WORLD_FONT_BODY, fontSize: 10, color: t.outline }}>
              {plots.length} {copy.plotsFrom} {unlocked} {copy.plotsOpenOf}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
            {plots.map((row) => {
              const selected = plot?.index === row.index && Boolean(row.plant);
              const empty = row.unlocked && !row.plant;
              return (
                <Pressable
                  key={row.index}
                  accessibilityRole="button"
                  accessibilityLabel={row.unlocked ? (row.plant ? copy[`${row.plant.catalogKey}_name` as 'pulse_fern_name'] : copy.emptyPlot) : copy.lockedPlot}
                  onPress={() => openPlot(row)}
                  className="active:opacity-90"
                  style={{
                    width: '47%',
                    flexGrow: 1,
                    borderRadius: 16,
                    backgroundColor: empty ? 'rgba(255,255,255,0.6)' : row.unlocked ? t.lowest : t.surfaceHigh,
                    padding: 12,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: selected || empty ? 2 : 0,
                    borderColor: selected ? t.primary : empty ? 'rgba(0,183,166,0.4)' : 'transparent',
                    borderStyle: empty ? 'dashed' : 'solid',
                    opacity: row.unlocked ? 1 : 0.8,
                  }}
                >
                  {row.plant ? (
                    <>
                      <View style={{ width: 80, height: 80, alignItems: 'center', justifyContent: 'center', marginBottom: 4 }}>
                        <GardenPlotGlyph catalogKey={row.plant.catalogKey} size={64} />
                      </View>
                      <Text numberOfLines={1} style={{ ...WORLD_FONT_MED, fontSize: 14, color: t.on, textAlign: 'center' }}>{copy[`${row.plant.catalogKey}_name` as 'pulse_fern_name']}</Text>
                      <Text style={{ ...WORLD_FONT_TITLE, fontSize: 10, color: t.primary, marginTop: 2 }}>
                        {copy.stage} {gardenStageIndex(row.plant.stage)}/3
                      </Text>
                    </>
                  ) : row.unlocked ? (
                    <>
                      <View style={{ width: 80, height: 80, alignItems: 'center', justifyContent: 'center', marginBottom: 4 }}>
                        <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: t.secondaryContainer, alignItems: 'center', justifyContent: 'center' }}>
                          <Plus size={28} color={t.primary} strokeWidth={2.2} />
                        </View>
                      </View>
                      <Text style={{ ...WORLD_FONT_TITLE, fontSize: 14, color: t.primary }}>{copy.plantNew}</Text>
                      <Text style={{ ...WORLD_FONT_BODY, fontSize: 10, color: t.onVariant, marginTop: 2 }}>{copy.plotFree}</Text>
                    </>
                  ) : (
                    <>
                      <View style={{ width: 80, height: 80, alignItems: 'center', justifyContent: 'center', marginBottom: 4 }}>
                        <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: t.surfaceHighest, alignItems: 'center', justifyContent: 'center' }}>
                          <Lock size={20} color={t.outline} strokeWidth={2.2} />
                        </View>
                      </View>
                      <Text style={{ ...WORLD_FONT_MED, fontSize: 14, color: t.onVariant }}>{copy.plotLabel} {row.index + 1}</Text>
                      <Text numberOfLines={2} style={{ ...WORLD_FONT_TITLE, fontSize: 10, color: t.outline, marginTop: 2, textAlign: 'center' }}>{gardenLockedPlotBody(locale, row.unlockLevel)}</Text>
                    </>
                  )}
                </Pressable>
              );
            })}
          </View>
        </View>

        {selectedPlant && plot?.unlocked ? (
          <GardenInspectCard
            name={copy[`${selectedPlant.catalogKey}_name` as 'pulse_fern_name']}
            category={copy[`${selectedPlant.catalogKey}_desc` as 'pulse_fern_desc']}
            stageIndex={gardenStageIndex(selectedPlant.stage)}
            nurtureDays={selectedPlant.nurtureDays}
            copy={copy}
            onMove={() => router.push(`/medi-world/garden/plant/${selectedPlant.id}` as never)}
            onStore={() => router.push(`/medi-world/garden/plant/${selectedPlant.id}` as never)}
          />
        ) : null}

        <View style={{ marginTop: 12, backgroundColor: t.surfaceLow, borderRadius: 16, padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={{ ...WORLD_FONT_MED, fontSize: 14, color: t.on }}>{copy.catalog}</Text>
            <Text style={{ ...WORLD_FONT_BODY, fontSize: 12, color: t.onVariant, marginTop: 2 }}>
              {nextLocked ? `${copy.nextUnlock} · ${energyCopy.hubLevel} ${nextLocked.unlockLevel}` : copy.stored}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={copy.catalog}
            onPress={() => router.push('/medi-world/garden/catalog' as never)}
            className="active:opacity-80"
            style={{ height: 36, paddingHorizontal: 14, borderRadius: 999, backgroundColor: t.primary, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text style={{ ...WORLD_FONT_MED, fontSize: 13, color: t.onCta }}>{copy.catalog}</Text>
          </Pressable>
        </View>
        <View style={{ flexDirection: 'row', gap: 16, marginTop: 4 }}>
          <Pressable onPress={() => router.push('/medi-world/garden/stored' as never)} style={{ minHeight: 36, justifyContent: 'center' }}>
            <Text style={{ ...WORLD_FONT_MED, fontSize: 13, color: t.primary }}>{copy.stored}</Text>
          </Pressable>
          <Pressable onPress={() => router.push('/medi-world/garden/history' as never)} style={{ minHeight: 36, justifyContent: 'center' }}>
            <Text style={{ ...WORLD_FONT_MED, fontSize: 13, color: t.primary }}>{copy.history}</Text>
          </Pressable>
        </View>
        <Text style={{ ...WORLD_FONT_BODY, fontSize: 12, color: t.onVariant, marginTop: 8 }}>{reaction}</Text>
        {error || loading ? (
          <Text style={{ ...WORLD_FONT_BODY, color: t.onVariant, marginTop: 16 }}>{loading ? copy.stale : copy.loadError}</Text>
        ) : null}
        {notice ? <Text style={{ ...WORLD_FONT_BODY, color: t.primary, marginTop: 12 }}>{notice}</Text> : null}
      </ScrollView>

      <Modal visible={sheetOpen} {...APP_MODAL_PROPS} onRequestClose={() => { setPlot(null); setPick(null); }}>
        <Pressable style={{ flex: 1, backgroundColor: APP_MODAL_OVERLAY, justifyContent: 'flex-end' }} onPress={() => { setPlot(null); setPick(null); }}>
          <Pressable onPress={() => {}} style={{ backgroundColor: t.lowest, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: insets.bottom + 16 }}>
            {plot && !plot.unlocked ? (
              <>
                <Text style={{ ...WORLD_FONT_TITLE, fontSize: 20, color: t.on }}>{copy.lockedPlot}</Text>
                <Text style={{ ...WORLD_FONT_BODY, fontSize: 15, color: t.onVariant, marginTop: 8 }}>{gardenLockedPlotBody(locale, plot.unlockLevel)}</Text>
                <WorldButton label={copy.close} onPress={() => { setPlot(null); setPick(null); }} />
              </>
            ) : null}
            {plot?.unlocked && !plot.plant && !pick ? (
              <>
                <Text style={{ ...WORLD_FONT_TITLE, fontSize: 20, color: t.on }}>{copy.emptyPlot}</Text>
                <Text style={{ ...WORLD_FONT_BODY, fontSize: 15, color: t.onVariant, marginTop: 8 }}>{copy.emptyPlotBody}</Text>
                {(catalog || []).map((item) => {
                  const have = balances?.[item.category] ?? 0;
                  return (
                    <Pressable key={item.key} onPress={() => { plantKeyRef.current = newIdempotencyKey(`plant-${item.key}`); setPick(item); }} className="active:opacity-75" style={{ marginTop: 10, padding: 12, borderRadius: 14, backgroundColor: t.surfaceLow }}>
                      <Text style={{ ...WORLD_FONT_MED, color: t.on }}>{copy[item.nameKey as 'pulse_fern_name']}</Text>
                      <Text style={{ ...WORLD_FONT_BODY, fontSize: 13, color: t.onVariant }}>{energyCopy[item.category]} · {item.price} · {copy.balance} {have}</Text>
                    </Pressable>
                  );
                })}
              </>
            ) : null}
            {pick && plot ? (
              <>
                <Text style={{ ...WORLD_FONT_TITLE, fontSize: 20, color: t.on }}>{copy.plantConfirm}</Text>
                <Text style={{ ...WORLD_FONT_BODY, color: t.onVariant, marginTop: 8 }}>{copy.plantConfirmBody}</Text>
                <Text style={{ ...WORLD_FONT_MED, color: t.on, marginTop: 12 }}>{energyCopy[pick.category]}</Text>
                <Text style={{ ...WORLD_FONT_BODY, color: t.onVariant, marginTop: 4 }}>{copy.energyNeeded}: {pick.price}</Text>
                <Text style={{ ...WORLD_FONT_BODY, color: t.outline }}>{copy.balance}: {balances?.[pick.category] ?? 0}</Text>
                {notice ? <Text style={{ ...WORLD_FONT_BODY, color: t.primary, marginTop: 12 }}>{notice}</Text> : null}
                <WorldButton label={copy.plant} onPress={() => void plant(pick, plot.index)} disabled={!canMutate || busy} />
              </>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={success} {...APP_MODAL_PROPS} onRequestClose={() => setSuccess(false)}>
        <Pressable style={{ flex: 1, backgroundColor: APP_MODAL_OVERLAY, justifyContent: 'center', padding: 24 }} onPress={() => setSuccess(false)}>
          <View style={{ backgroundColor: t.lowest, borderRadius: 24, padding: 24 }}>
            <Text style={{ ...WORLD_FONT_TITLE, fontSize: 22, color: t.on }}>{copy.plantSuccess}</Text>
            <WorldButton label={copy.continue} onPress={() => setSuccess(false)} />
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

function GardenInspectCard({
  name,
  category,
  stageIndex,
  nurtureDays,
  copy,
  onMove,
  onStore,
}: {
  name: string;
  category: string;
  stageIndex: number;
  nurtureDays: number;
  copy: ReturnType<typeof gardenCopy>;
  onMove: () => void;
  onStore: () => void;
}) {
  const t = useWorldStitch();
  const labels = [copy.sproutDay, copy.growDay, copy.bloomDay];
  const pct = Math.round((stageIndex / 3) * 100);
  return (
    <View style={{ marginTop: 16, backgroundColor: t.lowest, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: t.outlineVariant }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <View style={{ flex: 1, paddingRight: 8 }}>
          <Text style={{ ...WORLD_FONT_TITLE, fontSize: 16, color: t.on }}>{name}</Text>
          <Text style={{ ...WORLD_FONT_BODY, fontSize: 12, color: t.onVariant, marginTop: 2 }}>{category}</Text>
        </View>
        <View style={{ backgroundColor: 'rgba(0,183,166,0.2)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
          <Text style={{ ...WORLD_FONT_TITLE, fontSize: 10, color: t.primary }}>{stageIndex >= 3 ? copy.fullGrowth : `${copy.stage} ${stageIndex}/3`}</Text>
        </View>
      </View>
      <View style={{ backgroundColor: t.surfaceLow, borderRadius: 16, padding: 12 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
          <Text style={{ ...WORLD_FONT_TITLE, fontSize: 11, color: t.secondary }}>{copy.growthCycle}</Text>
          <Text style={{ ...WORLD_FONT_TITLE, fontSize: 11, color: t.primary }}>{pct}% ({stageIndex}/3)</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {labels.map((label, i) => {
            const filled = stageIndex >= i + 1;
            return (
              <View key={label} style={{ flex: 1, alignItems: 'center' }}>
                <View style={{ width: '100%', height: 8, borderRadius: 99, backgroundColor: filled ? t.cta : t.surfaceHighest, marginBottom: 6 }} />
                <Text style={{ ...WORLD_FONT_TITLE, fontSize: 10, color: filled ? t.primary : t.onVariant }}>{label}</Text>
                <Text style={{ ...WORLD_FONT_BODY, fontSize: 10, color: i + 1 === 3 && filled ? t.primary : t.onVariant }}>
                  {i + 1 === 3 && filled ? copy.reached : `${copy.dayShort} ${i + 1}`}
                </Text>
              </View>
            );
          })}
        </View>
      </View>
      <Text style={{ ...WORLD_FONT_MED, fontSize: 12, color: t.on, marginTop: 10 }}>{nurtureDays} {copy.daysKept}</Text>
      <View style={{ marginTop: 10, backgroundColor: t.surfaceHigh, borderRadius: 12, padding: 12 }}>
        <Text style={{ ...WORLD_FONT_BODY, fontSize: 12, lineHeight: 18, color: t.onVariant }}>{copy.growthKept}</Text>
        <Text style={{ ...WORLD_FONT_BODY, fontSize: 12, lineHeight: 18, color: t.onVariant, marginTop: 6 }}>{copy.keepPromise}</Text>
      </View>
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={copy.move}
          onPress={onMove}
          className="active:opacity-80"
          style={{ flex: 1, height: 44, borderRadius: 999, backgroundColor: t.secondaryContainer, alignItems: 'center', justifyContent: 'center' }}
        >
          <Text style={{ ...WORLD_FONT_TITLE, fontSize: 14, color: t.secondary }}>{copy.move}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={copy.store}
          onPress={onStore}
          className="active:opacity-80"
          style={{ flex: 1, height: 44, borderRadius: 999, backgroundColor: t.surfaceHigh, alignItems: 'center', justifyContent: 'center' }}
        >
          <Text style={{ ...WORLD_FONT_TITLE, fontSize: 14, color: t.on }}>{copy.store}</Text>
        </Pressable>
      </View>
    </View>
  );
}
