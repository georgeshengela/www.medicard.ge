import React, { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInUp } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Baby, CalendarHeart, MessageSquareText } from 'lucide-react-native';
import { CycleHomeHeader } from '@/components/cycle/CycleHomeHeader';
import { CycleHero } from '@/components/cycle/CycleHero';
import { CycleAlertsBanner } from '@/components/cycle/CycleAlertsBanner';
import { CycleQuickLogSheet } from '@/components/cycle/CycleQuickLogSheet';
import { CyclePmsHeatmap } from '@/components/cycle/CyclePmsHeatmap';
import { CycleOnboarding } from '@/components/cycle/CycleOnboarding';
import { CycleDayStrip } from '@/components/cycle/CycleDayStrip';
import { CycleDaySummary } from '@/components/cycle/CycleDaySummary';
import { CycleDayDetailsSheet } from '@/components/cycle/CycleDayDetailsSheet';
import { CycleCalendarLegend } from '@/components/cycle/CycleCalendarLegend';
import { CycleJournalPane } from '@/components/cycle/CycleJournalPane';
import { CycleInsightsPanel } from '@/components/cycle/CycleInsights';
import { CycleTtcCard } from '@/components/cycle/CycleTtcCard';
import { CycleContraceptionCard } from '@/components/cycle/CycleContraceptionCard';
import { CycleTtcConflictSheet } from '@/components/cycle/CycleTtcConflictSheet';
import { mergeFertilityMarks } from '@/lib/cycleFertility';
import { CycleCalendar, todayKey } from '@/components/cycle/CycleCalendar';
import {
  CycleAtmosphere,
  CycleFab,
  CycleLoading,
  CycleSection,
} from '@/components/cycle/CycleUI';
import { MONTHS_KA } from '@/constants/cycle';
import { ka } from '@/i18n/ka';
import { parseDateKey } from '@/lib/cyclePhase';
import { cycleToday, phaseFromBundle, usedCycleLength } from '@/lib/cycleCanonical';
import { displayPhaseLabel } from '@/lib/cycleHonesty';
import { showContraceptionContextCard, showFertilityUi } from '@/lib/cycleContraception';
import { alertPresentation, confidencePresentation } from '@/lib/cyclePresentation.js';
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

type CyclePane = 'overview' | 'calendar' | 'journal';

const PANES: { id: CyclePane; label: string }[] = [
  { id: 'overview', label: ka.cycle.paneOverview },
  { id: 'calendar', label: ka.cycle.paneCalendar },
  { id: 'journal', label: ka.cycle.paneJournal },
];

