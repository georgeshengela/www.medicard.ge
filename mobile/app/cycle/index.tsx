import { CyclePressable as Pressable } from '@/components/cycle/CyclePressable';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  RefreshControl,
  ScrollView,
  Text,
  View} from 'react-native';
import { useNavigation, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInUp } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { CalendarHeart, Heart, MessageSquareText, PencilLine } from 'lucide-react-native';
import { CycleHomeHeader } from '@/components/cycle/CycleHomeHeader';
import { CycleHero } from '@/components/cycle/CycleHero';
import { CycleHeavyBleedingCard } from '@/components/cycle/CycleHeavyBleedingCard';
import { CycleSexSheet } from '@/components/cycle/CycleSexSheet';
import { CycleStoriesRow } from '@/components/cycle/CycleStoriesRow';
import { CycleStatsCard } from '@/components/cycle/CycleStatsCard';
import { CyclePeriodToast, periodToastTitle } from '@/components/cycle/CyclePeriodToast';
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
import { showHeavyBleedingCard } from '@/lib/cycleHeavyBleeding';
import { periodStartTone } from '@/lib/cycleTone';
import { parseDateKey } from '@/lib/cyclePhase';
import { cycleToday, phaseFromBundle, usedCycleLength } from '@/lib/cycleCanonical';
import { displayPhaseLabel } from '@/lib/cycleHonesty';
import { showContraceptionContextCard, showFertilityUi } from '@/lib/cycleContraception';
import { alertPresentation, confidencePresentation, mergeOwnerClassifiedPeriodOntoMarks } from '@/lib/cyclePresentation.js';
import { formFromCycleLog, isBleedFlow, persistCycleLog } from '@/lib/cycleLogSave';
import type { CycleLogForm } from '@/components/cycle/CycleLogTabs';
import { hasPmsPattern } from '@/lib/cycleAnalytics';
import { CycleOfflineBanner } from '@/components/cycle/CycleOfflineBanner';
import { getCycleReminderPrefs } from '@/lib/cycleReminderPrefs';
import { syncCycleReminders } from '@/lib/cycleReminders';
import { syncPregnancyCareReminders } from '@/lib/pregnancyCareReminders';
import {
  cacheCycleBundle,
  discardCycleMutation,
  queueApplyPeriod,
  type CycleView,
} from '@/lib/cycleOffline';
import { putCycleBundle, putCycleView, useCycleView } from '@/lib/cycleViewCache';
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
import { needsCycleOnboarding } from '@/lib/cycleExperience';
import { localAccountId } from '@/lib/localAccount';
import { CycleJourneyGuide } from '@/components/cycle/CycleJourneyGuide';

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
        marginHorizontal: 20,
        marginBottom: 10,
        backgroundColor: c.creamDeep,
        borderRadius: 16,
        padding: 3,
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
              minHeight: 38,
              paddingVertical: 6,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 13,
              backgroundColor: active ? c.card : 'transparent',
            }}
          >
            <Text
              numberOfLines={1}
              style={{
                color: active ? c.ink : c.muted,
                fontFamily: active ? 'NotoSansGeorgian_600SemiBold' : 'NotoSansGeorgian_500Medium',
                fontSize: 13,
                lineHeight: 19,
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

  const [actionError, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
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
  /** One-tap "period started" confirmation (with undo / add flow). */
  const [periodToast, setPeriodToast] = useState<string | null>(null);
  const [periodBusy, setPeriodBusy] = useState(false);
  /** Sex and sex drive have their own private sheet (separate from the daily log). */
  const [sexOpen, setSexOpen] = useState(false);
  /** One-tap sex log confirmation: holds the day's form before the tap, for undo. */
  const [sexToast, setSexToast] = useState<CycleLogForm | null>(null);
  const [sexBusy, setSexBusy] = useState(false);
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

  // Shared cached cycle view (same key as Home's cycle card): a visit shows the last view at once and
  // refreshes in the background only when stale; saves put their optimistic view into the cache.
  const viewEnabled = authReady && user?.gender === 'FEMALE' && Boolean(user?.id);
  const viewQuery = useCycleView(user?.id, viewEnabled);
  const cycleView: CycleView | null = viewEnabled ? (viewQuery.data ?? null) : null;
  const bundle: CycleBundle | null = cycleView?.display ?? null;
  const viewStamp = viewQuery.dataUpdatedAt;
  const loading = !authReady || (viewEnabled && viewQuery.data === undefined && !viewQuery.isError);
  const loadError =
    viewEnabled && !viewQuery.data && viewQuery.error
      ? viewQuery.error instanceof ApiError
        ? viewQuery.error.message
        : ka.common.error
      : null;
  const error = actionError ?? loadError;

  /** Explicit reload (pull-to-refresh, retry, after a change here): always re-reads. */
  const { refetch: refetchView } = viewQuery;
  const load = useCallback(async () => {
    setError(null);
    setRefreshing(true);
    try {
      await refetchView();
    } finally {
      setRefreshing(false);
    }
  }, [refetchView]);

  // Every new view (cache hit on mount, background refresh, a save): mode data + reminders follow it.
  useEffect(() => {
    if (!authReady) return;
    if (!user?.id) {
      setTtcQuery(emptyTtcQueryState(null));
      setPregnancyQuery(emptyPregnancyQueryState(null));
      setPostpartumQuery(emptyPostpartumQueryState(null));
      return;
    }
    if (!cycleView) return;
    const view = cycleView;
    const gen = ++ttcGen.current;
    pregnancyGen.current = gen;
    postpartumGen.current = gen;
    const userId = user.id;
    ttcQueryTrace('cycle_bundle_response', { gen, userId, t: Date.now() });
    void (async () => {
      await refreshTtc(view, userId, gen);
      await refreshPregnancy(view, userId, gen);
      await refreshPostpartum(view, userId, gen);
      if (gen !== ttcGen.current || view.stale || view.pendingCount > 0) return;
      try {
        const prefs = await getCycleReminderPrefs({ mode: view.canonical.profile.mode });
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
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewStamp, cycleView, authReady, user?.id, refreshTtc, refreshPregnancy, refreshPostpartum]);

  const lastPeriod = bundle?.profile.lastPeriodStart ?? null;
  const needsOnboarding =
    Boolean(bundle) &&
    user?.gender === 'FEMALE' &&
    needsCycleOnboarding(bundle?.profile.mode, lastPeriod, holdOnboarding);
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
      const age = bundle?.pregnancy?.age ?? (queryAge ? { week: queryAge.week, day: queryAge.day } : null);
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
    const owner = user?.id;
    if (!owner || onboardSaving) return false;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
      setSaveError(ka.cycle.pickDate);
      return false;
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
      } catch (err) {
        if (!(err instanceof ApiError) || ![404, 405].includes(err.status)) throw err;
        data = await api.cycle.updateProfile({ lastPeriodStart: iso });
      }
      if (localAccountId() !== owner) return false;
      const stamped = data?.profile?.lastPeriodStart || iso;
      const next =
        data?.predictions && data?.profile
          ? { ...data, profile: { ...data.profile, lastPeriodStart: stamped } }
          : optimistic
            ? { ...optimistic, profile: { ...optimistic.profile, lastPeriodStart: stamped } }
            : data;
      if (next) putCycleBundle(owner, next);
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
      return true;
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : ka.common.error);
      return false;
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

  /** After a save from this screen: the view goes into the shared cache; the view effect reschedules reminders. */
  const showView = (view: CycleView | null | undefined) => {
    if (view && user?.id) putCycleView(user.id, view);
  };

  /**
   * Flo-style one tap: today becomes day 1 immediately (offline-safe queue); the server projects the
   * rest of the period from the usual length. A toast offers "add flow" and "undo".
   */
  const startPeriodNow = async () => {
    if (!user?.id || periodBusy) return;
    setPeriodBusy(true);
    try {
      const result = await queueApplyPeriod(user.id, { action: 'start', date: today });
      // TTC: a new cycle is not a success to celebrate — a plain selection tick (brief §9 item 16).
      if (periodStartTone(bundle?.profile.mode).haptic === 'selection') Haptics.selectionAsync().catch(() => undefined);
      else Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      showView(result.view);
      setPeriodToast(today);
    } catch (err) {
      setError(err instanceof Error ? err.message : ka.common.error);
    } finally {
      setPeriodBusy(false);
    }
  };

  const undoPeriodStart = async (date: string) => {
    if (!user?.id) return;
    setPeriodToast(null);
    try {
      // "end" on the first day clears that one-day period again (server planEndPeriod).
      const result = await queueApplyPeriod(user.id, { action: 'end', date });
      showView(result.view);
    } catch (err) {
      setError(err instanceof Error ? err.message : ka.common.error);
    }
  };

  useEffect(() => {
    if (!periodToast) return;
    const t = setTimeout(() => setPeriodToast(null), 8000);
    return () => clearTimeout(t);
  }, [periodToast]);

  /** After any sheet save: show the fresh view (the view effect reschedules reminders and refreshes mode data). */
  const handleSaved = (view?: CycleView | null) => {
    if (view) {
      showView(view);
      return;
    }
    void load();
  };

  /** Flo-style one tap: mark sex for today, keeping everything else logged that day. */
  const logSexNow = async () => {
    if (!user?.id || sexBusy) return;
    const existing = bundle?.logs.find((l) => l.date === today);
    const before = formFromCycleLog(existing);
    if (before.sexual === true) {
      setSexOpen(true);
      return;
    }
    setSexBusy(true);
    try {
      const result = await persistCycleLog(user.id, today, { ...before, sexual: true });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      handleSaved(result.view);
      setPeriodToast(null);
      setSexToast(before);
    } catch (err) {
      setError(err instanceof Error ? err.message : ka.common.error);
    } finally {
      setSexBusy(false);
    }
  };

  const undoSex = async (before: CycleLogForm) => {
    if (!user?.id) return;
    setSexToast(null);
    try {
      const result = await persistCycleLog(user.id, today, before);
      handleSaved(result.view);
    } catch (err) {
      setError(err instanceof Error ? err.message : ka.common.error);
    }
  };

  useEffect(() => {
    if (!sexToast) return;
    const t = setTimeout(() => setSexToast(null), 8000);
    return () => clearTimeout(t);
  }, [sexToast]);

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
              showView(result.view);
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
                backgroundColor: c.accentSoft,
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
              <Text style={{ color: c.onPrimary, fontWeight: '700' }}>{ka.profile.title}</Text>
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
        onBack={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/home')}
        onChooseMode={() => router.push('/cycle/settings')}
        onFinishContraception={async ({ method, startedAt }) => {
          setOnboardSaving(true);
          setSaveError(null);
          try {
            if (method) {
              const data = await api.cycle.updateProfile({
                contraceptionMethod: method,
                contraceptionStartedAt: startedAt,
              });
              if (data?.profile && user?.id) putCycleBundle(user.id, data);
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
      {/* Status-bar spacer: the pinned week sits below it, never under the clock. */}
      <View style={{ flex: 1, paddingTop: insets.top }}>
        <ScrollView
          style={{
            flex: 1,
            marginBottom: 0,
          }}
          contentContainerStyle={{
            paddingBottom: insets.bottom + 100,
          }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={load} tintColor={c.brand} />
          }
          showsVerticalScrollIndicator={false}
          stickyHeaderIndices={[2]}
        >
          <CycleHomeHeader
            monthLabel={
              pane === 'calendar'
                ? `${MONTHS_KA[cursor.m]} ${cursor.y}`
                : `${MONTHS_KA[selectedMonth.m]} ${selectedMonth.y}`
            }
            subtitle={headerSubtitle}
            topInset={0}
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

          {/* Pinned while scrolling: only the week of days (header and tabs scroll away). */}
          <View style={{ backgroundColor: c.cream, paddingTop: bundle && pane !== 'calendar' ? 6 : 0, paddingBottom: bundle && pane !== 'calendar' ? 12 : 0 }}>
            {bundle && pane !== 'calendar' ? (
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
          </View>

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
                style={{ marginHorizontal: 20, marginBottom: 28, marginTop: 6 }}
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
                    onStart={() => void startPeriodNow()}
                    onSex={() => void logSexNow()}
                    sexLogged={todayLog?.sexualActivity === true}
                    onEnd={endPeriod}
                    onInfo={() =>
                      Alert.alert(ka.cycle.howCalculated, ka.cycle.howCalculatedBody)
                    }
                  />
                )}
              </Animated.View>

              {/* Brief §9 item 15: a calm card under the hero only while the current bleeding run is heavy (≥ 3 heavy days) or long (> 7 days). */}
              {modeCaps.showClassicCycleOverview && showHeavyBleedingCard(bundle.logs, today) ? (
                <View style={{ marginHorizontal: 20, marginBottom: 28, marginTop: -8 }}>
                  <CycleHeavyBleedingCard />
                </View>
              ) : null}

              {/* Flo order: ring → quick tiles → my cycle → today → Medi's tips. */}
              <View style={{ paddingHorizontal: 20, marginBottom: 28 }}>
                <CycleStoriesRow
                  phase={suppressCycleLengthChrome(bundle) ? null : todayPhase}
                  sexLogged={Boolean(todayLog?.sexualActivity)}
                  onLog={() => openQuickLog(today)}
                  onSex={() => setSexOpen(true)}
                  onPhase={() => Alert.alert(ka.cycle.howCalculated, ka.cycle.howCalculatedBody)}
                  onAskMedi={() => router.push('/assistant?mode=doctor' as never)}
                />
              </View>

              {modeCaps.showClassicCycleOverview && !suppressCycleLengthChrome(bundle) ? (
                <CycleStatsCard bundle={bundle} onOpen={() => router.push('/cycle/trends' as never)} />
              ) : null}

              <CycleJourneyGuide mode={bundle.profile.mode} />
              <View style={{ paddingHorizontal: 20 }}>
                <CycleSection title={ka.cycle.todaySection} delay={20}>
                  <CycleDaySummary log={todayLog} onPress={() => openQuickLog(today)} />
                </CycleSection>
              </View>

                            {modeCaps.showClassicCycleOverview ? (
              <View style={{ paddingHorizontal: 20, marginBottom: 20 }}>
                {forecastPresentationAllowed(bundle) ? <CycleInsightsPanel
                  seed={(bundle.profile.aiInsights as never) || bundle.localInsights || null}
                  phase={suppressCycleLengthChrome(bundle) ? { ...todayPhase, day: null } : todayPhase}
                  mode={bundle.profile.mode}
                  conditions={bundle.profile.conditions}
                  log={todayLog}
                  confidence={bundle.predictions?.confidence}
                  isIrregular={bundle.profile.isIrregular}
                  offline={Boolean(cycleView?.stale)}
                  variant="tips"
                /> : null}

              </View>
              ) : null}


              {modeCaps.showPregnancyOverview ? (
                <View style={{ paddingHorizontal: 20 }}>
                  <Pressable
                    onPress={() => router.push('/assistant?mode=doctor' as never)}
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
                      backgroundColor: c.accentSoft,
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
                <View style={{ paddingHorizontal: 20, marginBottom: 12 }}>
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
                <View style={{ paddingHorizontal: 20 }}>
                  <CycleContraceptionCard bundle={bundle} />
                </View>
              ) : null}

              {contextualBlock === 'ttc' ? (
                <View style={{ paddingHorizontal: 20 }}>
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
                <View style={{ paddingHorizontal: 20, marginBottom: 12 }}>
                  <CyclePmsHeatmap bundle={bundle} compact />
                </View>
              ) : null}

            </>
          ) : null}

          {pane === 'calendar' && bundle ? (
            <View style={{ paddingHorizontal: 20 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, gap: 8 }}>
                <Pressable
                  onPress={() => router.push('/cycle/periods' as never)}
                  accessibilityRole="button"
                  accessibilityLabel={ka.cycle.periodDatesEdit}
                  style={{ minHeight: 44, paddingHorizontal: 14, borderRadius: 22, backgroundColor: c.card, flexDirection: 'row', alignItems: 'center', gap: 6 }}
                >
                  <PencilLine size={15} color={c.brand} strokeWidth={2.2} />
                  <Text style={{ color: c.brand, fontSize: 13, fontFamily: 'NotoSansGeorgian_700Bold' }}>{ka.cycle.periodDatesEdit}</Text>
                </Pressable>
                {!(cursor.y === Number(today.slice(0, 4)) && cursor.m === Number(today.slice(5, 7)) - 1) ? (
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
                ) : null}
              </View>

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

      {!needsOnboarding && pane === 'calendar' && !daySheetOpen && !quickOpen ? (
        <View style={{ position: 'absolute', right: 16, bottom: insets.bottom + 18 }}>
          <CycleFab
            label={ka.cycle.logFab}
            onPress={() => openQuickLog(pane === 'calendar' ? selected : today)}
          />
        </View>
      ) : null}

      {periodToast ? (
        <CyclePeriodToast
          bottomInset={insets.bottom}
          title={periodToastTitle(bundle?.profile.mode)}
          onAddFlow={() => {
            setPeriodToast(null);
            openQuickLog(periodToast);
          }}
          onUndo={() => void undoPeriodStart(periodToast)}
        />
      ) : null}

      {sexToast ? (
        <CyclePeriodToast
          bottomInset={insets.bottom}
          title={ka.cycle.sexLoggedToast}
          hint={ka.cycle.sexLoggedToastHint}
          primaryLabel={ka.cycle.sexLoggedDetails}
          PrimaryIcon={Heart}
          onAddFlow={() => {
            setSexToast(null);
            setSexOpen(true);
          }}
          onUndo={() => void undoSex(sexToast)}
        />
      ) : null}

      <CycleSexSheet visible={sexOpen} date={today} onClose={() => setSexOpen(false)} onSaved={handleSaved} />

      <CycleQuickLogSheet
        visible={quickOpen}
        date={selected}
        onClose={() => {
          setQuickOpen(false);
          setStartIntent(false);
        }}
        onSaved={handleSaved}
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
              if (data?.profile && user?.id) putCycleBundle(user.id, data);
            })
            .catch(() => undefined);
        }}
      />
    </CycleAtmosphere>
  );
}
