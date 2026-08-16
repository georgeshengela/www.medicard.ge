import React, { useCallback, useLayoutEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useNavigation, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import {
  Baby,
  CalendarHeart,
  FileText,
  Settings2,
  Sparkles,
} from 'lucide-react-native';
import { CycleCalendar, cycleDayNumber, todayKey } from '@/components/cycle/CycleCalendar';
import { CycleRing } from '@/components/cycle/CycleRing';
import { CycleInsightsPanel } from '@/components/cycle/CycleInsights';
import {
  CycleActionPanel,
  CycleActionRow,
  CycleAtmosphere,
  CycleFab,
  CycleLoading,
  formatCycleDateKa,
  cycleNavHeader,
} from '@/components/cycle/CycleUI';
import { ka } from '@/i18n/ka';
import { api, ApiError, type CycleBundle } from '@/lib/api';
import { useAuth } from '@/store/AuthContext';
import { useCycleColors } from '@/theme/cycle';

function phaseForDay(
  day: number | null,
  periodLen: number,
  cycleLen: number,
): string | undefined {
  if (day == null) return undefined;
  if (day <= periodLen) return 'მენსტრუაცია';
  const ov = cycleLen - 14;
  if (day >= ov - 5 && day <= ov + 1) return day === ov ? 'ოვულაცია' : 'ნაყოფიერი ფანჯარა';
  if (day > ov + 1) return 'ლუთეალური ფაზა';
  return 'ფოლიკულური ფაზა';
}

export default function CycleHome() {
  const { user } = useAuth();
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const c = useCycleColors();

  const [bundle, setBundle] = useState<CycleBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cursor, setCursor] = useState(() => {
    const n = new Date();
    return { y: n.getFullYear(), m: n.getMonth() };
  });
  const [selected, setSelected] = useState(todayKey());

  useLayoutEffect(() => {
    navigation.setOptions({
      ...cycleNavHeader(c, ka.cycle.title),
      headerRight: () => (
        <Pressable
          onPress={() => router.push('/cycle/settings' as never)}
          hitSlop={10}
          style={{
            marginRight: 4,
            width: 36,
            height: 36,
            borderRadius: 12,
            backgroundColor: c.roseSoft,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Settings2 size={18} color={c.rose} strokeWidth={2.2} />
        </Pressable>
      ),
    });
  }, [navigation, router, c]);

  const load = useCallback(async () => {
    try {
      setError(null);
      const data = await api.cycle.get();
      setBundle(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : ka.common.error);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (user?.gender !== 'FEMALE') {
        setLoading(false);
        return;
      }
      load();
    }, [user?.gender, load]),
  );

  const day = cycleDayNumber(bundle?.profile.lastPeriodStart ?? null);
  const cycleLen = bundle?.profile.avgCycleLength ?? 28;
  const periodLen = bundle?.profile.avgPeriodLength ?? 5;
  const phase = useMemo(
    () => phaseForDay(day, periodLen, cycleLen),
    [day, periodLen, cycleLen],
  );

  if (user?.gender !== 'FEMALE') {
    return (
      <CycleAtmosphere>
        <View style={{ flex: 1, padding: 28, justifyContent: 'center' }}>
          <View
            style={{
              backgroundColor: c.card,
              borderRadius: 28,
              padding: 28,
              alignItems: 'center',
            }}
          >
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: 22,
                backgroundColor: c.roseSoft,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 16,
              }}
            >
              <CalendarHeart size={28} color={c.rose} strokeWidth={2} />
            </View>
            <Text style={{ color: c.ink, fontSize: 22, fontWeight: '800', textAlign: 'center' }}>
              {ka.cycle.onlyFemale}
            </Text>
            <Text
              style={{
                color: c.muted,
                marginTop: 10,
                textAlign: 'center',
                lineHeight: 22,
              }}
            >
              {ka.cycle.setGender}
            </Text>
            <Pressable
              onPress={() => router.push('/(tabs)/profile')}
              style={{
                marginTop: 24,
                backgroundColor: c.rose,
                paddingHorizontal: 24,
                paddingVertical: 14,
                borderRadius: 16,
              }}
            >
              <Text style={{ color: '#fff', fontWeight: '700' }}>{ka.profile.title}</Text>
            </Pressable>
          </View>
        </View>
      </CycleAtmosphere>
    );
  }

  if (loading && !bundle) return <CycleLoading />;

  const marks = bundle?.predictions.calendar ?? {};

  return (
    <CycleAtmosphere>
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 110 }}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={load} tintColor={c.rose} />
        }
        showsVerticalScrollIndicator={false}
      >
        {error ? (
          <Text style={{ color: c.danger, marginBottom: 12, fontWeight: '600' }}>{error}</Text>
        ) : null}

        <Animated.View entering={FadeInUp.duration(450)} style={{ alignItems: 'center', marginBottom: 22 }}>
          <Text
            style={{
              color: c.muted,
              fontSize: 13,
              fontWeight: '600',
              marginBottom: 14,
              textAlign: 'center',
            }}
          >
            {ka.cycle.subtitle}
          </Text>
          <CycleRing
            day={day}
            cycleLength={cycleLen}
            label={ka.cycle.cycleDay}
            phaseHint={phase}
          />
        </Animated.View>

        <CycleInsightsPanel
          seed={
            (bundle?.profile.aiInsights as never) ||
            bundle?.localInsights ||
            null
          }
        />

        {bundle?.profile.mode === 'PREGNANCY' && bundle.pregnancy?.age ? (
          <Pressable
            onPress={() => router.push('/cycle/pregnancy' as never)}
            style={{ marginBottom: 16, borderRadius: 24, overflow: 'hidden' }}
          >
            <LinearGradient
              colors={[c.lavenderSoft, c.roseSoft]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                padding: 18,
                flexDirection: 'row',
                alignItems: 'center',
              }}
            >
              <View
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 18,
                  backgroundColor: c.card,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Baby size={26} color={c.lavender} strokeWidth={2} />
              </View>
              <View style={{ marginLeft: 14, flex: 1 }}>
                <Text style={{ color: c.ink, fontWeight: '800', fontSize: 17 }}>
                  {ka.cycle.week} {bundle.pregnancy.age.week}, {ka.cycle.day}{' '}
                  {bundle.pregnancy.age.day}
                </Text>
                <Text style={{ color: c.muted, marginTop: 3, fontSize: 13 }}>
                  {ka.cycle.babySize}: {bundle.pregnancy.insight.size}
                </Text>
              </View>
              <Text style={{ color: c.lavender, fontSize: 22, fontWeight: '700' }}>›</Text>
            </LinearGradient>
          </Pressable>
        ) : null}

        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
          <InsightChip
            title={ka.cycle.nextPeriodShort}
            value={
              bundle?.predictions.nextPeriodStart
                ? formatCycleDateKa(bundle.predictions.nextPeriodStart).replace(/ \d{4}$/, '')
                : '—'
            }
            color={c.period}
            delay={40}
          />
          <InsightChip
            title={ka.cycle.ovulation}
            value={
              bundle?.predictions.ovulationDate
                ? formatCycleDateKa(bundle.predictions.ovulationDate).replace(/ \d{4}$/, '')
                : '—'
            }
            color={c.ovulation}
            delay={80}
          />
          <InsightChip
            title={ka.cycle.fertileShort}
            value={
              bundle?.predictions.fertileWindow
                ? `${bundle.predictions.fertileWindow.start.slice(8)}–${bundle.predictions.fertileWindow.end.slice(8)}`
                : '—'
            }
            color={c.fertile}
            delay={120}
          />
        </View>

        <CycleCalendar
          year={cursor.y}
          month={cursor.m}
          marks={marks}
          selected={selected}
          onSelect={(d) => {
            setSelected(d);
            Haptics.selectionAsync().catch(() => undefined);
          }}
          onPrev={() =>
            setCursor((cur) => {
              const m = cur.m - 1;
              return m < 0 ? { y: cur.y - 1, m: 11 } : { y: cur.y, m };
            })
          }
          onNext={() =>
            setCursor((cur) => {
              const m = cur.m + 1;
              return m > 11 ? { y: cur.y + 1, m: 0 } : { y: cur.y, m };
            })
          }
        />

        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'center',
            gap: 16,
            marginTop: 14,
            marginBottom: 6,
          }}
        >
          <Legend dot={c.period} label={ka.cycle.legendPeriod} ink={c.muted} />
          <Legend dot={c.fertile} label={ka.cycle.legendFertile} ink={c.muted} />
          <Legend dot={c.ovulation} label={ka.cycle.legendOvulation} ink={c.muted} />
        </View>

        <View style={{ marginTop: 18 }}>
          <CycleActionPanel>
            <CycleActionRow
              icon={CalendarHeart}
              title={ka.cycle.logToday}
              subtitle={ka.cycle.logHint}
              color={c.rose}
              delay={40}
              onPress={() =>
                router.push({ pathname: '/cycle/log', params: { date: selected } } as never)
              }
            />
            <CycleActionRow
              icon={FileText}
              title={ka.cycle.summary}
              subtitle={ka.cycle.summaryHint}
              color={c.lavender}
              delay={80}
              last={
                !(
                  bundle?.profile.mode === 'TRY_TO_CONCEIVE' ||
                  bundle?.profile.mode === 'PREGNANCY'
                )
              }
              onPress={() => router.push('/cycle/summary' as never)}
            />
            {bundle?.profile.mode === 'TRY_TO_CONCEIVE' ||
            bundle?.profile.mode === 'PREGNANCY' ? (
              <CycleActionRow
                icon={Sparkles}
                title={
                  bundle.profile.mode === 'PREGNANCY' ? ka.cycle.pregnancy : ka.cycle.modeTtc
                }
                subtitle={ka.modules.cycle.subtitle}
                color={c.blushDeep}
                delay={120}
                last
                onPress={() => router.push('/cycle/pregnancy' as never)}
              />
            ) : null}
          </CycleActionPanel>
        </View>

        {!bundle?.profile.lastPeriodStart ? (
          <View
            style={{
              marginTop: 22,
              backgroundColor: c.roseSoft,
              borderRadius: 20,
              padding: 16,
            }}
          >
            <Text style={{ color: c.rose, textAlign: 'center', lineHeight: 20, fontWeight: '600' }}>
              {ka.cycle.emptyHint}
            </Text>
          </View>
        ) : null}
      </ScrollView>

      <View style={{ position: 'absolute', right: 22, bottom: insets.bottom + 22 }}>
        <CycleFab
          onPress={() =>
            router.push({ pathname: '/cycle/log', params: { date: todayKey() } } as never)
          }
        />
      </View>
    </CycleAtmosphere>
  );
}