function PaneSwitcher({
  pane,
  onChange,
}: {
  pane: CyclePane;
  onChange: (next: CyclePane) => void;
}) {
  const c = useCycleColors();
  return (
    <View
      accessibilityRole="tablist"
      style={{
        flexDirection: 'row',
        marginHorizontal: 16,
        marginBottom: 12,
        backgroundColor: c.cardSoft,
        borderRadius: 16,
        padding: 4,
        borderWidth: 1,
        borderColor: c.border,
      }}
    >
      {PANES.map((p) => {
        const active = pane === p.id;
        return (
          <Pressable
            key={p.id}
            onPress={() => {
              Haptics.selectionAsync().catch(() => undefined);
              onChange(p.id);
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={p.label}
            style={{
              flex: 1,
              minHeight: 44,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 12,
              backgroundColor: active ? c.card : 'transparent',
            }}
          >
            <Text
              numberOfLines={2}
              style={{
                color: active ? c.ink : c.muted,
                fontFamily: active ? 'NotoSansGeorgian_700Bold' : 'NotoSansGeorgian_500Medium',
                fontSize: 13,
                lineHeight: 17,
                textAlign: 'center',
                paddingHorizontal: 2,
              }}
            >
              {p.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function CycleHome() {
  const { user } = useAuth();
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const c = useCycleColors();
  const [pane, setPane] = useState<CyclePane>('overview');

  const [bundle, setBundle] = useState<CycleBundle | null>(null);
  const [cycleView, setCycleView] = useState<CycleView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [onboardSaving, setOnboardSaving] = useState(false);
  const [holdOnboarding, setHoldOnboarding] = useState(false);
  const [ttcConflictOpen, setTtcConflictOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const [daySheetOpen, setDaySheetOpen] = useState(false);
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
    Boolean(bundle) && user?.gender === 'FEMALE' && (!lastPeriod || holdOnboarding);
  const cycleTodayKey = cycleToday(bundle, todayKey());
  const cycleLen = bundle ? usedCycleLength(bundle) : 28;
  const today = cycleTodayKey;

  const todayPhase = useMemo(
    () =>
      bundle
        ? phaseFromBundle(bundle, today)
        : { day: null, phase: 'unknown' as const, phaseKa: ka.cycle.adviceUnknownTitle },
    [bundle, today],
  );

  const selectedMonth = useMemo(() => parseDateKey(selected), [selected]);

  const headerSubtitle = useMemo(() => {
    if (todayPhase.day != null) {
      return `${ka.cycle.cycleDay} ${todayPhase.day} · ${displayPhaseLabel(todayPhase.phase, todayPhase.phaseKa, {
        loggedPeriod: isBleedFlow(bundle?.logs.find((l) => l.date === today)?.flow),
      })}`;
    }
    return ka.cycle.statusLearning;
  }, [todayPhase, bundle, today]);

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
  const fertilityVisible = bundle ? showFertilityUi(bundle) : true;
  const showPredicted = bundle
    ? !confidencePresentation(bundle.predictions?.confidence).hidePredictedOverlays
    : true;

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
      setHoldOnboarding(true);
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

  const openQuickLog = (date: string, markStart = false) => {
    setSelected(date);
    setStartIntent(markStart);
    setDaySheetOpen(false);
    setQuickOpen(true);
  };

  const endPeriod = () => {
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
                date: today,
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
        onFinishContraception={async ({ method, startedAt }) => {
          setOnboardSaving(true);
          setSaveError(null);
          try {
            if (method) {
              const data = await api.cycle.updateProfile({
                contraceptionMethod: method,
                contraceptionStartedAt: startedAt,
              });
              if (data?.profile) setBundle(data);
              if (data?.contraception?.ttcConflict) setTtcConflictOpen(true);
            }
            setHoldOnboarding(false);
          } catch (err) {
            setSaveError(
              err instanceof ApiError && err.status === 0
                ? ka.cycle.contraceptionNeedsInternet
                : err instanceof ApiError
                  ? err.message
                  : ka.cycle.contraceptionNeedsInternet,
            );
          } finally {
            setOnboardSaving(false);
          }
        }}
      />
    );
  }

  if (loading && !bundle) return <CycleLoading />;

  const todayLog = bundle?.logs.find((l) => l.date === today);
  const onPeriodToday = isBleedFlow(todayLog?.flow);
  const showPms =
    Boolean(bundle) &&
    todayPhase.phase === 'luteal' &&
    hasPmsPattern(bundle!) &&
    bundle?.contraception?.presentation.showPhaseAsBiological !== false;

  const lateAlert = (bundle?.alerts ?? []).find((row) => alertPresentation(row).late);

  /** §4.2.2 — exactly one contextual block: safety > mode > pattern. */
  const contextualBlock: 'late' | 'pregnancy' | 'ttc' | 'contraception' | 'pms' | null =
    lateAlert
      ? 'late'
      : bundle?.profile.mode === 'PREGNANCY' && bundle.pregnancy?.age
        ? 'pregnancy'
        : bundle?.profile.mode === 'TRY_TO_CONCEIVE'
          ? 'ttc'
          : showContraceptionContextCard(bundle)
            ? 'contraception'
            : showPms
              ? 'pms'
              : null;

  return (
    <CycleAtmosphere>
      <View style={{ flex: 1 }}>
        <CycleHomeHeader
          monthLabel={
            pane === 'calendar'
              ? `${MONTHS_KA[cursor.m]} ${cursor.y}`
              : `${MONTHS_KA[selectedMonth.m]} ${selectedMonth.y}`
          }
          subtitle={headerSubtitle}
          topInset={insets.top}
          onBack={() => {
            if (pane !== 'overview') {
              setPane('overview');
              setDaySheetOpen(false);
              setQuickOpen(false);
              return;
            }
            if (router.canGoBack()) router.back();
            else router.replace('/(tabs)/home');
          }}
          onSettings={() => router.push('/cycle/settings' as never)}
        />

        <PaneSwitcher
          pane={pane}
          onChange={(next) => {
            setPane(next);
            if (next === 'overview') {
              setDaySheetOpen(false);
              setQuickOpen(false);
            }
          }}
        />

        {bundle ? (
          <CycleDayStrip
            selected={selected}
            onSelect={setSelected}
            onActivate={(date) => {
              setSelected(date);
              setDaySheetOpen(true);
            }}
            marks={marks}
            today={today}
            showFertility={fertilityVisible}
            showPredicted={showPredicted}
          />
        ) : null}

        <ScrollView
          style={{
            flex: 1,
            marginBottom:
              pane === 'calendar' && !daySheetOpen && !quickOpen ? insets.bottom + 84 : 0,
          }}
          contentContainerStyle={{
            paddingBottom: pane === 'calendar' ? 28 : 24,
          }}
          refreshControl={
            <RefreshControl refreshing={loading} onRefresh={load} tintColor={c.brand} />
          }
          showsVerticalScrollIndicator={false}
        >
          <CycleOfflineBanner
            view={cycleView}
            today={today}
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
                <Text style={{ color: c.brand, fontFamily: 'NotoSansGeorgian_700Bold' }}>
                  {ka.cycle.retry}
                </Text>
              </Pressable>
            </View>
          ) : null}

          {pane === 'overview' && bundle ? (
            <>
              <CycleAlertsBanner bundle={bundle} excludeLate />

              <Animated.View
                entering={FadeInUp.duration(360)}
                style={{ marginHorizontal: 16, marginBottom: 16, marginTop: 4 }}
              >
                <CycleHero
                  bundle={bundle}
                  day={todayPhase.day}
                  cycleLength={cycleLen}
                  phaseKa={todayPhase.phaseKa}
                  phase={todayPhase.phase}
                  today={today}
                  onLog={() => openQuickLog(today)}
                  onStart={() => openQuickLog(today, true)}
                  onEnd={endPeriod}
                  onInfo={() =>
                    Alert.alert(ka.cycle.howCalculated, ka.cycle.howCalculatedBody)
                  }
                />
              </Animated.View>

              <View style={{ paddingHorizontal: 16 }}>
                <CycleSection title={ka.cycle.todaySection} delay={20}>
                  <CycleDaySummary log={todayLog} onPress={() => openQuickLog(today)} />
                </CycleSection>
              </View>

              {contextualBlock === 'late' && lateAlert ? (
                <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
                  <View
                    style={{
                      borderRadius: 16,
                      borderWidth: 1,
                      borderColor: c.border,
                      backgroundColor: c.card,
                      padding: 14,
                    }}
                  >
                    <Text
                      style={{
                        color: c.ink,
                        fontFamily: 'NotoSansGeorgian_700Bold',
                        fontSize: 14,
                      }}
                    >
                      {ka.cycle.lateCalmTitle}
                    </Text>
                    <Text style={{ color: c.muted, fontSize: 13, lineHeight: 19, marginTop: 6 }}>
                      {lateAlert.messageKa}
                    </Text>
                  </View>
                </View>
              ) : null}

              {contextualBlock === 'contraception' ? (
                <View style={{ paddingHorizontal: 16 }}>
                  <CycleContraceptionCard bundle={bundle} />
                </View>
              ) : null}

              {contextualBlock === 'ttc' ? (
                <View style={{ paddingHorizontal: 16 }}>
                  <CycleTtcCard
                    bundle={bundle}
                    date={today}
                    log={todayLog}
                    onAction={(key) => {
                      if (key === 'full') {
                        router.push({ pathname: '/cycle/log', params: { date: today } } as never);
                        return;
                      }
                      router.push({
                        pathname: '/cycle/log',
                        params: { date: today, tab: 'more' },
                      } as never);
                    }}
                  />
                </View>
              ) : null}

              {contextualBlock === 'pms' ? (
                <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
                  <CyclePmsHeatmap bundle={bundle} compact />
                </View>
              ) : null}

              {contextualBlock === 'pregnancy' && bundle.pregnancy?.age ? (
                <Pressable
                  onPress={() => router.push('/cycle/pregnancy' as never)}
                  style={{
                    marginHorizontal: 16,
                    marginBottom: 16,
                    borderRadius: 16,
                    overflow: 'hidden',
                  }}
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
                        backgroundColor: c.lavenderSoft,
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
                <CycleInsightsPanel
                  seed={(bundle.profile.aiInsights as never) || bundle.localInsights || null}
                  phase={todayPhase}
                  mode={bundle.profile.mode}
                  conditions={bundle.profile.conditions}
                  log={todayLog}
                  confidence={bundle.predictions?.confidence}
                  isIrregular={bundle.profile.isIrregular}
                  offline={Boolean(cycleView?.stale)}
                  maxCards={1}
                />

                {/* Quiet Medi entry (§17) — a row, never a card wall. */}
                <Pressable
                  onPress={() => router.push('/chat/doctor' as never)}
                  accessibilityRole="button"
                  accessibilityLabel={ka.cycle.askMedi}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    minHeight: 44,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    marginTop: 8,
                    marginBottom: 8,
                    borderRadius: 16,
                    backgroundColor: c.roseSoft,
                    borderWidth: 1,
                    borderColor: c.border,
                  }}
                >
                  <MessageSquareText size={17} color={c.brand} strokeWidth={2.1} />
                  <Text
                    style={{
                      color: c.brand,
                      fontFamily: 'NotoSansGeorgian_600SemiBold',
                      fontSize: 13,
                      marginLeft: 8,
                    }}
                  >
                    {ka.cycle.askMedi}
                  </Text>
                </Pressable>
              </View>
            </>
          ) : null}

          {pane === 'calendar' && bundle ? (
            <View style={{ paddingHorizontal: 16 }}>
              {!(cursor.y === Number(today.slice(0, 4)) && cursor.m === Number(today.slice(5, 7)) - 1) ? (
                <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 8 }}>
                  <Pressable
                    onPress={() => {
                      const [y, m] = today.split('-').map(Number);
                      setCursor({ y, m: m - 1 });
                      setSelected(today);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={ka.cycle.jumpToday}
                    style={{
                      minHeight: 44,
                      paddingHorizontal: 14,
                      borderRadius: 18,
                      backgroundColor: c.cardSoft,
                      borderWidth: 1,
                      borderColor: c.border,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text
                      style={{ color: c.brand, fontSize: 13, fontFamily: 'NotoSansGeorgian_700Bold' }}
                    >
                      {ka.cycle.jumpToday}
                    </Text>
                  </Pressable>
                </View>
              ) : null}

              <CycleCalendar
                year={cursor.y}
                month={cursor.m}
                marks={marks}
                today={today}
                selected={selected}
                showFertility={fertilityVisible}
                showPredicted={showPredicted}
                onSelect={(d) => {
                  setSelected(d);
                  setDaySheetOpen(true);
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

              <View style={{ marginTop: 14 }}>
                <CycleCalendarLegend showFertility={fertilityVisible} showPredicted={showPredicted} />
              </View>
            </View>
          ) : null}

          {pane === 'journal' && bundle ? (
            <CycleJournalPane
              bundle={bundle}
              canonical={cycleView?.canonical ?? null}
              onChanged={() => void load()}
            />
          ) : null}
        </ScrollView>
      </View>

      {!needsOnboarding && pane !== 'journal' && !daySheetOpen && !quickOpen ? (
        <View style={{ position: 'absolute', left: 16, bottom: insets.bottom + 18 }}>
          <CycleFab
            label={ka.cycle.logFab}
            onPress={() => openQuickLog(pane === 'calendar' ? selected : today)}
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
        onSaved={(view) => {
          if (view) {
            setCycleView(view);
            setBundle(view.display);
            return;
          }
          void load();
        }}
        isPeriodStart={startIntent}
        onOpenFull={() => {
          setQuickOpen(false);
          router.push({ pathname: '/cycle/log', params: { date: selected } } as never);
        }}
      />

      {bundle ? (
        <CycleDayDetailsSheet
          visible={daySheetOpen}
          date={selected}
          bundle={bundle}
          mark={marks[selected]}
          onClose={() => setDaySheetOpen(false)}
          showPredicted={showPredicted}
          onLog={(date) => openQuickLog(date)}
          onFullLog={(date) => {
            setDaySheetOpen(false);
            router.push({ pathname: '/cycle/log', params: { date } } as never);
          }}
        />
      ) : null}

      <CycleTtcConflictSheet
        visible={ttcConflictOpen}
        onClose={() => setTtcConflictOpen(false)}
        onKeepTtc={() => setTtcConflictOpen(false)}
        onSwitchTrack={() => {
          setTtcConflictOpen(false);
          void api.cycle
            .updateProfile({ mode: 'TRACK_PERIOD' })
            .then((data) => {
              if (data?.profile) setBundle(data);
            })
            .catch(() => undefined);
        }}
      />
    </CycleAtmosphere>
  );
}
