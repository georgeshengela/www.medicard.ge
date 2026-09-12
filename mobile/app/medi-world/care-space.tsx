import React, { useMemo, useState } from 'react';
import { Modal, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';
import { APP_MODAL_OVERLAY, APP_MODAL_PROPS } from '@/components/ui/appModal';
import { CareMediFigure } from '@/components/world/CareMediFigure';
import { useCompanionWorld } from '@/hooks/useCompanionWorld';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { companionCopy } from '@/i18n/world/companion.js';
import { mediWorldApi } from '@/lib/mediWorld/api';
import { ApiError } from '@/lib/api';
import { QUEST } from '@/theme/questTokens';
import { useIsDark, useThemeColors } from '@/theme/colors';

const MOMENTS = ['greet', 'breathe', 'quiet', 'stretch', 'celebrate'] as const;
const FONT = 1.3;

export default function CareSpaceScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const dark = useIsDark();
  const reduce = usePrefersReducedMotion();
  const { payload, loading, error, offline, refreshing, refresh, mutate, evolutionFrom, dismissEvolution } =
    useCompanionWorld();
  const [locale, setLocale] = useState<'ka' | 'en'>('ka');
  const copy = useMemo(() => companionCopy(locale), [locale]);
  const [renameOpen, setRenameOpen] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [stageOpen, setStageOpen] = useState(false);
  const [momentOpen, setMomentOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const fontTitle = { fontFamily: 'NotoSansGeorgian_700Bold' as const };
  const fontBody = { fontFamily: 'NotoSansGeorgian_400Regular' as const };
  const fontMed = { fontFamily: 'NotoSansGeorgian_500Medium' as const };
  const companion = payload?.companion;
  const dialogueKey = payload?.dialogue?.key || 'first_visit_today';
  const dialogue = (copy as Record<string, string>)[dialogueKey] || copy.first_visit_today;
  const canMutate = !offline && !busy;

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
    <View style={{ flex: 1, backgroundColor: colors.bg100 }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 8,
          paddingBottom: Math.max(insets.bottom, 24) + 32,
          paddingHorizontal: 16,
        }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void refresh(true, { spinner: true })} tintColor={colors.primary200} />
        }
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={copy.back}
          onPress={() => router.back()}
          className="active:opacity-75"
          style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' }}
        >
          <ArrowLeft size={22} color={colors.text100} strokeWidth={2.2} />
        </Pressable>

        <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
          <Chip label="ქარ" active={locale === 'ka'} onPress={() => setLocale('ka')} />
          <Chip label="EN" active={locale === 'en'} onPress={() => setLocale('en')} />
        </View>

        <Text accessibilityRole="header" maxFontSizeMultiplier={FONT} style={{ ...fontTitle, fontSize: 28, lineHeight: 34, color: colors.text100, marginTop: 16 }}>
          {copy.careSpace}
        </Text>
        <Text maxFontSizeMultiplier={FONT} style={{ ...fontBody, fontSize: 16, lineHeight: 22, color: colors.text200, marginTop: 8 }}>
          {copy.careSpaceBody}
        </Text>

        {offline ? (
          <Text maxFontSizeMultiplier={FONT} style={{ ...fontMed, fontSize: 15, color: colors.text200, marginTop: 12 }}>
            {copy.offline}
          </Text>
        ) : null}
        {error && !companion ? (
          <Pressable onPress={() => void refresh()} style={{ marginTop: 16, minHeight: 48, justifyContent: 'center' }}>
            <Text style={{ ...fontMed, color: colors.primary200 }}>{copy.retry}</Text>
          </Pressable>
        ) : null}

        {companion ? (
          <>
            <View
              style={{
                marginTop: 20,
                borderRadius: 28,
                padding: 20,
                alignItems: 'center',
                backgroundColor: dark ? colors.surface : QUEST.wash.lightSoft,
              }}
            >
              <CareMediFigure
                stageKey={companion.worldStageKey}
                size={companion.presentation?.figureSize || 128}
                auraKey={companion.equipment.aura}
                trail={Boolean(companion.equipment.trail)}
                charm={Boolean(companion.equipment.charm)}
                accent={Boolean(companion.equipment.care_space_accent)}
                reducedMotion={reduce}
              />
              <Text maxFontSizeMultiplier={FONT} style={{ ...fontTitle, fontSize: 26, color: colors.text100, marginTop: 8 }}>
                {companion.displayName || copy.defaultName}
              </Text>
              <Text maxFontSizeMultiplier={FONT} style={{ ...fontMed, fontSize: 15, color: colors.text200, marginTop: 4 }}>
                {(copy as Record<string, string>)[companion.worldStageKey === 'radiant' ? 'radiantStage' : companion.worldStageKey] || companion.worldStageKey}
              </Text>
              <Text maxFontSizeMultiplier={FONT} style={{ ...fontBody, fontSize: 16, lineHeight: 22, color: colors.text200, marginTop: 12, textAlign: 'center' }}>
                {dialogue}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={copy.rename}
                disabled={!canMutate}
                onPress={() => {
                  setNameDraft(companion.displayName || '');
                  setRenameOpen(true);
                }}
                style={{ marginTop: 12, minHeight: 44, justifyContent: 'center', opacity: canMutate ? 1 : 0.5 }}
              >
                <Text style={{ ...fontMed, color: colors.primary200 }}>{copy.rename}</Text>
              </Pressable>
            </View>

            <View style={{ marginTop: 16, borderRadius: 20, padding: 16, backgroundColor: colors.surface }}>
              <Text maxFontSizeMultiplier={FONT} style={{ ...fontTitle, fontSize: 16, color: colors.text100 }}>
                {copy.bond} {companion.bond.bondLevel}
              </Text>
              <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.bg300, marginTop: 10, overflow: 'hidden' }}>
                <View
                  style={{
                    width: `${companion.bond.progressPercent}%`,
                    height: 8,
                    backgroundColor: reduce ? colors.primary200 : '#0D9488',
                  }}
                />
              </View>
              <Text maxFontSizeMultiplier={FONT} style={{ ...fontBody, fontSize: 14, color: colors.text200, marginTop: 8 }}>
                {copy.bondHint}
              </Text>
              <Text maxFontSizeMultiplier={FONT} style={{ ...fontMed, fontSize: 14, color: colors.text300, marginTop: 6 }}>
                {copy.worldLevel} {payload?.world.worldLevel}
              </Text>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={copy.careMoment}
              disabled={!canMutate || !companion.careMoment.canComplete}
              onPress={() => setMomentOpen(true)}
              className="active:opacity-75"
              style={{
                marginTop: 12,
                minHeight: 52,
                borderRadius: 16,
                backgroundColor: dark ? colors.surfaceRaised : colors.bg200,
                justifyContent: 'center',
                paddingHorizontal: 16,
                opacity: companion.careMoment.canComplete && canMutate ? 1 : 0.55,
              }}
            >
              <Text style={{ ...fontTitle, fontSize: 16, color: colors.text100 }}>{copy.careMoment}</Text>
              <Text style={{ ...fontBody, fontSize: 14, color: colors.text200, marginTop: 4 }}>
                {companion.careMoment.canComplete ? copy.careMomentBody : copy.careMomentDone}
              </Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              onPress={() => setStageOpen(true)}
              className="active:opacity-75"
              style={{ marginTop: 12, minHeight: 52, borderRadius: 16, backgroundColor: colors.surface, justifyContent: 'center', paddingHorizontal: 16 }}
            >
              <Text style={{ ...fontTitle, fontSize: 16, color: colors.text100 }}>{copy.evolution}</Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={copy.openGarden}
              onPress={() => router.push('/medi-world/garden' as never)}
              className="active:opacity-75"
              style={{ marginTop: 12, minHeight: 52, borderRadius: 16, backgroundColor: colors.surface, justifyContent: 'center', paddingHorizontal: 16 }}
            >
              <Text style={{ ...fontTitle, fontSize: 16, color: colors.text100 }}>{copy.openGarden}</Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={copy.collection}
              onPress={() => router.push('/medi-world/collection' as never)}
              className="active:opacity-75"
              style={{
                marginTop: 12,
                minHeight: 52,
                borderRadius: 16,
                backgroundColor: dark ? '#0D9488' : colors.primary200,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ ...fontTitle, fontSize: 16, color: '#FFFFFF' }}>{copy.collection}</Text>
            </Pressable>
          </>
        ) : loading ? (
          <View style={{ height: 180, borderRadius: 24, backgroundColor: colors.bg200, marginTop: 24 }} />
        ) : null}

        {notice ? (
          <Text maxFontSizeMultiplier={FONT} style={{ ...fontBody, color: colors.text200, marginTop: 12 }}>
            {notice}
          </Text>
        ) : null}
      </ScrollView>

      <Modal visible={renameOpen} {...APP_MODAL_PROPS} onRequestClose={() => setRenameOpen(false)}>
        <View style={{ flex: 1, backgroundColor: APP_MODAL_OVERLAY, justifyContent: 'flex-end' }}>
          <Pressable style={{ flex: 1 }} onPress={() => setRenameOpen(false)} />
          <View style={{ backgroundColor: colors.surface, padding: 20, paddingBottom: Math.max(insets.bottom, 20) + 12, borderTopLeftRadius: 24, borderTopRightRadius: 24 }}>
            <Text style={{ ...fontTitle, fontSize: 18, color: colors.text100 }}>{copy.rename}</Text>
            <Text style={{ ...fontBody, fontSize: 14, color: colors.text200, marginTop: 8 }}>{copy.nameHint}</Text>
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
              <Text style={{ ...fontTitle, color: '#FFFFFF' }}>{copy.renameSave}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={momentOpen} {...APP_MODAL_PROPS} onRequestClose={() => setMomentOpen(false)}>
        <View style={{ flex: 1, backgroundColor: APP_MODAL_OVERLAY, justifyContent: 'flex-end' }}>
          <Pressable style={{ flex: 1 }} onPress={() => setMomentOpen(false)} />
          <View style={{ backgroundColor: colors.surface, padding: 20, paddingBottom: Math.max(insets.bottom, 20) + 12, borderTopLeftRadius: 24, borderTopRightRadius: 24 }}>
            <Text style={{ ...fontTitle, fontSize: 18, color: colors.text100 }}>{copy.careMoment}</Text>
            <Text style={{ ...fontBody, fontSize: 15, color: colors.text200, marginTop: 8 }}>{copy.careMomentBody}</Text>
            {MOMENTS.map((key) => (
              <Pressable
                key={key}
                disabled={!canMutate}
                onPress={() => {
                  void run(() => mediWorldApi.careMoment(key));
                  setMomentOpen(false);
                }}
                style={{ marginTop: 10, minHeight: 48, borderRadius: 14, backgroundColor: colors.bg200, justifyContent: 'center', paddingHorizontal: 14 }}
              >
                <Text style={{ ...fontMed, fontSize: 16, color: colors.text100 }}>{(copy as Record<string, string>)[key]}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </Modal>

      <Modal visible={stageOpen} {...APP_MODAL_PROPS} onRequestClose={() => setStageOpen(false)}>
        <View style={{ flex: 1, backgroundColor: APP_MODAL_OVERLAY, justifyContent: 'flex-end' }}>
          <Pressable style={{ flex: 1 }} onPress={() => setStageOpen(false)} />
          <View style={{ backgroundColor: colors.surface, padding: 20, paddingBottom: Math.max(insets.bottom, 20) + 12, borderTopLeftRadius: 24, borderTopRightRadius: 24 }}>
            <Text style={{ ...fontTitle, fontSize: 18, color: colors.text100 }}>{copy.selectStage}</Text>
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
                <Text style={{ ...fontMed, fontSize: 16, color: stage.selected ? '#FFFFFF' : colors.text100 }}>
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
            <Text style={{ ...fontTitle, fontSize: 22, color: colors.text100 }}>{copy.celebrateEvolution}</Text>
            <Text style={{ ...fontBody, fontSize: 16, color: colors.text200, marginTop: 10 }}>{copy.celebrateEvolutionBody}</Text>
            <Pressable onPress={dismissEvolution} style={{ marginTop: 16, minHeight: 48, borderRadius: 16, backgroundColor: reduce ? colors.bg200 : dark ? '#0D9488' : colors.primary200, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ ...fontTitle, color: reduce ? colors.text100 : '#FFFFFF' }}>{copy.close}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const colors = useThemeColors();
  const dark = useIsDark();
  return (
    <Pressable
      onPress={onPress}
      className="active:opacity-75"
      style={{
        minHeight: 36,
        paddingHorizontal: 12,
        borderRadius: 14,
        justifyContent: 'center',
        backgroundColor: active ? (dark ? '#0D9488' : colors.primary200) : colors.bg200,
      }}
    >
      <Text style={{ fontFamily: 'NotoSansGeorgian_500Medium', color: active ? '#FFFFFF' : colors.text100 }}>{label}</Text>
    </Pressable>
  );
}
