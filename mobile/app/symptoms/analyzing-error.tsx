import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SymptomCta, SymptomFooter } from '@/components/symptoms/SymptomCta';
import { SymptomNavHeader } from '@/components/symptoms/SymptomNavHeader';
import { useFigmaSymptoms } from '@/constants/figmaSymptomsLayout';
import { ka } from '@/i18n/ka';
import { updateSymptomChecker, useSymptomChecker } from '@/lib/symptomCheckerStore';

export default function SymptomAnalyzingErrorScreen() {
  const T = useFigmaSymptoms();
  const router = useRouter();
  const { lastError } = useSymptomChecker();
  const isQuota = lastError?.includes('ლიმიტი') ?? false;

  return (
    <View style={{ flex: 1, backgroundColor: T.white }}>
      <SymptomNavHeader onBack={() => router.back()} />
      <View style={{ flex: 1, padding: 24, justifyContent: 'center', gap: 12 }}>
        <Text style={{ fontSize: 22, fontWeight: '700', color: T.textPrimary }}>{ka.symptoms.analyzeFailedTitle}</Text>
        <Text style={{ fontSize: 16, lineHeight: 26, color: T.textSecondary }}>{ka.symptoms.analyzeFailedBody}</Text>
        {lastError ? (
          <View style={{ marginTop: 8, padding: 14, borderRadius: 14, backgroundColor: '#FFF1F2', borderWidth: 1, borderColor: '#FECDD3' }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#9F1239', marginBottom: 4 }}>{ka.symptoms.analyzeFailedReason}</Text>
            <Text style={{ fontSize: 14, lineHeight: 22, color: '#BE123C' }}>{lastError}</Text>
          </View>
        ) : null}
      </View>
      <SymptomFooter>
        {isQuota ? (
          <SymptomCta label={ka.usage.upsellCta} onPress={() => router.push('/package' as never)} />
        ) : (
          <SymptomCta
            label={ka.common.retry}
            onPress={() => {
              updateSymptomChecker({ lastError: null });
              router.replace('/symptoms/analyzing' as never);
            }}
          />
        )}
        <Pressable
          onPress={() => router.push('/chat/doctor' as never)}
          style={{ alignItems: 'center', marginTop: 12 }}
        >
          <Text style={{ fontSize: 14, fontWeight: '600', color: T.brand }}>{ka.symptoms.talkDoctor}</Text>
        </Pressable>
      </SymptomFooter>
    </View>
  );
}
