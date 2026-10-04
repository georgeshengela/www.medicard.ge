import { brandHex } from '@/theme/brandTone';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
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
import { HomeDayRings, type DayRing } from '@/components/home/HomeDayRings';
import { MedicalSourcesLink } from '@/components/health/MedicalSourcesLink';
import { HomeNutritionCard } from '@/components/home/HomeNutritionCard';
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
import { formatDayMonthYearKa } from '@/lib/format';
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
import { HomeDayPair } from '@/components/home/sections/HomeDayPair';
import { HomeNutritionLite } from '@/components/home/sections/HomeNutritionLite';
import { HomeEnergyCard } from '@/components/home/sections/HomeEnergyCard';
import { HomeCycleHero, HomeCycleToastHost } from '@/components/home/sections/HomeCycleHero';
import { HomeCycleTips } from '@/components/home/sections/HomeCycleTips';
import { HomeCycleAhead } from '@/components/home/sections/HomeCycleAhead';
import { HomeAskChips } from '@/components/home/sections/HomeAskChips';
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
  // The standard nutrition card reads the dashboard itself; the other layouts share this one.
  const nutrition = useNutritionDashboard({ enabled: nutritionOn && layout !== 'standard' });
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
  // Women's Home: question chips under „ჰკითხე Medi-ს“ open the consultation with the question typed in.
  const askChips = layout === 'women' && isHrefAvailable(mediRoute({ mode: 'doctor' }), features);
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
        layout !== 'standard' && nutritionOn ? nutrition.load() : Promise.resolve(),
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
  // A paused module's ring (and the quick „add a glass“) leaves the card; the rest close up.
  const rings: DayRing[] = [];
  if (stepsOn) {
    rings.push({
      key: 'steps',
      progress: stepsGoal > 0 ? stepsTotal / stepsGoal : 0,
      label: tx('ნაბიჯი', 'Steps'),
      value: steps.loading && !steps.bundle ? '…' : steps.bundle ? tx(`${groupDigits(stepsTotal)} ნაბიჯი`, `${groupDigits(stepsTotal)} ${stepsTotal === 1 ? 'step' : 'steps'}`) : tx('ნაბიჯები', 'Steps'),
      hint: stepsGoal > 0 ? tx(`მიზანი ${groupDigits(stepsGoal)}`, `Goal ${groupDigits(stepsGoal)}`) : tx('დააკავშირე მოწყობილობა', 'Connect a device'),
      onPress: () => open('/health-metrics/steps'),
    });
  }
  if (waterOn) {
    rings.push({
      key: 'water',
      progress: hydration.progress,
      label: tx('წყალი', 'Water'),
      value: hydration.loading ? '…' : `${liters(hydration.todayMl)} / ${liters(hydration.goalMl)} ${tx('ლ', 'L')}`,
      hint: hydration.loading ? undefined : hydration.remainingMl > 0 ? tx(`დარჩა ${liters(hydration.remainingMl)} ლ`, `${liters(hydration.remainingMl)} L to go`) : tx('მიზანი შესრულდა', 'Goal reached'),
      onPress: () => open('/health-metrics/hydration'),
      onQuickAdd: addGlass,
      quickAddLabel: tx(`წყლის დამატება, ${HYDRATION_DROP_ML} მლ`, `Add water, ${HYDRATION_DROP_ML} ml`),
    });
  }
  if (showMedsRing) {
    rings.push({
      key: 'meds',
      progress: doses.taken / doses.total,
      label: tx('წამლები', 'Medications'),
      value: tx(`${doses.taken} / ${doses.total} მიღებული`, `${doses.taken} / ${doses.total} taken`),
      hint: doses.pending[0] ? tx(`შემდეგი ${doses.pending[0].time}`, `Next ${doses.pending[0].time}`) : tx('ყველა მიღებულია', 'All taken'),
      onPress: () => open('/(tabs)/medications'),
    });
  }

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
          dateLabel={formatDayMonthYearKa()}
          onCustomize={layoutsOn ? () => setPicker('home_header') : undefined}
        />
      </View>
    ),
    hero: (
      <View style={[s.section, { marginTop: 22 }]}>
        {heading(tx('შენი დღე', 'Your day'), '/health-metrics', tx('ყველა მაჩვენებელი', 'All metrics'))}
        <HomeDayRings rings={rings} />
        {stepsOn || waterOn ? (
          <MedicalSourcesLink sourceIds={[...(stepsOn ? ['dailySteps' as const] : []), ...(waterOn ? ['waterIntake' as const] : [])]} />
        ) : null}
      </View>
    ),
    ask: (
      <View style={[s.section, { marginTop: 12 }]}>
        <HomeAskMedi onPress={() => open('/assistant')} />
        {askChips ? <HomeAskChips community={communityEntry} /> : null}
      </View>
    ),
    nextDose: <HomeNextDoseSection meds={meds} />,
    coach: <HomeCoachSection tone={layout === 'active' || layout === 'weight' ? 'surface' : 'spotlight'} />,
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
    nutrition: (
      <View style={s.section}>
        {heading(tx('კვება', 'Nutrition'), '/nutrition', tx('ყველა', 'All'))}
        <HomeNutritionCard />
      </View>
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
      <ScrollView
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
      </ScrollView>
      {layout === 'women' ? <HomeCycleToastHost /> : null}
      {layoutsOn ? (
        <HomeLayoutPicker visible={picker !== null} onClose={() => setPicker(null)} source={picker ?? 'home_header'} />
      ) : null}
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
