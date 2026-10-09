import React,{useEffect,useRef,useState} from 'react';
import {Animated,Easing,Pressable,View,useWindowDimensions} from 'react-native';
import {WebView} from 'react-native-webview';
import {LinearGradient} from 'expo-linear-gradient';
import {ChevronDown,Gift,Play,Target,Timer,Users} from 'lucide-react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {usePrefersReducedMotion} from '@/hooks/usePrefersReducedMotion';
import {useDrops} from '@/lib/medipulsi/drops';
import {HUB} from '@/theme/hub';
import {tx} from '@/i18n/locale';
import {Copy,RUN_CTA} from './PulseUi';
import {RUN_HERO} from './runArt';
import {coinsText,tbilisi,dayWord,useCountdown} from './RunDrops';

/*
 * MEDIRUN Start as a game lobby (owner 2026-10-09): the /medirun 3D city (server/public/medirun/hero3d/lobby.html →
 * hero3d.js, tunable without an app update) fills the first screen behind native controls: the header, who is out
 * now, the boxes badge, one line of state, ONE big start button in the thumb zone with the goal button beside it,
 * and a hint that more is below. The lit-city key art is the first paint and the fallback (no WebGL2, reduced
 * motion, offline); the WebView runs only while Start is on screen and the app is in front.
 */
export const LOBBY_URL='https://medicard.ge/medirun/hero3d/lobby.html';
const BAND=0.74;   // hero3d's band: the city floats centred in the upper three quarters, above the copy
const GLASS='rgba(5,11,22,0.58)',EDGE='rgba(255,255,255,0.14)',MINT='#99F6E4',LIVE='#34D399',GOLD='#FCD34D';

function useLoop(reduced:boolean,ms:number){
 const v=useRef(new Animated.Value(0)).current;
 useEffect(()=>{
  if(reduced){v.setValue(.5);return;}
  const loop=Animated.loop(Animated.timing(v,{toValue:1,duration:ms,easing:Easing.linear,useNativeDriver:true}));
  loop.start();return()=>loop.stop();
 },[reduced,v,ms]);
 return v;
}
function useSwing(reduced:boolean,ms:number){
 const v=useRef(new Animated.Value(0)).current;
 useEffect(()=>{
  if(reduced){v.setValue(.5);return;}
  const loop=Animated.loop(Animated.sequence([Animated.timing(v,{toValue:1,duration:ms,easing:Easing.inOut(Easing.sin),useNativeDriver:true}),Animated.timing(v,{toValue:0,duration:ms,easing:Easing.inOut(Easing.sin),useNativeDriver:true})]));
  loop.start();return()=>loop.stop();
 },[reduced,v,ms]);
 return v;
}

/**
 * The lobby's two badges are one family (owner 2026-10-09: „ძალიან განსხვავდება, ესთეტიკას მიფუჭებს“): the same glass
 * pill, height and type — a small disc with its glyph and a ring pinging out, the number big, a short word under it.
 * Only the accent differs: green for people walking now, gold for boxes out, mint for the countdown to the next ones.
 */
function StatBadge({accent,icon,value,label,pulse,reduced,a11y}:{accent:string;icon:React.ReactNode;value:string;label:string;pulse:boolean;reduced:boolean;a11y:string}){
 const t=useLoop(reduced,2000);
 return <View accessible accessibilityLabel={a11y} style={{flexDirection:'row',alignItems:'center',gap:9,height:44,backgroundColor:GLASS,borderWidth:1,borderColor:EDGE,borderRadius:15,paddingLeft:7,paddingRight:13}}>
  <View style={{width:28,height:28,alignItems:'center',justifyContent:'center'}}>
   {pulse?<Animated.View style={{position:'absolute',width:28,height:28,borderRadius:14,borderWidth:1.5,borderColor:accent,opacity:t.interpolate({inputRange:[0,.75,1],outputRange:[.6,0,0]}),transform:[{scale:t.interpolate({inputRange:[0,1],outputRange:[1,1.9]})}]}}/>:null}
   <View style={{width:28,height:28,borderRadius:14,backgroundColor:accent+'2E',borderWidth:1,borderColor:accent+'66',alignItems:'center',justifyContent:'center'}}>{icon}</View>
  </View>
  <View>
   <Copy bold size={14} style={{color:'#fff',lineHeight:17,fontVariant:['tabular-nums']}}>{value}</Copy>
   <Copy size={10} style={{color:'rgba(255,255,255,0.66)',lineHeight:13}}>{label}</Copy>
  </View>
 </View>;
}

