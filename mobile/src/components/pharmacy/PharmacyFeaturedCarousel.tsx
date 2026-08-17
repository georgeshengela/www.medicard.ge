import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { PharmacyProductImage } from '@/components/pharmacy/PharmacyProductImage';
import { PharmacySourcePriceRow } from '@/components/pharmacy/PharmacySourcePriceRow';
import { ka } from '@/i18n/ka';
import type { CatalogProductSummary } from '@/lib/api';
import { useThemeColors } from '@/theme/colors';

type Props = {
  products: CatalogProductSummary[];
  onSelect: (id: string) => void;
};

export function PharmacyFeaturedCarousel({ products, onSelect }: Props) {
  const colors = useThemeColors();
  if (!products.length) return null;

  return (
    <View className="mb-6">
      <Text className="mb-3 text-[11px] font-bold uppercase tracking-[1.2px] text-text-300">
        {ka.pharmacy.cheapestToday}
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingRight: 4 }}>
        {products.map((product) => (
          <Pressable
            key={product.id}
            onPress={() => onSelect(product.id)}
            className="active:opacity-90"
            style={{
              width: 260,
              borderRadius: 20,
              borderWidth: 1,
              borderColor: colors.bg300,
              backgroundColor: colors.surface,
              padding: 14,
            }}
          >
            <View className="flex-row items-start">
              <PharmacyProductImage uri={product.imageUrl} size={72} rounded={16} />
              <View className="ml-3 flex-1">
                <Text className="text-sm font-bold leading-5 text-text-100" numberOfLines={2}>
                  {product.name}
                </Text>
                {product.bestPriceGel != null ? (
                  <Text className="mt-2 text-xl font-extrabold text-primary-200">
                    {product.bestPriceGel.toFixed(2)} ₾
                  </Text>
                ) : null}
              </View>
            </View>
            <View className="mt-3">
              <PharmacySourcePriceRow prices={product.sourcePrices ?? []} compact />
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}
