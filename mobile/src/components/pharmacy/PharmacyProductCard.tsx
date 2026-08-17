import React from 'react';
import { Text, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { Card } from '@/components/ui/Card';
import { PharmacyProductImage } from '@/components/pharmacy/PharmacyProductImage';
import { PharmacySourcePriceRow } from '@/components/pharmacy/PharmacySourcePriceRow';
import { pharmPx } from '@/constants/pharmacyVisuals';
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
  const offerCount = (product.sourcePrices ?? []).filter((s) => s.priceGel != null).length;

  return (
    <Card onPress={onPress} padded={false} className="mb-2.5 overflow-hidden">
      <View style={{ paddingHorizontal: pharmPx(12), paddingTop: pharmPx(12), paddingBottom: pharmPx(10) }}>
        <View className="flex-row items-start">
          <PharmacyProductImage uri={product.imageUrl} size={pharmPx(64)} rounded={pharmPx(14)} />
          <View className="ml-3 flex-1">
            <Text className="text-[15px] font-bold leading-[19px] text-text-100" numberOfLines={2}>
              {product.name}
            </Text>
            {meta ? (
              <Text className="mt-0.5 text-[12px] text-text-300" numberOfLines={1}>
                {meta}
              </Text>
            ) : null}
            <View className="mt-1.5 flex-row flex-wrap items-center gap-2">
              {product.bestPriceGel != null ? (
                <Text className="text-lg font-extrabold text-primary-200">{product.bestPriceGel.toFixed(2)} ₾</Text>
              ) : null}
              {savings != null && savings > 0 ? (
                <View
                  style={{
                    borderRadius: pharmPx(6),
                    paddingHorizontal: pharmPx(6),
                    paddingVertical: pharmPx(2),
                    backgroundColor: `${colors.success}14`,
                  }}
                >
                  <Text style={{ fontSize: pharmPx(10), fontWeight: '800', color: colors.success }}>
                    {ka.pharmacy.savings(savings)}
                  </Text>
                </View>
              ) : null}
              {offerCount > 0 ? (
                <Text className="text-[11px] font-medium text-text-300">{ka.pharmacy.offersCount(offerCount)}</Text>
              ) : null}
            </View>
          </View>
          <ChevronRight size={pharmPx(16)} color={colors.text300} style={{ marginTop: pharmPx(22) }} />
        </View>

        <View style={{ marginTop: pharmPx(10) }}>
          <PharmacySourcePriceRow prices={product.sourcePrices ?? []} bestPrice={product.bestPriceGel} />
        </View>
      </View>
    </Card>
  );
}
