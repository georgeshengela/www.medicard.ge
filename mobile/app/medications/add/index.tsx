import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { ChevronRight, Pill, ScanLine, Search } from 'lucide-react-native';
import { MedInputShell } from '@/components/medications/MedicationUI';
import { FIGMA_MEDS } from '@/constants/figmaMedicationsLayout';
import { ka } from '@/i18n/ka';

export default function AddMedicationIntroScreen() {
  const router = useRouter();

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={{ flex: 1, backgroundColor: FIGMA_MEDS.white }}>
        <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 16, gap: 24 }}>
          <View style={{ alignItems: 'center', gap: 24 }}>
            <Pill size={32} color={FIGMA_MEDS.brand} strokeWidth={2} />
            <View style={{ gap: 16, alignItems: 'center' }}>
              <Text style={{ fontSize: 30, fontWeight: '800', color: FIGMA_MEDS.textPrimary, textAlign: 'center' }}>
                {ka.meds.addIntroTitle}
              </Text>
              <Text style={{ fontSize: 18, lineHeight: 28, color: FIGMA_MEDS.textSecondary, textAlign: 'center' }}>
                {ka.meds.addIntroBody}
              </Text>
            </View>
          </View>
          <Pressable onPress={() => router.push('/medications/add/search')}>
            <MedInputShell>
              <Search size={20} color={FIGMA_MEDS.textMuted} strokeWidth={2} />
              <Text style={{ flex: 1, fontSize: 16, color: FIGMA_MEDS.textSecondary }}>{ka.meds.addIntroSearchPlaceholder}</Text>
            </MedInputShell>
          </Pressable>
        </View>

        <View style={{ padding: 16, paddingBottom: 32 }}>
          <Pressable
            onPress={() => router.push('/medications/add/search')}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              backgroundColor: FIGMA_MEDS.cardBg,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: FIGMA_MEDS.border,
              paddingHorizontal: 16,
              paddingVertical: 12,
              ...FIGMA_MEDS.shadowInput,
            }}
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 999,
                backgroundColor: FIGMA_MEDS.white,
                borderWidth: 1,
                borderColor: FIGMA_MEDS.borderTertiary,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ScanLine size={22} color={FIGMA_MEDS.textPrimary} strokeWidth={2} />
            </View>
            <Text style={{ flex: 1, fontSize: 14, fontWeight: '700', color: FIGMA_MEDS.textPrimary }}>{ka.meds.scanWithAi}</Text>
            <ChevronRight size={20} color={FIGMA_MEDS.textMuted} />
          </Pressable>
        </View>
      </View>
    </>
  );
}
