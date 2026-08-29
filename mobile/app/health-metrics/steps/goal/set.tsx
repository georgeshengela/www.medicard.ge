import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GoalSetSuccessModal } from '@/components/health/steps-goal/GoalSetSuccessModal';
import { GoalPickSheet, reminderTimeItems, upcomingDeadlineItems } from '@/components/health/steps-goal/GoalPickSheet';
import { GoalToggle } from '@/components/health/steps-goal/GoalToggle';
import { SetStepGoalSheet } from '@/components/health/steps-goal/SetStepGoalSheet';
import {
  GoalCalendar,
  GoalCheck,
  GoalChevronDown,
  GoalChevronLeft,
  GoalClock,
  GoalMinus,
  GoalPlus,
  GoalStepSneaker,
  GoalBellRinging,
} from '@/components/health/steps-goal/StepsGoalIcons';
import { useFigmaSteps } from '@/constants/figmaStepsLayout';
import { ka } from '@/i18n/ka';
import {
  STEPS_GOAL_FIELD_STEP,
  WEEKDAY_LETTERS,
  clampGoalSteps,
  createStepsGoalDraft,
  daysBetween,
  formatDeadlineKa,
  formatReminderTime,
  loadStepsGoal,
  reminderDaysLabel,
  saveStepsGoal,
  todayYmd,
} from '@/lib/stepsGoal';
import { formatStepsCount } from '@/lib/stepsMetrics.shared';
import type { StepsGoal } from '@/types/stepsGoal';

