import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Layers3 } from 'lucide-react-native';
import { CategoryGrid } from '@/components/pharmacy/CategoryGrid';
import { PharmacyFeaturedCarousel } from '@/components/pharmacy/PharmacyFeaturedCarousel';
import { PharmacyHero } from '@/components/pharmacy/PharmacyHero';
import { PharmacyProductCard } from '@/components/pharmacy/PharmacyProductCard';
import { EmptyState } from '@/components/EmptyState';
import { ka } from '@/i18n/ka';
import { api, type CatalogProductSummary, type DrugCategoryInfo } from '@/lib/api';
import { formatRelative } from '@/lib/format';
import { useThemeColors } from '@/theme/colors';

export default function PharmacyIndexScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const [categories, setCategories] = useState<DrugCategoryInfo[]>([]);
  const [products, setProducts] = useState<CatalogProductSummary[]>([]);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [syncLabel, setSyncLabel] = useState<string | null>(null);
  const [catalogStats, setCatalogStats] = useState<{ products: number; comparedProducts: number } | null>(null);
  const [totalProducts, setTotalProducts] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 350);
    return () => clearTimeout(t);
  }, [query]);

  const load = useCallback(async () => {
    const [catRes, prodRes, metaRes] = await Promise.allSettled([
      api.pharmacy.categories(),
      api.pharmacy.products({ sort: 'best_price', limit: 24, q: debouncedQuery || undefined }),
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
      if (metaRes.value.catalog) {
        setCatalogStats({
          products: metaRes.value.catalog.products,
          comparedProducts: metaRes.value.catalog.comparedProducts,
        });
      }
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

  const featured = useMemo(
    () =>
      [...products]
        .filter((p) => p.savingsPercent && p.savingsPercent > 0)
        .sort((a, b) => (b.savingsPercent ?? 0) - (a.savingsPercent ?? 0))
        .slice(0, 10),
    [products],
  );

  const openProduct = (id: string) => router.push(`/pharmacy/product/${id}` as never);

  return (
    <ScrollView
      className="flex-1 bg-bg-100"
      contentContainerClassName="px-4 pb-8 pt-2"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary200} />}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <PharmacyHero
        query={query}
        onChangeQuery={setQuery}
        syncLabel={syncLabel}
        productCount={catalogStats?.products}
        comparedCount={catalogStats?.comparedProducts}
      />

      {!debouncedQuery ? (
        <>
          <PharmacyFeaturedCarousel products={featured} onSelect={openProduct} />

          <View className="mb-3 flex-row items-center justify-between">
            <Text className="text-lg font-bold text-text-100">{ka.pharmacy.categories}</Text>
            <Text className="text-xs font-medium text-text-300">{categories.length ? `${categories.length}+` : ''}</Text>
          </View>
          <CategoryGrid
            categories={categories}
            onSelect={(slug) => router.push(`/pharmacy/category/${slug}` as never)}
          />
        </>
      ) : null}

      <View className="mb-3 mt-6 flex-row items-end justify-between">
        <View>
          <Text className="text-lg font-bold text-text-100">
            {debouncedQuery ? `"${debouncedQuery}"` : ka.pharmacy.allProducts}
          </Text>
          <Text className="mt-0.5 text-xs text-text-300">
            {totalProducts ? ka.pharmacy.resultsCount(totalProducts) : ka.pharmacy.browseHint}
          </Text>
        </View>
        <View className="rounded-full bg-primary-200/10 p-2">
          <Layers3 size={16} color={colors.primary200} />
        </View>
      </View>

      {products.length === 0 ? (
        <EmptyState icon={Layers3} title={ka.pharmacy.emptySearch} body={ka.pharmacy.emptySearchHint} />
      ) : (
        products.map((p) => <PharmacyProductCard key={p.id} product={p} onPress={() => openProduct(p.id)} />)
      )}

      <View className="mt-4 rounded-2xl border border-accent-100/30 bg-bg-200/40 px-4 py-3">
        <Text className="text-center text-xs leading-5 text-text-300">{ka.pharmacy.disclaimer}</Text>
      </View>
    </ScrollView>
  );
}
