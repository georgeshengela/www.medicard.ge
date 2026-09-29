import React, { useEffect } from 'react';
import { View } from 'react-native';
import { ArrowUpRight, CloudUpload, Home } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { RunFinishedView } from '@/components/run/RunFinishedView';
import { Action, Copy } from '@/components/run/PulseUi';
import { StepsGoalConfetti } from '@/components/health/steps-goal/StepsGoalConfetti';
import { ka } from '@/i18n/ka';
import { cancelRun, useRunSession } from '@/lib/run/store';
import { useThemeColors } from '@/theme/colors';
import { usePulse } from '@/lib/medipulsi/client';
import { tx } from '@/i18n/locale';

export default function RunSummaryScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const pulse = usePulse();
  const s = useRunSession();
  const summary = s.summary;

  useEffect(() => {
    if (!summary) router.replace('/run' as never);
    else if (summary.reachedPin || summary.completedTarget) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
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
        title={summary.targetMeters===0?tx('გასეირნება დასრულდა', 'Walk finished'):ka.run.summaryTitle}
        footer={
          <View style={{ gap: 10 }}>
            <View style={{ flexDirection: 'row', gap: 9, alignItems: 'center', marginBottom: 4 }}><CloudUpload size={18} color={colors.primary100} /><Copy muted size={11} style={{ flex: 1 }}>{pulse.pending > 0 ? tx('შენახულია ტელეფონში · ანგარიშზე გაგზავნას ელოდება', 'Saved on your phone · waiting to sync to your account') : tx('გასეირნების ჩანაწერი შენახულია', 'Walk record saved')}</Copy></View>
            <Action label={tx('MEDIRUN-ში დაბრუნება', 'Back to MEDIRUN')} icon={ArrowUpRight} onPress={() => leave('/run')} />
            <Action secondary label={tx('MEDICARD-ის მთავარი', 'MEDICARD home')} icon={Home} onPress={() => leave('/(tabs)/home')} />
          </View>
        }
      />
    </View>
  );
}
