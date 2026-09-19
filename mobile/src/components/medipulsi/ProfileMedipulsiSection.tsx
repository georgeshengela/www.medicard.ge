import React from 'react';
import {Pressable,Text,View} from 'react-native';
import {useRouter} from 'expo-router';
import {Activity,ChevronRight,Footprints} from 'lucide-react-native';
import {useThemeColors} from '@/theme/colors';
import {HomeSectionTitle} from '@/components/home/HomeSectionTitle';
export function ProfileMedipulsiSection(){
 const router=useRouter(),c=useThemeColors();
 return <View style={{gap:10}}><HomeSectionTitle title="MEDI RUN · MEDIPULSI"/><Pressable accessibilityRole="button" accessibilityLabel="MEDIPULSI — გასეირნება და აღმოჩენები" onPress={()=>router.push('/run')} style={{padding:18,borderRadius:24,backgroundColor:c.surface,borderWidth:1,borderColor:c.bg300,flexDirection:'row',alignItems:'center',gap:14}}><View style={{height:52,width:52,borderRadius:18,alignItems:'center',justifyContent:'center',backgroundColor:c.accent100}}><Activity color={c.primary200} size={29}/></View><View style={{flex:1,gap:5}}><Text style={{fontFamily:'NotoSansGeorgian_700Bold',color:c.text100,fontSize:17}}>შენი გზის პულსი</Text><Text style={{fontFamily:'NotoSansGeorgian_400Regular',color:c.text200,fontSize:12,lineHeight:19}}>იარე, გააფერადე გზა და აღმოაჩინე საჩუქრები.</Text><View style={{flexDirection:'row',alignItems:'center',gap:5}}><Footprints size={12} color={c.primary100}/><Text style={{color:c.primary100,fontFamily:'NotoSansGeorgian_500Medium',fontSize:11}}>თამაში ყველგან · მისიები თბილისში</Text></View></View><ChevronRight size={19} color={c.text300}/></Pressable></View>;
}
