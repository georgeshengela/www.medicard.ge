import React from 'react';
import { Text, type StyleProp, type TextStyle } from 'react-native';
import { useThemeColors } from '@/theme/colors';

/**
 * Home hub section label. Always **outside** the card: title, then content.
 * Same type as შემდეგი მიღება / წონის კონტროლი / აქტიურობა.
 */
export function HomeSectionTitle({ title, style }: { title: string; style?: StyleProp<TextStyle> }) {
  const colors = useThemeColors();
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
