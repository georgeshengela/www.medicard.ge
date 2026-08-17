import React from 'react';
import { Image, Linking, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Crown, ExternalLink } from 'lucide-react-native';
import { Button } from '@/components/ui/Button';
import { ka } from '@/i18n/ka';
import type { PharmacyOfferInfo } from '@/lib/api';
import { PHARMACY_SOURCES } from '@/constants/pharmacyVisuals';
import { useThemeColors } from '@/theme/colors';

type Props = {
  offers: PharmacyOfferInfo[];
  bestPrice: number | null;
};

function sourceAccent(sourceId?: string) {
  return PHARMACY_SOURCES.find((s) => s.id === sourceId)?.color ?? '#26A69A';
}

export function PriceCompareList({ offers, bestPrice }: Props) {
  const colors = useThemeColors();

  if (!offers.length) {
    return (
      <View className="rounded-2xl border border-dashed border-accent-100/50 bg-bg-200/40 p-6">
        <Text className="text-center text-sm text-text-300">{ka.pharmacy.noOffers}</Text>
      </View>
    );
  }

  return (
    <View className="gap-3">
      {offers.map((offer, index) => {
        const isBest = bestPrice != null && offer.priceGel === bestPrice;
        const accent = sourceAccent(offer.source?.id);
        return (
          <View
            key={offer.id}
            className={`overflow-hidden rounded-3xl border ${isBest ? 'border-primary-200' : 'border-accent-100/40'}`}
          >
            {isBest ? (
              <LinearGradient colors={['rgba(38,166,154,0.16)', 'rgba(38,166,154,0.04)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                <View className="px-4 py-2">
                  <View className="flex-row items-center gap-1.5">
                    <Crown size={14} color={colors.primary200} />
                    <Text className="text-xs font-bold uppercase tracking-wide text-primary-200">
                      {ka.pharmacy.bestPrice}
                    </Text>
                  </View>
                </View>
              </LinearGradient>
            ) : null}
            <View className={`p-4 ${isBest ? 'bg-primary-200/5' : 'bg-bg-200/50'}`}>
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-3 flex-1">
                  {offer.source?.logoUrl ? (
                    <View className="rounded-2xl border border-accent-100/30 bg-white p-1">
                      <Image source={{ uri: offer.source.logoUrl }} className="h-9 w-9 rounded-xl" />
                    </View>
                  ) : (
                    <View
                      className="h-11 w-11 items-center justify-center rounded-2xl"
                      style={{ backgroundColor: `${accent}18` }}
                    >
                      <Text className="text-xs font-bold" style={{ color: accent }}>
                        {offer.source?.nameKa?.slice(0, 2) ?? '?'}
                      </Text>
                    </View>
                  )}
                  <View className="flex-1">
                    <Text className="text-base font-bold text-text-100">{offer.source?.nameKa ?? '—'}</Text>
                    <Text className="text-xs text-text-300">#{index + 1} · {offer.inStock ? ka.pharmacy.inStock : ka.pharmacy.outOfStock}</Text>
                  </View>
                </View>
                <View className="items-end">
                  <Text className={`text-2xl font-extrabold ${isBest ? 'text-primary-200' : 'text-text-100'}`}>
                    {offer.priceGel.toFixed(2)} ₾
                  </Text>
                  {offer.oldPriceGel && offer.oldPriceGel > offer.priceGel ? (
                    <Text className="text-sm text-text-300 line-through">{offer.oldPriceGel.toFixed(2)} ₾</Text>
                  ) : null}
                </View>
              </View>
              <View className="mt-3">
                <Button
                  label={ka.pharmacy.openInPharmacy}
                  variant={isBest ? 'primary' : 'secondary'}
                  onPress={() => Linking.openURL(offer.sourceUrl)}
                  icon={ExternalLink}
                />
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
}
