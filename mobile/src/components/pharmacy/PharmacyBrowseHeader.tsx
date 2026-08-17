import React from 'react';
import { Text, TextInput, View } from 'react-native';
import { Search } from 'lucide-react-native';
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
      <Text className="text-[11px] font-bold uppercase tracking-[1.4px] text-primary-200">Medicard.GE</Text>
      <Text className="mt-1 text-[24px] font-bold leading-8 text-text-100">{ka.pharmacy.title}</Text>
      <Text className="mt-1 text-sm leading-5 text-text-300">{ka.pharmacy.heroSubtitle}</Text>

      <View className="mt-4 flex-row items-center rounded-2xl border border-bg-300 bg-surface px-3">
        <Search size={18} color={colors.text300} strokeWidth={2.2} />
        <TextInput
          value={query}
          onChangeText={onChangeQuery}
          placeholder={ka.pharmacy.searchPlaceholder}
          placeholderTextColor={colors.text300}
          className="ml-2 flex-1 py-3.5 text-base text-text-100"
        />
      </View>

      <View className="mt-3 flex-row items-center justify-between">
        <Text className="text-xs text-text-300">
          {productCount != null ? ka.pharmacy.catalogSize(productCount) : ka.pharmacy.browseHint}
        </Text>
        <Text className="text-xs text-text-300">
          {syncLabel ? ka.pharmacy.syncUpdated(syncLabel) : ka.pharmacy.syncUnknown}
        </Text>
      </View>
    </View>
  );
}
