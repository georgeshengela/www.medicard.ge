import React from 'react';
import { Text, View, type StyleProp, type TextStyle } from 'react-native';
import { useThemeColors } from '@/theme/colors';
import { ModuleWordmark } from '@/components/brand/ModuleWordmark';
import type { ModuleBrandId } from '@/theme/moduleBrand';

/**
 * Home hub section label. Always **outside** the card: title, then content.
 * Same type as შემდეგი მიღება / წონის კონტროლი / აქტიურობა.
 */
export function HomeSectionTitle({ title, brand, style }: { title: string; brand?: ModuleBrandId; style?: StyleProp<TextStyle> }) {
  const colors = useThemeColors();
  if (brand) return <View style={{ marginBottom: 8 }}><ModuleWordmark module={brand} size={16} /></View>;
  return (
    <Text
      style={[
        {
          fontFamily: 'NotoSansGeorgian_700Bold',
          fontSize: 14,
          lineHeight: 20,
          color: colors.text100,
          marginBottom: 8,
        },
        style,
      ]}
    >
      {title}
    </Text>
  );
}
