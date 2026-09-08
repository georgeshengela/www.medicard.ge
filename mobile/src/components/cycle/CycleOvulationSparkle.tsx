import React from 'react';
import { View } from 'react-native';

/**
 * Small outlined diamond — ovulation estimate only.
 * Never wraps the day numeral. Never used for selection.
 */
export function CycleOvulationSparkle({
  color,
  size = 8,
}: {
  color: string;
  size?: number;
}) {
  const edge = Math.max(6, Math.round(size * 0.78));
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no"
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
    >
      <View
        style={{
          width: edge,
          height: edge,
          borderWidth: 1.2,
          borderColor: color,
          backgroundColor: 'transparent',
          transform: [{ rotate: '45deg' }],
        }}
      />
    </View>
  );
}
