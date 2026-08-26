import React, { useEffect } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SymptomNavHeader } from '@/components/symptoms/SymptomNavHeader';
import { SymptomCta, SymptomFooter } from '@/components/symptoms/SymptomCta';
import { SYMPTOM_INTRO_ILLUSTRATION } from '@/constants/symptomAssets';
import { FIGMA_SYMPTOMS as T } from '@/constants/figmaSymptomsLayout';
import { ka } from '@/i18n/ka';
import { resetSymptomChecker } from '@/lib/symptomCheckerStore';
import { useAuth } from '@/store/AuthContext';

export default function SymptomIntroScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  useEffect(() => {
    resetSymptomChecker(user?.gender);
  }, [user?.gender]);

  return (
    <View style={{ flex: 1, backgroundColor: T.white, paddingBottom: insets.bottom }}>
      <SymptomNavHeader onBack={() => router.back()} />
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <View style={{ height: 274, alignItems: 'center', justifyContent: 'center' }}>
          <Image source={SYMPTOM_INTRO_ILLUSTRATION} style={{ width: 256, height: 256 }} resizeMode="contain" />
        </View>
        <View style={{ paddingHorizontal: 16, paddingVertical: 32, alignItems: 'center' }}>
          <Text style={{ fontSize: 30, lineHeight: 38, fontWeight: '700', color: T.textPrimary, textAlign: 'center', letterSpacing: -0.25 }}>
            {ka.symptoms.introTitle}
          </Text>
          <Text style={{ marginTop: 12, fontSize: 16, lineHeight: 26, color: T.textSecondary, textAlign: 'center' }}>
            {ka.symptoms.introSubtitle}
          </Text>
        </View>
      </View>
      <SymptomFooter>
        <SymptomCta label={ka.symptoms.getStarted} onPress={() => router.push('/symptoms/method' as never)} />
        <Pressable onPress={() => router.push('/symptoms/history' as never)} style={{ alignItems: 'center', marginTop: 12 }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: T.brand }}>{ka.symptoms.viewHistory}</Text>
        </Pressable>
      </SymptomFooter>
    </View>
  );
}
