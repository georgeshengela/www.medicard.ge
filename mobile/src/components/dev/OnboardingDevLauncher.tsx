import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { FlaskConical } from 'lucide-react-native';
import { APP_MODAL_PROPS } from '@/components/ui/appModal';
import { ONBOARDING_DEV_STEPS, onboardingDevHref } from '@/lib/onboardingDevPreview';
import { useAuth } from '@/store/AuthContext';
import { useThemeColors } from '@/theme/colors';

type Props = {
  /** 'fab' = floating button; 'inline' = full-width bar on welcome */
  variant?: 'fab' | 'inline';
};

/** __DEV__ only — jump to post-OTP onboarding screens for QA. */
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
            DEV: ტესტი — OTP-ის შემდეგ
          </Text>
        </Pressable>
        {!user ? (
          <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 12, color: '#92400E', textAlign: 'center' }}>
            შესვლის შემდეგ ნაბიჯების preview
          </Text>
        ) : null}
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
          <View style={{ marginTop: 'auto', maxHeight: '70%', backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 }}>
            <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 18, color: colors.text100, marginBottom: 4 }}>
              Onboarding QA
            </Text>
            <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 13, color: colors.text300, marginBottom: 16 }}>
              {user ? 'აირჩიეთ ეკრანი' : 'ჯერ შედით ანგარიშში'}
            </Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {ONBOARDING_DEV_STEPS.map((step) => (
                <Pressable
                  key={step.key}
                  disabled={!user}
                  onPress={() => {
                    setOpen(false);
                    router.push(onboardingDevHref(step.href) as never);
                  }}
                  style={{
                    paddingVertical: 14,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.bg200,
                    opacity: user ? 1 : 0.45,
                  }}
                >
                  <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 15, color: '#14B8A6' }}>
                    {step.label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}
