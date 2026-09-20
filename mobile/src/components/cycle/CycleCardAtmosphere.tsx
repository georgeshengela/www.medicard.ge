import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useCycleColors } from '@/theme/cycle';

/** Quiet abstract rhythm, clipped to the edges and excluded from touch / speech. */
export function CycleCardAtmosphere() {
  const c = useCycleColors();
  return (
    <View pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
      style={[StyleSheet.absoluteFill, { borderRadius: 28, overflow: 'hidden' }]}>
      <Svg width="100%" height="100%" viewBox="0 0 360 500" preserveAspectRatio="none">
        <Path d="M-65 260C65 245 78 102 6 28S100-80 186-44" fill="none" stroke={c.gaugeProgress} strokeWidth={1} opacity={0.12}/>
        <Path d="M-86 282C47 258 99 110 23 29S114-64 200-40" fill="none" stroke={c.gaugeProgress} strokeWidth={1} opacity={0.08}/>
        <Path d="M402 187C305 208 334 336 405 365S400 506 298 540" fill="none" stroke={c.fertile} strokeWidth={1} opacity={0.10}/>
      </Svg>
    </View>
  );
}
