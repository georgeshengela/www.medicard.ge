import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { ArrowUpRight, CloudUpload, Home } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { RunFinishedView } from '@/components/run/RunFinishedView';
import { Action, Copy } from '@/components/run/PulseUi';
import { StepsGoalConfetti } from '@/components/health/steps-goal/StepsGoalConfetti';
import { cancelRun, getRunState, useRunSession } from '@/lib/run/store';
import { useThemeColors } from '@/theme/colors';
import { usePulse } from '@/lib/medipulsi/client';
import { tx } from '@/i18n/locale';

export default function RunSummaryScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const pulse = usePulse();
  const s = useRunSession();
  // The walk this screen opened with. Leaving clears the session; a summary still in the stack
  // must keep showing its walk, never turn into an empty page (owner 2026-10-10).
  const [summary] = useState(() => s.summary);

  useEffect(() => {
    if (!summary) router.dismissTo('/run' as never);
    else if (summary.reachedPin || summary.completedTarget) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!summary) return <View style={{ flex: 1, backgroundColor: colors.bg100 }} />;

  const celebrate = summary.reachedPin || summary.completedTarget;

  // Back to the hub underneath (never a second hub); Home is the one tab root (navigationGuard).
  const leave = (to: '/run' | '/(tabs)/home') => {
    if (to === '/run') router.dismissTo('/run' as never);
    else router.replace(to as never);
    // Only this finished walk: a session started since then keeps running.
    if (getRunState().phase === 'finished') cancelRun();
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg100 }}>
      {celebrate ? <StepsGoalConfetti /> : null}
      <RunFinishedView
        summary={summary}
        title={summary.targetMeters===0?tx('გასეირნება დასრულდა', 'Walk finished'):tx('ვარჯიში დასრულდა', 'Workout finished')}
        onBack={() => leave('/run')}
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
