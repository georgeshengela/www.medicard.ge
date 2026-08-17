import React from 'react';
import { Linking, Text, View } from 'react-native';
import { ExternalLink, Minus, TrendingDown } from 'lucide-react-native';
import { PharmacyBestPriceBadge } from '@/components/pharmacy/PharmacyBestPriceBadge';
import { PharmacySourceLogo } from '@/components/pharmacy/PharmacySourceLogo';
import { PharmacySourcePriceRow } from '@/components/pharmacy/PharmacySourcePriceRow';
import { Button } from '@/components/ui/Button';
import { pharmPx } from '@/constants/pharmacyVisuals';
import { ka } from '@/i18n/ka';
import type { PharmacySourcePrice } from '@/lib/api';
import { buildCompareSlots, compareStats, isBestSlot, sourceColor } from '@/lib/pharmacyCompare';
import { useThemeColors } from '@/theme/colors';

type Props = {
  prices: PharmacySourcePrice[];
  bestPrice: number | null;
};

export function PharmacyComparePanel({ prices, bestPrice }: Props) {
  const colors = useThemeColors();
  const slots = buildCompareSlots(prices);
  const { available, savingsGel } = compareStats(slots, bestPrice);

  if (!available.length) {
    return (
      <View
        style={{
          borderRadius: pharmPx(16),
          borderWidth: 1,
          borderStyle: 'dashed',
          borderColor: colors.bg300,
          backgroundColor: colors.bg200,
          paddingVertical: pharmPx(28),
          paddingHorizontal: pharmPx(16),
        }}
      >
        <Text className="text-center text-[15px] leading-[21px] text-text-300">{ka.pharmacy.noOffers}</Text>
      </View>
    );
  }

  return (
    <View style={{ gap: pharmPx(12) }}>
      {savingsGel != null && savingsGel > 0 ? (
        <View
          style={{
            borderRadius: pharmPx(14),
            borderWidth: 1,
            borderColor: `${colors.success}30`,
            backgroundColor: colors.successBg,
            paddingHorizontal: pharmPx(14),
            paddingVertical: pharmPx(12),
          }}
        >
          <View className="flex-row items-center gap-2">
            <TrendingDown size={pharmPx(16)} color={colors.success} strokeWidth={2.4} />
            <Text style={{ flex: 1, fontSize: pharmPx(14), fontWeight: '800', color: colors.success }}>
              {ka.pharmacy.saveUpTo(savingsGel.toFixed(2))}
            </Text>
          </View>
        </View>
      ) : null}

      <PharmacySourcePriceRow prices={prices} bestPrice={bestPrice} />

      <View style={{ gap: pharmPx(10) }}>
        {slots.map((slot) => {
          const accent = sourceColor(slot.sourceId);
          const hasPrice = slot.priceGel != null;
          const isBest = isBestSlot(slot, bestPrice);

          return (
            <View
              key={slot.sourceId}
              style={{
                borderRadius: pharmPx(16),
                borderWidth: isBest ? 2 : 1,
                borderColor: isBest ? accent : colors.bg300,
                backgroundColor: colors.surface,
                overflow: 'hidden',
              }}
            >
              <View style={{ paddingHorizontal: pharmPx(14), paddingVertical: pharmPx(14) }}>
                <View className="flex-row items-center">
                  <View
                    style={{
                      width: pharmPx(40),
                      height: pharmPx(40),
                      borderRadius: pharmPx(12),
                      borderWidth: 1,
                      borderColor: colors.bg300,
                      backgroundColor: colors.bg100,
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: pharmPx(12),
                    }}
                  >
                    <PharmacySourceLogo sourceId={slot.sourceId} logoUrl={slot.logoUrl} size={pharmPx(24)} showFallbackText={false} />
                  </View>

                  <View style={{ flex: 1, paddingRight: pharmPx(8) }}>
                    <View className="flex-row flex-wrap items-center gap-2">
                      <Text className="text-[15px] font-bold text-text-100">{slot.nameKa}</Text>
                      {isBest ? <PharmacyBestPriceBadge accent={accent} size="sm" /> : null}
                    </View>
                    <Text className="mt-0.5 text-[12px] text-text-300">
                      {hasPrice ? (slot.inStock ? ka.pharmacy.inStock : ka.pharmacy.outOfStock) : ka.pharmacy.noPrice}
                    </Text>
                  </View>

                  <View style={{ alignItems: 'flex-end', minWidth: pharmPx(80) }}>
                    {hasPrice ? (
                      <>
                        <Text style={{ fontSize: pharmPx(18), fontWeight: '800', color: isBest ? accent : colors.text100 }}>
                          {slot.priceGel!.toFixed(2)} ₾
                        </Text>
                        {!isBest && slot.priceDiffGel != null && slot.priceDiffGel > 0 ? (
                          <Text style={{ marginTop: pharmPx(2), fontSize: pharmPx(10), fontWeight: '700', color: colors.danger }}>
                            {ka.pharmacy.priceDiff(slot.priceDiffGel.toFixed(2))}
                          </Text>
                        ) : isBest ? (
                          <Text style={{ marginTop: pharmPx(2), fontSize: pharmPx(10), fontWeight: '700', color: colors.success }}>
                            {ka.pharmacy.lowest}
                          </Text>
                        ) : null}
                      </>
                    ) : (
                      <Minus size={pharmPx(16)} color={colors.text300} />
                    )}
                  </View>
                </View>

                {hasPrice && slot.sourceUrl ? (
                  <View style={{ marginTop: pharmPx(12) }}>
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
            </View>
          );
        })}
      </View>
    </View>
  );
}
