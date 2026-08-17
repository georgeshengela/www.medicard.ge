import React, { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Loader2 } from 'lucide-react-native';
import { PharmacyComparePanel } from '@/components/pharmacy/PharmacyComparePanel';
import { PharmacyProductImage } from '@/components/pharmacy/PharmacyProductImage';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/EmptyState';
import { ka } from '@/i18n/ka';
import { api, type CatalogProductDetail } from '@/lib/api';
import { useThemeColors } from '@/theme/colors';

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-start justify-between py-3">
      <Text className="mr-4 flex-1 text-sm text-text-300">{label}</Text>
      <Text className="max-w-[58%] text-right text-sm font-semibold leading-5 text-text-100">{value}</Text>
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

  const metaRows = [
    product.manufacturer ? { label: ka.pharmacy.manufacturer, value: product.manufacturer } : null,
    product.country ? { label: ka.pharmacy.country, value: product.country } : null,
    product.form ? { label: ka.pharmacy.form, value: product.form } : null,
    product.strength ? { label: ka.pharmacy.strength, value: product.strength } : null,
    product.packSize ? { label: ka.pharmacy.pack, value: `#${product.packSize}` } : null,
  ].filter(Boolean) as { label: string; value: string }[];

  return (
    <ScrollView
      className="flex-1 bg-bg-100"
      contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 32 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary200} />}
      showsVerticalScrollIndicator={false}
    >
      <View className="items-center rounded-2xl border border-bg-300 bg-surface px-4 py-6">
        <PharmacyProductImage uri={product.imageUrl} size={140} rounded={24} />
        <Text className="mt-5 text-center text-xl font-bold leading-7 text-text-100">{product.name}</Text>
        {product.category ? (
          <Text className="mt-2 text-sm font-medium text-primary-200">{product.category.nameKa}</Text>
        ) : null}
      </View>

      <View className="mt-4 rounded-2xl border border-bg-300 bg-surface px-4 py-4">
        <Text className="text-[11px] font-bold uppercase tracking-[1.2px] text-text-300">
          {ka.pharmacy.bestOffer}
        </Text>
        <View className="mt-3 flex-row flex-wrap items-end gap-3">
          {product.bestPriceGel != null ? (
            <Text className="text-[32px] font-extrabold leading-none text-primary-200">
              {product.bestPriceGel.toFixed(2)} ₾
            </Text>
          ) : null}
          {product.savingsPercent ? (
            <Badge label={ka.pharmacy.savings(product.savingsPercent)} tone="success" />
          ) : null}
        </View>
        {product.bestSource ? (
          <Text className="mt-2 text-sm font-semibold text-text-100">
            {ka.pharmacy.cheapestAt(product.bestSource.nameKa)}
          </Text>
        ) : null}
        <Text className="mt-1 text-xs text-text-300">{ka.pharmacy.offersCount(product.offerCount)}</Text>
      </View>

      <Text className="mb-3 mt-6 text-[11px] font-bold uppercase tracking-[1.2px] text-text-300">
        {ka.pharmacy.compareTitle}
      </Text>
      <PharmacyComparePanel prices={product.sourcePrices ?? []} bestPrice={product.bestPriceGel} />

      {metaRows.length ? (
        <View className="mt-6 overflow-hidden rounded-2xl border border-bg-300 bg-surface px-4">
          <Text className="border-b border-bg-300 py-4 text-base font-bold text-text-100">
            {ka.pharmacy.detailsTitle}
          </Text>
          {metaRows.map((row, index) => (
            <View key={row.label} className={index < metaRows.length - 1 ? 'border-b border-bg-300' : ''}>
              <MetaRow label={row.label} value={row.value} />
            </View>
          ))}
        </View>
      ) : null}

      <View className="mt-6 rounded-2xl border border-bg-300 bg-surface px-4 py-4">
        <Text className="text-center text-xs leading-5 text-text-300">{ka.pharmacy.disclaimer}</Text>
      </View>
    </ScrollView>
  );
}
