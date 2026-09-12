import React, { useMemo, useState } from 'react';
import { Modal, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Droplets, Heart, Info, Leaf, Sparkles, Waves } from 'lucide-react-native';
import { Bone } from '@/components/ui/Skeleton';
import { APP_MODAL_OVERLAY, APP_MODAL_PROPS } from '@/components/ui/appModal';
import { useMediWorldProfile } from '@/hooks/useMediWorldProfile';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { worldCopy, worldReasonText } from '@/i18n/world/catalog.js';
import { useMediWorldAvailable, useMediWorldGardenAvailable } from '@/lib/mediWorld/enabled';
import { CARE_ENERGY_ORDER } from '@/lib/mediWorld/energyOrder';
import type { CareEnergyType } from '@/lib/mediWorld/types';
import { QUEST } from '@/theme/questTokens';
import { useIsDark, useThemeColors } from '@/theme/colors';

function EnergyIcon({ type, color }: { type: CareEnergyType; color: string }) {
  const props = { size: 18, color, strokeWidth: 2.2 } as const;
  if (type === 'hydration') return <Droplets {...props} />;
  if (type === 'calm') return <Waves {...props} />;
  if (type === 'care') return <Sparkles {...props} />;
  if (type === 'connection') return <Heart {...props} />;
  return <Leaf {...props} />;
}

