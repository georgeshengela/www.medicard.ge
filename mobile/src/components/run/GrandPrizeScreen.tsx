import React,{useCallback,useState} from 'react';
import {Image,Linking,Pressable,RefreshControl,ScrollView,View} from 'react-native';
import Svg,{Circle} from 'react-native-svg';
import {useRouter} from 'expo-router';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {CalendarClock,Check,ExternalLink,FileText,Footprints,Hourglass,Lock,RotateCw,Sparkles} from 'lucide-react-native';
import {Bone} from '@/components/ui/Skeleton';
import {useIsDark,useThemeColors} from '@/theme/colors';
import {HUB,hubInk,hubTint} from '@/theme/hub';
import {cityOf,dropLabel,goalStreetKm,grandArea,grandCountdown,grandPercent,grandProgress,levelPercent,safeRulesUrl,streetsLeftLabel,type GrandPrize} from '@/lib/medipulsi/grand';
import {tx} from '@/i18n/locale';
import {Action,Card,Copy,RUN_TEAL,Section} from './PulseUi';
import {ModuleHeader} from '@/components/brand/ModuleHeader';
import {RUN_GIFT} from './runArt';
import {eligibleLabel,isGrandMissing,useGrandPrize} from './GrandPrizeCard';

const MINT='#99F6E4',SOFT='#C5DADA';

export default function GrandPrizeScreen(){
 const router=useRouter(),c=useThemeColors(),insets=useSafeAreaInsets();
 const query=useGrandPrize(),data=query.data,refetch=query.refetch;
 const [refreshing,setRefreshing]=useState(false);
 const refresh=useCallback(()=>{setRefreshing(true);void refetch().finally(()=>setRefreshing(false));},[refetch]);
 const leave=()=>router.canGoBack()?router.back():router.replace('/run' as never);
 const missing=!data&&isGrandMissing(query.error),failed=!data&&query.isError&&!missing;

 return <View style={{flex:1,backgroundColor:c.bg100}}>
  <ScrollView showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={c.primary200} colors={[RUN_TEAL]} progressBackgroundColor={c.surface}/>} contentContainerStyle={{paddingTop:insets.top+12,paddingBottom:insets.bottom+32,paddingHorizontal:HUB.gutter,gap:HUB.sectionGap}}>
   <ModuleHeader module="run" subtitle={tx('დიდი საჩუქარი','Grand prize')} onBack={leave}/>

   {data?<>
    <Hero data={data}/>
    <Progress data={data}/>
    <HowTo data={data}/>
    {data.levels.length?<Levels data={data}/>:null}
    <Footer rulesUrl={data.campaign.rulesUrl}/>
   </>:missing||failed?<Card style={{alignItems:'center',gap:12,paddingVertical:28}}>
    <Image source={RUN_GIFT} accessibilityIgnoresInvertColors resizeMode="contain" style={{width:96,height:96}}/>
    <Copy bold size={17} style={{textAlign:'center'}}>{missing?tx('დიდი საჩუქარი მალე გამოჩნდება','The grand prize is almost here'):tx('ინფორმაცია ვერ ჩაიტვირთა','Couldn’t load the details')}</Copy>
    <Copy muted size={13} style={{textAlign:'center'}}>{missing?tx('დეტალები და შენი პროგრესი აქ სულ მალე იქნება. სცადე ცოტა ხანში.','Details and your progress will be here very soon. Try again in a little while.'):tx('შეამოწმე ინტერნეტი და სცადე თავიდან.','Check your connection and try again.')}</Copy>
    <View style={{alignSelf:'stretch'}}><Action secondary label={tx('ხელახლა ცდა','Try again')} icon={RotateCw} busy={refreshing} onPress={refresh}/></View>
   </Card>:<Loading/>}
  </ScrollView>
 </View>;
}

