import React,{useEffect,useState} from 'react';
import {ActivityIndicator,Pressable,ScrollView,Text,TextInput,View} from 'react-native';
import {AtSign,Send} from 'lucide-react-native';
import {communityRequest} from '@/lib/api';
import {CommunityMention,MentionCandidate,editMentionRanges,mentionQuery} from '@/lib/communityMentions';
import {useThemeColors} from '@/theme/colors';
import {AnonymousAvatar} from './AnonymousAvatar';

export function CommunityCommentComposer({postId,value,onChangeText,onSend,busy,inputRef,replying}:{postId:string;value:string;onChangeText:(v:string)=>void;onSend:(mentions:CommunityMention[])=>void;busy:boolean;inputRef:React.RefObject<TextInput|null>;replying:boolean}){
 const c=useThemeColors();
 const [mentions,setMentions]=useState<CommunityMention[]>([]),[selection,setSelection]=useState({start:0,end:0}),[candidates,setCandidates]=useState<MentionCandidate[]>([]),[loading,setLoading]=useState(false),[error,setError]=useState(false);
 const query=selection.start===selection.end?mentionQuery(value,selection.end,mentions):null;
 useEffect(()=>{if(!value){setMentions([]);setSelection({start:0,end:0});}},[value]);
 useEffect(()=>{
  if(!query){setCandidates([]);setLoading(false);setError(false);return;}
  let active=true;setLoading(true);setError(false);
  const timer=setTimeout(()=>{void communityRequest<MentionCandidate[]>(`/posts/${postId}/participants?q=${encodeURIComponent(query.query.trim())}`).then(rows=>{if(active)setCandidates(rows);}).catch(()=>{if(active){setError(true);setCandidates([]);}}).finally(()=>{if(active)setLoading(false);});},200);
  return()=>{active=false;clearTimeout(timer);};
 },[postId,query?.query,query?.start]);
 const change=(next:string)=>{setMentions(old=>editMentionRanges(value,next,old));onChangeText(next);};
 const choose=(candidate:MentionCandidate)=>{
  if(!query||mentions.length>=10)return;
  const label='@'+candidate.label, next=value.slice(0,query.start)+label+' '+value.slice(query.end);
  if(next.length>1500)return;
  setMentions([...editMentionRanges(value,next,mentions),{targetId:candidate.targetId,kind:candidate.kind,label:candidate.label,start:query.start,end:query.start+label.length}]);
  onChangeText(next);setSelection({start:query.start+label.length+1,end:query.start+label.length+1});inputRef.current?.focus();
 };
 return <View style={{gap:6}}>
  {query&&<View style={{borderWidth:1,borderColor:c.bg300,borderRadius:14,overflow:'hidden'}}>
   <Text style={{padding:10,fontSize:11,color:c.text200,fontFamily:'NotoSansGeorgian_500Medium'}}>მონიშნე საუბრის მონაწილე</Text>
   {loading?<ActivityIndicator style={{padding:12}} color={c.primary100}/>:error?<Text style={{padding:12,color:c.text200}}>სია ვერ ჩაიტვირთა. აკრიფე სახელი ხელახლა.</Text>:candidates.length===0?<Text style={{padding:12,color:c.text200}}>მონაწილე ვერ მოიძებნა</Text>:<ScrollView keyboardShouldPersistTaps="always" style={{maxHeight:144}}>{candidates.map(item=><Pressable key={item.kind+item.targetId} accessibilityRole="button" accessibilityLabel={'მონიშნე '+item.label} disabled={mentions.length>=10} onPress={()=>choose(item)} style={{minHeight:48,paddingHorizontal:12,paddingVertical:7,flexDirection:'row',alignItems:'center',gap:10}}>{item.anonymous?<AnonymousAvatar size={28}/>:<AtSign size={22} color={c.primary100}/>}<Text style={{flex:1,fontSize:13,color:c.text100,fontFamily:'NotoSansGeorgian_500Medium'}}>{item.label}</Text></Pressable>)}</ScrollView>}
   {mentions.length>=10&&<Text style={{padding:10,color:c.text200}}>ერთ კომენტარში მაქსიმუმ 10 მონიშვნა</Text>}
  </View>}
  <View style={{flexDirection:'row',alignItems:'flex-end',gap:8}}>
   <TextInput ref={inputRef} accessibilityLabel="კომენტარი" placeholder={replying?'დაწერე პასუხი… @ მონიშვნა':'დაწერე კომენტარი… @ მონიშვნა'} placeholderTextColor={c.text200} value={value} onChangeText={change} onSelectionChange={e=>setSelection(e.nativeEvent.selection)} selection={selection} multiline maxLength={1500} style={{flex:1,minHeight:46,maxHeight:100,padding:12,borderWidth:1,borderColor:c.bg300,borderRadius:16,color:c.text100,backgroundColor:c.surface,fontFamily:'NotoSansGeorgian_400Regular',fontSize:14}}/>
   <Pressable accessibilityRole="button" accessibilityLabel={replying?'პასუხის გაგზავნა':'კომენტარის გაგზავნა'} disabled={busy||!value.trim()} onPress={()=>onSend(mentions.filter(m=>value.slice(m.start,m.end)==='@'+m.label))} style={{width:46,height:46,borderRadius:15,alignItems:'center',justifyContent:'center',backgroundColor:'#0F766E',opacity:busy||!value.trim()?0.4:1}}>{busy?<ActivityIndicator color="white"/>:<Send size={19} color="white"/>}</Pressable>
  </View>
 </View>;
}
