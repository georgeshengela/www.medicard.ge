import React, { useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { RunFinishedView } from '@/components/run/RunFinishedView';
import { BetaPill } from '@/components/run/HomeRunSection';
import { StepsGoalConfetti } from '@/components/health/steps-goal/StepsGoalConfetti';
import { ka } from '@/i18n/ka';
import { cancelRun, useRunSession } from '@/lib/run/store';
import { useIsDark, useThemeColors } from '@/theme/colors';

export default function RunSummaryScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const dark = useIsDark();
  const s = useRunSession();
  const summary = s.summary;

  useEffect(() => {
    if (!summary) router.replace('/run' as never);
    else if (summary.reachedPin || summary.completedTarget) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!summary) return <View style={{ flex: 1, backgroundColor: colors.bg100 }} />;

  const celebrate = summary.reachedPin || summary.completedTarget;

  const leave = (to: '/run' | '/(tabs)/home') => {
    cancelRun();
    router.replace(to as never);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg100 }}>
      {celebrate ? <StepsGoalConfetti /> : null}
      <RunFinishedView
        summary={summary}
        title={ka.run.summaryTitle}
        headerLeft={<BetaPill />}
        footer={
          <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 16, marginTop: 18 }}>
            <Pressable
              accessibilityRole="button"
              onPress={() => leave('/run')}
              style={{ flex: 1, height: 54, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg200, borderWidth: 1, borderColor: colors.bg300 }}
            >
              <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 15, color: colors.text200 }}>{ka.run.summaryAgain}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => leave('/(tabs)/home')}
              style={{ flex: 1.3, height: 54, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: dark ? '#0D9488' : colors.primary200 }}
            >
              <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 15, color: '#FFFFFF' }}>{ka.run.summaryDone}</Text>
            </Pressable>
          </View>
        }
      />
    </View>
  );
}
