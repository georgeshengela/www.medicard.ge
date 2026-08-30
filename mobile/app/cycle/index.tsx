import React, { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useNavigation, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInUp } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { BarChart3, Baby, CalendarHeart, FileText, Sparkles } from 'lucide-react-native';
import { CycleHomeHeader } from '@/components/cycle/CycleHomeHeader';
import { CycleHero } from '@/components/cycle/CycleHero';
import { CycleAlertsBanner } from '@/components/cycle/CycleAlertsBanner';
import { CycleLogHubModal } from '@/components/cycle/CycleLogHubModal';
import { CycleQuickLogSheet } from '@/components/cycle/CycleQuickLogSheet';
import { CyclePmsHeatmap } from '@/components/cycle/CyclePmsHeatmap';
import { CycleOnboarding } from '@/components/cycle/CycleOnboarding';
import { CycleDayStrip } from '@/components/cycle/CycleDayStrip';
import { CycleDayInsights } from '@/components/cycle/CycleDayInsights';
import { CycleTtcCard } from '@/components/cycle/CycleTtcCard';
import { mergeFertilityMarks } from '@/lib/cycleFertility';
import { CycleCalendarSheet } from '@/components/cycle/CycleCalendarSheet';
import { todayKey } from '@/components/cycle/CycleCalendar';
import {
  CycleAtmosphere,
  CycleFab,
  CycleFeatureTile,
  CycleLoading,
  CycleSection,
} from '@/components/cycle/CycleUI';
import { MONTHS_KA } from '@/constants/cycle';
import { ka } from '@/i18n/ka';
import { parseDateKey } from '@/lib/cyclePhase';
import { cycleToday, phaseFromBundle, usedCycleLength } from '@/lib/cycleCanonical';
import { displayPhaseLabel } from '@/lib/cycleHonesty';
import { isBleedFlow } from '@/lib/cycleLogSave';
import { hasPmsPattern } from '@/lib/cycleAnalytics';
import { CycleOfflineBanner } from '@/components/cycle/CycleOfflineBanner';
import { getCycleReminderPrefs } from '@/lib/cycleReminderPrefs';
import { syncCycleReminders } from '@/lib/cycleReminders';
import {
  cacheCycleBundle,
  discardCycleMutation,
  loadCycleView,
  queueApplyPeriod,
  type CycleView,
} from '@/lib/cycleOffline';
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
  const [cycleView, setCycleView] = useState<CycleView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [onboardSaving, setOnboardSaving] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [hubOpen, setHubOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const [startIntent, setStartIntent] = useState(false);
  const [selected, setSelected] = useState(todayKey());
  const [cursor, setCursor] = useState(() => {
    const n = new Date();
    return { y: n.getFullYear(), m: n.getMonth() };
  });

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  const load = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    try {
      setError(null);
      const view = await loadCycleView(user.id);
      setCycleView(view);
      setBundle(view.display);
      if (!view.stale && view.pendingCount === 0) {
        try {
          const prefs = await getCycleReminderPrefs();
          await syncCycleReminders(view.canonical, prefs);
        } catch {
          /* Reminders must not block last-period date pick. */
        }
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : ka.common.error);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      if (user?.gender !== 'FEMALE') {
        setLoading(false);
        return;
      }
      load();
    }, [user?.gender, load]),
  );

  const lastPeriod = bundle?.profile.lastPeriodStart ?? null;
  const needsOnboarding =
    Boolean(bundle) && user?.gender === 'FEMALE' && !lastPeriod;
  const cycleTodayKey = cycleToday(bundle, todayKey());
  const cycleLen = bundle ? usedCycleLength(bundle) : 28;

  const selectedPhase = useMemo(
    () =>
      bundle
        ? phaseFromBundle(bundle, selected)
        : { day: null, phase: 'unknown' as const, phaseKa: ka.cycle.adviceUnknownTitle },
    [bundle, selected],
  );

  const selectedCycleDay = selectedPhase.day;

  const selectedMonth = useMemo(() => parseDateKey(selected), [selected]);

  const headerSubtitle = useMemo(() => {
    if (selectedPhase.day != null) {
      return `${ka.cycle.cycleDay} ${selectedPhase.day} · ${displayPhaseLabel(selectedPhase.phase, selectedPhase.phaseKa, {
        loggedPeriod: isBleedFlow(bundle?.logs.find((l) => l.date === selected)?.flow),
      })}`;
    }
    return ka.cycle.swipeDaysHint;
  }, [selectedPhase, bundle, selected]);

  useEffect(() => {
    setCursor({ y: selectedMonth.y, m: selectedMonth.m });
  }, [selectedMonth.y, selectedMonth.m]);

  useEffect(() => {
    const serverToday = bundle?.meta?.today;
    if (!serverToday) return;
    setSelected((prev) => (prev === todayKey() ? serverToday : prev));
  }, [bundle?.meta?.today]);

  const marks = useMemo(
    () => mergeFertilityMarks(bundle?.predictions?.calendar, bundle?.logs),
    [bundle?.predictions?.calendar, bundle?.logs],
  );

  const saveLastPeriod = async (iso: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
      setSaveError(ka.cycle.pickDate);
      return;
    }
    setOnboardSaving(true);
    setSaveError(null);
    const optimistic = bundle
      ? { ...bundle, profile: { ...bundle.profile, lastPeriodStart: iso } }
      : null;
    try {
      let data: CycleBundle | null = null;
      try {
        data = await api.cycle.setLastPeriod(iso);
      } catch {
        data = await api.cycle.updateProfile({ lastPeriodStart: iso });
      }
      const stamped = data?.profile?.lastPeriodStart || iso;
      const next =
        data?.predictions && data?.profile
          ? { ...data, profile: { ...data.profile, lastPeriodStart: stamped } }
          : optimistic
            ? { ...optimistic, profile: { ...optimistic.profile, lastPeriodStart: stamped } }
            : data;
      if (next) setBundle(next);
      if (user?.id && next) {
        try {
          await cacheCycleBundle(user.id, next);
        } catch {
          /* Profile is already saved on the server. */
        }
      }
      try {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {
        /* Haptics must not fail a saved date. */
      }
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : ka.common.error);
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
              borderRadius: 16,
              padding: 28,
              alignItems: 'center',
              borderWidth: 1,
              borderColor: c.border,
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
            <Text
              style={{
                color: c.ink,
                fontSize: 22,
                fontFamily: 'NotoSansGeorgian_700Bold',
                textAlign: 'center',
              }}
            >
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
                backgroundColor: c.cta,
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

  if (needsOnboarding) {
    return (
      <CycleOnboarding
        visible
        saving={onboardSaving}
        userName={user?.fullName}
        error={saveError}
        onSave={saveLastPeriod}
      />
    );
  }

  if (loading && !bundle) return <CycleLoading />;

  const selectedMark = marks[selected];
  const today = cycleTodayKey;
  const showPms =
    Boolean(bundle) &&
    selectedPhase.phase === 'luteal' &&
    hasPmsPattern(bundle!);

  return (
    <CycleAtmosphere>
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
            <RefreshControl refreshing={loading} onRefresh={load} tintColor={c.brand} />
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
              setHubOpen(true);
            }
          }}
        />

        <CycleOfflineBanner
          view={cycleView}
          today={todayKey()}
          onRetry={() => void load()}
          onDiscard={(id) => {
            if (!user?.id) return;
            void discardCycleMutation(user.id, id).then(() => load());
          }}
        />

        {error && !bundle ? (
          <View
            style={{
              marginHorizontal: 16,
              marginBottom: 8,
              padding: 12,
              borderRadius: 14,
              backgroundColor: c.card,
              borderWidth: 1,
              borderColor: c.border,
              flexDirection: 'row',
              alignItems: 'center',
            }}
          >
            <Text style={{ color: c.danger, fontWeight: '600', flex: 1 }}>{error}</Text>
            <Pressable
              onPress={() => void load()}
              accessibilityRole="button"
              accessibilityLabel={ka.cycle.retry}
              style={{ paddingHorizontal: 12, minHeight: 44, justifyContent: 'center' }}
            >
              <Text style={{ color: c.brand, fontFamily: 'NotoSansGeorgian_700Bold' }}>{ka.cycle.retry}</Text>
            </Pressable>
          </View>
        ) : null}

        {bundle ? <CycleAlertsBanner bundle={bundle} /> : null}

        {bundle ? (
          <Animated.View
            entering={FadeInUp.duration(360)}
            style={{ marginHorizontal: 16, marginBottom: 16, marginTop: 4 }}
          >
            <CycleHero
              bundle={bundle}
              day={selectedCycleDay}
              cycleLength={cycleLen}
              phaseKa={selectedPhase.phaseKa}
              phase={selectedPhase.phase}
              today={today}
              onLog={() => setQuickOpen(true)}
              onStart={() => {
                setSelected(today);
                setStartIntent(true);
                setQuickOpen(true);
              }}
              onEnd={() => {
                Alert.alert(ka.cycle.periodEndCta, ka.cycle.periodEndHint, [
                  { text: ka.common.cancel, style: 'cancel' },
                  {
                    text: ka.cycle.periodEndCta,
                    onPress: () => {
                      void (async () => {
                        if (!user?.id) return;
                        try {
                          const result = await queueApplyPeriod(user.id, {
                            action: 'end',
                            date: selected,
                          });
                          if (result.view) {
                            setCycleView(result.view);
                            setBundle(result.view.display);
                          }
                        } catch {
                          setError(ka.common.error);
                        }
                      })();
                    },
                  },
                ]);
              }}
            />
          </Animated.View>
        ) : null}

        {bundle?.profile.mode === 'TRY_TO_CONCEIVE' ? (
          <View style={{ paddingHorizontal: 16 }}>
            <CycleTtcCard
              bundle={bundle}
              date={selected}
              log={bundle.logs.find((l) => l.date === selected)}
              onAction={(key) => {
                if (key === 'full') {
                  router.push({ pathname: '/cycle/log', params: { date: selected } } as never);
                  return;
                }
                router.push({
                  pathname: '/cycle/log',
                  params: { date: selected, tab: 'more' },
                } as never);
              }}
            />
          </View>
        ) : null}

        {bundle ? (
          <View style={{ paddingHorizontal: 16 }}>
            <CycleDayInsights
              date={selected}
              bundle={bundle}
              mark={selectedMark}
              pending={cycleView?.pendingDates.includes(selected)}
              stale={Boolean(cycleView?.stale)}
            />
          </View>
        ) : null}

        {showPms && bundle ? (
          <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
            <CyclePmsHeatmap bundle={bundle} compact />
          </View>
        ) : null}

        {bundle?.profile.mode === 'PREGNANCY' && bundle.pregnancy?.age ? (
          <Pressable
            onPress={() => router.push('/cycle/pregnancy' as never)}
            style={{ marginHorizontal: 16, marginBottom: 16, borderRadius: 16, overflow: 'hidden' }}
          >
            <View
              style={{
                padding: 16,
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: c.card,
                borderWidth: 1,
                borderColor: c.border,
                borderRadius: 16,
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
                <Text
                  style={{
                    color: c.ink,
                    fontFamily: 'NotoSansGeorgian_700Bold',
                    fontSize: 17,
                  }}
                >
                  {ka.cycle.week} {bundle.pregnancy.age.week}, {ka.cycle.day}{' '}
                  {bundle.pregnancy.age.day}
                </Text>
                <Text style={{ color: c.muted, marginTop: 3, fontSize: 13 }}>
                  {ka.cycle.babySize}: {bundle.pregnancy.insight.size}
                </Text>
              </View>
              <Text style={{ color: c.muted, fontSize: 22, fontWeight: '700' }}>›</Text>
            </View>
          </Pressable>
        ) : null}

        <View style={{ paddingHorizontal: 16 }}>
          <CycleSection title={ka.cycle.quickActions} delay={40}>
            <View>
              <CycleFeatureTile
                icon={CalendarHeart}
                title={ka.cycle.logToday}
                subtitle={ka.cycle.logHint}
                color={c.rose}
                delay={0}
                onPress={() =>
                  router.push({ pathname: '/cycle/log', params: { date: selected } } as never)
                }
              />
              <CycleFeatureTile
                icon={FileText}
                title={ka.cycle.summary}
                subtitle={ka.cycle.summaryHint}
                color={c.brand}
                delay={40}
                onPress={() => router.push('/cycle/summary' as never)}
              />
              <CycleFeatureTile
                icon={BarChart3}
                title={ka.cycle.trendsTitle}
                subtitle={ka.cycle.trendsOpen}
                color={c.brand}
                delay={80}
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
          </CycleSection>
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
        onToday={() => {
          const key = cycleTodayKey;
          const [y, m] = key.split('-').map(Number);
          setCursor({ y, m: m - 1 });
          pickDate(key);
        }}
      />

      {!needsOnboarding ? (
        <View style={{ position: 'absolute', right: 18, bottom: insets.bottom + 20 }}>
          <CycleFab
            label={ka.cycle.logFab}
            onPress={() => setQuickOpen(true)}
          />
        </View>
      ) : null}

      <CycleQuickLogSheet
        visible={quickOpen}
        date={selected}
        onClose={() => {
          setQuickOpen(false);
          setStartIntent(false);
        }}
        onSaved={load}
        isPeriodStart={startIntent}
        onOpenFull={() => {
          setQuickOpen(false);
          router.push({ pathname: '/cycle/log', params: { date: selected } } as never);
        }}
        onOpenHub={() => {
          setQuickOpen(false);
          setHubOpen(true);
        }}
      />

      <CycleLogHubModal
        visible={hubOpen}
        date={selected}
        onClose={() => setHubOpen(false)}
        onSaved={load}
      />
    </CycleAtmosphere>
  );
}
