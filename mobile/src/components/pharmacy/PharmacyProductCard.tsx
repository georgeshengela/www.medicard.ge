import React from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronRight, Sparkles } from 'lucide-react-native';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { ka } from '@/i18n/ka';
import type { CatalogProductSummary } from '@/lib/api';
import { useThemeColors } from '@/theme/colors';

type Props = {
  product: CatalogProductSummary;
  onPress: () => void;
  variant?: 'list' | 'compact';
};

export function PharmacyProductCard({ product, onPress, variant = 'list' }: Props) {
  const colors = useThemeColors();
  const savings = product.savingsPercent;

  if (variant === 'compact') {
    return (
      <Pressable onPress={onPress} className="mb-2 flex-row items-center rounded-2xl border border-accent-100/30 bg-bg-200/50 p-3 active:opacity-90">
        <View className="mr-3 h-14 w-14 items-center justify-center rounded-xl bg-white">
          {product.imageUrl ? (
            <Image source={{ uri: product.imageUrl }} className="h-12 w-12" resizeMode="contain" />
          ) : (
            <Text className="text-xl">💊</Text>
          )}
        </View>
        <View className="flex-1">
          <Text className="text-sm font-semibold text-text-100" numberOfLines={2}>
            {product.name}
          </Text>
          {product.bestPriceGel != null ? (
            <Text className="mt-1 text-base font-bold text-primary-200">{product.bestPriceGel.toFixed(2)} ₾</Text>
          ) : null}
        </View>
        <ChevronRight size={16} color={colors.text300} />
      </Pressable>
    );
  }

  return (
    <Card onPress={onPress} className="mb-3 overflow-hidden p-0">
      <LinearGradient colors={['rgba(38,166,154,0.08)', 'rgba(255,255,255,0)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <View className="flex-row p-3.5">
          <View className="mr-3.5 h-[84px] w-[84px] items-center justify-center rounded-2xl border border-white bg-white shadow-sm">
            {product.imageUrl ? (
              <Image source={{ uri: product.imageUrl }} className="h-[68px] w-[68px]" resizeMode="contain" />
            ) : (
              <Text className="text-3xl">💊</Text>
            )}
          </View>
          <View className="flex-1">
            <Text className="text-[15px] font-bold leading-5 text-text-100" numberOfLines={2}>
              {product.name}
            </Text>
            {product.country ? (
              <Text className="mt-1 text-xs text-text-300" numberOfLines={1}>
                {product.country}
              </Text>
            ) : null}
            <View className="mt-2.5 flex-row flex-wrap items-center gap-2">
              {product.bestPriceGel != null ? (
                <Text className="text-[22px] font-extrabold text-primary-200">{product.bestPriceGel.toFixed(2)} ₾</Text>
              ) : null}
              {savings != null && savings > 0 ? (
                <Badge label={ka.pharmacy.savings(savings)} tone="success" />
              ) : null}
            </View>
            {product.bestSource ? (
              <View className="mt-2 flex-row items-center gap-1.5">
                <Sparkles size={12} color={colors.primary200} />
                <Text className="text-xs font-semibold text-primary-200" numberOfLines={1}>
                  {ka.pharmacy.cheapestAt(product.bestSource.nameKa)}
                </Text>
              </View>
            ) : null}
            {product.offerCount > 1 ? (
              <Text className="mt-1 text-[11px] text-text-300">{ka.pharmacy.offersCount(product.offerCount)}</Text>
            ) : null}
          </View>
          <ChevronRight size={18} color={colors.text300} style={{ alignSelf: 'center' }} />
        </View>
      </LinearGradient>
    </Card>
  );
}
