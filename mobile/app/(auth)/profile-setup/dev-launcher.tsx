import React from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';
import { OnboardingQaStepList } from '@/components/dev/OnboardingDevLauncher';
import { useAuth } from '@/store/AuthContext';
import { welcomeTopInset } from '@/constants/figmaWelcomeLayout';
import { useThemeColors } from '@/theme/colors';

/** Dev menu — pick any onboarding screen (preview=1). */
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

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg100, paddingTop: welcomeTopInset(insets.top) }}>
      <Pressable onPress={() => router.back()} hitSlop={12} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, padding: 16 }}>
        <ChevronLeft size={24} color={colors.text100} />
        <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 16, color: colors.text100 }}>უკან</Text>
      </Pressable>

      <View style={{ paddingHorizontal: 20, paddingBottom: 12 }}>
        <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 24, color: colors.text100 }}>
          Onboarding QA
        </Text>
        <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 14, color: '#92400E', marginTop: 6 }}>
          preview რეჟიმი — redirect-ები გამორთულია. შეფასების ნაბიჯები არ ინახება პროფილში.
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 24 }}>
        <OnboardingQaStepList
          user={user}
          showHref
          onPick={(href) => router.push(href as never)}
        />
      </ScrollView>
    </View>
  );
}
