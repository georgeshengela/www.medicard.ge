import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Text, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import * as LocalAuthentication from 'expo-local-authentication';
import { Fingerprint, ScanFace } from 'lucide-react-native';
import {
  ProfileSetupLinkButton,
  ProfileSetupPrimaryButton,
} from '@/components/profile/ProfileSetupButtons';
import { ProfileSetupShell } from '@/components/profile/ProfileSetupShell';
import { useFigmaProfileSetup } from '@/constants/figmaProfileSetupLayout';
import { ka } from '@/i18n/ka';
import {
  getBiometricCapability,
  shouldShowBiometricSetup,
  type BiometricCapability,
  type BiometricKind,
} from '@/lib/biometricCapability';
import { patchProfileExtra, setBiometricEnabled } from '@/lib/profileSetupFlow';
import { useOnboardingDevPreview, onboardingScreenBlocked, onboardingStepHref } from '@/lib/onboardingDevPreview';
import { useAuth } from '@/store/AuthContext';

function copyFor(kind: BiometricKind, platform: typeof Platform.OS) {
  if (kind === 'face') {
    return { title: ka.profileSetup.faceIdTitle, body: ka.profileSetup.faceIdBody };
  }
  if (kind === 'fingerprint' && platform === 'ios') {
    return { title: ka.profileSetup.touchIdTitle, body: ka.profileSetup.touchIdBody };
  }
  if (kind === 'fingerprint') {
    return { title: ka.profileSetup.fingerprintTitle, body: ka.profileSetup.fingerprintBody };
  }
  return { title: ka.profileSetup.biometricUnlockTitle, body: ka.profileSetup.biometricUnlockBody };
}

/** Biometric unlock — shown only when the device has Face ID / Touch ID / fingerprint. */
export default function ProfileSetupFaceIdScreen() {
  const FIGMA = useFigmaProfileSetup();
  const router = useRouter();
  const preview = useOnboardingDevPreview();
  const { ready, user, healthProfile, setHealthProfile } = useAuth();
  const [busy, setBusy] = useState(false);
  const [gate, setGate] = useState<'checking' | 'show'>('checking');
  const [cap, setCap] = useState<BiometricCapability | null>(null);
  const skipped = useRef(false);

  const goPrivacy = () => router.replace(onboardingStepHref('/(auth)/profile-setup/privacy', preview) as never);

  const markFaceId = async (enabled: boolean) => {
    if (!healthProfile || !user) return;
    const updated = await patchProfileExtra(healthProfile, user, {
      faceIdPrompted: true,
      biometricEnabled: enabled,
    });
    setHealthProfile(updated);
  };

  useEffect(() => {
    if (!ready || !user || !healthProfile || skipped.current) return;
    if (preview) {
      setCap({ available: true, enrolled: true, kind: 'face' });
      setGate('show');
      return;
    }

    let cancelled = false;
    void (async () => {
      const next = await getBiometricCapability();
      if (cancelled) return;
      if (!shouldShowBiometricSetup(next)) {
        skipped.current = true;
        try {
          await markFaceId(false);
        } finally {
          goPrivacy();
        }
        return;
      }
      setCap(next);
      setGate('show');
    })();

    return () => {
      cancelled = true;
    };
    // Probe once per visit — healthProfile updates after markFaceId should not re-run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, user, preview]);

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

  const enable = async () => {
    setBusy(true);
    try {
      const live = cap ?? (await getBiometricCapability());
      let enabled = false;
      if (live.available && live.enrolled) {
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: ka.profileSetup.faceIdEnable,
          cancelLabel: ka.common.cancel,
        });
        enabled = result.success;
        if (enabled) await setBiometricEnabled(true);
      }
      await markFaceId(enabled);
    } finally {
      setBusy(false);
      goPrivacy();
    }
  };

  const skip = async () => {
    setBusy(true);
    try {
      await markFaceId(false);
    } finally {
      setBusy(false);
      goPrivacy();
    }
  };

  if (gate === 'checking') {
    return (
      <View className="flex-1 items-center justify-center bg-bg-100">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const kind = cap?.kind ?? 'generic';
  const copy = copyFor(kind, Platform.OS);
  const FaceIcon = kind === 'fingerprint' || kind === 'iris' ? Fingerprint : ScanFace;

  return (
    <ProfileSetupShell
      title=""
      primaryLabel=""
      onPrimary={() => {}}
      showStepper={false}
      hidePrimary
      footerSlot={
        <View style={{ gap: 24, width: '100%' }}>
          <ProfileSetupPrimaryButton
            label={ka.profileSetup.faceIdEnable}
            onPress={() => void enable()}
            loading={busy}
            icon="check"
          />
          <ProfileSetupLinkButton label={ka.profileSetup.faceIdSkip} onPress={() => void skip()} />
        </View>
      }
    >
      <View style={{ paddingHorizontal: 16, alignItems: 'center', gap: 24 }}>
        <Text
          style={{
            textAlign: 'center',
            fontFamily: 'NotoSansGeorgian_700Bold',
            fontSize: 30,
            lineHeight: 38,
            color: FIGMA.titleColor,
          }}
        >
          {copy.title}
          <Text style={{ color: FIGMA.brand }}>{ka.profileSetup.faceIdTitleAccent}</Text>
          {ka.profileSetup.faceIdTitleEnd}
        </Text>
        <View style={{ height: 200, alignItems: 'center', justifyContent: 'center' }}>
          <FaceIcon size={160} color="#D1D5DB" strokeWidth={1.2} />
        </View>
        <Text
          style={{
            fontFamily: 'NotoSansGeorgian_400Regular',
            fontSize: 16,
            lineHeight: 26,
            color: FIGMA.bodyColor,
            textAlign: 'center',
          }}
        >
          {copy.body}
        </Text>
      </View>
    </ProfileSetupShell>
  );
}
