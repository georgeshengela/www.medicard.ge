import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Crown } from 'lucide-react-native';
import { ka } from '@/i18n/ka';
import type { PharmacySourcePrice } from '@/lib/api';
import { PHARMACY_SOURCES } from '@/constants/pharmacyVisuals';
import { useIsDark, useThemeColors } from '@/theme/colors';

type Props = {
  prices: PharmacySourcePrice[];
  compact?: boolean;
  onPressSource?: (price: PharmacySourcePrice) => void;
};

function sourceColor(sourceId: string) {
  return PHARMACY_SOURCES.find((s) => s.id === sourceId)?.color ?? '#26A69A';
}

function sourceShort(sourceId: string) {
  if (sourceId === 'PHARMADEPOT') return 'PD';
  if (sourceId === 'AVERSI') return 'AV';
  return 'PSP';
}

export function PharmacySourcePriceRow({ prices, compact = false, onPressSource }: Props) {
  const colors = useThemeColors();
  const dark = useIsDark();
  const slots =
    prices.length >= 3
      ? prices
      : PHARMACY_SOURCES.map((src) => prices.find((p) => p.sourceId === src.id) ?? {
          sourceId: src.id,
          nameKa: src.label,
          logoUrl: null,
          priceGel: null,
          oldPriceGel: null,
          inStock: false,
          isBest: false,
          sourceUrl: null,
        });

  return (
    <View className="flex-row gap-2">
      {slots.map((slot) => {
        const accent = sourceColor(slot.sourceId);
        const hasPrice = slot.priceGel != null;
        const cell = (
          <View
            style={{
              borderRadius: 14,
              borderWidth: slot.isBest ? 2 : 1,
              borderColor: slot.isBest ? accent : colors.bg300,
              backgroundColor: slot.isBest
                ? `${accent}${dark ? '22' : '12'}`
                : dark
                  ? colors.bg200
                  : '#FAFBFB',
              paddingVertical: compact ? 8 : 10,
              paddingHorizontal: 6,
              alignItems: 'center',
            }}
          >
            <Text
              style={{
                fontSize: compact ? 9 : 10,
                fontWeight: '800',
                letterSpacing: 0.6,
                color: accent,
                textTransform: 'uppercase',
              }}
            >
              {sourceShort(slot.sourceId)}
            </Text>
            <Text
              style={{
                marginTop: 4,
                fontSize: compact ? 13 : 15,
                fontWeight: '800',
                color: hasPrice ? colors.text100 : colors.text300,
              }}
            >
              {hasPrice ? `${slot.priceGel!.toFixed(2)} ₾` : '—'}
            </Text>
            {slot.isBest ? (
              <View className="mt-1 flex-row items-center gap-0.5">
                <Crown size={10} color={accent} />
                <Text style={{ fontSize: 9, fontWeight: '700', color: accent }}>{ka.pharmacy.bestShort}</Text>
              </View>
            ) : hasPrice ? (
              <Text style={{ marginTop: 4, fontSize: 9, color: colors.text300 }}>{slot.nameKa}</Text>
            ) : (
              <Text style={{ marginTop: 4, fontSize: 9, color: colors.text300 }}>{ka.pharmacy.noPrice}</Text>
            )}
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
