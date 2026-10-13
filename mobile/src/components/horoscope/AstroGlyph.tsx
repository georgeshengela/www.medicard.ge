import React, { memo } from 'react';
import { View } from 'react-native';
import Svg, { G, Path } from 'react-native-svg';
import { ASTRO_GLYPHS, type GlyphKey } from '@/lib/horoscope/astroGlyphs';

/** A zodiac / planet / aspect glyph (Noto Sans Symbols outlines) as a standalone icon. */
export const AstroGlyph = memo(function AstroGlyph({ name, size = 20, color }: { name: GlyphKey | string; size?: number; color: string }) {
  const g = ASTRO_GLYPHS[name as GlyphKey];
  if (!g) return null;
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox={g.vb}>
        <Path d={g.d} fill={color} fillRule={g.evenOdd ? 'evenodd' : 'nonzero'} />
      </Svg>
    </View>
  );
});

/** The same glyph placed inside another Svg at (x, y) — centre — with a given size. */
export function GlyphAt({ name, x, y, size, color, opacity = 1 }: { name: GlyphKey | string; x: number; y: number; size: number; color: string; opacity?: number }) {
  const g = ASTRO_GLYPHS[name as GlyphKey];
  if (!g) return null;
  const [vx, vy, vw] = g.vb.split(' ').map(Number);
  const s = size / vw;
  return (
    <G transform={`translate(${x - size / 2} ${y - size / 2}) scale(${s}) translate(${-vx} ${-vy})`} opacity={opacity}>
      <Path d={g.d} fill={color} fillRule={g.evenOdd ? 'evenodd' : 'nonzero'} />
    </G>
  );
}
