import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { ChevronRight, ClipboardList, FileHeart, MessageCircle, type LucideIcon } from 'lucide-react-native';
import { Disclaimer } from '@/components/Disclaimer';
import { DefaultHomePrompt } from '@/components/home/DefaultHomePrompt';
import { HomeAskMedi } from '@/components/home/HomeAskMedi';
import { HomeCyclePreviewCard } from '@/components/home/HomeCyclePreviewCard';
import { HomeDayRings, type DayRing } from '@/components/home/HomeDayRings';
import { HomeDiscoverGrid } from '@/components/home/HomeDiscoverGrid';
import {
  HomeCommunityDiscovery,
  HomeRunDiscovery,
} from '@/components/home/HomeDiscoveryCards';
import { HomeHeader } from '@/components/home/HomeHeader';
import { HomeNextDoseSection } from '@/components/home/HomeNextDoseSection';
import { HomeQuickActions } from '@/components/home/HomeQuickActions';
import { HomeSectionHeading } from '@/components/home/HomeSectionHeading';
import { useTabBarInset } from '@/components/navigation/FloatingTabBar';
import { normalizeAvatarForGender } from '@/constants/avatarAssets';
import { useHydration } from '@/hooks/useHydration';
import { useMedications } from '@/hooks/useMedications';
import { useStepsMetrics } from '@/hooks/useStepsMetrics';
import { api, type ChatSummary } from '@/lib/api';
import { formatDayMonthYearKa, formatRelative } from '@/lib/format';
import { requestHealthRefresh } from '@/lib/healthDataSync';
import { buildHomeSectionOrder } from '@/lib/home/homeSectionOrder';
import { computeTodayDoses } from '@/lib/home/todayDoses';
import { getCyclePromptSeen, type HomeLanding } from '@/lib/homeScreenPrefs';
import { todayYmd } from '@/lib/medications.shared';
import { useAuth } from '@/store/AuthContext';
import { useIsDark, useThemeColors } from '@/theme/colors';
import { HUB, hubInk, hubText, hubTint } from '@/theme/hub';
import { ka } from '@/i18n/ka';
import { HYDRATION_DROP_ML } from '@/types/hydration';
import { analysisFromProfile } from '@/types/onboardingAnalysis';

/** "4 200" — Hermes has no ka-GE grouping, so group by hand. */
const groupDigits = (n: number) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
const liters = (ml: number) => (ml / 1000).toFixed(1);

export default function Home() {
  const { user, healthProfile, refresh } = useAuth();
  const router = useRouter();
  const c = useThemeColors();
  const dark = useIsDark();
  const insets = useSafeAreaInsets();
  const tabInset = useTabBarInset(20);
  const hydration = useHydration();
  const steps = useStepsMetrics('1d');
  const meds = useMedications();
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState(false);
  const [showCyclePrompt, setShowCyclePrompt] = useState(false);
  const female = user?.gender === 'FEMALE';
  const accountRef = useRef(user?.id);
  accountRef.current = user?.id;

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setChats([]);
      void api.chats
        .list()
        .then(({ sessions }) => {
          if (active) setChats(sessions.slice(0, 2));
        })
        .catch(() => {});
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
    const accountId = user?.id;
    setRefreshing(true);
    setRefreshError(false);
    try {
      const results = await Promise.allSettled([
        refresh(),
        steps.refresh(),
        hydration.refresh(),
        meds.load(),
        api.chats.list().then(({ sessions }) => {
          if (accountRef.current === accountId) setChats(sessions.slice(0, 2));
        }),
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
    actions: (
      <View style={s.section}>
        {heading('სწრაფი მოქმედებები', '/explore', 'ყველა')}
        <HomeQuickActions />
      </View>
    ),
    cycle: (
      <View style={s.section}>
        {heading(ka.cycle.title, '/cycle', 'ციკლის ნახვა')}
        <HomeCyclePreviewCard onPress={() => open('/cycle')} />
      </View>
    ),
    community: (
      <View style={s.section}>
        {heading('საზოგადოება')}
        <HomeCommunityDiscovery />
      </View>
    ),
    movement: (
      <View style={s.section}>
        {heading('გაისეირნე დღეს')}
        <HomeRunDiscovery />
      </View>
    ),
    discover: (
      <View style={s.section}>
        {heading('აღმოაჩინე მეტი')}
        <HomeDiscoverGrid />
      </View>
    ),
    recentActivity: (
      <View style={s.section}>
        {heading('შენი ისტორია', '/(tabs)/records')}
        <View style={[s.list, { backgroundColor: c.surface }]}>
          <HistoryRow
            icon={FileHeart}
            ink={hubInk('teal', dark)}
            tint={hubTint(hubInk('teal', dark), dark)}
            title="შენახული დოკუმენტები"
            detail="ანალიზები, სურათები და წინა ჩანაწერები"
            onPress={() => open('/(tabs)/records')}
          />
          {chats.map((chat) => (
            <HistoryRow
              key={chat.id}
              icon={MessageCircle}
              ink={c.text200}
              tint={c.bg200}
              title={chat.title}
              detail={`${chat.mode === 'CONSILIUM' ? 'AI კონსილიუმი' : 'საუბარი მედისთან'} · ${formatRelative(chat.updatedAt)}`}
              accessibilityLabel={`საუბრის გაგრძელება: ${chat.title}`}
              rule
              onPress={() =>
                open(
                  `/chat/${chat.mode === 'CONSILIUM' ? 'consilium' : 'doctor'}?sessionId=${encodeURIComponent(chat.id)}`,
                )
              }
            />
          ))}
          {analysisFromProfile(extra ?? {}) ? (
            <HistoryRow
              icon={ClipboardList}
              ink={c.text200}
              tint={c.bg200}
              title="ჯანმრთელობის კითხვარის შედეგები"
              detail="შენი პასუხების მიხედვით შედგენილი შეჯამება"
              rule
              onPress={() => open('/(auth)/profile-setup/results?preview=1')}
            />
          ) : null}
        </View>
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

function HistoryRow({
  icon: Icon,
  ink,
  tint,
  title,
  detail,
  onPress,
  accessibilityLabel,
  rule = false,
}: {
  icon: LucideIcon;
  ink: string;
  tint: string;
  title: string;
  detail: string;
  onPress: () => void;
  accessibilityLabel?: string;
  rule?: boolean;
}) {
  const c = useThemeColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? `${title}. ${detail}`}
      onPress={onPress}
      style={[s.inlineRow, rule ? { borderTopWidth: StyleSheet.hairlineWidth, borderColor: c.bg300 } : null]}
    >
      <View style={[s.rowTile, { backgroundColor: tint }]}>
        <Icon size={19} color={ink} strokeWidth={1.9} />
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text numberOfLines={2} style={[hubText.cardTitle, { color: c.text100, fontSize: 14, lineHeight: 20 }]}>
          {title}
        </Text>
        <Text numberOfLines={2} style={[hubText.caption, { color: c.text200 }]}>
          {detail}
        </Text>
      </View>
      <ChevronRight size={17} color={c.text300} />
    </Pressable>
  );
}

const s = StyleSheet.create({
  section: { paddingHorizontal: HUB.gutter, marginTop: HUB.sectionGap },
  list: { borderRadius: HUB.cardRadius, paddingHorizontal: 16, paddingVertical: 2 },
  inlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
  },
  rowTile: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  caption: hubText.caption,
});
