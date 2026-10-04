import { brandHex } from '@/theme/brandTone';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LockableScrollView } from '@/components/ui/LockableScrollView';
import { useFocusEffect, useRouter } from 'expo-router';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import {
  Brain,
  CalendarCheck,
  ClipboardCheck,
  HeartHandshake,
  MessagesSquare,
  ScanSearch,
  Trophy,
} from 'lucide-react-native';
import { Disclaimer } from '@/components/Disclaimer';
import { HomeAskMedi } from '@/components/home/HomeAskMedi';
import { HomeCyclePreviewCard } from '@/components/home/HomeCyclePreviewCard';
import { MedicalSourcesLink } from '@/components/health/MedicalSourcesLink';
import { HomeNewsSection } from '@/components/home/HomeNewsSection';
import { useAnnouncements } from '@/hooks/useAnnouncements';
import { isFeatureOn, isHrefAvailable, useFeatureState } from '@/lib/featureFlags';
import type { HomeSectionId } from '@/lib/home/homeSectionOrder';
import { HubFeatureCard } from '@/components/home/HubFeatureCard';
import { HubLinkRow } from '@/components/home/HubTiles';
import { HomeHeader } from '@/components/home/HomeHeader';
import { HomeNextDoseSection } from '@/components/home/HomeNextDoseSection';
import { HomeSectionHeading } from '@/components/home/HomeSectionHeading';
import { HomeCoachSection } from '@/components/coach/CoachEntry';
import { useTabBarInset } from '@/components/navigation/FloatingTabBar';
import { normalizeAvatarForGender } from '@/constants/avatarAssets';
import { useHydration } from '@/hooks/useHydration';
import { useMedications } from '@/hooks/useMedications';
import { useStepsMetrics } from '@/hooks/useStepsMetrics';
import { formatYmd } from '@/lib/format';
import { requestHealthRefresh } from '@/lib/healthDataSync';
import { buildHomeSectionOrder } from '@/lib/home/homeSectionOrder';
import { primaryGoalFromProfile } from '@/lib/assessmentForm';
import { profileCompletion } from '@/lib/profileCompletion';
import { mediRoute } from '@/lib/mediModes';
import { computeTodayDoses } from '@/lib/home/todayDoses';
import { todayYmd } from '@/lib/medications.shared';
import { useAuth } from '@/store/AuthContext';
import { useCommunityEntry } from '@/lib/communityAccess';
import { HomeCommunitySection } from '@/components/home/sections/HomeCommunitySection';
import { HomeScanSection } from '@/components/home/sections/HomeScanSection';
import { useThemeColors } from '@/theme/colors';
import { HUB, hubText } from '@/theme/hub';
import { ka } from '@/i18n/ka';
import { clearPendingReferralCode, readPendingReferralCode } from '@/lib/referral';
import { HYDRATION_DROP_ML } from '@/types/hydration';
import { useNutritionDashboard } from '@/components/nutrition/ProgramUI';
import { HomeCustomizeRow, HomeLayoutOfferCard, HomeWash } from '@/components/home/layout/HomeLayoutChrome';
import { HomeLayoutPicker } from '@/components/home/layout/HomeLayoutPicker';
import { ModulesSheet } from '@/components/home/ModulesSheet';
import { HomeDayPair } from '@/components/home/sections/HomeDayPair';
import { HomeNutritionLite } from '@/components/home/sections/HomeNutritionLite';
import { HomeEnergyCard } from '@/components/home/sections/HomeEnergyCard';
import { HomeCycleHero, HomeCycleToastHost } from '@/components/home/sections/HomeCycleHero';
import { HomeCycleTips } from '@/components/home/sections/HomeCycleTips';
import { HomeCycleAhead } from '@/components/home/sections/HomeCycleAhead';
import { HomeAskChips } from '@/components/home/sections/HomeAskChips';
import { HomeTodayHero, type TodayDial } from '@/components/home/sections/HomeTodayHero';
import { HomeAttention } from '@/components/home/sections/HomeAttention';
import { HomeWeekSteps } from '@/components/home/sections/HomeWeekSteps';
import { HomeChallenges } from '@/components/home/sections/HomeChallenges';
import { todayAnswer } from '@/lib/home/todayAnswer';
import { invalidate } from '@/lib/queryClient';
import { peekCycleView } from '@/lib/cycleViewCache';
import { HomeCycleStats } from '@/components/home/sections/HomeCycleStats';
import { HomeMoveHero } from '@/components/home/sections/HomeMoveHero';
import { HomeWaterOutdoor } from '@/components/home/sections/HomeWaterOutdoor';
import { HomeMedirunCard } from '@/components/home/sections/HomeMedirunCard';
import { HomeQuestCard } from '@/components/home/sections/HomeQuestCard';
import { refreshActiveHomeData } from '@/hooks/useHomeActive';
import { HomeQuickLog } from '@/components/home/sections/HomeQuickLog';
import { HomeWeightProgress } from '@/components/home/sections/HomeWeightProgress';
import { HomeMealsCard } from '@/components/home/sections/HomeMealsCard';
import { HomeNutritionTools } from '@/components/home/sections/HomeNutritionTools';
import { useHomeLayout } from '@/hooks/useHomeLayout';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { useCycleView } from '@/lib/cycleViewCache';
import { trackHomeLayoutChanged, trackHomeLayoutOfferAnswered } from '@/lib/funnel';
import { chooseHomeLayout } from '@/lib/home/homeLayoutStore';
import { HomeAccentContext, homeAccentFor } from '@/theme/homeAccent';
import { useIsDark } from '@/theme/colors';
import { tx } from '@/i18n/locale';



