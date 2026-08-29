import React from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { APP_MODAL_PROPS } from '@/components/ui/appModal';
import { useFigmaSteps } from '@/constants/figmaStepsLayout';
import { ka } from '@/i18n/ka';
import { GoalCheck, GoalCloseX } from '@/components/health/steps-goal/StepsGoalIcons';

type Props = {
  visible: boolean;
  onClose: () => void;
};

export function GoalSetSuccessModal({ visible, onClose }: Props) {
  const FIGMA_STEPS = useFigmaSteps();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} {...APP_MODAL_PROPS} onRequestClose={onClose}>
      <View style={{ flex: 1 }}>
        {Platform.OS !== 'web' ? (
          <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFillObject} />
        ) : null}
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.2)' }]} />

        <View style={{ flex: 1, justifyContent: 'center', padding: 16 }}>
          <View
            style={{
              width: '100%',
              backgroundColor: FIGMA_STEPS.pageBg,
              borderWidth: 1,
              borderColor: FIGMA_STEPS.border,
              borderRadius: 32,
              padding: 16,
              gap: 24,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.1,
              shadowRadius: 20,
              elevation: 8,
            }}
          >
            <View style={{ alignItems: 'center', gap: 20 }}>
              <View
                style={{
                  backgroundColor: FIGMA_STEPS.brandQuaternary,
                  borderWidth: 1,
                  borderColor: FIGMA_STEPS.brandLight,
                  borderRadius: 999,
                  padding: 12,
                  ...FIGMA_STEPS.shadowXs,
                }}
              >
                <GoalCheck size={24} color={FIGMA_STEPS.brand} />
              </View>
              <View style={{ width: '100%', gap: 8 }}>
                <Text
                  style={{
                    fontFamily: 'NotoSansGeorgian_700Bold',
                    fontSize: 24,
                    lineHeight: 32,
                    letterSpacing: -0.25,
                    color: FIGMA_STEPS.textPrimary,
                    textAlign: 'center',
                  }}
                >
                  {ka.stepsGoal.successTitle}
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
                  {ka.stepsGoal.successBody}
                </Text>
              </View>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={onClose}
              style={{
                backgroundColor: FIGMA_STEPS.brand,
                minHeight: 48,
                borderRadius: 16,
                paddingHorizontal: 20,
                paddingVertical: 12,
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
                {ka.stepsGoal.successCta}
              </Text>
            </Pressable>
          </View>
        </View>

        <View style={{ alignItems: 'center', paddingBottom: Math.max(insets.bottom, 24) }}>
          <Pressable
            accessibilityRole="button"
            onPress={onClose}
            style={{
              width: 64,
              height: 64,
              borderRadius: 32,
              backgroundColor: '#1F2937',
              alignItems: 'center',
              justifyContent: 'center',
              ...FIGMA_STEPS.shadowXs,
            }}
          >
            <GoalCloseX size={32} color="#FFFFFF" />
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
