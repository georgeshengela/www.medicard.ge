import React, { useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { Info } from 'lucide-react-native';
import {
  ProfileSetupLinkButton,
  ProfileSetupPrimaryButton,
} from '@/components/profile/ProfileSetupButtons';
import { ProfileSetupShell } from '@/components/profile/ProfileSetupShell';
import { AiPrivacySummary } from '@/components/privacy/AiPrivacySummary';
import disclosure from '@/config/aiDisclosure.json';
import { ApiError, api } from '@/lib/api';
import { disclosureCopy } from '@/lib/aiDisclosureCopy';
import { patchProfileExtra } from '@/lib/profileSetupFlow';
import { onboardingScreenBlocked, onboardingStepHref, useOnboardingDevPreview } from '@/lib/onboardingDevPreview';
import { useAuth } from '@/store/AuthContext';

/** Explicit AI permission — after notifications, before any onboarding analysis. */
export default function ProfileSetupAiPrivacyScreen() {
  const router = useRouter();
  const preview = useOnboardingDevPreview();
  const { ready, user, healthProfile, setHealthProfile } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const copy = disclosureCopy(disclosure);

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
  if (blocked === 'home') return <Redirect href="/(tabs)/home" />;

  const goNext = () => router.replace(onboardingStepHref('/(auth)/profile-setup/location', preview) as never);

  const choose = (allow: boolean) => {
    if (busy) return;
    void (async () => {
      setBusy(true);
      setError(null);
      try {
        if (!preview) {
          const status = await api.aiConsent.read();
          await api.aiConsent.save(allow ? 'accepted' : 'declined', status.version);
        }
        const updated = await patchProfileExtra(healthProfile, user, {
          aiPrivacyPrompted: true,
          aiPrivacyDecision: allow ? 'accepted' : 'declined',
        });
        setHealthProfile(updated);
        goNext();
      } catch (err) {
        setError(err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'არჩევანი ვერ შეინახა.');
      } finally {
        setBusy(false);
      }
    })();
  };

  return (
    <ProfileSetupShell
      title={copy.screenTitle}
      primaryLabel=""
      onPrimary={() => {}}
      showStepper={false}
      hidePrimary
      footerSlot={
        <View style={{ gap: 12, width: '100%', maxWidth: 640, alignSelf: 'center' }}>
          {error ? (
            <Text accessibilityRole="alert" style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 14, lineHeight: 20, color: '#B91C1C', textAlign: 'center' }}>
              {error}
            </Text>
          ) : null}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 8 }}>
            <Info size={18} color="#6B7280" />
            <Text style={{ flexShrink: 1, fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 13, lineHeight: 18, color: '#4B5563' }}>
              {copy.decline === 'Not Now' ? 'You can change this later in Profile.' : 'არჩევანის შეცვლა მოგვიანებით პროფილიდან შეგიძლია.'}
            </Text>
          </View>
          <ProfileSetupPrimaryButton label={copy.agree} onPress={() => choose(true)} loading={busy} icon="arrow" />
          <ProfileSetupLinkButton label={copy.decline} onPress={() => choose(false)} />
        </View>
      }
    >
      <View style={{ paddingHorizontal: 20, paddingBottom: 12 }}>
        <AiPrivacySummary manifest={disclosure} tone="onboarding" hideTitle />
      </View>
    </ProfileSetupShell>
  );
}
