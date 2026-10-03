import React from 'react';
import { Text, View } from 'react-native';
import { useIsDark, useThemeColors } from '@/theme/colors';
import { MODULE_BRANDS, WORDMARK_FONT, moduleInk, type ModuleBrandId } from '@/theme/moduleBrand';

/**
 * „MEDI“ + the module part, exactly like the MEDIRUN logo always sat: upright MEDI in ink, the
 * module part in its colour and skewed −10°. Compact by default (25, the MEDIRUN hub header size):
 * put it in the header row next to the back button with one 11 px muted line under it — never as a
 * big banner. `onHero` = white MEDI + light suffix, for the module's gradient hero card.
 */
export function ModuleWordmark({
  module,
  size = 25,
  color,
  onHero = false,
}: {
  module: ModuleBrandId;
  size?: number;
  /** Override for the upright „MEDI“ (defaults to text100, white on a hero). */
  color?: string;
  onHero?: boolean;
}) {
  const c = useThemeColors();
  const dark = useIsDark();
  const brand = MODULE_BRANDS[module];
  const base = {
    fontFamily: WORDMARK_FONT,
    fontSize: size,
    lineHeight: Math.round(size * 1.3),
    letterSpacing: -size * 0.035,
    includeFontPadding: false,
  } as const;
  return (
    <View accessible accessibilityRole="header" accessibilityLabel={brand.name} style={{ flexDirection: 'row', alignItems: 'center', paddingRight: 4 }}>
      <Text allowFontScaling={false} style={{ ...base, color: color || (onHero ? '#FFFFFF' : c.text100) }}>MEDI</Text>
      {brand.suffix ? (
        <Text
          allowFontScaling={false}
          style={{
            ...base,
            color: onHero ? brand.onHero : moduleInk(module, dark),
            transform: [{ skewX: '-10deg' }],
            marginLeft: Math.max(1, size * 0.04),
          }}
        >
          {brand.suffix}
        </Text>
      ) : null}
    </View>
  );
}
