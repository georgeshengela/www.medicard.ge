import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Check, ChevronRight, Heart, MessageCircle, Reply, ThumbsDown } from 'lucide-react-native';
import { COMMUNITY_CTA as COMMUNITY_DOT, useCommunityColors as useThemeColors } from '@/components/community/communityPalette';
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
const tone: Record<string, string> = { like: '#E11D48', comment_like: '#E11D48', comment: '#7C3AED', reply: '#7C3AED', mention: '#0EA5E9', approved: '#059669', dislike: '#64748B' };
function shortTime(value:string){
  const min=Math.max(0,Math.floor((Date.now()-new Date(value).getTime())/60000));
  if(min<1)return tx('ახლახან', 'now');if(min<60)return tx(`${min} წთ`, `${min}m`);if(min<1440)return tx(`${Math.floor(min/60)} სთ`, `${Math.floor(min/60)}h`);if(min<10080)return tx(`${Math.floor(min/1440)} დღე`, `${Math.floor(min/1440)}d`);
  return timeLabel(value);
}
/** One activity row (Instagram style): tinted icon, the line in bold while unread, time after it, a dot. */
export function CommunityNotice({item,onPress,disabled}:{item:{kind:string;readAt:string|null;createdAt:string};onPress:()=>void;disabled:boolean}) {
 const c=useThemeColors(), unread=!item.readAt;
 const copy=kinds[item.kind as keyof typeof kinds]||kinds.comment, Icon=copy.icon, ink=tone[item.kind]||c.primary100;
 return <Pressable accessibilityRole="button" accessibilityLabel={tx(`${unread?'წაუკითხავი. ':''}${copy.title}. ${timeLabel(item.createdAt)}`, `${unread?'Unread. ':''}${copy.title}. ${timeLabel(item.createdAt)}`)} disabled={disabled} onPress={onPress} style={{flexDirection:'row',alignItems:'center',gap:12,paddingHorizontal:16,paddingVertical:10,opacity:disabled?0.6:1}}>
   <View style={{width:44,height:44,borderRadius:22,backgroundColor:ink+'1A',alignItems:'center',justifyContent:'center'}}><Icon size={20} strokeWidth={1.8} color={ink} fill={item.kind==='like'||item.kind==='comment_like'?ink:'transparent'}/></View>
   <View style={{flex:1,minWidth:0}}>
     <Text numberOfLines={2} style={{fontFamily:unread?'NotoSansGeorgian_600SemiBold':'NotoSansGeorgian_400Regular',fontSize:13.5,lineHeight:20,color:c.text100}}>{copy.title}<Text style={{fontFamily:'NotoSansGeorgian_400Regular',color:c.text200}}>{'  '+shortTime(item.createdAt)}</Text></Text>
     <Text numberOfLines={1} style={{fontFamily:'NotoSansGeorgian_400Regular',fontSize:12,lineHeight:18,color:c.text200}}>{copy.detail}</Text>
   </View>
   {unread?<View style={{width:8,height:8,borderRadius:4,backgroundColor:COMMUNITY_DOT}}/>:<ChevronRight size={16} color={c.text300}/>}
 </Pressable>;
}
