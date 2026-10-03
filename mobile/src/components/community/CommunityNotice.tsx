import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Check, ChevronRight, Heart, MessageCircle, Reply, ThumbsDown } from 'lucide-react-native';
import { useCommunityColors as useThemeColors } from '@/components/community/communityPalette';
import { tx } from '@/i18n/locale';

const kinds = {
  mention: { icon: Reply, title: tx('კომენტარში მოგნიშნეს', 'You were mentioned in a comment'), detail: tx('ნახე, რომელ საუბარში გელოდებიან', 'See which conversation is waiting for you') },
  like: { icon: Heart, title: tx('შენს პოსტს გამოეხმაურნენ', 'Someone responded to your post'), detail: tx('ახალი რეაქცია შენს საუბარში', 'A new reaction in your conversation') },
  dislike: { icon: ThumbsDown, title: tx('შენს პოსტზე განსხვავებული აზრია', 'Someone sees your post differently'), detail: tx('ნახე გამოხმაურება', 'See the response') },
  comment: { icon: MessageCircle, title: tx('შენს პოსტზე ახალი კომენტარია', 'New comment on your post'), detail: tx('შემოუერთდი საუბარს', 'Join the conversation') },
  reply: { icon: Reply, title: tx('შენს კომენტარს უპასუხეს', 'Someone replied to your comment'), detail: tx('გააგრძელე დისკუსია', 'Continue the discussion') },
  comment_like: { icon: Heart, title: tx('შენი კომენტარი მოიწონეს', 'Someone liked your comment'), detail: tx('შენს სიტყვებს გამოეხმაურნენ', 'Your words resonated') },
  approved: { icon: Check, title: tx('შენი ჩანაწერი გამოქვეყნდა', 'Your post was published'), detail: tx('ნახე საუბარი', 'See the conversation') },
};
function timeLabel(value:string) {
  const date=new Date(value), minutes=Math.max(0,Math.floor((Date.now()-date.getTime())/60000));
  if(minutes<1)return tx('ახლახან', 'Just now');
  if(minutes<60)return tx(`${minutes} წთ წინ`, `${minutes} min ago`);
  if(minutes<1440)return tx(`${Math.floor(minutes/60)} სთ წინ`, `${Math.floor(minutes/60)} h ago`);
  return `${date.getDate()}.${String(date.getMonth()+1).padStart(2,'0')} · ${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`;
}
export function CommunityNotice({item,onPress,disabled}:{item:{kind:string;readAt:string|null;createdAt:string};onPress:()=>void;disabled:boolean}) {
 const c=useThemeColors(), unread=!item.readAt;
 const copy=kinds[item.kind as keyof typeof kinds]||kinds.comment, Icon=copy.icon;
 return <Pressable accessibilityRole="button" accessibilityLabel={tx(`${unread?'წაუკითხავი. ':''}${copy.title}. ${timeLabel(item.createdAt)}`, `${unread?'Unread. ':''}${copy.title}. ${timeLabel(item.createdAt)}`)} disabled={disabled} onPress={onPress} style={{flexDirection:'row',alignItems:'center',gap:12,paddingHorizontal:18,paddingVertical:15,backgroundColor:unread?c.accent100:'transparent',opacity:disabled?0.6:1}}>
   <View style={{width:44,height:44,borderRadius:22,backgroundColor:unread?c.surface:c.bg200,alignItems:'center',justifyContent:'center'}}><Icon size={21} strokeWidth={1.6} color={unread?c.primary100:c.text200}/></View>
   <View style={{flex:1,gap:3}}>
     <Text style={{fontFamily:unread?'NotoSansGeorgian_600SemiBold':'NotoSansGeorgian_400Regular',fontSize:13,lineHeight:20,color:c.text100}}>{copy.title}</Text>
     <Text style={{fontFamily:'NotoSansGeorgian_400Regular',fontSize:11,lineHeight:17,color:c.text200}}>{copy.detail}</Text>
     <Text style={{fontFamily:'NotoSansGeorgian_500Medium',fontSize:10,lineHeight:16,color:unread?c.primary100:c.text200}}>{timeLabel(item.createdAt)}</Text>
   </View>
   {unread?<View style={{width:7,height:7,borderRadius:4,backgroundColor:c.primary100}}/>:<ChevronRight size={16} color={c.text200}/>}
 </Pressable>;
}
