import { tx } from '@/i18n/locale';
import React, { useCallback, useRef } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Switch } from '@/components/ui/AppSwitch';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronRight, Pill, Plus, Search, ShieldCheck } from 'lucide-react-native';
import { SymptomNavHeader } from '@/components/symptoms/SymptomNavHeader';
import { SymptomFooter } from '@/components/symptoms/SymptomCta';
import { SymptomChip } from '@/components/symptoms/SymptomChip';
import { SymptomPainScale } from '@/components/symptoms/SymptomPainScale';
import { KEYBOARD_DONE_ACCESSORY_ID, KeyboardDoneAccessory } from '@/components/ui/KeyboardDoneAccessory';
import { useFigmaSymptoms } from '@/constants/figmaSymptomsLayout';
import { DURATION_OPTIONS } from '@/constants/symptomCatalog';
import { useMedications } from '@/hooks/useMedications';
import { ka } from '@/i18n/ka';
import { updateSymptomChecker, useSymptomChecker } from '@/lib/symptomCheckerStore';
import { useAuth } from '@/store/AuthContext';
import { displayFirstName } from '@/lib/displayName';
import { useFeature } from '@/lib/featureFlags';

/**
 * A few details before the analysis (owner 2026-10-04 redesign): grouped cards on the canvas — what
 * bothers most, since when (chips, no sheet), how strong, then the optional context — and one
 * „სიმპტომის ანალიზი“ pinned at the bottom. Only the symptoms are required; everything else helps.
 */
