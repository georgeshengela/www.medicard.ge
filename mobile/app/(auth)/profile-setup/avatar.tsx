import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { AvatarCarousel } from '@/components/profile/AvatarCarousel';
import { ProfileSetupShell } from '@/components/profile/ProfileSetupShell';
import { defaultAvatarForGender, isAvatarId, type AvatarId } from '@/constants/avatarAssets';
import { ka } from '@/i18n/ka';
import { ApiError, api } from '@/lib/api';
import { extraAnswersPayload, formFromProfile, fullProfilePayload } from '@/lib/assessmentForm';
import { needsHealthAssessment, needsProfileSetup, useAuth } from '@/store/AuthContext';

export default function ProfileSetupAvatarScreen() {
  const router = useRouter();
  const { user, ready, healthProfile, refreshHealthProfile } = useAuth();
  const [avatarId, setAvatarId] = useState<AvatarId>(defaultAvatarForGender(user?.gender ?? null));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!healthProfile) return;
    const extra = (healthProfile.extraAnswers ?? {}) as Record<string, unknown>;
    const stored = extra.avatarId;
    if (typeof stored === 'string' && isAvatarId(stored)) {
      setAvatarId(stored);
    }
  }, [healthProfile]);

  if (!ready) {
    return (
      <View className="flex-1 items-center justify-center bg-bg-100">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!user) return <Redirect href="/(auth)/sign-in" />;
  if (needsHealthAssessment(healthProfile)) return <Redirect href="/(auth)/assessment" />;
  if (!needsProfileSetup(healthProfile)) return <Redirect href="/(tabs)/home" />;

  const saveAvatarAndContinue = async () => {
    setBusy(true);
    setError(null);
    try {
      const form = formFromProfile(healthProfile, user);
      await api.healthProfile.update({
        ...fullProfilePayload(form, healthProfile?.currentStepIndex ?? 0),
        extraAnswers: {
          ...extraAnswersPayload(form),
          assessmentPhaseComplete: true,
          avatarId,
        },
      });
      await refreshHealthProfile();
      router.push('/(auth)/profile-setup/phone');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : ka.common.error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <ProfileSetupShell
      title={ka.profileSetup.avatarTitle}
      primaryLabel={ka.assessment.continue}
      canBack
      onBack={() => router.back()}
      loading={busy}
      onPrimary={() => void saveAvatarAndContinue()}
      showStepper={false}
    >
      <AvatarCarousel value={avatarId} onChange={setAvatarId} />
      {error ? (
        <View className="mx-4 mt-2 rounded-2xl border border-state-danger/20 bg-state-dangerBg p-3">
          <Text className="font-sans text-sm text-state-danger">{error}</Text>
        </View>
      ) : null}
    </ProfileSetupShell>
  );
}
