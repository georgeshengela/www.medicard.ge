import React, { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Loader2, Tag } from 'lucide-react-native';
import { PharmacyComparePanel } from '@/components/pharmacy/PharmacyComparePanel';
import { PharmacyProductImage } from '@/components/pharmacy/PharmacyProductImage';
import { EmptyState } from '@/components/EmptyState';
import { ka } from '@/i18n/ka';
import { api, type CatalogProductDetail } from '@/lib/api';
import { useThemeColors } from '@/theme/colors';
import { pharmPx } from '@/constants/pharmacyVisuals';

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-start justify-between py-3">
      <Text className="mr-4 flex-1 text-[15px] text-text-300">{label}</Text>
      <Text className="max-w-[58%] text-right text-[15px] font-semibold leading-[21px] text-text-100">{value}</Text>
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
      contentContainerStyle={{ paddingHorizontal: pharmPx(16), paddingTop: pharmPx(8), paddingBottom: pharmPx(32) }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary200} />}
      showsVerticalScrollIndicator={false}
    >
      <View
        style={{
          borderRadius: pharmPx(18),
          borderWidth: 1,
          borderColor: colors.bg300,
          backgroundColor: colors.surface,
          alignItems: 'center',
          paddingHorizontal: pharmPx(16),
          paddingTop: pharmPx(20),
          paddingBottom: pharmPx(18),
        }}
      >
        <PharmacyProductImage uri={product.imageUrl} size={pharmPx(120)} rounded={pharmPx(18)} />
        <Text className="mt-4 text-center text-[22px] font-bold leading-[30px] text-text-100">{product.name}</Text>
        {product.category ? (
          <View
            style={{
              marginTop: pharmPx(10),
              flexDirection: 'row',
              alignItems: 'center',
              gap: pharmPx(5),
              borderRadius: pharmPx(8),
              paddingHorizontal: pharmPx(10),
              paddingVertical: pharmPx(5),
              backgroundColor: colors.bg200,
            }}
          >
            <Tag size={pharmPx(11)} color={colors.text300} strokeWidth={2.4} />
            <Text className="text-[12px] font-semibold text-text-300">{product.category.nameKa}</Text>
          </View>
        ) : null}
      </View>

      {product.bestPriceGel != null ? (
        <View
          style={{
            marginTop: pharmPx(12),
            borderRadius: pharmPx(16),
            borderWidth: 1,
            borderColor: colors.bg300,
            backgroundColor: colors.surface,
            paddingHorizontal: pharmPx(16),
            paddingVertical: pharmPx(14),
          }}
        >
          <Text className="text-[12px] font-bold uppercase tracking-[1px] text-text-300">{ka.pharmacy.bestOffer}</Text>
          <View className="mt-1.5 flex-row flex-wrap items-end gap-2">
            <Text className="text-[30px] font-extrabold text-primary-200">{product.bestPriceGel.toFixed(2)} ₾</Text>
            {product.savingsPercent ? (
              <View
                style={{
                  marginBottom: pharmPx(4),
                  borderRadius: pharmPx(6),
                  paddingHorizontal: pharmPx(7),
                  paddingVertical: pharmPx(3),
                  backgroundColor: `${colors.success}14`,
                }}
              >
                <Text style={{ fontSize: pharmPx(11), fontWeight: '800', color: colors.success }}>
                  {ka.pharmacy.savings(product.savingsPercent)}
                </Text>
              </View>
            ) : null}
          </View>
          {product.bestSource ? (
            <Text className="mt-1.5 text-[15px] font-semibold text-text-100">
              {ka.pharmacy.cheapestAt(product.bestSource.nameKa)}
            </Text>
          ) : null}
          <Text className="mt-0.5 text-[13px] text-text-300">{ka.pharmacy.offersCount(product.offerCount)}</Text>
        </View>
      ) : null}

      <View className="mt-6">
        <Text className="mb-3 text-[15px] font-bold text-text-100">{ka.pharmacy.compareTitle}</Text>
        <PharmacyComparePanel prices={product.sourcePrices ?? []} bestPrice={product.bestPriceGel} />
      </View>

      {metaRows.length ? (
        <View className="mt-6 overflow-hidden rounded-2xl border border-bg-300 bg-surface px-4">
          <Text className="border-b border-bg-300 py-3.5 text-[15px] font-bold text-text-100">{ka.pharmacy.detailsTitle}</Text>
          {metaRows.map((row, index) => (
            <View key={row.label} className={index < metaRows.length - 1 ? 'border-b border-bg-300' : ''}>
              <MetaRow label={row.label} value={row.value} />
            </View>
          ))}
        </View>
      ) : null}

      <View className="mt-5 rounded-xl border border-bg-300 bg-surface px-3 py-3">
        <Text className="text-center text-[12px] leading-[17px] text-text-300">{ka.pharmacy.disclaimer}</Text>
      </View>
    </ScrollView>
  );
}
