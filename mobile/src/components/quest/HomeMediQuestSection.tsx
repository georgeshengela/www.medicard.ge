import React, { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Flame } from 'lucide-react-native';
import { HomeSectionTitle } from '@/components/home/HomeSectionTitle';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Bone } from '@/components/ui/Skeleton';
import { QuestMediLine } from '@/components/quest/QuestMediLine';
import { QuestProgressBar } from '@/components/quest/QuestProgressBar';
import { QuestReward } from '@/components/quest/QuestReward';
import { useQuestDashboard } from '@/hooks/useQuestDashboard';
import { useOffline } from '@/hooks/useOffline';
import { presentQuestLevelUp } from '@/lib/quest/cache';
import { homeClaimLayout, homeModuleView, rankKeyFromLevel } from '@/lib/quest/logic.js';
import { moodLine, progressLabel, q, questTitles } from '@/lib/quest/copy';
import { QUEST } from '@/theme/questTokens';
import { useThemeColors } from '@/theme/colors';

export function HomeMediQuestSection() {
  const router = useRouter();
  const colors = useThemeColors();
  const copy = q('ka');
  const offline = useOffline();
  const { dashboard, loading, error, stale, claim, mood, refresh, fixtureOffline } = useQuestDashboard();
  const view = homeModuleView({ dashboard, loading, error, stale });
  const seed = `${dashboard?.daily.periodKey || 'day'}:${dashboard?.profile.level || 0}`;
  const line = useMemo(() => moodLine(mood, seed, 'ka'), [mood, seed]);
  const [claiming, setClaiming] = useState(false);
  const claimBlocked = offline || fixtureOffline;

  const openHub = () => router.push('/medi-quest' as never);

  if (view.kind === 'loading') {
    return (
      <View style={{ paddingVertical: 4, gap: 8, minHeight: QUEST.homeMinHeight }}>
        <HomeSectionTitle title={copy.section} style={{ marginHorizontal: 16, marginBottom: 0 }} />
        <View style={{ marginHorizontal: 16 }}>
          <Card>
            <View className="flex-row justify-between">
              <Bone height={16} width="28%" />
              <Bone height={16} width="22%" />
            </View>
            <View style={{ height: 14 }} />
            <Bone height={8} />
            <View style={{ height: 16 }} />
            <Bone height={14} width="70%" />
            <View style={{ height: 14 }} />
            <Bone height={14} width="40%" />
          </Card>
        </View>
      </View>
    );
  }

  if (view.kind === 'error') {
    return (
      <View style={{ paddingVertical: 4, gap: 8, minHeight: QUEST.homeMinHeight }}>
        <HomeSectionTitle title={copy.section} style={{ marginHorizontal: 16, marginBottom: 0 }} />
        <View style={{ marginHorizontal: 16 }}>
          <Card>
            <Text className="font-sans text-sm leading-5 text-text-200">{copy.loadError}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={copy.retry}
              onPress={() => void refresh()}
              className="mt-3 min-h-[44px] justify-center"
            >
              <Text className="font-sans-semibold text-sm text-primary-200">{copy.retry}</Text>
            </Pressable>
          </Card>
        </View>
      </View>
    );
  }

  if (view.kind === 'empty' || view.priority?.mode === 'empty') {
    return (
      <View style={{ paddingVertical: 4, gap: 8, minHeight: QUEST.homeMinHeight }}>
        <HomeSectionTitle title={copy.section} style={{ marginHorizontal: 16, marginBottom: 0 }} />
        <View style={{ marginHorizontal: 16 }}>
          <Card>
            <QuestMediLine text={copy.empty} />
          </Card>
        </View>
      </View>
    );
  }

  const claimable = view.priority?.mode === 'claimable';
  const layout = homeClaimLayout(view.priority?.mode);
  const quest = view.priority?.quest;
  const titles = quest ? questTitles(quest, 'ka') : null;
  const allDone = view.priority?.mode === 'done' || mood === 'all_daily_complete';

  const onClaim = async () => {
    if (!quest || claiming || claimBlocked) return;
    setClaiming(true);
    const result = await claim(quest.id);
    setClaiming(false);
    if (!result) return;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    if (result.profile.leveledUp) {
      presentQuestLevelUp({
        level: result.profile.currentLevel,
        previousLevel: result.profile.previousLevel,
        rankKey: rankKeyFromLevel(result.profile.currentLevel),
        coins: result.reward.coinsAwarded,
        xp: result.reward.xpAwarded,
      });
    }
  };

  return (
    <View style={{ paddingVertical: 4, gap: 8, minHeight: QUEST.homeMinHeight }}>
      <HomeSectionTitle title={copy.section} style={{ marginHorizontal: 16, marginBottom: 0 }} />
      <View style={{ marginHorizontal: 16 }}>
        <Card>
          <View className="flex-row items-center justify-between" style={{ gap: 8 }}>
            <Text className="min-w-0 shrink font-sans-semibold text-sm text-text-200">
              {copy.level} {view.level}
            </Text>
            {view.streak > 0 ? (
              <View className="min-w-0 shrink flex-row items-center" style={{ gap: 4 }}>
                <Flame size={14} color={colors.warning} strokeWidth={2.2} />
                <Text className="font-sans-semibold text-sm text-text-100" numberOfLines={2}>
                  {copy.streakDays(view.streak)}
                </Text>
              </View>
            ) : (
              <Text className="min-w-0 shrink text-right font-sans text-sm text-text-300">{copy.streakStart}</Text>
            )}
          </View>

          {layout.showDailyProgress && view.dailyTotal > 0 ? (
            <>
              <Text className="mt-3 font-sans-bold text-base text-text-100">
                {copy.progressOf(view.dailyCompleted, view.dailyTotal)}
              </Text>
              <View className="mt-2">
                <QuestProgressBar
                  percent={(view.dailyCompleted / view.dailyTotal) * 100}
                  height={QUEST.barDaily}
                  near={view.dailyCompleted + 1 >= view.dailyTotal && view.dailyCompleted < view.dailyTotal}
                />
              </View>
            </>
          ) : null}

          <View className="mt-3">
            {claimable && quest ? (
              <View className="rounded-xl px-3 py-2.5" style={{ backgroundColor: colors.accent100 }}>
                <Text className="font-sans-semibold text-sm text-text-100">{copy.rewardReady}</Text>
                <View className="mt-1">
                  <QuestReward xp={quest.rewardXp} coins={quest.rewardCoins} locale="ka" />
                </View>
                <View className="mt-3">
                  <Button
                    label={copy.claim}
                    size="md"
                    loading={claiming}
                    disabled={claimBlocked || claiming}
                    onPress={() => void onClaim()}
                  />
                  {claimBlocked ? (
                    <Text className="mt-2 font-sans text-xs text-text-300">{copy.connectToClaim}</Text>
                  ) : null}
                </View>
              </View>
            ) : (
              <>
                <QuestMediLine text={line} />
                {quest && titles && !allDone ? (
                  <Text className="mt-2 font-sans text-sm leading-5 text-text-300">
                    {titles.title}
                    {'  ·  '}
                    {progressLabel(quest, 'ka')}
                  </Text>
                ) : null}
              </>
            )}
          </View>

          {stale ? <Text className="mt-2 font-sans text-xs text-text-300">{copy.stale}</Text> : null}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={copy.open}
            onPress={openHub}
            className="mt-2 min-h-[44px] justify-center active:opacity-70"
          >
            <Text className="font-sans-semibold text-sm text-primary-200">{copy.open}</Text>
          </Pressable>
        </Card>
      </View>
    </View>
  );
}
