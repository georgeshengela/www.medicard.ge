import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import Animated, { FadeInRight, FadeInUp } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronRight, RefreshCw, Sparkles } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { QuotaSheet } from '@/components/QuotaSheet';
import { ka } from '@/i18n/ka';
import { api, ApiError, type CycleInsightCard, type CycleInsights } from '@/lib/api';
import { useAuth } from '@/store/AuthContext';
import {
  CycleInsightDetailSheet,
} from '@/components/cycle/CycleInsightDetailSheet';
import { cycleShadow, useCycleColors } from '@/theme/cycle';

const TONE_COLORS: Record<string, { bg: string; accent: string }> = {
  calm: { bg: '#F3E5F5', accent: '#AB47BC' },
  energy: { bg: '#FCE4EC', accent: '#E91E63' },
  care: { bg: '#F8BBD0', accent: '#C2185B' },
  fertile: { bg: '#F3E5F5', accent: '#8E24AA' },
  pregnancy: { bg: '#FCE4EC', accent: '#EC407A' },
  mood: { bg: '#FFF0F5', accent: '#D81B60' },
};

type Props = {
  seed?: CycleInsights | null;
  onLoaded?: (insights: CycleInsights) => void;
};

export function CycleInsightsPanel({ seed, onLoaded }: Props) {
  const c = useCycleColors();
  const router = useRouter();
  const { applyUsage } = useAuth();
  const [insights, setInsights] = useState<CycleInsights | null>(seed ?? null);
  const [loading, setLoading] = useState(!seed);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fromCache, setFromCache] = useState(false);
  const [detailCard, setDetailCard] = useState<CycleInsightCard | null>(null);
  const [quotaBlock, setQuotaBlock] = useState<number | undefined>(undefined);

  const load = async (refresh = false) => {
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
    load(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount once
  }, []);

  useEffect(() => {
    if (seed && !insights) setInsights(seed);
  }, [seed, insights]);

  const openDetail = (card: CycleInsightCard) => {
    Haptics.selectionAsync().catch(() => undefined);
    setDetailCard(card);
  };

  const cards = insights?.cards ?? [];
  const statusLabel =
    insights?.source === 'ai' || insights?.source === 'local_fallback'
      ? fromCache
        ? ka.cycle.aiCached
        : ka.cycle.aiPersonalized
      : ka.cycle.aiLoading;

  return (
    <>
      <Animated.View entering={FadeInUp.duration(420)} style={{ marginBottom: 8, marginTop: 8 }}>
        <LinearGradient
          colors={[c.lavenderSoft, c.roseSoft]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            borderRadius: 24,
            padding: 14,
            borderWidth: 1,
            borderColor: c.border,
            ...cycleShadow.card,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              marginBottom: cards.length || loading ? 12 : 0,
            }}
          >
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 14,
                backgroundColor: c.card,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Sparkles size={16} color={c.rose} strokeWidth={2.2} />
            </View>
            <View style={{ flex: 1, marginLeft: 10, minWidth: 0 }}>
              <Text style={{ color: c.ink, fontWeight: '800', fontSize: 15 }} numberOfLines={1}>
                {ka.cycle.aiTips}
              </Text>
              <Text style={{ color: c.muted, fontSize: 11, marginTop: 1 }} numberOfLines={1}>
                {insights?.headline || statusLabel}
              </Text>
            </View>
            <Pressable
              onPress={() => {
                Haptics.selectionAsync().catch(() => undefined);
                load(true);
              }}
              disabled={refreshing || loading}
              hitSlop={8}
              style={{
                width: 34,
                height: 34,
                borderRadius: 17,
                backgroundColor: c.card,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: refreshing ? 0.6 : 1,
              }}
            >
              {refreshing ? (
                <ActivityIndicator size="small" color={c.rose} />
              ) : (
                <RefreshCw size={14} color={c.rose} strokeWidth={2.3} />
              )}
            </Pressable>
          </View>

          {loading && !cards.length ? (
            <View style={{ paddingVertical: 16, alignItems: 'center' }}>
              <ActivityIndicator color={c.rose} />
            </View>
          ) : null}

          {error && !cards.length ? (
            <Pressable onPress={() => load(true)} style={{ paddingVertical: 8 }}>
              <Text style={{ color: c.rose, fontWeight: '700', fontSize: 13 }}>{error}</Text>
            </Pressable>
          ) : null}

          {cards.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingRight: 2 }}
              decelerationRate="fast"
            >
              {cards.map((card, idx) => {
                const tone = TONE_COLORS[card.tone] || TONE_COLORS.calm;
                return (
                  <Animated.View
                    key={card.id}
                    entering={FadeInRight.delay(idx * 50).duration(340)}
                    style={{ width: 200, marginRight: 10 }}
                  >
                    <Pressable
                      onPress={() => openDetail(card)}
                      accessibilityRole="button"
                      accessibilityLabel={`${card.title}. ${ka.cycle.aiViewDetails}`}
                      style={({ pressed }) => ({
                        backgroundColor: c.card,
                        borderRadius: 18,
                        padding: 12,
                        minHeight: 118,
                        borderLeftWidth: 3,
                        borderLeftColor: tone.accent,
                        borderWidth: 1,
                        borderColor: c.border,
                        opacity: pressed ? 0.92 : 1,
                      })}
                    >
                      <Text
                        style={{
                          color: c.ink,
                          fontWeight: '800',
                          fontSize: 13,
                          lineHeight: 17,
                          marginBottom: 6,
                        }}
                        numberOfLines={2}
                      >
                        {card.title}
                      </Text>
                      <Text
                        style={{ color: c.muted, fontSize: 11, lineHeight: 15, flex: 1 }}
                        numberOfLines={3}
                      >
                        {card.body}
                      </Text>
                      <View
                        style={{
                          marginTop: 8,
                          flexDirection: 'row',
                          alignItems: 'center',
                        }}
                      >
                        <Text
                          style={{ color: tone.accent, fontWeight: '700', fontSize: 11, flex: 1 }}
                          numberOfLines={1}
                        >
                          {card.action || ka.cycle.aiViewDetails}
                        </Text>
                        <ChevronRight size={14} color={tone.accent} strokeWidth={2.4} />
                      </View>
                    </Pressable>
                  </Animated.View>
                );
              })}
            </ScrollView>
          ) : null}
        </LinearGradient>
      </Animated.View>

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
