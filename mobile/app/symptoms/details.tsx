import React, { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Calendar, ChevronDown, Pencil, Pill, Search, Stethoscope } from 'lucide-react-native';
import { SymptomNavHeader } from '@/components/symptoms/SymptomNavHeader';
import { SymptomFooter } from '@/components/symptoms/SymptomCta';
import { SymptomPainScale } from '@/components/symptoms/SymptomPainScale';
import { SymptomSheet } from '@/components/symptoms/SymptomSheet';
import { KEYBOARD_DONE_ACCESSORY_ID, KeyboardDoneAccessory } from '@/components/ui/KeyboardDoneAccessory';
import { SYMPTOM_INTRO_ILLUSTRATION } from '@/constants/symptomAssets';
import { useFigmaSymptoms } from '@/constants/figmaSymptomsLayout';
import { DURATION_OPTIONS } from '@/constants/symptomCatalog';
import { useMedications } from '@/hooks/useMedications';
import { ka } from '@/i18n/ka';
import { updateSymptomChecker, useSymptomChecker } from '@/lib/symptomCheckerStore';
import { useAuth } from '@/store/AuthContext';

export default function SymptomDetailsScreen() {
  const T = useFigmaSymptoms();
  const { labelStyle, hintStyle, fieldBox } = useSymptomFieldStyles();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const state = useSymptomChecker();
  const { user } = useAuth();
  const { medications } = useMedications();
  const firstName = user?.fullName?.split(' ')[0] ?? '';
  const [durationOpen, setDurationOpen] = useState(false);
  const durationLabel = DURATION_OPTIONS.find((d) => d.id === state.durationId)?.labelKa;

  const medSummary =
    medications.length === 0
      ? ka.symptoms.noMedications
      : medications.length <= 2
        ? medications.map((m) => m.medName).join(', ')
        : `${medications
            .slice(0, 2)
            .map((m) => m.medName)
            .join(', ')}, +${medications.length - 2}`;

  return (
    <View style={{ flex: 1, backgroundColor: T.white }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
      <SymptomNavHeader onBack={() => router.back()} />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 32 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16, gap: 8 }}>
          <Text style={{ fontSize: 30, lineHeight: 38, fontWeight: '700', color: T.textPrimary, letterSpacing: -0.25 }}>
            {ka.symptoms.detailsHeading(firstName)}
          </Text>
          <Text style={{ fontSize: 16, lineHeight: 26, color: T.textSecondary }}>{ka.symptoms.detailsSubtitle}</Text>
        </View>

        <FieldBlock label={ka.symptoms.currentMedication}>
          <Pressable onPress={() => router.push('/(tabs)/medications' as never)} style={fieldBox}>
            <Pill size={20} color={T.textSecondary} strokeWidth={1.8} />
            <Text style={{ flex: 1, fontSize: 16, lineHeight: 22, color: T.textSecondary }} numberOfLines={1}>
              {medSummary}
            </Text>
            <Pencil size={20} color={T.textSecondary} strokeWidth={1.8} />
          </Pressable>
        </FieldBlock>

        <View style={{ paddingHorizontal: 16, paddingVertical: 8, gap: 4 }}>
          <Text style={labelStyle}>{ka.symptoms.primarySymptom}</Text>
          <Text style={hintStyle}>{ka.symptoms.primarySymptomHint}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
            {state.symptoms.map((s) => {
              const on = state.primarySymptom === s;
              return (
                <Pressable
                  key={s}
                  onPress={() => updateSymptomChecker({ primarySymptom: s })}
                  style={{
                    minHeight: 40,
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: on ? T.brand : T.borderTertiary,
                    backgroundColor: on ? T.brandSoft : T.white,
                    ...T.shadowXs,
                  }}
                >
                  <Text style={{ fontSize: 16, lineHeight: 22, fontWeight: '500', color: on ? T.brand : T.textPrimary }}>
                    {s}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <FieldBlock label={ka.symptoms.pastConditions}>
          <View style={fieldBox}>
            <Stethoscope size={20} color={T.textSecondary} strokeWidth={1.8} />
            <TextInput
              value={state.pastConditions}
              onChangeText={(pastConditions) => updateSymptomChecker({ pastConditions })}
              placeholder={ka.symptoms.pastConditionsPlaceholder}
              placeholderTextColor={T.textMuted}
              style={{ flex: 1, fontSize: 16, lineHeight: 22, color: T.textPrimary, paddingVertical: 0 }}
              inputAccessoryViewID={KEYBOARD_DONE_ACCESSORY_ID}
            />
            <Pencil size={20} color={T.textSecondary} strokeWidth={1.8} />
          </View>
        </FieldBlock>

        <FieldBlock label={ka.symptoms.durationQuestion}>
          <Pressable onPress={() => setDurationOpen(true)} style={fieldBox}>
            <Calendar size={20} color={T.textSecondary} strokeWidth={1.8} />
            <Text style={{ flex: 1, fontSize: 16, lineHeight: 22, color: durationLabel ? T.textPrimary : T.textSecondary }}>
              {durationLabel ?? ka.symptoms.duration}
            </Text>
            <ChevronDown size={20} color={T.textSecondary} strokeWidth={1.8} />
          </Pressable>
        </FieldBlock>

        <View style={{ paddingHorizontal: 16, paddingVertical: 8 }}>
          <Text style={[labelStyle, { marginBottom: 8 }]}>{ka.symptoms.pain}</Text>
          <SymptomPainScale value={state.painLevel} onChange={(painLevel) => updateSymptomChecker({ painLevel })} />
        </View>

        <FieldBlock label={ka.symptoms.notes}>
          <View
            style={{
              minHeight: 148,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: T.borderTertiary,
              backgroundColor: T.white,
              padding: 12,
              ...T.shadowXs,
            }}
          >
            <TextInput
              value={state.notes}
              onChangeText={(notes) => updateSymptomChecker({ notes: notes.slice(0, 300) })}
              placeholder={ka.symptoms.notesPlaceholder}
              placeholderTextColor={T.textSecondary}
              multiline
              style={{ flex: 1, minHeight: 100, fontSize: 16, lineHeight: 26, color: T.textPrimary, textAlignVertical: 'top' }}
              inputAccessoryViewID={KEYBOARD_DONE_ACCESSORY_ID}
            />
            <Text style={{ fontSize: 12, lineHeight: 16, color: T.textMuted }}>{state.notes.length}/300</Text>
          </View>
        </FieldBlock>

        <View
          style={{
            marginHorizontal: 16,
            marginTop: 8,
            borderRadius: 24,
            backgroundColor: T.cardBg,
            borderWidth: 1,
            borderColor: T.border,
            overflow: 'hidden',
            ...T.shadowXs,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              padding: 16,
              borderBottomWidth: 1,
              borderBottomColor: T.border,
              gap: 16,
            }}
          >
            <Text style={{ flex: 1, fontSize: 14, lineHeight: 20, fontWeight: '600', color: T.textPrimary }}>
              {ka.symptoms.sendToMedi}
            </Text>
            <Switch
              value={state.shareToNightingale}
              onValueChange={(shareToNightingale) => updateSymptomChecker({ shareToNightingale })}
              trackColor={{ false: T.track, true: T.brand }}
              thumbColor={T.white}
            />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ flex: 1, padding: 16, fontSize: 14, lineHeight: 22, color: T.textSecondary }}>
              {ka.symptoms.privacyNote}
            </Text>
            <Image source={SYMPTOM_INTRO_ILLUSTRATION} style={{ width: 96, height: 96 }} resizeMode="contain" />
          </View>
        </View>
      </ScrollView>

      <SymptomFooter>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            if (state.symptoms.length === 0) {
              router.push('/symptoms/search' as never);
              return;
            }
            if (!state.primarySymptom) {
              updateSymptomChecker({ primarySymptom: state.symptoms[0] });
            }
            router.push('/symptoms/analyzing' as never);
          }}
          style={{
            height: T.btnH,
            borderRadius: T.btnRadius,
            backgroundColor: T.brand,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            ...T.shadowXs,
          }}
        >
          <Text style={{ color: T.white, fontSize: 16, lineHeight: 22, fontWeight: '600' }}>{ka.symptoms.analyzeSymptom}</Text>
          <Search size={20} color={T.white} strokeWidth={2.2} />
        </Pressable>
      </SymptomFooter>
      </KeyboardAvoidingView>
      <KeyboardDoneAccessory />
      <View style={{ height: insets.bottom, backgroundColor: T.white }} />

      <SymptomSheet
        visible={durationOpen}
        title={ka.symptoms.durationQuestion}
        onClose={() => setDurationOpen(false)}
        ctaLabel={ka.common.done}
        onCta={() => setDurationOpen(false)}
      >
        {DURATION_OPTIONS.map((opt) => {
          const on = state.durationId === opt.id;
          return (
            <Pressable
              key={opt.id}
              onPress={() => {
                updateSymptomChecker({ durationId: opt.id });
                setDurationOpen(false);
              }}
              style={{
                ...fieldBox,
                marginBottom: 8,
                borderColor: on ? T.brand : T.borderTertiary,
                backgroundColor: on ? T.brandSoft : T.white,
              }}
            >
              <Calendar size={20} color={on ? T.brand : T.textSecondary} strokeWidth={1.8} />
              <Text style={{ flex: 1, fontSize: 16, lineHeight: 22, color: T.textPrimary }}>{opt.labelKa}</Text>
            </Pressable>
          );
        })}
      </SymptomSheet>
    </View>
  );
}

function FieldBlock({ label, children }: { label: string; children: React.ReactNode }) {
  const { labelStyle } = useSymptomFieldStyles();
  return (
    <View style={{ paddingHorizontal: 16, paddingVertical: 8, gap: 8 }}>
      <Text style={labelStyle}>{label}</Text>
      {children}
    </View>
  );
}

function useSymptomFieldStyles() {
  const T = useFigmaSymptoms();
  return {
    labelStyle: { fontSize: 14, lineHeight: 20, fontWeight: '600' as const, color: T.textPrimary },
    hintStyle: { fontSize: 14, lineHeight: 22, color: T.textSecondary },
    fieldBox: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: 12,
      minHeight: 48,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: T.borderTertiary,
      backgroundColor: T.white,
      ...T.shadowXs,
    },
  };
}