/** The page's one spotlight: prize, drop time in Tbilisi and the countdown. */
function Hero({data}:{data:GrandPrize}){
 const {campaign,requirement}=data,goal=levelPercent(requirement.percent),city=requirement.city;
 const countdown=grandCountdown(campaign.dropAt,campaign.status),when=dropLabel(campaign.dropAt);
 const story=campaign.status==='ended'
  ?tx('კამპანია დასრულდა. მადლობა, რომ ქალაქი გაანათე!','The campaign has ended. Thank you for lighting up the city!')
  :campaign.status==='live'
   ?tx(`MEDIRUN-ის საჩუქრის ყუთი უკვე ქალაქშია. მას მხოლოდ ის გრძნობს, ვისაც ${cityOf(city)} ${goal} აქვს განათებული. ვინც პირველი გახსნის, ის მოიგებს.`,`The MEDIRUN gift box is out in the city now. Only players who have lit ${goal} of ${city} can sense it — the first to open it wins.`)
   :tx(`ქალაქში MEDIRUN-ის საჩუქრის ყუთი დაიმალება. მას მხოლოდ ის იგრძნობს, ვისაც ${cityOf(city)} ${goal} ექნება განათებული. ვინც პირველი გახსნის, ის მოიგებს.`,`A MEDIRUN gift box will be hidden in the city. Only players who have lit ${goal} of ${city} can sense it — the first to open it wins.`);
 const pill=countdown.kind==='ended'?{bg:'rgba(255,255,255,0.08)',fg:SOFT}:{bg:'rgba(251,191,36,0.14)',fg:'#FDE68A'};
 return <View style={{backgroundColor:HUB.spotlightBg,borderRadius:HUB.cardRadius,padding:HUB.cardPad+2,gap:14,overflow:'hidden'}}>
  <View style={{flexDirection:'row',alignItems:'center',gap:12}}>
   <View style={{flex:1,minWidth:0,gap:6}}>
    <View style={{flexDirection:'row',alignItems:'center',gap:7,alignSelf:'flex-start',borderRadius:10,paddingHorizontal:9,paddingVertical:3,backgroundColor:'rgba(45,212,191,0.14)'}}>
     <View style={{width:6,height:6,borderRadius:3,backgroundColor:'#2DD4BF'}}/>
     <Copy bold size={11} numberOfLines={1} style={{color:MINT}}>{campaign.name}</Copy>
    </View>
    <Copy bold size={26} style={{color:'#fff',lineHeight:36}}>{campaign.prize}</Copy>
    {campaign.prizeDetail?<View style={{flexDirection:'row',alignItems:'center',gap:6,alignSelf:'flex-start',borderRadius:10,paddingHorizontal:9,paddingVertical:3,backgroundColor:'rgba(239,68,68,0.18)'}}>
     <View style={{width:8,height:8,borderRadius:4,backgroundColor:'#EF4444'}}/>
     <Copy bold size={11} style={{color:'#FECACA'}}>{campaign.prizeDetail}</Copy>
    </View>:null}
   </View>
   <Image source={RUN_GIFT} accessibilityIgnoresInvertColors resizeMode="contain" style={{width:104,height:104}}/>
  </View>
  <Copy size={13} style={{color:SOFT}}>{story}</Copy>
  <View style={{flexDirection:'row',alignItems:'center',gap:10,flexWrap:'wrap',borderTopWidth:1,borderColor:'rgba(255,255,255,0.1)',paddingTop:14}}>
   <View style={{flexDirection:'row',alignItems:'center',gap:8,flexGrow:1,flexShrink:1}}>
    <CalendarClock size={16} color={MINT}/>
    <Copy bold size={13} style={{color:'#fff',flexShrink:1}}>{when}</Copy>
    <Copy size={11} style={{color:SOFT}}>{tx('თბილისის დროით','Tbilisi time')}</Copy>
   </View>
   {countdown.label?<View accessibilityRole="text" style={{flexDirection:'row',alignItems:'center',gap:6,borderRadius:12,paddingHorizontal:10,paddingVertical:4,backgroundColor:pill.bg}}>
    <Hourglass size={13} color={pill.fg}/>
    <Copy bold size={12} style={{color:pill.fg,fontVariant:['tabular-nums']}}>{countdown.label}</Copy>
   </View>:null}
  </View>
 </View>;
}

