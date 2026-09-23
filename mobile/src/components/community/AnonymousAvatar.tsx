import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { useThemeColors } from '@/theme/colors';

/** A shared, non-identifying avatar; never derived from the account's photo. */
export function AnonymousAvatar({ size = 34 }: { size?: number }) {
  const c = useThemeColors();
  return <View accessible accessibilityLabel="ანონიმური წევრის ავატარი" style={{ width:size, height:size, borderRadius:size/2, backgroundColor:c.bg200, borderWidth:1, borderColor:c.bg300, alignItems:'center', justifyContent:'center' }}>
    <Svg width={size*0.76} height={size*0.76} viewBox="0 0 32 32" fill="none">
      <Path d="M5 29c.7-6 4.6-9 11-9s10.3 3 11 9" fill={c.accent100} stroke={c.primary100} strokeWidth={1.4} strokeLinecap="round"/>
      <Circle cx={16} cy={12} r={7} fill={c.surface} stroke={c.primary100} strokeWidth={1.4}/>
      <Path d="M9 10.5c2-1.2 4.3-.4 7 .5 2.7-.9 5-1.7 7-.5v3c-1.7 3-4.4 3-7 .5-2.6 2.5-5.3 2.5-7-.5z" fill={c.primary100}/>
      <Circle cx={12.5} cy={12.5} r={1} fill={c.surface}/>
      <Circle cx={19.5} cy={12.5} r={1} fill={c.surface}/>
    </Svg>
  </View>;
}
