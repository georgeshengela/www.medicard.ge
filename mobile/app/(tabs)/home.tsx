import React, { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { ChevronRight, MessageSquareText, Sparkles } from 'lucide-react-native';
import { Card } from '@/components/ui/Card';
import { Disclaimer } from '@/components/Disclaimer';
import { DefaultHomePrompt } from '@/components/home/DefaultHomePrompt';
import { HomeDashboardTop } from '@/components/home/HomeDashboardTop';
import { HomeAccountSetupCard } from '@/components/home/HomeAccountSetupCard';
import { HomeBmiWeightSection } from '@/components/home/HomeBmiWeightSection';
import { HomeNextDoseSection } from '@/components/home/HomeNextDoseSection';
import { HomeHealthMetricsSection } from '@/components/home/HomeHealthMetricsSection';
import { HomeStartSection } from '@/components/home/HomeStartSection';
import { HomeAnalysisSection } from '@/components/home/HomeAnalysisSection';
import { HomeConsiliumCard } from '@/components/home/HomeConsiliumCard';
import { modulesForGender, POWER_TOOL_MODULE_KEYS, SPOTLIGHT_MODULE_KEYS } from '@/constants/modules';
import { homeAccentFor } from '@/constants/homeVisuals';
import { HOME_SPACE as S } from '@/constants/homeSpacing';
import { ka } from '@/i18n/ka';
import { api, type ChatSummary } from '@/lib/api';
import { formatRelative } from '@/lib/format';
import { getCyclePromptSeen, type HomeLanding } from '@/lib/homeScreenPrefs';
import { useTabBarInset } from '@/components/navigation/FloatingTabBar';
import { useThemeColors, useIsDark } from '@/theme/colors';
import { OnboardingDevLauncher } from '@/components/dev/OnboardingDevLauncher';
import { useAuth } from '@/store/AuthContext';
import { getAccountSetupProgress, type AccountSetupStep } from '@/lib/homeAccountSetup';
import { analysisFromProfile } from '@/types/onboardingAnalysis';

export default function Home() {
  const { user, healthProfile, stats, refresh } = useAuth();
  const router = useRouter();
  const colors = useThemeColors();
  const tabInset = useTabBarInset();
  const isDark = useIsDark();

  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showCyclePrompt, setShowCyclePrompt] = useState(false);

  const load = useCallback(async () => {
    try {
      const { sessions } = await api.chats.list();
      setChats(sessions.slice(0, 3));
    } catch {
      /* pull-to-refresh retries */
    }
  }, []);

  const maybeShowCyclePrompt = useCallback(async () => {
    if (user?.gender !== 'FEMALE') return;
    const seen = await getCyclePromptSeen();
    if (!seen) setShowCyclePrompt(true);
  }, [user?.gender]);

  useFocusEffect(
    useCallback(() => {
      load();
      refresh();
      void maybeShowCyclePrompt();
    }, [load, refresh, maybeShowCyclePrompt]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([load(), refresh()]);
    setRefreshing(false);
  }, [load, refresh]);

  const onPromptClose = useCallback(
    (landing: HomeLanding) => {
      setShowCyclePrompt(false);
      if (landing === 'cycle') router.replace('/cycle' as never);
    },
    [router],
  );

  const firstName = user?.fullName?.split(' ')[0] ?? '';
  const initials = user?.fullName
    ?.split(' ')
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

  const tiles = modulesForGender(user?.gender);
  const spotlights = tiles.filter((tile) => SPOTLIGHT_MODULE_KEYS.has(tile.key));
  const serviceTiles = tiles.filter(
    (tile) => !SPOTLIGHT_MODULE_KEYS.has(tile.key) && !POWER_TOOL_MODULE_KEYS.has(tile.key),
  );
  const analysisTiles = serviceTiles.filter((tile) => tile.key !== 'consilium');
  const consiliumTile = serviceTiles.find((tile) => tile.key === 'consilium');

  const extra = (healthProfile?.extraAnswers ?? {}) as Record<string, unknown>;
  const analysis = analysisFromProfile(extra);
  const setupProgress = getAccountSetupProgress(healthProfile, user, stats);
  const avatarId = typeof extra.avatarId === 'string' ? extra.avatarId : null;

  const onSetupStepPress = (step: AccountSetupStep) => {
    if (step.done) return;
    router.push(step.href as never);
  };

  return (
    <>
      <ScrollView
        className="flex-1 bg-bg-100"
        contentContainerStyle={{ paddingBottom: tabInset }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary200} />
        }
        showsVerticalScrollIndicator={false}
      >
        <HomeDashboardTop
          firstName={firstName}
          initials={initials || 'M'}
          gender={user?.gender}
          avatarId={avatarId}
          streak={user?.currentStreak ?? 0}
          score={analysis?.score ?? null}
          scoreLabel={analysis?.labelKa ?? ka.home.scorePending}
          statusLabel={analysis?.bodyComposition?.physiqueLabelKa ?? ka.home.healthyStatus}
          waterLiters={healthProfile?.waterIntakeL ?? null}
          onAvatarPress={() => router.push('/(tabs)/profile' as never)}
          onPackagePress={() => router.push('/package' as never)}
          onStreakPress={() => router.push('/profile/streak' as never)}
          onScorePress={() => {
            if (analysis) router.push('/(auth)/profile-setup/results?preview=1' as never);
          }}
        />

        <HomeNextDoseSection refreshing={refreshing} />

        <HomeBmiWeightSection profile={healthProfile} />

        {setupProgress.visible ? (
          <View style={{ paddingHorizontal: 16, paddingVertical: 8 }}>
            <HomeAccountSetupCard progress={setupProgress} onStepPress={onSetupStepPress} />
          </View>
        ) : null}

        <HomeHealthMetricsSection profile={healthProfile} />

        <View className="px-4">
        <HomeStartSection
          spotlights={spotlights}
          firstName={firstName}
          onPress={(tile) => router.push(tile.href as never)}
        />

        <HomeAnalysisSection
          tiles={analysisTiles}
          onPress={(tile) => router.push(tile.href as never)}
        />

        {consiliumTile ? (
          <HomeConsiliumCard onPress={() => router.push(consiliumTile.href as never)} />
        ) : null}

        <View
          className="flex-row items-center justify-between"
          style={{ marginTop: S.sectionTop, marginBottom: S.sectionLabelBottom }}
        >
          <SectionLabel title={ka.home.recentActivity} inline />
          {chats.length > 0 ? (
            <Pressable accessibilityRole="button" hitSlop={8} onPress={() => router.push('/(tabs)/records')}>
              <Text className="text-sm font-semibold text-primary-200">{ka.common.seeAll}</Text>
            </Pressable>
          ) : null}
        </View>

        {chats.length === 0 ? (
          <Card>
            <View className="items-center py-3">
              <View
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 18,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: homeAccentFor('doctor', isDark).soft,
                  borderWidth: 1,
                  borderColor: homeAccentFor('doctor', isDark).border,
                }}
              >
                <Sparkles size={24} color={colors.primary200} strokeWidth={2.1} />
              </View>
              <Text className="mt-3 text-center text-base font-semibold text-text-200">{ka.home.noActivity}</Text>
              <Text className="mt-1.5 text-center text-sm leading-5 text-text-300">{ka.home.noActivityHint}</Text>
            </View>
          </Card>
        ) : (
          chats.map((chat, index) => (
            <ActivityRow
              key={chat.id}
              chat={chat}
              accentKey={index === 0 ? 'doctor' : index === 1 ? 'consilium' : 'lab'}
              onPress={() =>
                router.push(`/chat/${chat.mode === 'CONSILIUM' ? 'consilium' : 'doctor'}?sessionId=${chat.id}`)
              }
            />
          ))
        )}

        <Disclaimer className="mt-4" />
        </View>
      </ScrollView>

      <DefaultHomePrompt visible={showCyclePrompt} onClose={onPromptClose} />
      <OnboardingDevLauncher variant="fab" />
    </>
  );
}

