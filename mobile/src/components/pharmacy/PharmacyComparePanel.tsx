import React from 'react';
import { Image, Linking, Text, View } from 'react-native';
import { Crown, ExternalLink, Minus } from 'lucide-react-native';
import { Button } from '@/components/ui/Button';
import { ka } from '@/i18n/ka';
import type { PharmacySourcePrice } from '@/lib/api';
import { PHARMACY_SOURCES } from '@/constants/pharmacyVisuals';
import { useThemeColors } from '@/theme/colors';

type Props = {
  prices: PharmacySourcePrice[];
  bestPrice: number | null;
};

function sourceColor(sourceId: string) {
  return PHARMACY_SOURCES.find((s) => s.id === sourceId)?.color ?? '#26A69A';
}

function buildSlots(prices: PharmacySourcePrice[]) {
  if (prices.length >= 3) return prices;
  return PHARMACY_SOURCES.map(
    (src) =>
      prices.find((p) => p.sourceId === src.id) ?? {
        sourceId: src.id,
        nameKa: src.label,
        logoUrl: null,
        priceGel: null,
        oldPriceGel: null,
        inStock: false,
        isBest: false,
        sourceUrl: null,
        priceDiffGel: null,
      },
  );
}

export function PharmacyComparePanel({ prices, bestPrice }: Props) {
  const colors = useThemeColors();
  const slots = buildSlots(prices);
  const available = slots.filter((s) => s.priceGel != null);
  const maxPrice = available.length ? Math.max(...available.map((s) => s.priceGel!)) : null;

  if (!available.length) {
    return (
      <View className="rounded-2xl border border-dashed border-bg-300 bg-bg-200/40 p-8">
        <Text className="text-center text-sm text-text-300">{ka.pharmacy.noOffers}</Text>
      </View>
    );
  }

  return (
    <View className="gap-4">
      {maxPrice != null && bestPrice != null && maxPrice > bestPrice ? (
        <View className="rounded-2xl border border-state-success/20 bg-state-successBg px-4 py-3">
          <Text className="text-sm font-semibold text-state-success">
            {ka.pharmacy.saveUpTo((maxPrice - bestPrice).toFixed(2))}
          </Text>
          <Text className="mt-1 text-xs text-text-300">{ka.pharmacy.compareHint}</Text>
        </View>
      ) : null}

      <View className="overflow-hidden rounded-2xl border border-bg-300 bg-surface">
        <View className="flex-row border-b border-bg-300 bg-bg-200/40 px-4 py-3">
          <Text className="flex-1 text-xs font-bold uppercase tracking-wide text-text-300">{ka.pharmacy.pharmacyCol}</Text>
          <Text className="w-24 text-right text-xs font-bold uppercase tracking-wide text-text-300">{ka.pharmacy.priceCol}</Text>
        </View>

        {slots.map((slot) => {
          const accent = sourceColor(slot.sourceId);
          const hasPrice = slot.priceGel != null;
          const isBest = slot.isBest || (bestPrice != null && slot.priceGel === bestPrice);

          return (
            <View
              key={slot.sourceId}
              className="border-b border-bg-300 px-4 py-4 last:border-b-0"
              style={{ backgroundColor: isBest ? `${accent}10` : 'transparent' }}
            >
              <View className="flex-row items-center">
                <View className="mr-3 h-11 w-11 items-center justify-center rounded-xl border border-bg-300 bg-white">
                  {slot.logoUrl ? (
                    <Image source={{ uri: slot.logoUrl }} style={{ width: 28, height: 28 }} resizeMode="contain" />
                  ) : (
                    <Text style={{ fontSize: 11, fontWeight: '800', color: accent }}>
                      {slot.nameKa.slice(0, 2).toUpperCase()}
                    </Text>
                  )}
                </View>

                <View className="flex-1">
                  <View className="flex-row items-center gap-2">
                    <Text className="text-base font-bold text-text-100">{slot.nameKa}</Text>
                    {isBest ? (
                      <View className="flex-row items-center gap-1 rounded-full px-2 py-0.5" style={{ backgroundColor: `${accent}20` }}>
                        <Crown size={11} color={accent} />
                        <Text style={{ fontSize: 10, fontWeight: '800', color: accent }}>{ka.pharmacy.bestShort}</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text className="mt-0.5 text-xs text-text-300">
                    {hasPrice ? (slot.inStock ? ka.pharmacy.inStock : ka.pharmacy.outOfStock) : ka.pharmacy.noPrice}
                  </Text>
                </View>

                <View className="w-24 items-end">
                  {hasPrice ? (
                    <>
                      <Text className="text-lg font-extrabold" style={{ color: isBest ? accent : colors.text100 }}>
                        {slot.priceGel!.toFixed(2)} ₾
                      </Text>
                      {!isBest && slot.priceDiffGel != null && slot.priceDiffGel > 0 ? (
                        <Text className="text-[11px] font-semibold text-state-danger">
                          +{slot.priceDiffGel.toFixed(2)} ₾
                        </Text>
                      ) : !isBest ? (
                        <Text className="text-[11px] text-text-300">—</Text>
                      ) : (
                        <Text className="text-[11px] font-semibold text-state-success">{ka.pharmacy.lowest}</Text>
                      )}
                    </>
                  ) : (
                    <Minus size={16} color={colors.text300} />
                  )}
                </View>
              </View>

              {hasPrice && slot.sourceUrl ? (
                <View className="mt-3">
                  <Button
                    label={ka.pharmacy.openInPharmacy}
                    variant={isBest ? 'primary' : 'secondary'}
                    size="sm"
                    onPress={() => Linking.openURL(slot.sourceUrl!)}
                    icon={ExternalLink}
                  />
                </View>
              ) : null}
            </View>
          );
        })}
      </View>
    </View>
  );
}
