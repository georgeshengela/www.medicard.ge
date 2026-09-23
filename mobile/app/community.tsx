import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, BackHandler, Modal, FlatList, Image, Keyboard, KeyboardAvoidingView, Linking, Platform, Pressable, RefreshControl, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Bell, Check, ChevronRight, Feather, Heart, ImagePlus, LockKeyhole, MessageCircle, MoreHorizontal, Send, Settings2, ShieldCheck, ThumbsDown, Users, X } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@/store/AuthContext';
import { useThemeColors } from '@/theme/colors';
import { communityRequest as call } from '@/lib/api';
import { APP_MODAL_PROPS, APP_MODAL_OVERLAY } from '@/components/ui/appModal';
import { communityThreads } from '@/lib/communityThreads';
import { CommunityReactions } from '@/components/community/CommunityReactions';
import { useCommunityRealtime } from '@/lib/useCommunityRealtime';
import { useKeyboardMetrics } from '@/lib/useKeyboardHeight';
import { CommunityIdentityChoice } from '@/components/community/CommunityIdentityChoice';
import { CommunityJoinForm } from '@/components/community/CommunityJoinForm';
import { requestNotificationPermission, registerPushTokenWithServer } from '@/lib/notifications';

type Content={id:string;revision:number;body:string;author:string;anonymous:boolean;mine:boolean;status:string;createdAt:string;topic?:string;hasImage:boolean;likes:number;dislikes:number;comments:number;reaction:number;reactions:Record<string,number>;myReaction:string|null;parentId:string|null;replyTo:string|null;liked:boolean};
type Notice={id:string;postId:string;kind:string;readAt:string|null;createdAt:string};
const topics=[['all','ყველა'],['everyday','ყოველდღიურობა'],['cycle','ციკლი'],['pregnancy','ორსულობა'],['wellbeing','თავის მოვლა']];
const notices:Record<string,string>={like:'შენს პოსტზე ახალი რეაქციაა',dislike:'შენს პოსტზე განსხვავებული აზრია',comment:'შენს პოსტზე ახალი კომენტარია',approved:'შენი ჩანაწერი გამოქვეყნდა',reply:'შენს კომენტარს უპასუხეს',comment_like:'შენი კომენტარი მოიწონეს'};
const rules='ეს ქალების მხარდამჭერი სივრცეა. გაუზიარე გამოცდილება პატივისცემით. დაუშვებელია შეურაცხყოფა, მუქარა, რეკლამა, ინტიმური გამოსახულებები და სხვისი პირადი მონაცემები. გამოცდილება ექიმის რჩევას არ ცვლის. პოსტები და კომენტარები მაშინვე ქვეყნდება. დარღვევის შემთხვევაში გამოიყენე გასაჩივრება — მოდერატორს შეუძლია ჩანაწერის დამალვა და წევრის შეზღუდვა. ანონიმურ რეჟიმში წევრები შენს სახელს ვერ ხედავენ; უსაფრთხოებისა და საჩივრების განხილვისთვის სისტემა ინახავს ანგარიშთან კავშირს. ტექსტში ან ფოტოში თავად ნუ გაამჟღავნებ ვინაობას. სხვა წევრებს შეუძლიათ ეკრანის გადაღება. შენი სამედიცინო ისტორია და ციკლის ჩანაწერები აქ ავტომატურად არასოდეს ქვეყნდება.';
const dateLabel=(value:string)=>{const d=new Date(value);return d.getDate()+' '+['იან','თებ','მარ','აპრ','მაი','ივნ','ივლ','აგვ','სექ','ოქტ','ნოე','დეკ'][d.getMonth()];};
const uuid=()=> 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{const r=Math.random()*16|0;return(c==='x'?r:(r&3|8)).toString(16);});
export default function Community(){const {user}=useAuth();return <Space key={user?.id||'guest'} eligible={user?.gender==='FEMALE'} />;}
function CommunityPhoto({id}:{id:string}){
 const c=useThemeColors(),[uri,setUri]=useState(''),[failed,setFailed]=useState(false),[retry,setRetry]=useState(0);
 useEffect(()=>{let active=true;setUri('');setFailed(false);void call<{uri:string}>(`/posts/${id}/photo`).then(d=>{if(active)setUri(d.uri);}).catch(()=>{if(active)setFailed(true);});return()=>{active=false;};},[id,retry]);
 return uri?<Image accessibilityLabel="პოსტის ფოტო" source={{uri}} style={{width:'100%',aspectRatio:1.25,borderRadius:16,backgroundColor:c.bg200}} resizeMode="cover"/>:<Pressable accessibilityRole="button" accessibilityLabel="ფოტოს ხელახლა ჩატვირთვა" onPress={()=>setRetry(n=>n+1)} style={{height:160,borderRadius:16,backgroundColor:c.bg200,alignItems:'center',justifyContent:'center'}}>{failed?<Text style={{color:c.text200}}>ფოტო ვერ ჩაიტვირთა · სცადე ხელახლა</Text>:<ActivityIndicator color={c.primary100}/>}</Pressable>;
}
function Space({eligible}:{eligible:boolean}){
 const c=useThemeColors(),safe=useSafeAreaInsets(),router=useRouter(),params=useLocalSearchParams<{post?:string}>();
 const [member,setMember]=useState<{alias:string;pushEnabled:boolean}|null>(null),[ready,setReady]=useState(false),[page,setPage]=useState('feed');
 const [reply,setReply]=useState<Content|null>(null);
 const commentInput=useRef<TextInput>(null),detailScroll=useRef<ScrollView>(null),selectedId=useRef<string|null>(null);
 const {height:keyboardHeight}=useKeyboardMetrics();
 const [editing,setEditing]=useState<Content|null>(null);
 const [posts,setPosts]=useState<Content[]>([]),[comments,setComments]=useState<Content[]>([]),[selected,setSelected]=useState<Content|null>(null);
 const [topic,setTopic]=useState('all'),[mine,setMine]=useState(false),[next,setNext]=useState<string|null>(null),[commentNext,setCommentNext]=useState<string|null>(null);
 const [notifications,setNotifications]=useState<Notice[]>([]),[blocks,setBlocks]=useState<{id:string;createdAt:string}[]>([]);
 const [alias,setAlias]=useState(''),[accepted,setAccepted]=useState(false),[body,setBody]=useState(''),[anonymous,setAnonymous]=useState(false),[draftTopic,setDraftTopic]=useState('everyday'),[photo,setPhoto]=useState<{uri:string;base64:string}|null>(null);
 const [error,setError]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(false);
 const draftId=useRef(uuid()),live=useRef(true),feedGen=useRef(0),lock=useRef(false),feedCount=useRef(20);
 useEffect(()=>{live.current=true;return()=>{live.current=false;};},[]);
 const [dialog,setDialog]=useState<{title:string;message:string;actions:{text:string;style?:string;onPress?:()=>void}[]}|null>(null);
 const showDialog=(title:string,message:string,actions:{text:string;style?:string;onPress?:()=>void}[])=>setDialog({title,message,actions});
 const text=(value:string,size=14,color=c.text100)=> <Text style={{fontFamily:size>=17?'NotoSansGeorgian_600SemiBold':'NotoSansGeorgian_400Regular',fontSize:size,lineHeight:size*1.55,color}}>{value}</Text>;
 const button=(label:string,action:()=>void,Icon?:any,primary=false,disabled=false)=> <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled||busy} onPress={action} style={{minHeight:46,paddingHorizontal:14,paddingVertical:10,borderRadius:16,flexDirection:'row',gap:8,alignItems:'center',justifyContent:'center',backgroundColor:primary?'#0F766E':c.bg200,opacity:disabled||busy?0.5:1}}>{Icon&&<Icon size={19} color={primary?'white':c.primary100}/>}<Text style={{fontFamily:'NotoSansGeorgian_600SemiBold',fontSize:13,color:primary?'white':c.text100}}>{label}</Text></Pressable>;
 const run=async(fn:()=>Promise<void>)=>{if(lock.current)return;lock.current=true;setBusy(true);setError('');try{await fn();}catch(e){if(live.current)setError(e instanceof Error?e.message:'ვერ შესრულდა. სცადე ხელახლა.');}finally{lock.current=false;if(live.current)setBusy(false);}};
 feedCount.current=Math.max(20,posts.length);
 const loadFeed=useCallback(async(more=false,silent=false)=>{
  const gen=++feedGen.current;if(!silent)setLoading(true);
  try{const result=await call<{posts:Content[];next:string|null}>(`/posts?topic=${topic}&mine=${mine}&limit=${silent?Math.min(feedCount.current,100):20}${more&&next?'&before='+encodeURIComponent(next):''}`);if(live.current&&gen===feedGen.current){setPosts(p=>more?[...p,...result.posts.filter(x=>!p.some(y=>y.id===x.id))]:result.posts);setNext(result.next);}}
  catch(e){if(live.current){setError((e as Error).message);if([401,403].includes((e as {status:number}).status)){setPosts([]);setComments([]);setSelected(null);setMember(null);setReady(false);}}}finally{if(live.current&&gen===feedGen.current)setLoading(false);}
 },[topic,mine,next]);
 const inbox=async()=>{const data=await call<Notice[]>('/notifications');if(live.current)setNotifications(data);};
 const openPost=async(postId:string)=>{const [p,list]=await Promise.all([call<Content>('/posts/'+postId),call<{comments:Content[];next:string|null}>('/posts/'+postId+'/comments?limit='+Math.min(100,Math.max(30,comments.length)))]);if(!live.current)return;setReply(null);setEditing(null);setSelected(p);setPosts(rows=>rows.map(row=>row.id===p.id?p:row));setComments(list.comments);setCommentNext(list.next);setPage('detail');setBody('');setAnonymous(p.mine&&p.anonymous);draftId.current=uuid();};
 useEffect(()=>{if(!eligible){setReady(true);return;}void run(async()=>{const data=await call<{member:typeof member}>('/membership');if(!live.current)return;setMember(data.member);setReady(true);});},[]);
 useEffect(()=>{if(!member)return;void loadFeed();void inbox().catch(()=>{});},[member,topic,mine]);
 useEffect(()=>{if(member&&params.post)void run(()=>openPost(params.post!));},[!!member,params.post]);
 selectedId.current=selected?.id||null;
 const connected=useCommunityRealtime(!!member,async()=>{
  await Promise.all([loadFeed(false,true),inbox()]);
  const postId=selectedId.current;
  if(postId)try{
   const [post,list]=await Promise.all([call<Content>('/posts/'+postId),call<{comments:Content[];next:string|null}>('/posts/'+postId+'/comments?limit='+Math.min(100,Math.max(30,comments.length)))]);
   if(live.current&&selectedId.current===postId){setSelected(post);setComments(list.comments);setCommentNext(list.next);}
  }catch(e){if(live.current&&selectedId.current===postId&&(e as {status?:number}).status===404){setSelected(null);setComments([]);setPage('feed');setMessage('ჩანაწერი აღარ არის ხელმისაწვდომი.');}}
 });
 const choosePhoto=()=>void run(async()=>{
  const picked=await ImagePicker.launchImageLibraryAsync({mediaTypes:['images'],quality:0.85});if(picked.canceled)return;
  const asset=picked.assets[0],width=Math.min(asset.width||1200,1200);
  const out=await ImageManipulator.manipulateAsync(asset.uri,[{resize:{width}}],{compress:0.78,format:ImageManipulator.SaveFormat.JPEG,base64:true});
  if(!out.base64||out.base64.length>1500000)throw new Error('ფოტო ძალიან დიდია. აირჩიე უფრო პატარა ფოტო.');setPhoto({uri:out.uri,base64:out.base64});
 });
 const compose=()=>{setReply(null);setEditing(null);setBody('');setPhoto(null);setAnonymous(false);draftId.current=uuid();setPage('compose');setMessage('');};
 const submit=()=>void run(async()=>{if(editing)await call('/posts/'+editing.id,'PATCH',{body,topic:draftTopic,image:photo?.base64||null});else await call('/posts','POST',{body,topic:draftTopic,anonymous,requestId:draftId.current,image:photo?.base64||null});setEditing(null);setPage('feed');setBody('');setPhoto(null);setMessage(editing?.status==='HIDDEN'?'ცვლილებები შენახულია. ჩანაწერი კვლავ დამალულია.':'შენი პოსტი გამოქვეყნდა.');await loadFeed();void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(()=>{});});
 const action=async(item:Content,kind:string,what:string,reason?:string)=>{await call(`/${kind}/${item.id}/${what}`,'POST',reason?{reason}:{});if(what==='block'){setPage('feed');await loadFeed();}setMessage(what==='report'?'საჩივარი მიღებულია. მოდერატორი განიხილავს.':'წევრი დაბლოკილია. მის ჩანაწერებს აღარ ნახავ.');};
 const report=(item:Content,kind:string)=>showDialog('შეტყობინება მოდერატორს','აირჩიე მიზეზი',[{text:'შევიწროება',onPress:()=>void run(()=>action(item,kind,'report','harassment'))},{text:'პირადი მონაცემები',onPress:()=>void run(()=>action(item,kind,'report','privacy'))},{text:'სხვა დარღვევა',onPress:()=>void run(()=>action(item,kind,'report','other'))},{text:'გაუქმება',style:'cancel'}]);
 const menu=(item:Content,kind='posts')=>showDialog('ჩანაწერის მართვა',item.anonymous?'ავტორის ვინაობა სხვა წევრებისთვის დაფარულია.':item.author,item.mine?[...(kind==='posts'?[{text:'რედაქტირება',onPress:()=>void run(async()=>{let image=null;if(item.hasImage){const result=await call<{uri:string}>(`/posts/${item.id}/photo`);image={uri:result.uri,base64:result.uri.split(',')[1]};}setEditing(item);setBody(item.body);setDraftTopic(item.topic||'everyday');setAnonymous(item.anonymous);setPhoto(image);setPage('compose');})}]:[]),{text:'წაშლა',style:'destructive',onPress:()=>showDialog('წაიშალოს ჩანაწერი?','ეს მოქმედება შეუქცევადია.',[{text:'გაუქმება',style:'cancel'},{text:'წაშლა',style:'destructive',onPress:()=>void run(async()=>{await call(`/${kind}/${item.id}`,'DELETE');if(kind==='posts'){setPage('feed');await loadFeed();}else if(selected)await openPost(selected.id);})}])},{text:'გაუქმება',style:'cancel'}]:[{text:'გასაჩივრება',onPress:()=>report(item,kind)},{text:'ავტორის დაბლოკვა',style:'destructive',onPress:()=>void run(()=>action(item,kind,'block'))},{text:'გაუქმება',style:'cancel'}]);
 const avatar=(anon:boolean,alias='')=> <View style={{width:40,height:40,borderRadius:15,backgroundColor:c.accent100,alignItems:'center',justifyContent:'center'}}>{anon?<LockKeyhole size={18} color={c.primary100}/>:text((alias||'მ').slice(0,1).toUpperCase(),17,c.primary100)}</View>;
 const card=(item:Content,detail=false)=> <View style={{backgroundColor:c.surface,borderRadius:24,padding:18,gap:16,borderWidth:1,borderColor:c.bg300}}>
  <View style={{flexDirection:'row',gap:10,alignItems:'center'}}>{avatar(item.anonymous,item.author)}<View style={{flex:1}}>{text(item.author,14)}{text(dateLabel(item.createdAt)+(item.mine?' · შენი ჩანაწერი':''),11,c.text200)}</View><Pressable accessibilityRole="button" accessibilityLabel="პოსტის მართვა" onPress={()=>menu(item)} style={{padding:10}}><MoreHorizontal size={22} color={c.text200}/></Pressable></View>
  {item.topic&&<View style={{alignSelf:'flex-start',flexDirection:'row',alignItems:'center',gap:6,paddingHorizontal:10,paddingVertical:5,borderRadius:9,backgroundColor:c.accent100}}><View style={{width:5,height:5,borderRadius:3,backgroundColor:c.primary100}}/>{text(topics.find(t=>t[0]===item.topic)?.[1]||'',11,c.primary100)}</View>}
  <Pressable accessibilityRole="button" onPress={()=>void run(()=>openPost(item.id))}><Text numberOfLines={detail?undefined:7} style={{fontFamily:'NotoSansGeorgian_400Regular',fontSize:15,lineHeight:25,color:c.text100}}>{item.body}</Text></Pressable>
  {item.hasImage&&<CommunityPhoto key={item.id+':'+item.revision} id={item.id}/>}
  {item.status!=='PUBLISHED'?<View style={{flexDirection:'row',gap:8,alignItems:'center'}}><ShieldCheck size={16} color={c.primary100}/>{text(item.status==='PENDING'?'მოწმდება მოდერატორის მიერ':'დამალულია მოდერაციის მიერ',12,c.text200)}</View>:<CommunityReactions
    counts={item.reactions||{}} selected={item.myReaction} comments={item.comments} disabled={busy}
    onReact={emoji=>void run(async()=>{await call(`/posts/${item.id}/reaction`,'PUT',{emoji});await loadFeed(false,true);if(selected?.id===item.id)setSelected(await call('/posts/'+item.id));})}
    onComment={()=>{if(detail){commentInput.current?.focus();}else void run(()=>openPost(item.id));}}
  />}

 </View>;
 const inputStyle={backgroundColor:c.surface,color:c.text100,borderColor:c.bg300,borderWidth:1,borderRadius:18,padding:16,fontFamily:'NotoSansGeorgian_400Regular',fontSize:15};
 const anonymity=<CommunityIdentityChoice anonymous={anonymous} alias={member?.alias||''} locked={!!editing||(page==='detail'&&!!selected?.mine&&selected.anonymous)} onChange={setAnonymous}/>;
 const back=()=>{setError('');if(page==='feed')router.back();else if((page==='compose'&&(body.trim()||photo))||(page==='detail'&&body.trim()))showDialog('გამოსვლა?','შეუნახავი ტექსტი დაიკარგება.',[{text:'გაგრძელება',style:'cancel'},{text:'გამოსვლა',onPress:()=>{setEditing(null);setPage('feed');setBody('');setPhoto(null);}}]);else{setPage('feed');setBody('');}};
 useEffect(()=>{const listener=BackHandler.addEventListener('hardwareBackPress',()=>{if(dialog){setDialog(null);return true;}if(page!=='feed'){back();return true;}return false;});return()=>listener.remove();},[page,body,photo,dialog]);
 return <KeyboardAvoidingView enabled={!!member} style={{flex:1,width:'100%',maxWidth:760,alignSelf:'center',backgroundColor:c.bg100,paddingTop:safe.top}} behavior={Platform.OS==='ios'?'padding':'height'}>
  <View style={{paddingHorizontal:16,paddingVertical:12,flexDirection:'row',alignItems:'center',gap:10}}><Pressable accessibilityRole="button" accessibilityLabel="უკან" onPress={back} style={{padding:10}}><ArrowLeft color={c.text100} size={23}/></Pressable><View style={{flex:1}}>{text(page==='compose'?(editing?'პოსტის რედაქტირება':'ახალი პოსტი'):page==='inbox'?'შეტყობინებები':page==='settings'?'შენი სივრცე':'ქალების სივრცე',19)}{text(member?(connected?'● განახლდება ავტომატურად':'კავშირი აღდგება ავტომატურად'):'ერთად, ერთმანეთისთვის',11,c.text200)}</View>{member&&page!=='compose'&&!(page==='detail'&&body.trim())&&<><Pressable accessibilityRole="button" accessibilityLabel="შეტყობინებები" onPress={()=>void run(async()=>{await inbox();setPage('inbox');})} style={{padding:10}}><Bell size={22} color={c.primary100}/>{notifications.some(n=>!n.readAt)&&<View style={{position:'absolute',right:8,top:6,width:7,height:7,borderRadius:4,backgroundColor:c.danger}}/>}</Pressable><Pressable accessibilityRole="button" accessibilityLabel="სივრცის პარამეტრები" onPress={()=>void run(async()=>{setBlocks(await call('/blocks'));setAlias(member.alias);setPage('settings');})} style={{padding:10}}><Settings2 size={22} color={c.text200}/></Pressable></>}</View>
  {!!error&&<View accessibilityRole="alert" style={{padding:14,backgroundColor:c.dangerBg}}>{text(error,13,c.danger)}{button('ხელახლა ცდა',()=>{setError('');if(member)void loadFeed();else void run(async()=>{const d=await call('/membership');setMember(d.member);setReady(true);});})}</View>}
  {!!message&&<Pressable accessibilityRole="button" onPress={()=>setMessage('')} style={{padding:12,backgroundColor:c.accent100}}>{text(message,12,c.primary100)}</Pressable>}
  {!eligible?<View style={{padding:24}}>{text('ეს სივრცე ხელმისაწვდომია ქალის პროფილის მქონე ანგარიშებისთვის.')}</View>:!ready?(error?null:<ActivityIndicator style={{marginTop:40}} color={c.primary100}/>):!member?<CommunityJoinForm
    alias={alias} onAliasChange={setAlias} accepted={accepted} onAcceptedChange={setAccepted}
    rules={rules} busy={busy}
    onJoin={()=>void run(async()=>{await call('/membership','POST',{alias:alias.trim(),rulesVersion:'2026-09-23'});setMember({alias:alias.trim(),pushEnabled:true});})}
  />:
  page==='feed'?<FlatList data={posts} keyExtractor={p=>p.id} renderItem={({item})=>card(item)} ItemSeparatorComponent={()=> <View style={{height:14}}/>} contentContainerStyle={{padding:16,paddingBottom:safe.bottom+24}} refreshControl={<RefreshControl refreshing={loading} onRefresh={()=>void loadFeed()} tintColor={c.primary100}/>}
   ListHeaderComponent={<View style={{gap:20,marginBottom:18}}>
    <View style={{backgroundColor:c.surface,padding:14,borderRadius:24,borderWidth:1,borderColor:c.bg300,gap:12,overflow:'hidden'}}>
     <Pressable accessibilityRole="button" accessibilityLabel="რას გაუზიარებ დღეს?" onPress={compose} style={{padding:14,borderRadius:18,backgroundColor:c.bg100,borderWidth:1,borderColor:c.bg300,flexDirection:'row',alignItems:'center',gap:12}}>
      <View style={{width:36,height:36,borderRadius:13,backgroundColor:c.accent100,alignItems:'center',justifyContent:'center'}}>{text((member.alias||'შ').slice(0,1).toUpperCase(),17,c.primary100)}</View>
      <View style={{flex:1}}>{text('რას გაუზიარებ დღეს?',14)}{text('მეტსახელით ან ანონიმურად',11,c.text200)}</View><ChevronRight size={19} color={c.primary100}/>
     </Pressable>
     <View style={{flexDirection:'row',gap:10}}><View style={{flex:1}}>{button('პოსტი',compose,Feather,true)}</View><View style={{flex:1}}>{button('ფოტო',()=>{compose();choosePhoto();},ImagePlus)}</View></View>
    </View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:8}}>{topics.map(([key,label],index)=><View key={key}>{button(label,()=>setTopic(key),[Users,MessageCircle,Heart,Feather,ShieldCheck][index],topic===key)}</View>)}</ScrollView>
    <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center'}}><View>{text(mine?'შენი ჩანაწერები':'სივრცის ამბები',18)}{text(mine?'შენი გამოცდილება, შენი ხმა':'საუბარი, რომელიც გვაერთიანებს',11,c.text200)}</View>{button(mine?'ყველას პოსტები':'ჩემი პოსტები',()=>setMine(!mine))}</View>
   </View>}

   ListEmptyComponent={!loading?<View style={{alignItems:'center',padding:28,gap:12}}><MessageCircle size={32} color={c.primary100}/>{text('პირველ საუბარს შენ დაიწყებ?',17)}{text('აქ გამოჩნდება გამოქვეყნებული პოსტები და შენი ჩანაწერები.',13,c.text200)}</View>:null}
   ListFooterComponent={next?button('მეტის ნახვა',()=>void loadFeed(true),ChevronRight,false,loading):null}/>:
  page==='compose'?<View style={{flex:1}}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{padding:18,gap:16,paddingBottom:safe.bottom+20}}>{anonymity}<TextInput accessibilityLabel="პოსტის ტექსტი" value={body} onChangeText={setBody} multiline maxLength={3000} placeholder="რისი გაზიარება გინდა?" placeholderTextColor={c.text200} style={[inputStyle,{minHeight:180,textAlignVertical:'top'}]}/>{text(`${body.length}/3000`,11,c.text200)}<ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:8}}>{topics.slice(1).map(([key,label])=><View key={key}>{button(label,()=>setDraftTopic(key),undefined,draftTopic===key)}</View>)}</ScrollView>{photo?<View><Image source={{uri:photo.uri}} style={{width:'100%',height:210,borderRadius:20}}/>{button('ფოტოს მოშორება',()=>setPhoto(null),X)}</View>:button('ფოტოს დამატება',choosePhoto,ImagePlus)}{text('პოსტი მაშინვე გამოჩნდება სივრცეში. ფოტოდან მდებარეობის ინფორმაცია ავტომატურად იშლება.',12,c.text200)}</ScrollView><View style={{paddingHorizontal:18,paddingTop:10,paddingBottom:Math.max(safe.bottom,12),borderTopWidth:1,borderColor:c.bg300,backgroundColor:c.surface}}>{button(editing?'ცვლილებების შენახვა':'გამოქვეყნება',submit,Send,true,!body.trim())}</View></View>:
  page==='detail'&&selected?<View style={{flex:1}}>
   <ScrollView ref={detailScroll} keyboardShouldPersistTaps="handled" keyboardDismissMode={Platform.OS==='ios'?'interactive':'on-drag'} contentContainerStyle={{padding:16,gap:18,paddingBottom:20}}>
    {card(selected,true)}
    <View style={{flexDirection:'row',alignItems:'center',gap:8}}><MessageCircle size={19} color={c.primary100}/>{text('საუბარი · '+selected.comments,18)}</View>
    {communityThreads(comments).map(({item,depth})=><View key={item.id} style={{marginLeft:depth*12,borderLeftWidth:item.parentId?2:0,borderLeftColor:c.bg300,paddingLeft:item.parentId?12:0,gap:8}}>
     {item.parentId&&text('↳ პასუხი: '+(item.replyTo||'კომენტარი აღარ ჩანს'),11,c.text200)}
     <View style={{flexDirection:'row',gap:10,alignItems:'flex-start'}}>{avatar(item.anonymous,item.author)}<View style={{flex:1,gap:5}}>
      <View style={{backgroundColor:c.surface,borderWidth:1,borderColor:c.bg300,padding:13,borderRadius:18,gap:6}}>
       <View style={{flexDirection:'row',alignItems:'center'}}><View style={{flex:1}}>{text(item.author,13)}</View><Pressable accessibilityRole="button" accessibilityLabel="კომენტარის მართვა" onPress={()=>menu(item,'comments')} style={{padding:6}}><MoreHorizontal color={c.text200} size={19}/></Pressable></View>
       {text(item.body,14)}
       {item.status!=='PUBLISHED'&&text('არ არის გამოქვეყნებული',11,c.text200)}
      </View>
      <View style={{flexDirection:'row',alignItems:'center',gap:14}}>{text(dateLabel(item.createdAt),10,c.text200)}
       <Pressable accessibilityRole="button" accessibilityLabel={item.liked?'კომენტარის მოწონების გაუქმება':'კომენტარის მოწონება'} disabled={busy||item.status!=='PUBLISHED'} onPress={()=>void run(async()=>{await call(`/comments/${item.id}/like`,'PUT',{liked:!item.liked});setComments(rows=>rows.map(row=>row.id===item.id?{...row,liked:!item.liked,likes:Math.max(0,row.likes+(item.liked?-1:1))}:row));})} style={{minHeight:40,flexDirection:'row',gap:5,alignItems:'center'}}><Heart size={16} fill={item.liked?c.primary100:'transparent'} color={item.liked?c.primary100:c.text200}/>{text(String(item.likes),11,c.text200)}</Pressable>
       <Pressable accessibilityRole="button" accessibilityLabel={'პასუხი: '+item.author} disabled={item.status!=='PUBLISHED'} onPress={()=>{setReply(item);commentInput.current?.focus();}} style={{minHeight:40,justifyContent:'center'}}>{text('უპასუხე',12,c.primary100)}</Pressable>
      </View>
     </View></View>
    </View>)}
    {commentNext&&button('წინა კომენტარები',()=>void run(async()=>{const d=await call(`/posts/${selected.id}/comments?before=${encodeURIComponent(commentNext)}`);setComments(p=>[...p,...d.comments]);setCommentNext(d.next);}))}
    {comments.length===0&&<View style={{alignItems:'center',padding:20,gap:10}}><MessageCircle size={28} color={c.primary100}/>{text('შენი სიტყვებით დაიწყე საუბარი',16)}{text('გაუზიარე გამოცდილება ან დაუსვი კითხვა.',12,c.text200)}</View>}
   </ScrollView>
   {selected.status==='PUBLISHED'&&<View style={{paddingHorizontal:16,paddingTop:10,paddingBottom:keyboardHeight>24?12:Math.max(safe.bottom,12),borderTopWidth:1,borderColor:c.bg300,backgroundColor:c.surface,gap:8}}>
    {reply&&<View style={{flexDirection:'row',alignItems:'center',gap:10,padding:9,borderRadius:12,backgroundColor:c.bg200}}><View style={{flex:1}}>{text('პასუხობ: '+reply.author,11,c.primary100)}<Text numberOfLines={1} style={{fontFamily:'NotoSansGeorgian_400Regular',fontSize:11,color:c.text200}}>{reply.body}</Text></View><Pressable accessibilityRole="button" accessibilityLabel="პასუხის გაუქმება" onPress={()=>setReply(null)} style={{padding:8}}><X size={18} color={c.text200}/></Pressable></View>}
    <Pressable accessibilityRole="button" accessibilityLabel="კომენტარის ვინაობის არჩევა" onPress={()=>{if(selected.mine&&selected.anonymous)return;Keyboard.dismiss();showDialog('როგორ გამოჩნდები?','აირჩიე კომენტარის გამოქვეყნების რეჟიმი',[{text:member.alias+' · მეტსახელით',onPress:()=>setAnonymous(false)},{text:'ანონიმურად',onPress:()=>setAnonymous(true)},{text:'გაუქმება'}]);}} style={{flexDirection:'row',alignItems:'center',gap:6,minHeight:32}}>{anonymous?<LockKeyhole size={13} color={c.primary100}/>:<Users size={13} color={c.primary100}/>}{text(anonymous?'კომენტარი ანონიმურად':member.alias+' · მეტსახელით',11,c.primary100)}</Pressable>
    <View style={{flexDirection:'row',alignItems:'flex-end',gap:10}}><TextInput ref={commentInput} accessibilityLabel="კომენტარი" placeholder={reply?'დაწერე პასუხი…':'შემოუერთდი საუბარს…'} placeholderTextColor={c.text200} value={body} onChangeText={setBody} multiline maxLength={1500} style={[inputStyle,{flex:1,minHeight:48,maxHeight:120,paddingVertical:12}]}/><Pressable accessibilityRole="button" accessibilityLabel={reply?'პასუხის გაგზავნა':'კომენტარის გაგზავნა'} disabled={busy||!body.trim()} onPress={()=>void run(async()=>{await call(`/posts/${selected.id}/comments`,'POST',{body,anonymous,parentId:reply?.id||null,requestId:draftId.current});await openPost(selected.id);})} style={{width:48,height:48,borderRadius:16,backgroundColor:'#0F766E',alignItems:'center',justifyContent:'center',opacity:busy||!body.trim()?0.4:1}}>{busy?<ActivityIndicator color="white"/>:<Send size={20} color="white"/>}</Pressable></View>
   </View>}
  </View>:
  page==='inbox'?<FlatList data={notifications} keyExtractor={n=>n.id} contentContainerStyle={{padding:16,gap:10,paddingBottom:safe.bottom+20}} ListEmptyComponent={<View style={{padding:30,gap:12,alignItems:'center'}}><Bell color={c.primary100} size={34}/>{text('შეტყობინებები აქ დაგხვდება',17)}{text('როცა შენს პოსტს გამოეხმაურებიან, შეგატყობინებთ.',13,c.text200)}</View>} renderItem={({item})=><Pressable accessibilityRole="button" onPress={()=>void run(async()=>{await call(`/notifications/${item.id}/read`,'PUT');await inbox();await openPost(item.postId);})} style={{padding:18,borderRadius:20,backgroundColor:item.readAt?c.surface:c.accent100,gap:8}}>{text(notices[item.kind]||'ახალი აქტივობა',14)}{text(dateLabel(item.createdAt)+' · '+new Date(item.createdAt).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}),11,c.text200)}</Pressable>}/>:
  <ScrollView contentContainerStyle={{padding:20,gap:20,paddingBottom:safe.bottom+20}}>{text('შენი საჯარო მეტსახელი',18)}<TextInput accessibilityLabel="საჯარო მეტსახელის შეცვლა" value={alias} onChangeText={setAlias} maxLength={40} style={inputStyle}/>{button('მეტსახელის შენახვა',()=>void run(async()=>{await call('/membership','POST',{alias,rulesVersion:'2026-09-23'});setMember({...member,alias});setMessage('მეტსახელი შენახულია.');}),Check,false,alias.trim().length<2)}<View style={{flexDirection:'row',alignItems:'center',gap:12}}><Bell color={c.primary100} size={22}/><View style={{flex:1}}>{text('პუშ-შეტყობინებები')}{text('შიგნით შეტყობინებები მაინც შეინახება.',11,c.text200)}</View><Switch accessibilityLabel="სივრცის პუშ შეტყობინებები" value={member.pushEnabled} onValueChange={value=>void run(async()=>{await call('/preferences','PATCH',{pushEnabled:value});setMember({...member,pushEnabled:value});})}/></View>{button('ტელეფონზე შეტყობინებების ჩართვა',()=>{const permission=requestNotificationPermission();void run(async()=>{const enabled=await permission;if(enabled)await registerPushTokenWithServer({skipPermissionProbe:true});setMessage(enabled?'შეტყობინებების ნებართვა ჩართულია.':'ნებართვა არ არის ჩართული. გადაამოწმე ტელეფონის პარამეტრები.');});},Bell)}{text('ანონიმურობა და წესები',18)}{text(rules,13,c.text200)}{button('support@medicard.ge',()=>void Linking.openURL('mailto:support@medicard.ge'))}{text('დაბლოკილი წევრები',18)}{blocks.length===0&&text('დაბლოკილი წევრები არ გყავს.',13,c.text200)}{blocks.map((b,i)=><View key={b.id} style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center'}}>{text('დაბლოკილი წევრი '+(i+1))}{button('განბლოკვა',()=>void run(async()=>{await call('/blocks/'+b.id,'DELETE');setBlocks(await call('/blocks'));await loadFeed();}))}</View>)}</ScrollView>}
  <Modal visible={!!dialog} {...APP_MODAL_PROPS} onRequestClose={()=>setDialog(null)}><View style={{flex:1,justifyContent:'flex-end'}}><Pressable accessibilityRole="button" accessibilityLabel="დახურვა" onPress={()=>setDialog(null)} style={{position:'absolute',inset:0,backgroundColor:APP_MODAL_OVERLAY}}/><View accessibilityViewIsModal style={{backgroundColor:c.surface,borderTopLeftRadius:28,borderTopRightRadius:28,padding:22,paddingBottom:safe.bottom+22,gap:14,width:'100%',maxWidth:760,alignSelf:'center'}}>{text(dialog?.title||'',19)}{text(dialog?.message||'',13,c.text200)}{dialog?.actions.map((a,i)=><Pressable key={i} accessibilityRole="button" onPress={()=>{setDialog(null);a.onPress?.();}} style={{minHeight:48,padding:14,borderRadius:14,backgroundColor:c.bg200}}>{text(a.text,14,a.style==='destructive'?c.danger:c.text100)}</Pressable>)}</View></View></Modal>
  {busy&&<View pointerEvents="none" style={{position:'absolute',top:safe.top+64,right:20,backgroundColor:c.surface,padding:8,borderRadius:20}}><ActivityIndicator color={c.primary100}/></View>}
 </KeyboardAvoidingView>;
}
