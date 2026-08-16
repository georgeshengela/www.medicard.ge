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
import { RefreshCw, Sparkles } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { ka } from '@/i18n/ka';
import { api, ApiError, type CycleInsights } from '@/lib/api';
import { cycleShadow, useCycleColors } from '@/theme/cycle';

const TONE_COLORS: Record<string, { bg: string; accent: string }> = {
  calm: { bg: '#EDE6F8', accent: '#9B7EDE' },
  energy: { bg: '#F3D5C0', accent: '#D4738A' },
  care: { bg: '#F7C6D0', accent: '#E891A3' },
  fertile: { bg: '#E8E0F8', accent: '#7C5CBF' },
  pregnancy: { bg: '#E0F0EC', accent: '#26A69A' },
  mood: { bg: '#F9E4EA', accent: '#D4738A' },
};

type Props = {
  seed?: CycleInsights | null;
  onLoaded?: (insights: CycleInsights) => void;
};

export function CycleInsightsPanel({ seed, onLoaded }: Props) {
  const c = useCycleColors();
  const router = useRouter();
  const [insights, setInsights] = useState<CycleInsights | null>(seed ?? null);
  const [loading, setLoading] = useState(!seed);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fromCache, setFromCache] = useState(false);

  const load = async (refresh = false) => {
    try {
      if (refresh) setRefreshing(true);
      else if (!insights) setLoading(true);
      setError(null);
      const res = await api.cycle.insights(refresh);
      setInsights(res.insights);
      setFromCache(Boolean(res.cached));
      onLoaded?.(res.insights);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : ka.common.error);
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

  const cards = insights?.cards ?? [];

  return (
    <Animated.View entering={FadeInUp.duration(420)} style={{ marginBottom: 16 }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 12,
          paddingHorizontal: 2,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, minWidth: 0 }}>
          <View
            style={{
              width: 32,
              height: 32,
              borderRadius: 11,
              backgroundColor: c.lavenderSoft,
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 10,
            }}
          >
            <Sparkles size={16} color={c.lavender} strokeWidth={2.2} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ color: c.ink, fontWeight: '800', fontSize: 16 }} numberOfLines={1}>
              {ka.cycle.aiTips}
            </Text>
            <Text style={{ color: c.muted, fontSize: 11, marginTop: 2 }} numberOfLines={1}>
              {insights?.source === 'ai' || insights?.source === 'local_fallback'
                ? fromCache
                  ? ka.cycle.aiCached
                  : ka.cycle.aiPersonalized
                : ka.cycle.aiLoading}
            </Text>
          </View>
        </View>
        <Pressable
          onPress={() => {
            Haptics.selectionAsync().catch(() => undefined);
            load(true);
          }}
          disabled={refreshing || loading}
          hitSlop={8}
          style={{
            width: 36,
            height: 36,
            borderRadius: 12,
            backgroundColor: c.roseSoft,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: refreshing ? 0.6 : 1,
          }}
        >
          {refreshing ? (
            <ActivityIndicator size="small" color={c.rose} />
          ) : (
            <RefreshCw size={16} color={c.rose} strokeWidth={2.3} />
          )}
        </Pressable>
      </View>

      {loading && !cards.length ? (
        <View
          style={{
            backgroundColor: c.card,
            borderRadius: 22,
            padding: 20,
            alignItems: 'center',
            borderWidth: 1,
            borderColor: c.border,
          }}
        >
          <ActivityIndicator color={c.rose} />
          <Text style={{ color: c.muted, marginTop: 10, fontSize: 13 }}>{ka.cycle.aiLoading}</Text>
        </View>
      ) : null}

      {error && !cards.length ? (
        <View
          style={{
            backgroundColor: c.roseSoft,
            borderRadius: 18,
            padding: 14,
          }}
        >
          <Text style={{ color: c.rose, fontWeight: '600', fontSize: 13 }}>{error}</Text>
          <Pressable onPress={() => load(true)} style={{ marginTop: 8 }}>
            <Text style={{ color: c.ink, fontWeight: '700' }}>{ka.common.retry}</Text>
          </Pressable>
        </View>
      ) : null}

      {insights?.headline ? (
        <Text
          style={{
            color: c.ink,
            fontWeight: '700',
            fontSize: 15,
            marginBottom: 10,
            lineHeight: 21,
          }}
        >
          {insights.headline}
        </Text>
      ) : null}

      {cards.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingRight: 4 }}
          decelerationRate="fast"
        >
          {cards.map((card, idx) => {
            const tone = TONE_COLORS[card.tone] || TONE_COLORS.calm;
            return (
              <Animated.View
                key={card.id}
                entering={FadeInRight.delay(idx * 60).duration(380)}
                style={{ width: 256, marginRight: 12, ...cycleShadow.card }}
              >
                <LinearGradient
                  colors={[tone.bg, c.card]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0.2, y: 1 }}
                  style={{
                    borderRadius: 22,
                    padding: 16,
                    minHeight: 168,
                    borderWidth: 1,
                    borderColor: c.border,
                  }}
                >
                  <View
                    style={{
                      alignSelf: 'flex-start',
                      backgroundColor: tone.accent,
                      paddingHorizontal: 10,
                      paddingVertical: 4,
                      borderRadius: 999,
                      marginBottom: 10,
                    }}
                  >
                    <Text style={{ color: '#fff', fontSize: 10, fontWeight: '800' }}>
                      AI
                    </Text>
                  </View>
                  <Text
                    style={{
                      color: c.ink,
                      fontWeight: '800',
                      fontSize: 16,
                      lineHeight: 22,
                      marginBottom: 8,
                    }}
                    numberOfLines={2}
                  >
                    {card.title}
                  </Text>
                  <Text
                    style={{ color: c.muted, fontSize: 13, lineHeight: 19, flex: 1 }}
                    numberOfLines={5}
                  >
                    {card.body}
                  </Text>
                  {card.action ? (
                    <Pressable
                      onPress={() => {
                        if (card.action?.includes('აღრიცხვ') || card.id.includes('phase')) {
                          router.push('/cycle/log' as never);
                        } else if (
                          card.tone === 'pregnancy' ||
                          card.action.includes('ორსულ')
                        ) {
                          router.push('/cycle/pregnancy' as never);
                        } else if (card.action.includes('BBT') || card.action.includes('ლორწო')) {
                          router.push('/cycle/log' as never);
                        }
                      }}
                      style={{
                        marginTop: 12,
                        alignSelf: 'flex-start',
                        backgroundColor: c.card,
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: c.border,
                      }}
                    >
                      <Text style={{ color: tone.accent, fontWeight: '700', fontSize: 12 }}>
                        {card.action}
                      </Text>
                    </Pressable>
                  ) : null}
                </LinearGradient>
              </Animated.View>
            );
          })}
        </ScrollView>
      ) : null}

      <Text style={{ color: c.mutedSoft, fontSize: 10, marginTop: 10, lineHeight: 14 }}>
        {ka.cycle.aiDisclaimer}
      </Text>
    </Animated.View>
  );
}
