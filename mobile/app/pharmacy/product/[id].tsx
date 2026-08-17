import React, { useCallback, useState } from 'react';
import { Image, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Crown, Loader2, Sparkles } from 'lucide-react-native';
import { PriceCompareList } from '@/components/pharmacy/PriceCompareList';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/EmptyState';
import { ka } from '@/i18n/ka';
import { api, type CatalogProductDetail } from '@/lib/api';
import { useThemeColors } from '@/theme/colors';

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center justify-between border-b border-accent-100/20 py-2.5">
      <Text className="text-sm text-text-300">{label}</Text>
      <Text className="max-w-[62%] text-right text-sm font-semibold text-text-100">{value}</Text>
    </View>
  );
}

export default function PharmacyProductScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useThemeColors();
  const [product, setProduct] = useState<CatalogProductDetail | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    const res = await api.pharmacy.product(String(id));
    setProduct(res.product);
  }, [id]);

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

  if (!product) {
    return (
      <View className="flex-1 bg-bg-100 px-4 pt-4">
        <EmptyState icon={Loader2} title={ka.common.loading} body="" />
      </View>
    );
  }

  const maxPrice = product.offers?.length
    ? Math.max(...product.offers.map((o) => o.priceGel))
    : null;

  return (
    <ScrollView
      className="flex-1 bg-bg-100"
      contentContainerClassName="px-4 pb-8 pt-2"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary200} />}
      showsVerticalScrollIndicator={false}
    >
      <View className="overflow-hidden rounded-3xl">
        <LinearGradient colors={['#00897B', '#26A69A', '#80CBC4']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          <View className="items-center px-5 pb-5 pt-6">
            <View className="mb-4 h-44 w-44 items-center justify-center rounded-3xl bg-white shadow-lg">
              {product.imageUrl ? (
                <Image source={{ uri: product.imageUrl }} className="h-36 w-36" resizeMode="contain" />
              ) : (
                <Text className="text-6xl">💊</Text>
              )}
            </View>
            <Text className="text-center text-xl font-extrabold leading-7 text-white">{product.name}</Text>
            {product.category ? (
              <Text className="mt-2 text-sm text-white/80">{product.category.nameKa}</Text>
            ) : null}
          </View>
        </LinearGradient>
      </View>

      <View className="-mt-6 mx-2 rounded-3xl border border-accent-100/30 bg-bg-100 p-4 shadow-sm">
        <View className="flex-row flex-wrap items-center gap-2">
          {product.bestPriceGel != null ? (
            <Text className="text-3xl font-extrabold text-primary-200">{product.bestPriceGel.toFixed(2)} ₾</Text>
          ) : null}
          {product.savingsPercent ? (
            <Badge label={ka.pharmacy.savings(product.savingsPercent)} tone="success" />
          ) : null}
        </View>

        {product.bestSource ? (
          <View className="mt-2 flex-row items-center gap-1.5">
            <Crown size={14} color={colors.primary200} />
            <Text className="text-sm font-semibold text-primary-200">
              {ka.pharmacy.cheapestAt(product.bestSource.nameKa)}
            </Text>
          </View>
        ) : null}

        <Text className="mt-1 text-xs text-text-300">{ka.pharmacy.offersCount(product.offerCount)}</Text>

        {maxPrice != null && product.bestPriceGel != null && maxPrice > product.bestPriceGel ? (
          <View className="mt-3 rounded-2xl bg-emerald-500/10 px-3 py-2">
            <View className="flex-row items-center gap-1.5">
              <Sparkles size={14} color={colors.primary200} />
              <Text className="text-xs font-semibold text-primary-200">
                {ka.pharmacy.saveUpTo((maxPrice - product.bestPriceGel).toFixed(2))}
              </Text>
            </View>
          </View>
        ) : null}
      </View>

      {(product.manufacturer || product.country || product.form || product.strength || product.packSize) && (
        <View className="mt-5 rounded-3xl border border-accent-100/30 bg-bg-200/40 px-4">
          <Text className="py-3 text-base font-bold text-text-100">{ka.pharmacy.detailsTitle}</Text>
          {product.manufacturer ? <MetaRow label={ka.pharmacy.manufacturer} value={product.manufacturer} /> : null}
          {product.country ? <MetaRow label={ka.pharmacy.country} value={product.country} /> : null}
          {product.form ? <MetaRow label={ka.pharmacy.form} value={product.form} /> : null}
          {product.strength ? <MetaRow label={ka.pharmacy.strength} value={product.strength} /> : null}
          {product.packSize ? <MetaRow label={ka.pharmacy.pack} value={`#${product.packSize}`} /> : null}
        </View>
      )}

      <Text className="mb-3 mt-6 text-lg font-bold text-text-100">{ka.pharmacy.compareTitle}</Text>
      <PriceCompareList offers={product.offers ?? []} bestPrice={product.bestPriceGel} />

      <View className="mt-4 rounded-2xl border border-accent-100/30 bg-bg-200/40 px-4 py-3">
        <Text className="text-center text-xs leading-5 text-text-300">{ka.pharmacy.disclaimer}</Text>
      </View>
    </ScrollView>
  );
}
