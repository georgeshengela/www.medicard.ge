import React, { useEffect, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { QuotaResetClock } from '@/components/QuotaResetClock';
import { GoalCloseX } from '@/components/health/steps-goal/StepsGoalIcons';
import { APP_MODAL_OVERLAY, APP_MODAL_PROPS } from '@/components/ui/appModal';
import { FIGMA_AUTH_SHADOW, useFigmaAuth } from '@/constants/figmaAuthLayout';
import { useFigmaHomeDashboard } from '@/constants/figmaHomeDashboardLayout';
import { ka } from '@/i18n/ka';
import { formatResetSentence } from '@/lib/format';
import { usePlanUsage } from '@/lib/planUsage';
import { useIsDark } from '@/theme/colors';

function useResetClock(resetsInMs: number | undefined, resetAt: string | null | undefined, visible: boolean) {
  const [remaining, setRemaining] = useState(() => Math.max(0, resetsInMs ?? 0));

  useEffect(() => {
    if (!visible) return;
    const fromIso = resetAt ? new Date(resetAt).getTime() : NaN;
    const deadline = Number.isFinite(fromIso) ? fromIso : Date.now() + Math.max(0, resetsInMs ?? 0);
    const tick = () => setRemaining(Math.max(0, deadline - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [visible, resetsInMs, resetAt]);

  return remaining;
}

/** Shown when the backend answers an AI request with 429, or when home analysis is exhausted. */
export function QuotaSheet({
  visible,
  resetsInMs,
  onClose,
  onUpgrade,
}: {
  visible: boolean;
  resetsInMs?: number;
  onClose: () => void;
  onUpgrade: () => void;
}) {
  const dark = useIsDark();
  const FIGMA = useFigmaHomeDashboard();
  const AUTH = useFigmaAuth();
  const plan = usePlanUsage();
  const remainingMs = useResetClock(resetsInMs ?? plan.usage?.resetsInMs, plan.usage?.resetAt, visible);
  const showClock = (resetsInMs ?? plan.usage?.resetsInMs ?? 0) > 0 || Boolean(plan.usage?.resetAt);

  return (
    <Modal visible={visible} {...APP_MODAL_PROPS} onRequestClose={onClose}>
      <View style={{ flex: 1 }}>
        {Platform.OS !== 'web' ? (
          <BlurView intensity={24} tint={dark ? 'dark' : 'light'} style={StyleSheet.absoluteFillObject} />
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={ka.common.close}
          onPress={onClose}
          style={[StyleSheet.absoluteFillObject, { backgroundColor: APP_MODAL_OVERLAY }]}
        />

        <View style={{ flex: 1, justifyContent: 'center', padding: 16 }} pointerEvents="box-none">
          <View
            style={{
              width: '100%',
              backgroundColor: FIGMA.cardBg,
              borderWidth: 1,
              borderColor: FIGMA.border,
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
            <View style={{ alignItems: 'center', gap: 16 }}>
              {showClock ? (
                <QuotaResetClock
                  remainingMs={remainingMs}
                  periodStart={plan.usage?.periodStart}
                  periodEnd={plan.usage?.periodEnd}
                  colors={{
                    brand: FIGMA.brand,
                    brandMuted: dark ? '#115E59' : '#99F6E4',
                    track: dark ? '#374151' : '#E5E7EB',
                    textPrimary: FIGMA.textPrimary,
                    textSecondary: FIGMA.textSecondary,
                    well: FIGMA.brandQuaternary,
                    wellBorder: FIGMA.brandBorder,
                  }}
                />
              ) : null}

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
                  {ka.usage.exhaustedTitle}
                </Text>
                {!plan.unlimited ? (
                  <Text
                    style={{
                      fontFamily: 'NotoSansGeorgian_700Bold',
                      fontSize: 14,
                      lineHeight: 20,
                      color: '#F43F5E',
                      textAlign: 'center',
                    }}
                  >
                    {ka.usage.exhaustedUsed(plan.used, plan.limit)}
                  </Text>
                ) : null}
                <Text
                  style={{
                    fontFamily: 'NotoSansGeorgian_400Regular',
                    fontSize: 16,
                    lineHeight: 26,
                    color: FIGMA.textSecondary,
                    textAlign: 'center',
                  }}
                >
                  {plan.usage?.resetAt ? formatResetSentence(plan.usage.resetAt) : ka.usage.exhaustedBody}
                </Text>
              </View>
            </View>

            <View style={{ gap: 10 }}>
              <Pressable
                accessibilityRole="button"
                onPress={onUpgrade}
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
                  {ka.usage.upsellCta}
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
                  {ka.usage.waitCta}
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
