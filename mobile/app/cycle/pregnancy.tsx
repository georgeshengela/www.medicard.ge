import React, { useEffect, useLayoutEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useNavigation } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
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
import { cycleShadow, useCycleColors } from '@/theme/cycle';

export default function PregnancyScreen() {
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
      const data = await api.cycle.get();
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
  }, []);

  const persist = async (nextKicks: number, nextChecks: string[]) => {
    try {
      const age = bundle?.pregnancy?.age;
      await api.cycle.upsertPregnancy(todayKey(), {
        kickCount: nextKicks,
        currentWeek: age?.week ?? null,
        symptoms: nextChecks,
      });
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
          <Text style={{ color: c.danger, marginBottom: 10, fontWeight: '600' }}>{msg}</Text>
        ) : null}

        {!bundle?.pregnancy ? (
          <CycleCard>
            <Text style={{ color: c.muted, lineHeight: 22 }}>
              ორსულობის რეჟიმი და მოსალოდნელი თარიღი დააყენეთ პარამეტრებში.
            </Text>
          </CycleCard>
        ) : (
          <Animated.View entering={FadeIn.duration(500)}>
            <View style={{ borderRadius: 28, overflow: 'hidden', marginBottom: 16, ...cycleShadow.soft }}>
              <LinearGradient
                colors={[c.lavenderSoft, c.roseSoft, c.peach]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ padding: 28, alignItems: 'center' }}
              >
                <View
                  style={{
                    width: 72,
                    height: 72,
                    borderRadius: 26,
                    backgroundColor: c.card,
                    alignItems: 'center',
                    justifyContent: 'center',
                    ...cycleShadow.card,
                  }}
                >
                  <Baby size={34} color={c.lavender} strokeWidth={1.8} />
                </View>
                <Text style={{ color: c.ink, fontSize: 32, fontWeight: '800', marginTop: 16 }}>
                  {ka.cycle.week} {age?.week ?? '—'}
                </Text>
                <Text style={{ color: c.muted, marginTop: 4, fontWeight: '600' }}>
                  {ka.cycle.day} {age?.day ?? 0} · {ka.cycle.trimester} {age?.trimester ?? '—'}
                </Text>
                <View
                  style={{
                    width: '100%',
                    height: 10,
                    borderRadius: 5,
                    backgroundColor: 'rgba(255,255,255,0.55)',
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
                <Text style={{ color: c.muted, fontSize: 12, marginTop: 8, fontWeight: '600' }}>
                  {Math.round(weekProgress * 100)}% · 40 კვირა
                </Text>
              </LinearGradient>
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
                <Footprints size={20} color={c.rose} />
                <Text style={{ color: c.ink, fontWeight: '800', marginLeft: 8, fontSize: 16 }}>
                  {ka.cycle.kicks}
                </Text>
              </View>
              <Text
                style={{
                  color: c.ink,
                  fontSize: 56,
                  fontWeight: '800',
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
                    backgroundColor: c.lavenderSoft,
                    borderRadius: 16,
                    padding: 16,
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ color: c.ink, fontWeight: '800', fontSize: 22 }}>−</Text>
                </Pressable>
                <Pressable
                  onPress={() => saveKicks(kicks + 1)}
                  style={{
                    flex: 1,
                    backgroundColor: c.rose,
                    borderRadius: 16,
                    padding: 16,
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ color: '#fff', fontWeight: '800', fontSize: 22 }}>+</Text>
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
                            backgroundColor: on ? c.rose : c.lavenderSoft,
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
