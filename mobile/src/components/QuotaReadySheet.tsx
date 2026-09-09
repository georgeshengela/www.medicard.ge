import React from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { GoalCloseX } from '@/components/health/steps-goal/StepsGoalIcons';
import { MedicardLogoMark } from '@/components/ui/MedicardLogoMark';
import { APP_MODAL_OVERLAY, APP_MODAL_PROPS } from '@/components/ui/appModal';
import { FIGMA_AUTH_SHADOW, useFigmaAuth } from '@/constants/figmaAuthLayout';
import { useFigmaHomeDashboard } from '@/constants/figmaHomeDashboardLayout';
import { ka } from '@/i18n/ka';
import { useIsDark } from '@/theme/colors';

export function QuotaReadySheet({
  visible,
  remaining,
  limit,
  onClose,
  onAskMedi,
}: {
  visible: boolean;
  remaining: number;
  limit: number;
  onClose: () => void;
  onAskMedi: () => void;
}) {
  const dark = useIsDark();
  const FIGMA = useFigmaHomeDashboard();
  const AUTH = useFigmaAuth();

  return (
    <Modal visible={visible} {...APP_MODAL_PROPS} onRequestClose={onClose}>
      <View style={{ flex: 1 }}>
        {Platform.OS !== 'web' ? (
          <BlurView intensity={24} tint={dark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={ka.common.close}
          onPress={onClose}
          style={[StyleSheet.absoluteFill, { backgroundColor: APP_MODAL_OVERLAY }]}
        />

        <View style={{ flex: 1, justifyContent: 'center', padding: 16 }} pointerEvents="box-none">
          <View
            style={{
              width: '100%',
              backgroundColor: FIGMA.cardBg,
              borderWidth: 1,
              borderColor: FIGMA.border,
              borderRadius: 32,
              padding: 20,
              gap: 24,
              ...FIGMA_AUTH_SHADOW,
              shadowOpacity: 0.12,
              shadowRadius: 20,
              elevation: 8,
            }}
          >
            <View style={{ alignItems: 'center', gap: 16 }}>
              <View
                style={{
                  width: 96,
                  height: 96,
                  borderRadius: 48,
                  backgroundColor: FIGMA.brandQuaternary,
                  borderWidth: 1,
                  borderColor: FIGMA.brandBorder,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <View
                  style={{
                    width: 72,
                    height: 72,
                    borderRadius: 36,
                    backgroundColor: AUTH.primaryBg,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <MedicardLogoMark size={44} tone="inverse" />
                </View>
              </View>

              <View style={{ width: '100%', gap: 8 }}>
                <Text
                  style={{
                    fontFamily: 'NotoSansGeorgian_700Bold',
                    fontSize: 24,
                    lineHeight: 32,
                    letterSpacing: -0.25,
                    color: FIGMA.textPrimary,
                    textAlign: 'center',
                  }}
                >
                  {ka.usage.resetReadyTitle}
                </Text>
                <Text
                  style={{
                    fontFamily: 'NotoSansGeorgian_700Bold',
                    fontSize: 14,
                    lineHeight: 20,
                    color: AUTH.primaryBg,
                    textAlign: 'center',
                  }}
                >
                  {ka.usage.remainingQueries(remaining, limit)}
                </Text>
                <Text
                  style={{
                    fontFamily: 'NotoSansGeorgian_400Regular',
                    fontSize: 16,
                    lineHeight: 26,
                    color: FIGMA.textSecondary,
                    textAlign: 'center',
                  }}
                >
                  {ka.usage.resetReadyBody(remaining, limit)}
                </Text>
              </View>
            </View>

            <View style={{ gap: 10 }}>
              <Pressable
                accessibilityRole="button"
                onPress={onAskMedi}
                style={{
                  backgroundColor: AUTH.primaryBg,
                  minHeight: 48,
                  borderRadius: 16,
                  paddingHorizontal: 20,
                  paddingVertical: 12,
                  alignItems: 'center',
                  justifyContent: 'center',
                  ...FIGMA_AUTH_SHADOW,
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
                  {ka.usage.resetReadyCta}
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={onClose}
                style={{
                  backgroundColor: dark ? '#1F2937' : '#F3F4F6',
                  minHeight: 48,
                  borderRadius: 16,
                  paddingHorizontal: 20,
                  paddingVertical: 12,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 1,
                  borderColor: FIGMA.border,
                }}
              >
                <Text
                  style={{
                    fontFamily: 'NotoSansGeorgian_600SemiBold',
                    fontSize: 16,
                    lineHeight: 22,
                    color: FIGMA.textPrimary,
                  }}
                >
                  {ka.usage.resetReadyLater}
                </Text>
              </Pressable>
            </View>
          </View>

          <View style={{ alignItems: 'center', marginTop: 10 }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={ka.common.close}
              onPress={onClose}
              style={{
                width: 64,
                height: 64,
                borderRadius: 32,
                backgroundColor: '#FFFFFF',
                alignItems: 'center',
                justifyContent: 'center',
                ...FIGMA_AUTH_SHADOW,
              }}
            >
              <GoalCloseX size={32} color="#1F2937" />
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
