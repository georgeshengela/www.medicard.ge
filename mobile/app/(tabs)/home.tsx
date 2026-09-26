import React, { useCallback, useMemo, useState } from 'react';
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
  CalendarCheck,
  FlaskConical,
  HeartHandshake,
  PawPrint,
  Scale,
  ScanFace,
  ScanLine,
  ShoppingBag,
  Stethoscope,
  Trophy,
  Users,
} from 'lucide-react-native';
import { Disclaimer } from '@/components/Disclaimer';
import { DefaultHomePrompt } from '@/components/home/DefaultHomePrompt';
import { HomeAskMedi } from '@/components/home/HomeAskMedi';
import { HomeCyclePreviewCard } from '@/components/home/HomeCyclePreviewCard';
import { HomeDayRings, type DayRing } from '@/components/home/HomeDayRings';
import { HomeNutritionCard } from '@/components/home/HomeNutritionCard';
import { HubLinkRow, HubTileGrid, type HubTile } from '@/components/home/HubTiles';
import { HomeHeader } from '@/components/home/HomeHeader';
import { HomeNextDoseSection } from '@/components/home/HomeNextDoseSection';
import { HomeSectionHeading } from '@/components/home/HomeSectionHeading';
import { useTabBarInset } from '@/components/navigation/FloatingTabBar';
import { normalizeAvatarForGender } from '@/constants/avatarAssets';
import { useHydration } from '@/hooks/useHydration';
import { useMedications } from '@/hooks/useMedications';
import { useStepsMetrics } from '@/hooks/useStepsMetrics';
import { formatDayMonthYearKa } from '@/lib/format';
import { requestHealthRefresh } from '@/lib/healthDataSync';
import { buildHomeSectionOrder } from '@/lib/home/homeSectionOrder';
import { computeTodayDoses } from '@/lib/home/todayDoses';
import { getCyclePromptSeen, type HomeLanding } from '@/lib/homeScreenPrefs';
import { todayYmd } from '@/lib/medications.shared';
import { useAuth } from '@/store/AuthContext';
import { useThemeColors } from '@/theme/colors';
import { HUB, hubText } from '@/theme/hub';
import { ka } from '@/i18n/ka';
import { HYDRATION_DROP_ML } from '@/types/hydration';

/** Four AI check-ups, one per question a person actually has. */
const CHECKUP_TILES: HubTile[] = [
  { key: 'symptoms', title: 'სიმპტომები', detail: 'აღწერე, რა და სად გაწუხებს', href: '/symptoms', icon: Stethoscope, ink: 'teal' },
  { key: 'lab', title: 'ლაბორატორია', detail: 'ატვირთე ანალიზის პასუხი', href: '/module/lab', icon: FlaskConical, ink: 'blue' },
  { key: 'imaging', title: 'გამოსახულება', detail: 'რენტგენი, ექო, MRI', href: '/module/imaging', icon: ScanLine, ink: 'sky' },
  { key: 'skin', title: 'კანი', detail: 'ფოტოს შეფასება და მოვლა', href: '/module/skin', icon: ScanFace, ink: 'rose' },
];

/** Everything else a person manages here, one tile each, no duplicates of the blocks above. */
const SERVICE_TILES: HubTile[] = [
  { key: 'visits', title: 'ვიზიტები', detail: 'დაგეგმილი შეხვედრები', href: '/visits', icon: CalendarCheck, ink: 'teal' },
  { key: 'weight', title: 'წონა და მიზანი', detail: 'ჩანაწერები და პროგრესი', href: '/health-metrics/weight', icon: Scale, ink: 'violet' },
  { key: 'pets', title: 'ჩემი ცხოველები', detail: 'მოვლა და Medi Vet', href: '/pets', icon: PawPrint, ink: 'green' },
  { key: 'pharmacy', title: 'აფთიაქი', detail: 'პროდუქტების მოძებნა', href: '/pharmacy', icon: ShoppingBag, ink: 'sky' },
  { key: 'metrics', title: 'მაჩვენებლები', detail: 'ყველა გაზომვა ერთად', href: '/health-metrics', icon: Activity, ink: 'blue' },
  { key: 'quest', title: 'MEDI QUEST', detail: 'მისიები, პროგრესი და ჯილდოები', href: '/medi-quest', icon: Trophy, ink: 'amber' },
];

/** "4 200" — Hermes has no ka-GE grouping, so group by hand. */
const groupDigits = (n: number) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
const liters = (ml: number) => (ml / 1000).toFixed(1);

