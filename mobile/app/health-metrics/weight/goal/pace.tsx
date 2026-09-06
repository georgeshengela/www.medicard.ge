import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Calendar, Pencil, Sparkles } from 'lucide-react-native';
import { GoalDeadlineCalendar } from '@/components/health/steps-goal/GoalDeadlineCalendar';
import { WeightPaceSlider } from '@/components/weight/WeightPaceSlider';
import { WeightPrimaryButton, WeightWizardBar } from '@/components/weight/WeightChrome';
import { useFigmaWeight } from '@/constants/figmaWeightLayout';
import { ka } from '@/i18n/ka';
import { useAuth } from '@/store/AuthContext';
import { bmiFromWeight } from '@/lib/bmi';
import {
  PACE_KG,
  createWeightDraft,
  deadlineFromPace,
  formatDeadlineKaLong,
  loadWeightDraft,
  recommendWeightPace,
  saveWeightDraft,
  weeksFromPace,
} from '@/lib/weightGoal';
import type { WeightPaceAdvice, WeightPaceReason } from '@/lib/weightGoal';
import type { WeightGoalDraft, WeightPace } from '@/types/weightGoal';

const PACE_LABEL: Record<WeightPace, string> = {
  slow: ka.weightGoal.paceSlow,
  moderate: ka.weightGoal.paceModerate,
  fast: ka.weightGoal.paceFast,
};

function applyPace(draft: WeightGoalDraft, pace: WeightPace, source: 'medi' | 'user'): WeightGoalDraft {
  return {
    ...draft,
    pace,
    paceKgPerWeek: PACE_KG[pace],
    deadlineYmd: deadlineFromPace(draft.startKg, draft.targetKg, pace),
    paceSource: source,
  };
}

