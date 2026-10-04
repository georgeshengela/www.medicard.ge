import React,{useEffect,useRef} from 'react';
import {Animated,Easing,Pressable,View,useWindowDimensions} from 'react-native';
import {LinearGradient} from 'expo-linear-gradient';
import {ArrowUpRight,ChevronRight,Flame,Play,Target,Timer} from 'lucide-react-native';
import {usePrefersReducedMotion} from '@/hooks/usePrefersReducedMotion';
import {useDrops} from '@/lib/medipulsi/drops';
import {HUB} from '@/theme/hub';
import {tx} from '@/i18n/locale';
import {Copy,RUN_CTA} from './PulseUi';
import {RUN_HERO} from './runArt';
import {coinsText,num,tbilisi,dayWord,useCountdown} from './RunDrops';

const GLASS='rgba(3,7,18,0.55)',EDGE='rgba(255,255,255,0.14)',MINT='#99F6E4',LIVE='#34D399';

/** Slow drift over the lit city (Ken Burns); still when the person asks for less motion. */
function useDrift(reduced:boolean){
 const t=useRef(new Animated.Value(0)).current;
 useEffect(()=>{
  if(reduced){t.setValue(.5);return;}
  const loop=Animated.loop(Animated.sequence([
   Animated.timing(t,{toValue:1,duration:14000,easing:Easing.inOut(Easing.sin),useNativeDriver:true}),
   Animated.timing(t,{toValue:0,duration:14000,easing:Easing.inOut(Easing.sin),useNativeDriver:true}),
  ]));
  loop.start();return()=>loop.stop();
 },[reduced,t]);
 return {transform:[{scale:t.interpolate({inputRange:[0,1],outputRange:[1.06,1.2]})},{translateX:t.interpolate({inputRange:[0,1],outputRange:[10,-14]})},{translateY:t.interpolate({inputRange:[0,1],outputRange:[0,-8]})}]};
}
function usePulseDot(reduced:boolean){
 const v=useRef(new Animated.Value(1)).current;
 useEffect(()=>{
  if(reduced){v.setValue(1);return;}
  const loop=Animated.loop(Animated.sequence([Animated.timing(v,{toValue:.25,duration:700,useNativeDriver:true}),Animated.timing(v,{toValue:1,duration:700,useNativeDriver:true})]));
  loop.start();return()=>loop.stop();
 },[reduced,v]);
 return v;
}

function Stat({value,label}:{value:string;label:string}){
 return <View style={{flex:1,alignItems:'center',paddingVertical:10}}>
  <Copy bold size={24} style={{color:'#fff',lineHeight:30,fontVariant:['tabular-nums']}}>{value}</Copy>
  <Copy size={10} numberOfLines={1} style={{color:'#C5DADA',lineHeight:14}}>{label}</Copy>
 </View>;
}
function Strip({children}:{children:React.ReactNode}){
 return <View style={{flexDirection:'row',borderRadius:18,backgroundColor:GLASS,borderWidth:1,borderColor:EDGE}}>{children}</View>;
}

/**
 * MEDIRUN hero (owner 2026-10-04: „ის სურათი თბილისი რო ფერადდება უფრო გამოჩინე, ნაკლები ტექსტი … რომ
 * ადამიანს თამაში მოანდომო“): the lit city fills the whole card and drifts slowly; on it only a live chip,
 * two big words, three numbers (boxes out now, or a countdown to the next ones) and the start button.
 */
