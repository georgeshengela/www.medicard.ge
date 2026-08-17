import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { PharmacyProductImage } from '@/components/pharmacy/PharmacyProductImage';
import { PharmacySectionHeader } from '@/components/pharmacy/PharmacySectionHeader';
import { PharmacySourcePriceRow } from '@/components/pharmacy/PharmacySourcePriceRow';
import { pharmPx } from '@/constants/pharmacyVisuals';
import { ka } from '@/i18n/ka';
import type { CatalogProductSummary } from '@/lib/api';
import { useIsDark, useThemeColors } from '@/theme/colors';

type Props = {
  products: CatalogProductSummary[];
  onSelect: (id: string) => void;
};

export function PharmacyFeaturedCarousel({ products, onSelect }: Props) {
  const colors = useThemeColors();
  const dark = useIsDark();
  if (!products.length) return null;

  return (
    <View className="mb-7 mt-6">
      <PharmacySectionHeader title={ka.pharmacy.cheapestToday} subtitle={ka.pharmacy.featuredHint} />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: pharmPx(14), paddingRight: pharmPx(6) }}
      >
        {products.map((product) => {
          const savings = product.savingsPercent;
          return (
            <Pressable key={product.id} onPress={() => onSelect(product.id)} className="active:opacity-92">
              <View
                style={{
                  width: pharmPx(272),
                  borderRadius: pharmPx(24),
                  borderWidth: 1,
                  borderColor: colors.bg300,
                  backgroundColor: colors.surface,
                  overflow: 'hidden',
                }}
              >
                <LinearGradient
                  colors={dark ? ['#123a37', '#16776d33'] : ['#d2edea', '#f0faf8']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{ padding: pharmPx(16) }}
                >
                  <View className="flex-row items-start">
                    <PharmacyProductImage uri={product.imageUrl} size={pharmPx(76)} rounded={pharmPx(18)} />
                    <View className="ml-3 flex-1">
                      <Text className="text-[15px] font-bold leading-[21px] text-text-100" numberOfLines={2}>
                        {product.name}
                      </Text>
                      {product.bestPriceGel != null ? (
                        <View className="mt-2 flex-row items-end gap-2">
                          <Text className="text-[26px] font-extrabold text-primary-200">
                            {product.bestPriceGel.toFixed(2)} ₾
                          </Text>
                          {savings != null && savings > 0 ? (
                            <Text
                              style={{
                                fontSize: pharmPx(11),
                                fontWeight: '800',
                                color: colors.success,
                                marginBottom: pharmPx(3),
                              }}
                            >
                              {ka.pharmacy.savings(savings)}
                            </Text>
                          ) : null}
                        </View>
                      ) : null}
                    </View>
                  </View>
                </LinearGradient>

                <View style={{ paddingHorizontal: pharmPx(14), paddingBottom: pharmPx(14), paddingTop: pharmPx(4) }}>
                  <PharmacySourcePriceRow prices={product.sourcePrices ?? []} bestPrice={product.bestPriceGel} />
                </View>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