export default function MediWorldScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const dark = useIsDark();
  const reduce = usePrefersReducedMotion();
  const enabled = useMediWorldAvailable();
  const gardenEnabled = useMediWorldGardenAvailable();
  const { payload, loading, error, offline, refreshing, refresh, celebrationFrom, dismissCelebration } =
    useMediWorldProfile();
  const [locale, setLocale] = useState<'ka' | 'en'>('ka');
  const [helpOpen, setHelpOpen] = useState(false);
  const copy = useMemo(() => worldCopy(locale), [locale]);
  const profile = payload?.profile;
  const fontTitle = { fontFamily: 'NotoSansGeorgian_700Bold' as const };
  const fontBody = { fontFamily: 'NotoSansGeorgian_400Regular' as const };
  const fontMed = { fontFamily: 'NotoSansGeorgian_500Medium' as const };
  const worldLevel = profile?.worldLevel || profile?.foundation?.level || 1;
  const worldXp = profile?.worldXp ?? profile?.foundation?.xp ?? 0;
  const progressPct = profile?.foundation?.progressPercent ?? 0;
  const atCap = Boolean(profile?.foundation?.atCap);
  const celebrate = celebrationFrom != null && worldLevel > celebrationFrom;

  const shellPad = {
    paddingTop: insets.top + 8,
    paddingBottom: Math.max(insets.bottom, 24) + 88,
    paddingHorizontal: 16,
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg100 }}>
      <ScrollView
        contentContainerStyle={shellPad}
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

        <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
          <LangChip label={copy.langKa} active={locale === 'ka'} onPress={() => setLocale('ka')} />
          <LangChip label={copy.langEn} active={locale === 'en'} onPress={() => setLocale('en')} />
        </View>

        <Text accessibilityRole="header" maxFontSizeMultiplier={1.6} style={{ ...fontTitle, fontSize: 28, lineHeight: 34, color: colors.text100, marginTop: 18 }}>
          {copy.title}
        </Text>
        <Text maxFontSizeMultiplier={1.6} style={{ ...fontMed, fontSize: 15, lineHeight: 22, color: colors.text200, marginTop: 6 }}>
          {copy.subtitle}
        </Text>
        <Text maxFontSizeMultiplier={1.6} style={{ ...fontBody, fontSize: 15, lineHeight: 22, color: colors.text200, marginTop: 10 }}>
          {copy.productLine}
        </Text>

        {!enabled ? (
          <InfoCard title={copy.awakening} body={copy.awakeningBody} dark={dark} colors={colors} />
        ) : null}

        {enabled && loading && !profile ? (
          <View style={{ marginTop: 24, gap: 10 }}>
            {reduce ? (
              <>
                <View style={{ height: 88, borderRadius: 24, backgroundColor: colors.bg200 }} />
                <View style={{ height: 56, borderRadius: 16, backgroundColor: colors.bg200 }} />
                <View style={{ height: 56, borderRadius: 16, backgroundColor: colors.bg200 }} />
              </>
            ) : (
              <>
                <Bone height={88} radius={24} />
                <Bone height={56} radius={16} />
                <Bone height={56} radius={16} />
              </>
            )}
          </View>
        ) : null}

        {enabled && ((error && !loading) || (offline && !profile && !loading)) ? (
          <StateCard title={offline ? copy.offline : copy.loadError} action={copy.retry} onPress={() => void refresh()} />
        ) : null}

        {enabled && profile ? (
          <>
            <View
              style={{
                marginTop: 22,
                borderRadius: QUEST.radius,
                borderWidth: 1,
                borderColor: colors.bg300,
                backgroundColor: colors.surface,
                padding: QUEST.pad,
              }}
            >
              <Text style={{ ...fontMed, fontSize: 13, color: colors.text300 }}>{copy.level}</Text>
              <Text accessibilityLabel={`${copy.level} ${worldLevel}`} maxFontSizeMultiplier={1.6} style={{ ...fontTitle, fontSize: 36, lineHeight: 42, color: colors.text100, marginTop: 4 }}>
                {worldLevel}
              </Text>
              <View style={{ height: 8, borderRadius: 999, backgroundColor: colors.bg200, marginTop: 12, overflow: 'hidden' }}>
                <View style={{ width: `${Math.min(100, progressPct)}%`, height: '100%', backgroundColor: colors.primary200, borderRadius: 999 }} />
              </View>
              <Text style={{ ...fontBody, fontSize: 13, lineHeight: 18, color: colors.text300, marginTop: 8 }}>
                {atCap ? copy.levelCap : `${copy.xpToNext} · ${profile.foundation.xpNeededForNextLevel}`}
              </Text>
              <Text style={{ ...fontBody, fontSize: 12, lineHeight: 18, color: colors.text300, marginTop: 6 }}>
                {copy.worldXp} {worldXp} · {copy.worldXpHint}
              </Text>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={copy.openCareSpace}
              onPress={() => router.push('/medi-world/care-space' as never)}
              className="active:opacity-75"
              style={{
                marginTop: 16,
                borderRadius: QUEST.radius,
                borderWidth: 1,
                borderColor: colors.bg300,
                backgroundColor: colors.surface,
                padding: QUEST.pad,
              }}
            >
              <Text style={{ ...fontMed, fontSize: 13, color: colors.text300 }}>{copy.companionCard}</Text>
              <Text style={{ ...fontTitle, fontSize: 20, color: colors.text100, marginTop: 6 }}>{copy.openCareSpace}</Text>
              <Text style={{ ...fontBody, fontSize: 14, lineHeight: 20, color: colors.text200, marginTop: 6 }}>
                {copy.companionCardBody}
              </Text>
            </Pressable>

            {gardenEnabled ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={copy.openGarden}
              onPress={() => router.push('/medi-world/garden' as never)}
              className="active:opacity-75"
              style={{
                marginTop: 16,
                borderRadius: QUEST.radius,
                borderWidth: 1,
                borderColor: colors.bg300,
                backgroundColor: colors.surface,
                padding: QUEST.pad,
              }}
            >
              <Text style={{ ...fontMed, fontSize: 13, color: colors.text300 }}>{copy.openGarden}</Text>
              <Text style={{ ...fontTitle, fontSize: 20, color: colors.text100, marginTop: 6 }}>{copy.openGarden}</Text>
              <Text style={{ ...fontBody, fontSize: 14, lineHeight: 20, color: colors.text200, marginTop: 6 }}>
                {copy.gardenCardBody}
              </Text>
            </Pressable>
            ) : null}

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={copy.openAdventure}
              onPress={() => router.push('/medi-world/adventure' as never)}
              className="active:opacity-75"
              style={{
                marginTop: 16,
                borderRadius: QUEST.radius,
                borderWidth: 1,
                borderColor: colors.bg300,
                backgroundColor: colors.surface,
                padding: QUEST.pad,
              }}
            >
              <Text style={{ ...fontMed, fontSize: 13, color: colors.text300 }}>{copy.todayAdventure}</Text>
              <Text style={{ ...fontTitle, fontSize: 20, color: colors.text100, marginTop: 6 }}>{copy.openAdventure}</Text>
              <Text style={{ ...fontBody, fontSize: 14, lineHeight: 20, color: colors.text200, marginTop: 6 }}>
                {copy.adventureCardBody}
              </Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={copy.openExplore}
              onPress={() => router.push('/medi-world/explore' as never)}
              className="active:opacity-75"
              style={{
                marginTop: 16,
                borderRadius: QUEST.radius,
                borderWidth: 1,
                borderColor: colors.bg300,
                backgroundColor: colors.surface,
                padding: QUEST.pad,
              }}
            >
              <Text style={{ ...fontMed, fontSize: 13, color: colors.text300 }}>{copy.openExplore}</Text>
              <Text style={{ ...fontTitle, fontSize: 20, color: colors.text100, marginTop: 6 }}>{copy.openExplore}</Text>
              <Text style={{ ...fontBody, fontSize: 14, lineHeight: 20, color: colors.text200, marginTop: 6 }}>
                {copy.exploreCardBody}
              </Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={copy.openMovement}
              onPress={() => router.push('/medi-world/movement' as never)}
              className="active:opacity-75"
              style={{
                marginTop: 16,
                borderRadius: QUEST.radius,
                borderWidth: 1,
                borderColor: colors.bg300,
                backgroundColor: colors.surface,
                padding: QUEST.pad,
              }}
            >
              <Text style={{ ...fontMed, fontSize: 13, color: colors.text300 }}>{copy.openMovement}</Text>
              <Text style={{ ...fontTitle, fontSize: 20, color: colors.text100, marginTop: 6 }}>{copy.openMovement}</Text>
              <Text style={{ ...fontBody, fontSize: 14, lineHeight: 20, color: colors.text200, marginTop: 6 }}>
                {copy.movementCardBody}
              </Text>
            </Pressable>

            {payload.today ? (
              <View
                style={{
                  marginTop: 16,
                  borderRadius: QUEST.radius,
                  borderWidth: 1,
                  borderColor: colors.bg300,
                  backgroundColor: colors.surface,
                  padding: QUEST.pad,
                }}
              >
                <Text style={{ ...fontTitle, fontSize: 15, color: colors.text100 }}>{copy.todayLimits}</Text>
                <Text style={{ ...fontBody, fontSize: 13, lineHeight: 20, color: colors.text200, marginTop: 8 }}>
                  {copy.dailyXpLimit}: {payload.today.worldXp.used} / {payload.today.worldXp.cap}
                </Text>
                {payload.today.worldXp.remaining === 0 ? (
                  <Text style={{ ...fontBody, fontSize: 13, lineHeight: 20, color: colors.text200, marginTop: 6 }}>
                    {copy.DAILY_XP_CAP_REACHED}
                  </Text>
                ) : null}
                {CARE_ENERGY_ORDER.filter((type) => payload.today && payload.today.category[type].remaining === 0).map((type) => (
                  <Text key={type} style={{ ...fontBody, fontSize: 13, lineHeight: 20, color: colors.text200, marginTop: 6 }}>
                    {copy[type]}: {copy.DAILY_CATEGORY_CAP_REACHED}
                  </Text>
                ))}
              </View>
            ) : null}

            {payload.latestReward?.reasonCode ? (
              <View
                style={{
                  marginTop: 16,
                  borderRadius: QUEST.radius,
                  backgroundColor: dark ? QUEST.wash.dark : QUEST.wash.lightSoft,
                  padding: QUEST.pad,
                }}
              >
                <Text style={{ ...fontTitle, fontSize: 15, color: colors.text100 }}>{copy.latestReward}</Text>
                <Text style={{ ...fontBody, fontSize: 14, lineHeight: 22, color: colors.text200, marginTop: 6 }}>
                  {worldReasonText(locale, payload.latestReward.reasonCode)}
                </Text>
              </View>
            ) : null}

            <Text style={{ ...fontTitle, fontSize: 16, lineHeight: 22, color: colors.text100, marginTop: 22 }}>{copy.careEnergy}</Text>
            {worldXp === 0 && CARE_ENERGY_ORDER.every((type) => (profile.careEnergy[type] || 0) === 0) ? (
              <Text style={{ ...fontBody, fontSize: 14, lineHeight: 20, color: colors.text200, marginTop: 8 }}>{copy.emptyEnergy}</Text>
            ) : null}
            <View style={{ marginTop: 10, gap: 8 }}>
              {CARE_ENERGY_ORDER.map((type) => {
                const value = profile.careEnergy[type] || 0;
                const label = copy[type];
                return (
                  <View
                    key={type}
                    accessibilityLabel={`${label} ${value}`}
                    style={{
                      minHeight: 56,
                      borderRadius: QUEST.rowRadius,
                      borderWidth: 1,
                      borderColor: colors.bg300,
                      backgroundColor: dark ? colors.surface : '#FFFFFF',
                      paddingHorizontal: 14,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 12,
                    }}
                  >
                    <View style={{ width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: dark ? QUEST.wash.dark : QUEST.wash.light }}>
                      <EnergyIcon type={type} color={colors.primary200} />
                    </View>
                    <Text style={{ ...fontMed, flex: 1, fontSize: 15, color: colors.text100 }}>{label}</Text>
                    <Text style={{ ...fontTitle, fontSize: 18, color: colors.text100 }}>{value}</Text>
                  </View>
                );
              })}
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={copy.howItWorks}
              onPress={() => setHelpOpen(true)}
              className="active:opacity-75"
              style={{ marginTop: 18, minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8 }}
            >
              <Info size={18} color={colors.primary200} strokeWidth={2.2} />
              <Text style={{ ...fontMed, fontSize: 15, color: colors.primary200 }}>{copy.howItWorks}</Text>
            </Pressable>

            <View style={{ marginTop: 16, borderRadius: QUEST.radius, backgroundColor: dark ? QUEST.wash.dark : QUEST.wash.lightSoft, padding: QUEST.pad }}>
              <Text style={{ ...fontTitle, fontSize: 16, lineHeight: 22, color: colors.text100 }}>{copy.awakening}</Text>
              <Text style={{ ...fontBody, fontSize: 14, lineHeight: 22, color: colors.text200, marginTop: 8 }}>{copy.awakeningBody}</Text>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={copy.openQuest}
              onPress={() => router.push('/medi-quest' as never)}
              className="active:opacity-75"
              style={{
                marginTop: 16,
                minHeight: 52,
                borderRadius: 16,
                backgroundColor: dark ? '#0D9488' : colors.primary200,
                alignItems: 'center',
                justifyContent: 'center',
                paddingHorizontal: 16,
              }}
            >
              <Text style={{ ...fontTitle, fontSize: 16, color: '#FFFFFF' }}>{copy.openQuest}</Text>
            </Pressable>
          </>
        ) : null}
      </ScrollView>

      <Modal visible={helpOpen} {...APP_MODAL_PROPS} onRequestClose={() => setHelpOpen(false)}>
        <View style={{ flex: 1, backgroundColor: APP_MODAL_OVERLAY, justifyContent: 'flex-end' }}>
          <Pressable style={{ flex: 1 }} onPress={() => setHelpOpen(false)} accessibilityLabel={copy.close} />
          <View style={{ backgroundColor: colors.surface, padding: 20, paddingBottom: Math.max(insets.bottom, 20) + 12, borderTopLeftRadius: 24, borderTopRightRadius: 24 }}>
            <Text style={{ ...fontTitle, fontSize: 18, color: colors.text100 }}>{copy.howItWorks}</Text>
            <Text style={{ ...fontBody, fontSize: 15, lineHeight: 22, color: colors.text200, marginTop: 10 }}>{copy.howItWorksBody}</Text>
            <Pressable accessibilityRole="button" onPress={() => setHelpOpen(false)} style={{ marginTop: 16, minHeight: 48, borderRadius: 16, backgroundColor: dark ? '#0D9488' : colors.primary200, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ ...fontTitle, fontSize: 16, color: '#FFFFFF' }}>{copy.close}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={celebrate} {...APP_MODAL_PROPS} onRequestClose={() => void dismissCelebration()}>
        <View style={{ flex: 1, backgroundColor: APP_MODAL_OVERLAY, justifyContent: 'center', paddingHorizontal: 24 }}>
          <View style={{ backgroundColor: colors.surface, borderRadius: 24, padding: 22 }}>
            <Text style={{ ...fontTitle, fontSize: 22, color: colors.text100 }}>{copy.levelUpTitle}</Text>
            <Text style={{ ...fontTitle, fontSize: 40, color: colors.primary200, marginTop: 8 }}>{worldLevel}</Text>
            <Text style={{ ...fontBody, fontSize: 15, lineHeight: 22, color: colors.text200, marginTop: 10 }}>{copy.levelUpBody}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={copy.dismiss}
              onPress={() => void dismissCelebration()}
              style={{
                marginTop: 18,
                minHeight: 48,
                borderRadius: 16,
                backgroundColor: reduce ? colors.bg200 : dark ? '#0D9488' : colors.primary200,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ ...fontTitle, fontSize: 16, color: reduce ? colors.text100 : '#FFFFFF' }}>{copy.dismiss}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function LangChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const colors = useThemeColors();
  const dark = useIsDark();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      className="active:opacity-75"
      style={{
        minHeight: 36,
        paddingHorizontal: 12,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: active ? colors.primary200 : colors.bg300,
        backgroundColor: active ? (dark ? QUEST.wash.dark : QUEST.wash.light) : 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 13, color: active ? colors.primary100 : colors.text200 }}>
        {label}
      </Text>
    </Pressable>
  );
}

function StateCard({ title, action, onPress }: { title: string; action: string; onPress: () => void }) {
  const colors = useThemeColors();
  return (
    <View style={{ marginTop: 24, borderRadius: QUEST.radius, borderWidth: 1, borderColor: colors.bg300, padding: QUEST.pad }}>
      <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 15, lineHeight: 22, color: colors.text200 }}>{title}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={action} onPress={onPress} style={{ marginTop: 12, minHeight: 44, justifyContent: 'center' }}>
        <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 15, color: colors.primary200 }}>{action}</Text>
      </Pressable>
    </View>
  );
}

function InfoCard({ title, body, dark, colors }: { title: string; body: string; dark: boolean; colors: { text100: string; text200: string } }) {
  return (
    <View style={{ marginTop: 22, borderRadius: QUEST.radius, backgroundColor: dark ? QUEST.wash.dark : QUEST.wash.lightSoft, padding: QUEST.pad }}>
      <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 16, color: colors.text100 }}>{title}</Text>
      <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 14, lineHeight: 22, color: colors.text200, marginTop: 8 }}>{body}</Text>
    </View>
  );
}
