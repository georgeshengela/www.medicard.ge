import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Utensils, ChevronRight } from 'lucide-react-native';
import { useThemeColors } from '@/theme/colors';
import { HomeSectionTitle } from './HomeSectionTitle';

export function HomeNutritionCard() {
 const c=useThemeColors(),router=useRouter();
 return <View style={{marginTop:16,gap:10}}>
  <HomeSectionTitle title="კვების დღიური" />
  <Pressable accessibilityRole="button" accessibilityLabel="კვების დღიურის გახსნა" onPress={()=>router.push('/nutrition')} style={{flexDirection:'row',alignItems:'center',gap:14,backgroundColor:c.surface,borderColor:c.bg300,borderWidth:1,borderRadius:20,padding:18}}>
   <View style={{backgroundColor:c.accent100,padding:12,borderRadius:16}}><Utensils size={24} color={c.primary100}/></View>
   <View style={{flex:1,gap:4}}><Text style={{color:c.text100,fontFamily:'NotoSansGeorgian_600SemiBold',fontSize:15}}>შენი კვება — ერთ კადრში</Text><Text style={{color:c.text200,fontFamily:'NotoSansGeorgian_400Regular',fontSize:12,lineHeight:19}}>გადაიღე კერძი · გადაამოწმე · შეინახე</Text></View><ChevronRight color={c.text200} size={20}/>
  </Pressable>
 </View>;
}
