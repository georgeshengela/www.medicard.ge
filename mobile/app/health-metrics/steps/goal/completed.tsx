import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import Animated, { FadeIn, FadeInUp, ZoomIn } from 'react-native-reanimated';
import { StepsGoalConfetti } from '@/components/health/steps-goal/StepsGoalConfetti';
import { GoalPlusFat } from '@/components/health/steps-goal/StepsGoalIcons';
import { useFigmaSteps } from '@/constants/figmaStepsLayout';
import { useStepsMetrics } from '@/hooks/useStepsMetrics';
import { ka } from '@/i18n/ka';
import { archiveAndClearStepsGoal, flushStepsGoalAwards, loadStepsGoal, queueStepsGoalAward, todayYmd } from '@/lib/stepsGoal';
import { fetchStepsTotalBetween } from '@/lib/stepsMetrics';
import { useAuth } from '@/store/AuthContext';

const STEPS_GOAL_POINTS = 3;

export default function StepsGoalCompletedScreen() {
  const FIGMA_STEPS = useFigmaSteps();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { setUser } = useAuth();
  const { bundle } = useStepsMetrics('1w');
  const [streak, setStreak] = useState(1);
  const [badgePoints, setBadgePoints] = useState(STEPS_GOAL_POINTS);

  useEffect(() => {
    if (bundle?.insights.streakDays) setStreak(bundle.insights.streakDays);
  }, [bundle]);

  const claim = useCallback(async () => {
    const goal = await loadStepsGoal();
    if (goal) await queueStepsGoalAward(goal.id);
    const awarded = await flushStepsGoalAwards(setUser);
    if (awarded > 0) {
      setBadgePoints(STEPS_GOAL_POINTS);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    }
    if (goal) {
      const current = await fetchStepsTotalBetween(goal.startedYmd, todayYmd());
      await archiveAndClearStepsGoal(goal, current);
    }
  }, [setUser]);

  useEffect(() => {
    void claim();
  }, [claim]);

  return (
    <View style={{ flex: 1, backgroundColor: FIGMA_STEPS.pageBg, paddingTop: insets.top, paddingBottom: insets.bottom }}>
      <StepsGoalConfetti />

      <View style={{ flex: 1, justifyContent: 'center' }}>
        <View style={{ width: '100%' }}>
          <View style={{ height: 272, width: '100%' }} />

          <Animated.View
            entering={FadeInUp.delay(120).duration(420)}
            style={{ alignItems: 'center', gap: 24, padding: 16, width: '100%' }}
          >
            <Animated.View
              entering={ZoomIn.springify().damping(12).delay(80)}
              style={{
                backgroundColor: FIGMA_STEPS.cardBg,
                borderWidth: 1,
                borderColor: '#D1D5DB',
                borderRadius: 10,
                paddingHorizontal: 10,
                paddingVertical: 6,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                ...FIGMA_STEPS.shadowXs,
              }}
            >
              <GoalPlusFat size={20} color={FIGMA_STEPS.textPrimary} />
              <Text
                style={{
                  fontFamily: 'NotoSansGeorgian_500Medium',
                  fontSize: 14,
                  lineHeight: 20,
                  color: FIGMA_STEPS.textPrimary,
                  textAlign: 'center',
                }}
              >
                {ka.stepsGoal.scoreBadge(badgePoints)}
              </Text>
            </Animated.View>

            <View style={{ gap: 16, width: '100%', alignItems: 'center' }}>
              <Text
                style={{
                  fontFamily: 'NotoSansGeorgian_700Bold',
                  fontSize: 30,
                  lineHeight: 38,
                  letterSpacing: -0.25,
                  color: FIGMA_STEPS.textPrimary,
                  textAlign: 'center',
                  width: '100%',
                }}
              >
                {ka.stepsGoal.completedTitle}
              </Text>
              <Text
                style={{
                  fontFamily: 'NotoSansGeorgian_400Regular',
                  fontSize: 16,
                  lineHeight: 26,
                  color: FIGMA_STEPS.textSecondary,
                  textAlign: 'center',
                  width: '100%',
                }}
              >
                {ka.stepsGoal.completedBody}
                {'\n'}
                {ka.stepsGoal.completedStreak(streak)}
              </Text>
            </View>
          </Animated.View>

          <Animated.View
            entering={FadeIn.delay(280).duration(360)}
            style={{ width: '100%', paddingHorizontal: 16, paddingVertical: 24, gap: 12, alignItems: 'center' }}
          >
            <Pressable
              onPress={() => router.replace('/health-metrics/steps' as never)}
              style={{
                backgroundColor: FIGMA_STEPS.brand,
                height: 48,
                minHeight: 48,
                width: '100%',
                borderRadius: 16,
                paddingHorizontal: 20,
                paddingVertical: 12,
                alignItems: 'center',
                justifyContent: 'center',
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
                {ka.stepsGoal.backToDashboard}
              </Text>
            </Pressable>
            <Pressable
              onPress={() =>
                router.replace({
                  pathname: '/health-metrics/steps/goal/set',
                  params: { fresh: '1' },
                } as never)
              }
              style={{
                backgroundColor: FIGMA_STEPS.brandQuaternary,
                borderWidth: 1,
                borderColor: FIGMA_STEPS.brandLight,
                height: 48,
                minHeight: 48,
                width: '100%',
                borderRadius: 16,
                paddingHorizontal: 20,
                paddingVertical: 12,
                alignItems: 'center',
                justifyContent: 'center',
                ...FIGMA_STEPS.shadowXs,
              }}
            >
              <Text
                style={{
                  fontFamily: 'NotoSansGeorgian_600SemiBold',
                  fontSize: 16,
                  lineHeight: 22,
                  color: FIGMA_STEPS.brand,
                }}
              >
                {ka.stepsGoal.setNewGoal}
              </Text>
            </Pressable>
          </Animated.View>
        </View>
      </View>
    </View>
  );
}
