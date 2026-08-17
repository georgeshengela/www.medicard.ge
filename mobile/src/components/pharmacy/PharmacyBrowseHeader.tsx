import React from 'react';
import { Text, TextInput, View } from 'react-native';
import { Search } from 'lucide-react-native';
import { PharmacySourceLogo } from '@/components/pharmacy/PharmacySourceLogo';
import { PHARMACY_SOURCES, pharmPx } from '@/constants/pharmacyVisuals';
import { ka } from '@/i18n/ka';
import { useThemeColors } from '@/theme/colors';

type Props = {
  query: string;
  onChangeQuery: (value: string) => void;
  syncLabel: string | null;
  productCount?: number;
};

export function PharmacyBrowseHeader({ query, onChangeQuery, syncLabel, productCount }: Props) {
  const colors = useThemeColors();

  return (
    <View className="mb-5">
      <Text className="text-[12px] font-bold uppercase tracking-[1.2px] text-primary-200">Medicard.GE</Text>
      <Text className="mt-1 text-[26px] font-bold text-text-100">{ka.pharmacy.title}</Text>
      <Text className="mt-1 text-[15px] text-text-300">{ka.pharmacy.heroSubtitle}</Text>

      <View
        style={{
          marginTop: pharmPx(14),
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderRadius: pharmPx(14),
          borderWidth: 1,
          borderColor: colors.bg300,
          backgroundColor: colors.surface,
          paddingVertical: pharmPx(10),
          paddingHorizontal: pharmPx(14),
        }}
      >
        {PHARMACY_SOURCES.map((src) => (
          <View key={src.id} style={{ alignItems: 'center', gap: 4, flex: 1 }}>
            <PharmacySourceLogo sourceId={src.id} logoUrl={src.logoUrl} size={pharmPx(24)} showFallbackText={false} />
            <Text style={{ fontSize: pharmPx(10), fontWeight: '600', color: colors.text300 }} numberOfLines={1}>
              {src.label}
            </Text>
          </View>
        ))}
      </View>

      <View
        style={{
          marginTop: pharmPx(12),
          flexDirection: 'row',
          alignItems: 'center',
          borderRadius: pharmPx(14),
          borderWidth: 1,
          borderColor: colors.bg300,
          backgroundColor: colors.surface,
          paddingHorizontal: pharmPx(12),
        }}
      >
        <Search size={pharmPx(18)} color={colors.text300} strokeWidth={2.2} />
        <TextInput
          value={query}
          onChangeText={onChangeQuery}
          placeholder={ka.pharmacy.searchPlaceholder}
          placeholderTextColor={colors.text300}
          style={{ marginLeft: pharmPx(10), flex: 1, paddingVertical: pharmPx(12), fontSize: pharmPx(15), color: colors.text100 }}
        />
      </View>

      <View className="mt-2.5 flex-row items-center justify-between px-0.5">
        <Text className="text-[13px] text-text-300">
          {productCount != null ? ka.pharmacy.catalogSize(productCount) : ka.pharmacy.browseHint}
        </Text>
        <Text className="text-[13px] text-text-300">
          {syncLabel ? ka.pharmacy.syncUpdated(syncLabel) : ka.pharmacy.syncUnknown}
        </Text>
      </View>
    </View>
  );
}