/** "4 200" — Hermes has no ka-GE grouping, so group by hand. */
const groupDigits = (n: number) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
const liters = (ml: number) => (ml / 1000).toFixed(1);

export default function Home() {
  const { user, healthProfile, refresh } = useAuth();
  const router = useRouter();
  const c = useThemeColors();

  const features = useFeatureState();
  const invitesOn = isFeatureOn('invites', features);
  // An invite link opened before sign-up: offer the code once, while the account is new.
  // While invites are paused the code stays saved, so it is offered once they are back.
  const userId = user?.id;
  const userCreatedAt = user?.createdAt;
  useEffect(() => {
    if (!userId || !invitesOn) return;
    let live = true;
    void readPendingReferralCode().then(async (code) => {
      if (!code || !live) return;
      await clearPendingReferralCode();
      const ageDays = userCreatedAt ? (Date.now() - new Date(userCreatedAt).getTime()) / 86400000 : Infinity;
      if (live && ageDays <= 14) router.push(`/profile/invite-code?code=${code}` as never);
    });
    return () => {
      live = false;
    };
  }, [router, userId, userCreatedAt, invitesOn]);
  const insets = useSafeAreaInsets();
  const tabInset = useTabBarInset(20);
  const dark = useIsDark();
  const reduceMotion = usePrefersReducedMotion();
  // Which Home (women's / active / nutrition & weight / standard): synchronous on the first frame.
  const { layout, offer, cycleLocked } = useHomeLayout();
  const accent = useMemo(() => homeAccentFor(layout, dark, c), [layout, dark, c]);
  const layoutsOn = isFeatureOn('homeLayouts', features);
  const stepsOn = isFeatureOn('steps', features);
  const waterOn = isFeatureOn('hydration', features);
  const medsOn = isFeatureOn('medications', features);
  const nutritionOn = isFeatureOn('nutrition', features);
  const cycleOn = isFeatureOn('cycle', features);
  const female = user?.gender === 'FEMALE';
  // One subscriber per query key on Home: shared data lives here and is handed to the sections.
  const hydration = useHydration({ enabled: waterOn });
  const steps = useStepsMetrics('1d', { enabled: stepsOn });
  const meds = useMedications();
  // Every layout shows MEDIFOOD from this one shared dashboard read (standard too since 2026-10-04).
  const nutrition = useNutritionDashboard({ enabled: nutritionOn });
  const cycleQuery = useCycleView(user?.id, layout === 'women' && female && cycleOn && cycleLocked === false);
  const cycle = {
    view: cycleQuery.data ?? null,
    loading: !cycleQuery.data && cycleQuery.fetchStatus !== 'idle',
    failed: !cycleQuery.data && Boolean(cycleQuery.error),
    retry: () => void cycleQuery.refetch(),
  };
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState(false);
  const [picker, setPicker] = useState<'home_header' | 'home_footer' | 'offer' | null>(null);
  const [modulesOpen, setModulesOpen] = useState(false);
  const [offerConfirm, setOfferConfirm] = useState(false);
  const completion = profileCompletion(healthProfile, user);
  const communityEntry = useCommunityEntry(user?.id, female) && isFeatureOn('community', features);
  const news = useAnnouncements();
  // AI check-ups: each tile has its own switch (symptoms, labs, imaging, skin); deep analysis is a Medi mode.
  // MEDISCAN stands for three switches (lab, imaging, skin): each choice shows while its switch is on.
  const scanKinds = (
    [
      ['labs', 'LAB'],
      ['imaging', 'IMAGING'],
      ['skin', 'SKIN'],
    ] as const
  )
    .filter(([key]) => isFeatureOn(key, features))
    .map(([, kind]) => kind);
  const symptomsOn = isHrefAvailable('/symptoms', features);
  const checkupOn = scanKinds.length > 0 || symptomsOn;
  // Question chips under „ჰკითხე Medi-ს“ on every layout (its own set each) open the consultation with
  // the question typed in; nothing is sent until the person presses send.
  const askChips = isHrefAvailable(mediRoute({ mode: 'doctor' }), features);
  // Women's Home keeps today's food inside „შენი დღე“ (under steps and water) when that block shows.
  const foodInDay = layout === 'women' && nutritionOn && (stepsOn || waterOn);

  const today = todayYmd();
  const doses = useMemo(
    () => computeTodayDoses(meds.medications, meds.schedule, meds.doseLogs, today),
    [meds.medications, meds.schedule, meds.doseLogs, today],
  );
  const showMedsRing = medsOn && doses.total > 0;

  // Sections of modules an admin paused (admin „მოდულები“) are left out entirely.
  const hiddenSections = useMemo(() => {
    const hidden = new Set<HomeSectionId>();
    if (!isFeatureOn('cycle', features)) hidden.add('cycle');
    if (!isFeatureOn('nutrition', features)) hidden.add('nutrition');
    if (!isFeatureOn('coach', features)) hidden.add('coach');
    if (!isFeatureOn('medi', features)) {
      hidden.add('ask');
      hidden.add('checkup');
    }
    if (!checkupOn) hidden.add('checkup');
    if (!isFeatureOn('news', features)) hidden.add('news');
    // Reminders keep arriving while medications are paused; only the Home block goes.
    if (!medsOn) hidden.add('nextDose');
    if (!stepsOn && !waterOn && !showMedsRing) hidden.add('hero');
    // Layout sections follow the same switches as the modules they summarise.
    if (!cycleOn) (['cycleHero', 'cycleAhead', 'cycleTips', 'cycleStats'] as const).forEach((id) => hidden.add(id));
    if (!isFeatureOn('medi', features) || !checkupOn) hidden.add('womenCare');
    if (foodInDay) hidden.add('nutritionLite');
    if (!stepsOn && !waterOn) {
      hidden.add('dayPair');
      hidden.add('waterSteps');
    }
    if (!stepsOn) hidden.add('moveHero');
    if (!waterOn && !isFeatureOn('weather', features)) hidden.add('waterOutdoor');
    if (!isFeatureOn('medirun', features)) hidden.add('medirun');
    if (!isFeatureOn('quest', features)) hidden.add('quest');
    if (!nutritionOn) (['nutritionLite', 'energy', 'quickLog', 'meals', 'nutritionTools'] as const).forEach((id) => hidden.add(id));
    if (!isFeatureOn('weight', features)) hidden.add('weightProgress');
    if (!layoutsOn) hidden.add('customize');
    if (!stepsOn) hidden.add('week');
    if (!isFeatureOn('medirun', features) && !isFeatureOn('quest', features)) hidden.add('challenges');
    if (!isHrefAvailable('/visits', features) && !isHrefAvailable('/lab', features)) hidden.add('attention');
    return hidden;
  }, [features, checkupOn, medsOn, stepsOn, waterOn, showMedsRing, cycleOn, nutritionOn, layoutsOn, foodInDay]);

  // A new layout starts at its top, with a short fade (none under reduced motion).
  const scrollRef = useRef<ScrollView>(null);
  const fade = useSharedValue(1);
  const shownLayout = useRef(layout);
  useLayoutEffect(() => {
    if (shownLayout.current === layout) return;
    shownLayout.current = layout;
    scrollRef.current?.scrollTo({ y: 0, animated: false });
    if (reduceMotion) return;
    fade.value = 0;
    fade.value = withTiming(1, { duration: 180, easing: Easing.out(Easing.cubic) });
  }, [layout, reduceMotion, fade]);
  const fadeStyle = useAnimatedStyle(() => ({ opacity: fade.value }));

  // The confirmation after trying the women's Home stays a few seconds, never past leaving Home.
  useEffect(() => {
    if (!offerConfirm) return undefined;
    const timer = setTimeout(() => setOfferConfirm(false), 6000);
    return () => clearTimeout(timer);
  }, [offerConfirm]);
  const answerOffer = {
    onTry: () => {
      void Haptics.selectionAsync().catch(() => undefined);
      chooseHomeLayout('women', { offerDone: true });
      trackHomeLayoutOfferAnswered('tried');
      trackHomeLayoutChanged('women', layout, 'offer');
      setOfferConfirm(true);
    },
    onDismiss: () => {
      chooseHomeLayout(null, { offerDone: true });
      trackHomeLayoutOfferAnswered('dismissed');
    },
    onBrowse: () => {
      chooseHomeLayout(null, { offerDone: true });
      trackHomeLayoutOfferAnswered('other');
      setPicker('offer');
    },
    onUndo: () => {
      chooseHomeLayout('standard', { offerDone: true });
      trackHomeLayoutChanged('standard', 'women', 'offer');
      setOfferConfirm(false);
    },
  };

  useFocusEffect(
    useCallback(() => {
      // Session (/auth/me) at most once a minute on focus; pull-to-refresh always re-reads.
      void refresh({ maxAgeMs: 60_000 }).catch(() => {});
      return () => {
        setOfferConfirm(false);
      };
    }, [refresh]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    setRefreshError(false);
    try {
      const results = await Promise.allSettled([
        refresh(),
        stepsOn ? steps.refresh() : Promise.resolve(),
        waterOn ? hydration.refresh() : Promise.resolve(),
        meds.load(),
        news.reload(),
        // Layout-only data refreshes only where that layout shows it (active queries only).
        nutritionOn ? nutrition.load() : Promise.resolve(),
        layout === 'standard' ? Promise.allSettled([refreshActiveHomeData(), invalidate('visits', 'home')]) : Promise.resolve(),
        layout === 'women' && cycleQuery.isEnabled ? cycleQuery.refetch() : Promise.resolve(),
        layout === 'active' ? refreshActiveHomeData() : Promise.resolve(),
      ]);
      setRefreshError(results.some((result) => result.status === 'rejected'));
      requestHealthRefresh();
    } finally {
      setRefreshing(false);
    }
  };

  const open = (href: string) => router.push(href as never);
  const extra = healthProfile?.extraAnswers as Record<string, unknown> | undefined;
  const avatar = normalizeAvatarForGender(
    typeof extra?.avatarId === 'string' ? extra.avatarId : null,
    user?.gender ?? null,
  );
  const firstName = user?.fullName?.split(' ')[0] ?? '';

  const addGlass = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    void hydration
      .addLog({ date: hydration.today, ml: HYDRATION_DROP_ML, container: 'small', drink: 'water', color: brandHex('#14B8A6') })
      .catch(() => undefined);
  }, [hydration]);

  const stepsTotal = steps.bundle?.todayTotal ?? 0;
  const stepsGoal = steps.bundle?.goal ?? 0;
  // Standard Home „დღეს“ (2026-10-04): the dials and the one answer; a paused module's dial leaves the row.
  const stepsBundle = steps.bundle;
  // Nothing connected and nothing counted: the dial offers to connect instead of showing a lonely 0.
  const stepsLinked = Boolean(stepsBundle && (stepsBundle.connected || stepsTotal > 0));
  const dials: TodayDial[] = [];
  if (stepsOn) {
    dials.push({
      key: 'steps',
      progress: stepsGoal > 0 ? stepsTotal / stepsGoal : 0,
      value: steps.loading && !stepsBundle ? '…' : stepsLinked ? groupDigits(stepsTotal) : '—',
      label: stepsLinked ? (stepsGoal > 0 ? tx(`${groupDigits(stepsGoal)}-დან`, `of ${groupDigits(stepsGoal)}`) : tx('ნაბიჯი', 'steps')) : tx('დაკავშირება', 'Connect'),
      a11y: stepsLinked
        ? tx(`ნაბიჯები: ${groupDigits(stepsTotal)}${stepsGoal > 0 ? `, მიზანი ${groupDigits(stepsGoal)}` : ''}`, `Steps: ${groupDigits(stepsTotal)}${stepsGoal > 0 ? `, goal ${groupDigits(stepsGoal)}` : ''}`)
        : tx('ნაბიჯების დაკავშირება', 'Connect steps'),
      onPress: () => open('/health-metrics/steps'),
    });
  }
  if (waterOn) {
    dials.push({
      key: 'water',
      progress: hydration.progress,
      value: hydration.loading ? '…' : tx(`${liters(hydration.todayMl)} ლ`, `${liters(hydration.todayMl)} L`),
      label: tx(`${liters(hydration.goalMl)} ლ-დან`, `of ${liters(hydration.goalMl)} L`),
      a11y: tx(`წყალი: ${liters(hydration.todayMl)} ლიტრი ${liters(hydration.goalMl)}-დან`, `Water: ${liters(hydration.todayMl)} of ${liters(hydration.goalMl)} litres`),
      onPress: () => open('/health-metrics/hydration'),
    });
  }
  if (showMedsRing) {
    dials.push({
      key: 'meds',
      progress: doses.taken / doses.total,
      value: `${doses.taken} / ${doses.total}`,
      label: tx('დოზა დღეს', 'doses today'),
      a11y: tx(`წამლები: ${doses.taken} მიღებული ${doses.total}-დან`, `Medicines: ${doses.taken} of ${doses.total} taken`),
      onPress: () => open('/(tabs)/medications'),
    });
  }
  const answer = todayAnswer({
    pendingDoses: medsOn
      ? doses.pending.map((dose) => ({ time: dose.time, name: meds.medications.find((m) => m.id === dose.medicationId)?.medName ?? tx('წამალი', 'Medicine') }))
      : [],
    steps: stepsOn && stepsLinked && stepsGoal > 0 ? { total: stepsTotal, goal: stepsGoal } : null,
    water: waterOn && !hydration.loading ? { ml: hydration.todayMl, goalMl: hydration.goalMl } : null,
    now: new Date(),
  });

  const heading = (title: string, href?: string, linkLabel = tx('ყველას ნახვა', 'See all')) => (
    <HomeSectionHeading title={title} linkLabel={href ? linkLabel : undefined} onLink={href ? () => open(href) : undefined} />
  );

  const sections = {
    dashboard: (
      <View style={{ paddingTop: insets.top + 14 }}>
        <HomeHeader
          firstName={firstName}
          initial={user?.fullName?.slice(0, 1) || 'M'}
          avatarId={avatar}
          streak={user?.currentStreak ?? 0}
          // Day and month only: the year never changes the day, and the row stays on one line.
          dateLabel={formatYmd(todayYmd())}
          onModules={() => setModulesOpen(true)}
        />
      </View>
    ),
    // Standard „დღეს“ (owner 2026-10-04, built for men first): one answer, the day's dials, one-tap actions.
    hero: (
      <>
        <HomeTodayHero answer={answer} dials={dials} onAddWater={waterOn ? addGlass : undefined} onWeightSaved={() => void nutrition.load()} />
        {stepsOn || waterOn ? (
          <View style={{ paddingHorizontal: HUB.gutter }}>
            <MedicalSourcesLink sourceIds={[...(stepsOn ? ['dailySteps' as const] : []), ...(waterOn ? ['waterIntake' as const] : [])]} />
          </View>
        ) : null}
      </>
    ),
    ask: (
      <View style={[s.section, { marginTop: 12 }]}>
        <HomeAskMedi onPress={() => open('/assistant')} />
        {askChips ? <HomeAskChips set={layout === 'women' ? 'cycle' : layout} community={layout === 'women' && communityEntry} /> : null}
      </View>
    ),
    nextDose: <HomeNextDoseSection meds={meds} />,
    // Standard's one spotlight is MEDISCAN, so the trainer card stays a surface card there too.
    coach: <HomeCoachSection tone={layout === 'women' ? 'spotlight' : 'surface'} />,
    attention: <HomeAttention />,
    week: <HomeWeekSteps todayTotal={stepsTotal} goal={stepsGoal} fetchedAt={stepsBundle?.fetchedAt ?? null} />,
    challenges: <HomeChallenges />,
    cycle: (
      <View style={s.section}>
        {heading(tx('ქალის ჯანმრთელობა', "Women's health"), '/cycle', tx('ციკლის ნახვა', 'View cycle'))}
        <HomeCyclePreviewCard onPress={() => open('/cycle')} />
        {communityEntry ? <HubLinkRow
          icon={HeartHandshake}
          ink="rose"
          title={tx('ქალების სივრცე', "Women's space")}
          detail={tx('ჰკითხე, გაუზიარე და იპოვე მხარდაჭერა', 'Ask, share and find support')}
          href="/community"
          style={{ marginTop: 10 }}
        /> : null}
      </View>
    ),
    news: <HomeNewsSection items={news.items} onDismiss={news.dismiss} />,
    // MEDIFOOD hub card (calories + weight with „აწონვა“), the same one the women's Home uses.
    nutrition: (
      <HomeNutritionLite
        nutrition={nutrition}
        hub={{ pregnant: female && peekCycleView()?.display?.profile.mode === 'PREGNANCY' }}
      />
    ),
    // MEDISCAN (owner 2026-10-04): its own hero card with the three choices; symptoms as a row under it.
    checkup: <HomeScanSection kinds={scanKinds} symptomsOn={symptomsOn} />,
    profileNudge: completion.percent < 100 ? (
      <View style={s.section}>
        <HubFeatureCard
          icon={ClipboardCheck}
          ink={layout === 'women' ? 'rose' : 'teal'}
          title={ka.home.completeProfileTitle(completion.percent)}
          body={ka.home.completeProfileBody}
          cta={ka.home.completeProfileCta}
          onPress={() => open('/profile/complete')}
        />
      </View>
    ) : null,
    disclaimer: (
      <View style={s.section}>
        <Disclaimer />
      </View>
    ),
    // ---- shared by the layouts ----
    layoutOffer: (
      <HomeLayoutOfferCard
        confirmed={offerConfirm}
        onTry={answerOffer.onTry}
        onDismiss={answerOffer.onDismiss}
        onBrowse={answerOffer.onBrowse}
        onUndo={answerOffer.onUndo}
      />
    ),
    customize: <HomeCustomizeRow layout={layout} onPress={() => setPicker('home_footer')} />,
    nutritionLite: <HomeNutritionLite nutrition={nutrition} />,
    dayPair: (
      <HomeDayPair
        steps={steps}
        hydration={hydration}
        onAddWater={addGlass}
        stepsOn={stepsOn}
        waterOn={waterOn}
        title={tx('შენი დღე', 'Your day')}
        linkLabel={tx('ყველა მაჩვენებელი', 'All metrics')}
        linkHref="/health-metrics"
        look={layout === 'women' ? 'rings' : 'bars'}
      >
        {foodInDay ? (
          <HomeNutritionLite
            nutrition={nutrition}
            bare
            hub={layout === 'women' ? { pregnant: cycle.view?.display?.profile.mode === 'PREGNANCY' } : undefined}
          />
        ) : null}
      </HomeDayPair>
    ),
    waterSteps: (
      <HomeDayPair
        steps={steps}
        hydration={hydration}
        onAddWater={addGlass}
        stepsOn={stepsOn}
        waterOn={waterOn}
        title={tx('წყალი და ნაბიჯები', 'Water and steps')}
        linkLabel={tx('მაჩვენებლები', 'Metrics')}
        linkHref="/health-metrics"
      />
    ),
    // ---- women ----
    cycleHero: <HomeCycleHero cycle={cycle} locked={cycleLocked} userId={user?.id} first />,
    cycleAhead: <HomeCycleAhead cycle={cycle} locked={cycleLocked} />,
    cycleTips: <HomeCycleTips cycle={cycle} locked={cycleLocked} />,
    womenCare: <HomeScanSection kinds={scanKinds} symptomsOn={symptomsOn} />,
    // The space has its own section on this layout now (`community`), so the stats card drops its link row.
    cycleStats: <HomeCycleStats cycle={cycle} locked={cycleLocked} showCommunity={false} />,
    community: <HomeCommunitySection visible={communityEntry} pregnant={cycle.view?.display?.profile.mode === 'PREGNANCY'} />,
    // ---- active ----
    moveHero: <HomeMoveHero steps={steps} first />,
    waterOutdoor: <HomeWaterOutdoor hydration={hydration} onAddWater={addGlass} />,
    medirun: <HomeMedirunCard />,
    quest: <HomeQuestCard />,
    // ---- nutrition & weight ----
    energy: <HomeEnergyCard nutrition={nutrition} first />,
    quickLog: <HomeQuickLog />,
    weightProgress: <HomeWeightProgress nutrition={nutrition} />,
    meals: <HomeMealsCard nutrition={nutrition} />,
    nutritionTools: <HomeNutritionTools nutrition={nutrition} />,
  } satisfies Record<HomeSectionId, React.ReactNode>;

  return (
    <HomeAccentContext.Provider value={accent}>
      <LockableScrollView
        ref={scrollRef}
        style={{ flex: 1, backgroundColor: c.bg100 }}
        contentContainerStyle={{
          paddingBottom: tabInset + 20,
          width: '100%',
          maxWidth: 760,
          alignSelf: 'center',
        }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={accent.ink} />
        }
        showsVerticalScrollIndicator={false}
      >
        {refreshError ? (
          <Text
            accessibilityRole="alert"
            style={[s.caption, { paddingHorizontal: 20, color: c.danger, paddingTop: insets.top }]}
          >
            {tx('განახლება ვერ დასრულდა. ხელახლა ჩამოწიე გვერდი.', "Couldn't refresh. Pull down to try again.")}
          </Text>
        ) : null}
        <HomeWash topInset={insets.top} />
        <Animated.View style={fadeStyle}>
          {buildHomeSectionOrder({
            layout,
            includeCycle: female,
            primaryGoal: primaryGoalFromProfile(healthProfile),
            hidden: hiddenSections,
            offer: offer || offerConfirm,
          }).map((id) => (
            <React.Fragment key={id}>{sections[id]}</React.Fragment>
          ))}
        </Animated.View>
      </LockableScrollView>
      {layout === 'women' ? <HomeCycleToastHost /> : null}
      {layoutsOn ? (
        <HomeLayoutPicker visible={picker !== null} onClose={() => setPicker(null)} source={picker ?? 'home_header'} />
      ) : null}
      <ModulesSheet
        visible={modulesOpen}
        onClose={() => setModulesOpen(false)}
        // iOS cannot present a modal while another one is still fading out.
        onCustomize={layoutsOn ? () => setTimeout(() => setPicker('home_header'), 350) : undefined}
      />
    </HomeAccentContext.Provider>
  );
}

const s = StyleSheet.create({
  section: { paddingHorizontal: HUB.gutter, marginTop: HUB.sectionGap },
  caption: hubText.caption,
  consiliumLead: { flexDirection: 'row', gap: 6 },
  consiliumTile: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
});