/** Share of the city lit vs the goal. Real numbers only; skeleton until they exist. */
function Progress({data}:{data:GrandPrize}){
 const c=useThemeColors(),{me,requirement,campaign}=data,goal=levelPercent(requirement.percent);
 if(!me)return <Section title={tx('შენი პროგრესი','Your progress')}><Card style={{alignItems:'center',gap:16}}>
  <Bone width={176} height={176} radius={999}/><Bone width="62%" height={30} radius={15}/><Bone height={40} radius={12}/>
  <Copy muted size={12} style={{textAlign:'center'}}>{tx('შენი პროგრესი ითვლება…','Counting your progress…')}</Copy>
 </Card></Section>;
 const done=me.eligible,ended=campaign.status==='ended';
 const pill=done?{bg:c.successBg,fg:c.success,icon:Check,text:eligibleLabel(data)}
  :ended?{bg:c.bg200,fg:c.text200,icon:Hourglass,text:tx('კამპანია დასრულდა','The campaign has ended')}
  :{bg:c.accent100,fg:c.primary100,icon:Footprints,text:streetsLeftLabel(me.remainingStreetKm)};
 const Icon=pill.icon;
 const stats=[
  {value:grandArea(me.paintedKm2),label:tx('განათებული','Lit')},
  {value:grandArea(requirement.areaKm2*requirement.percent/100),label:tx(`საჭიროა (${goal})`,`Needed (${goal})`)},
  {value:done?tx('მზადაა','Done'):grandArea(me.remainingKm2),label:tx('დარჩა','To go')},
 ];
 return <Section title={tx('შენი პროგრესი','Your progress')}>
  <Card style={{alignItems:'center',gap:16}}>
   <Copy muted size={12} style={{textAlign:'center'}}>{tx(`${cityOf(requirement.city)} წილი, რომელიც გაანათე`,`Share of ${requirement.city} you’ve lit`)}</Copy>
   <Ring progress={grandProgress(data)} color={done?c.success:RUN_TEAL} track={c.bg200} label={tx(`${grandPercent(me.percent)} ${goal}-დან`,`${grandPercent(me.percent)} of ${goal}`)}>
    <Copy bold size={34} style={{lineHeight:44,letterSpacing:-1,fontVariant:['tabular-nums'],color:done?c.success:c.text100}}>{grandPercent(me.percent)}</Copy>
    <Copy muted size={12}>{tx(`მიზანი · ${goal}`,`Goal · ${goal}`)}</Copy>
   </Ring>
   <View accessibilityRole="text" style={{flexDirection:'row',alignItems:'center',gap:8,borderRadius:16,paddingHorizontal:14,paddingVertical:8,backgroundColor:pill.bg,maxWidth:'100%'}}>
    <Icon size={16} color={pill.fg} strokeWidth={2.4}/>
    <Copy bold size={13} style={{color:pill.fg,flexShrink:1}}>{pill.text}</Copy>
   </View>
   <View style={{flexDirection:'row',alignSelf:'stretch',borderTopWidth:1,borderColor:c.bg200,paddingTop:14}}>
    {stats.map((s,i)=><View key={s.label} style={{flex:1,alignItems:'center',gap:2,borderLeftWidth:i?1:0,borderColor:c.bg200,paddingHorizontal:4}}>
     <Copy bold size={15} numberOfLines={1} style={{fontVariant:['tabular-nums']}}>{s.value}</Copy>
     <Copy muted size={11} numberOfLines={1}>{s.label}</Copy>
    </View>)}
   </View>
  </Card>
 </Section>;
}

