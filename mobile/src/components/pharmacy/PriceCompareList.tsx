import React from 'react';
import { Linking, Text, View } from 'react-native';
import { ExternalLink } from 'lucide-react-native';
import { Button } from '@/components/ui/Button';
import { PharmacySourcePriceRow } from '@/components/pharmacy/PharmacySourcePriceRow';
import { ka } from '@/i18n/ka';
import type { PharmacyOfferInfo, PharmacySourcePrice } from '@/lib/api';
import { PHARMACY_SOURCES } from '@/constants/pharmacyVisuals';
import { useThemeColors } from '@/theme/colors';

type Props = {
  offers: PharmacyOfferInfo[];
  sourcePrices?: PharmacySourcePrice[];
  bestPrice: number | null;
};

function sourceColor(sourceId: string) {
  return PHARMACY_SOURCES.find((s) => s.id === sourceId)?.color ?? '#14B8A6';
}

export function PriceCompareList({ offers, sourcePrices, bestPrice }: Props) {
  const colors = useThemeColors();

  const rows: PharmacySourcePrice[] =
    sourcePrices ??
    PHARMACY_SOURCES.map((src) => {
      const offer = offers.find((o) => o.source?.id === src.id);
      return {
        sourceId: src.id,
        nameKa: src.label,
        logoUrl: offer?.source?.logoUrl ?? null,
        priceGel: offer?.priceGel ?? null,
        oldPriceGel: offer?.oldPriceGel ?? null,
        inStock: offer?.inStock ?? false,
        isBest: bestPrice != null && offer?.priceGel === bestPrice,
        sourceUrl: offer?.sourceUrl ?? null,
      };
    });

  const available = rows.filter((r) => r.priceGel != null);

  if (!available.length) {
    return (
      <View className="rounded-2xl border border-dashed border-bg-300 bg-bg-200/40 p-6">
        <Text className="text-center text-sm text-text-300">{ka.pharmacy.noOffers}</Text>
      </View>
    );
  }

  return (
    <View className="gap-3">
      <PharmacySourcePriceRow prices={rows} bestPrice={bestPrice} />

      {rows.map((slot) => {
        if (slot.priceGel == null || !slot.sourceUrl) return null;
        const accent = sourceColor(slot.sourceId);
        const offer = offers.find((o) => o.source?.id === slot.sourceId);

        return (
          <View
            key={slot.sourceId}
            className="rounded-2xl border bg-surface p-4"
            style={{ borderColor: slot.isBest ? accent : colors.bg300, borderWidth: slot.isBest ? 2 : 1 }}
          >
            <View className="flex-row items-center justify-between">
              <View className="flex-1">
                <Text className="text-base font-bold text-text-100">{slot.nameKa}</Text>
                <Text className="mt-0.5 text-xs text-text-300">
                  {slot.isBest ? ka.pharmacy.bestPrice : offer?.inStock ? ka.pharmacy.inStock : ka.pharmacy.outOfStock}
                </Text>
              </View>
              <View className="items-end">
                <Text className="text-2xl font-extrabold" style={{ color: slot.isBest ? accent : colors.text100 }}>
                  {slot.priceGel.toFixed(2)} ₾
                </Text>
                {slot.oldPriceGel && slot.oldPriceGel > slot.priceGel ? (
                  <Text className="text-sm text-text-300 line-through">{slot.oldPriceGel.toFixed(2)} ₾</Text>
                ) : null}
              </View>
            </View>
            <View className="mt-3">
              <Button
                label={ka.pharmacy.openInPharmacy}
                variant={slot.isBest ? 'primary' : 'secondary'}
                onPress={() => Linking.openURL(slot.sourceUrl!)}
                icon={ExternalLink}
              />
            </View>
          </View>
        );
      })}
    </View>
  );
}
