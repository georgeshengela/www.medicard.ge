import React, { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Search } from 'lucide-react-native';
import { PharmacyProductCard } from '@/components/pharmacy/PharmacyProductCard';
import { EmptyState } from '@/components/EmptyState';
import { ka } from '@/i18n/ka';
import { api, type CatalogProductSummary } from '@/lib/api';
import { useThemeColors } from '@/theme/colors';
import { pharmPx } from '@/constants/pharmacyVisuals';

export default function PharmacyCategoryScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const colors = useThemeColors();
  const [products, setProducts] = useState<CatalogProductSummary[]>([]);
  const [categoryName, setCategoryName] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!slug) return;
    const [catRes, prodRes] = await Promise.all([
      api.pharmacy.categories(),
      api.pharmacy.products({ category: slug, sort: 'best_price', limit: 100 }),
    ]);
    const flat = catRes.categories.flatMap((c) => (c.children?.length ? c.children : [c]));
    setCategoryName(flat.find((c) => c.slug === slug)?.nameKa ?? String(slug));
    setProducts(prodRes.products);
  }, [slug]);

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

  return (
    <ScrollView
      className="flex-1 bg-bg-100"
      contentContainerClassName="px-4 pb-9 pt-3.5"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary200} />}
      showsVerticalScrollIndicator={false}
    >
      <View
        style={{
          marginBottom: pharmPx(14),
          paddingBottom: pharmPx(12),
          borderBottomWidth: 1,
          borderBottomColor: colors.bg300,
        }}
      >
        <Text className="text-[12px] font-bold uppercase tracking-[1px] text-primary-200">{ka.pharmacy.categories}</Text>
        <Text className="mt-1 text-[22px] font-bold text-text-100">{categoryName || slug}</Text>
        <Text className="mt-1 text-[13px] text-text-300">{ka.pharmacy.categoryBrowse}</Text>
        {products.length ? (
          <Text className="mt-2 text-[12px] font-semibold text-text-300">{ka.pharmacy.resultsCount(products.length)}</Text>
        ) : null}
      </View>

      {products.length === 0 ? (
        <EmptyState icon={Search} title={ka.pharmacy.emptySearch} body={ka.pharmacy.emptySearchHint} />
      ) : (
        products.map((p) => (
          <PharmacyProductCard
            key={p.id}
            product={p}
            onPress={() => router.push(`/pharmacy/product/${p.id}` as never)}
          />
        ))
      )}
    </ScrollView>
  );
}
