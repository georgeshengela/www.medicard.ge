import React from 'react';
import { Text, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { PharmacyProductImage } from '@/components/pharmacy/PharmacyProductImage';
import { PharmacySourcePriceRow } from '@/components/pharmacy/PharmacySourcePriceRow';
import { ka } from '@/i18n/ka';
import type { CatalogProductSummary } from '@/lib/api';
import { useThemeColors } from '@/theme/colors';

type Props = {
  product: CatalogProductSummary;
  onPress: () => void;
};

export function PharmacyProductCard({ product, onPress }: Props) {
  const colors = useThemeColors();
  const savings = product.savingsPercent;
  const meta = [product.strength, product.packSize ? `#${product.packSize}` : null, product.country]
    .filter(Boolean)
    .join(' · ');

  return (
    <Card onPress={onPress} padded={false} className="mb-3 overflow-hidden">
      <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, backgroundColor: colors.primary200 }} />
      <View className="px-4 py-3.5">
        <View className="flex-row">
          <PharmacyProductImage uri={product.imageUrl} size={92} rounded={18} />
          <View className="ml-3.5 flex-1">
            <Text className="text-[15px] font-bold leading-5 text-text-100" numberOfLines={2}>
              {product.name}
            </Text>
            {meta ? (
              <Text className="mt-1 text-xs text-text-300" numberOfLines={1}>
                {meta}
              </Text>
            ) : null}
            <View className="mt-2 flex-row flex-wrap items-center gap-2">
              {product.bestPriceGel != null ? (
                <Text className="text-xl font-extrabold text-primary-200">{product.bestPriceGel.toFixed(2)} ₾</Text>
              ) : null}
              {savings != null && savings > 0 ? (
                <Badge label={ka.pharmacy.savings(savings)} tone="success" />
              ) : null}
            </View>
          </View>
          <ChevronRight size={18} color={colors.text300} style={{ alignSelf: 'center' }} />
        </View>

        <View className="mt-3.5">
          <PharmacySourcePriceRow prices={product.sourcePrices ?? []} compact />
        </View>
      </View>
    </Card>
  );
}
