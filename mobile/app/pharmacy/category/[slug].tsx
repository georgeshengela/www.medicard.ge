import React, { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Search } from 'lucide-react-native';
import { PharmacyProductCard } from '@/components/pharmacy/PharmacyProductCard';
import { EmptyState } from '@/components/EmptyState';
import { ka } from '@/i18n/ka';
import { api, type CatalogProductSummary } from '@/lib/api';
import { useThemeColors } from '@/theme/colors';

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
      contentContainerClassName="px-4 pb-8 pt-2"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary200} />}
      showsVerticalScrollIndicator={false}
    >
      <View className="mb-4 overflow-hidden rounded-2xl">
        <LinearGradient colors={['#00897B', '#26A69A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
          <View className="px-4 py-4">
            <Text className="text-lg font-bold text-white">{categoryName || slug}</Text>
            <Text className="mt-1 text-sm text-white/80">{ka.pharmacy.categoryBrowse}</Text>
          </View>
        </LinearGradient>
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

      {products.length ? (
        <Text className="py-6 text-center text-xs text-text-300">{ka.pharmacy.resultsCount(products.length)}</Text>
      ) : null}
    </ScrollView>
  );
}
