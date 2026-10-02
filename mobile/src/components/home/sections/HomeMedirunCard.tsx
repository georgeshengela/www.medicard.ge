import React, { useMemo, useRef } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { ArrowUpRight, Play } from 'lucide-react-native';
import { HomeSectionHeading } from '@/components/home/HomeSectionHeading';
import { RUN_GIFT, RUN_HERO } from '@/components/run/runArt';
import { useHomeGrand, useHomeRunWeek } from '@/hooks/useHomeActive';
import { tx } from '@/i18n/locale';
import { isFeatureOn, useFeatureState } from '@/lib/featureFlags';
import { campaignRow, isTbilisiPlace, kmText, lastWalkLine, summarizeRunWeek } from '@/lib/home/activeHome';
import { getRunState, hydrateActiveRun, isActiveRunPhase, useRunSession, type RunPhase } from '@/lib/run/store';
import { locationFromProfile } from '@/lib/userLocation';
import { useAuth } from '@/store/AuthContext';
import { useHomeAccent } from '@/theme/homeAccent';
import { HUB } from '@/theme/hub';

/** Night slate sampled from the MEDIRUN hero art, so the picture melts into the card. */
const SLATE = '#16202B';
const WHITE = '#FFFFFF';
const MUTED = '#CBD5E1';
const AMBER_TEXT = '#FCD34D';
const AMBER_BAR = '#FBBF24';
const HERO_H = 128;

/** Same rule as the tab bar's MEDIRUN button: these phases belong to the live run screen. */
const isLivePhase = (phase: RunPhase) => isActiveRunPhase(phase) || phase === 'ready' || phase === 'preparing';

type Props = { first?: boolean };

/**
 * MEDIRUN on the active Home — the page's one spotlight. This week from the walks saved on the
 * phone, the „გაანათე თბილისი“ progress for Tbilisi walkers, and one button that only navigates:
 * it never prepares or starts a session and never touches location.
 */
export function HomeMedirunCard({ first = false }: Props) {
  const features = useFeatureState();
  if (!isFeatureOn('medirun', features)) return null;
  return <MedirunCard first={first} />;
}

