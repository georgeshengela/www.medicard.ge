import React from 'react';
import { Text, type StyleProp, type TextStyle } from 'react-native';
import { useFontsFamily } from '@/store/FontsContext';
import { ka } from '@/i18n/ka';

type Props = {
  size?: number;
  color?: string;
  className?: string;
  style?: StyleProp<TextStyle>;
  /** `bold` (default) or `regular` MediFont. */
  weight?: 'bold' | 'regular';
};

/** Brand wordmark in MediFont — `მედიქარდი`. */
export function BrandWordmark({
  size = 28,
  color = '#0f1a1c',
  className = '',
  style,
  weight = 'bold',
}: Props) {
  const { brand, brandBold } = useFontsFamily();
  const fontFamily = weight === 'bold' ? brandBold : brand;

  return (
    <Text
      className={className}
      style={[{ fontFamily, fontSize: size, lineHeight: Math.round(size * 1.15), color }, style]}
    >
      {ka.app.brandWordmark}
    </Text>
  );
}
