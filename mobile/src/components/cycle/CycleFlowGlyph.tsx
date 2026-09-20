import React from 'react';
import { View } from 'react-native';
import Svg, { Line, Path } from 'react-native-svg';
import { useCycleColors } from '@/theme/cycle';

/** Shape + count distinguish intensity even in monochrome. */
export function CycleFlowGlyph({ level, selected }: {level:number;selected:boolean}) {
  const c=useCycleColors(),ink=selected?c.brand:c.period;
  return <View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{alignItems:'center',gap:4}}>
    <Svg width={25} height={28} viewBox="0 0 40 44">
      <Path d="M20 3C18 11 7 20 7 28a13 13 0 0 0 26 0C33 20 22 11 20 3Z" fill={level?selected?c.accentSoft:c.periodSoft:'none'} stroke={ink} strokeWidth={1.8}/>
      {level>0?<Path d="M14 29a6 6 0 0 0 6 6" fill="none" stroke={ink} strokeWidth={2} strokeLinecap="round"/>:<Line x1="10" y1="35" x2="30" y2="15" stroke={ink} strokeWidth={2}/>}
    </Svg>
    <View style={{flexDirection:'row',gap:3}}>{[1,2,3,4].map(n=><View key={n} style={{width:5,height:5,borderRadius:3,borderWidth:1,borderColor:n<=level?ink:c.controlBorder,backgroundColor:n<=level?ink:'transparent'}}/>)}</View>
  </View>;
}
