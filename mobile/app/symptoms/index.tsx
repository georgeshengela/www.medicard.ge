import React, { useCallback } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { History } from 'lucide-react-native';
import { SymptomNavHeader } from '@/components/symptoms/SymptomNavHeader';
import { SymptomCta } from '@/components/symptoms/SymptomCta';
import { SYMPTOM_INTRO_ILLUSTRATION } from '@/constants/symptomAssets';
import { useFigmaSymptoms } from '@/constants/figmaSymptomsLayout';
import { ka } from '@/i18n/ka';
import { resetSymptomChecker } from '@/lib/symptomCheckerStore';
import { useAuth } from '@/store/AuthContext';

export default function SymptomIntroScreen() {
  const T = useFigmaSymptoms();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  useFocusEffect(
    useCallback(() => {
      resetSymptomChecker(user?.gender);
    }, [user?.gender]),
  );

  return (
    <View style={{ flex: 1, backgroundColor: T.white, paddingBottom: insets.bottom }}>
      <SymptomNavHeader
        onBack={() => router.back()}
        right={
          <Pressable
            onPress={() => router.push('/symptoms/history' as never)}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={ka.symptoms.viewHistory}
          >
            <History size={22} color={T.textPrimary} strokeWidth={2} />
          </Pressable>
        }
      />
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <View style={{ height: 274, alignItems: 'center', justifyContent: 'center' }}>
          <Image source={SYMPTOM_INTRO_ILLUSTRATION} style={{ width: 256, height: 256 }} resizeMode="contain" />
        </View>
        <View style={{ paddingHorizontal: 16, paddingVertical: 32, gap: 12 }}>
          <Text
            style={{
              fontSize: 30,
              lineHeight: 38,
              fontWeight: '700',
              color: T.textPrimary,
              textAlign: 'center',
              letterSpacing: -0.25,
            }}
          >
            {ka.symptoms.introTitle}
          </Text>
          <Text style={{ fontSize: 16, lineHeight: 26, color: T.textSecondary, textAlign: 'center' }}>
            {ka.symptoms.introSubtitle}
          </Text>
        </View>
        <View style={{ padding: 16 }}>
          <SymptomCta label={ka.symptoms.getStarted} onPress={() => router.push('/symptoms/method' as never)} />
        </View>
      </View>
    </View>
  );
}
