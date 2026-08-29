import React, { useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bot, Check, ClipboardList, type LucideIcon } from 'lucide-react-native';
import { SymptomNavHeader } from '@/components/symptoms/SymptomNavHeader';
import { SymptomCta } from '@/components/symptoms/SymptomCta';
import { SYMPTOM_INTRO_ILLUSTRATION } from '@/constants/symptomAssets';
import { useFigmaSymptoms } from '@/constants/figmaSymptomsLayout';
import { ka } from '@/i18n/ka';
import { updateSymptomChecker } from '@/lib/symptomCheckerStore';
import type { SymptomMethod } from '@/types/symptoms';

export default function SymptomMethodScreen() {
  const T = useFigmaSymptoms();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [method, setMethod] = useState<SymptomMethod>('manual');

  const go = () => {
    updateSymptomChecker({ method });
    router.push(method === 'anatomy' ? '/symptoms/body' : '/symptoms/search');
  };

  return (
    <View style={{ flex: 1, backgroundColor: T.white, paddingBottom: insets.bottom }}>
      <SymptomNavHeader onBack={() => router.back()} />
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <View style={{ padding: 16, gap: 24, alignItems: 'center' }}>
          <Image source={SYMPTOM_INTRO_ILLUSTRATION} style={{ width: 128, height: 128 }} resizeMode="contain" />
          <View style={{ width: '100%', gap: 16 }}>
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
              {ka.symptoms.methodTitle}
            </Text>
            <Text style={{ fontSize: 16, lineHeight: 26, color: T.textSecondary, textAlign: 'center' }}>
              {ka.symptoms.methodSubtitle}
            </Text>
          </View>
        </View>

        <View style={{ paddingHorizontal: 16, paddingVertical: 32, gap: 8 }}>
          <MethodRow
            selected={method === 'manual'}
            icon={ClipboardList}
            title={ka.symptoms.methodManual}
            subtitle={ka.symptoms.methodManualHint}
            onPress={() => setMethod('manual')}
          />
          <MethodRow
            selected={method === 'anatomy'}
            icon={Bot}
            title={ka.symptoms.methodAnatomy}
            subtitle={ka.symptoms.methodAnatomyHint}
            onPress={() => setMethod('anatomy')}
          />
        </View>

        <View style={{ padding: 16 }}>
          <SymptomCta label={ka.symptoms.getStarted} onPress={go} />
        </View>
      </View>
    </View>
  );
}

function MethodRow({
  selected,
  icon: Icon,
  title,
  subtitle,
  onPress,
}: {
  selected: boolean;
  icon: LucideIcon;
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  const T = useFigmaSymptoms();
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        padding: 16,
        minHeight: 76,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: selected ? T.brand : T.border,
        backgroundColor: selected ? T.brandSoft : T.cardBg,
        ...T.shadowXs,
      }}
    >
      <Icon size={32} color={T.textPrimary} strokeWidth={1.6} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14, lineHeight: 20, fontWeight: '600', color: T.textPrimary }}>{title}</Text>
        <Text style={{ marginTop: 4, fontSize: 14, lineHeight: 20, color: T.textSecondary }}>{subtitle}</Text>
      </View>
      <View
        style={{
          width: 20,
          height: 20,
          borderRadius: 4,
          borderWidth: selected ? 0 : 1,
          borderColor: T.borderTertiary,
          backgroundColor: selected ? T.brand : T.white,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {selected ? <Check size={12} color={T.white} strokeWidth={3} /> : null}
      </View>
    </Pressable>
  );
}