function Ring({progress,color,track,label,children}:{progress:number;color:string;track:string;label:string;children:React.ReactNode}){
 const size=176,stroke=14,r=(size-stroke)/2,circ=2*Math.PI*r;
 // A real but tiny share still shows as a dot on the ring; zero stays empty.
 const dash=progress>0?Math.max(progress*circ,0.5):0;
 return <View accessibilityRole="progressbar" accessibilityLabel={label} accessibilityValue={{min:0,max:100,now:Math.round(progress*100)}} style={{width:size,height:size,alignItems:'center',justifyContent:'center'}}>
  <Svg width={size} height={size} style={{position:'absolute'}}>
   <Circle cx={size/2} cy={size/2} r={r} stroke={track} strokeWidth={stroke} fill="none"/>
   {dash?<Circle cx={size/2} cy={size/2} r={r} stroke={color} strokeWidth={stroke} fill="none" strokeLinecap="round" strokeDasharray={`${dash} ${circ}`} transform={`rotate(-90 ${size/2} ${size/2})`}/>:null}
  </Svg>
  <View style={{alignItems:'center',paddingHorizontal:20}}>{children}</View>
 </View>;
}

function HowTo({data}:{data:GrandPrize}){
 const c=useThemeColors(),dark=useIsDark(),ink=hubInk('teal',dark),{requirement}=data;
 const goal=levelPercent(requirement.percent),km=goalStreetKm(requirement);
 const steps=[
  {title:tx('ჩართე MEDIRUN','Turn on MEDIRUN'),body:tx('MEDIRUN-ის მთავარ გვერდზე დააჭირე „დავიწყოთ აღმოჩენა“.','On the MEDIRUN home page, tap “Start exploring”.')},
  {title:tx('იარე ქუჩებზე, სადაც ჯერ არ ყოფილხარ','Walk streets you haven’t been on yet'),body:tx('მხოლოდ ახალი ქუჩები ითვლება — ერთსა და იმავე გზაზე ხელახლა გავლა წილს არ ზრდის.','Only new streets count — walking the same route again doesn’t add to your share.')},
  {title:tx(`${cityOf(requirement.city)} ${goal} = დიდ საჩუქარს დაინახავ`,`${goal} of ${requirement.city} = you’ll see the grand prize`),body:km?tx(`ეს დაახლოებით ${km} კმ ახალი ქუჩაა. ამის შემდეგ საჩუქარს იგრძნობ და რუკაზე დაინახავ.`,`That’s about ${km} km of new streets. Then you’ll sense the box and see it on the map.`):tx('ამის შემდეგ საჩუქარს იგრძნობ და რუკაზე დაინახავ.','Then you’ll sense the box and see it on the map.')},
 ];
 return <Section title={tx('როგორ დავინახო დიდი საჩუქარი','How to see the grand prize')}>
  <Card style={{gap:0,paddingVertical:8}}>
   {steps.map((s,i)=><View key={i} style={{flexDirection:'row',gap:14,paddingVertical:12,borderTopWidth:i?1:0,borderColor:c.bg200}}>
    <View style={{width:32,height:32,borderRadius:11,backgroundColor:hubTint(ink,dark),alignItems:'center',justifyContent:'center'}}><Copy bold size={14} style={{color:ink}}>{i+1}</Copy></View>
    <View style={{flex:1,minWidth:0,gap:2}}>
     <Copy bold size={14}>{s.title}</Copy>
     <Copy muted size={12}>{s.body}</Copy>
    </View>
   </View>)}
  </Card>
 </Section>;
}

