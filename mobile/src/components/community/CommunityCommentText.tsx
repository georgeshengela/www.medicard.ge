import React from 'react';
import {Text} from 'react-native';
import {CommunityMention} from '@/lib/communityMentions';
import {useThemeColors} from '@/theme/colors';
export function CommunityCommentText({body,mentions=[],onMention}:{body:string;mentions?:CommunityMention[];onMention:(m:CommunityMention)=>void}){
 const c=useThemeColors(),parts:React.ReactNode[]=[];let end=0;
 for(const mention of [...mentions].sort((a,b)=>a.start-b.start)){
  if(mention.start<end||body.slice(mention.start,mention.end)!=='@'+mention.label)continue;
  parts.push(body.slice(end,mention.start));
  parts.push(<Text key={mention.start} accessibilityRole="button" accessibilityLabel={mention.label} onPress={()=>onMention(mention)} style={{color:c.primary100,fontFamily:'NotoSansGeorgian_600SemiBold'}}>{body.slice(mention.start,mention.end)}</Text>);end=mention.end;
 }
 parts.push(body.slice(end));
 return <Text style={{fontFamily:'NotoSansGeorgian_400Regular',fontSize:14,lineHeight:22,color:c.text100}}>{parts}</Text>;
}
