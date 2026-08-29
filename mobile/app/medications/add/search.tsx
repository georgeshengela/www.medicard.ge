import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronRight, Search, X } from 'lucide-react-native';
import { MedicationPillIcon } from '@/components/medications/MedicationPillIcon';
import { MedChip, MedDivider, MedInsetCard, MedPrimaryButton } from '@/components/medications/MedicationUI';
import { useFigmaMeds } from '@/constants/figmaMedicationsLayout';
import { ka } from '@/i18n/ka';
import { api, type CatalogProductSummary, type DrugCategoryInfo } from '@/lib/api';
import { catalogProductMeta, catalogProductSetupParams } from '@/lib/medicationCatalogNav';

function paramStr(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

export default function MedicationSearchScreen() {
  const FIGMA_MEDS = useFigmaMeds();
  const router = useRouter();
  const params = useLocalSearchParams<{ q?: string }>();
  const [query, setQuery] = useState(paramStr(params.q));
  const [debouncedQuery, setDebouncedQuery] = useState(paramStr(params.q).trim());
  const [categorySlug, setCategorySlug] = useState<string | null>(null);
  const [categories, setCategories] = useState<DrugCategoryInfo[]>([]);
  const [products, setProducts] = useState<CatalogProductSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), 350);
    return () => clearTimeout(timer);
  }, [query]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [catRes, prodRes] = await Promise.allSettled([
        api.pharmacy.categories(),
        api.pharmacy.products({
          q: debouncedQuery || undefined,
          category: categorySlug ?? undefined,
          sort: 'name',
          limit: 40,
        }),
      ]);
      if (catRes.status === 'fulfilled') setCategories(catRes.value.categories);
      if (prodRes.status === 'fulfilled') setProducts(prodRes.value.products);
      else setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [categorySlug, debouncedQuery]);

  useEffect(() => {
    void load();
  }, [load]);

  const chips = useMemo(() => [{ slug: null as string | null, nameKa: 'ყველა' }, ...categories], [categories]);

  const openSetup = (product: CatalogProductSummary) => {
    router.push({ pathname: '/medications/add/setup', params: catalogProductSetupParams(product) });
  };

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
              returnKeyType="search"
            />
            {query ? (
              <Pressable onPress={() => setQuery('')} hitSlop={12}>
                <X size={18} color={FIGMA_MEDS.textMuted} />
              </Pressable>
            ) : null}
          </View>

          {chips.length > 1 ? (
            <FlatList
              horizontal
              data={chips}
              keyExtractor={(item) => item.slug ?? 'all'}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8, marginBottom: 16 }}
              renderItem={({ item }) => (
                <MedChip
                  label={item.nameKa}
                  active={categorySlug === item.slug}
                  onPress={() => setCategorySlug(item.slug)}
                />
              )}
            />
          ) : null}
        </View>

        {loading && products.length === 0 ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator color={FIGMA_MEDS.brand} />
          </View>
        ) : products.length === 0 ? (
          <View style={{ alignItems: 'center', paddingTop: 48, paddingHorizontal: 16 }}>
            <Text style={{ fontWeight: '700', fontSize: 18, color: FIGMA_MEDS.textPrimary }}>{ka.meds.searchNotFound}</Text>
            <Text style={{ color: FIGMA_MEDS.textSecondary, marginTop: 8, textAlign: 'center', lineHeight: 22 }}>
              {ka.meds.searchNotFoundHint}
            </Text>
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
                data={products}
                keyExtractor={(item) => item.id}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ paddingBottom: 40 }}
                renderItem={({ item, index }) => {
                  const meta = catalogProductMeta(item);
                  return (
                    <Pressable onPress={() => openSetup(item)}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 }}>
                        <MedicationPillIcon size={48} imageUrl={item.imageUrl} border />
                        <View style={{ flex: 1, gap: 4 }}>
                          {item.category?.nameKa ? (
                            <Text style={{ fontSize: 12, fontWeight: '500', color: FIGMA_MEDS.textSecondary }} numberOfLines={1}>
                              {item.category.nameKa}
                            </Text>
                          ) : null}
                          <Text style={{ fontSize: 14, fontWeight: '600', color: FIGMA_MEDS.textPrimary }} numberOfLines={2}>
                            {item.name}
                          </Text>
                          {meta ? (
                            <Text style={{ fontSize: 14, color: FIGMA_MEDS.textSecondary }} numberOfLines={1}>
                              {meta}
                            </Text>
                          ) : null}
                        </View>
                        <ChevronRight size={24} color={FIGMA_MEDS.textMuted} strokeWidth={2} />
                      </View>
                      {index < products.length - 1 ? <MedDivider /> : null}
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