function Levels({data}:{data:GrandPrize}){
 const c=useThemeColors(),dark=useIsDark(),teal=hubInk('teal',dark);
 const nextId=data.next?.id??data.levels.find(l=>!l.reached)?.id??null;
 return <Section title={tx('დონეები','Levels')}>
  <Card style={{gap:4,padding:8}}>
   {data.levels.map(l=>{
    const state=l.reached?'done':l.id===nextId?'next':'locked';
    const tile=state==='done'?{bg:c.successBg,fg:c.success,icon:Check}:state==='next'?{bg:hubTint(teal,dark),fg:teal,icon:Sparkles}:{bg:c.bg200,fg:c.text300,icon:Lock};
    const Icon=tile.icon,next=state==='next'&&data.next?.id===l.id?data.next:null;
    const stateLabel=state==='done'?tx('მიღწეულია','Reached'):state==='next'?tx('შემდეგი','Next'):tx('დახურულია','Locked');
    return <View key={l.id} accessibilityLabel={`${l.name}, ${levelPercent(l.percent)}, ${stateLabel}. ${l.unlocks}`} style={{flexDirection:'row',gap:12,padding:12,borderRadius:16,backgroundColor:state==='next'?c.accent100:'transparent'}}>
     <View style={{width:HUB.tile,height:HUB.tile,borderRadius:HUB.tileRadius,backgroundColor:tile.bg,alignItems:'center',justifyContent:'center'}}><Icon size={20} color={tile.fg} strokeWidth={2.2}/></View>
     <View style={{flex:1,minWidth:0,gap:2}}>
      <View style={{flexDirection:'row',alignItems:'center',gap:8}}>
       <Copy bold size={15} numberOfLines={1} style={{flexShrink:1,color:state==='locked'?c.text200:c.text100}}>{l.name}</Copy>
       <Copy bold size={12} style={{color:state==='done'?c.success:state==='next'?c.primary100:c.text300,fontVariant:['tabular-nums']}}>{levelPercent(l.percent)}</Copy>
      </View>
      {l.unlocks?<Copy muted size={12}>{l.unlocks}</Copy>:null}
      {next?<Copy bold size={12} style={{color:c.primary100}}>{tx('შემდეგი','Next')} · {streetsLeftLabel(next.remainingStreetKm)}</Copy>:null}
     </View>
    </View>;
   })}
  </Card>
 </Section>;
}

function Footer({rulesUrl}:{rulesUrl:string}){
 const c=useThemeColors(),url=safeRulesUrl(rulesUrl);
 return <View style={{gap:10,alignItems:'center',marginTop:-8}}>
  {url?<Pressable accessibilityRole="link" accessibilityLabel={tx('კამპანიის წესები','Campaign rules')} onPress={()=>{void Linking.openURL(url).catch(()=>{});}} style={{minHeight:44,flexDirection:'row',alignItems:'center',gap:8,paddingHorizontal:16,borderRadius:14,backgroundColor:c.surface}}>
   <FileText size={16} color={c.primary100}/>
   <Copy bold size={13} style={{color:c.primary100}}>{tx('კამპანიის წესები','Campaign rules')}</Copy>
   <ExternalLink size={14} color={c.text300}/>
  </Pressable>:null}
  <Copy muted size={11} style={{textAlign:'center'}}>{tx('Apple ამ კამპანიის სპონსორი არ არის.','Apple is not a sponsor of this campaign.')}</Copy>
 </View>;
}

function Loading(){
 const c=useThemeColors();
 return <View accessibilityRole="progressbar" accessibilityLabel={tx('იტვირთება','Loading')} style={{gap:HUB.sectionGap}}>
  <View style={{backgroundColor:HUB.spotlightBg,borderRadius:HUB.cardRadius,padding:HUB.cardPad+2,gap:12,height:236}}>
   <Bone width="40%" height={18} radius={9}/><Bone width="72%" height={30} radius={10}/><Bone width="88%" height={14}/><Bone width="64%" height={14}/>
  </View>
  <View style={{backgroundColor:c.surface,borderRadius:HUB.cardRadius,padding:HUB.cardPad,alignItems:'center',gap:16}}>
   <Bone width={176} height={176} radius={999}/><Bone width="62%" height={30} radius={15}/><Bone height={40} radius={12}/>
  </View>
 </View>;
}
