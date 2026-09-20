import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, Text, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { Info, MapPin } from 'lucide-react-native';
import {
  ProfileSetupLinkButton,
  ProfileSetupPrimaryButton,
} from '@/components/profile/ProfileSetupButtons';
import { ProfileSetupShell } from '@/components/profile/ProfileSetupShell';
import { useFigmaProfileSetup } from '@/constants/figmaProfileSetupLayout';
import { ka } from '@/i18n/ka';
import { applyLocationToProfile, grantUserLocation, skipUserLocation } from '@/lib/userLocation';
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
  const [denied, setDenied] = useState(false);
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

  const enable = async () => {
    if (lock.current) return;
    const owner = user.id;
    lock.current = true; setBusy(true); setError(null); setDenied(false);
    try {
      const result = await grantUserLocation();
      if (!alive.current || owner !== localAccountId()) return;
      if (!result.granted) { setDenied(true); setError('ლოკაციის ნებართვა გამორთულია. ჩართე პარამეტრებიდან ან გააგრძელე მოგვიანებით.'); return; }
      setHealthProfile(result.profile ?? applyLocationToProfile(healthProfile, result.snapshot));
      goAnalyzing();
    } catch (caught) {
      if (alive.current && owner === localAccountId()) setError(caught instanceof Error ? caught.message : 'ქალაქი ვერ განისაზღვრა. ხელახლა სცადე.');
    } finally {
      lock.current = false;
      if (alive.current && owner === localAccountId()) setBusy(false);
    }
  };

  const skip = async () => {
    if (lock.current) return;
    const owner = user.id;
    lock.current = true; setBusy(true); setError(null);
    try {
      const snapshot = await skipUserLocation();
      if (!alive.current || owner !== localAccountId()) return;
      setHealthProfile(applyLocationToProfile(healthProfile, snapshot));
      goAnalyzing();
    } catch {
      if (alive.current && owner === localAccountId()) setError('არჩევანი ვერ შეინახა. შეამოწმე ინტერნეტი და ხელახლა სცადე.');
    } finally {
      lock.current = false;
      if (alive.current && owner === localAccountId()) setBusy(false);
    }
  };

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
          {denied ? <Pressable accessibilityRole="button" disabled={busy} onPress={() => void Linking.openSettings().catch(() => undefined)} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ color: FIGMA.brand, fontFamily: 'NotoSansGeorgian_600SemiBold', textAlign: 'center' }}>პარამეტრების გახსნა</Text></Pressable> : null}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <Info size={20} color="#6B7280" />
            <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 14, color: FIGMA.bodyColor }}>
              {ka.profileSetup.locationHint}
            </Text>
          </View>
          <ProfileSetupPrimaryButton
            label={ka.profileSetup.locationEnable}
            onPress={() => void enable()}
            loading={busy}
            icon="check"
          />
          <ProfileSetupLinkButton label={ka.profileSetup.locationSkip} onPress={() => void skip()} />
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
          {ka.profileSetup.locationTitle}
          <Text style={{ color: FIGMA.brand }}>{ka.profileSetup.locationTitleAccent}</Text>
          {ka.profileSetup.locationTitleEnd}
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
          {ka.profileSetup.locationBody}
        </Text>
      </View>
    </ProfileSetupShell>
  );
}
