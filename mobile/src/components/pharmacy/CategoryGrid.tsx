import React from 'react';
import { Pressable, Text, View } from 'react-native';
import type { DrugCategoryInfo } from '@/lib/api';
import { categoryVisual } from '@/constants/pharmacyVisuals';

type Props = {
  categories: DrugCategoryInfo[];
  onSelect: (slug: string, nameKa: string) => void;
};

export function CategoryGrid({ categories, onSelect }: Props) {
  const items = categories.flatMap((c) => (c.children?.length ? c.children : [c]));

  return (
    <View className="flex-row flex-wrap gap-2.5">
      {items.map((cat) => {
        const visual = categoryVisual(cat.slug);
        return (
          <Pressable
            key={cat.id}
            onPress={() => onSelect(cat.slug, cat.nameKa)}
            className="w-[48%] overflow-hidden rounded-2xl active:opacity-85"
          >
            <View className="flex-row items-center gap-3 border border-accent-100/30 bg-bg-200/70 p-3">
              <View
                className="h-11 w-11 items-center justify-center rounded-2xl"
                style={{ backgroundColor: visual.bg }}
              >
                <Text className="text-xl">{visual.emoji}</Text>
              </View>
              <Text className="flex-1 text-[13px] font-semibold leading-4 text-text-100" numberOfLines={2}>
                {cat.nameKa}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