export default function Home() {
  const { user, healthProfile, refresh } = useAuth();
  const router = useRouter();
  const c = useThemeColors();
  const insets = useSafeAreaInsets();
  const tabInset = useTabBarInset(20);
  const hydration = useHydration();
  const steps = useStepsMetrics('1d');
  const meds = useMedications();
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState(false);
  const [showCyclePrompt, setShowCyclePrompt] = useState(false);
  const female = user?.gender === 'FEMALE';

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void refresh().catch(() => {});
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

  const today = todayYmd();
  const doses = useMemo(
    () => computeTodayDoses(meds.medications, meds.schedule, meds.doseLogs, today),
    [meds.medications, meds.schedule, meds.doseLogs, today],
  );

  const addGlass = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    void hydration
      .addLog({ date: hydration.today, ml: HYDRATION_DROP_ML, container: 'small', drink: 'water', color: '#14B8A6' })
      .catch(() => undefined);
  }, [hydration]);

  const stepsTotal = steps.bundle?.todayTotal ?? 0;
  const stepsGoal = steps.bundle?.goal ?? 0;
  const rings: DayRing[] = [
    {
      key: 'steps',
      progress: stepsGoal > 0 ? stepsTotal / stepsGoal : 0,
      label: 'ნაბიჯი',
      value: steps.loading && !steps.bundle ? '…' : steps.bundle ? `${groupDigits(stepsTotal)} ნაბიჯი` : 'ნაბიჯები',
      hint: stepsGoal > 0 ? `მიზანი ${groupDigits(stepsGoal)}` : 'დააკავშირე მოწყობილობა',
      onPress: () => open('/health-metrics/steps'),
    },
    {
      key: 'water',
      progress: hydration.progress,
      label: 'წყალი',
      value: hydration.loading ? '…' : `${liters(hydration.todayMl)} / ${liters(hydration.goalMl)} ლ`,
      hint: hydration.loading ? undefined : hydration.remainingMl > 0 ? `დარჩა ${liters(hydration.remainingMl)} ლ` : 'მიზანი შესრულდა',
      onPress: () => open('/health-metrics/hydration'),
      onQuickAdd: addGlass,
      quickAddLabel: `წყლის დამატება, ${HYDRATION_DROP_ML} მლ`,
    },
  ];
  if (doses.total > 0) {
    rings.push({
      key: 'meds',
      progress: doses.taken / doses.total,
      label: 'წამლები',
      value: `${doses.taken} / ${doses.total} მიღებული`,
      hint: doses.pending[0] ? `შემდეგი ${doses.pending[0].time}` : 'ყველა მიღებულია',
      onPress: () => open('/(tabs)/medications'),
    });
  }

  const heading = (title: string, href?: string, linkLabel = 'ყველას ნახვა') => (
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
        {heading('შენი დღე', '/health-metrics', 'ყველა მაჩვენებელი')}
        <HomeDayRings rings={rings} />
      </View>
    ),
    ask: (
      <View style={[s.section, { marginTop: 12 }]}>
        <HomeAskMedi onPress={() => open('/assistant')} />
      </View>
    ),
    nextDose: <HomeNextDoseSection meds={meds} />,
    cycle: (
      <View style={s.section}>
        {heading('ქალის ჯანმრთელობა', '/cycle', 'ციკლის ნახვა')}
        <HomeCyclePreviewCard onPress={() => open('/cycle')} />
        <HubLinkRow
          icon={HeartHandshake}
          ink="rose"
          title="ქალების სივრცე"
          detail="ჰკითხე, გაუზიარე და იპოვე მხარდაჭერა"
          href="/community"
          style={{ marginTop: 10 }}
        />
      </View>
    ),
    nutrition: (
      <View style={s.section}>
        {heading('კვება', '/nutrition/progress', 'პროგრესი')}
        <HomeNutritionCard />
      </View>
    ),
    checkup: (
      <View style={s.section}>
        {heading('შემოწმება AI-სთან')}
        <HubTileGrid tiles={CHECKUP_TILES} />
        <HubLinkRow
          icon={Users}
          ink="violet"
          title="AI კონსილიუმი"
          detail="რამდენიმე AI პერსპექტივა ერთად"
          href="/chat/consilium"
          style={{ marginTop: 12 }}
        />
      </View>
    ),
    services: (
      <View style={s.section}>
        {heading('სერვისები', '/explore', 'ყველა ფუნქცია')}
        <HubTileGrid tiles={SERVICE_TILES} />
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
            განახლება ვერ დასრულდა. ხელახლა ჩამოწიე გვერდი.
          </Text>
        ) : null}
        {buildHomeSectionOrder({ includeCycle: female }).map((id) => (
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
});
