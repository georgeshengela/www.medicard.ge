import React from 'react';
import { Platform, StyleSheet, Text, TextInput, View, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BadgePercent, Search, Sparkles } from 'lucide-react-native';
import { ka } from '@/i18n/ka';
import { useThemeColors } from '@/theme/colors';

type Props = {
  query: string;
  onChangeQuery: (value: string) => void;
  syncLabel: string | null;
  productCount?: number;
  comparedCount?: number;
};

export function PharmacyHero({ query, onChangeQuery, syncLabel, productCount, comparedCount }: Props) {
  const colors = useThemeColors();

  return (
    <View className="mb-5 overflow-hidden rounded-3xl">
      <LinearGradient
        colors={['#00897B', '#26A69A', '#4DB6AC']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
      <View
        pointerEvents="none"
        style={{
          ...StyleSheet.absoluteFillObject,
          backgroundColor: 'rgba(255,255,255,0.08)',
        }}
      />
      <View className="px-5 pb-5 pt-6">
        <View className="mb-4 flex-row items-start justify-between">
          <View className="flex-1 pr-3">
            <View className="mb-2 flex-row items-center gap-2">
              <BadgePercent size={16} color="#fff" strokeWidth={2.5} />
              <Text className="text-[11px] font-bold uppercase tracking-[1.6px] text-white/80">
                Medicard.GE
              </Text>
            </View>
            <Text className="text-[26px] font-extrabold leading-8 text-white">{ka.pharmacy.title}</Text>
            <Text className="mt-1.5 text-sm leading-5 text-white/85">{ka.pharmacy.heroSubtitle}</Text>
          </View>
          <View className="rounded-2xl bg-white/15 px-3 py-2">
            <Sparkles size={22} color="#fff" strokeWidth={2.2} />
          </View>
        </View>

        <View className="mb-4 flex-row gap-2">
          <View className="flex-1 rounded-2xl bg-white/12 px-3 py-2.5">
            <Text className="text-[10px] font-semibold uppercase tracking-wide text-white/70">
              {ka.pharmacy.statProducts}
            </Text>
            <Text className="mt-0.5 text-xl font-bold text-white">{productCount ?? '—'}</Text>
          </View>
          <View className="flex-1 rounded-2xl bg-white/12 px-3 py-2.5">
            <Text className="text-[10px] font-semibold uppercase tracking-wide text-white/70">
              {ka.pharmacy.statCompared}
            </Text>
            <Text className="mt-0.5 text-xl font-bold text-white">{comparedCount ?? '—'}</Text>
          </View>
          <View className="flex-1 rounded-2xl bg-white/12 px-3 py-2.5">
            <Text className="text-[10px] font-semibold uppercase tracking-wide text-white/70">
              {ka.pharmacy.statSources}
            </Text>
            <Text className="mt-0.5 text-xl font-bold text-white">3</Text>
          </View>
        </View>

        <View
          className="flex-row items-center rounded-2xl bg-white px-3 py-1"
          style={Platform.OS === 'web' ? ({ boxShadow: '0 8px 24px rgba(0,0,0,0.12)' } as ViewStyle) : undefined}
        >
          <Search size={18} color={colors.primary200} strokeWidth={2.4} />
          <TextInput
            value={query}
            onChangeText={onChangeQuery}
            placeholder={ka.pharmacy.searchPlaceholder}
            placeholderTextColor={colors.text300}
            className="ml-2 flex-1 py-3 text-base text-text-100"
          />
        </View>

        <Text className="mt-3 text-center text-[11px] text-white/75">
          {syncLabel ? ka.pharmacy.syncUpdated(syncLabel) : ka.pharmacy.syncUnknown}
        </Text>
      </View>
    </View>
  );
}
