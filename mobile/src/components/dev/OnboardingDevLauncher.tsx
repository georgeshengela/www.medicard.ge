import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { FlaskConical } from 'lucide-react-native';
import { APP_MODAL_PROPS } from '@/components/ui/appModal';
import {
  ONBOARDING_DEV_STEPS,
  ONBOARDING_QA_GROUP_LABELS,
  ONBOARDING_QA_GROUPS,
  onboardingDevHref,
  type OnboardingQaGroup,
  type OnboardingQaStep,
} from '@/lib/onboardingDevPreview';
import { useAuth } from '@/store/AuthContext';
import { useThemeColors } from '@/theme/colors';

type Props = {
  /** 'fab' = floating button; 'inline' = full-width bar on welcome */
  variant?: 'fab' | 'inline';
};

function stepNeedsUser(step: OnboardingQaStep) {
  return step.needsUser !== false;
}

export function OnboardingQaStepList({
  onPick,
  user,
  showHref = false,
}: {
  onPick: (href: string) => void;
  user: unknown;
  showHref?: boolean;
}) {
  const colors = useThemeColors();

  return (
    <>
      {ONBOARDING_QA_GROUPS.map((group: OnboardingQaGroup) => {
        const steps = ONBOARDING_DEV_STEPS.filter((step) => step.group === group);
        if (steps.length === 0) return null;
        return (
          <View key={group} style={{ marginBottom: 16 }}>
            <Text
              style={{
                fontFamily: 'NotoSansGeorgian_700Bold',
                fontSize: 13,
                color: colors.text300,
                marginBottom: 6,
                letterSpacing: 0.4,
              }}
            >
              {ONBOARDING_QA_GROUP_LABELS[group]}
            </Text>
            {steps.map((step) => {
              const locked = stepNeedsUser(step) && !user;
              return (
                <Pressable
                  key={step.key}
                  disabled={locked}
                  onPress={() => onPick(onboardingDevHref(step.href))}
                  style={{
                    paddingVertical: 13,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.bg200,
                    opacity: locked ? 0.4 : 1,
                  }}
                >
                  <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 15, color: '#14B8A6' }}>
                    {step.label}
                  </Text>
                  {showHref ? (
                    <Text
                      style={{
                        fontFamily: 'NotoSansGeorgian_400Regular',
                        fontSize: 12,
                        color: '#9CA3AF',
                        marginTop: 4,
                      }}
                    >
                      {step.href}
                    </Text>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        );
      })}
    </>
  );
}

/** __DEV__ only — jump to any onboarding screen for QA. */
export function OnboardingDevLauncher({ variant = 'fab' }: Props) {
  const router = useRouter();
  const { user } = useAuth();
  const colors = useThemeColors();
  const [open, setOpen] = useState(false);

  if (typeof __DEV__ === 'undefined' || !__DEV__) return null;

  const goLauncher = () => router.push('/(auth)/profile-setup/dev-launcher' as never);

  if (variant === 'inline') {
    return (
      <View style={{ paddingHorizontal: 20, paddingBottom: 24, gap: 8 }}>
        <Pressable
          accessibilityRole="button"
          onPress={goLauncher}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            paddingVertical: 12,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: '#F59E0B',
            backgroundColor: '#FFFBEB',
          }}
        >
          <FlaskConical size={18} color="#D97706" />
          <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 14, color: '#B45309' }}>
            DEV: Onboarding QA
          </Text>
        </Pressable>
        <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 12, color: '#92400E', textAlign: 'center' }}>
          {user ? 'შესვლა · შეფასება · პროფილი' : 'შესვლის ეკრანები ღიაა — შეფასება შესვლის შემდეგ'}
        </Text>
      </View>
    );
  }

  return (
    <>
      <Pressable
        accessibilityRole="button"
        onPress={() => setOpen(true)}
        style={{
          position: 'absolute',
          right: 16,
          bottom: 100,
          width: 48,
          height: 48,
          borderRadius: 24,
          backgroundColor: '#F59E0B',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 999,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.15,
          shadowRadius: 4,
          elevation: 4,
        }}
      >
        <FlaskConical size={22} color="#FFFFFF" />
      </Pressable>

      <Modal visible={open} {...APP_MODAL_PROPS} onRequestClose={() => setOpen(false)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }} onPress={() => setOpen(false)}>
          <View
            style={{
              marginTop: 'auto',
              maxHeight: '80%',
              backgroundColor: colors.surface,
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              padding: 20,
            }}
          >
            <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 18, color: colors.text100, marginBottom: 4 }}>
              Onboarding QA
            </Text>
            <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 13, color: colors.text300, marginBottom: 16 }}>
              {user ? 'აირჩიეთ ნებისმიერი ეკრანი' : 'შესვლის ეკრანები ღიაა — დანარჩენი შესვლის შემდეგ'}
            </Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              <OnboardingQaStepList
                user={user}
                onPick={(href) => {
                  setOpen(false);
                  router.push(href as never);
                }}
              />
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}
