import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import {
  Activity,
  Brain,
  CalendarCheck,
  ClipboardCheck,
  FlaskConical,
  HeartHandshake,
  MessagesSquare,
  PawPrint,
  Scale,
  ScanFace,
  ScanLine,
  ScanSearch,
  ShoppingBag,
  Stethoscope,
  Trophy,
} from 'lucide-react-native';
import { Disclaimer } from '@/components/Disclaimer';
import { DefaultHomePrompt } from '@/components/home/DefaultHomePrompt';
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
import { HubLinkRow, HubTileGrid, type HubTile } from '@/components/home/HubTiles';
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
import { getCyclePromptSeen, type HomeLanding } from '@/lib/homeScreenPrefs';
import { todayYmd } from '@/lib/medications.shared';
import { useAuth } from '@/store/AuthContext';
import { useCommunityEntry } from '@/lib/communityAccess';
import { useThemeColors } from '@/theme/colors';
import { HUB, hubText } from '@/theme/hub';
import { ka } from '@/i18n/ka';
import { clearPendingReferralCode, readPendingReferralCode } from '@/lib/referral';
import { HYDRATION_DROP_ML } from '@/types/hydration';
import { tx } from '@/i18n/locale';

/** Four AI check-ups, one per question a person actually has. */
const CHECKUP_TILES: HubTile[] = [
  { key: 'symptoms', title: tx('სიმპტომები', 'Symptoms'), detail: tx('აღწერე, რა და სად გაწუხებს', 'Describe what bothers you and where'), href: '/symptoms', icon: Stethoscope, ink: 'teal' },
  { key: 'lab', title: tx('ლაბორატორია', 'Lab results'), detail: tx('ატვირთე ან ნახე შედეგები', 'Upload or view results'), href: '/lab', icon: FlaskConical, ink: 'blue' },
  { key: 'imaging', title: tx('გამოსახულება', 'Imaging'), detail: tx('რენტგენი, ექო, MRI', 'X-ray, ultrasound, MRI'), href: '/module/imaging', icon: ScanLine, ink: 'sky' },
  { key: 'skin', title: tx('კანი', 'Skin'), detail: tx('ფოტოს შეფასება და მოვლა', 'Photo check and care'), href: '/module/skin', icon: ScanFace, ink: 'rose' },
];

