import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
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
import { CalendarHeart, MessageSquareText } from 'lucide-react-native';
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
import { CyclePostpartumBleedClassifySheet } from '@/components/cycle/CyclePostpartumBleedClassifySheet';
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
import { alertPresentation, confidencePresentation, mergeOwnerClassifiedPeriodOntoMarks } from '@/lib/cyclePresentation.js';
import { isBleedFlow } from '@/lib/cycleLogSave';
import { hasPmsPattern } from '@/lib/cycleAnalytics';
import { CycleOfflineBanner } from '@/components/cycle/CycleOfflineBanner';
import { getCycleReminderPrefs } from '@/lib/cycleReminderPrefs';
import { syncCycleReminders } from '@/lib/cycleReminders';
import { syncPregnancyCareReminders } from '@/lib/pregnancyCareReminders';
import {
  cacheCycleBundle,
  discardCycleMutation,
  loadCycleView,
  queueApplyPeriod,
  type CycleView,
} from '@/lib/cycleOffline';
import { api, ApiError, type CycleBundle, type CyclePregnancyPayload, type CyclePostpartumPayload, type CycleTtcPayload } from '@/lib/api';
import { CyclePregnancyCard } from '@/components/cycle/CyclePregnancyCard';
import { CyclePerimenopauseCard } from '@/components/cycle/CyclePerimenopauseCard';
import { CyclePostpartumCard } from '@/components/cycle/CyclePostpartumCard';
import { CyclePregnancyTimelinePeek } from '@/components/cycle/CyclePregnancyTimelinePeek';
import { CyclePregnancyCarePlannerCard } from '@/components/cycle/CyclePregnancyCarePlannerCard';
import { cycleModeCapabilities, supportsCycleCapability } from '@/lib/cycleModes';
import { forecastPresentationAllowed, suppressCycleLengthChrome } from '@/lib/cycleForecastEligibility';
import { cycleLoggedBleedLabel } from '@/lib/cycleHistoryCopy';
import {
  applyTtcFailure,
  applyTtcSuccess,
  beginTtcFetch,
  emptyTtcQueryState,
  scopeTtcQueryToUser,
  shouldFetchCycleTtc,
  stopTtcQuery,
  ttcQueryTrace,
} from '@/lib/cycleTtcQuery';
import {
  applyPregnancyFailure,
  applyPregnancySuccess,
  beginPregnancyFetch,
  emptyPregnancyQueryState,
  scopePregnancyQueryToUser,
  shouldFetchCyclePregnancy,
  stopPregnancyQuery,
} from '@/lib/cyclePregnancyQuery';
import {
  applyPostpartumFailure,
  applyPostpartumSuccess,
  beginPostpartumFetch,
  emptyPostpartumQueryState,
  scopePostpartumQueryToUser,
  shouldFetchCyclePostpartum,
  stopPostpartumQuery,
} from '@/lib/cyclePostpartumQuery';
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
              minHeight: 52,
              paddingVertical: 8,
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
                lineHeight: 20,
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
  const { user, ready: authReady } = useAuth();
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
  const [classifyBleed, setClassifyBleed] = useState<{ date: string; classified: boolean } | null>(null);
  const [ttcQuery, setTtcQuery] = useState(() => emptyTtcQueryState());
  const ttcGen = useRef(0);
  const [pregnancyQuery, setPregnancyQuery] = useState(() => emptyPregnancyQueryState());
  const pregnancyGen = useRef(0);
  const [postpartumQuery, setPostpartumQuery] = useState(() => emptyPostpartumQueryState());
  const postpartumGen = useRef(0);
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

  useEffect(() => {
    if (typeof __DEV__ === 'undefined' || !__DEV__) return undefined;
    const g = globalThis as typeof globalThis & {
      __CYCLE_TTC_TRACE?: (event: string, extra?: Record<string, unknown>) => void;
    };
    g.__CYCLE_TTC_TRACE = (event, extra) => {
      console.log(`[cycle-ttc] ${event}`, extra);
    };
    return () => {
      delete g.__CYCLE_TTC_TRACE;
    };
  }, []);

  useEffect(() => {
    setTtcQuery((prev) => scopeTtcQueryToUser(prev, user?.id ?? null));
    setPregnancyQuery((prev) => scopePregnancyQueryToUser(prev, user?.id ?? null));
    setPostpartumQuery((prev) => scopePostpartumQueryToUser(prev, user?.id ?? null));
  }, [user?.id]);

  const refreshTtc = useCallback(
    async (view: CycleView, userId: string, gen: number) => {
      const eligible = shouldFetchCycleTtc({
        authReady,
        authenticated: Boolean(userId),
        mode: view.display.profile.mode,
        reachable: view.reachable !== false,
      });
      if (!eligible) {
        if (!supportsCycleCapability(view.display.profile.mode, 'showTtcOverview')) {
          setTtcQuery((prev) => stopTtcQuery(prev));
        } else if (view.reachable === false) {
          setTtcQuery((prev) =>
            prev.data && prev.userId === userId
              ? prev
              : applyTtcFailure(prev, {
                  generation: gen,
                  currentGeneration: ttcGen.current,
                  error: { status: 0 },
                  userId,
                }),
          );
        }
        return;
      }
      setTtcQuery((prev) =>
        beginTtcFetch(prev, { generation: gen, currentGeneration: ttcGen.current, userId }),
      );
      ttcQueryTrace('ttc_request_start', { gen, userId, t: Date.now() });
      try {
        const payload = await api.cycle.ttc();
        ttcQueryTrace('ttc_response', { gen, userId, t: Date.now(), ok: true });
        setTtcQuery((prev) =>
          applyTtcSuccess(prev, {
            generation: gen,
            currentGeneration: ttcGen.current,
            payload,
            userId,
          }),
        );
      } catch (err) {
        ttcQueryTrace('ttc_response', {
          gen,
          userId,
          t: Date.now(),
          status: err instanceof ApiError ? err.status : 0,
        });
        setTtcQuery((prev) =>
          applyTtcFailure(prev, {
            generation: gen,
            currentGeneration: ttcGen.current,
            error: err,
            userId,
          }),
        );
      }
    },
    [authReady],
  );

  const refreshPregnancy = useCallback(
    async (view: CycleView, userId: string, gen: number) => {
      const eligible = shouldFetchCyclePregnancy({
        authReady,
        authenticated: Boolean(userId),
        mode: view.display.profile.mode,
        reachable: view.reachable !== false,
      });
      if (!eligible) {
        if (!supportsCycleCapability(view.display.profile.mode, 'showPregnancyOverview')) {
          setPregnancyQuery((prev) => stopPregnancyQuery(prev));
        } else if (view.reachable === false) {
          setPregnancyQuery((prev) =>
            prev.data && prev.userId === userId
              ? prev
              : applyPregnancyFailure(prev, {
                  generation: gen,
                  currentGeneration: pregnancyGen.current,
                  error: { status: 0 },
                  userId,
                }),
          );
        }
        return;
      }
      setPregnancyQuery((prev) =>
        beginPregnancyFetch(prev, { generation: gen, currentGeneration: pregnancyGen.current, userId }),
      );
      try {
        const payload = await api.cycle.pregnancy();
        setPregnancyQuery((prev) =>
          applyPregnancySuccess(prev, {
            generation: gen,
            currentGeneration: pregnancyGen.current,
            payload,
            userId,
          }),
        );
      } catch (err) {
        setPregnancyQuery((prev) =>
          applyPregnancyFailure(prev, {
            generation: gen,
            currentGeneration: pregnancyGen.current,
            error: err,
            userId,
          }),
        );
      }
    },
    [authReady],
  );

  const refreshPostpartum = useCallback(
    async (view: CycleView, userId: string, gen: number) => {
      const eligible = shouldFetchCyclePostpartum({
        authReady,
        authenticated: Boolean(userId),
        mode: view.display.profile.mode,
        reachable: view.reachable !== false,
      });
      if (!eligible) {
        if (!supportsCycleCapability(view.display.profile.mode, 'showPostpartumOverview')) {
          setPostpartumQuery((prev) => stopPostpartumQuery(prev));
        } else if (view.reachable === false) {
          setPostpartumQuery((prev) =>
            prev.data && prev.userId === userId
              ? prev
              : applyPostpartumFailure(prev, {
                  generation: gen,
                  currentGeneration: postpartumGen.current,
                  error: { status: 0 },
                  userId,
                }),
          );
        }
        return;
      }
      setPostpartumQuery((prev) =>
        beginPostpartumFetch(prev, { generation: gen, currentGeneration: postpartumGen.current, userId }),
      );
      try {
        const payload = await api.cycle.postpartum();
        setPostpartumQuery((prev) =>
          applyPostpartumSuccess(prev, {
            generation: gen,
            currentGeneration: postpartumGen.current,
            payload,
            userId,
          }),
        );
      } catch (err) {
        setPostpartumQuery((prev) =>
          applyPostpartumFailure(prev, {
            generation: gen,
            currentGeneration: postpartumGen.current,
            error: err,
            userId,
          }),
        );
      }
    },
    [authReady],
  );

  const load = useCallback(async () => {
    if (!authReady) return;
    if (!user?.id) {
      setTtcQuery(emptyTtcQueryState(null));
      setPregnancyQuery(emptyPregnancyQueryState(null));
      setPostpartumQuery(emptyPostpartumQueryState(null));
      setLoading(false);
      return;
    }
    const gen = ++ttcGen.current;
    pregnancyGen.current = gen;
    postpartumGen.current = gen;
    const userId = user.id;
    ttcQueryTrace('auth_hydrated', { gen, userId, t: Date.now() });
    ttcQueryTrace('cycle_bundle_start', { gen, userId, t: Date.now() });
    try {
      setError(null);
      const view = await loadCycleView(userId);
      if (gen !== ttcGen.current) return;
      ttcQueryTrace('cycle_bundle_response', { gen, userId, t: Date.now() });
      setCycleView(view);
      setBundle(view.display);
      await refreshTtc(view, userId, gen);
      await refreshPregnancy(view, userId, gen);
      await refreshPostpartum(view, userId, gen);
      if (!view.stale && view.pendingCount === 0) {
        try {
          const prefs = await getCycleReminderPrefs();
          await syncCycleReminders(view.canonical, prefs);
          if (supportsCycleCapability(view.canonical.profile.mode, 'showPregnancyCarePlanner')) {
            const carePlan = await api.cycle.pregnancyCarePlan();
            await syncPregnancyCareReminders({
              plan: carePlan,
              userId: userId,
              mode: view.canonical.profile.mode,
              today: cycleToday(view.canonical, todayKey()),
              privacyEnabled: Boolean(view.canonical.profile.privacyEnabled),
            });
          }
        } catch {
          /* Reminders must not block last-period date pick. */
        }
      }
    } catch (err) {
      if (gen !== ttcGen.current) return;
      setError(err instanceof ApiError ? err.message : ka.common.error);
    } finally {
      if (gen === ttcGen.current) setLoading(false);
    }
  }, [authReady, user?.id, refreshTtc, refreshPregnancy, refreshPostpartum]);

  useFocusEffect(
    useCallback(() => {
      if (!authReady) return;
      if (user?.gender !== 'FEMALE') {
        setLoading(false);
        return;
      }
      void load();
    }, [authReady, user?.gender, load]),
  );

  const lastPeriod = bundle?.profile.lastPeriodStart ?? null;
  const needsOnboarding =
    Boolean(bundle) &&
    user?.gender === 'FEMALE' &&
    !supportsCycleCapability(bundle?.profile.mode, 'showPostpartumOverview') &&
    (!lastPeriod || holdOnboarding);
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
    const caps = cycleModeCapabilities(bundle?.profile.mode);
    if (caps.showPregnancyOverview) {
      const queryAge = (pregnancyQuery.data as CyclePregnancyPayload | null)?.estimatedGestationalAge;
      const age = bundle.pregnancy?.age ?? (queryAge ? { week: queryAge.week, day: queryAge.day } : null);
      if (age) return ka.cycle.pregnancyWeekDay(age.week, age.day);
      return ka.cycle.pregnancyModeTitle;
    }
    if (caps.showPerimenopauseTracking) {
      return ka.cycle.periModeTitle;
    }
    if (caps.showPostpartumOverview) {
      const elapsed = (postpartumQuery.data as CyclePostpartumPayload | null)?.elapsed ?? bundle?.postpartum?.elapsed;
      if (elapsed) return ka.cycle.postpartumElapsed(elapsed.week, elapsed.day);
      return ka.cycle.postpartumModeTitle;
    }
    if (suppressCycleLengthChrome(bundle)) {
      return ka.cycle.postpartumReturnGathering;
    }
    if (todayPhase.day != null) {
      return `${ka.cycle.cycleDay} ${todayPhase.day} · ${displayPhaseLabel(todayPhase.phase, todayPhase.phaseKa, {
        loggedPeriod: isBleedFlow(bundle?.logs.find((l) => l.date === today)?.flow),
      })}`;
    }
    return ka.cycle.statusLearning;
  }, [todayPhase, bundle, today, pregnancyQuery.data, postpartumQuery.data]);

  useEffect(() => {
    setCursor({ y: selectedMonth.y, m: selectedMonth.m });
  }, [selectedMonth.y, selectedMonth.m]);

  useEffect(() => {
    const serverToday = bundle?.meta?.today;
    if (!serverToday) return;
    setSelected((prev) => (prev === todayKey() ? serverToday : prev));
  }, [bundle?.meta?.today]);

  const marks = useMemo(() => {
    const dates =
      (postpartumQuery.data as CyclePostpartumPayload | null)?.classifiedDates
      || bundle?.postpartum?.classifiedDates
      || bundle?.classifiedDates
      || [];
    return mergeOwnerClassifiedPeriodOntoMarks(
      mergeFertilityMarks(bundle?.predictions?.calendar, bundle?.logs),
      dates,
    );
  }, [bundle?.predictions?.calendar, bundle?.logs, postpartumQuery.data, bundle?.postpartum]);
  const fertilityVisible = bundle ? showFertilityUi(bundle) : true;
  const modeCaps = cycleModeCapabilities(bundle?.profile.mode);
  const showPredicted = Boolean(
    bundle
    && modeCaps.showFertileEstimates
    && forecastPresentationAllowed(bundle)
    && !confidencePresentation(bundle.predictions?.confidence).hidePredictedOverlays,
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
            } catch (err) {
              setError(err instanceof Error ? err.message : ka.common.error);
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

  const lateAlert = modeCaps.showLatePeriod
    ? (bundle?.alerts ?? []).find((row) => alertPresentation(row).late)
    : undefined;

  /** §4.2.2 — exactly one contextual block: safety > mode > pattern. */
  const bleedLegend = cycleLoggedBleedLabel(bundle?.profile.mode, ka.cycle);

  const contextualBlock: 'late' | 'pregnancy' | 'ttc' | 'contraception' | 'pms' | null =
    modeCaps.showPregnancyOverview
      ? 'pregnancy'
      : modeCaps.showPostpartumOverview
      ? null
      : modeCaps.showPerimenopauseTracking
      ? showContraceptionContextCard(bundle)
        ? 'contraception'
        : null
      : lateAlert
      ? 'late'
      : modeCaps.showTtcOverview
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
            loggedBleedLabel={bleedLegend}
          />
        ) : null}

        <ScrollView
          style={{
            flex: 1,
            marginBottom:
              !daySheetOpen && !quickOpen ? insets.bottom + 84 : 0,
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
                {modeCaps.showPregnancyOverview ? (
                  <>
                    <CyclePregnancyCard
                      pregnancy={pregnancyQuery.data as CyclePregnancyPayload | null}
                      status={pregnancyQuery.status}
                      errorKind={pregnancyQuery.errorKind}
                      onRetry={() => void load()}
                      onLog={() => openQuickLog(today)}
                      onOpenWeek={() => {
                        const age = (pregnancyQuery.data as CyclePregnancyPayload | null)?.estimatedGestationalAge;
                        if (!age || (pregnancyQuery.data as CyclePregnancyPayload | null)?.reviewRequired) return;
                        router.push(`/cycle/week/${age.week}`);
                      }}
                    />
                    <CyclePregnancyTimelinePeek
                      timeline={(pregnancyQuery.data as CyclePregnancyPayload | null)?.timeline}
                      onOpen={() => router.push('/cycle/pregnancy/timeline')}
                    />
                    {modeCaps.showPregnancyCarePlanner ? (
                      <CyclePregnancyCarePlannerCard
                        summary={(pregnancyQuery.data as CyclePregnancyPayload | null)?.carePlannerSummary}
                        onOpen={() => router.push('/cycle/pregnancy/care-plan')}
                      />
                    ) : null}
                  </>
                ) : modeCaps.showPostpartumOverview ? (
                  <CyclePostpartumCard
                    postpartum={postpartumQuery.data as CyclePostpartumPayload | null}
                    status={postpartumQuery.status}
                    errorKind={postpartumQuery.errorKind}
                    onRetry={() => void load()}
                    onLog={() => openQuickLog(today)}
                  />
                ) : modeCaps.showPerimenopauseTracking ? (
                  <CyclePerimenopauseCard
                    peri={bundle.perimenopause}
                    onLog={() => openQuickLog(today)}
                  />
                ) : (
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
                )}
              </Animated.View>

              <View style={{ paddingHorizontal: 16 }}>
                <CycleSection title={ka.cycle.todaySection} delay={20}>
                  <CycleDaySummary log={todayLog} onPress={() => openQuickLog(today)} />
                </CycleSection>
              </View>

              {modeCaps.showPregnancyOverview ? (
                <View style={{ paddingHorizontal: 16 }}>
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
              ) : null}

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
                    ttcStatus={ttcQuery.status}
                    ttcErrorKind={ttcQuery.errorKind}
                    onRetryTtc={() => void load()}
                    onAction={() => {
                      openQuickLog(today);
                    }}
                  />
                </View>
              ) : null}

              {contextualBlock === 'pms' ? (
                <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
                  <CyclePmsHeatmap bundle={bundle} compact />
                </View>
              ) : null}

              {modeCaps.showClassicCycleOverview ? (
              <View style={{ paddingHorizontal: 16 }}>
                <CycleInsightsPanel
                  seed={(bundle.profile.aiInsights as never) || bundle.localInsights || null}
                  phase={suppressCycleLengthChrome(bundle) ? { ...todayPhase, day: null } : todayPhase}
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
              ) : null}
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
                loggedBleedLabel={bleedLegend}
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
                <CycleCalendarLegend
                  showFertility={fertilityVisible}
                  showPredicted={showPredicted}
                  loggedBleedLabel={bleedLegend}
                  showOwnerClassified={Boolean(
                    (postpartumQuery.data as CyclePostpartumPayload | null)?.classifiedDates?.length
                    || bundle?.postpartum?.classifiedDates?.length
                    || bundle?.classifiedDates?.length,
                  )}
                />
              </View>
            </View>
          ) : null}

          {pane === 'journal' && bundle ? (
            <CycleJournalPane
              bundle={bundle}
              canonical={cycleView?.canonical ?? null}
              ttc={ttcQuery.data as CycleTtcPayload | null}
              ttcStatus={ttcQuery.status}
              ttcErrorKind={ttcQuery.errorKind}
              pregnancy={pregnancyQuery.data as CyclePregnancyPayload | null}
              pregnancyStatus={pregnancyQuery.status}
              pregnancyErrorKind={pregnancyQuery.errorKind}
              postpartum={postpartumQuery.data as CyclePostpartumPayload | null}
              postpartumStatus={postpartumQuery.status}
              onChanged={() => void load()}
              onLogFertility={() => openQuickLog(today)}
              onClassifyPostpartumBleed={(date, classified) => setClassifyBleed({ date, classified })}
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
            if (authReady && user?.id) {
              const gen = ++ttcGen.current;
              void refreshTtc(view, user.id, gen);
            }
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
          postpartum={postpartumQuery.data as CyclePostpartumPayload | null}
          onClassifyEpisode={(date, classified) => setClassifyBleed({ date, classified })}
        />
      ) : null}

      <CyclePostpartumBleedClassifySheet
        visible={Boolean(classifyBleed)}
        date={classifyBleed?.date ?? null}
        classified={Boolean(classifyBleed?.classified)}
        onClose={() => setClassifyBleed(null)}
        onComplete={() => void load()}
      />

      <CycleTtcConflictSheet
        visible={ttcConflictOpen}
        onClose={() => setTtcConflictOpen(false)}
        onKeepTtc={() => setTtcConflictOpen(false)}
        onSwitchTrack={() => {
          setTtcConflictOpen(false);
          setTtcQuery((prev) => stopTtcQuery(prev));
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
