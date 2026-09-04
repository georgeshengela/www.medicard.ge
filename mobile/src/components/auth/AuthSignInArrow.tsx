import React from 'react';
import Svg, { Path } from 'react-native-svg';

/** Forward arrow for start / continue CTAs — not the download tray. */
export function AuthSignInArrow({ size = 20, color = '#FFFFFF' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <Path
        d="M3.5 10h13M12.2 6.2 16.5 10l-4.3 3.8"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
