import React, { useEffect, useLayoutEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useNavigation } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Baby, Check, Footprints } from 'lucide-react-native';
import { PREGNANCY_CHECKLIST } from '@/constants/cycle';
import {
  CycleAtmosphere,
  CycleCard,
  CycleLoading,
  CycleSection,
  cycleNavHeader,
} from '@/components/cycle/CycleUI';
import { todayKey } from '@/components/cycle/CycleCalendar';
import { ka } from '@/i18n/ka';
import { api, ApiError, type CycleBundle } from '@/lib/api';
import { cacheCycleBundle, loadCycleView } from '@/lib/cycleOffline';
import { useAuth } from '@/store/AuthContext';
import { useCycleColors } from '@/theme/cycle';

export default function PregnancyScreen() {
  const { user } = useAuth();
  const c = useCycleColors();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [bundle, setBundle] = useState<CycleBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [kicks, setKicks] = useState(0);
  const [checks, setChecks] = useState<string[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  useLayoutEffect(() => {
    navigation.setOptions(cycleNavHeader(c, ka.cycle.pregnancy));
  }, [navigation, c]);

  const load = async () => {
    try {
      if (!user?.id) return;
      const view = await loadCycleView(user.id);
      const data = view.display;
      setBundle(data);
      const today = data.pregnancyLogs.find((p) => p.date === todayKey());
      setKicks(today?.kickCount ?? 0);
      setChecks(today?.symptoms ?? []);
    } catch (err) {
      setMsg(err instanceof ApiError ? err.message : ka.common.error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [user?.id]);

  const persist = async (nextKicks: number, nextChecks: string[]) => {
    try {
      const age = bundle?.pregnancy?.age;
      const res = await api.cycle.upsertPregnancy(todayKey(), {
        kickCount: nextKicks,
        currentWeek: age?.week ?? null,
        symptoms: nextChecks,
      });
      if (user?.id && res.bundle) await cacheCycleBundle(user.id, res.bundle);
    } catch (err) {
      setMsg(err instanceof ApiError ? err.message : ka.common.error);
    }
  };

  const saveKicks = async (next: number) => {
    setKicks(next);
    Haptics.selectionAsync().catch(() => undefined);
    await persist(next, checks);
  };

  const toggleCheck = async (id: string) => {
    const next = checks.includes(id) ? checks.filter((x) => x !== id) : [...checks, id];
    setChecks(next);
    Haptics.selectionAsync().catch(() => undefined);
    await persist(kicks, next);
  };

  if (loading) return <CycleLoading />;

  const age = bundle?.pregnancy?.age;
  const insight = bundle?.pregnancy?.insight;
  const weekProgress = age ? Math.min(1, age.week / 40) : 0;

  return (
    <CycleAtmosphere>
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
      >
        {msg ? (
          <View
            style={{
              marginBottom: 12,
              borderRadius: 14,
              paddingHorizontal: 14,
              paddingVertical: 12,
              backgroundColor: `${c.danger}14`,
            }}
          >
            <Text style={{ color: c.danger, fontWeight: '600' }}>{msg}</Text>
          </View>
        ) : null}

        {!bundle?.pregnancy ? (
          <CycleCard>
            <Text style={{ color: c.muted, lineHeight: 22 }}>
              {ka.cycle.pregnancySettingsHint}
            </Text>
          </CycleCard>
        ) : (
          <Animated.View entering={FadeIn.duration(500)}>
            <View
              style={{
                borderRadius: 16,
                marginBottom: 16,
                padding: 28,
                alignItems: 'center',
                backgroundColor: c.card,
                borderWidth: 1,
                borderColor: c.border,
              }}
            >
                <View
                  style={{
                    width: 72,
                    height: 72,
                    borderRadius: 16,
                    backgroundColor: c.cardSoft,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Baby size={34} color={c.lavender} strokeWidth={1.8} />
                </View>
                <Text
                  style={{
                    color: c.ink,
                    fontSize: 32,
                    fontFamily: 'NotoSansGeorgian_700Bold',
                    marginTop: 16,
                  }}
                >
                  {ka.cycle.week} {age?.week ?? '—'}
                </Text>
                <Text
                  style={{
                    color: c.muted,
                    marginTop: 4,
                    fontFamily: 'NotoSansGeorgian_500Medium',
                  }}
                >
                  {ka.cycle.day} {age?.day ?? 0} · {ka.cycle.trimester} {age?.trimester ?? '—'}
                </Text>
                <View
                  style={{
                    width: '100%',
                    height: 10,
                    borderRadius: 5,
                    backgroundColor: c.border,
                    marginTop: 20,
                    overflow: 'hidden',
                  }}
                >
                  <View
                    style={{
                      width: `${Math.round(weekProgress * 100)}%`,
                      height: '100%',
                      backgroundColor: c.lavender,
                      borderRadius: 5,
                    }}
                  />
                </View>
                <Text
                  style={{
                    color: c.muted,
                    fontSize: 12,
                    marginTop: 8,
                    fontFamily: 'NotoSansGeorgian_500Medium',
                  }}
                >
                  {Math.round(weekProgress * 100)}% · 40 კვირა
                </Text>
            </View>

            <CycleCard delay={80} style={{ marginBottom: 14 }}>
              <Text style={{ color: c.muted, fontWeight: '700', fontSize: 11, letterSpacing: 0.5 }}>
                {ka.cycle.babySize.toUpperCase()}
              </Text>
              <Text style={{ color: c.ink, fontSize: 26, fontWeight: '800', marginTop: 8 }}>
                {insight?.size}
              </Text>
              <Text style={{ color: c.muted, marginTop: 10, lineHeight: 21, fontSize: 14 }}>
                {insight?.note}
              </Text>
            </CycleCard>

            <CycleCard delay={140} style={{ marginBottom: 14 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                <Footprints size={20} color={c.brand} />
                <Text
                  style={{
                    color: c.ink,
                    fontFamily: 'NotoSansGeorgian_700Bold',
                    marginLeft: 8,
                    fontSize: 16,
                  }}
                >
                  {ka.cycle.kicks}
                </Text>
              </View>
              <Text
                style={{
                  color: c.ink,
                  fontSize: 56,
                  fontFamily: 'NotoSansGeorgian_700Bold',
                  textAlign: 'center',
                  letterSpacing: -2,
                }}
              >
                {kicks}
              </Text>
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
                <Pressable
                  onPress={() => saveKicks(Math.max(0, kicks - 1))}
                  style={{
                    flex: 1,
                    minHeight: 52,
                    backgroundColor: c.cardSoft,
                    borderRadius: 16,
                    padding: 16,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: 1,
                    borderColor: c.border,
                  }}
                >
                  <Text style={{ color: c.ink, fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 22 }}>−</Text>
                </Pressable>
                <Pressable
                  onPress={() => saveKicks(kicks + 1)}
                  style={{
                    flex: 1,
                    minHeight: 52,
                    backgroundColor: c.cta,
                    borderRadius: 16,
                    padding: 16,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ color: '#fff', fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 22 }}>+</Text>
                </Pressable>
              </View>
            </CycleCard>

            <CycleSection title="დღის ჩეკლისტი" subtitle="ვიტამინები და მოვლა" delay={200}>
              <CycleCard padded={false}>
                {PREGNANCY_CHECKLIST.map((item, idx) => {
                  const on = checks.includes(item.id);
                  const last = idx === PREGNANCY_CHECKLIST.length - 1;
                  return (
                    <Animated.View key={item.id} entering={FadeInUp.delay(220 + idx * 30).duration(320)}>
                      <Pressable
                        onPress={() => toggleCheck(item.id)}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          minHeight: 52,
                          paddingVertical: 14,
                          paddingHorizontal: 16,
                          borderBottomWidth: last ? 0 : 1,
                          borderBottomColor: c.border,
                        }}
                      >
                        <View
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: 10,
                            backgroundColor: on ? c.cta : c.cardSoft,
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginRight: 12,
                          }}
                        >
                          {on ? <Check size={16} color="#fff" strokeWidth={3} /> : null}
                        </View>
                        <Text
                          style={{
                            color: c.ink,
                            fontWeight: on ? '700' : '500',
                            flex: 1,
                            fontSize: 14,
                          }}
                        >
                          {item.label}
                        </Text>
                      </Pressable>
                    </Animated.View>
                  );
                })}
              </CycleCard>
            </CycleSection>
          </Animated.View>
        )}
      </ScrollView>
    </CycleAtmosphere>
  );
}
