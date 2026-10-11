import React, { useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { Info } from 'lucide-react-native';
import { QuietAction } from '@/components/onboarding/OnboardingKit';
import { VelvetButton } from '@/components/velvet/VelvetButton';
import { VelvetNotice } from '@/components/velvet/VelvetNotice';
import { ProfileSetupShell } from '@/components/profile/ProfileSetupShell';
import { AiPrivacySummary } from '@/components/privacy/AiPrivacySummary';
import disclosure from '@/config/aiDisclosure.json';
import { ApiError, api } from '@/lib/api';
import { disclosureCopy } from '@/lib/aiDisclosureCopy';
import { patchProfileExtra } from '@/lib/profileSetupFlow';
import { onboardingScreenBlocked, onboardingStepHref, useOnboardingDevPreview } from '@/lib/onboardingDevPreview';
import { useAuth } from '@/store/AuthContext';
import { tx } from '@/i18n/locale';
import { ONBOARDING_COUNTED_QUESTIONS } from '@/constants/assessmentSteps';
import { useVelvet } from '@/theme/velvet';

/** Explicit AI permission — voluntary, never pre-accepted, before any AI request. */
export default function ProfileSetupAiPrivacyScreen() {
  const router = useRouter();
  const preview = useOnboardingDevPreview();
  const { ready, user, healthProfile, setHealthProfile } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const copy = disclosureCopy(disclosure);
  const { palette: p } = useVelvet();

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

  const goNext = () => router.replace(onboardingStepHref('/(auth)/profile-setup/notifications', preview) as never);

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
        setError(err instanceof ApiError ? err.message : err instanceof Error ? err.message : tx('არჩევანი ვერ შეინახა.', "Couldn't save your choice."));
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
      velvetStep={ONBOARDING_COUNTED_QUESTIONS}
      footerSlot={
        <View style={{ gap: 4, width: '100%', maxWidth: 640, alignSelf: 'center' }}>
          {error ? <VelvetNotice palette={p} text={error} /> : null}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 8, paddingBottom: 6 }}>
            <Info size={16} color={p.inkOff} />
            <Text style={{ flexShrink: 1, fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 13, lineHeight: 18, color: p.inkOff }}>
              {copy.decline === 'Not Now' ? 'You can change this later in Profile.' : 'არჩევანის შეცვლა მოგვიანებით პროფილიდან შეგიძლია.'}
            </Text>
          </View>
          <VelvetButton palette={p} label={copy.agree} onPress={() => choose(true)} busy={busy} />
          <QuietAction palette={p} label={copy.decline} onPress={() => choose(false)} disabled={busy} />
        </View>
      }
    >
      <AiPrivacySummary manifest={disclosure} tone="onboarding" hideTitle palette={p} />
    </ProfileSetupShell>
  );
}