export default function SymptomDetailsScreen() {
  const T = useFigmaSymptoms();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const state = useSymptomChecker();
  const { user, healthProfile } = useAuth();
  const { medications } = useMedications();
  // While medications are paused from admin the list still shows here, it just does not open the module.
  const medsOn = useFeature('medications');
  // Never the server's placeholder name: without a real one the heading has no name.
  const firstName = displayFirstName(user, healthProfile?.extraAnswers);
  const navigating = useRef(false);
  useFocusEffect(useCallback(() => { navigating.current = false; }, []));

  const medSummary =
    medications.length === 0
      ? ka.symptoms.noMedications
      : medications.length <= 2
        ? medications.map((m) => m.medName).join(', ')
        : `${medications
            .slice(0, 2)
            .map((m) => m.medName)
            .join(', ')}, +${medications.length - 2}`;

  const analyze = () => {
    if (navigating.current) return;
    if (state.symptoms.length === 0) {
      router.push('/symptoms/search' as never);
      return;
    }
    if (!state.primarySymptom) updateSymptomChecker({ primarySymptom: state.symptoms[0] });
    navigating.current = true;
    router.push('/symptoms/analyzing' as never);
  };

  const input = {
    flex: 1,
    fontFamily: 'NotoSansGeorgian_400Regular',
    fontSize: 15,
    lineHeight: 22,
    color: T.textPrimary,
    paddingVertical: 0,
  } as const;

  return (
    <View style={{ flex: 1, backgroundColor: T.canvas }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}>
        <SymptomNavHeader onBack={() => router.back()} />
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24, gap: 12 }} keyboardShouldPersistTaps="handled">
          <View style={{ paddingHorizontal: 4, paddingBottom: 4, gap: 6 }}>
            <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 22, lineHeight: 30, color: T.textPrimary, letterSpacing: -0.3 }}>
              {ka.symptoms.detailsHeading(firstName)}
            </Text>
            <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 14, lineHeight: 21, color: T.textSecondary }}>{ka.symptoms.detailsSubtitle}</Text>
          </View>

          <Card title={ka.symptoms.primarySymptom} hint={state.symptoms.length > 1 ? ka.symptoms.primarySymptomHint : undefined}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {state.symptoms.map((s) => (
                <SymptomChip
                  key={s}
                  label={s}
                  selected={(state.primarySymptom ?? state.symptoms[0]) === s}
                  onPress={() => updateSymptomChecker({ primarySymptom: s })}
                />
              ))}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={tx('სიმპტომის დამატება', 'Add a symptom')}
                onPress={() => router.back()}
                style={{ minHeight: 36, borderRadius: 18, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: T.brandSoft }}
              >
                <Plus size={15} color={T.brand} strokeWidth={2.4} />
                <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 13, color: T.brand }}>{tx('დამატება', 'Add')}</Text>
              </Pressable>
            </View>
          </Card>

          {/* Since when — chips right here (was a field that opened a sheet). */}
          <Card title={ka.symptoms.durationQuestion}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {DURATION_OPTIONS.map((opt) => (
                <SymptomChip
                  key={opt.id}
                  label={opt.labelKa}
                  selected={state.durationId === opt.id}
                  onPress={() => updateSymptomChecker({ durationId: state.durationId === opt.id ? null : opt.id })}
                />
              ))}
            </View>
          </Card>

          <Card title={ka.symptoms.pain}>
            <SymptomPainScale value={state.painLevel} onChange={(painLevel) => updateSymptomChecker({ painLevel })} />
          </Card>

          <Card title={tx('დამატებით', 'More context')} hint={tx('არასავალდებულოა — ორიენტირს აზუსტებს', 'Optional — makes the guide more precise')}>
            <Pressable
              accessibilityRole={medsOn ? 'button' : undefined}
              disabled={!medsOn}
              onPress={() => router.push('/(tabs)/medications' as never)}
              style={[fieldRow, { backgroundColor: T.cardBg }]}
            >
              <Pill size={18} color={T.brand} strokeWidth={1.9} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 12, color: T.textSecondary }}>{ka.symptoms.currentMedication}</Text>
                <Text numberOfLines={1} style={{ fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 14.5, lineHeight: 20, color: T.textPrimary }}>
                  {medSummary}
                </Text>
              </View>
              {medsOn ? <ChevronRight size={17} color={T.textMuted} /> : null}
            </Pressable>
            <View style={[fieldRow, { backgroundColor: T.cardBg }]}>
              <TextInput
                value={state.pastConditions}
                maxLength={800}
                onChangeText={(pastConditions) => updateSymptomChecker({ pastConditions })}
                placeholder={`${ka.symptoms.pastConditions} — ${ka.symptoms.pastConditionsPlaceholder}`}
                placeholderTextColor={T.textMuted}
                style={input}
                inputAccessoryViewID={KEYBOARD_DONE_ACCESSORY_ID}
              />
            </View>
            <View style={[fieldRow, { backgroundColor: T.cardBg, alignItems: 'flex-start', minHeight: 96 }]}>
              <TextInput
                value={state.notes}
                onChangeText={(notes) => updateSymptomChecker({ notes: notes.slice(0, 300) })}
                placeholder={ka.symptoms.notesPlaceholder}
                placeholderTextColor={T.textMuted}
                multiline
                style={[input, { minHeight: 72, textAlignVertical: 'top' }]}
                inputAccessoryViewID={KEYBOARD_DONE_ACCESSORY_ID}
              />
            </View>
            {state.notes.length ? (
              <Text style={{ alignSelf: 'flex-end', fontSize: 11.5, color: T.textMuted, marginTop: -4 }}>{state.notes.length}/300</Text>
            ) : null}
          </Card>

          <View style={{ borderRadius: 22, backgroundColor: T.white, padding: 16, gap: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Text style={{ flex: 1, fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 14, lineHeight: 20, color: T.textPrimary }}>
                {tx('ჩემი ჯანმრთელობის პროფილის გათვალისწინება', 'Consider my health profile')}
              </Text>
              <Switch
                value={state.shareToNightingale}
                onValueChange={(shareToNightingale) => updateSymptomChecker({ shareToNightingale })}
                trackColor={{ false: T.track, true: T.brand }}
                thumbColor="#FFFFFF"
              />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
              <ShieldCheck size={16} color={T.textMuted} strokeWidth={2} style={{ marginTop: 2 }} />
              <Text style={{ flex: 1, fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 12.5, lineHeight: 19, color: T.textSecondary }}>{ka.symptoms.privacyNote}</Text>
            </View>
          </View>
        </ScrollView>

        <SymptomFooter>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={ka.symptoms.analyzeSymptom}
            onPress={analyze}
            style={{ height: 52, borderRadius: 26, backgroundColor: T.brandDark, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 }}
          >
            <Search size={19} color="#FFFFFF" strokeWidth={2.3} />
            <Text style={{ color: '#FFFFFF', fontSize: 15.5, fontFamily: 'NotoSansGeorgian_600SemiBold' }}>{ka.symptoms.analyzeSymptom}</Text>
          </Pressable>
        </SymptomFooter>
      </KeyboardAvoidingView>
      <KeyboardDoneAccessory />
      <View style={{ height: insets.bottom, backgroundColor: T.canvas }} />
    </View>
  );
}

const fieldRow = {
  flexDirection: 'row' as const,
  alignItems: 'center' as const,
  gap: 12,
  minHeight: 52,
  paddingHorizontal: 14,
  paddingVertical: 12,
  borderRadius: 16,
};

function Card({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  const T = useFigmaSymptoms();
  return (
    <View style={{ borderRadius: 22, backgroundColor: T.white, padding: 16, gap: 12 }}>
      <View style={{ gap: 2 }}>
        <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 15, lineHeight: 21, color: T.textPrimary }}>{title}</Text>
        {hint ? <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 12.5, lineHeight: 18, color: T.textSecondary }}>{hint}</Text> : null}
      </View>
      {children}
    </View>
  );
}
