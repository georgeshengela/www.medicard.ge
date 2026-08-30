import React, { useCallback } from 'react';
import { Pressable, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { History } from 'lucide-react-native';
import { SymptomNavHeader } from '@/components/symptoms/SymptomNavHeader';
import { SymptomIntroHero } from '@/components/symptoms/SymptomIntroHero';
import { ka } from '@/i18n/ka';
import { resetSymptomChecker } from '@/lib/symptomCheckerStore';
import { useAuth } from '@/store/AuthContext';

export default function SymptomIntroScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  useFocusEffect(
    useCallback(() => {
      resetSymptomChecker(user?.gender);
    }, [user?.gender]),
  );

  return (
    <View style={{ flex: 1, backgroundColor: '#030712', paddingBottom: insets.bottom }}>
      <StatusBar style="light" />
      <SymptomNavHeader
        navy
        onBack={() => router.back()}
        right={
          <Pressable
            onPress={() => router.push('/symptoms/history' as never)}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={ka.symptoms.viewHistory}
          >
            <History size={22} color="#FFFFFF" strokeWidth={2} />
          </Pressable>
        }
      />
      <View style={{ flex: 1 }}>
        <SymptomIntroHero />
        <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 16, gap: 12 }}>
          <Text
            style={{
              fontFamily: 'NotoSansGeorgian_700Bold',
              fontSize: 30,
              lineHeight: 38,
              color: '#FFFFFF',
              textAlign: 'center',
              letterSpacing: -0.25,
            }}
          >
            {ka.symptoms.introTitle}
          </Text>
          <Text
            style={{
              fontFamily: 'NotoSansGeorgian_400Regular',
              fontSize: 16,
              lineHeight: 26,
              color: '#D1D5DB',
              textAlign: 'center',
            }}
          >
            {ka.symptoms.introSubtitle}
          </Text>
        </View>
        <View style={{ padding: 16 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={ka.symptoms.getStarted}
            onPress={() => router.push('/symptoms/method' as never)}
            style={{
              height: 48,
              borderRadius: 16,
              backgroundColor: '#0D9488',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text
              style={{
                fontFamily: 'NotoSansGeorgian_600SemiBold',
                fontSize: 16,
                lineHeight: 22,
                color: '#FFFFFF',
              }}
            >
              {ka.symptoms.getStarted}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
