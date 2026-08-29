import React from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';
import { ONBOARDING_DEV_STEPS, onboardingDevHref } from '@/lib/onboardingDevPreview';
import { useAuth } from '@/store/AuthContext';
import { welcomeTopInset } from '@/constants/figmaWelcomeLayout';
import { useThemeColors } from '@/theme/colors';

/** Dev menu — pick any post-OTP onboarding screen (preview=1). */
export default function ProfileSetupDevLauncherScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { ready, user } = useAuth();

  if (typeof __DEV__ === 'undefined' || !__DEV__) {
    return <Redirect href="/(auth)/welcome" />;
  }

  if (!ready) {
    return (
      <View className="flex-1 items-center justify-center bg-bg-100">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!user) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg100, paddingTop: welcomeTopInset(insets.top) }}>
      <Pressable onPress={() => router.back()} hitSlop={12} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, padding: 16 }}>
        <ChevronLeft size={24} color={colors.text100} />
        <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 16, color: colors.text100 }}>უკან</Text>
      </Pressable>

      <View style={{ paddingHorizontal: 20, paddingBottom: 12 }}>
        <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 24, color: colors.text100 }}>
          OTP-ის შემდეგ — QA
        </Text>
        <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 14, color: '#92400E', marginTop: 6 }}>
          preview რეჟimი — redirect-ები გამორთულია. API მოთხოვნები ნამდვილია.
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 24, gap: 8 }}>
        {ONBOARDING_DEV_STEPS.map((step) => (
          <Pressable
            key={step.key}
            onPress={() => router.push(onboardingDevHref(step.href) as never)}
            style={{
              padding: 16,
              borderRadius: 14,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: '#FDE68A',
            }}
          >
            <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 16, color: colors.text100 }}>
              {step.label}
            </Text>
            <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 12, color: '#9CA3AF', marginTop: 4 }}>
              {step.href}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}