/** Everything else a person manages here, one tile each, no duplicates of the blocks above. */
const SERVICE_TILES: HubTile[] = [
  { key: 'visits', title: tx('ვიზიტები', 'Visits'), detail: tx('დაგეგმილი შეხვედრები', 'Planned appointments'), href: '/visits', icon: CalendarCheck, ink: 'teal' },
  { key: 'weight', title: tx('წონა და მიზანი', 'Weight and goal'), detail: tx('ჩანაწერები და პროგრესი', 'Entries and progress'), href: '/health-metrics/weight', icon: Scale, ink: 'violet' },
  { key: 'pets', title: tx('ჩემი ცხოველები', 'My pets'), detail: tx('მოვლა და Medi Vet', 'Care and Medi Vet'), href: '/pets', icon: PawPrint, ink: 'green' },
  { key: 'pharmacy', title: tx('აფთიაქი', 'Pharmacy'), detail: tx('პროდუქტების მოძებნა', 'Find products'), href: '/pharmacy', icon: ShoppingBag, ink: 'sky' },
  { key: 'metrics', title: tx('მაჩვენებლები', 'Metrics'), detail: tx('ყველა გაზომვა ერთად', 'All measurements in one place'), href: '/health-metrics', icon: Activity, ink: 'blue' },
  { key: 'quest', title: 'MEDI QUEST', detail: tx('მისიები, პროგრესი და ჯილდოები', 'Missions, progress and rewards'), href: '/medi-quest', icon: Trophy, ink: 'amber' },
];

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
  const hydration = useHydration();
  const steps = useStepsMetrics('1d');
  const meds = useMedications();
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState(false);
  const [showCyclePrompt, setShowCyclePrompt] = useState(false);
  const female = user?.gender === 'FEMALE';
  const completion = profileCompletion(healthProfile, user);
  const communityEntry = useCommunityEntry(user?.id, female) && isFeatureOn('community', features);
  const news = useAnnouncements();
  const stepsOn = isFeatureOn('steps', features);
  const waterOn = isFeatureOn('hydration', features);
  const medsOn = isFeatureOn('medications', features);
  // AI check-ups: each tile has its own switch (symptoms, labs, imaging, skin); deep analysis is a Medi mode.
  const checkupTiles = CHECKUP_TILES.filter((tile) => isHrefAvailable(tile.href, features));
  const deepOn = isHrefAvailable(mediRoute({ mode: 'deep' }), features);
  const serviceTiles = SERVICE_TILES.filter((tile) => isHrefAvailable(tile.href, features));

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
    if (!checkupTiles.length && !deepOn) hidden.add('checkup');
    if (!isFeatureOn('news', features)) hidden.add('news');
    // Reminders keep arriving while medications are paused; only the Home block goes.
    if (!medsOn) hidden.add('nextDose');
    if (!stepsOn && !waterOn && !showMedsRing) hidden.add('hero');
    return hidden;
  }, [features, checkupTiles.length, deepOn, medsOn, stepsOn, waterOn, showMedsRing]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      // Session (/auth/me) at most once a minute on focus; pull-to-refresh always re-reads.
      void refresh({ maxAgeMs: 60_000 }).catch(() => {});
      if (female)
        void getCyclePromptSeen()
          .then((seen) => {
            if (active) setShowCyclePrompt(!seen);
          })
          .catch(() => {});
      else setShowCyclePrompt(false);
      return () => {
        active = false;
      };
    }, [user?.id, female, refresh]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    setRefreshError(false);
    try {
      const results = await Promise.allSettled([
        refresh(),
        steps.refresh(),
        hydration.refresh(),
        meds.load(),
        news.reload(),
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
      .addLog({ date: hydration.today, ml: HYDRATION_DROP_ML, container: 'small', drink: 'water', color: '#14B8A6' })
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
      </View>
    ),
    nextDose: <HomeNextDoseSection meds={meds} />,
    coach: <HomeCoachSection />,
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
    checkup: (
      <View style={s.section}>
        {heading(tx('შემოწმება AI-სთან', 'Check with AI'))}
        {checkupTiles.length ? <HubTileGrid tiles={checkupTiles} /> : null}
        {deepOn ? <View style={{ marginTop: checkupTiles.length ? 12 : 0 }}>
          <HubFeatureCard
            tone="spotlight"
            stackLead
            accessibilityLabel={tx('ღრმა ანალიზი Medi-სთან — დაწყება', 'Start a deep analysis with Medi')}
            lead={
              <View accessible={false} importantForAccessibility="no-hide-descendants" style={s.consiliumLead}>
                {[Brain, ScanSearch, MessagesSquare].map((Icon, index) => (
                  <View key={index} style={s.consiliumTile}>
                    <Icon size={19} color="#99F6E4" strokeWidth={1.7} />
                  </View>
                ))}
              </View>
            }
            title={tx('ღრმა ანალიზი', 'Deep analysis')}
            body={tx('ერთი კითხვა — რამდენიმე სამედიცინო მიმართულების AI პასუხი და საერთო შეჯამება.', 'One question — AI answers from several medical specialties and a shared summary.')}
            cta={tx('დაიწყე განხილვა', 'Start review')}
            note={tx('AI განხილვაა, არა ექიმების კონსულტაცია.', 'This is an AI review, not a consultation with doctors.')}
            onPress={() => open(mediRoute({ mode: 'deep' }))}
          />
        </View> : null}
      </View>
    ),
    profileNudge: completion.percent < 100 ? (
      <View style={s.section}>
        <HubFeatureCard
          icon={ClipboardCheck}
          ink="teal"
          title={ka.home.completeProfileTitle(completion.percent)}
          body={ka.home.completeProfileBody}
          cta={ka.home.completeProfileCta}
          onPress={() => open('/profile/complete')}
        />
      </View>
    ) : null,
    services: (
      <View style={s.section}>
        {heading(tx('სერვისები', 'Services'), '/explore', tx('ყველა ფუნქცია', 'All features'))}
        <HubTileGrid tiles={serviceTiles} />
      </View>
    ),
    disclaimer: (
      <View style={s.section}>
        <Disclaimer />
      </View>
    ),
  };

  return (
    <>
      <ScrollView
        style={{ flex: 1, backgroundColor: c.bg100 }}
        contentContainerStyle={{
          paddingBottom: tabInset + 20,
          width: '100%',
          maxWidth: 760,
          alignSelf: 'center',
        }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.primary100} />
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
        {buildHomeSectionOrder({
          includeCycle: female,
          primaryGoal: primaryGoalFromProfile(healthProfile),
          hidden: hiddenSections,
        }).map((id) => (
          <React.Fragment key={id}>{sections[id]}</React.Fragment>
        ))}
      </ScrollView>
      <DefaultHomePrompt
        visible={showCyclePrompt}
        onClose={(landing: HomeLanding) => {
          setShowCyclePrompt(false);
          if (landing === 'cycle') router.replace('/cycle');
        }}
      />
    </>
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
