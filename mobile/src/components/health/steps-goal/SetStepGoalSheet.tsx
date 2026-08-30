import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { APP_MODAL_OVERLAY, APP_MODAL_PROPS } from '@/components/ui/appModal';
import { useFigmaSteps } from '@/constants/figmaStepsLayout';
import { ka } from '@/i18n/ka';
import { formatStepsCount } from '@/lib/stepsMetrics.shared';
import {
  STEPS_GOAL_PRESETS,
  STEPS_GOAL_RECOMMENDED,
  STEPS_GOAL_SHEET_STEP,
  clampGoalSteps,
} from '@/lib/stepsGoal';
import {
  GoalCheck,
  GoalCloseX,
  GoalMinusCircle,
  GoalPlusCircle,
  GoalSparkle,
  GoalStepSneaker,
} from '@/components/health/steps-goal/StepsGoalIcons';
import { useIsDark } from '@/theme/colors';

type Props = {
  visible: boolean;
  value: number;
  onClose: () => void;
  onApply: (value: number) => void;
};

export function SetStepGoalSheet({ visible, value, onClose, onApply }: Props) {
  const FIGMA_STEPS = useFigmaSteps();
  const dark = useIsDark();
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    if (visible) setDraft(value);
  }, [value, visible]);

  return (
    <Modal visible={visible} {...APP_MODAL_PROPS} onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={ka.common.close}
          onPress={onClose}
          style={[StyleSheet.absoluteFillObject, { backgroundColor: APP_MODAL_OVERLAY }]}
        />

        <View style={{ width: '100%' }}>
          <View style={{ height: 28, overflow: 'hidden' }}>
            <View
              style={{
                position: 'absolute',
                left: 33,
                right: 33,
                top: 0,
                height: 36,
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
                backgroundColor: dark ? 'rgba(31,41,55,0.5)' : 'rgba(255,255,255,0.5)',
              }}
            />
            <View
              style={{
                position: 'absolute',
                left: 16,
                right: 16,
                top: 12,
                height: 36,
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
                backgroundColor: dark ? 'rgba(17,24,39,0.7)' : 'rgba(255,255,255,0.7)',
              }}
            />
          </View>

          <View
            style={{
              backgroundColor: FIGMA_STEPS.pageBg,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              marginTop: -8,
              paddingBottom: Math.max(insets.bottom, 16),
            }}
          >
            <View style={{ alignItems: 'center', paddingTop: 5, height: 16 }}>
              <View style={{ width: 36, height: 5, borderRadius: 100, backgroundColor: FIGMA_STEPS.border }} />
            </View>

            <View style={{ padding: 16, gap: 4 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                <Text
                  style={{
                    flex: 1,
                    fontFamily: 'NotoSansGeorgian_600SemiBold',
                    fontSize: 18,
                    lineHeight: 24,
                    color: FIGMA_STEPS.textPrimary,
                  }}
                >
                  {ka.stepsGoal.sheetTitle}
                </Text>
                <Pressable accessibilityRole="button" onPress={onClose} hitSlop={8}>
                  <GoalCloseX size={24} />
                </Pressable>
              </View>
              <Text
                style={{
                  fontFamily: 'NotoSansGeorgian_400Regular',
                  fontSize: 16,
                  lineHeight: 26,
                  color: FIGMA_STEPS.textSecondary,
                }}
              >
                {ka.stepsGoal.sheetSubtitle}
              </Text>
            </View>

            <View style={{ padding: 16, gap: 20 }}>
              <View style={{ gap: 24, width: '100%' }}>
                <View style={{ gap: 16, alignItems: 'center' }}>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 16,
                      paddingVertical: 12,
                      borderBottomWidth: 1,
                      borderBottomColor: FIGMA_STEPS.border,
                      width: '100%',
                    }}
                  >
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => setDraft((n) => clampGoalSteps(n - STEPS_GOAL_SHEET_STEP))}
                    >
                      <GoalMinusCircle size={32} />
                    </Pressable>
                    <Text
                      style={{
                        flex: 1,
                        fontFamily: 'NotoSansGeorgian_700Bold',
                        fontSize: 48,
                        lineHeight: 56,
                        letterSpacing: -0.75,
                        color: FIGMA_STEPS.textPrimary,
                        textAlign: 'center',
                      }}
                    >
                      {formatStepsCount(draft)}
                    </Text>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => setDraft((n) => clampGoalSteps(n + STEPS_GOAL_SHEET_STEP))}
                    >
                      <GoalPlusCircle size={32} />
                    </Pressable>
                  </View>
                  <Text
                    style={{
                      fontFamily: 'NotoSansGeorgian_400Regular',
                      fontSize: 16,
                      lineHeight: 22,
                      color: FIGMA_STEPS.textSecondary,
                      textAlign: 'center',
                      width: '100%',
                    }}
                  >
                    {ka.stepsGoal.aroundWeekly(formatStepsCount(draft))}
                  </Text>
                </View>

                <View style={{ flexDirection: 'row', gap: 12 }}>
                  {STEPS_GOAL_PRESETS.map((preset) => {
                    const selected = draft === preset;
                    return (
                      <Pressable
                        key={preset}
                        onPress={() => setDraft(preset)}
                        style={{
                          flex: 1,
                          backgroundColor: selected ? FIGMA_STEPS.brandQuaternary : FIGMA_STEPS.cardBg,
                          borderWidth: 1,
                          borderColor: selected ? FIGMA_STEPS.brand : '#D1D5DB',
                          borderRadius: 12,
                          paddingHorizontal: 10,
                          paddingVertical: 6,
                          alignItems: 'center',
                          justifyContent: 'center',
                          ...FIGMA_STEPS.shadowXs,
                        }}
                      >
                        <Text
                          style={{
                            fontFamily: 'NotoSansGeorgian_600SemiBold',
                            fontSize: 14,
                            lineHeight: 20,
                            color: selected ? FIGMA_STEPS.brand : FIGMA_STEPS.textPrimary,
                          }}
                        >
                          {preset}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View
                style={{
                  backgroundColor: dark ? '#451A03' : '#FFFBEB',
                  borderWidth: 1,
                  borderColor: '#F59E0B',
                  borderRadius: 16,
                  padding: 12,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 16,
                }}
              >
                <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <GoalSparkle size={24} />
                  <Text
                    style={{
                      flex: 1,
                      fontFamily: 'NotoSansGeorgian_600SemiBold',
                      fontSize: 16,
                      lineHeight: 22,
                      color: dark ? '#FDE68A' : '#92400E',
                    }}
                  >
                    {ka.stepsGoal.recommendation}
                  </Text>
                </View>
                <Pressable
                  onPress={() => setDraft(STEPS_GOAL_RECOMMENDED)}
                  style={{
                    backgroundColor: '#F59E0B',
                    borderRadius: 10,
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    ...FIGMA_STEPS.shadowXs,
                  }}
                >
                  <GoalStepSneaker size={20} color="#FFFFFF" />
                  <Text style={{ fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 14, color: '#FFFFFF' }}>
                    {STEPS_GOAL_RECOMMENDED}
                  </Text>
                </Pressable>
              </View>
            </View>

            <View style={{ padding: 16 }}>
              <Pressable
                accessibilityRole="button"
                onPress={() => onApply(draft)}
                style={{
                  backgroundColor: FIGMA_STEPS.brand,
                  height: 48,
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
                  {ka.stepsGoal.apply}
                </Text>
                <GoalCheck size={20} color="#FFFFFF" />
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}
