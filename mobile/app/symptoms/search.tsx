import React, { useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
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
  toggleSymptom,
  useSymptomChecker,
} from '@/lib/symptomCheckerStore';
import { useAuth } from '@/store/AuthContext';

export default function SymptomSearchScreen() {
  const T = useFigmaSymptoms();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const state = useSymptomChecker();
  const [query, setQuery] = useState('');
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
  const score = Math.min(92, 28 + state.symptoms.length * 12 + (typed && !alreadyAdded ? 12 : 0));

  const commitTyped = () => {
    if (typed) addSymptom(typed);
    setQuery('');
  };

  const goDetails = () => {
    commitTyped();
    if (getSymptomCheckerState().symptoms.length === 0) {
      inputRef.current?.focus();
      return;
    }
    router.push('/symptoms/details' as never);
  };

  const goAnalyze = () => {
    commitTyped();
    if (getSymptomCheckerState().symptoms.length === 0) {
      inputRef.current?.focus();
      return;
    }
    router.push('/symptoms/analyzing' as never);
  };

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
          contentContainerStyle={{ paddingBottom: 24 }}
          keyboardShouldPersistTaps="handled"
        >
          <Text
            style={{
              paddingHorizontal: 16,
              paddingVertical: 16,
              fontSize: 30,
              lineHeight: 38,
              fontWeight: '700',
              color: T.textPrimary,
              letterSpacing: -0.25,
              textAlign: 'center',
            }}
          >
            {ka.symptoms.askName(firstName)}
          </Text>

          <View style={{ paddingHorizontal: 16, paddingVertical: 16 }}>
            <View
              style={{
                minHeight: 56,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: typed ? T.brand : T.borderTertiary,
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

        <SymptomComposer
          score={score}
          onFocusInput={() => inputRef.current?.focus()}
          onAnatomy={() => router.push('/symptoms/body' as never)}
          onSettings={goDetails}
          sendDisabled={state.symptoms.length === 0 && !typed}
          onSend={goAnalyze}
        />
      </KeyboardAvoidingView>
      <KeyboardDoneAccessory />
      <View style={{ height: insets.bottom, backgroundColor: T.white }} />
    </View>
  );
}
