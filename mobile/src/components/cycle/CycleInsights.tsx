import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Baby,
  ChevronRight,
  Droplets,
  Heart,
  Moon,
  RefreshCw,
  Sparkles,
  Sun,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { HomeSectionTitle } from '@/components/home/HomeSectionTitle';
import { QuotaSheet } from '@/components/QuotaSheet';
import { CycleInsightDetailSheet } from '@/components/cycle/CycleInsightDetailSheet';
import { MedicardLogoMark } from '@/components/ui/MedicardLogoMark';
import { ka } from '@/i18n/ka';
import { api, ApiError, type CycleCondition, type CycleInsightCard, type CycleInsights, type CycleLog, type CycleMode } from '@/lib/api';
import { buildCycleAdvice, mergeInsightCards } from '@/lib/cycleAdvice';
import type { CyclePhaseInfo } from '@/lib/cycleCanonical';
import { useAuth } from '@/store/AuthContext';
import { useCycleColors } from '@/theme/cycle';
import { useIsDark, useThemeColors } from '@/theme/colors';

function hexAlpha(hex: string, alpha: number) {
  const raw = hex.replace('#', '');
  const n = parseInt(raw.length === 3 ? raw.split('').map((ch) => ch + ch).join('') : raw.slice(0, 6), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

function toneVisual(
  c: ReturnType<typeof useCycleColors>,
  accentWash: string,
  tone: string,
) {
  switch (tone) {
    case 'care':
      return { accent: c.rose, wash: c.roseSoft, Icon: Droplets };
    case 'energy':
      return { accent: c.brand, wash: accentWash, Icon: Sun };
    case 'fertile':
      return { accent: c.fertile, wash: c.lavenderSoft, Icon: Heart };
    case 'pregnancy':
      return { accent: c.rose, wash: c.roseSoft, Icon: Baby };
    case 'mood':
      return { accent: c.lavender, wash: c.lavenderSoft, Icon: Sparkles };
    default:
      return { accent: c.brand, wash: accentWash, Icon: Moon };
  }
}

type Props = {
  seed?: CycleInsights | null;
  phase?: CyclePhaseInfo;
  mode?: CycleMode;
  conditions?: CycleCondition[];
  log?: CycleLog | null;
  confidence?: string | null;
  isIrregular?: boolean;
  offline?: boolean;
  onLoaded?: (insights: CycleInsights) => void;
};

export function CycleInsightsPanel({
  seed,
  phase,
  mode = 'TRACK_PERIOD',
  conditions,
  log,
  confidence,
  isIrregular,
  offline,
  onLoaded,
}: Props) {
  const c = useCycleColors();
  const theme = useThemeColors();
  const dark = useIsDark();
  const router = useRouter();
  const { applyUsage } = useAuth();
  const [insights, setInsights] = useState<CycleInsights | null>(seed ?? null);
  const [loading, setLoading] = useState(!seed);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, setFromCache] = useState(false);
  const [detailCard, setDetailCard] = useState<CycleInsightCard | null>(null);
  const [quotaBlock, setQuotaBlock] = useState<number | undefined>(undefined);

  const localCards = useMemo(
    () => (phase ? buildCycleAdvice({ phase, mode, conditions, log, confidence, isIrregular }) : []),
    [phase, mode, conditions, log, confidence, isIrregular],
  );

  const cards = useMemo(
    () => mergeInsightCards(insights?.cards ?? [], localCards),
    [insights?.cards, localCards],
  );

  const load = async (refresh = false) => {
    if (offline) {
      setLoading(false);
      setRefreshing(false);
      if (seed) setInsights(seed);
      return;
    }
    try {
      if (refresh) setRefreshing(true);
      else if (!insights) setLoading(true);
      setError(null);
      const res = await api.cycle.insights(refresh);
      setInsights(res.insights);
      setFromCache(Boolean(res.cached));
      if (res.usage) applyUsage(res.usage);
      onLoaded?.(res.insights);
    } catch (err) {
      if (err instanceof ApiError && err.isQuotaExceeded) {
        setQuotaBlock(err.usage?.resetsInMs ?? 0);
        if (err.usage) applyUsage(err.usage);
      } else {
        setError(err instanceof ApiError ? err.message : ka.common.error);
      }
      if (!insights && seed) setInsights(seed);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (offline) {
      setLoading(false);
      if (seed) setInsights(seed);
      return;
    }
    load(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount once
  }, [offline]);

  useEffect(() => {
    if (seed && !insights) setInsights(seed);
  }, [seed, insights]);

  const openDetail = (card: CycleInsightCard) => {
    Haptics.selectionAsync().catch(() => undefined);
    setDetailCard(card);
  };

  const contextChips = [
    phase?.day != null ? `${ka.cycle.cycleDay} ${phase.day}` : null,
    phase?.phaseKa && phase.phase !== 'unknown' ? ka.cycle.estimatedPhase(phase.phaseKa) : null,
  ].filter((item): item is string => Boolean(item));

  const featured = cards[0];
  const rest = cards.slice(1);
  const heroTone = featured
    ? toneVisual(c, theme.accent100, featured.tone)
    : toneVisual(c, theme.accent100, 'calm');
  const HeroIcon = heroTone.Icon;
  const fadeTo = dark ? 'rgba(17,24,39,0)' : 'rgba(255,255,255,0)';

  const cardRadius = 20;

  return (
    <>
      <View style={{ marginBottom: 8, marginTop: 8, alignSelf: 'stretch', width: '100%' }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 10,
          }}
        >
          <View style={{ flex: 1, paddingRight: 12, flexDirection: 'row', alignItems: 'center' }}>
            <Sparkles size={16} color={c.brand} strokeWidth={2.2} style={{ marginRight: 8 }} />
            <HomeSectionTitle title={ka.cycle.mediInsightLabel} style={{ marginBottom: 0 }} />
          </View>
          <Pressable
            onPress={() => {
              Haptics.selectionAsync().catch(() => undefined);
              load(true);
            }}
            disabled={refreshing || loading || offline}
            accessibilityRole="button"
            accessibilityLabel={ka.cycle.aiTips}
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: theme.accent100,
              borderWidth: 1,
              borderColor: hexAlpha(c.brand, 0.35),
              alignItems: 'center',
              justifyContent: 'center',
              opacity: refreshing ? 0.6 : 1,
            }}
          >
            {refreshing ? (
              <ActivityIndicator size="small" color={c.brand} />
            ) : (
              <RefreshCw size={15} color={c.brand} strokeWidth={2.3} />
            )}
          </Pressable>
        </View>
        {offline ? (
          <Text style={{ color: c.muted, fontSize: 12, lineHeight: 17, marginBottom: 8 }}>
            {ka.cycle.aiStale}
          </Text>
        ) : null}

        {loading && !cards.length ? (
          <View
            style={{
              backgroundColor: c.card,
              borderRadius: 20,
              borderWidth: 1,
              borderColor: c.border,
              paddingVertical: 36,
              alignItems: 'center',
            }}
          >
            <ActivityIndicator color={c.brand} />
          </View>
        ) : null}

        {error && !cards.length ? (
          <Pressable
            onPress={() => load(true)}
            style={{
              backgroundColor: c.card,
              borderRadius: 20,
              borderWidth: 1,
              borderColor: c.border,
              padding: 16,
            }}
          >
            <Text style={{ color: c.danger, fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 14 }}>
              {error}
            </Text>
          </Pressable>
        ) : null}

        {featured ? (
          <Pressable
            onPress={() => openDetail(featured)}
            accessibilityRole="button"
            accessibilityLabel={`${featured.title}. ${ka.cycle.aiViewDetails}`}
            style={({ pressed }) => ({ opacity: pressed ? 0.96 : 1 })}
          >
            <LinearGradient
              colors={[heroTone.wash, c.card]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[
                styles.heroShell,
                {
                  borderRadius: cardRadius,
                  borderTopLeftRadius: cardRadius,
                  borderTopRightRadius: cardRadius,
                  borderBottomLeftRadius: cardRadius,
                  borderBottomRightRadius: cardRadius,
                  borderColor: hexAlpha(heroTone.accent, dark ? 0.4 : 0.28),
                  backgroundColor: c.card,
                },
              ]}
            >
            <LinearGradient
              colors={[hexAlpha(heroTone.accent, dark ? 0.22 : 0.12), fadeTo]}
              start={{ x: 1, y: 0 }}
              end={{ x: 0.15, y: 1 }}
              style={[StyleSheet.absoluteFillObject, { borderRadius: cardRadius }]}
            />

            <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
              <View
                style={{
                  position: 'absolute',
                  right: -34,
                  top: -42,
                  width: 176,
                  height: 176,
                  borderRadius: 88,
                  borderWidth: 1,
                  borderColor: hexAlpha(heroTone.accent, 0.22),
                }}
              />
              <View
                style={{
                  position: 'absolute',
                  right: -10,
                  top: -18,
                  width: 128,
                  height: 128,
                  borderRadius: 64,
                  borderWidth: 1,
                  borderColor: hexAlpha(heroTone.accent, 0.16),
                }}
              />
              <View
                style={{
                  position: 'absolute',
                  right: 18,
                  top: 10,
                  width: 72,
                  height: 72,
                  borderRadius: 36,
                  backgroundColor: hexAlpha(heroTone.accent, dark ? 0.2 : 0.12),
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <MedicardLogoMark size={34} tone={dark ? 'inverse' : 'brand'} />
              </View>
            </View>

            <View style={{ padding: 16, paddingBottom: 14 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14, paddingRight: 88 }}>
                <View
                  style={{
                    width: 46,
                    height: 46,
                    borderRadius: 15,
                    backgroundColor: hexAlpha(heroTone.accent, dark ? 0.22 : 0.14),
                    borderWidth: 1,
                    borderColor: hexAlpha(heroTone.accent, 0.28),
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <HeroIcon size={22} color={heroTone.accent} strokeWidth={2.15} />
                </View>
                <View
                  style={{
                    marginLeft: 10,
                    backgroundColor: hexAlpha(c.brand, dark ? 0.18 : 0.1),
                    borderRadius: 999,
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                    borderWidth: 1,
                    borderColor: hexAlpha(c.brand, 0.28),
                  }}
                >
                  <Text
                    style={{
                      color: dark ? theme.primary100 : c.brand,
                      fontFamily: 'NotoSansGeorgian_600SemiBold',
                      fontSize: 12,
                      lineHeight: 16,
                    }}
                  >
                    Medi · {ka.cycle.aiTodayFocus}
                  </Text>
                </View>
              </View>

              <Text
                style={{
                  color: c.ink,
                  fontFamily: 'NotoSansGeorgian_700Bold',
                  fontSize: 20,
                  lineHeight: 26,
                  letterSpacing: -0.4,
                  marginBottom: 8,
                  paddingRight: 8,
                }}
              >
                {featured.title}
              </Text>
              <Text
                style={{
                  color: c.muted,
                  fontFamily: 'NotoSansGeorgian_400Regular',
                  fontSize: 15,
                  lineHeight: 23,
                }}
              >
                {featured.body}
              </Text>

              {contextChips.length ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 14 }}>
                  {contextChips.map((chip) => (
                    <View
                      key={chip}
                      style={{
                        backgroundColor: hexAlpha(heroTone.accent, dark ? 0.18 : 0.1),
                        borderWidth: 1,
                        borderColor: hexAlpha(heroTone.accent, 0.28),
                        paddingHorizontal: 10,
                        paddingVertical: 5,
                        borderRadius: 20,
                        marginRight: 6,
                        marginBottom: 6,
                      }}
                    >
                      <Text
                        style={{
                          color: heroTone.accent,
                          fontFamily: 'NotoSansGeorgian_600SemiBold',
                          fontSize: 12,
                          lineHeight: 16,
                        }}
                      >
                        {chip}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}

              <View
                style={{
                  marginTop: 16,
                  backgroundColor: c.cta,
                  borderRadius: 14,
                  paddingVertical: 13,
                  paddingHorizontal: 14,
                  flexDirection: 'row',
                  alignItems: 'center',
                }}
              >
                <Text
                  style={{
                    flex: 1,
                    color: theme.onPrimary,
                    fontFamily: 'NotoSansGeorgian_700Bold',
                    fontSize: 14,
                    lineHeight: 18,
                  }}
                  numberOfLines={1}
                >
                  {featured.action || ka.cycle.aiViewDetails}
                </Text>
                <ChevronRight size={18} color={theme.onPrimary} strokeWidth={2.4} />
              </View>
            </View>
            </LinearGradient>
          </Pressable>
        ) : null}

        {rest.length ? <View style={styles.stackGap} /> : null}

        {rest.length ? (
          <View style={styles.rail}>
            {rest.map((card, idx) => {
              const tone = toneVisual(c, theme.accent100, card.tone);
              const Icon = tone.Icon;
              const last = idx === rest.length - 1;
              return (
                <View key={card.id} style={last ? undefined : styles.stackItem}>
                <Pressable
                  onPress={() => openDetail(card)}
                  accessibilityRole="button"
                  accessibilityLabel={`${card.title}. ${ka.cycle.aiViewDetails}`}
                  style={({ pressed }) => ({ opacity: pressed ? 0.94 : 1 })}
                >
                  <View
                    collapsable={false}
                    style={[
                      styles.railCard,
                      {
                        backgroundColor: c.card,
                        borderColor: c.border,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.railStripe,
                        {
                          backgroundColor: tone.accent,
                          borderTopLeftRadius: 18,
                          borderTopRightRadius: 18,
                        },
                      ]}
                    />
                    <View style={styles.railInner}>
                      <View style={styles.railHead}>
                        <View style={[styles.railIcon, { backgroundColor: tone.wash }]}>
                          <Icon size={18} color={tone.accent} strokeWidth={2.15} />
                        </View>
                        <Text style={[styles.railIndex, { color: c.mutedSoft }]}>
                          {String(idx + 2).padStart(2, '0')}
                        </Text>
                      </View>
                      <Text style={[styles.railTitle, { color: c.ink }]} numberOfLines={2}>
                        {card.title}
                      </Text>
                      <Text style={[styles.railBody, { color: c.muted }]} numberOfLines={4}>
                        {card.body}
                      </Text>
                      <View style={styles.railCta}>
                        <Text style={[styles.railCtaText, { color: tone.accent }]} numberOfLines={1}>
                          {card.action || ka.cycle.aiViewDetails}
                        </Text>
                        <ChevronRight size={16} color={tone.accent} strokeWidth={2.3} />
                      </View>
                    </View>
                  </View>
                </Pressable>
                </View>
              );
            })}
          </View>
        ) : null}
      </View>

      <CycleInsightDetailSheet
        visible={detailCard != null}
        card={detailCard}
        headline={insights?.headline}
        onClose={() => setDetailCard(null)}
      />
      <QuotaSheet
        visible={quotaBlock !== undefined}
        resetsInMs={quotaBlock}
        onClose={() => setQuotaBlock(undefined)}
        onUpgrade={() => {
          setQuotaBlock(undefined);
          router.push('/package');
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  heroShell: {
    borderWidth: 1,
    overflow: 'hidden',
  },
  stackGap: {
    height: 12,
    width: '100%',
  },
  stackItem: {
    paddingBottom: 12,
    width: '100%',
  },
  rail: {
    alignSelf: 'stretch',
    width: '100%',
  },
  railCard: {
    alignSelf: 'stretch',
    width: '100%',
    borderRadius: 18,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
  },
  railStripe: {
    height: 4,
    width: '100%',
  },
  railInner: {
    padding: 14,
  },
  railHead: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  railIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  railIndex: {
    marginLeft: 8,
    fontFamily: 'NotoSansGeorgian_700Bold',
    fontSize: 12,
    letterSpacing: 0.6,
  },
  railTitle: {
    fontFamily: 'NotoSansGeorgian_700Bold',
    fontSize: 16,
    lineHeight: 22,
  },
  railBody: {
    fontFamily: 'NotoSansGeorgian_400Regular',
    fontSize: 14,
    lineHeight: 21,
    marginTop: 6,
  },
  railCta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  railCtaText: {
    flexGrow: 1,
    flexShrink: 1,
    fontFamily: 'NotoSansGeorgian_600SemiBold',
    fontSize: 14,
  },
});