export default function SetStepsGoalScreen() {
  const FIGMA_STEPS = useFigmaSteps();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ target?: string; deadline?: string; fresh?: string }>();
  const isFresh = params.fresh === '1';
  const [draft, setDraft] = useState<StepsGoal>(() => {
    const base = createStepsGoalDraft();
    const target = Number(params.target);
    if (Number.isFinite(target) && target > 0) base.targetSteps = clampGoalSteps(target);
    if (typeof params.deadline === 'string' && params.deadline.length === 10) base.deadlineYmd = params.deadline;
    return base;
  });
  const [amountOpen, setAmountOpen] = useState(false);
  const [deadlineOpen, setDeadlineOpen] = useState(false);
  const [timeOpen, setTimeOpen] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);

  useEffect(() => {
    if (isFresh) return;
    void loadStepsGoal().then((saved) => {
      if (!saved) return;
      setDraft((current) => ({
        ...saved,
        targetSteps: current.targetSteps || saved.targetSteps,
        deadlineYmd: current.deadlineYmd || saved.deadlineYmd,
      }));
    });
  }, [isFresh]);

  const daysOut = Math.max(0, daysBetween(todayYmd(), draft.deadlineYmd));
  const deadlineItems = useMemo(() => upcomingDeadlineItems(), []);
  const timeItems = useMemo(() => reminderTimeItems(), []);

  const save = async () => {
    const existing = isFresh ? null : await loadStepsGoal();
    await saveStepsGoal({
      ...draft,
      id: existing?.id ?? draft.id,
      startedYmd: existing?.startedYmd ?? todayYmd(),
      completedSeen: undefined,
    });
    setSuccessOpen(true);
  };

  return (
    <View style={{ flex: 1, backgroundColor: FIGMA_STEPS.pageBg, paddingTop: insets.top }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 56, paddingHorizontal: 16, paddingVertical: 8, gap: 12 }}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} hitSlop={12}>
          <GoalChevronLeft size={24} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24 }} showsVerticalScrollIndicator={false}>
        <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16, gap: 8 }}>
          <Text
            style={{
              fontFamily: 'NotoSansGeorgian_700Bold',
              fontSize: 30,
              lineHeight: 38,
              letterSpacing: -0.25,
              color: FIGMA_STEPS.textPrimary,
            }}
          >
            {ka.stepsGoal.setTitle}
          </Text>
          <Text
            style={{
              fontFamily: 'NotoSansGeorgian_400Regular',
              fontSize: 16,
              lineHeight: 26,
              color: FIGMA_STEPS.textSecondary,
            }}
          >
            {ka.stepsGoal.setSubtitle}
          </Text>
        </View>

        <View style={{ paddingHorizontal: 16, paddingVertical: 8, gap: 16 }}>
          <View style={{ gap: 8 }}>
            <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 14, lineHeight: 20, color: FIGMA_STEPS.textPrimary }}>
              {ka.stepsGoal.stepCount}
            </Text>
            <Pressable
              onPress={() => setAmountOpen(true)}
              style={{
                minHeight: 48,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: FIGMA_STEPS.border,
                backgroundColor: FIGMA_STEPS.tooltipBg,
                flexDirection: 'row',
                alignItems: 'center',
                overflow: 'hidden',
                ...FIGMA_STEPS.shadowXs,
              }}
            >
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10 }}>
                <GoalStepSneaker size={20} />
                <Text
                  style={{
                    flex: 1,
                    fontFamily: 'NotoSansGeorgian_400Regular',
                    fontSize: 16,
                    lineHeight: 22,
                    color: FIGMA_STEPS.textSecondary,
                  }}
                >
                  {formatStepsCount(draft.targetSteps)}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', borderLeftWidth: 1, borderLeftColor: '#D1D5DB' }}>
                <Pressable
                  onPress={() => setDraft((g) => ({ ...g, targetSteps: clampGoalSteps(g.targetSteps - STEPS_GOAL_FIELD_STEP) }))}
                  style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}
                >
                  <GoalMinus size={20} />
                </Pressable>
                <Pressable
                  onPress={() => setDraft((g) => ({ ...g, targetSteps: clampGoalSteps(g.targetSteps + STEPS_GOAL_FIELD_STEP) }))}
                  style={{
                    width: 48,
                    height: 48,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: 1,
                    borderColor: '#D1D5DB',
                  }}
                >
                  <GoalPlus size={20} />
                </Pressable>
              </View>
            </Pressable>
          </View>

          <View style={{ gap: 8 }}>
            <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 14, lineHeight: 20, color: FIGMA_STEPS.textPrimary }}>
              {ka.stepsGoal.deadline}
            </Text>
            <Pressable
              onPress={() => setDeadlineOpen(true)}
              style={{
                minHeight: 48,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: '#D1D5DB',
                paddingHorizontal: 12,
                paddingVertical: 10,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                ...FIGMA_STEPS.shadowXs,
              }}
            >
              <GoalCalendar size={20} />
              <Text style={{ flex: 1, fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 16, color: FIGMA_STEPS.textSecondary }}>
                {formatDeadlineKa(draft.deadlineYmd)}
              </Text>
              <GoalChevronDown size={20} />
            </Pressable>
            <Text
              style={{
                fontFamily: 'NotoSansGeorgian_400Regular',
                fontSize: 14,
                lineHeight: 20,
                color: FIGMA_STEPS.textSecondary,
              }}
            >
              {ka.stepsGoal.daysFromNow(daysOut)}
            </Text>
          </View>
        </View>

        <View style={{ paddingHorizontal: 16, paddingVertical: 8 }}>
          <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 14, lineHeight: 20, color: FIGMA_STEPS.textPrimary }}>
            {ka.stepsGoal.reminder}
          </Text>
        </View>

        <View style={{ paddingHorizontal: 16, paddingTop: 4 }}>
          <View
            style={{
              backgroundColor: FIGMA_STEPS.cardBg,
              borderWidth: 1,
              borderColor: '#E5E7EB',
              borderRadius: 24,
              overflow: 'hidden',
              ...FIGMA_STEPS.shadowXs,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 }}>
              <GoalBellRinging size={24} />
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 14, color: FIGMA_STEPS.textPrimary }}>
                  {ka.stepsGoal.reminderToggle}
                </Text>
                <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 14, color: FIGMA_STEPS.textSecondary }}>
                  {ka.stepsGoal.reminderToggleHint}
                </Text>
              </View>
              <GoalToggle
                value={draft.reminderEnabled}
                onValueChange={(reminderEnabled) => setDraft((g) => ({ ...g, reminderEnabled }))}
              />
            </View>

            {draft.reminderEnabled ? (
              <View style={{ padding: 16, gap: 12, borderTopWidth: 1, borderTopColor: '#E5E7EB' }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  {WEEKDAY_LETTERS.map((letter, index) => {
                    const selected = draft.reminderDays.includes(index);
                    return (
                      <Pressable
                        key={`${letter}-${index}`}
                        onPress={() =>
                          setDraft((g) => ({
                            ...g,
                            reminderDays: selected
                              ? g.reminderDays.filter((d) => d !== index)
                              : [...g.reminderDays, index],
                          }))
                        }
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 999,
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: selected ? FIGMA_STEPS.brandQuaternary : FIGMA_STEPS.cardBg,
                          borderWidth: 1,
                          borderColor: selected ? FIGMA_STEPS.brand : '#D1D5DB',
                          ...FIGMA_STEPS.shadowXs,
                        }}
                      >
                        <Text
                          style={{
                            fontFamily: 'NotoSansGeorgian_600SemiBold',
                            fontSize: 16,
                            lineHeight: 22,
                            color: selected ? FIGMA_STEPS.brand : FIGMA_STEPS.textPrimary,
                          }}
                        >
                          {letter}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                  <Text
                    style={{
                      flex: 1,
                      fontFamily: 'NotoSansGeorgian_400Regular',
                      fontSize: 14,
                      lineHeight: 20,
                      color: FIGMA_STEPS.textSecondary,
                    }}
                  >
                    {ka.stepsGoal.remindAt(reminderDaysLabel(draft.reminderDays))}
                  </Text>
                  <Pressable
                    onPress={() => setTimeOpen(true)}
                    style={{
                      width: 132,
                      minHeight: 48,
                      borderRadius: 14,
                      borderWidth: 1,
                      borderColor: '#D1D5DB',
                      paddingHorizontal: 12,
                      paddingVertical: 10,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 12,
                      ...FIGMA_STEPS.shadowXs,
                    }}
                  >
                    <Text style={{ flex: 1, fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 16, color: FIGMA_STEPS.textSecondary }}>
                      {formatReminderTime(draft.reminderHour, draft.reminderMinute)}
                    </Text>
                    <GoalClock size={20} />
                  </Pressable>
                </View>
              </View>
            ) : null}
          </View>
        </View>

        <View style={{ padding: 16 }}>
          <Pressable
            accessibilityRole="button"
            onPress={() => void save()}
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
              {ka.stepsGoal.setGoal}
            </Text>
            <GoalCheck size={20} color="#FFFFFF" />
          </Pressable>
        </View>
      </ScrollView>

      <SetStepGoalSheet
        visible={amountOpen}
        value={draft.targetSteps}
        onClose={() => setAmountOpen(false)}
        onApply={(targetSteps) => {
          setDraft((g) => ({ ...g, targetSteps }));
          setAmountOpen(false);
        }}
      />
      <GoalPickSheet
        visible={deadlineOpen}
        title={ka.stepsGoal.pickDeadline}
        items={deadlineItems}
        selectedKey={draft.deadlineYmd}
        onClose={() => setDeadlineOpen(false)}
        onSelect={(deadlineYmd) => setDraft((g) => ({ ...g, deadlineYmd }))}
      />
      <GoalPickSheet
        visible={timeOpen}
        title={ka.stepsGoal.pickTime}
        items={timeItems}
        selectedKey={`${draft.reminderHour}:${draft.reminderMinute}`}
        onClose={() => setTimeOpen(false)}
        onSelect={(key) => {
          const [hour, minute] = key.split(':').map(Number);
          setDraft((g) => ({ ...g, reminderHour: hour, reminderMinute: minute }));
        }}
      />
      <GoalSetSuccessModal
        visible={successOpen}
        onClose={() => {
          setSuccessOpen(false);
          router.replace('/health-metrics/steps/goal' as never);
        }}
      />
    </View>
  );
}
