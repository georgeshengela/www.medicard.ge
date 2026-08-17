import React, { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Layers3 } from 'lucide-react-native';
import { CategoryGrid } from '@/components/pharmacy/CategoryGrid';
import { PharmacyBrowseHeader } from '@/components/pharmacy/PharmacyBrowseHeader';
import { PharmacyProductCard } from '@/components/pharmacy/PharmacyProductCard';
import { EmptyState } from '@/components/EmptyState';
import { ka } from '@/i18n/ka';
import { api, type CatalogProductSummary, type DrugCategoryInfo } from '@/lib/api';
import { formatRelative } from '@/lib/format';
import { useThemeColors } from '@/theme/colors';
import { pharmPx } from '@/constants/pharmacyVisuals';

export default function PharmacyIndexScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const [categories, setCategories] = useState<DrugCategoryInfo[]>([]);
  const [products, setProducts] = useState<CatalogProductSummary[]>([]);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [syncLabel, setSyncLabel] = useState<string | null>(null);
  const [catalogSize, setCatalogSize] = useState<number | null>(null);
  const [totalProducts, setTotalProducts] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 350);
    return () => clearTimeout(t);
  }, [query]);

  const load = useCallback(async () => {
    const [catRes, prodRes, metaRes] = await Promise.allSettled([
      api.pharmacy.categories(),
      api.pharmacy.products({ sort: 'best_price', limit: 30, q: debouncedQuery || undefined }),
      api.pharmacy.syncMeta(),
    ]);
    if (catRes.status === 'fulfilled') setCategories(catRes.value.categories);
    if (prodRes.status === 'fulfilled') {
      setProducts(prodRes.value.products);
      setTotalProducts(prodRes.value.pagination.total);
    }
    if (metaRes.status === 'fulfilled') {
      const pd = metaRes.value.sources.PHARMADEPOT?.finishedAt;
      setSyncLabel(pd ? formatRelative(pd) : null);
      if (metaRes.value.catalog) setCatalogSize(metaRes.value.catalog.products);
    }
  }, [debouncedQuery]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const openProduct = (id: string) => router.push(`/pharmacy/product/${id}` as never);

  return (
    <ScrollView
      className="flex-1 bg-bg-100"
      contentContainerClassName="px-4 pb-9 pt-3.5"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary200} />}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <PharmacyBrowseHeader
        query={query}
        onChangeQuery={setQuery}
        syncLabel={syncLabel}
        productCount={catalogSize ?? undefined}
      />

      {!debouncedQuery ? (
        <View className="mb-5">
          <View className="mb-2.5 flex-row items-center justify-between">
            <Text className="text-[15px] font-bold text-text-100">{ka.pharmacy.categories}</Text>
          </View>
          <CategoryGrid
            categories={categories}
            onSelect={(slug) => router.push(`/pharmacy/category/${slug}` as never)}
          />
        </View>
      ) : null}

      <View
        style={{
          marginBottom: pharmPx(10),
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingBottom: pharmPx(8),
          borderBottomWidth: 1,
          borderBottomColor: colors.bg300,
        }}
      >
        <View>
          <Text className="text-[17px] font-bold text-text-100">
            {debouncedQuery ? `"${debouncedQuery}"` : ka.pharmacy.allProducts}
          </Text>
          <Text className="mt-0.5 text-[12px] text-text-300">
            {totalProducts ? ka.pharmacy.resultsCount(totalProducts) : ka.pharmacy.browseHint}
          </Text>
        </View>
        {totalProducts > 0 ? (
          <View
            style={{
              borderRadius: pharmPx(8),
              paddingHorizontal: pharmPx(8),
              paddingVertical: pharmPx(4),
              backgroundColor: colors.bg200,
            }}
          >
            <Text style={{ fontSize: pharmPx(11), fontWeight: '700', color: colors.text200 }}>
              {totalProducts.toLocaleString('ka-GE')}
            </Text>
          </View>
        ) : null}
      </View>

      {products.length === 0 ? (
        <EmptyState icon={Layers3} title={ka.pharmacy.emptySearch} body={ka.pharmacy.emptySearchHint} />
      ) : (
        products.map((p) => <PharmacyProductCard key={p.id} product={p} onPress={() => openProduct(p.id)} />)
      )}

      <View className="mt-4 rounded-xl border border-bg-300 bg-surface px-3 py-3">
        <Text className="text-center text-[12px] leading-[17px] text-text-300">{ka.pharmacy.disclaimer}</Text>
      </View>
    </ScrollView>
  );
}