function SectionLabel({
  title,
  className = '',
  inline = false,
}: {
  title: string;
  className?: string;
  inline?: boolean;
}) {
  if (inline) {
    return <Text className="text-base font-bold text-text-100">{title}</Text>;
  }
  return (
    <Text
      style={{ marginTop: S.sectionTop, marginBottom: S.sectionLabelBottom }}
      className={`text-[10px] font-bold uppercase tracking-[1px] text-text-300 ${className}`}
    >
      {title}
    </Text>
  );
}

function ActivityRow({
  chat,
  accentKey,
  onPress,
}: {
  chat: ChatSummary;
  accentKey: string;
  onPress: () => void;
}) {
  const isDark = useIsDark();
  const accent = homeAccentFor(accentKey, isDark);

  return (
    <Card className="mb-2" onPress={onPress}>
      <View className="flex-row items-center">
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 14,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: accent.bg,
          }}
        >
          <MessageSquareText size={17} color="#ffffff" strokeWidth={2.1} />
        </View>
        <View className="ml-3 flex-1">
          <Text numberOfLines={1} className="text-base font-semibold text-text-100">
            {chat.title}
          </Text>
          <Text numberOfLines={1} className="mt-0.5 text-sm text-text-300">
            {chat.preview || formatRelative(chat.updatedAt)}
          </Text>
        </View>
        <ChevronRight size={18} color={accent.bg} strokeWidth={2.4} />
      </View>
    </Card>
  );
}
