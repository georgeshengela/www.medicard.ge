import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { useIsDark } from '@/theme/colors';
import { MedicardLogoMark } from '@/components/ui/MedicardLogoMark';

type Props = {
  size?: number;
  className?: string;
  style?: StyleProp<ViewStyle>;
  /** White mark on teal/dark surfaces (Figma splash). */
  inverse?: boolean;
  /** `plain` — mark only. `brand` — teal tile + white mark (auth). `tile` — theme-aware chip. */
  variant?: 'plain' | 'tile' | 'brand';
};

export function BrandLogo({
  size = 64,
  className = '',
  style,
  inverse = false,
  variant = 'plain',
}: Props) {
  const isDark = useIsDark();
  const radius = Math.round(size * 0.28);
  const onDarkSurface = inverse || variant === 'brand' || (variant === 'tile' && isDark);
  const tone = onDarkSurface ? 'inverse' : 'brand';
  const markSize = variant === 'plain' ? size : Math.round(size * (onDarkSurface ? 0.8 : 0.82));

  if (variant === 'brand') {
    return (
      <View
        className={`items-center justify-center bg-primary-200 ${className}`}
        style={[{ width: size, height: size, borderRadius: radius, overflow: 'hidden' }, style]}
      >
        <MedicardLogoMark size={markSize} tone="inverse" />
      </View>
    );
  }

  if (variant === 'plain') {
    return (
      <View className={className} style={[{ width: markSize, height: markSize }, style]}>
        <MedicardLogoMark size={markSize} tone={tone} />
      </View>
    );
  }

  return (
    <View
      className={
        onDarkSurface
          ? `items-center justify-center bg-primary-200 ${className}`
          : `items-center justify-center border border-bg-300 bg-surface ${className}`
      }
      style={[{ width: size, height: size, borderRadius: radius, overflow: 'hidden' }, style]}
    >
      <MedicardLogoMark size={markSize} tone={tone} />
    </View>
  );
}
