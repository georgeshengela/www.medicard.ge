import React, { useMemo, useState } from 'react';
import { Image, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Heart } from 'lucide-react-native';
import { WorldHeader, useWorldLocale } from '@/components/world/WorldChrome';
import { MEDI_WORLD_ART } from '@/lib/mediWorld/art';
import { useWorldStitch } from '@/theme/worldStitch';
import { useTodayAdventure } from '@/hooks/useTodayAdventure';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { adventureCopy } from '@/i18n/world/adventure.js';
import { mediWorldApi } from '@/lib/mediWorld/api';
import { ApiError } from '@/lib/api';
import type { AdventureSlot } from '@/lib/mediWorld/types';
import { QUEST } from '@/theme/questTokens';
import { useIsDark, useThemeColors } from '@/theme/colors';

const FONT = 1.3;
const CAP_LABEL: Record<string, 'capDailySteps' | 'capDailyHydration' | 'capDailyMedi' | 'capCareMoment'> = {
  'quest.daily_steps': 'capDailySteps',
  'quest.daily_hydration': 'capDailyHydration',
  'quest.daily_medi': 'capDailyMedi',
  'companion.care_moment': 'capCareMoment',
};

function slotLabel(copy: ReturnType<typeof adventureCopy>, key: string) {
  const mapped = CAP_LABEL[key];
  return mapped ? copy[mapped] : key;
}

function nodeColor(status: string, colors: ReturnType<typeof useThemeColors>, current: boolean) {
  if (status === 'completed') return colors.primary200;
  if (current) return colors.primary100;
  return colors.bg300;
}

