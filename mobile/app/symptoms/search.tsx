import React, { useMemo, useRef, useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Search } from 'lucide-react-native';
import { SymptomNavHeader } from '@/components/symptoms/SymptomNavHeader';
import { SymptomChip } from '@/components/symptoms/SymptomChip';
import { SymptomComposer } from '@/components/symptoms/SymptomComposer';
import { FIGMA_SYMPTOMS as T } from '@/constants/figmaSymptomsLayout';
import { POPULAR_SYMPTOMS } from '@/constants/symptomCatalog';
import { ka } from '@/i18n/ka';
import { removeSymptom, toggleSymptom, useSymptomChecker } from '@/lib/symptomCheckerStore';
import { useAuth } from '@/store/AuthContext';

export default function SymptomSearchScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const state = useSymptomChecker();
  const [query, setQuery] = useState('');
  const inputRef = useRef<TextInput>(null);
  const firstName = user?.fullName?.split(' ')[0] ?? '';

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pool = [...POPULAR_SYMPTOMS];
    if (q && !pool.some((s) => s.toLowerCase() === q)) pool.unshift(query.trim() as (typeof POPULAR_SYMPTOMS)[number]);
    return q ? pool.filter((s) => s.toLowerCase().includes(q)) : pool;
  }, [query]);

  const score = Math.min(92, 28 + state.symptoms.length * 12);

  const addQuery = () => {
    const next = query.trim();
    if (next) {
      toggleSymptom(next);
      setQuery('');
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: T.white, paddingBottom: insets.bottom }}>
      <SymptomNavHeader onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
        <Text
          style={{
            paddingHorizontal: 16,
            paddingTop: 16,
            fontSize: 30,
            lineHeight: 38,
            fontWeight: '700',
            color: T.textPrimary,
            letterSpacing: -0.25,
          }}
        >
          {ka.symptoms.askName(firstName)}
        </Text>

        <View style={{ paddingHorizontal: 16, paddingTop: 32 }}>
          <View
            style={{
              height: 48,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: T.borderTertiary,
              backgroundColor: T.white,
              paddingHorizontal: 14,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              ...T.shadowXs,
            }}
          >
            <Search size={20} color={T.textMuted} />
            <TextInput
              ref={inputRef}
              value={query}
              onChangeText={setQuery}
              placeholder={ka.symptoms.searchPlaceholder}
              placeholderTextColor={T.textMuted}
              onSubmitEditing={addQuery}
              style={{ flex: 1, fontSize: 16, color: T.textPrimary, paddingVertical: 0 }}
            />
          </View>
        </View>

        {state.symptoms.length ? (
          <View style={{ paddingHorizontal: 16, paddingTop: 24 }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: T.textPrimary, marginBottom: 12 }}>
              {ka.symptoms.mySymptoms}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {state.symptoms.map((s) => (
                <SymptomChip key={s} label={s} selected onRemove={() => removeSymptom(s)} />
              ))}
            </View>
          </View>
        ) : null}

        <View style={{ paddingHorizontal: 16, paddingTop: 20, flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {filtered.map((s) => (
            <SymptomChip
              key={s}
              label={s}
              selected={state.symptoms.includes(s)}
              onPress={() => toggleSymptom(s)}
            />
          ))}
        </View>
      </ScrollView>

      <SymptomComposer
        score={score}
        onFocusInput={() => inputRef.current?.focus()}
        onAnatomy={() => router.push('/symptoms/body' as never)}
        sendDisabled={state.symptoms.length === 0 && !query.trim()}
        onSend={() => {
          addQuery();
          if (state.symptoms.length || query.trim()) router.push('/symptoms/details' as never);
        }}
      />
    </View>
  );
}
