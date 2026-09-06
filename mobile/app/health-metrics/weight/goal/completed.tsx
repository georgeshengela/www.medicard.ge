import React, { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Plus, Scale } from 'lucide-react-native';
import { StepsGoalConfetti } from '@/components/health/steps-goal/StepsGoalConfetti';
import { WeightAppBar, WeightPrimaryButton } from '@/components/weight/WeightChrome';
import { WeightInfoRow } from '@/components/weight/WeightGoalRows';
import { WeightLinearProgress } from '@/components/weight/WeightLinearProgress';
import { useFigmaWeight } from '@/constants/figmaWeightLayout';
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
} from '@/lib/weightGoal';
import { goToWeightHub, startWeightGoalWizard } from '@/lib/weightNav';
import type { WeightGoalProgress } from '@/types/weightGoal';

export default function WeightGoalCompletedScreen() {
  const T = useFigmaWeight();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { healthProfile } = useAuth();
  const [progress, setProgress] = useState<WeightGoalProgress | null>(null);

  const load = useCallback(async () => {
    const goal = await loadWeightGoal();
    if (!goal) return;
    const logs = await loadWeightLogs();
    const current = logs[0]?.kg ?? healthProfile?.weightKg ?? goal.targetKg;
    setProgress(buildWeightProgress(goal, current));
  }, [healthProfile?.weightKg]);

  useEffect(() => {
    void load();
  }, [load]);

  const restart = async () => {
    await clearWeightGoal();
    startWeightGoalWizard(router);
  };

  const goal = progress?.goal;
  const current = progress?.current ?? goal?.targetKg ?? 0;
  const pace = goal?.pace ?? 'moderate';
  const paceLabel = pace === 'slow' ? ka.weightGoal.paceSlow : pace === 'fast' ? ka.weightGoal.paceFast : ka.weightGoal.paceModerate;

  return (
    <View style={{ flex: 1, backgroundColor: T.pageBg, paddingTop: insets.top }}>
      <StepsGoalConfetti />
      <WeightAppBar title={ka.weightGoal.progressTitle} onBack={() => goToWeightHub(router)} />
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
              backgroundColor: T.successSoft,
              borderWidth: 1,
              borderColor: T.successBorder,
            }}
          >
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: T.success }} />
            <Text style={{ fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 12, color: T.success }}>{ka.weightGoal.completed}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Scale size={48} color={T.brand} strokeWidth={1.8} />
            <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 48, lineHeight: 56, letterSpacing: -0.75, color: T.textPrimary }}>
              {`${current.toFixed(0)}${ka.weight.kg}`}
            </Text>
          </View>
          <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 20, lineHeight: 28, color: T.textPrimary }}>
            {ka.weightGoal.youCompleted}
          </Text>
        </View>
        <WeightLinearProgress
          percent={100}
          startLabel={`${goal?.startKg ?? current}${ka.weight.kg}`}
          endLabel={`${goal?.targetKg ?? current}${ka.weight.kg}`}
          completed
        />
      </View>
      {goal ? (
        <View style={{ paddingHorizontal: 16, gap: 8 }}>
          <WeightInfoRow icon="scale" title={ka.weightGoal.targetWeight} subtitle={ka.weightGoal.targetHint} value={`${goal.targetKg}${ka.weight.kg}`} />
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
      ) : null}
      <View style={{ flex: 1 }} />
      <View style={{ padding: 16, paddingBottom: Math.max(insets.bottom, 16) }}>
        <WeightPrimaryButton
          label={ka.weightGoal.setNewGoal}
          onPress={() => void restart()}
          icon={<Plus size={20} color="#FFFFFF" strokeWidth={2.4} />}
        />
      </View>
    </View>
  );
}
