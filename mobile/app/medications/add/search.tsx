import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronRight, Search, X } from 'lucide-react-native';
import { MedicationPillIcon } from '@/components/medications/MedicationPillIcon';
import { MedChip, MedDivider, MedInsetCard, MedPrimaryButton } from '@/components/medications/MedicationUI';
import { FIGMA_MEDS } from '@/constants/figmaMedicationsLayout';
import { MEDICATION_CATALOG } from '@/constants/medicationCatalog';
import { ka } from '@/i18n/ka';

const CATEGORIES = ['ყველა', 'გული', 'დიაბეტი', 'ალერგია', 'ტკივილი', 'ვიტამინები'] as const;

export default function MedicationSearchScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ q?: string }>();
  const [query, setQuery] = useState(params.q ?? '');
  const [category, setCategory] = useState<string>('ყველა');

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return MEDICATION_CATALOG.slice(0, 20);
    return MEDICATION_CATALOG.filter(
      (e) =>
        e.inn.toLowerCase().includes(q) ||
        e.ka.toLowerCase().includes(q) ||
        e.aliases?.some((a) => a.toLowerCase().includes(q)),
    );
  }, [query]);

  return (
    <>
      <Stack.Screen options={{ title: ka.meds.addTitle }} />
      <View style={{ flex: 1, backgroundColor: FIGMA_MEDS.white }}>
        <View style={{ paddingHorizontal: 16 }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: FIGMA_MEDS.white,
              borderRadius: FIGMA_MEDS.inputRadius,
              borderWidth: 1,
              borderColor: FIGMA_MEDS.borderTertiary,
              paddingHorizontal: 12,
              marginTop: 8,
              marginBottom: 16,
              minHeight: FIGMA_MEDS.inputHeight,
              gap: 12,
              ...FIGMA_MEDS.shadowInput,
            }}
          >
            <Search size={18} color={FIGMA_MEDS.textMuted} strokeWidth={2.2} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={ka.meds.searchPlaceholder}
              placeholderTextColor={FIGMA_MEDS.textMuted}
              style={{ flex: 1, paddingVertical: 10, fontSize: 16, lineHeight: 22, color: FIGMA_MEDS.textPrimary }}
              autoFocus={!params.q}
            />
            {query ? (
              <Pressable onPress={() => setQuery('')} hitSlop={12}>
                <X size={18} color={FIGMA_MEDS.textMuted} />
              </Pressable>
            ) : null}
          </View>

          <FlatList
            horizontal
            data={CATEGORIES as unknown as string[]}
            keyExtractor={(item) => item}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, marginBottom: 16 }}
            renderItem={({ item }) => (
              <MedChip label={item} active={category === item} onPress={() => setCategory(item)} />
            )}
          />
        </View>

        {results.length === 0 ? (
          <View style={{ alignItems: 'center', paddingTop: 48, paddingHorizontal: 16 }}>
            <Text style={{ fontWeight: '700', fontSize: 18, color: FIGMA_MEDS.textPrimary }}>{ka.meds.searchNotFound}</Text>
            <Text style={{ color: FIGMA_MEDS.textSecondary, marginTop: 8, textAlign: 'center', lineHeight: 22 }}>{ka.meds.searchNotFoundHint}</Text>
            <View style={{ marginTop: 24, width: '100%' }}>
              <MedPrimaryButton
                label={ka.meds.addCustom}
                onPress={() => router.push({ pathname: '/medications/add/setup', params: { name: query.trim() } })}
              />
            </View>
          </View>
        ) : (
          <View style={{ paddingHorizontal: 16, flex: 1 }}>
            <MedInsetCard style={{ padding: 0, overflow: 'hidden', flex: 1 }}>
              <FlatList
                data={results}
                keyExtractor={(item) => item.inn}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 40 }}
                renderItem={({ item, index }) => {
                  const alias = item.aliases?.[0] ?? item.inn;
                  return (
                    <Pressable
                      onPress={() => router.push({ pathname: '/medications/add/setup', params: { name: item.ka, generic: item.inn } })}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 }}>
                        <MedicationPillIcon size={48} border />
                        <View style={{ flex: 1, gap: 4 }}>
                          <Text style={{ fontSize: 12, fontWeight: '500', color: FIGMA_MEDS.textSecondary }}>{alias}</Text>
                          <Text style={{ fontSize: 14, fontWeight: '600', color: FIGMA_MEDS.textPrimary }}>{item.ka}</Text>
                          <Text style={{ fontSize: 14, color: FIGMA_MEDS.textSecondary }}>{item.inn}</Text>
                        </View>
                        <ChevronRight size={24} color={FIGMA_MEDS.textMuted} strokeWidth={2} />
                      </View>
                      {index < results.length - 1 ? <MedDivider /> : null}
                    </Pressable>
                  );
                }}
              />
            </MedInsetCard>
          </View>
        )}
      </View>
    </>
  );
}
