import { tx } from '@/i18n/locale';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Plus, Search } from 'lucide-react-native';
import { SymptomNavHeader } from '@/components/symptoms/SymptomNavHeader';
import { SymptomChip } from '@/components/symptoms/SymptomChip';
import { SymptomComposer } from '@/components/symptoms/SymptomComposer';
import { KEYBOARD_DONE_ACCESSORY_ID, KeyboardDoneAccessory } from '@/components/ui/KeyboardDoneAccessory';
import { useFigmaSymptoms } from '@/constants/figmaSymptomsLayout';
import { POPULAR_SYMPTOMS } from '@/constants/symptomCatalog';
import { ka } from '@/i18n/ka';
import {
  addSymptom,
  getSymptomCheckerState,
  removeSymptom,
  resetSymptomChecker,
  toggleSymptom,
  updateSymptomChecker,
  useSymptomChecker,
} from '@/lib/symptomCheckerStore';
import { useAuth } from '@/store/AuthContext';

export default function SymptomSearchScreen() {
  const T = useFigmaSymptoms();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const state = useSymptomChecker();
  const params = useLocalSearchParams<{ start?: string }>();
  // Entered from Home („აღწერე სიტყვებით“): a fresh check, not the last one still in memory.
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (params.start === '1') {
      resetSymptomChecker(user?.gender);
      updateSymptomChecker({ method: 'manual' });
    }
  }, [params.start, user?.gender]);
  const [query, setQuery] = useState('');
  const [inputError, setInputError] = useState<string | null>(null);
  const inputRef = useRef<TextInput>(null);
  const firstName = user?.fullName?.split(' ')[0] ?? '';
  const typed = query.trim();

  const filtered = useMemo(() => {
    const q = typed.toLowerCase();
    if (!q) return [...POPULAR_SYMPTOMS];
    return POPULAR_SYMPTOMS.filter((s) => s.toLowerCase().includes(q));
  }, [typed]);

  const alreadyAdded = state.symptoms.some((s) => s.toLowerCase() === typed.toLowerCase());
  const showCustom = typed.length > 0 && !POPULAR_SYMPTOMS.some((s) => s.toLowerCase() === typed.toLowerCase());

  const commitTyped = () => {
    if (typed && !addSymptom(typed)) { setInputError(tx('ერთ შემოწმებაში მაქსიმუმ 16 სიმპტომი შეგიძლია დაამატო.', 'You can add up to 16 symptoms in one check.')); return false; }
    setInputError(null);
    setQuery('');
    return true;
  };

  const goDetails = () => {
    if (!commitTyped()) return;
    if (getSymptomCheckerState().symptoms.length === 0) {
      inputRef.current?.focus();
      return;
    }
    router.push('/symptoms/details' as never);
  };


  return (
    <View style={{ flex: 1, backgroundColor: T.canvas }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        <SymptomNavHeader onBack={() => router.back()} />
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 24 }}
          keyboardShouldPersistTaps="handled"
        >
          <Text
            style={{
              paddingHorizontal: 20,
              paddingTop: 4,
              paddingBottom: 4,
              fontSize: 24,
              lineHeight: 32,
              fontFamily: 'NotoSansGeorgian_700Bold',
              color: T.textPrimary,
              letterSpacing: -0.3,
            }}
          >
            {ka.symptoms.askName(firstName)}
          </Text>

          <View style={{ paddingHorizontal: 16, paddingVertical: 16 }}>
            <View
              style={{
                minHeight: 56,
                borderRadius: 20,
                borderWidth: 1.5,
                borderColor: typed ? T.brand : 'transparent',
                backgroundColor: T.white,
                paddingLeft: 12,
                paddingRight: 8,
                paddingVertical: 8,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                ...T.shadowXs,
              }}
            >
              <Search size={20} color={T.textSecondary} strokeWidth={1.8} />
              <TextInput
                ref={inputRef}
                value={query}
                onChangeText={setQuery}
                placeholder={ka.symptoms.searchPlaceholder}
                placeholderTextColor={T.textSecondary}
                returnKeyType="done"
                maxLength={80}
                inputAccessoryViewID={KEYBOARD_DONE_ACCESSORY_ID}
                onSubmitEditing={() => {
                  if (typed) commitTyped();
                }}
                style={{
                  flex: 1,
                  minWidth: 0,
                  minHeight: 40,
                  fontSize: 16,
                  color: T.textPrimary,
                  paddingVertical: Platform.OS === 'android' ? 8 : 10,
                  paddingHorizontal: 0,
                  textAlignVertical: 'center',
                  includeFontPadding: false,
                }}
              />
              {typed ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={ka.symptoms.addCustom}
                  onPress={commitTyped}
                  style={{
                    minHeight: 36,
                    borderRadius: 10,
                    backgroundColor: T.brand,
                    paddingHorizontal: 10,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <Plus size={16} color={T.textOnBrand} strokeWidth={2.4} />
                  <Text style={{ color: T.textOnBrand, fontSize: 13, fontWeight: '600' }}>{ka.symptoms.addCustom}</Text>
                </Pressable>
              ) : null}
            </View>
          </View>

          {state.symptoms.length ? (
            <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
              <Text style={{ fontSize: 14, lineHeight: 20, fontWeight: '600', color: T.textPrimary, marginBottom: 12 }}>
                {ka.symptoms.mySymptoms}
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {state.symptoms.map((s) => (
                  <SymptomChip key={s} label={s} onRemove={() => removeSymptom(s)} />
                ))}
              </View>
            </View>
          ) : null}

          {showCustom ? (
            <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
              <SymptomChip
                label={typed}
                selected={alreadyAdded}
                onPress={() => (alreadyAdded ? removeSymptom(typed) : addSymptom(typed))}
              />
            </View>
          ) : null}

          <View style={{ paddingHorizontal: 16, paddingTop: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {filtered.map((s) => (
              <SymptomChip
                key={s}
                label={s}
                selected={state.symptoms.some((item) => item.toLowerCase() === s.toLowerCase())}
                onPress={() => toggleSymptom(s)}
              />
            ))}
          </View>
        </ScrollView>

        {inputError ? <Text accessibilityRole="alert" style={{ color: T.danger, paddingHorizontal: 16, paddingVertical: 8 }}>{inputError}</Text> : null}
        <SymptomComposer
          count={state.symptoms.length + (typed && !alreadyAdded ? 1 : 0)}
          onFocusInput={() => inputRef.current?.focus()}
          onAnatomy={() => { updateSymptomChecker({ method: 'anatomy' }); router.push('/symptoms/body' as never); }}
          onContinue={goDetails}
          disabled={state.symptoms.length === 0 && !typed}
        />
      </KeyboardAvoidingView>
      <KeyboardDoneAccessory />
      <View style={{ height: insets.bottom, backgroundColor: T.canvas }} />
    </View>
  );
}
