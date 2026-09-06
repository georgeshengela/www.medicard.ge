import React, { useCallback, useEffect, useState } from 'react';
import { Modal, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { Card } from '@/components/ui/Card';
import { Bone } from '@/components/ui/Skeleton';
import { Button } from '@/components/ui/Button';
import { QuestCard } from '@/components/quest/QuestCard';
import { QuestHubHeader } from '@/components/quest/QuestHubHeader';
import { QuestMediLine } from '@/components/quest/QuestMediLine';
import { QuestRewardFloat } from '@/components/quest/QuestRewardFloat';
import { QuestSectionTitle } from '@/components/quest/QuestSectionTitle';
import { QuestDevLauncher } from '@/components/dev/QuestDevLauncher';
import { useQuestDashboard } from '@/hooks/useQuestDashboard';
import { useOffline } from '@/hooks/useOffline';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { useWeather } from '@/hooks/useWeather';
import { useThemeColors } from '@/theme/colors';
import { useAuth } from '@/store/AuthContext';
import { isHealthSyncEnabled } from '@/lib/healthSync.shared';
import { moodLine, q } from '@/lib/quest/copy';
import { questKind, rankKeyFromLevel } from '@/lib/quest/logic.js';
import { presentQuestLevelUp } from '@/lib/quest/cache';
import { trackQuestEvent } from '@/lib/productObservability';
import { APP_MODAL_OVERLAY, APP_MODAL_PROPS } from '@/components/ui/appModal';
import { QUEST } from '@/theme/questTokens';

export default function MediQuestHub() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const { user } = useAuth();
  const offline = useOffline();
  const reduce = usePrefersReducedMotion();
  const weather = useWeather();
  const copy = q('ka');
  const { dashboard, loading, error, stale, refresh, claim, mood, fixtureOffline } = useQuestDashboard();
  const claimBlocked = offline || fixtureOffline;
  const [refreshing, setRefreshing] = useState(false);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [displayCoins, setDisplayCoins] = useState<number | null>(null);
  const [floatReward, setFloatReward] = useState<string | null>(null);
  const [streakInfo, setStreakInfo] = useState(false);
  const [healthOn, setHealthOn] = useState(true);

  useEffect(() => {
    void trackQuestEvent('quest_hub_opened');
    void isHealthSyncEnabled().then(setHealthOn);
  }, []);

  useEffect(() => {
    if (dashboard) setDisplayCoins(dashboard.profile.coinBalance);
  }, [dashboard?.profile.coinBalance]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  const windowHint = weather.recommendation?.bestOutdoorWindow
    ? copy.weatherBest(weather.recommendation.bestOutdoorWindow.start, weather.recommendation.bestOutdoorWindow.end)
    : null;

  const onClaim = async (id: string) => {
    if (claimingId || claimBlocked) return;
    setClaimingId(id);
    void trackQuestEvent('quest_claim_tapped', id);
    const result = await claim(id);
    setClaimingId(null);
    if (!result) return;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    setFloatReward(`+${result.reward.coinsAwarded} · +${result.reward.xpAwarded} ${copy.xp}`);
    setDisplayCoins(result.profile.coinBalance);
    setTimeout(() => setFloatReward(null), reduce ? 400 : 1200);
    if (result.profile.leveledUp) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      presentQuestLevelUp({
        level: result.profile.currentLevel,
        previousLevel: result.profile.previousLevel,
        rankKey: rankKeyFromLevel(result.profile.currentLevel),
        coins: result.reward.coinsAwarded,
        xp: result.reward.xpAwarded,
      });
    }
  };

  const daily = dashboard?.daily.quests || [];
  const weekly = dashboard?.weekly.quests || [];
  const hasSteps = daily.some((row) => questKind(row) === 'movement') || weekly.some((row) => questKind(row) === 'movement');
  const hasHydro = daily.some((row) => questKind(row) === 'hydration');
  const seed = `${dashboard?.daily.periodKey || ''}:${user?.id || ''}:${mood}`;

  return (
    <View className="flex-1 bg-bg-100" style={{ paddingTop: insets.top }}>
      <View className="flex-row items-center px-4 py-2">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={copy.back}
          hitSlop={12}
          onPress={() => router.back()}
          className="min-h-[44px] min-w-[44px] justify-center"
        >
          <ArrowLeft size={22} color={colors.text100} strokeWidth={2.2} />
        </Pressable>
        <Text className="font-sans-bold text-lg text-text-100">{copy.section}</Text>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 36, gap: 20 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary200} />
        }
        showsVerticalScrollIndicator={false}
      >
        {loading && !dashboard ? (
          <HubSkeleton />
        ) : error && !dashboard ? (
          <Card>
            <Text className="font-sans text-sm text-text-200">{copy.loadError}</Text>
            <View className="mt-3">
              <Button label={copy.retry} size="sm" onPress={() => void refresh()} />
            </View>
          </Card>
        ) : dashboard ? (
          <>
            <QuestHubHeader
              dashboard={dashboard}
              locale="ka"
              displayCoins={displayCoins ?? dashboard.profile.coinBalance}
              onCoinsPress={() => {
                void trackQuestEvent('quest_wallet_opened');
                router.push('/medi-quest/wallet' as never);
              }}
              onStreakPress={() => setStreakInfo(true)}
            />

            <QuestMediLine text={moodLine(mood, seed, 'ka')} />
            {stale || claimBlocked ? <Text className="font-sans text-xs text-text-300">{copy.stale}</Text> : null}

            <View style={{ gap: 12 }}>
              <QuestSectionTitle title={copy.today} />
              {daily.length === 0 ? (
                <QuestMediLine text={copy.empty} />
              ) : (
                daily.map((quest) => (
                  <QuestCard
                    key={quest.id}
                    quest={quest}
                    weatherHint={questKind(quest) === 'movement' ? windowHint : null}
                    offline={claimBlocked}
                    claiming={claimingId === quest.id}
                    onClaim={() => void onClaim(quest.id)}
                    onOpenMedi={() => router.push('/chat/doctor' as never)}
                  />
                ))
              )}
            </View>

            {weekly.length ? (
              <View style={{ gap: 12 }}>
                <QuestSectionTitle title={copy.weekly} />
                {weekly.map((quest) => (
                  <QuestCard
                    key={quest.id}
                    quest={quest}
                    weekly
                    weatherHint={questKind(quest) === 'movement' ? windowHint : null}
                    offline={claimBlocked}
                    claiming={claimingId === quest.id}
                    onClaim={() => void onClaim(quest.id)}
                  />
                ))}
              </View>
            ) : null}

            {!hasSteps && !healthOn ? (
              <Card>
                <Text className="font-sans-bold text-base text-text-100">{copy.unlockSteps}</Text>
                <Text className="mt-1 font-sans text-sm leading-5 text-text-200">{copy.setupSteps}</Text>
                <Pressable
                  accessibilityRole="button"
                  className="mt-3 min-h-[44px] justify-center"
                  onPress={() => {
                    void trackQuestEvent('step_setup_opened');
                    router.push('/profile/permissions' as never);
                  }}
                >
                  <Text className="font-sans-semibold text-sm text-primary-200">{copy.connect}</Text>
                </Pressable>
              </Card>
            ) : null}

            {!hasHydro ? (
              <Card>
                <Text className="font-sans-bold text-base text-text-100">{copy.unlockHydro}</Text>
                <Text className="mt-1 font-sans text-sm leading-5 text-text-200">{copy.setupHydro}</Text>
                <Pressable
                  accessibilityRole="button"
                  className="mt-3 min-h-[44px] justify-center"
                  onPress={() => {
                    void trackQuestEvent('hydration_setup_opened');
                    router.push('/health-metrics/hydration' as never);
                  }}
                >
                  <Text className="font-sans-semibold text-sm text-primary-200">{copy.setGoal}</Text>
                </Pressable>
              </Card>
            ) : null}

            <View className="flex-row" style={{ gap: 20 }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={copy.history}
                className="min-h-[44px] justify-center"
                onPress={() => {
                  void trackQuestEvent('quest_history_opened');
                  router.push('/medi-quest/history' as never);
                }}
              >
                <Text className="font-sans-semibold text-sm text-primary-200">{copy.history}</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={copy.wallet}
                className="min-h-[44px] justify-center"
                onPress={() => {
                  void trackQuestEvent('quest_wallet_opened');
                  router.push('/medi-quest/wallet' as never);
                }}
              >
                <Text className="font-sans-semibold text-sm text-primary-200">{copy.wallet}</Text>
              </Pressable>
            </View>
          </>
        ) : null}
      </ScrollView>

      <QuestRewardFloat text={floatReward} top={insets.top + 52} />
      <QuestDevLauncher variant="chip" />

      <Modal visible={streakInfo} {...APP_MODAL_PROPS} onRequestClose={() => setStreakInfo(false)}>
        <View className="flex-1 justify-end">
          <Pressable style={{ flex: 1, backgroundColor: APP_MODAL_OVERLAY }} onPress={() => setStreakInfo(false)} />
          <View className="rounded-t-3xl bg-surface px-5 pt-6" style={{ paddingBottom: Math.max(insets.bottom, 20) + 8 }}>
            <Text className="font-sans-bold text-lg text-text-100">{copy.streakStart}</Text>
            <Text className="mt-2 font-sans text-sm leading-6 text-text-200">{copy.streakHint}</Text>
            <View className="mt-4">
              <Button label={copy.continue} onPress={() => setStreakInfo(false)} />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function HubSkeleton() {
  return (
    <View style={{ gap: 20 }}>
      <Bone height={28} width="36%" />
      <Bone height={16} width="28%" />
      <Bone height={QUEST.barXp} />
      <View className="flex-row" style={{ gap: 10 }}>
        <Bone height={44} width="48%" radius={16} />
        <Bone height={44} width="48%" radius={16} />
      </View>
      <Bone height={16} width="20%" />
      <Card>
        <Bone height={18} width="55%" />
        <View style={{ height: 12 }} />
        <Bone height={QUEST.barDaily} />
      </Card>
      <Card>
        <Bone height={18} width="48%" />
        <View style={{ height: 12 }} />
        <Bone height={QUEST.barDaily} />
      </Card>
    </View>
  );
}
