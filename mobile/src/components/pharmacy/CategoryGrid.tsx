import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import type { DrugCategoryInfo } from '@/lib/api';
import { categoryVisual } from '@/constants/pharmacyVisuals';
import { useThemeColors } from '@/theme/colors';

type Props = {
  categories: DrugCategoryInfo[];
  onSelect: (slug: string, nameKa: string) => void;
};

export function CategoryGrid({ categories, onSelect }: Props) {
  const colors = useThemeColors();
  const items = categories.flatMap((c) => (c.children?.length ? c.children : [c]));

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 4 }}>
      {items.map((cat) => {
        const visual = categoryVisual(cat.slug);
        return (
          <Pressable
            key={cat.id}
            onPress={() => onSelect(cat.slug, cat.nameKa)}
            className="active:opacity-85"
          >
            <View
              className="flex-row items-center gap-2 rounded-full border px-3.5 py-2"
              style={{ borderColor: colors.bg300, backgroundColor: colors.surface }}
            >
              <Text className="text-base">{visual.emoji}</Text>
              <Text className="text-sm font-semibold text-text-100" numberOfLines={1}>
                {cat.nameKa}
              </Text>
              {cat.productCount != null ? (
                <Text className="ml-1 text-[11px] font-medium text-text-300">({cat.productCount})</Text>
              ) : null}
            </View>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
