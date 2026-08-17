import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { pharmPx } from '@/constants/pharmacyVisuals';
import type { DrugCategoryInfo } from '@/lib/api';
import { useThemeColors } from '@/theme/colors';

type Props = {
  categories: DrugCategoryInfo[];
  onSelect: (slug: string, nameKa: string) => void;
};

export function CategoryGrid({ categories, onSelect }: Props) {
  const colors = useThemeColors();
  const items = categories.flatMap((c) => (c.children?.length ? c.children : [c]));

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: pharmPx(8), paddingRight: pharmPx(4), paddingBottom: pharmPx(2) }}
    >
      {items.map((cat) => (
        <Pressable key={cat.id} onPress={() => onSelect(cat.slug, cat.nameKa)} className="active:opacity-75">
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: pharmPx(8),
              borderRadius: pharmPx(12),
              borderWidth: 1,
              borderColor: colors.bg300,
              backgroundColor: colors.surface,
              paddingVertical: pharmPx(8),
              paddingHorizontal: pharmPx(12),
            }}
          >
            <View
              style={{
                width: pharmPx(6),
                height: pharmPx(6),
                borderRadius: pharmPx(3),
                backgroundColor: colors.primary200,
              }}
            />
            <Text style={{ fontSize: pharmPx(13), fontWeight: '600', color: colors.text100 }} numberOfLines={1}>
              {cat.nameKa}
            </Text>
            {cat.productCount != null ? (
              <Text style={{ fontSize: pharmPx(11), fontWeight: '600', color: colors.text300 }}>{cat.productCount}</Text>
            ) : null}
          </View>
        </Pressable>
      ))}
    </ScrollView>
  );
}