export function RunLobby({header,today,active,onStart,onGoal,onMore}:{header:React.ReactNode;today?:React.ReactNode;active:boolean;onStart:()=>void;onGoal:()=>void;onMore:()=>void}){
 const {width,height}=useWindowDimensions(),insets=useSafeAreaInsets(),reduced=usePrefersReducedMotion();
 const drops=useDrops(),data=drops.data?.enabled?drops.data:null;
 const live=Boolean(data&&data.now.boxes>0),next=!live?data?.next||null:null;
 const city=data?.city&&!data.city.campaignCity?data.city:null;
 const walkers=typeof data?.live?.walkers==='number'?data.live.walkers:null;
 const left=useCountdown(next?.startsAt,()=>void drops.refetch());
 const drift=useSwing(reduced,14000),glow=useSwing(reduced,1400);
 const [three,setThree]=useState<'loading'|'ready'|'failed'>('loading'),shown=useRef(new Animated.Value(0)).current;
 useEffect(()=>{Animated.timing(shown,{toValue:three==='ready'?1:0,duration:900,useNativeDriver:true}).start();},[three,shown]);
 const showWeb=active&&!reduced&&three!=='failed';
 // The first screen, with the top of the next card peeking above the menu so people know there is more.
 const h=Math.round(Math.max(560,height-150));
 // The art is landscape (1200 × 670): fill the height and keep the lit street in view.
 const ih=h*1.08,iw=ih*1200/670,il=width/2-iw*.58;
 const pad=(n:number)=>String(n).padStart(2,'0');
 const countdown=left.d>0?tx(`${left.d} დღე ${pad(left.h)}:${pad(left.m)}`,`${left.d}d ${pad(left.h)}:${pad(left.m)}`):`${pad(left.h)}:${pad(left.m)}:${pad(left.s)}`;
 const headline=live?tx('ყუთები გელოდება.','The boxes are waiting.'):city?tx(`გაანათე ${city.name}.`,`Light up ${city.name}.`):tx('გაანათე თბილისი.','Light up Tbilisi.');
 const status=live&&data
  ?tx(`პირველ გამხსნელს ${coinsText(data.now.coins)}${data.now.endsAt?` · ${tbilisi(data.now.endsAt).clock}-მდე`:''}`,`${coinsText(data.now.coins)} for the first to open${data.now.endsAt?` · until ${tbilisi(data.now.endsAt).clock}`:''}`)
  :next?tx(`შემდეგი ${next.boxes} ყუთი · ${dayWord(next.startsAt)} ${tbilisi(next.startsAt).clock}`,`Next ${next.boxes} ${next.boxes===1?'box':'boxes'} · ${dayWord(next.startsAt)} ${tbilisi(next.startsAt).clock}`)
  :city?.pending?tx('შენს ქალაქში ყუთებს ვამზადებთ — მალე გამოჩნდება.','We’re setting up boxes in your city — they appear soon.')
  :tx('იარე. ანათე ქუჩები. იპოვე ყუთი.','Walk. Light the streets. Find a box.');

 return <View style={{height:h,marginHorizontal:-HUB.gutter,marginTop:-(insets.top+12),backgroundColor:'#050B16',overflow:'hidden'}}>
  <Animated.Image source={RUN_HERO} accessibilityIgnoresInvertColors resizeMode="cover" style={{position:'absolute',top:-h*.04,left:il,width:iw,height:ih,opacity:shown.interpolate({inputRange:[0,1],outputRange:[1,0]}),transform:[{scale:drift.interpolate({inputRange:[0,1],outputRange:[1.04,1.14]})},{translateX:drift.interpolate({inputRange:[0,1],outputRange:[10,-14]})}]}}/>
  {showWeb?<Animated.View pointerEvents="none" style={{position:'absolute',left:0,top:0,width,height:h,opacity:shown}}>
   <WebView source={{uri:`${LOBBY_URL}?band=${BAND}`}} originWhitelist={['https://*']} style={{flex:1,backgroundColor:'transparent'}} containerStyle={{backgroundColor:'transparent'}}
    javaScriptEnabled scrollEnabled={false} bounces={false} overScrollMode="never" setSupportMultipleWindows={false}
    onShouldStartLoadWithRequest={r=>r.url.startsWith(LOBBY_URL)||r.url==='about:blank'}
    onMessage={e=>{try{const m=JSON.parse(e.nativeEvent.data);if(m.type==='ready')setThree('ready');else if(m.type==='fail')setThree('failed');}catch{/* not ours */}}}
    onError={()=>setThree('failed')} onHttpError={()=>setThree('failed')}
    onContentProcessDidTerminate={()=>setThree('loading')} onRenderProcessGone={()=>setThree('loading')}/>
  </Animated.View>:null}
  <LinearGradient pointerEvents="none" colors={['rgba(5,11,22,0.9)','rgba(5,11,22,0.35)','rgba(5,11,22,0)']} locations={[0,.55,1]} style={{position:'absolute',top:0,left:0,right:0,height:insets.top+190}}/>
  <LinearGradient pointerEvents="none" colors={['rgba(5,11,22,0)','rgba(5,11,22,0.88)','#050B16']} locations={[0,.5,1]} style={{position:'absolute',left:0,right:0,bottom:0,height:h*0.52}}/>

  <View pointerEvents="box-none" style={{paddingTop:insets.top+12,paddingHorizontal:HUB.gutter,gap:14}}>
   {header}
   <View pointerEvents="none" style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8}}>
    {walkers!=null?<StatBadge accent={walkers>0?LIVE:'#94A3B8'} pulse={walkers>0} reduced={reduced} icon={<Users size={14} color={walkers>0?LIVE:'#CBD5E1'} strokeWidth={2.3}/>} value={String(walkers)} label={tx('ახლა დარბის','walking now')} a11y={tx(`ახლა ${walkers} ადამიანი დარბის`,`${walkers} people walking right now`)}/>:<View/>}
    {live&&data?<StatBadge accent={GOLD} pulse reduced={reduced} icon={<Gift size={14} color={GOLD} strokeWidth={2.3}/>} value={tx(`${data.now.boxes} ყუთი`,`${data.now.boxes} ${data.now.boxes===1?'box':'boxes'}`)} label={tx('ქალაქშია ახლა','out in the city')} a11y={tx(`ახლა ქალაქში ${data.now.boxes} ყუთია`,`${data.now.boxes} boxes out in the city now`)}/>
    :next?<StatBadge accent={MINT} pulse={false} reduced={reduced} icon={<Timer size={14} color={MINT} strokeWidth={2.3}/>} value={countdown} label={tx(`ყუთები ${dayWord(next.startsAt)} ${tbilisi(next.startsAt).clock}`,`Boxes ${dayWord(next.startsAt)} ${tbilisi(next.startsAt).clock}`)} a11y={tx(`შემდეგი ყუთები ${dayWord(next.startsAt)} ${tbilisi(next.startsAt).clock}, ${countdown}`,`Next boxes ${dayWord(next.startsAt)} ${tbilisi(next.startsAt).clock}, ${countdown}`)}/>:null}
   </View>
  </View>

  <View style={{flex:1}}/>
  <View style={{paddingHorizontal:HUB.gutter,paddingBottom:18,gap:14}}>
   {today}
   <View style={{gap:6}}>
    <Copy bold size={34} style={{color:'#fff',lineHeight:40,letterSpacing:-.6}}>{headline}</Copy>
    <Copy bold size={13} numberOfLines={2} style={{color:MINT,lineHeight:18,fontVariant:['tabular-nums']}}>{status}</Copy>
   </View>
   <View style={{flexDirection:'row',alignItems:'center',gap:10}}>
    <View style={{flex:1}}>
     <Animated.View pointerEvents="none" style={{position:'absolute',left:-6,right:-6,top:-6,bottom:-6,borderRadius:28,backgroundColor:'rgba(45,212,191,0.28)',opacity:glow.interpolate({inputRange:[0,1],outputRange:[.3,.85]})}}/>
     <Pressable accessibilityRole="button" accessibilityLabel={live?tx('წავედით ყუთების საძებნელად','Go find the boxes'):tx('დავიწყოთ გასეირნება','Start a walk')} onPress={onStart} style={{minHeight:64,borderRadius:22,backgroundColor:RUN_CTA,paddingHorizontal:14,flexDirection:'row',alignItems:'center',gap:12,shadowColor:'#14B8A6',shadowOpacity:.55,shadowRadius:18,shadowOffset:{width:0,height:6},elevation:10}}>
      <View style={{width:38,height:38,borderRadius:13,backgroundColor:'rgba(255,255,255,0.2)',alignItems:'center',justifyContent:'center'}}><Play fill="#fff" color="#fff" size={16}/></View>
      <Copy bold size={18} numberOfLines={1} style={{flex:1,color:'#fff'}}>{live?tx('წავედით საძებნელად','Go find them'):tx('დავიწყოთ','Let’s go')}</Copy>
     </Pressable>
    </View>
    <Pressable accessibilityRole="button" accessibilityLabel={tx('ივარჯიშე მიზნით','Train with a goal')} onPress={onGoal} style={{width:64,height:64,borderRadius:22,backgroundColor:GLASS,borderWidth:1,borderColor:EDGE,alignItems:'center',justifyContent:'center'}}><Target size={22} color={MINT}/></Pressable>
   </View>
   <Pressable accessibilityRole="button" accessibilityLabel={tx('ყუთები, მისიები და გასეირნებები ქვემოთ','Boxes, missions and walks below')} onPress={onMore} hitSlop={8} style={{alignSelf:'center',flexDirection:'row',alignItems:'center',gap:6,minHeight:44,paddingHorizontal:14}}>
    <Copy size={12} style={{color:'rgba(255,255,255,0.6)'}}>{tx('ყუთები · მისიები · გასეირნებები','Boxes · missions · walks')}</Copy><ChevronDown size={16} color="rgba(255,255,255,0.6)"/>
   </Pressable>
  </View>
 </View>;
}
