import React, { useMemo, useState } from 'react';
import { Modal, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, Heart, Lock, Sparkles } from 'lucide-react-native';
import { APP_MODAL_OVERLAY, APP_MODAL_PROPS } from '@/components/ui/appModal';
import { WorldHeader, WORLD_FONT_BODY, WORLD_FONT_MED, WORLD_FONT_TITLE, useWorldLocale } from '@/components/world/WorldChrome';
import { WorldMediPortrait } from '@/components/world/WorldMediPortrait';
import { useWorldStitch, WORLD_SHADOW } from '@/theme/worldStitch';
import { useCompanionWorld } from '@/hooks/useCompanionWorld';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { companionCopy } from '@/i18n/world/companion.js';
import { mediWorldApi } from '@/lib/mediWorld/api';
import { ApiError } from '@/lib/api';
import { useIsDark, useThemeColors } from '@/theme/colors';
import type { CompanionWorldState } from '@/lib/mediWorld/types';

const MOMENTS = ['greet', 'breathe', 'quiet', 'stretch', 'celebrate'] as const;
const FONT = 1.3;

export default function CareSpaceScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const dark = useIsDark();
  const t = useWorldStitch();
  const reduce = usePrefersReducedMotion();
  const { payload, loading, error, offline, refreshing, refresh, mutate, evolutionFrom, dismissEvolution } =
    useCompanionWorld();
  const { locale } = useWorldLocale();
  const copy = useMemo(() => companionCopy(locale), [locale]);
  const [renameOpen, setRenameOpen] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [stageOpen, setStageOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [lookTab, setLookTab] = useState<'look' | 'collection'>('look');

  const companion = payload?.companion;
  const dialogueKey = payload?.dialogue?.key || 'first_visit_today';
  const dialogue = (copy as Record<string, string>)[dialogueKey] || copy.first_visit_today;
  const canMutate = !offline && !busy;
  const stageLabel =
    (copy as Record<string, string>)[companion?.worldStageKey === 'radiant' ? 'radiantStage' : companion?.worldStageKey || ''] ||
    companion?.worldStageKey ||
    '';
  const doneCount = companion?.careMoment.completedKey ? 1 : 0;

  async function run(fn: () => Promise<unknown>) {
    if (!canMutate) return;
    setBusy(true);
    setNotice(null);
    try {
      await mutate(fn as () => Promise<NonNullable<typeof payload>>);
    } catch (err) {
      const code = err instanceof ApiError ? err.code : '';
      setNotice(code === 'INSUFFICIENT_CARE_ENERGY' ? copy.insufficient : copy.loadError);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.surface }}>
      <WorldHeader
        title={copy.careSpace}
        hidePageTitle
        navTitle={copy.careSpace}
        navSubtitle={copy.careSpaceBody}
        backLabel={copy.back}
        trailing={
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(166,241,228,0.4)', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 6, borderWidth: 1, borderColor: t.secondaryContainer }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: t.primary }} />
            <Text style={{ ...WORLD_FONT_TITLE, fontSize: 9, color: t.secondary }}>{copy.onlineShort}</Text>
          </View>
        }
      />
      <ScrollView
        contentContainerStyle={{
          paddingBottom: Math.max(insets.bottom, 24) + 32,
        }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void refresh(true, { spinner: true })} tintColor={t.cta} />
        }
      >
        {offline ? (
          <Text style={{ ...WORLD_FONT_MED, fontSize: 15, color: t.onVariant, marginTop: 12, paddingHorizontal: 20 }}>
            {copy.offline}
          </Text>
        ) : null}
        {error && !companion ? (
          <Pressable onPress={() => void refresh()} style={{ marginTop: 16, minHeight: 48, justifyContent: 'center', paddingHorizontal: 20 }}>
            <Text style={{ ...WORLD_FONT_MED, color: t.primary }}>{copy.retry}</Text>
          </Pressable>
        ) : null}

        {companion ? (
          <>
            <View style={{ paddingHorizontal: 20, marginTop: 4 }}>
              <LinearGradient
                colors={[t.lowest, t.surfaceLow, t.surfaceHigh]}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={{ borderRadius: 16, padding: 20, alignItems: 'center', overflow: 'hidden' }}
              >
                <View style={{ width: 220, height: 200, alignItems: 'center', justifyContent: 'center' }}>
                  <View style={{ position: 'absolute', width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(0,183,166,0.16)' }} />
                  <WorldMediPortrait size={200} accessibilityLabel={companion.displayName || copy.defaultName} />
                </View>
                <View style={{ marginTop: 8, width: '100%', backgroundColor: t.lowest, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10, ...WORLD_SHADOW, shadowColor: t.shadow }}>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                    <Sparkles size={20} color={t.primary} strokeWidth={2.2} />
                    <Text maxFontSizeMultiplier={FONT} style={{ ...WORLD_FONT_BODY, fontSize: 14, lineHeight: 20, color: t.on, flexShrink: 1, flex: 1 }}>
                      {dialogue}
                    </Text>
                  </View>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={copy.friendlyTouch}
                  disabled={!canMutate || !companion.careMoment.canComplete}
                  onPress={() => void run(() => mediWorldApi.careMoment('greet'))}
                  className="active:opacity-90"
                  style={{ marginTop: 14, width: '100%', opacity: canMutate && companion.careMoment.canComplete ? 1 : 0.45 }}
                >
                  <LinearGradient
                    colors={[t.cta, t.primary, t.secondary]}
                    start={{ x: 0, y: 0.5 }}
                    end={{ x: 1, y: 0.5 }}
                    style={{ height: 50, borderRadius: 999, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                  >
                    <Text style={{ ...WORLD_FONT_MED, fontSize: 14, color: t.onCta }}>{copy.friendlyTouch}</Text>
                  </LinearGradient>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={copy.rename}
                  disabled={!canMutate}
                  onPress={() => {
                    setNameDraft(companion.displayName || '');
                    setRenameOpen(true);
                  }}
                  style={{ marginTop: 10, minHeight: 36, justifyContent: 'center', opacity: canMutate ? 1 : 0.5 }}
                >
                  <Text style={{ ...WORLD_FONT_MED, fontSize: 12, color: t.primary }}>{copy.rename}</Text>
                </Pressable>
              </LinearGradient>
            </View>

            <View style={{ paddingHorizontal: 20, marginTop: 14 }}>
              <View style={{ backgroundColor: t.lowest, borderRadius: 16, padding: 16, ...WORLD_SHADOW, shadowColor: t.shadow }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                    <View style={{ width: 40, height: 40, borderRadius: 16, backgroundColor: t.secondaryContainer, alignItems: 'center', justifyContent: 'center' }}>
                      <Heart size={20} color={t.primary} strokeWidth={2.2} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ ...WORLD_FONT_MED, fontSize: 14, color: t.on }}>
                        {copy.bondLevelLabel} {companion.bond.bondLevel}
                      </Text>
                      <Text style={{ ...WORLD_FONT_BODY, fontSize: 12, color: t.primary, marginTop: 2 }}>{stageLabel}</Text>
                    </View>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ ...WORLD_FONT_TITLE, fontSize: 13, color: t.secondary }}>
                      {companion.bond.pointsIntoLevel} / {companion.bond.pointsRequiredForNextLevel}
                    </Text>
                    <Text style={{ ...WORLD_FONT_BODY, fontSize: 10, color: t.onVariant }}>{copy.points}</Text>
                  </View>
                </View>
                <View style={{ height: 10, borderRadius: 99, backgroundColor: t.surfaceHigh, overflow: 'hidden' }}>
                  <LinearGradient
                    colors={[t.cta, t.primary]}
                    start={{ x: 0, y: 0.5 }}
                    end={{ x: 1, y: 0.5 }}
                    style={{ width: `${Math.min(100, companion.bond.progressPercent)}%`, height: 10, borderRadius: 99 }}
                  />
                </View>
                <View style={{ marginTop: 8, flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Pressable onPress={() => setStageOpen(true)} style={{ minHeight: 28, justifyContent: 'center' }}>
                    <Text style={{ ...WORLD_FONT_MED, fontSize: 11, color: t.primary }}>{copy.evolution}</Text>
                  </Pressable>
                  <Text style={{ ...WORLD_FONT_TITLE, fontSize: 10, color: t.primary }}>
                    {copy.remainingPoints} {companion.bond.pointsNeededForNextLevel}
                  </Text>
                </View>
              </View>
            </View>

            <View style={{ paddingHorizontal: 20, marginTop: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <Text style={{ ...WORLD_FONT_TITLE, fontSize: 16, color: t.on }}>{copy.cosmetics}</Text>
                <View style={{ flexDirection: 'row', backgroundColor: t.surfaceHigh, borderRadius: 999, padding: 2 }}>
                  <Pressable
                    onPress={() => setLookTab('look')}
                    className="active:opacity-80"
                    style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: lookTab === 'look' ? t.lowest : 'transparent' }}
                  >
                    <Text style={{ ...WORLD_FONT_TITLE, fontSize: 11, color: lookTab === 'look' ? t.on : t.onVariant }}>{copy.lookTab}</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => router.push('/medi-world/collection' as never)}
                    className="active:opacity-80"
                    style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 }}
                  >
                    <Text style={{ ...WORLD_FONT_TITLE, fontSize: 11, color: t.onVariant }}>{copy.collection}</Text>
                  </Pressable>
                </View>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingRight: 8 }}>
                {(payload.catalog || []).map((item) => (
                  <CosmeticCard
                    key={item.key}
                    item={item}
                    copy={copy}
                    disabled={!canMutate}
                    onPress={() => {
                      if (item.owned && canMutate) void run(() => mediWorldApi.equipCosmetic(item.slot, item.active ? null : item.key));
                      else router.push('/medi-world/collection' as never);
                    }}
                  />
                ))}
              </ScrollView>
            </View>

            <View style={{ paddingHorizontal: 20, marginTop: 16 }}>
              <View style={{ backgroundColor: t.lowest, borderRadius: 16, padding: 16, ...WORLD_SHADOW, shadowColor: t.shadow }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
                  <Text style={{ ...WORLD_FONT_MED, fontSize: 14, color: t.on }}>{copy.dailyCare}</Text>
                  <Text style={{ ...WORLD_FONT_TITLE, fontSize: 10, color: t.primary }}>
                    {doneCount} / {MOMENTS.length} {copy.ofDone}
                  </Text>
                </View>
                {MOMENTS.map((key) => {
                  const done = companion.careMoment.completedKey === key;
                  return (
                    <View key={key} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, borderRadius: 16, backgroundColor: t.surfaceLow, marginBottom: 8 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, paddingRight: 8 }}>
                        <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: done ? t.cta : t.surfaceHighest, alignItems: 'center', justifyContent: 'center' }}>
                          {done ? <Check size={14} color={t.onCta} strokeWidth={2.6} /> : <Sparkles size={14} color={t.secondary} strokeWidth={2.2} />}
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ ...WORLD_FONT_MED, fontSize: 14, color: t.on }}>{(copy as Record<string, string>)[key]}</Text>
                        </View>
                      </View>
                      {done ? (
                        <Text style={{ ...WORLD_FONT_TITLE, fontSize: 10, color: t.secondary }}>{copy.doneShort}</Text>
                      ) : companion.careMoment.canComplete ? (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={copy.startNow}
                          disabled={!canMutate}
                          onPress={() => void run(() => mediWorldApi.careMoment(key))}
                          className="active:opacity-80"
                          style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: t.secondaryContainer }}
                        >
                          <Text style={{ ...WORLD_FONT_TITLE, fontSize: 11, color: t.onSecondaryContainer }}>{copy.startNow}</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={copy.openGarden}
              onPress={() => router.push('/medi-world/garden' as never)}
              style={{ marginTop: 16, paddingHorizontal: 20, minHeight: 44, justifyContent: 'center' }}
            >
              <Text style={{ ...WORLD_FONT_MED, fontSize: 14, color: t.primary }}>{copy.openGarden}</Text>
            </Pressable>
          </>
        ) : loading ? (
          <View style={{ height: 280, borderRadius: 16, backgroundColor: t.surfaceLow, marginTop: 16, marginHorizontal: 20 }} />
        ) : null}

        {notice ? (
          <Text maxFontSizeMultiplier={FONT} style={{ ...WORLD_FONT_BODY, color: t.onVariant, marginTop: 12, paddingHorizontal: 20 }}>
            {notice}
          </Text>
        ) : null}
      </ScrollView>

      <Modal visible={renameOpen} {...APP_MODAL_PROPS} onRequestClose={() => setRenameOpen(false)}>
        <View style={{ flex: 1, backgroundColor: APP_MODAL_OVERLAY, justifyContent: 'flex-end' }}>
          <Pressable style={{ flex: 1 }} onPress={() => setRenameOpen(false)} />
          <View style={{ backgroundColor: colors.surface, padding: 20, paddingBottom: Math.max(insets.bottom, 20) + 12, borderTopLeftRadius: 24, borderTopRightRadius: 24 }}>
            <Text style={{ ...WORLD_FONT_TITLE, fontSize: 18, color: colors.text100 }}>{copy.rename}</Text>
            <Text style={{ ...WORLD_FONT_BODY, fontSize: 14, color: colors.text200, marginTop: 8 }}>{copy.nameHint}</Text>
            <TextInput
              value={nameDraft}
              onChangeText={setNameDraft}
              maxLength={32}
              placeholder={copy.defaultName}
              placeholderTextColor={colors.text300}
              style={{
                marginTop: 12,
                minHeight: 48,
                borderRadius: 14,
                paddingHorizontal: 14,
                backgroundColor: colors.bg200,
                color: colors.text100,
                fontFamily: 'NotoSansGeorgian_400Regular',
                fontSize: 16,
              }}
            />
            <Pressable
              disabled={!canMutate}
              onPress={() => {
                void run(() => mediWorldApi.renameCompanion(nameDraft));
                setRenameOpen(false);
              }}
              style={{ marginTop: 14, minHeight: 48, borderRadius: 16, backgroundColor: dark ? '#0D9488' : colors.primary200, alignItems: 'center', justifyContent: 'center' }}
            >
              <Text style={{ ...WORLD_FONT_TITLE, color: '#FFFFFF' }}>{copy.renameSave}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={stageOpen} {...APP_MODAL_PROPS} onRequestClose={() => setStageOpen(false)}>
        <View style={{ flex: 1, backgroundColor: APP_MODAL_OVERLAY, justifyContent: 'flex-end' }}>
          <Pressable style={{ flex: 1 }} onPress={() => setStageOpen(false)} />
          <View style={{ backgroundColor: colors.surface, padding: 20, paddingBottom: Math.max(insets.bottom, 20) + 12, borderTopLeftRadius: 24, borderTopRightRadius: 24 }}>
            <Text style={{ ...WORLD_FONT_TITLE, fontSize: 18, color: colors.text100 }}>{copy.selectStage}</Text>
            {(payload?.evolution.stages || []).map((stage) => (
              <Pressable
                key={stage.key}
                disabled={!stage.unlocked || !canMutate}
                onPress={() => {
                  void run(() => mediWorldApi.selectStage(stage.key));
                  setStageOpen(false);
                }}
                style={{
                  marginTop: 10,
                  minHeight: 48,
                  borderRadius: 14,
                  paddingHorizontal: 14,
                  justifyContent: 'center',
                  backgroundColor: stage.selected ? (dark ? '#0D9488' : colors.primary200) : colors.bg200,
                  opacity: stage.unlocked ? 1 : 0.45,
                }}
              >
                <Text style={{ ...WORLD_FONT_MED, fontSize: 16, color: stage.selected ? '#FFFFFF' : colors.text100 }}>
                  {(copy as Record<string, string>)[stage.key === 'radiant' ? 'radiantStage' : stage.key] || stage.key}
                  {stage.unlocked ? '' : ` — ${copy.lockedStage}`}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </Modal>

      <Modal visible={Boolean(evolutionFrom?.length)} {...APP_MODAL_PROPS} onRequestClose={dismissEvolution}>
        <View style={{ flex: 1, backgroundColor: APP_MODAL_OVERLAY, justifyContent: 'center', paddingHorizontal: 24 }}>
          <View style={{ backgroundColor: colors.surface, borderRadius: 24, padding: 22 }}>
            <Text style={{ ...WORLD_FONT_TITLE, fontSize: 22, color: colors.text100 }}>{copy.celebrateEvolution}</Text>
            <Text style={{ ...WORLD_FONT_BODY, fontSize: 16, color: colors.text200, marginTop: 10 }}>{copy.celebrateEvolutionBody}</Text>
            <Pressable onPress={dismissEvolution} style={{ marginTop: 16, minHeight: 48, borderRadius: 16, backgroundColor: reduce ? colors.bg200 : dark ? '#0D9488' : colors.primary200, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ ...WORLD_FONT_TITLE, color: reduce ? colors.text100 : '#FFFFFF' }}>{copy.close}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function CosmeticCard({
  item,
  copy,
  disabled,
  onPress,
}: {
  item: CompanionWorldState['catalog'][number];
  copy: ReturnType<typeof companionCopy>;
  disabled: boolean;
  onPress: () => void;
}) {
  const t = useWorldStitch();
  const name = (copy as Record<string, string>)[item.nameKey] || item.fallbackLabel;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={name}
      disabled={disabled && !item.owned}
      onPress={onPress}
      className="active:opacity-90"
      style={{
        width: 148,
        borderRadius: 16,
        backgroundColor: item.owned ? t.lowest : t.surfaceHigh,
        padding: 12,
        alignItems: 'center',
        opacity: item.owned || item.eligible ? 1 : 0.7,
      }}
    >
      {item.active ? (
        <View style={{ position: 'absolute', top: 8, right: 8, width: 20, height: 20, borderRadius: 10, backgroundColor: t.primary, alignItems: 'center', justifyContent: 'center' }}>
          <Check size={12} color={t.onCta} strokeWidth={2.6} />
        </View>
      ) : !item.owned ? (
        <View style={{ position: 'absolute', top: 8, right: 8, width: 20, height: 20, borderRadius: 10, backgroundColor: t.surfaceHighest, alignItems: 'center', justifyContent: 'center' }}>
          <Lock size={12} color={t.outline} strokeWidth={2.2} />
        </View>
      ) : null}
      <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: t.surfaceLow, alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
        <Sparkles size={28} color={item.owned ? t.primary : t.outline} strokeWidth={2.2} />
      </View>
      <Text numberOfLines={2} style={{ ...WORLD_FONT_MED, fontSize: 14, color: t.on, textAlign: 'center' }}>{name}</Text>
      <Text style={{ ...WORLD_FONT_TITLE, fontSize: 10, color: item.active ? t.primary : t.onVariant, marginTop: 4 }}>
        {item.active ? copy.activeLook : item.owned ? copy.unlockedLook : `${copy.lockedLevelShort} ${item.worldLevel}`}
      </Text>
    </Pressable>
  );
}
