import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronRight, Crown, Search, X } from 'lucide-react-native';
import { MedicationPillIcon } from '@/components/medications/MedicationPillIcon';
import { ListRowsSkeleton } from '@/components/ui/Skeleton';
import { ka } from '@/i18n/ka';
import { api, type CatalogProductSummary, type DrugCategoryInfo } from '@/lib/api';
import { catalogProductMeta } from '@/lib/medicationCatalogNav';
import { useIsDark, useThemeColors } from '@/theme/colors';
import { HUB, hubInk, hubText } from '@/theme/hub';

function paramStr(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

export default function MedicationSearchScreen() {
  const c = useThemeColors();
  const dark = useIsDark();
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

  const openProduct = (product: CatalogProductSummary) => {
    router.push(`/pharmacy/product/${product.id}` as never);
  };

  const primaryInk = hubInk('teal', dark);
  const priceInk = hubInk('green', dark);

  return (
    <>
      <Stack.Screen options={{ title: ka.meds.addTitle }} />
      <View style={{ flex: 1, backgroundColor: c.bg100 }}>
        <View style={{ paddingHorizontal: HUB.gutter }}>
          <View style={[s.searchShell, { backgroundColor: c.surface, marginTop: 10, marginBottom: 14 }]}>
            <Search size={18} color={c.text300} strokeWidth={2.2} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={ka.meds.searchPlaceholder}
              placeholderTextColor={c.text300}
              style={[hubText.body, { flex: 1, paddingVertical: 12, fontSize: 16, color: c.text100 }]}
              autoFocus={!params.q}
              returnKeyType="search"
            />
            {query ? (
              <Pressable onPress={() => setQuery('')} hitSlop={12}>
                <X size={18} color={c.text300} />
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
              renderItem={({ item }) => {
                const active = categorySlug === item.slug;
                return (
                  <Pressable
                    onPress={() => setCategorySlug(item.slug)}
                    style={[
                      s.chip,
                      { backgroundColor: active ? `${primaryInk}${dark ? '26' : '14'}` : c.surface },
                    ]}
                  >
                    <Text style={active ? [hubText.link, { color: primaryInk }] : [hubText.caption, { color: c.text100 }]}>
                      {item.nameKa}
                    </Text>
                  </Pressable>
                );
              }}
            />
          ) : null}
        </View>

        {loading && products.length === 0 ? (
          <View style={{ paddingTop: 4 }}>
            <ListRowsSkeleton rows={6} />
          </View>
        ) : products.length === 0 ? (
          <View style={{ alignItems: 'center', paddingTop: 56, paddingHorizontal: HUB.gutter }}>
            <Text style={[hubText.cardTitle, { fontSize: 18, color: c.text100 }]}>{ka.meds.searchNotFound}</Text>
            <Text style={[hubText.body, { color: c.text200, marginTop: 8, textAlign: 'center' }]}>
              {ka.meds.searchNotFoundHint}
            </Text>
            <Pressable
              onPress={() => router.push({ pathname: '/medications/add/setup', params: { name: query.trim() } })}
              style={{ marginTop: 24, width: '100%', minHeight: 50, borderRadius: HUB.tileRadius, backgroundColor: c.primary200, alignItems: 'center', justifyContent: 'center' }}
            >
              <Text style={{ color: c.onPrimary, fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 16 }}>{ka.meds.addCustom}</Text>
            </Pressable>
          </View>
        ) : (
          <View style={{ paddingHorizontal: HUB.gutter, flex: 1 }}>
            <View style={{ backgroundColor: c.surface, borderRadius: HUB.cardRadius, overflow: 'hidden', flex: 1 }}>
              <FlatList
                data={products}
                keyExtractor={(item) => item.id}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ paddingBottom: 40 }}
                renderItem={({ item, index }) => {
                  const meta = catalogProductMeta(item);
                  return (
                    <Pressable onPress={() => openProduct(item)}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: HUB.cardPad, paddingVertical: 12 }}>
                        <MedicationPillIcon size={46} imageUrl={item.imageUrl} border />
                        <View style={{ flex: 1, gap: 3, minWidth: 0 }}>
                          {item.category?.nameKa ? (
                            <Text numberOfLines={1} style={[hubText.small, { color: c.text300 }]}>
                              {item.category.nameKa}
                            </Text>
                          ) : null}
                          <Text numberOfLines={2} style={[hubText.cardTitle, { color: c.text100 }]}>
                            {item.name}
                          </Text>
                          {meta ? (
                            <Text numberOfLines={1} style={[hubText.caption, { color: c.text200 }]}>
                              {meta}
                            </Text>
                          ) : null}
                        </View>
                        {item.bestPriceGel != null ? (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                            <Crown size={11} color={priceInk} strokeWidth={2.4} />
                            <Text style={[hubText.value, { fontSize: 14, color: priceInk }]}>{item.bestPriceGel.toFixed(2)} ₾</Text>
                          </View>
                        ) : (
                          <ChevronRight size={20} color={c.text300} strokeWidth={2} />
                        )}
                      </View>
                      {index < products.length - 1 ? (
                        <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.bg300, marginLeft: HUB.cardPad }} />
                      ) : null}
                    </Pressable>
                  );
                }}
              />
            </View>
          </View>
        )}
      </View>
    </>
  );
}

const s = StyleSheet.create({
  searchShell: {
    minHeight: 48,
    borderRadius: HUB.tileRadius,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    gap: 10,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
  },
});
