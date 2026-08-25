import React, { useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Star } from 'lucide-react-native';
import { ProfileSetupPrimaryButton } from '@/components/profile/ProfileSetupButtons';
import { MedicardLogoMark } from '@/components/ui/MedicardLogoMark';
import { ka } from '@/i18n/ka';
import { finishOnboarding } from '@/lib/profileSetupFlow';
import { useOnboardingDevPreview, onboardingScreenBlocked } from '@/lib/onboardingDevPreview';
import { useAuth } from '@/store/AuthContext';
import { analysisFromProfile } from '@/types/onboardingAnalysis';
import { welcomeTopInset } from '@/constants/figmaWelcomeLayout';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ paddingHorizontal: 16, paddingTop: 20, gap: 12 }}>
      <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 18, color: '#1F2937' }}>{title}</Text>
      {children}
    </View>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <View style={{ borderRadius: 16, borderWidth: 1, borderColor: '#E5E7EB', padding: 16, backgroundColor: '#FFFFFF', gap: 8 }}>
      {children}
    </View>
  );
}

/** Personalized recommendations — Figma 8845:314664 */
export default function ProfileSetupRecommendationsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const preview = useOnboardingDevPreview();
  const { ready, user, healthProfile, setHealthProfile, setUser } = useAuth();
  const [busy, setBusy] = useState(false);

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

  const analysis = analysisFromProfile(healthProfile.extraAnswers as Record<string, unknown>);
  if (!analysis) return <Redirect href={preview ? '/(auth)/profile-setup/analyzing?preview=1' : '/(auth)/profile-setup/analyzing'} />;

  const rec = analysis.recommendations;

  const finish = async () => {
    if (preview) {
      router.replace('/(tabs)/home');
      return;
    }
    setBusy(true);
    try {
      const result = await finishOnboarding(healthProfile, user);
      setHealthProfile(result.profile);
      setUser(result.user);
      router.replace('/(tabs)/home');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <LinearGradient colors={['#CCFBF1', '#FFFFFF']} style={{ paddingTop: welcomeTopInset(insets.top), paddingBottom: 24, alignItems: 'center', gap: 12 }}>
        <MedicardLogoMark size={48} />
        <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 28, lineHeight: 36, color: '#1F2937', textAlign: 'center', paddingHorizontal: 16 }}>
          {ka.profileSetup.recommendationsTitle}
        </Text>
      </LinearGradient>

      <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        <Section title={ka.profileSetup.specialists}>
          {rec.specialists.map((s) => (
            <Card key={s.nameKa}>
              <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 16, color: '#1F2937' }}>{s.nameKa}</Text>
              <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 14, color: '#6B7280' }}>{s.specialtyKa}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Star size={14} color="#FBBF24" fill="#FBBF24" />
                <Text style={{ fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 13, color: '#374151' }}>
                  {s.rating} · {s.distanceKm}კმ
                </Text>
              </View>
              <Text style={{ fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 12, color: s.remote ? '#14B8A6' : '#F43F5E' }}>
                {s.remote ? ka.profileSetup.remoteAvailable : ka.profileSetup.inPersonOnly}
              </Text>
            </Card>
          ))}
        </Section>

        {rec.medications.length > 0 ? (
          <Section title={ka.profileSetup.medications}>
            {rec.medications.map((m) => (
              <Card key={m.nameKa}>
                <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 16, color: '#1F2937' }}>{m.nameKa}</Text>
                <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 14, color: '#6B7280' }}>{m.typeKa}</Text>
                <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 13, color: '#4B5563' }}>{m.scheduleKa}</Text>
              </Card>
            ))}
          </Section>
        ) : null}

        <Section title={ka.profileSetup.bloodPressure}>
          <Card>
            <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 28, color: '#1F2937' }}>
              {rec.bloodPressure.systolic}/{rec.bloodPressure.diastolic}
              <Text style={{ fontSize: 14, color: '#6B7280' }}> mmHg</Text>
            </Text>
            <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 14, lineHeight: 22, color: '#4B5563' }}>
              {rec.bloodPressure.summaryKa}
            </Text>
          </Card>
        </Section>

        <Section title={ka.profileSetup.sleep}>
          <Card>
            <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 15, color: '#14B8A6' }}>{rec.sleep.personaKa}</Text>
            <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 14, lineHeight: 22, color: '#4B5563' }}>{rec.sleep.adviceKa}</Text>
          </Card>
        </Section>

        <Section title={ka.profileSetup.pharmacies}>
          {rec.pharmacies.map((p) => (
            <Card key={p.nameKa}>
              <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 16, color: '#1F2937' }}>{p.nameKa}</Text>
              <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 13, color: '#6B7280' }}>{p.addressKa}</Text>
              {p.freeDelivery ? (
                <Text style={{ fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 12, color: '#14B8A6' }}>{ka.profileSetup.freeDelivery}</Text>
              ) : null}
            </Card>
          ))}
        </Section>

        {rec.products.length > 0 ? (
          <Section title="პროდუქტი">
            {rec.products.map((p) => (
              <Card key={p.nameKa}>
                <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 15, color: '#1F2937' }}>{p.nameKa}</Text>
                <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 18, color: '#14B8A6' }}>{p.priceGel.toFixed(2)} ₾</Text>
                <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 12, color: '#6B7280' }}>
                  მარაგში: {p.inStock}
                </Text>
              </Card>
            ))}
          </Section>
        ) : null}

        <Section title={ka.profileSetup.articles}>
          {rec.articles.map((a) => (
            <Card key={a.titleKa}>
              <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 15, color: '#1F2937' }}>{a.titleKa}</Text>
              <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 12, color: '#9CA3AF' }}>{a.readMinutes} წთ</Text>
            </Card>
          ))}
        </Section>
      </ScrollView>

      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingBottom: Math.max(insets.bottom, 16), backgroundColor: '#FFFFFF' }}>
        <ProfileSetupPrimaryButton label={ka.profileSetup.finishSetup} onPress={() => void finish()} loading={busy} icon="check" />
      </View>
    </View>
  );
}
