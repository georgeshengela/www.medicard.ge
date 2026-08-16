import React, { useEffect, useLayoutEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useNavigation, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { MessageSquareText, Sparkles } from 'lucide-react-native';
import { FLOW_OPTIONS, MOOD_OPTIONS, PHYSICAL_SYMPTOMS } from '@/constants/cycle';
import {
  CycleAtmosphere,
  CycleCard,
  CycleLoading,
  CycleSection,
  cycleNavHeader,
} from '@/components/cycle/CycleUI';
import { ka } from '@/i18n/ka';
import { api, ApiError, type CycleBundle } from '@/lib/api';
import { cycleShadow, useCycleColors } from '@/theme/cycle';

function labelOf(id: string, lists: { id: string; label: string }[][]) {
  for (const list of lists) {
    const hit = list.find((x) => x.id === id);
    if (hit) return hit.label;
  }
  return id;
}

export default function CycleSummary() {
  const c = useCycleColors();
  const navigation = useNavigation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [bundle, setBundle] = useState<CycleBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useLayoutEffect(() => {
    navigation.setOptions(cycleNavHeader(c, ka.cycle.summary));
  }, [navigation, c]);

  useEffect(() => {
    api.cycle
      .get()
      .then(setBundle)
      .catch((err) => setError(err instanceof ApiError ? err.message : ka.common.error))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <CycleLoading />;

  const s = bundle?.summary;

  const context = s
    ? [
        'ციკლის შეჯამება (Medicard):',
        `რეჟიმი: ${s.mode}`,
        `საშუალო ციკლი: ${s.avgCycleLength} დღე, მენსტრუაცია: ${s.avgPeriodLength} დღე`,
        s.isIrregular ? 'არარეგულარული ციკლი' : 'რეგულარული ციკლი',
        `შემდეგი მენსტრუაცია: ${s.nextPeriodStart ?? '—'}`,
        `ოვულაცია: ${s.ovulationDate ?? '—'}`,
        `ტოპ სიმპტომები: ${
          s.topSymptoms
            .map((t) => `${labelOf(t.key, [PHYSICAL_SYMPTOMS, FLOW_OPTIONS])} (${t.count})`)
            .join(', ') || '—'
        }`,
        `ტოპ განწყობა: ${
          s.topMoods.map((t) => `${labelOf(t.key, [MOOD_OPTIONS])} (${t.count})`).join(', ') || '—'
        }`,
      ].join('\n')
    : '';

  return (
    <CycleAtmosphere>
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
      >
        {error ? (
          <Text style={{ color: c.danger, fontWeight: '600' }}>{error}</Text>
        ) : null}

        {s ? (
          <>
            <Animated.View entering={FadeInUp.duration(420)} style={{ marginBottom: 16 }}>
              <LinearGradient
                colors={[c.roseSoft, c.lavenderSoft]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  borderRadius: 26,
                  padding: 22,
                  ...cycleShadow.soft,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                  <Sparkles size={18} color={c.rose} />
                  <Text
                    style={{
                      color: c.rose,
                      fontWeight: '800',
                      marginLeft: 8,
                      fontSize: 12,
                      letterSpacing: 0.4,
                    }}
                  >
                    ექიმისთვის მზად
                  </Text>
                </View>
                <Text style={{ color: c.ink, fontSize: 22, fontWeight: '800' }}>
                  ციკლის შეჯამება
                </Text>
                <Text style={{ color: c.muted, marginTop: 6, lineHeight: 20 }}>
                  {s.loggedDays} დღის აღრიცხვა ·{' '}
                  {s.isIrregular ? 'არარეგულარული' : 'რეგულარული'} ციკლი
                </Text>
              </LinearGradient>
            </Animated.View>

            <CycleSection title="ციკლი" delay={60}>
              <CycleCard>
                <Line c={c} k={ka.cycle.avgCycle} v={`${s.avgCycleLength} დღე`} />
                <Line c={c} k={ka.cycle.avgPeriod} v={`${s.avgPeriodLength} დღე`} />
                <Line c={c} k={ka.cycle.nextPeriod} v={s.nextPeriodStart ?? '—'} />
                <Line c={c} k={ka.cycle.ovulation} v={s.ovulationDate ?? '—'} last />
              </CycleCard>
            </CycleSection>

            <CycleSection title={ka.cycle.symptoms} delay={100}>
              <CycleCard>
                {s.topSymptoms.length === 0 ? (
                  <Text style={{ color: c.muted }}>—</Text>
                ) : (
                  s.topSymptoms.map((t, i) => (
                    <FreqRow
                      key={t.key}
                      c={c}
                      label={labelOf(t.key, [PHYSICAL_SYMPTOMS])}
                      count={t.count}
                      max={s.topSymptoms[0]?.count || 1}
                      last={i === s.topSymptoms.length - 1}
                    />
                  ))
                )}
              </CycleCard>
            </CycleSection>

            <CycleSection title={ka.cycle.moods} delay={140}>
              <CycleCard>
                {s.topMoods.length === 0 ? (
                  <Text style={{ color: c.muted }}>—</Text>
                ) : (
                  s.topMoods.map((t, i) => (
                    <FreqRow
                      key={t.key}
                      c={c}
                      label={labelOf(t.key, [MOOD_OPTIONS])}
                      count={t.count}
                      max={s.topMoods[0]?.count || 1}
                      last={i === s.topMoods.length - 1}
                    />
                  ))
                )}
              </CycleCard>
            </CycleSection>

            <Pressable
              onPress={() =>
                router.push({
                  pathname: '/chat/doctor',
                  params: { prefill: context },
                } as never)
              }
              accessibilityRole="button"
              accessibilityLabel={ka.cycle.openChat}
              style={({ pressed }) => ({
                marginTop: 8,
                borderRadius: 18,
                overflow: 'hidden',
                minHeight: 56,
                opacity: pressed ? 0.92 : 1,
                ...cycleShadow.soft,
              })}
            >
              <LinearGradient
                colors={[c.blushDeep, c.rose]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  minHeight: 56,
                  paddingVertical: 15,
                  paddingHorizontal: 16,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <MessageSquareText size={20} color="#fff" />
                <Text
                  numberOfLines={1}
                  style={{
                    color: '#fff',
                    fontWeight: '700',
                    fontSize: 15,
                    marginLeft: 10,
                    flexShrink: 1,
                    includeFontPadding: false,
                  }}
                >
                  {ka.cycle.openChat}
                </Text>
              </LinearGradient>
            </Pressable>
          </>
        ) : null}
      </ScrollView>
    </CycleAtmosphere>
  );
}

function Line({
  c,
  k,
  v,
  last,
}: {
  c: ReturnType<typeof useCycleColors>;
  k: string;
  v: string;
  last?: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 10,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: c.border,
      }}
    >
      <Text style={{ color: c.muted, flex: 1, paddingRight: 12 }}>{k}</Text>
      <Text style={{ color: c.ink, fontWeight: '700' }}>{v}</Text>
    </View>
  );
}

function FreqRow({
  c,
  label,
  count,
  max,
  last,
}: {
  c: ReturnType<typeof useCycleColors>;
  label: string;
  count: number;
  max: number;
  last?: boolean;
}) {
  const pct = Math.max(0.12, count / Math.max(1, max));
  return (
    <View style={{ paddingVertical: 10, borderBottomWidth: last ? 0 : 1, borderBottomColor: c.border }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
        <Text style={{ color: c.ink, fontWeight: '600', flex: 1 }}>{label}</Text>
        <Text style={{ color: c.rose, fontWeight: '800' }}>{count}×</Text>
      </View>
      <View
        style={{
          height: 6,
          borderRadius: 3,
          backgroundColor: c.creamDeep,
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            width: `${Math.round(pct * 100)}%`,
            height: '100%',
            backgroundColor: c.rose,
            borderRadius: 3,
          }}
        />
      </View>
    </View>
  );
}
