import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ProfileSetupPrimaryButton,
} from '@/components/profile/ProfileSetupButtons';
import { PRIVACY_POLICY_KA } from '@/constants/privacyPolicyKa';
import { ka } from '@/i18n/ka';
import { patchProfileExtra } from '@/lib/profileSetupFlow';
import { useOnboardingDevPreview, onboardingScreenBlocked, onboardingStepHref } from '@/lib/onboardingDevPreview';
import { useAuth } from '@/store/AuthContext';
import { welcomeTopInset } from '@/constants/figmaWelcomeLayout';
import { useFigmaProfileSetup } from '@/constants/figmaProfileSetupLayout';

/** Privacy policy — same copy as medicard.ge/privacy. */
export default function ProfileSetupPrivacyScreen() {
  const FIGMA_PROFILE_SETUP = useFigmaProfileSetup();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const preview = useOnboardingDevPreview();
  const { ready, user, healthProfile, setHealthProfile } = useAuth();
  const [busy, setBusy] = useState(false);
  const policy = PRIVACY_POLICY_KA;

  if (!ready) {
    return (
      <View className="flex-1 items-center justify-center bg-bg-100">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!user || !healthProfile) return <Redirect href="/(auth)/sign-in" />;
  const blocked = onboardingScreenBlocked(preview, user, healthProfile);
  if (blocked === 'assessment') return <Redirect href="/(auth)/assessment" />;
  const viewing = blocked === 'home';

  const accept = async () => {
    if (viewing) {
      router.back();
      return;
    }
    setBusy(true);
    try {
      const updated = await patchProfileExtra(healthProfile, user, {
        privacyAccepted: true,
        privacyAcceptedAt: new Date().toISOString(),
      });
      setHealthProfile(updated);
      router.replace(onboardingStepHref('/(auth)/profile-setup/notifications', preview) as never);
    } finally {
      setBusy(false);
    }
  };

  const decline = () => {
    Alert.alert(ka.profileSetup.privacyTitle, 'აპის გამოყენების გასაგრძელებლად საჭიროა პოლიტიკის დათანხმება.', [
      { text: ka.common.cancel, style: 'cancel' },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: FIGMA_PROFILE_SETUP.pageBg, paddingTop: welcomeTopInset(insets.top) }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
        <View style={{ alignItems: 'center', paddingHorizontal: 16, paddingVertical: 24, gap: 16 }}>
          <Image source={require('../../../assets/logo-light.png')} style={{ width: 48, height: 48 }} resizeMode="contain" />
          <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 30, lineHeight: 38, color: FIGMA_PROFILE_SETUP.titleColor, textAlign: 'center' }}>
            {policy.title}
          </Text>
          <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 16, color: FIGMA_PROFILE_SETUP.bodyColor }}>
            {ka.profileSetup.privacyEffective(policy.effectiveDate)}
          </Text>
          <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 14, lineHeight: 22, color: FIGMA_PROFILE_SETUP.bodyColor, textAlign: 'center' }}>
            {policy.intro}
          </Text>
        </View>

        {policy.highlight ? (
          <View
            style={{
              marginHorizontal: 16,
              marginBottom: 8,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: FIGMA_PROFILE_SETUP.inputBorder,
              backgroundColor: FIGMA_PROFILE_SETUP.cardBg,
              padding: 14,
            }}
          >
            <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 14, lineHeight: 22, color: FIGMA_PROFILE_SETUP.brand }}>
              {policy.highlight}
            </Text>
          </View>
        ) : null}

        {policy.sections.map((section) => (
          <View key={section.title} style={{ paddingHorizontal: 16, paddingVertical: 20, borderTopWidth: 1, borderTopColor: FIGMA_PROFILE_SETUP.inputBorder }}>
            <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 18, lineHeight: 26, color: FIGMA_PROFILE_SETUP.titleColor, marginBottom: 12 }}>
              {section.title}
            </Text>
            {section.intro ? (
              <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 14, lineHeight: 22, color: FIGMA_PROFILE_SETUP.bodyColor, marginBottom: 8 }}>
                {section.intro}
              </Text>
            ) : null}
            {section.paragraphs?.map((p) => (
              <Text key={p} style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 14, lineHeight: 22, color: FIGMA_PROFILE_SETUP.bodyColor, marginBottom: 8 }}>
                {p}
              </Text>
            ))}
            {section.bullets?.map((b) => (
              <Text key={b} style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 14, lineHeight: 22, color: FIGMA_PROFILE_SETUP.bodyColor, marginBottom: 6, paddingLeft: 8 }}>
                {'\u2022 '}{b}
              </Text>
            ))}
          </View>
        ))}
      </ScrollView>

      <View style={{ paddingHorizontal: 16, paddingBottom: Math.max(insets.bottom, 16), gap: 12 }}>
        <ProfileSetupPrimaryButton
          label={viewing ? ka.common.done : ka.profileSetup.privacyAccept}
          onPress={() => void accept()}
          loading={busy}
          icon="check"
        />
        {viewing ? null : (
          <ProfileSetupPrimaryButton label={ka.profileSetup.privacyDecline} onPress={decline} tone="destructive" icon="x" />
        )}
      </View>
    </View>
  );
}
