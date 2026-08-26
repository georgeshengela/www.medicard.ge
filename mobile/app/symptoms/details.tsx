import React from 'react';

import { Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';

import { useRouter } from 'expo-router';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Brain, Calendar, ChevronDown, Pill, Search } from 'lucide-react-native';

import { SymptomNavHeader } from '@/components/symptoms/SymptomNavHeader';

import { SymptomCta, SymptomFooter } from '@/components/symptoms/SymptomCta';

import { SymptomPainScale } from '@/components/symptoms/SymptomPainScale';

import { FIGMA_SYMPTOMS as T } from '@/constants/figmaSymptomsLayout';

import { DURATION_OPTIONS } from '@/constants/symptomCatalog';

import { useMedications } from '@/hooks/useMedications';

import { ka } from '@/i18n/ka';

import { updateSymptomChecker, useSymptomChecker } from '@/lib/symptomCheckerStore';

import { useAuth } from '@/store/AuthContext';



export default function SymptomDetailsScreen() {

  const router = useRouter();

  const insets = useSafeAreaInsets();

  const state = useSymptomChecker();

  const { user } = useAuth();

  const { medications } = useMedications();

  const firstName = user?.fullName?.split(' ')[0] ?? '';



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

    <View style={{ flex: 1, backgroundColor: T.white, paddingBottom: insets.bottom }}>

      <SymptomNavHeader onBack={() => router.back()} />

      <ScrollView contentContainerStyle={{ paddingBottom: 32 }} keyboardShouldPersistTaps="handled">

        <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16, gap: 8 }}>

          <Text style={{ fontSize: 30, lineHeight: 38, fontWeight: '700', color: T.textPrimary, letterSpacing: -0.25 }}>

            {ka.symptoms.detailsHeading(firstName)}

          </Text>

          <Text style={{ fontSize: 16, lineHeight: 26, color: T.textSecondary }}>{ka.symptoms.detailsSubtitle}</Text>

        </View>



        <FieldBlock label={ka.symptoms.currentMedication}>

          <Pressable

            onPress={() => router.push('/(tabs)/medications' as never)}

            style={fieldBox}

          >

            <Pill size={20} color={T.textSecondary} strokeWidth={2} />

            <Text style={{ flex: 1, fontSize: 16, color: T.textSecondary }} numberOfLines={1}>

              {medSummary}

            </Text>

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

                  <Text style={{ fontSize: 16, fontWeight: '500', color: on ? T.brand : T.textPrimary }}>{s}</Text>

                </Pressable>

              );

            })}

          </View>

        </View>



        <FieldBlock label={ka.symptoms.pastConditions}>

          <View style={fieldBox}>

            <Brain size={20} color={T.textSecondary} strokeWidth={2} />

            <Text style={{ flex: 1, fontSize: 16, color: T.textMuted }}>{ka.symptoms.pastConditionsPlaceholder}</Text>

          </View>

        </FieldBlock>



        <FieldBlock label={ka.symptoms.durationQuestion}>

          <View style={{ gap: 8 }}>

            {DURATION_OPTIONS.map((opt) => {

              const on = state.durationId === opt.id;

              return (

                <Pressable

                  key={opt.id}

                  onPress={() => updateSymptomChecker({ durationId: opt.id })}

                  style={{

                    ...fieldBox,

                    borderColor: on ? T.brand : T.borderTertiary,

                    backgroundColor: on ? T.brandSoft : T.white,

                  }}

                >

                  <Calendar size={20} color={on ? T.brand : T.textSecondary} strokeWidth={2} />

                  <Text style={{ flex: 1, fontSize: 16, color: T.textPrimary }}>{opt.labelKa}</Text>

                  {on ? <ChevronDown size={18} color={T.brand} /> : null}

                </Pressable>

              );

            })}

          </View>

        </FieldBlock>



        <View style={{ paddingHorizontal: 16, paddingVertical: 8 }}>

          <Text style={[labelStyle, { marginBottom: 12 }]}>{ka.symptoms.pain}</Text>

          <SymptomPainScale

            value={state.painLevel}

            onChange={(painLevel) => updateSymptomChecker({ painLevel })}

          />

        </View>



        <FieldBlock label={ka.symptoms.notes}>

          <TextInput

            value={state.notes}

            onChangeText={(notes) => updateSymptomChecker({ notes: notes.slice(0, 300) })}

            placeholder={ka.symptoms.notesPlaceholder}

            placeholderTextColor={T.textMuted}

            multiline

            style={{

              minHeight: 120,

              borderRadius: 14,

              borderWidth: 1,

              borderColor: T.borderTertiary,

              backgroundColor: T.white,

              padding: 16,

              fontSize: 16,

              lineHeight: 24,

              color: T.textPrimary,

              textAlignVertical: 'top',

              ...T.shadowXs,

            }}

          />

          <Text style={{ marginTop: 6, fontSize: 12, color: T.textMuted, textAlign: 'right' }}>

            {state.notes.length}/300

          </Text>

        </FieldBlock>



        <View style={{ marginHorizontal: 16, marginTop: 8, padding: 16, borderRadius: 14, backgroundColor: T.cardBg, gap: 8 }}>

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>

            <Text style={{ fontSize: 14, fontWeight: '600', color: T.textPrimary }}>{ka.symptoms.sendToNightingale}</Text>

            <Switch value={false} trackColor={{ false: T.border, true: T.brand }} disabled />

          </View>

          <Text style={{ fontSize: 13, lineHeight: 20, color: T.textSecondary }}>{ka.symptoms.privacyNote}</Text>

        </View>

      </ScrollView>



      <SymptomFooter>

        <Pressable

          onPress={() => router.push('/symptoms/analyzing' as never)}

          disabled={state.symptoms.length === 0}

          style={{

            height: T.btnH,

            borderRadius: T.btnRadius,

            backgroundColor: T.brand,

            flexDirection: 'row',

            alignItems: 'center',

            justifyContent: 'center',

            gap: 10,

            opacity: state.symptoms.length === 0 ? 0.45 : 1,

            ...T.shadowXs,

          }}

        >

          <Text style={{ color: T.white, fontSize: 16, fontWeight: '600' }}>{ka.symptoms.analyzeSymptom}</Text>

          <Search size={20} color={T.white} strokeWidth={2.2} />

        </Pressable>

      </SymptomFooter>

    </View>

  );

}



function FieldBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ paddingHorizontal: 16, paddingVertical: 8, gap: 8 }}>
      <Text style={labelStyle}>{label}</Text>
      {children}
    </View>
  );
}

const labelStyle = { fontSize: 14, fontWeight: '600' as const, color: T.textPrimary };
const hintStyle = { fontSize: 14, lineHeight: 22, color: T.textSecondary };

const fieldBox = {

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

};