export default function TodayAdventureScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const dark = useIsDark();
  const t = useWorldStitch();
  const reduce = usePrefersReducedMotion();
  const { payload, loading, error, offline, stale, expired, refreshing, refresh, mutate, enabled } = useTodayAdventure();
  const { locale } = useWorldLocale();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const copy = useMemo(() => adventureCopy(locale), [locale]);
  const adventure = payload?.adventure;
  const fontBody = { fontFamily: 'NotoSansGeorgian_400Regular' as const };
  const fontMed = { fontFamily: 'NotoSansGeorgian_500Medium' as const };
  const canMutate = !offline && !busy && !stale && !expired && enabled;
  const narrative = adventure
    ? (copy as Record<string, string>)[adventure.narrativeKey] || copy.greeting
    : copy.greeting;

  const required = (adventure?.slots || []).filter((slot) => slot.slotKey !== 'choice' || slot.selected);
  const pathSlots = (adventure?.slots || []).filter((slot) => slot.slotKey !== 'choice' || slot.optionKey === 'a' || slot.selected);
  const visible = (adventure?.slots || []).filter((slot) => {
    if (slot.status === 'swapped') return false;
    if (slot.slotKey === 'choice') return true;
    return true;
  });
  const current = visible.find((slot) => slot.status !== 'completed' && (slot.slotKey !== 'choice' || slot.selected))
    || visible.find((slot) => slot.slotKey !== 'choice');

  async function run(fn: () => Promise<unknown>) {
    if (!canMutate) return;
    setBusy(true);
    setNotice(null);
    try {
      await mutate(fn as () => Promise<NonNullable<typeof payload>>);
    } catch (err) {
      const code = err instanceof ApiError ? err.code : '';
      if (code === 'ADVENTURE_SWAP_EXHAUSTED') setNotice(copy.swapExhausted);
      else if (code === 'ADVENTURE_NO_ALTERNATIVE') setNotice(copy.noAlternative);
      else setNotice(copy.loadError);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.surface }}>
      <WorldHeader
        title={copy.title}
        subtitle={enabled ? narrative : copy.featureOff}
        backLabel={copy.back}
      />
      <ScrollView
        contentContainerStyle={{
          paddingBottom: Math.max(insets.bottom, 24) + 32,
          paddingHorizontal: 16,
        }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void refresh(true)} tintColor={colors.primary200} />
        }
      >

        {enabled && expired ? (
          <Text maxFontSizeMultiplier={FONT} style={{ ...fontBody, fontSize: 13, lineHeight: 20, color: colors.text300, marginTop: 10 }}>
            {copy.expiredOffline}
          </Text>
        ) : enabled && (offline || stale) ? (
          <Text maxFontSizeMultiplier={FONT} style={{ ...fontBody, fontSize: 13, lineHeight: 20, color: colors.text300, marginTop: 10 }}>
            {copy.offline}
          </Text>
        ) : null}

        <View style={{ alignItems: 'center', marginTop: 12 }}>
          <View style={{ width: '100%', height: 180, borderRadius: 24, overflow: 'hidden', backgroundColor: t.surfaceLow }}>
            <Image source={MEDI_WORLD_ART.stitchPathway} accessibilityLabel={copy.title} resizeMode="cover" style={{ width: '100%', height: '100%' }} />
          </View>
        </View>

        {enabled && loading && !adventure ? (
          <Text style={{ ...fontBody, fontSize: 14, color: colors.text300, marginTop: 24 }}>{copy.retry}</Text>
        ) : null}
        {enabled && error && !adventure ? (
          <Pressable onPress={() => void refresh()} className="active:opacity-75" style={{ marginTop: 16 }}>
            <Text style={{ ...fontMed, fontSize: 15, color: colors.primary200 }}>{copy.retry}</Text>
          </Pressable>
        ) : null}

        {notice ? (
          <Text style={{ ...fontBody, fontSize: 14, lineHeight: 20, color: colors.text200, marginTop: 12 }}>{notice}</Text>
        ) : null}

        {enabled && adventure ? (
          <View style={{ marginTop: 8 }}>
            <PathTrack slots={visible} currentId={`${current?.slotKey}:${current?.optionKey}`} colors={colors} reduce={reduce} />
            {visible.map((slot) => (
              <MissionCard
                key={`${slot.slotKey}-${slot.optionKey}`}
                slot={slot}
                copy={copy}
                colors={colors}
                current={current?.slotKey === slot.slotKey && current?.optionKey === slot.optionKey}
                canMutate={canMutate}
                swapsRemaining={adventure.swapsRemaining}
                onOpen={() => router.push(slot.href as never)}
                onSelect={() => void run(() => mediWorldApi.adventureChoice(slot.optionKey))}
                onSwap={() =>
                  void run(() =>
                    mediWorldApi.adventureSwap(slot.slotKey as 'anchor' | 'balance', `swap:${adventure.periodKey}:${slot.slotKey}:${Date.now()}`),
                  )
                }
              />
            ))}

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={copy.restDayCta}
                onPress={() => void run(() => mediWorldApi.adventureRestDay())}
                className="active:opacity-75"
                style={{
                  flex: 1,
                  borderRadius: QUEST.radius,
                  borderWidth: 1,
                  borderColor: colors.bg300,
                  backgroundColor: colors.surface,
                  padding: 14,
                }}
              >
                <Text style={{ ...fontMed, fontSize: 14, color: colors.text100 }}>{copy.restDayCta}</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={copy.preferences}
                onPress={() => router.push('/medi-world/adventure-preferences' as never)}
                className="active:opacity-75"
                style={{
                  flex: 1,
                  borderRadius: QUEST.radius,
                  borderWidth: 1,
                  borderColor: colors.bg300,
                  backgroundColor: colors.surface,
                  padding: 14,
                }}
              >
                <Text style={{ ...fontMed, fontSize: 14, color: colors.text100 }}>{copy.preferences}</Text>
              </Pressable>
            </View>
            <Text style={{ ...fontBody, fontSize: 12, lineHeight: 18, color: colors.text300, marginTop: 10 }}>
              {copy.swapLeft}: {adventure.swapsRemaining}
            </Text>
            {adventure.restDay ? (
              <Text style={{ ...fontBody, fontSize: 14, lineHeight: 22, color: colors.text200, marginTop: 8 }}>{copy.rest}</Text>
            ) : null}
            {adventure.completion.complete ? (
              <Text style={{ ...fontMed, fontSize: 16, lineHeight: 22, color: colors.primary200, marginTop: 12 }}>{copy.enough}</Text>
            ) : null}
            {required.length === 0 ? (
              <Text style={{ ...fontBody, fontSize: 15, lineHeight: 22, color: colors.text200, marginTop: 8 }}>{copy.recovery}</Text>
            ) : null}
          </View>
        ) : null}

        {enabled ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={copy.careSpace}
            onPress={() => router.push('/medi-world/care-space' as never)}
            className="active:opacity-75"
            style={{
              marginTop: 20,
              borderRadius: QUEST.radius,
              borderWidth: 1,
              borderColor: colors.bg300,
              backgroundColor: colors.surface,
              padding: QUEST.pad,
              flexDirection: 'row',
              gap: 12,
              alignItems: 'center',
            }}
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                backgroundColor: dark ? QUEST.wash.dark : QUEST.wash.light,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Heart size={20} color={colors.primary200} strokeWidth={2.2} />
            </View>
            <Text style={{ ...fontMed, fontSize: 15, color: colors.text100, flex: 1 }}>{copy.careSpace}</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </View>
  );
}

