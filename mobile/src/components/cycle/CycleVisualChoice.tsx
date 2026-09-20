import React from 'react';
import { Text, useWindowDimensions, View } from 'react-native';
import { Check, type LucideIcon } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { CyclePressable } from './CyclePressable';
import { CycleObservationIcon } from './CycleObservationIcon';
import { useCycleColors } from '@/theme/cycle';

export function CycleVisualChoice({ id, label, selected, onPress, disabled }: {
  id: string; label: string; selected: boolean; onPress: () => void; disabled?: boolean;
}) {
  const c = useCycleColors();
  const { fontScale } = useWindowDimensions();
  return <CyclePressable accessibilityRole="checkbox" accessibilityLabel={label}
    accessibilityState={{checked: selected, disabled: Boolean(disabled)}} disabled={disabled}
    onPress={() => { Haptics.selectionAsync().catch(() => undefined); onPress(); }}
    style={{width:fontScale>=1.3?'100%':'48%',flexGrow:1,minHeight:60,padding:10,borderRadius:16,
      borderWidth:selected?1.5:1,borderColor:selected?c.brand:c.controlBorder,
      backgroundColor:selected?c.accentSoft:c.card,flexDirection:'row',alignItems:'center',gap:8}}>
    <View style={{width:28,height:32,borderRadius:10,backgroundColor:selected?c.card:c.cardSoft,alignItems:'center',justifyContent:'center'}}>
      <CycleObservationIcon id={id} color={selected?c.brand:c.muted} size={20}/>
    </View>
    <Text style={{flex:1,color:c.ink,fontSize:12,lineHeight:18,fontFamily:selected?'NotoSansGeorgian_600SemiBold':'NotoSansGeorgian_500Medium'}}>{label}</Text>
    {selected?<View style={{position:'absolute',right:6,top:5}}><Check size={12} color={c.brand} strokeWidth={3}/></View>:null}
  </CyclePressable>;
}

export function CycleLogSectionHeading({ icon: Icon, children, hint }: {icon: LucideIcon; children: string; hint?: string}) {
  const c=useCycleColors();
  return <View style={{flexDirection:'row',gap:8,alignItems:'center',marginTop:16,marginBottom:8}}>
    <View style={{width:24,height:28,borderRadius:8,backgroundColor:c.accentSoft,alignItems:'center',justifyContent:'center'}}>
      <Icon size={16} color={c.brand} strokeWidth={1.8}/>
    </View>
    <View style={{flex:1}}><Text style={{color:c.ink,fontSize:14,lineHeight:20,fontFamily:'NotoSansGeorgian_600SemiBold'}}>{children}</Text>
      {hint?<Text style={{color:c.muted,fontSize:12,lineHeight:18,marginTop:2}}>{hint}</Text>:null}
    </View>
  </View>;
}