function InsightChip({
  title,
  value,
  color,
  delay,
}: {
  title: string;
  value: string;
  color: string;
  delay: number;
}) {
  const c = useCycleColors();
  return (
    <Animated.View
      entering={FadeInUp.delay(delay).duration(400)}
      style={{
        flex: 1,
        minWidth: 0,
        backgroundColor: c.card,
        borderRadius: 18,
        paddingVertical: 12,
        paddingHorizontal: 10,
        borderWidth: 1,
        borderColor: c.border,
      }}
    >
      <View
        style={{
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: color,
          marginBottom: 8,
        }}
      />
      <Text
        style={{ color: c.muted, fontSize: 10, fontWeight: '700', lineHeight: 13 }}
        numberOfLines={1}
        ellipsizeMode="tail"
      >
        {title}
      </Text>
      <Text
        style={{
          color: c.ink,
          fontWeight: '800',
          marginTop: 4,
          fontSize: 13,
          lineHeight: 17,
        }}
        numberOfLines={1}
        ellipsizeMode="tail"
      >
        {value}
      </Text>
    </Animated.View>
  );
}

function Legend({ dot, label, ink }: { dot: string; label: string; ink: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: dot }} />
      <Text style={{ color: ink, fontSize: 11, fontWeight: '600' }}>{label}</Text>
    </View>
  );
}