export default function WeightPaceScreen() {
  const T = useFigmaWeight();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { healthProfile, user } = useAuth();
  const startKg = healthProfile?.weightKg ?? 70;
  const [draft, setDraft] = useState<WeightGoalDraft>(() => createWeightDraft(startKg));
  const [deadlineOpen, setDeadlineOpen] = useState(false);

  const factsFor = (start: number, target: number) => {
    const extra = (healthProfile?.extraAnswers ?? {}) as Record<string, unknown>;
    return {
      startKg: start,
      targetKg: target,
      heightCm: healthProfile?.heightCm,
      bmi: bmiFromWeight(start, healthProfile?.heightCm) ?? healthProfile?.bmi,
      age: user?.age,
      activityLevel: healthProfile?.activityLevel,
      fitnessLevel: typeof extra.fitnessLevel === 'number' ? extra.fitnessLevel : null,
      hasConditions: (healthProfile?.chronicConditions?.length ?? 0) > 0,
      smokingStatus: healthProfile?.smokingStatus,
    };
  };

  const advice = useMemo<WeightPaceAdvice>(
    () => recommendWeightPace(factsFor(draft.startKg, draft.targetKg)),
    [draft.startKg, draft.targetKg, healthProfile, user?.age],
  );

  useEffect(() => {
    let cancelled = false;
    void loadWeightDraft().then((saved) => {
      if (cancelled) return;
      const base = { ...createWeightDraft(startKg), ...saved, startKg: saved?.startKg ?? startKg };
      if (saved?.paceSource === 'user' && saved.pace) {
        setDraft(base);
        return;
      }
      const rec = recommendWeightPace(factsFor(base.startKg, base.targetKg));
      const next = applyPace(base, rec.pace, 'medi');
      setDraft(next);
      void saveWeightDraft(next);
    });
    return () => {
      cancelled = true;
    };
  }, [healthProfile, startKg, user?.age]);

  const persist = async (next: WeightGoalDraft) => {
    setDraft(next);
    await saveWeightDraft(next);
  };

  const pace = draft.pace ?? advice.pace;
  const deadlineYmd = draft.deadlineYmd ?? deadlineFromPace(draft.startKg, draft.targetKg, pace);
  const weeks = weeksFromPace(draft.startKg, draft.targetKg, pace);
  const usingMedi = pace === advice.pace;
  const lead =
    advice.direction === 'gain'
      ? ka.weightGoal.paceMediLeadGain(String(advice.deltaKg))
      : advice.direction === 'hold'
        ? ka.weightGoal.paceMediLeadHold
        : ka.weightGoal.paceMediLeadLose(String(advice.deltaKg));

  return (
    <View style={{ flex: 1, backgroundColor: T.pageBg, paddingTop: insets.top }}>
      <Stack.Screen options={{ gestureEnabled: false, fullScreenGestureEnabled: false }} />
      <WeightWizardBar progress={0.5} onBack={() => router.back()} />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 24, gap: 20 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={{ gap: 12 }}>
          <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 30, lineHeight: 38, letterSpacing: -0.25, textAlign: 'center', color: T.textPrimary }}>
            {ka.weightGoal.paceTitle}
          </Text>
          <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 16, lineHeight: 26, textAlign: 'center', color: T.textSecondary }}>
            {ka.weightGoal.paceSubtitle}
          </Text>
        </View>

        <WeightPaceSlider
          pace={pace}
          currentKg={draft.startKg}
          recommended={advice.pace}
          onChange={(nextPace) => {
            void persist(applyPace(draft, nextPace, 'user'));
          }}
        />

        <View
          style={{
            borderRadius: 20,
            borderWidth: 1,
            borderColor: usingMedi ? T.brandBorder : T.border,
            backgroundColor: usingMedi ? T.brandSoft : T.cardBg,
            padding: 16,
            gap: 14,
            ...T.shadowXs,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: T.brand,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Sparkles size={18} color="#FFFFFF" strokeWidth={2} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 16, lineHeight: 22, color: T.textPrimary }}>
                {ka.weightGoal.paceMediTitle(PACE_LABEL[advice.pace])}
              </Text>
              <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 13, lineHeight: 18, color: T.textSecondary }}>
                {usingMedi ? ka.weightGoal.paceRecommendedBadge : ka.weightGoal.paceYourChoice}
              </Text>
            </View>
          </View>

          <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 15, lineHeight: 24, color: T.textPrimary }}>
            {lead}
          </Text>

          <View style={{ gap: 8 }}>
            <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 14, lineHeight: 20, color: T.textPrimary }}>
              {ka.weightGoal.paceWhyTitle}
            </Text>
            {advice.reasonKeys.map((key: WeightPaceReason) => (
              <View key={key} style={{ flexDirection: 'row', gap: 8 }}>
                <Text style={{ color: T.brand, fontSize: 16, lineHeight: 22 }}>•</Text>
                <Text style={{ flex: 1, fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 14, lineHeight: 22, color: T.textSecondary }}>
                  {ka.weightGoal.paceReasons[key]}
                </Text>
              </View>
            ))}
          </View>

          {!usingMedi ? (
            <Pressable
              onPress={() => void persist(applyPace(draft, advice.pace, 'medi'))}
              style={{
                minHeight: 40,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: T.brandBorder,
                backgroundColor: T.surface,
                alignItems: 'center',
                justifyContent: 'center',
                paddingHorizontal: 14,
              }}
            >
              <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 14, color: T.brand }}>
                {ka.weightGoal.paceUseMedi}
              </Text>
            </Pressable>
          ) : null}

          <Pressable
            onPress={() => setDeadlineOpen(true)}
            style={{
              borderRadius: 16,
              borderWidth: 1,
              borderColor: T.border,
              backgroundColor: T.surface,
              padding: 14,
              gap: 8,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Calendar size={20} color={T.brand} strokeWidth={1.8} />
                <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 14, color: T.textPrimary }}>
                  {ka.weightGoal.paceDeadlineTitle}
                </Text>
              </View>
              <Pencil size={18} color={T.textTertiary} strokeWidth={1.8} />
            </View>
            <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 22, lineHeight: 30, color: T.textPrimary }}>
              {formatDeadlineKaLong(deadlineYmd)}
            </Text>
            <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 14, lineHeight: 22, color: T.textSecondary }}>
              {ka.weightGoal.paceDeadlineMeta(weeks, String(draft.paceKgPerWeek ?? PACE_KG[pace]))}
            </Text>
            <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 13, lineHeight: 20, color: T.textTertiary }}>
              {ka.weightGoal.paceDeadlineHint}
            </Text>
          </Pressable>

          <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 12, lineHeight: 18, color: T.textTertiary }}>
            {ka.weightGoal.paceDisclaimer}
          </Text>
        </View>
      </ScrollView>
      <View style={{ padding: 16, paddingBottom: Math.max(insets.bottom, 16) }}>
        <WeightPrimaryButton
          label={ka.weightGoal.continue}
          onPress={() => {
            void persist(draft).then(() => router.push('/health-metrics/weight/goal/reminder' as never));
          }}
        />
      </View>
      <GoalDeadlineCalendar
        visible={deadlineOpen}
        value={deadlineYmd}
        onClose={() => setDeadlineOpen(false)}
        onSelect={(ymd) => {
          void persist({ ...draft, deadlineYmd: ymd, paceSource: 'user' });
          setDeadlineOpen(false);
        }}
      />
    </View>
  );
}
