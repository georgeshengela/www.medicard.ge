import React, { useCallback, useState } from 'react';
import { Alert, Pressable, Share, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StepsGoalGauge } from '@/components/health/steps-goal/StepsGoalGauge';
import {
  GoalBellRinging,
  GoalChevronLeft,
  GoalDotsVertical,
  GoalPencil,
  GoalPlus,
  GoalShare,
} from '@/components/health/steps-goal/StepsGoalIcons';
import { useFigmaSteps } from '@/constants/figmaStepsLayout';
import { ka } from '@/i18n/ka';
import {
  buildGoalProgress,
  clearStepsGoal,
  loadStepsGoal,
  saveStepsGoal,
  todayYmd,
} from '@/lib/stepsGoal';
import { fetchStepsTotalBetween } from '@/lib/stepsMetrics';
import { formatStepsCount } from '@/lib/stepsMetrics.shared';
import type { StepsGoalProgress } from '@/types/stepsGoal';

export default function StepsGoalScreen() {
  const FIGMA_STEPS = useFigmaSteps();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [progress, setProgress] = useState<StepsGoalProgress | null>(null);

  const load = useCallback(async () => {
    const goal = await loadStepsGoal();
    if (!goal) {
      setProgress(null);
      return;
    }
    const current = await fetchStepsTotalBetween(goal.startedYmd, todayYmd());
    const next = buildGoalProgress(goal, current);
    setProgress(next);
    if (next.completed && !goal.completedSeen) {
      router.replace('/health-metrics/steps/goal/completed' as never);
    }
  }, [router]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const openMenu = () => {
    if (!progress) {
      Alert.alert(ka.stepsGoal.menuTitle, undefined, [{ text: ka.common.cancel, style: 'cancel' }]);
      return;
    }
    Alert.alert(ka.stepsGoal.menuTitle, undefined, [
      {
        text: ka.stepsGoal.editGoal,
        onPress: () => {
          router.push({
            pathname: '/health-metrics/steps/goal/set',
            params: { target: String(progress.goal.targetSteps), deadline: progress.goal.deadlineYmd },
          } as never);
        },
      },
      {
        text: ka.stepsGoal.clearGoal,
        style: 'destructive',
        onPress: () => {
          void clearStepsGoal().then(() => setProgress(null));
        },
      },
      { text: ka.common.cancel, style: 'cancel' },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: FIGMA_STEPS.pageBg, paddingTop: insets.top }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          minHeight: 56,
          paddingHorizontal: 16,
          paddingVertical: 8,
          gap: 12,
        }}
      >
        <Pressable accessibilityRole="button" onPress={() => router.back()} hitSlop={12}>
          <GoalChevronLeft size={24} />
        </Pressable>
        <Text
          style={{
            flex: 1,
            fontFamily: 'NotoSansGeorgian_600SemiBold',
            fontSize: 16,
            lineHeight: 22,
            color: FIGMA_STEPS.textPrimary,
            textAlign: 'center',
          }}
        >
          {progress ? ka.stepsGoal.myGoal : ka.stepsGoal.myStepsGoal}
        </Text>
        <Pressable accessibilityRole="button" onPress={openMenu} hitSlop={12}>
          <GoalDotsVertical size={24} />
        </Pressable>
      </View>

      <View style={{ flex: 1, justifyContent: 'center' }}>
        {progress ? (
          <>
            <StepsGoalGauge
              current={progress.current}
              target={progress.goal.targetSteps}
              percent={progress.percent}
              daysLeft={progress.daysLeft}
            />
            <View style={{ padding: 16, gap: 12 }}>
              <Text
                style={{
                  fontFamily: 'NotoSansGeorgian_700Bold',
                  fontSize: 24,
                  lineHeight: 32,
                  letterSpacing: -0.25,
                  color: FIGMA_STEPS.textPrimary,
                  textAlign: 'center',
                }}
              >
                {ka.stepsGoal.onTrackTitle}
              </Text>
              <Text
                style={{
                  fontFamily: 'NotoSansGeorgian_400Regular',
                  fontSize: 16,
                  lineHeight: 26,
                  color: FIGMA_STEPS.textSecondary,
                  textAlign: 'center',
                }}
              >
                {ka.stepsGoal.onTrackBody}
              </Text>
            </View>
          </>
        ) : (
          <>
            <StepsGoalGauge current={0} target={0} percent={0} daysLeft={0} />
            <View style={{ padding: 16, gap: 12 }}>
              <Text
                style={{
                  fontFamily: 'NotoSansGeorgian_700Bold',
                  fontSize: 24,
                  lineHeight: 32,
                  letterSpacing: -0.25,
                  color: FIGMA_STEPS.textPrimary,
                  textAlign: 'center',
                }}
              >
                {ka.stepsGoal.emptyTitle}
              </Text>
              <Text
                style={{
                  fontFamily: 'NotoSansGeorgian_400Regular',
                  fontSize: 16,
                  lineHeight: 26,
                  color: FIGMA_STEPS.textSecondary,
                  textAlign: 'center',
                }}
              >
                {ka.stepsGoal.emptyBody}
              </Text>
            </View>
            <View style={{ padding: 16 }}>
              <Pressable
                onPress={() =>
                  router.push({
                    pathname: '/health-metrics/steps/goal/set',
                    params: { fresh: '1' },
                  } as never)
                }
                style={{
                  backgroundColor: FIGMA_STEPS.brand,
                  minHeight: 48,
                  borderRadius: 16,
                  paddingHorizontal: 20,
                  paddingVertical: 12,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 10,
                  ...FIGMA_STEPS.shadowXs,
                }}
              >
                <Text
                  style={{
                    fontFamily: 'NotoSansGeorgian_600SemiBold',
                    fontSize: 16,
                    lineHeight: 22,
                    color: '#FFFFFF',
                  }}
                >
                  {ka.stepsGoal.setNewGoal}
                </Text>
                <GoalPlus size={20} color="#FFFFFF" />
              </Pressable>
            </View>
          </>
        )}
      </View>

      {progress ? (
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', padding: 16, gap: 8, paddingBottom: insets.bottom + 16 }}>
          <ActionCircle
            label={ka.stepsGoal.notification}
            onPress={() =>
              void saveStepsGoal({
                ...progress.goal,
                reminderEnabled: !progress.goal.reminderEnabled,
              }).then(() => load())
            }
            icon={<GoalBellRinging size={32} />}
          />
          <ActionCircle
            label={ka.stepsGoal.editGoal}
            primary
            raised
            onPress={() =>
              router.push({
                pathname: '/health-metrics/steps/goal/set',
                params: { target: String(progress.goal.targetSteps), deadline: progress.goal.deadlineYmd },
              } as never)
            }
            icon={<GoalPencil size={32} color="#FFFFFF" />}
          />
          <ActionCircle
            label={ka.stepsGoal.share}
            onPress={() =>
              void Share.share({
                message: ka.stepsGoal.shareMessage(
                  formatStepsCount(progress.current),
                  formatStepsCount(progress.goal.targetSteps),
                ),
              })
            }
            icon={<GoalShare size={32} />}
          />
        </View>
      ) : null}
    </View>
  );
}

function ActionCircle({
  label,
  icon,
  onPress,
  primary = false,
  raised = false,
}: {
  label: string;
  icon: React.ReactNode;
  onPress: () => void;
  primary?: boolean;
  raised?: boolean;
}) {
  const FIGMA_STEPS = useFigmaSteps();
  return (
    <Pressable
      onPress={onPress}
      style={{
        flex: 1,
        alignItems: 'center',
        gap: 12,
        paddingBottom: raised ? 64 : 0,
      }}
    >
      <View
        style={{
          width: 64,
          height: 64,
          borderRadius: 32,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: primary ? FIGMA_STEPS.brand : FIGMA_STEPS.cardBg,
          borderWidth: primary ? 0 : 1,
          borderColor: '#D1D5DB',
          ...FIGMA_STEPS.shadowXs,
        }}
      >
        {icon}
      </View>
      <Text
        style={{
          fontFamily: 'NotoSansGeorgian_500Medium',
          fontSize: 16,
          lineHeight: 22,
          color: FIGMA_STEPS.textPrimary,
          textAlign: 'center',
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
