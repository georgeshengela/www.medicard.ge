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
import Constants from 'expo-constants';
import {
  ProfileSetupPrimaryButton,
} from '@/components/profile/ProfileSetupButtons';
import { ka } from '@/i18n/ka';
import { patchProfileExtra } from '@/lib/profileSetupFlow';
import { useOnboardingDevPreview, onboardingScreenBlocked, onboardingStepHref } from '@/lib/onboardingDevPreview';
import { useAuth } from '@/store/AuthContext';
import { welcomeTopInset } from '@/constants/figmaWelcomeLayout';
import { useFigmaProfileSetup } from '@/constants/figmaProfileSetupLayout';

const SECTIONS = [
  {
    title: '1. რა ინფორმაციას ვაგროვებთ',
    bullets: [
      'პერსონალური მონაცემები: სახელი, ელ. ფოსტა, ტელეფონი, სქესი, დაბადების თარიღი.',
      'სამედიცინო პროფილი: სიმაღლე, წონა, ალერგიები, მედიკამენტები, ქronicული დაავადებები.',
      'ჯანმრთელობის მაჩვენებლები: არტერიული წნევა, პულსი, ძილი, აქტივობა.',
      'ტექნიკური მონაცემები: მოწყobის ტიპი და აპის ვერსია.',
    ],
  },
  {
    title: '2. როგორ ვიყენებთ ინფორმაციას',
    bullets: [
      'პერსონალიზებული ჯანმრთელობის შეფასება და AI რეკომendebuli.',
      'მედიკამენტების შეხსენებები და push შეტყობინებები (თქვენი თანხმობით).',
      'აპის გაუმჯობესება და ტექნიკური მხარდაჭერა.',
    ],
  },
  {
    title: '3. AI ანალიზი',
    paragraphs: [
      'შეფასება ხდება დაშifruлებული კავშირით OpenRouter/EvidenceMD მოდელებით. AI პასუხები საგანმანათლებლოა და არ ცვლის ექიმის კonsultationს.',
    ],
  },
  {
    title: '4. მონაცემთა გაზიარება',
    bullets: [
      'ჩვენ არ ვყიდით თქვენს ჯანმრთელობის მონაცემებს.',
      'მონაცემები გადაეცემა მხოლოდ SMS, push და hosting პროვაiderებს.',
    ],
  },
];

/** Privacy policy — Figma 8845:312418 (Georgian). */
export default function ProfileSetupPrivacyScreen() {
  const FIGMA_PROFILE_SETUP = useFigmaProfileSetup();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const preview = useOnboardingDevPreview();
  const { ready, user, healthProfile, setHealthProfile } = useAuth();
  const [busy, setBusy] = useState(false);
  const version = Constants.expoConfig?.version ?? '1.0.0';

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
          <View style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: FIGMA_PROFILE_SETUP.inputBorder, backgroundColor: FIGMA_PROFILE_SETUP.cardBg }}>
            <Text style={{ fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 12, color: FIGMA_PROFILE_SETUP.titleColor }}>v{version}</Text>
          </View>
          <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 30, lineHeight: 38, color: FIGMA_PROFILE_SETUP.titleColor, textAlign: 'center' }}>
            {ka.profileSetup.privacyTitle}
          </Text>
          <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 18, color: FIGMA_PROFILE_SETUP.bodyColor }}>
            {ka.profileSetup.privacyEffective('4 სექტემბერი, 2026')}
          </Text>
          <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 14, lineHeight: 22, color: FIGMA_PROFILE_SETUP.bodyColor, textAlign: 'center' }}>
            {ka.profileSetup.privacyIntro}
          </Text>
        </View>

        {SECTIONS.map((section) => (
          <View key={section.title} style={{ paddingHorizontal: 16, paddingVertical: 20, borderTopWidth: 1, borderTopColor: FIGMA_PROFILE_SETUP.inputBorder }}>
            <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 20, color: FIGMA_PROFILE_SETUP.titleColor, marginBottom: 12 }}>
              {section.title}
            </Text>
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
