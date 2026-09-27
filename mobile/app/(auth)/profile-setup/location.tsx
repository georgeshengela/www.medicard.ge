import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { Info, MapPin } from 'lucide-react-native';
import { ProfileSetupPrimaryButton } from '@/components/profile/ProfileSetupButtons';
import { ProfileSetupShell } from '@/components/profile/ProfileSetupShell';
import { useFigmaProfileSetup } from '@/constants/figmaProfileSetupLayout';
import { ka } from '@/i18n/ka';
import { applyLocationToProfile, grantUserLocation, skipUserLocation } from '@/lib/userLocation';
import { markPrimerAsked, primerCopy } from '@/lib/permissionPrimer';
import { useOnboardingDevPreview, onboardingScreenBlocked, onboardingStepHref } from '@/lib/onboardingDevPreview';
import { useAuth } from '@/store/AuthContext';
import { localAccountId } from '@/lib/localAccount';

/** Location permission — after notifications, before analyzing. */
export default function ProfileSetupLocationScreen() {
  const FIGMA = useFigmaProfileSetup();
  const router = useRouter();
  const preview = useOnboardingDevPreview();
  const { ready, user, healthProfile, setHealthProfile } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false), alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

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

  const goAnalyzing = () => router.replace(onboardingStepHref('/(auth)/profile-setup/analyzing', preview) as never);

  // App Review 5.1.1(iv): one "Continue" button that always opens the OS sheet. A denial
  // there is the person's answer: save it like the old skip and move on.
  const continueFlow = async () => {
    if (lock.current) return;
    const owner = user.id;
    lock.current = true; setBusy(true); setError(null);
    try {
      const result = await grantUserLocation().catch(() => null);
      await markPrimerAsked('location');
      if (!alive.current || owner !== localAccountId()) return;
      if (result?.granted) {
        setHealthProfile(result.profile ?? applyLocationToProfile(healthProfile, result.snapshot));
      } else {
        const snapshot = await skipUserLocation();
        if (!alive.current || owner !== localAccountId()) return;
        setHealthProfile(applyLocationToProfile(healthProfile, snapshot));
      }
      goAnalyzing();
    } catch {
      if (alive.current && owner === localAccountId()) setError('არჩევანი ვერ შეინახა. შეამოწმე ინტერნეტი და ხელახლა სცადე.');
    } finally {
      lock.current = false;
      if (alive.current && owner === localAccountId()) setBusy(false);
    }
  };

  const copy = primerCopy('location');

  return (
    <ProfileSetupShell
      title=""
      primaryLabel=""
      onPrimary={() => {}}
      showStepper={false}
      hidePrimary
      footerSlot={
        <View style={{ gap: 24, width: '100%' }}>
          {error ? <Text accessibilityLiveRegion="polite" style={{ color: '#C62B3F', fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 13, lineHeight: 21 }}>{error}</Text> : null}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <Info size={20} color="#6B7280" />
            <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 14, color: FIGMA.bodyColor }}>
              {ka.profileSetup.locationHint}
            </Text>
          </View>
          <ProfileSetupPrimaryButton
            label={copy.cta}
            onPress={() => void continueFlow()}
            loading={busy}
            icon="arrow"
          />
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
        </Text>

        <View style={{ height: 200, alignItems: 'center', justifyContent: 'center' }}>
          <View
            style={{
              width: 148,
              height: 148,
              borderRadius: 74,
              backgroundColor: `${FIGMA.brand}14`,
              borderWidth: 1,
              borderColor: `${FIGMA.brand}33`,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <View
              style={{
                width: 96,
                height: 96,
                borderRadius: 48,
                backgroundColor: `${FIGMA.brand}22`,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <MapPin size={52} color={FIGMA.brand} strokeWidth={1.6} />
            </View>
          </View>
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
