import React, { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useNavigation, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { BarChart3, Baby, CalendarHeart, FileText, Sparkles } from 'lucide-react-native';
import { CycleHomeHeader } from '@/components/cycle/CycleHomeHeader';
import { CycleRing } from '@/components/cycle/CycleRing';
import { CycleAlertsBanner } from '@/components/cycle/CycleAlertsBanner';
import { CycleQuickLogSheet } from '@/components/cycle/CycleQuickLogSheet';
import { CyclePmsHeatmap } from '@/components/cycle/CyclePmsHeatmap';
import { CycleOnboarding } from '@/components/cycle/CycleOnboarding';
import { CycleDayStrip } from '@/components/cycle/CycleDayStrip';
import { CycleDayInsights } from '@/components/cycle/CycleDayInsights';
import { CycleCalendarSheet } from '@/components/cycle/CycleCalendarSheet';
import { todayKey } from '@/components/cycle/CycleCalendar';
import {
  CycleAtmosphere,
  CycleFab,
  CycleFeatureTile,
  CycleLoading,
} from '@/components/cycle/CycleUI';
import { MONTHS_KA } from '@/constants/cycle';
import { cycleShadow } from '@/theme/cycle';
import { ka } from '@/i18n/ka';
import {
  cycleDayForDate,
  detectCyclePhaseForDate,
  parseDateKey,
} from '@/lib/cyclePhase';
import { hasPmsPattern } from '@/lib/cycleAnalytics';
import { getCycleReminderPrefs } from '@/lib/cycleReminderPrefs';
import { syncCycleReminders } from '@/lib/cycleReminders';
import { api, ApiError, type CycleBundle } from '@/lib/api';
import { useAuth } from '@/store/AuthContext';
import { useCycleColors } from '@/theme/cycle';

export default function CycleHome() {
  const { user } = useAuth();
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const c = useCycleColors();

  const [bundle, setBundle] = useState<CycleBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [onboardSaving, setOnboardSaving] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [quickLogOpen, setQuickLogOpen] = useState(false);
  const [selected, setSelected] = useState(todayKey());
  const [cursor, setCursor] = useState(() => {
    const n = new Date();
    return { y: n.getFullYear(), m: n.getMonth() };
  });

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  const load = useCallback(async () => {
    try {
      setError(null);
      const data = await api.cycle.get();
      setBundle(data);
      const prefs = await getCycleReminderPrefs();
      await syncCycleReminders(data, prefs);
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

  const cycleLen = bundle?.profile.avgCycleLength ?? 28;
  const periodLen = bundle?.profile.avgPeriodLength ?? 5;
  const lastPeriod = bundle?.profile.lastPeriodStart ?? null;
  const needsOnboarding =
    Boolean(bundle) && user?.gender === 'FEMALE' && !lastPeriod;

  const selectedPhase = useMemo(
    () =>
      detectCyclePhaseForDate({
        lastPeriodStart: lastPeriod,
        targetDate: selected,
        avgCycleLength: cycleLen,
        avgPeriodLength: periodLen,
      }),
    [lastPeriod, selected, cycleLen, periodLen],
  );

  const selectedCycleDay = useMemo(
    () => cycleDayForDate(lastPeriod, selected, cycleLen),
    [lastPeriod, selected, cycleLen],
  );

  const selectedMonth = useMemo(() => parseDateKey(selected), [selected]);

  const headerSubtitle = useMemo(() => {
    if (selectedPhase.day != null) {
      return `${ka.cycle.cycleDay} ${selectedPhase.day} · ${selectedPhase.phaseKa}`;
    }
    return ka.cycle.swipeDaysHint;
  }, [selectedPhase]);

  useEffect(() => {
    setCursor({ y: selectedMonth.y, m: selectedMonth.m });
  }, [selectedMonth.y, selectedMonth.m]);

  const saveLastPeriod = async (iso: string) => {
    setOnboardSaving(true);
    setError(null);
    try {
      const data = await api.cycle.updateProfile({ lastPeriodStart: iso });
      setBundle(data);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : ka.common.error);
    } finally {
      setOnboardSaving(false);
    }
  };

  const pickDate = (date: string) => {
    setSelected(date);
  };

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
  const selectedMark = marks[selected];
  const today = todayKey();
  const todayLog = bundle?.logs.find((l) => l.date === today);
  const showPms =
    Boolean(bundle) &&
    selectedPhase.phase === 'luteal' &&
    hasPmsPattern(bundle!);

  return (
    <CycleAtmosphere>
      <CycleOnboarding
        visible={needsOnboarding}
        saving={onboardSaving}
        userName={user?.fullName}
        onSave={saveLastPeriod}
      />

      <View style={{ flex: 1 }}>
        <CycleHomeHeader
          monthLabel={`${MONTHS_KA[selectedMonth.m]} ${selectedMonth.y}`}
          subtitle={headerSubtitle}
          topInset={insets.top}
          onBack={() => {
            if (router.canGoBack()) router.back();
            else router.replace('/(tabs)/home');
          }}
          onCalendar={() => setCalendarOpen(true)}
          onSettings={() => router.push('/cycle/settings' as never)}
        />

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: insets.bottom + 110 }}
          refreshControl={
            <RefreshControl refreshing={loading} onRefresh={load} tintColor={c.rose} />
          }
          showsVerticalScrollIndicator={false}
        >
        <CycleDayStrip
          selected={selected}
          onSelect={pickDate}
          marks={marks}
          onLongPress={(date) => {
            if (date === today) {
              setSelected(date);
              setQuickLogOpen(true);
            }
          }}
        />

        {error ? (
          <Text
            style={{
              color: c.danger,
              marginBottom: 8,
              fontWeight: '600',
              paddingHorizontal: 20,
            }}
          >
            {error}
          </Text>
        ) : null}

        {bundle ? <CycleAlertsBanner bundle={bundle} /> : null}

        <Pressable onPress={() => setQuickLogOpen(true)}>
        <Animated.View
          entering={FadeInUp.duration(420)}
          style={{ marginHorizontal: 20, marginBottom: 16, marginTop: 4 }}
        >
          <LinearGradient
            colors={[c.heroFrom, c.heroTo]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              borderRadius: 28,
              paddingVertical: 18,
              paddingHorizontal: 14,
              alignItems: 'center',
              borderWidth: 1,
              borderColor: c.border,
              ...cycleShadow.soft,
            }}
          >
            <CycleRing
              day={selectedCycleDay}
              cycleLength={cycleLen}
              label={ka.cycle.cycleDay}
              phaseHint={selectedPhase.phaseKa}
            />
          </LinearGradient>
          {selected === today ? (
            <View
              style={{
                marginTop: 10,
                alignSelf: 'center',
                backgroundColor: todayLog ? `${c.success}22` : c.roseSoft,
                paddingHorizontal: 14,
                paddingVertical: 6,
                borderRadius: 999,
              }}
            >
              <Text style={{ color: todayLog ? c.success : c.rose, fontWeight: '700', fontSize: 12 }}>
                {todayLog ? ka.cycle.quickLogDone : ka.cycle.quickLogTap}
              </Text>
            </View>
          ) : null}
        </Animated.View>
        </Pressable>

        {bundle ? (
          <View style={{ paddingHorizontal: 20 }}>
            <CycleDayInsights date={selected} bundle={bundle} mark={selectedMark} />
          </View>
        ) : null}

        {showPms && bundle ? (
          <View style={{ paddingHorizontal: 20, marginBottom: 12 }}>
            <CyclePmsHeatmap bundle={bundle} compact />
          </View>
        ) : null}

        {bundle?.profile.mode === 'PREGNANCY' && bundle.pregnancy?.age ? (
          <Pressable
            onPress={() => router.push('/cycle/pregnancy' as never)}
            style={{ marginHorizontal: 20, marginBottom: 16, borderRadius: 24, overflow: 'hidden' }}
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

        <View style={{ paddingHorizontal: 20 }}>
          <Text
            style={{
              color: c.ink,
              fontWeight: '800',
              fontSize: 16,
              marginBottom: 12,
            }}
          >
            {ka.cycle.quickActions}
          </Text>

          <View style={{ gap: 10 }}>
            <CycleFeatureTile
              icon={CalendarHeart}
              title={ka.cycle.logToday}
              subtitle={ka.cycle.logHint}
              color={c.rose}
              delay={40}
              onPress={() =>
                router.push({ pathname: '/cycle/log', params: { date: selected } } as never)
              }
            />
            <CycleFeatureTile
              icon={FileText}
              title={ka.cycle.summary}
              subtitle={ka.cycle.summaryHint}
              color={c.lavender}
              delay={80}
              onPress={() => router.push('/cycle/summary' as never)}
            />
            <CycleFeatureTile
              icon={BarChart3}
              title={ka.cycle.trendsTitle}
              subtitle={ka.cycle.trendsOpen}
              color={c.blushDeep}
              delay={100}
              onPress={() => router.push('/cycle/trends' as never)}
            />
            {bundle?.profile.mode === 'TRY_TO_CONCEIVE' ||
            bundle?.profile.mode === 'PREGNANCY' ? (
              <CycleFeatureTile
                icon={Sparkles}
                title={
                  bundle.profile.mode === 'PREGNANCY' ? ka.cycle.pregnancy : ka.cycle.modeTtc
                }
                subtitle={ka.modules.cycle.subtitle}
                color={c.blushDeep}
                delay={120}
                onPress={() => router.push('/cycle/pregnancy' as never)}
              />
            ) : null}
          </View>
        </View>
        </ScrollView>
      </View>

      <CycleCalendarSheet
        visible={calendarOpen}
        onClose={() => setCalendarOpen(false)}
        year={cursor.y}
        month={cursor.m}
        marks={marks}
        selected={selected}
        onSelect={pickDate}
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

      {!needsOnboarding ? (
        <View style={{ position: 'absolute', right: 18, bottom: insets.bottom + 20 }}>
          <CycleFab
            label={ka.cycle.logFab}
            onPress={() => setQuickLogOpen(true)}
          />
        </View>
      ) : null}

      <CycleQuickLogSheet
        visible={quickLogOpen}
        date={selected}
        onClose={() => setQuickLogOpen(false)}
        onSaved={load}
      />
    </CycleAtmosphere>
  );
}
