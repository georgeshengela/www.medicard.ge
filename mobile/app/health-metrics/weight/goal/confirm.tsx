import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WeightInfoRow } from '@/components/weight/WeightGoalRows';
import { WeightPrimaryButton, WeightWizardBar } from '@/components/weight/WeightChrome';
import { useFigmaWeight } from '@/constants/figmaWeightLayout';
import { ka } from '@/i18n/ka';
import { useAuth } from '@/store/AuthContext';
import {
  PACE_KG,
  clearWeightDraft,
  createWeightDraft,
  deadlineFromPace,
  draftToGoal,
  formatDeadlineKa,
  loadWeightDraft,
  reminderDaysLabel,
  saveWeightGoal,
  todayYmd,
} from '@/lib/weightGoal';
import { goToGoalStarted } from '@/lib/weightNav';
import type { WeightGoalDraft } from '@/types/weightGoal';

export default function WeightConfirmScreen() {
  const T = useFigmaWeight();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { healthProfile } = useAuth();
  const [draft, setDraft] = useState<WeightGoalDraft>(() => createWeightDraft(healthProfile?.weightKg ?? 70));

  useEffect(() => {
    void loadWeightDraft().then((saved) => {
      if (saved) setDraft((current) => ({ ...current, ...saved, startKg: healthProfile?.weightKg ?? saved.startKg }));
    });
  }, [healthProfile?.weightKg]);

  const pace = draft.pace ?? 'moderate';
  const paceLabel = pace === 'slow' ? ka.weightGoal.paceSlow : pace === 'fast' ? ka.weightGoal.paceFast : ka.weightGoal.paceModerate;

  const save = async () => {
    const complete = draftToGoal({
      ...draft,
      startedYmd: todayYmd(),
      deadlineYmd: draft.deadlineYmd ?? deadlineFromPace(draft.startKg, draft.targetKg, pace),
      paceKgPerWeek: draft.paceKgPerWeek ?? PACE_KG[pace],
    });
    if (!complete) return;
    await saveWeightGoal(complete);
    await clearWeightDraft();
    goToGoalStarted(router);
  };

  return (
    <View style={{ flex: 1, backgroundColor: T.pageBg, paddingTop: insets.top }}>
      <WeightWizardBar progress={0.9} onBack={() => router.back()} />
      <View style={{ paddingHorizontal: 16, paddingVertical: 32, gap: 12 }}>
        <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 30, lineHeight: 38, letterSpacing: -0.25, textAlign: 'center', color: T.textPrimary }}>
          {ka.weightGoal.confirmTitle}
        </Text>
        <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 16, lineHeight: 26, textAlign: 'center', color: T.textSecondary }}>
          {ka.weightGoal.confirmSubtitle}
        </Text>
      </View>
      <View style={{ paddingHorizontal: 16, gap: 8 }}>
        <WeightInfoRow
          icon="scale"
          title={ka.weightGoal.targetWeight}
          subtitle={ka.weightGoal.targetHint}
          value={`${draft.targetKg}${ka.weight.kg}`}
          onPress={() => router.push('/health-metrics/weight/goal/target' as never)}
        />
        <WeightInfoRow
          icon="calendar"
          title={ka.weightGoal.deadline}
          subtitle={ka.weightGoal.paceLine(paceLabel, String(draft.paceKgPerWeek ?? PACE_KG[pace]))}
          value={formatDeadlineKa(draft.deadlineYmd ?? todayYmd())}
          onPress={() => router.push('/health-metrics/weight/goal/pace' as never)}
        />
        <WeightInfoRow
          icon="bell"
          title={ka.weightGoal.reminder}
          subtitle={draft.reminderEnabled === false ? ka.weightGoal.reminderOff : ka.weightGoal.reminderActive}
          value={reminderDaysLabel(draft.reminderDays ?? [])}
          onPress={() => router.push('/health-metrics/weight/goal/reminder' as never)}
        />
      </View>
      <View style={{ flex: 1 }} />
      <View style={{ padding: 16, paddingBottom: Math.max(insets.bottom, 16) }}>
        <WeightPrimaryButton label={ka.weightGoal.setUpGoal} onPress={() => void save()} />
      </View>
    </View>
  );
}
