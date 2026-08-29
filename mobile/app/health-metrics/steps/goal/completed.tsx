import React, { useCallback, useEffect, useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GoalPlusFat } from '@/components/health/steps-goal/StepsGoalIcons';
import { useFigmaSteps } from '@/constants/figmaStepsLayout';
import { ka } from '@/i18n/ka';
import { loadStepsGoal, saveStepsGoal } from '@/lib/stepsGoal';
import { useStepsMetrics } from '@/hooks/useStepsMetrics';

export default function StepsGoalCompletedScreen() {
  const FIGMA_STEPS = useFigmaSteps();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { bundle } = useStepsMetrics('1w');
  const [streak, setStreak] = useState(3);

  useEffect(() => {
    if (bundle?.insights.streakDays) setStreak(bundle.insights.streakDays);
  }, [bundle]);

  const markSeen = useCallback(async () => {
    const goal = await loadStepsGoal();
    if (goal) await saveStepsGoal({ ...goal, completedSeen: true });
  }, []);

  useEffect(() => {
    void markSeen();
  }, [markSeen]);

  return (
    <View style={{ flex: 1, backgroundColor: FIGMA_STEPS.pageBg, paddingTop: insets.top }}>
      <Image
        source={require('../../../../assets/figma/steps-goal/confetti.png')}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 375 }}
        resizeMode="cover"
      />

      <View style={{ flex: 1, justifyContent: 'center' }}>
        <View style={{ alignItems: 'center', gap: 24, padding: 16 }}>
          <View
            style={{
              backgroundColor: FIGMA_STEPS.cardBg,
              borderWidth: 1,
              borderColor: '#D1D5DB',
              borderRadius: 10,
              paddingHorizontal: 10,
              paddingVertical: 6,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              ...FIGMA_STEPS.shadowXs,
            }}
          >
            <GoalPlusFat size={20} />
            <Text
              style={{
                fontFamily: 'NotoSansGeorgian_500Medium',
                fontSize: 14,
                lineHeight: 20,
                color: FIGMA_STEPS.textPrimary,
              }}
            >
              {ka.stepsGoal.scoreBadge}
            </Text>
          </View>
          <View style={{ gap: 16, width: '100%', alignItems: 'center' }}>
            <Text
              style={{
                fontFamily: 'NotoSansGeorgian_700Bold',
                fontSize: 30,
                lineHeight: 38,
                letterSpacing: -0.25,
                color: FIGMA_STEPS.textPrimary,
                textAlign: 'center',
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
              }}
            >
              {ka.stepsGoal.completedBody}
              {'\n'}
              {ka.stepsGoal.completedStreak(streak)}
            </Text>
          </View>
        </View>
      </View>

      <View style={{ paddingHorizontal: 16, paddingTop: 24, paddingBottom: insets.bottom + 16, gap: 12 }}>
        <Pressable
          onPress={() => router.replace('/health-metrics/steps' as never)}
          style={{
            backgroundColor: FIGMA_STEPS.brand,
            height: 48,
            borderRadius: 16,
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
            borderRadius: 16,
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
      </View>
    </View>
  );
}
