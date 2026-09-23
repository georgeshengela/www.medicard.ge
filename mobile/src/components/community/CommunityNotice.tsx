import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Check, ChevronRight, Heart, MessageCircle, Reply, ThumbsDown } from 'lucide-react-native';
import { useThemeColors } from '@/theme/colors';

const kinds = {
  like: { icon: Heart, title: 'შენს პოსტს გამოეხმაურნენ', detail: 'ახალი რეაქცია შენს საუბარში' },
  dislike: { icon: ThumbsDown, title: 'შენს პოსტზე განსხვავებული აზრია', detail: 'ნახე გამოხმაურება' },
  comment: { icon: MessageCircle, title: 'შენს პოსტზე ახალი კომენტარია', detail: 'შემოუერთდი საუბარს' },
  reply: { icon: Reply, title: 'შენს კომენტარს უპასუხეს', detail: 'გააგრძელე დისკუსია' },
  comment_like: { icon: Heart, title: 'შენი კომენტარი მოიწონეს', detail: 'შენს სიტყვებს გამოეხმაურნენ' },
  approved: { icon: Check, title: 'შენი ჩანაწერი გამოქვეყნდა', detail: 'ნახე საუბარი' },
};
function timeLabel(value:string) {
  const date=new Date(value), minutes=Math.max(0,Math.floor((Date.now()-date.getTime())/60000));
  if(minutes<1)return 'ახლახან';
  if(minutes<60)return `${minutes} წთ წინ`;
  if(minutes<1440)return `${Math.floor(minutes/60)} სთ წინ`;
  return `${date.getDate()}.${String(date.getMonth()+1).padStart(2,'0')} · ${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`;
}
export function CommunityNotice({item,onPress,disabled}:{item:{kind:string;readAt:string|null;createdAt:string};onPress:()=>void;disabled:boolean}) {
 const c=useThemeColors(), unread=!item.readAt;
 const copy=kinds[item.kind as keyof typeof kinds]||kinds.comment, Icon=copy.icon;
 return <Pressable accessibilityRole="button" accessibilityLabel={`${unread?'წაუკითხავი. ':''}${copy.title}. ${timeLabel(item.createdAt)}`} disabled={disabled} onPress={onPress} style={{flexDirection:'row',alignItems:'center',gap:12,paddingHorizontal:18,paddingVertical:15,backgroundColor:unread?c.accent100:'transparent',opacity:disabled?0.6:1}}>
   <View style={{width:44,height:44,borderRadius:22,backgroundColor:unread?c.surface:c.bg200,alignItems:'center',justifyContent:'center'}}><Icon size={21} strokeWidth={1.6} color={unread?c.primary100:c.text200}/></View>
   <View style={{flex:1,gap:3}}>
     <Text style={{fontFamily:unread?'NotoSansGeorgian_600SemiBold':'NotoSansGeorgian_400Regular',fontSize:13,lineHeight:20,color:c.text100}}>{copy.title}</Text>
     <Text style={{fontFamily:'NotoSansGeorgian_400Regular',fontSize:11,lineHeight:17,color:c.text200}}>{copy.detail}</Text>
     <Text style={{fontFamily:'NotoSansGeorgian_500Medium',fontSize:10,lineHeight:16,color:unread?c.primary100:c.text200}}>{timeLabel(item.createdAt)}</Text>
   </View>
   {unread?<View style={{width:7,height:7,borderRadius:4,backgroundColor:c.primary100}}/>:<ChevronRight size={16} color={c.text200}/>}
 </Pressable>;
}
