import React from 'react';
import {Image,Pressable,Text,View} from 'react-native';
import {Check,Feather,UserRound} from 'lucide-react-native';
import {useThemeColors} from '@/theme/colors';
import {AVATAR_SOURCES,isAvatarId} from '@/constants/avatarAssets';
import {AnonymousAvatar} from './AnonymousAvatar';
export type CommunityIdentityMode='original'|'nickname'|'anonymous';
export function CommunityIdentityChoice({mode,alias,fullName,avatarId,locked,onChange}:{mode:CommunityIdentityMode;alias:string;fullName:string;avatarId?:string|null;locked:boolean;onChange:(value:CommunityIdentityMode)=>void}){
 const c=useThemeColors();
 const options=[{key:'original' as const,label:'პროფილის სახელით'},{key:'nickname' as const,label:'მეტსახელით'},{key:'anonymous' as const,label:'ანონიმურად'}];
 return <View style={{gap:10}}>
  <Text style={{fontFamily:'NotoSansGeorgian_600SemiBold',fontSize:13,color:c.text100}}>როგორ გამოჩნდები?</Text>
  <View accessibilityRole="radiogroup" style={{flexDirection:'row',gap:7}}>{options.map(option=>{
   const active=option.key===mode,disabled=locked||(option.key==='original'&&!fullName.trim());
   return <Pressable key={option.key} accessibilityRole="radio" accessibilityLabel={option.label} accessibilityState={{checked:active,disabled}} disabled={disabled} onPress={()=>onChange(option.key)} style={{flex:1,minHeight:82,paddingHorizontal:6,paddingVertical:10,borderRadius:13,borderWidth:1,borderColor:active?c.primary100:c.bg300,backgroundColor:active?c.accent100:'transparent',alignItems:'center',justifyContent:'center',gap:7,opacity:disabled&&!active?0.55:1}}>
    {option.key==='anonymous'?<AnonymousAvatar size={26}/>:option.key==='original'&&isAvatarId(avatarId)?<Image source={AVATAR_SOURCES[avatarId]} style={{width:26,height:26,borderRadius:13}}/>:option.key==='original'?<UserRound size={23} strokeWidth={1.6} color={c.primary100}/>:<Feather size={23} strokeWidth={1.6} color={c.primary100}/>}
    <Text style={{fontFamily:'NotoSansGeorgian_500Medium',fontSize:11,lineHeight:16,textAlign:'center',color:c.text100}}>{option.label}</Text>
    {active&&<Check size={12} color={c.primary100} style={{position:'absolute',right:5,top:5}}/>}
   </Pressable>;
  })}</View>
  <Text style={{fontFamily:'NotoSansGeorgian_400Regular',fontSize:11,lineHeight:18,color:c.text200}}>{mode==='original'?`${fullName} · გამოჩნდება შენი სახელი და პროფილის ავატარი.`:mode==='nickname'?`${alias} · პროფილის სახელი და ავატარი დაფარულია.`:'გამოჩნდები დასამახსოვრებელი სახელით, რომელიც მხოლოდ ამ დისკუსიას ეკუთვნის.'}</Text>
  {locked&&<Text style={{fontFamily:'NotoSansGeorgian_400Regular',fontSize:11,lineHeight:18,color:c.text200}}>გამოქვეყნებული ჩანაწერის ვინაობა უცვლელია. ანონიმური პოსტის ავტორის პასუხებიც ანონიმურად რჩება.</Text>}
 </View>;
}