function PathTrack({
  slots,
  currentId,
  colors,
  reduce,
}: {
  slots: AdventureSlot[];
  currentId: string;
  colors: ReturnType<typeof useThemeColors>;
  reduce: boolean;
}) {
  const nodes = slots.filter((slot) => slot.slotKey !== 'choice' || slot.optionKey === 'a' || slot.selected);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginVertical: 18, gap: 0 }}>
      {nodes.map((slot, index) => {
        const id = `${slot.slotKey}:${slot.optionKey}`;
        const current = id === currentId;
        const glow = current && !reduce;
        return (
          <View key={id} style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View
              style={{
                width: current ? 18 : 12,
                height: current ? 18 : 12,
                borderRadius: 99,
                backgroundColor: nodeColor(slot.status, colors, current),
                shadowColor: glow ? colors.primary200 : 'transparent',
                shadowOpacity: glow ? 0.55 : 0,
                shadowRadius: glow ? 10 : 0,
              }}
            />
            {index < nodes.length - 1 ? (
              <View style={{ width: 28, height: 2, backgroundColor: colors.bg300 }} />
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

function MissionCard({
  slot,
  copy,
  colors,
  current,
  canMutate,
  swapsRemaining,
  onOpen,
  onSelect,
  onSwap,
}: {
  slot: AdventureSlot;
  copy: ReturnType<typeof adventureCopy>;
  colors: ReturnType<typeof useThemeColors>;
  current: boolean;
  canMutate: boolean;
  swapsRemaining: number;
  onOpen: () => void;
  onSelect: () => void;
  onSwap: () => void;
}) {
  const fontTitle = { fontFamily: 'NotoSansGeorgian_700Bold' as const };
  const fontBody = { fontFamily: 'NotoSansGeorgian_400Regular' as const };
  const fontMed = { fontFamily: 'NotoSansGeorgian_500Medium' as const };
  const kind = slot.slotKey === 'anchor' ? copy.anchor : slot.slotKey === 'balance' ? copy.balance : copy.choice;
  const statusLabel =
    slot.status === 'completed'
      ? copy.completed
      : slot.status === 'in_progress'
        ? copy.inProgress
        : slot.status === 'swapped'
          ? copy.swapped
          : copy.available;
  return (
    <View
      style={{
        marginTop: 12,
        borderRadius: QUEST.radius,
        borderWidth: current ? 1.5 : 1,
        borderColor: current ? colors.primary200 : colors.bg300,
        backgroundColor: colors.surface,
        padding: QUEST.pad,
      }}
    >
      <Text style={{ ...fontMed, fontSize: 12, color: colors.text300 }}>{kind}</Text>
      <Text maxFontSizeMultiplier={FONT} style={{ ...fontTitle, fontSize: 18, color: colors.text100, marginTop: 4 }}>
        {slotLabel(copy, slot.capabilityKey)}
      </Text>
      <Text style={{ ...fontBody, fontSize: 13, color: colors.text200, marginTop: 4 }}>{statusLabel}</Text>
      {slot.target != null ? (
        <Text style={{ ...fontBody, fontSize: 13, color: colors.text300, marginTop: 4 }}>
          {slot.progress} / {slot.target}
        </Text>
      ) : null}
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
        <Pressable
          accessibilityRole="button"
          onPress={onOpen}
          className="active:opacity-75"
          style={{ flex: 1, borderRadius: 14, backgroundColor: colors.bg200, paddingVertical: 10, alignItems: 'center' }}
        >
          <Text style={{ ...fontMed, fontSize: 13, color: colors.text100 }}>
            {slot.capabilityKey === 'companion.care_moment' ? copy.openCare : copy.openQuest}
          </Text>
        </Pressable>
        {slot.slotKey === 'choice' && !slot.selected ? (
          <Pressable
            accessibilityRole="button"
            onPress={canMutate ? onSelect : undefined}
            className="active:opacity-75"
            style={{ flex: 1, borderRadius: 14, backgroundColor: colors.bg200, paddingVertical: 10, alignItems: 'center' }}
          >
            <Text style={{ ...fontMed, fontSize: 13, color: colors.text100 }}>{copy.select}</Text>
          </Pressable>
        ) : null}
        {(slot.slotKey === 'anchor' || slot.slotKey === 'balance') && slot.status !== 'completed' ? (
          <Pressable
            accessibilityRole="button"
            onPress={canMutate && swapsRemaining > 0 ? onSwap : undefined}
            className="active:opacity-75"
            style={{ flex: 1, borderRadius: 14, backgroundColor: colors.bg200, paddingVertical: 10, alignItems: 'center' }}
          >
            <Text style={{ ...fontMed, fontSize: 13, color: colors.text100 }}>
              {swapsRemaining > 0 ? copy.swap : copy.swapExhausted}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

