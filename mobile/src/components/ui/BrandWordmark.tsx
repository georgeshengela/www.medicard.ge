import React from 'react';
import { Text, type StyleProp, type TextStyle } from 'react-native';
import { useFontsFamily } from '@/store/FontsContext';
import { ka } from '@/i18n/ka';
import { useThemeColors } from '@/theme/colors';

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
  color,
  className = '',
  style,
  weight = 'bold',
}: Props) {
  const colors = useThemeColors();
  const { brand, brandBold } = useFontsFamily();
  const fontFamily = weight === 'bold' ? brandBold : brand;
  const ink = color ?? colors.text100;

  return (
    <Text
      className={className}
      style={[{ fontFamily, fontSize: size, lineHeight: Math.round(size * 1.15), color: ink }, style]}
    >
      {ka.app.brandWordmark}
    </Text>
  );
}