function MedirunCard({ first }: { first: boolean }) {
  const router = useRouter();
  const accent = useHomeAccent();
  const { healthProfile } = useAuth();
  const run = useRunSession();
  const live = isLivePhase(run.phase);
  const { walks } = useHomeRunWeek();
  const tbilisiProfile = isTbilisiPlace(locationFromProfile(healthProfile));
  const week = useMemo(() => summarizeRunWeek(walks ?? [], new Date()), [walks]);
  // Someone who never walked and does not live in Tbilisi cannot have lit any of it: no request.
  const { grand } = useHomeGrand(walks != null && (tbilisiProfile || week.hasHistory));
  const campaign = useMemo(() => campaignRow(grand, { tbilisiProfile }), [grand, tbilisiProfile]);

  const busy = useRef(false);
  const onCta = async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      // After a cold start the restorable session may still be loading (phase reads 'idle'):
      // wait for it, so a live walk is resumed instead of a new one being offered.
      await hydrateActiveRun().catch(() => false);
      router.push((isLivePhase(getRunState().phase) ? '/run/active' : '/run') as never);
    } finally {
      busy.current = false;
    }
  };

  const headline = !week.hasHistory
    ? tx('გარეთ ახალი ამბავი იწყება.', 'A new story starts outside.')
    : week.weekKm > 0
      ? tx(`ამ კვირაში ${kmText(week.weekKm)} კმ გაიარე`, `You walked ${kmText(week.weekKm)} km this week`)
      : tx('ამ კვირაში ჯერ არ გაგისეირნია', 'No walks this week yet');
  const secondary = !week.hasHistory
    ? tx('პირველი გასეირნება რუკას გაანათებს.', 'Your first walk lights up the map.')
    : week.last
      ? lastWalkLine(week.last)
      : '';
  const ctaLabel = live ? tx('დაბრუნდი გასეირნებაზე', 'Back to your walk') : tx('დაიწყე გასეირნება', 'Start a walk');

  return (
    <View style={[s.section, { marginTop: first ? 22 : HUB.sectionGap }]}>
      <HomeSectionHeading title="MEDIRUN" linkLabel={tx('ჰაბი', 'Hub')} onLink={() => router.push('/run' as never)} />
      <View style={s.card}>
        <View style={s.hero} accessible={false} importantForAccessibility="no-hide-descendants">
          <Image source={RUN_HERO} accessibilityIgnoresInvertColors resizeMode="cover" style={s.heroImage} />
          {/* Melt the picture into the card (same technique as the MEDIRUN hub). */}
          <View style={s.heroFade} pointerEvents="none">
            <Svg width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 10 10">
              <Defs>
                <LinearGradient id="homeRunFade" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={SLATE} stopOpacity="0" />
                  <Stop offset="1" stopColor={SLATE} stopOpacity="1" />
                </LinearGradient>
              </Defs>
              <Rect x="0" y="0" width="10" height="10" fill="url(#homeRunFade)" />
            </Svg>
          </View>
        </View>

        <View style={s.body}>
          {campaign || week.activeDays > 0 ? (
            <View style={s.chips}>
              {campaign ? (
                <Text style={[s.chip, { color: AMBER_TEXT, backgroundColor: 'rgba(251,191,36,0.16)' }]}>{campaign.name}</Text>
              ) : null}
              {week.activeDays > 0 ? (
                <Text style={[s.chip, { color: '#E2E8F0', backgroundColor: 'rgba(255,255,255,0.1)' }]}>
                  {tx(`ამ კვირაში ${week.activeDays} დღე`, `${week.activeDays} ${week.activeDays === 1 ? 'day' : 'days'} this week`)}
                </Text>
              ) : null}
            </View>
          ) : null}

          {walks == null ? (
            // First read of the walk history this session (on-device, a few ms): hold the space
            // instead of flashing the first-walk line to someone who has walked.
            <View style={{ height: 54 }} />
          ) : (
            <View style={{ gap: 4 }}>
              <Text style={s.headline}>{headline}</Text>
              {secondary ? <Text style={s.secondary}>{secondary}</Text> : null}
            </View>
          )}

          {campaign ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={tx(
                `თბილისი განათებული ${campaign.percentLabel}. ${campaign.caption}`,
                `Tbilisi lit ${campaign.percentLabel}. ${campaign.caption}`,
              )}
              onPress={() => router.push('/run/grand' as never)}
              style={s.campaign}
            >
              <Image source={RUN_GIFT} accessible={false} accessibilityIgnoresInvertColors resizeMode="contain" style={s.gift} />
              <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
                <View style={s.campaignTop}>
                  <Text numberOfLines={1} style={[s.campaignTitle, { flexShrink: 1 }]}>{tx('თბილისი განათებული', 'Tbilisi lit')}</Text>
                  <Text style={[s.campaignTitle, { color: AMBER_TEXT, fontVariant: ['tabular-nums'] }]}>{campaign.percentLabel}</Text>
                </View>
                <View style={s.track}>
                  <View style={[s.fill, { width: `${Math.round(campaign.progress * 100)}%` }]} />
                </View>
                <Text numberOfLines={2} style={s.campaignCaption}>{campaign.caption}</Text>
              </View>
            </Pressable>
          ) : null}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={ctaLabel}
            onPress={() => void onCta()}
            style={[s.cta, { backgroundColor: accent.cta }]}
          >
            <View style={s.ctaTile}>
              <Play size={17} color={accent.onCta} fill={accent.onCta} strokeWidth={2.4} />
            </View>
            <Text numberOfLines={1} style={[s.ctaText, { color: accent.onCta }]}>{ctaLabel}</Text>
            <ArrowUpRight size={18} color={accent.onCta} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  section: { paddingHorizontal: HUB.gutter },
  card: { borderRadius: HUB.cardRadius, backgroundColor: SLATE, overflow: 'hidden' },
  hero: { height: HERO_H, overflow: 'hidden' },
  heroImage: { width: '100%', height: HERO_H },
  heroFade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: HERO_H / 2 },
  body: { paddingHorizontal: HUB.cardPad, paddingTop: 4, paddingBottom: HUB.cardPad, gap: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    fontFamily: 'NotoSansGeorgian_600SemiBold',
    fontSize: 11,
    lineHeight: 16,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 10,
    overflow: 'hidden',
  },
  headline: { fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 22, lineHeight: 30, color: WHITE },
  secondary: { fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 13, lineHeight: 20, color: MUTED },
  campaign: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    padding: 12,
    minHeight: 44,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  gift: { width: 38, height: 38 },
  campaignTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  campaignTitle: { fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 13, lineHeight: 18, color: WHITE },
  campaignCaption: { fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 11, lineHeight: 15, color: MUTED },
  track: { height: 6, borderRadius: 3, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.12)' },
  fill: { height: 6, borderRadius: 3, backgroundColor: AMBER_BAR },
  cta: {
    minHeight: 56,
    borderRadius: 18,
    paddingLeft: 11,
    paddingRight: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  ctaTile: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  ctaText: { flex: 1, fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 15, lineHeight: 21 },
});
