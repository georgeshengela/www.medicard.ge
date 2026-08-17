import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { PharmacySourceLogo } from '@/components/pharmacy/PharmacySourceLogo';
import { pharmPx } from '@/constants/pharmacyVisuals';
import { ka } from '@/i18n/ka';
import type { PharmacySourcePrice } from '@/lib/api';
import { buildCompareSlots, isBestSlot, sourceColor } from '@/lib/pharmacyCompare';
import { useThemeColors } from '@/theme/colors';

type Props = {
  prices: PharmacySourcePrice[];
  bestPrice?: number | null;
  onPressSource?: (price: PharmacySourcePrice) => void;
};

export function PharmacySourcePriceRow({ prices, bestPrice = null, onPressSource }: Props) {
  const colors = useThemeColors();
  const slots = buildCompareSlots(prices);

  return (
    <View
      style={{
        flexDirection: 'row',
        borderRadius: pharmPx(12),
        borderWidth: 1,
        borderColor: colors.bg300,
        overflow: 'hidden',
      }}
    >
      {slots.map((slot, index) => {
        const accent = sourceColor(slot.sourceId);
        const hasPrice = slot.priceGel != null;
        const isBest = isBestSlot(slot, bestPrice);

        const cell = (
          <View
            style={{
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              paddingVertical: pharmPx(8),
              paddingHorizontal: pharmPx(4),
              backgroundColor: isBest ? `${accent}10` : colors.surface,
              borderLeftWidth: index > 0 ? 1 : 0,
              borderLeftColor: colors.bg300,
              borderTopWidth: isBest ? 2 : 0,
              borderTopColor: isBest ? accent : 'transparent',
            }}
          >
            <PharmacySourceLogo sourceId={slot.sourceId} logoUrl={slot.logoUrl} size={pharmPx(18)} showFallbackText={false} />
            <Text
              style={{
                marginTop: pharmPx(4),
                fontSize: pharmPx(13),
                fontWeight: '800',
                color: hasPrice ? (isBest ? accent : colors.text100) : colors.text300,
              }}
            >
              {hasPrice ? `${slot.priceGel!.toFixed(2)}` : '—'}
            </Text>
            {isBest && hasPrice ? (
              <Text style={{ marginTop: pharmPx(2), fontSize: pharmPx(9), fontWeight: '700', color: accent }}>
                {ka.pharmacy.bestShort}
              </Text>
            ) : !hasPrice ? (
              <Text style={{ marginTop: pharmPx(2), fontSize: pharmPx(9), color: colors.text300 }}>{ka.pharmacy.noPrice}</Text>
            ) : null}
          </View>
        );

        if (onPressSource && hasPrice && slot.sourceUrl) {
          return (
            <Pressable key={slot.sourceId} style={{ flex: 1 }} onPress={() => onPressSource(slot)}>
              {cell}
            </Pressable>
          );
        }

        return (
          <View key={slot.sourceId} style={{ flex: 1 }}>
            {cell}
          </View>
        );
      })}
    </View>
  );
}
