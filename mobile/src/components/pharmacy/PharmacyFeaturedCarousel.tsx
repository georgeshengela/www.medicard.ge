import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { TrendingDown } from 'lucide-react-native';
import { ka } from '@/i18n/ka';
import type { CatalogProductSummary } from '@/lib/api';

type Props = {
  products: CatalogProductSummary[];
  onSelect: (id: string) => void;
};

export function PharmacyFeaturedCarousel({ products, onSelect }: Props) {
  if (!products.length) return null;

  return (
    <View className="mb-6">
      <View className="mb-3 flex-row items-center justify-between">
        <View>
          <Text className="text-lg font-bold text-text-100">{ka.pharmacy.cheapestToday}</Text>
          <Text className="text-xs text-text-300">{ka.pharmacy.featuredHint}</Text>
        </View>
        <View className="rounded-full bg-primary-200/15 px-2.5 py-1">
          <TrendingDown size={16} color="#00897B" />
        </View>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingRight: 4 }}>
        {products.map((product) => (
          <Pressable
            key={product.id}
            onPress={() => onSelect(product.id)}
            className="w-44 overflow-hidden rounded-3xl active:opacity-90"
          >
            <LinearGradient colors={['#E0F2F1', '#FFFFFF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
              <View className="p-4">
                {product.savingsPercent ? (
                  <View className="mb-2 self-start rounded-full bg-emerald-500 px-2 py-0.5">
                    <Text className="text-[10px] font-bold text-white">
                      {ka.pharmacy.savings(product.savingsPercent)}
                    </Text>
                  </View>
                ) : null}
                <Text className="text-[13px] font-semibold leading-5 text-text-100" numberOfLines={3}>
                  {product.name}
                </Text>
                {product.bestPriceGel != null ? (
                  <Text className="mt-3 text-2xl font-extrabold text-primary-200">
                    {product.bestPriceGel.toFixed(2)} ₾
                  </Text>
                ) : null}
                {product.bestSource ? (
                  <Text className="mt-1 text-[11px] font-medium text-text-300" numberOfLines={1}>
                    {product.bestSource.nameKa}
                  </Text>
                ) : null}
              </View>
            </LinearGradient>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}
