import React from 'react';
import Svg, { Path } from 'react-native-svg';

/** Figma `arrow-sign-in-2` — white glyph beside Sign In label. */
export function AuthSignInArrow({ size = 20, color = '#FFFFFF' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <Path
        d="M10 3.5v9.2M10 12.7l-3.2-3.2M10 12.7l3.2-3.2M4.5 16.5h11"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
