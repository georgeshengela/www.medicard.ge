import React, { useCallback, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, Scale } from 'lucide-react-native';
import { WeightAppBar, WeightPrimaryButton } from '@/components/weight/WeightChrome';
import { WeightInfoRow } from '@/components/weight/WeightGoalRows';
import { WeightLinearProgress } from '@/components/weight/WeightLinearProgress';
import { useFigmaWeight } from '@/constants/figmaWeightLayout';
import { useHealthMetrics } from '@/hooks/useHealthMetrics';
import { ka } from '@/i18n/ka';
import { useAuth } from '@/store/AuthContext';
import {
  PACE_KG,
  buildWeightProgress,
  clearWeightGoal,
  formatDeadlineKa,
  loadWeightGoal,
  loadWeightLogs,
  reminderDaysLabel,
  resolveCurrentWeightKg,
  saveWeightGoal,
} from '@/lib/weightGoal';
import { goToWeightHub, startWeightGoalWizard } from '@/lib/weightNav';
import type { WeightGoalProgress } from '@/types/weightGoal';

export default function WeightGoalProgressScreen() {
  const T = useFigmaWeight();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { healthProfile } = useAuth();
  const { bundle } = useHealthMetrics(healthProfile);
  const [progress, setProgress] = useState<WeightGoalProgress | null>(null);

  const load = useCallback(async () => {
    const goal = await loadWeightGoal();
    if (!goal) {
      setProgress(null);
      return;
    }
    const logs = await loadWeightLogs();
    const metric = bundle?.metrics.find((row) => row.key === 'weight');
    const current =
      resolveCurrentWeightKg(logs, metric?.value, healthProfile?.weightKg) ?? goal.startKg;
    const next = buildWeightProgress(goal, current);
    if (next.completed && !goal.completedSeen) {
      await saveWeightGoal({ ...goal, completedSeen: true });
      router.replace('/health-metrics/weight/goal/completed' as never);
      return;
    }
    setProgress(next);
  }, [bundle?.metrics, healthProfile?.weightKg, router]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const openMenu = () => {
    Alert.alert(ka.weightGoal.menuTitle, undefined, [
      { text: ka.weightGoal.setNewGoal, onPress: () => startWeightGoalWizard(router) },
      {
        text: ka.weightGoal.clearGoal,
        style: 'destructive',
        onPress: () => {
          void clearWeightGoal().then(() => setProgress(null));
        },
      },
      { text: ka.common.cancel, style: 'cancel' },
    ]);
  };

  if (!progress) {
    return (
      <View style={{ flex: 1, backgroundColor: T.pageBg, paddingTop: insets.top }}>
        <WeightAppBar title={ka.weightGoal.progressTitle} onBack={() => goToWeightHub(router)} onEdit={openMenu} />
        <View style={{ flex: 1, padding: 16, justifyContent: 'center', gap: 12 }}>
          <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 24, textAlign: 'center', color: T.textPrimary }}>
            {ka.weightGoal.emptyTitle}
          </Text>
          <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 16, textAlign: 'center', color: T.textSecondary }}>
            {ka.weightGoal.emptyBody}
          </Text>
        </View>
        <View style={{ padding: 16, paddingBottom: Math.max(insets.bottom, 16) }}>
          <WeightPrimaryButton label={ka.weightGoal.setNewGoal} onPress={() => startWeightGoalWizard(router)} />
        </View>
      </View>
    );
  }

  const { goal, current, remaining, percent, onTrack } = progress;
  const losing = goal.targetKg < goal.startKg;
  const line =
    remaining <= 0.15
      ? ka.weightGoal.holdSteady
      : losing
        ? ka.weightGoal.loseMore(String(remaining))
        : ka.weightGoal.gainMore(String(remaining));
  const pace = goal.pace;
  const paceLabel = pace === 'slow' ? ka.weightGoal.paceSlow : pace === 'fast' ? ka.weightGoal.paceFast : ka.weightGoal.paceModerate;

  return (
    <View style={{ flex: 1, backgroundColor: T.pageBg, paddingTop: insets.top }}>
      <WeightAppBar title={ka.weightGoal.progressTitle} onBack={() => goToWeightHub(router)} onEdit={openMenu} />
      <View style={{ paddingHorizontal: 16, paddingVertical: 32, alignItems: 'center', gap: 48 }}>
        <View style={{ alignItems: 'center', gap: 12 }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              paddingHorizontal: 6,
              paddingVertical: 4,
              borderRadius: 8,
              backgroundColor: onTrack ? T.brandSoft : T.cardBg,
              borderWidth: 1,
              borderColor: onTrack ? T.brandLight : T.border,
            }}
          >
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: onTrack ? T.brand : T.textTertiary }} />
            <Text style={{ fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 12, color: onTrack ? T.brand : T.textSecondary }}>
              {onTrack ? ka.weightGoal.onTrack : ka.weightGoal.progressTitle}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Scale size={48} color={T.brand} strokeWidth={1.8} />
            <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 48, lineHeight: 56, letterSpacing: -0.75, color: T.textPrimary }}>
              {`${current.toFixed(0)}${ka.weight.kg}`}
            </Text>
          </View>
          <Text
            style={{
              fontFamily: 'NotoSansGeorgian_400Regular',
              fontSize: 15,
              lineHeight: 22,
              color: T.textPrimary,
              textAlign: 'center',
              paddingHorizontal: 12,
            }}
          >
            {line}
          </Text>
        </View>
        <WeightLinearProgress
          percent={percent}
          startLabel={`${goal.startKg}${ka.weight.kg}`}
          endLabel={`${goal.targetKg}${ka.weight.kg}`}
        />
      </View>
      <View style={{ paddingHorizontal: 16, gap: 8 }}>
        <WeightInfoRow
          icon="scale"
          title={ka.weightGoal.targetWeight}
          subtitle={ka.weightGoal.targetHint}
          value={`${goal.targetKg}${ka.weight.kg}`}
        />
        <WeightInfoRow
          icon="calendar"
          title={ka.weightGoal.deadline}
          subtitle={ka.weightGoal.paceLine(paceLabel, String(goal.paceKgPerWeek ?? PACE_KG[pace]))}
          value={formatDeadlineKa(goal.deadlineYmd)}
        />
        <WeightInfoRow
          icon="bell"
          title={ka.weightGoal.reminder}
          subtitle={goal.reminderEnabled ? ka.weightGoal.reminderActive : ka.weightGoal.reminderOff}
          value={reminderDaysLabel(goal.reminderDays)}
        />
      </View>
      <View style={{ flex: 1 }} />
      <View style={{ padding: 16, paddingBottom: Math.max(insets.bottom, 16) }}>
        <WeightPrimaryButton
          label={ka.weightGoal.goToWeightHub}
          onPress={() => goToWeightHub(router)}
          icon={<Check size={20} color="#FFFFFF" strokeWidth={2.4} />}
        />
      </View>
    </View>
  );
}