export function RunHero({streak,onStart,onGoal}:{streak:number;onStart:()=>void;onGoal:()=>void}){
 const {width}=useWindowDimensions(),reduced=usePrefersReducedMotion(),drift=useDrift(reduced),dot=usePulseDot(reduced);
 const drops=useDrops(),data=drops.data?.enabled?drops.data:null;
 const live=Boolean(data&&data.now.boxes>0),next=!live?data?.next||null:null;
 const left=useCountdown(next?.startsAt,()=>void drops.refetch());
 const cw=width-2*HUB.gutter,h=Math.round(Math.min(640,Math.max(520,cw*1.6)));
 // The art is landscape (1200 × 670): fill the height and centre on the lit street, not the river.
 const ih=h*1.1,iw=ih*1200/670,il=cw/2-iw*.6,it=-h*.12;
 const pad=(n:number)=>String(n).padStart(2,'0');

 return <View style={{height:h,borderRadius:HUB.cardRadius,overflow:'hidden',backgroundColor:'#030712'}}>
  <Animated.Image source={RUN_HERO} accessibilityIgnoresInvertColors resizeMode="cover" style={[{position:'absolute',top:it,left:il,width:iw,height:ih},drift]}/>
  <LinearGradient pointerEvents="none" colors={['rgba(3,7,18,0.92)','rgba(3,7,18,0.55)','rgba(3,7,18,0)']} locations={[0,.55,1]} style={{position:'absolute',top:0,left:0,right:0,height:230}}/>
  <LinearGradient pointerEvents="none" colors={['rgba(3,7,18,0)','rgba(3,7,18,0.85)','rgba(3,7,18,0.97)']} locations={[0,.4,1]} style={{position:'absolute',left:0,right:0,bottom:0,height:270}}/>

  {/* Top: streak on the left, the city's live state on the right. */}
  <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',padding:14,gap:8}}>
   {streak>0?<View style={{flexDirection:'row',alignItems:'center',gap:5,backgroundColor:GLASS,borderWidth:1,borderColor:EDGE,borderRadius:12,paddingHorizontal:10,paddingVertical:5}}><Flame size={13} color="#FCD34D" fill="#FCD34D"/><Copy bold size={11} style={{color:'#FDE68A'}}>{streak} {tx('დღე ზედიზედ','day streak')}</Copy></View>:<View/>}
   {live?<View style={{flexDirection:'row',alignItems:'center',gap:6,backgroundColor:GLASS,borderWidth:1,borderColor:'rgba(52,211,153,0.45)',borderRadius:12,paddingHorizontal:10,paddingVertical:5}}>
    <Animated.View style={{width:8,height:8,borderRadius:4,backgroundColor:LIVE,opacity:dot}}/><Copy bold size={11} style={{color:'#fff'}}>{tx('ლაივ · ყუთები ქალაქშია','Live · boxes are out')}</Copy>
   </View>:next?<View style={{flexDirection:'row',alignItems:'center',gap:6,backgroundColor:GLASS,borderWidth:1,borderColor:EDGE,borderRadius:12,paddingHorizontal:10,paddingVertical:5}}>
    <Timer size={13} color={MINT}/><Copy bold size={11} style={{color:'#fff'}}>{dayWord(next.startsAt)} {tbilisi(next.startsAt).clock}</Copy>
   </View>:null}
  </View>

  <View style={{paddingHorizontal:HUB.cardPad,marginTop:2}}>
   <Copy bold size={36} style={{color:'#fff',lineHeight:44,letterSpacing:-.5}}>{live?tx('ყუთები\nგელოდება.','The boxes\nare waiting.'):tx('გაანათე\nთბილისი.','Light up\nTbilisi.')}</Copy>
   <Copy size={13} style={{color:MINT,marginTop:4}}>{live&&data?.now.coins?tx(`თითოში ${coinsText(data.now.coins)}`,`${coinsText(data.now.coins)} in each`):tx('იარე. იპოვე ყუთი. აიღე საჩუქარი.','Walk. Find a box. Get a prize.')}</Copy>
  </View>

  {/* The middle stays free: the lit street is the picture. */}
  <View style={{flex:1}}/>
  <View style={{padding:HUB.cardPad,gap:12}}>

   {live&&data?<Strip>
    <Stat value={String(data.now.boxes)} label={tx('ყუთი ახლა','boxes now')}/>
    <View style={{width:1,backgroundColor:EDGE,marginVertical:10}}/>
    <Stat value={String(data.now.openingsLeft)} label={tx('გახსნა დარჩა','openings left')}/>
    <View style={{width:1,backgroundColor:EDGE,marginVertical:10}}/>
    <Stat value={num(data.today.opened)} label={tx('დღეს გაიხსნა','opened today')}/>
   </Strip>:next?<View style={{gap:6}}>
    <Copy bold size={11} style={{color:'#C5DADA'}}>{tx(`შემდეგი ${next.boxes} ყუთი`,`Next ${next.boxes} ${next.boxes===1?'box':'boxes'}`)}{next.coins?` · ${coinsText(next.coins)}`:''}</Copy>
    <Strip>
     {(left.d>0?[[left.d,tx('დღე','days')],[left.h,tx('საათი','hours')],[left.m,tx('წუთი','min')]]:[[left.h,tx('საათი','hours')],[left.m,tx('წუთი','min')],[left.s,tx('წამი','sec')]]).map(([v,u],i)=><React.Fragment key={i}>
      {i?<View style={{width:1,backgroundColor:EDGE,marginVertical:10}}/>:null}
      <Stat value={pad(Number(v))} label={String(u)}/>
     </React.Fragment>)}
    </Strip>
   </View>:null}

   <Pressable accessibilityRole="button" accessibilityLabel={live?tx('წავედით ყუთების საძებნელად','Go find the boxes'):tx('დავიწყოთ გასეირნება','Start a walk')} onPress={onStart} style={{minHeight:60,borderRadius:20,backgroundColor:RUN_CTA,paddingHorizontal:14,flexDirection:'row',alignItems:'center',gap:12}}>
    <View style={{width:36,height:36,borderRadius:12,backgroundColor:'rgba(255,255,255,0.18)',alignItems:'center',justifyContent:'center'}}><Play fill="#fff" color="#fff" size={16}/></View>
    <Copy bold size={16} style={{flex:1,color:'#fff'}}>{live?tx('წავედით საძებნელად','Go find them'):tx('დავიწყოთ','Let’s go')}</Copy><ArrowUpRight color="#CCFBF1" size={22}/>
   </Pressable>
   <Pressable accessibilityRole="button" onPress={onGoal} style={{minHeight:36,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,marginTop:-4}}><Target size={15} color={MINT}/><Copy bold size={12} style={{color:'#fff'}}>{tx('ან ივარჯიშე მიზნით','or train with a goal')}</Copy><ChevronRight size={14} color={MINT}/></Pressable>
  </View>
 </View>;
}

