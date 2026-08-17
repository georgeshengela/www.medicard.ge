import React, { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Loader2 } from 'lucide-react-native';
import { PriceCompareList } from '@/components/pharmacy/PriceCompareList';
import { PharmacyProductImage } from '@/components/pharmacy/PharmacyProductImage';
import { PharmacySourcePriceRow } from '@/components/pharmacy/PharmacySourcePriceRow';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/EmptyState';
import { ka } from '@/i18n/ka';
import { api, type CatalogProductDetail } from '@/lib/api';
import { useThemeColors } from '@/theme/colors';

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center justify-between border-b border-bg-300 py-2.5">
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
      contentContainerClassName="px-4 pb-8 pt-3"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary200} />}
      showsVerticalScrollIndicator={false}
    >
      <View className="rounded-2xl border border-bg-300 bg-surface p-4">
        <View className="flex-row">
          <PharmacyProductImage uri={product.imageUrl} size={112} rounded={20} />
          <View className="ml-4 flex-1">
            <Text className="text-lg font-bold leading-6 text-text-100">{product.name}</Text>
            {product.category ? (
              <Text className="mt-1 text-xs font-semibold text-primary-200">{product.category.nameKa}</Text>
            ) : null}
            <View className="mt-2 flex-row flex-wrap items-center gap-2">
              {product.bestPriceGel != null ? (
                <Text className="text-2xl font-extrabold text-primary-200">{product.bestPriceGel.toFixed(2)} ₾</Text>
              ) : null}
              {product.savingsPercent ? (
                <Badge label={ka.pharmacy.savings(product.savingsPercent)} tone="success" />
              ) : null}
            </View>
            {product.bestSource ? (
              <Text className="mt-1 text-xs font-semibold text-text-300">
                {ka.pharmacy.cheapestAt(product.bestSource.nameKa)}
              </Text>
            ) : null}
          </View>
        </View>

        {maxPrice != null && product.bestPriceGel != null && maxPrice > product.bestPriceGel ? (
          <View className="mt-4 rounded-xl bg-state-successBg px-3 py-2">
            <Text className="text-xs font-semibold text-state-success">
              {ka.pharmacy.saveUpTo((maxPrice - product.bestPriceGel).toFixed(2))}
            </Text>
          </View>
        ) : null}
      </View>

      <Text className="mb-2 mt-5 text-[11px] font-bold uppercase tracking-[1.2px] text-text-300">
        {ka.pharmacy.compareTitle}
      </Text>
      <PharmacySourcePriceRow prices={product.sourcePrices ?? []} />

      <View className="mt-4">
        <PriceCompareList
          offers={product.offers ?? []}
          sourcePrices={product.sourcePrices}
          bestPrice={product.bestPriceGel}
        />
      </View>

      {(product.manufacturer || product.country || product.form || product.strength || product.packSize) && (
        <View className="mt-5 rounded-2xl border border-bg-300 bg-surface px-4">
          <Text className="py-3 text-base font-bold text-text-100">{ka.pharmacy.detailsTitle}</Text>
          {product.manufacturer ? <MetaRow label={ka.pharmacy.manufacturer} value={product.manufacturer} /> : null}
          {product.country ? <MetaRow label={ka.pharmacy.country} value={product.country} /> : null}
          {product.form ? <MetaRow label={ka.pharmacy.form} value={product.form} /> : null}
          {product.strength ? <MetaRow label={ka.pharmacy.strength} value={product.strength} /> : null}
          {product.packSize ? <MetaRow label={ka.pharmacy.pack} value={`#${product.packSize}`} /> : null}
        </View>
      )}

      <View className="mt-4 rounded-2xl border border-bg-300 bg-surface px-4 py-3">
        <Text className="text-center text-xs leading-5 text-text-300">{ka.pharmacy.disclaimer}</Text>
      </View>
    </ScrollView>
  );
}
