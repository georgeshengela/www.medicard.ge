import React, { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Search, X } from 'lucide-react-native';
import { pickerSelectionTick } from '@/components/assessment/pickerHaptics';
import { useFigmaLab } from '@/constants/figmaLabLayout';
import { ka } from '@/i18n/ka';
import type { LabFlagFilter, LabSort } from '@/lib/labFilter';

type Chip = { id: LabFlagFilter; label: string; tone: 'brand' | 'warn' };

const FLAG_CHIPS: Chip[] = [
  { id: 'all', label: ka.lab.filterAll, tone: 'brand' },
  { id: 'watch', label: ka.lab.filterWatch, tone: 'warn' },
  { id: 'H', label: ka.lab.filterHigh, tone: 'warn' },
  { id: 'L', label: ka.lab.filterLow, tone: 'warn' },
  { id: 'N', label: ka.lab.filterNormal, tone: 'brand' },
];

const SORTS: { id: LabSort; label: string }[] = [
  { id: 'new', label: ka.lab.newestFirst },
  { id: 'old', label: ka.lab.oldestFirst },
  { id: 'name', label: ka.lab.sortName },
  { id: 'value', label: ka.lab.sortValue },
];

type Props = {
  query: string;
  onQuery: (value: string) => void;
  flag: LabFlagFilter;
  onFlag: (value: LabFlagFilter) => void;
  flags?: LabFlagFilter[];
  counts?: Partial<Record<LabFlagFilter, number>>;
  sort?: LabSort;
  onSort?: (value: LabSort) => void;
};

export function LabFilterBar({ query, onQuery, flag, onFlag, flags, counts, sort, onSort }: Props) {
  const T = useFigmaLab();
  const [focused, setFocused] = useState(false);
  const chips = FLAG_CHIPS.filter((chip) => !flags || flags.includes(chip.id));

  return (
    <View style={{ gap: 10 }}>
      <View
        style={{
          minHeight: 48,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: focused ? T.brand : T.border,
          backgroundColor: T.tabTrack,
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 12,
          gap: 8,
        }}
      >
        <Search size={18} color={focused ? T.brand : T.textMuted} strokeWidth={2.2} />
        <TextInput
          value={query}
          onChangeText={onQuery}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={ka.lab.searchPlaceholder}
          placeholderTextColor={T.textMuted}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
          style={{
            flex: 1,
            fontFamily: 'NotoSansGeorgian_400Regular',
            fontSize: 15,
            lineHeight: 22,
            color: T.textPrimary,
            paddingVertical: 12,
          }}
        />
        {query ? (
          <Pressable onPress={() => onQuery('')} hitSlop={10} accessibilityRole="button" accessibilityLabel={ka.common.cancel}>
            <X size={18} color={T.textMuted} strokeWidth={2.2} />
          </Pressable>
        ) : null}
      </View>

      {chips.length ? (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 8 }}>
        {chips.map((chip) => {
          const on = flag === chip.id;
          const count = counts?.[chip.id];
          const fg = on ? '#FFFFFF' : T.textSecondary;
          const bg = on ? (chip.tone === 'warn' ? T.destructive : T.brand) : T.tabTrack;
          return (
            <Pressable
              key={chip.id}
              onPress={() => {
                pickerSelectionTick();
                onFlag(chip.id);
              }}
              style={{
                minHeight: 36,
                borderRadius: 18,
                paddingHorizontal: 12,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                backgroundColor: bg,
              }}
            >
              <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 13, lineHeight: 18, color: fg }}>
                {chip.label}
              </Text>
              {count != null ? (
                <View
                  style={{
                    minWidth: 20,
                    height: 20,
                    borderRadius: 10,
                    paddingHorizontal: 6,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: on ? 'rgba(255,255,255,0.22)' : T.cardBg,
                  }}
                >
                  <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 11, color: on ? '#FFFFFF' : T.textPrimary }}>
                    {count}
                  </Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </ScrollView>
      ) : null}

      {sort && onSort ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 8 }}>
          {SORTS.map((item) => {
            const on = sort === item.id;
            return (
              <Pressable
                key={item.id}
                onPress={() => {
                  pickerSelectionTick();
                  onSort(item.id);
                }}
                style={{
                  minHeight: 32,
                  borderRadius: 10,
                  paddingHorizontal: 10,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: on ? T.tabSelected : 'transparent',
                  borderWidth: 1,
                  borderColor: on ? T.brand : T.border,
                }}
              >
                <Text
                  style={{
                    fontFamily: 'NotoSansGeorgian_500Medium',
                    fontSize: 12,
                    lineHeight: 16,
                    color: on ? T.brand : T.textSecondary,
                  }}
                >
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}
    </View>
  );
}
