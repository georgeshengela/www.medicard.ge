import React,{useEffect,useRef} from 'react';
import {Animated,Easing,Pressable,View,useWindowDimensions} from 'react-native';
import {LinearGradient} from 'expo-linear-gradient';
import {ArrowUpRight,Flame,Play,Target,Timer} from 'lucide-react-native';
import {usePrefersReducedMotion} from '@/hooks/usePrefersReducedMotion';
import {useDrops} from '@/lib/medipulsi/drops';
import {HUB} from '@/theme/hub';
import {tx} from '@/i18n/locale';
import {Copy,RUN_CTA} from './PulseUi';
import {RUN_HERO} from './runArt';
import {coinsText,tbilisi,dayWord,useCountdown} from './RunDrops';

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
 return {transform:[{scale:t.interpolate({inputRange:[0,1],outputRange:[1.06,1.18]})},{translateX:t.interpolate({inputRange:[0,1],outputRange:[8,-12]})},{translateY:t.interpolate({inputRange:[0,1],outputRange:[0,-6]})}]};
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
function Chip({children,accent=false}:{children:React.ReactNode;accent?:boolean}){
 return <View style={{flexDirection:'row',alignItems:'center',gap:6,backgroundColor:GLASS,borderWidth:1,borderColor:accent?'rgba(52,211,153,0.45)':EDGE,borderRadius:12,paddingHorizontal:10,paddingVertical:5}}>{children}</View>;
}

/**
 * MEDIRUN hero, compact (owner 2026-10-04 second pass: „ძალიან დიდია, უფრო კომპაქტური და ლამაზი“): the lit city
 * as the whole card at ~a third of the screen; a streak chip and the live/next chip on top, two short words and
 * one mint line, then one status line (boxes now, or the countdown) and a single row: start + the goal button.
 */
export function RunHero({streak,onStart,onGoal}:{streak:number;onStart:()=>void;onGoal:()=>void}){
 const {width}=useWindowDimensions(),reduced=usePrefersReducedMotion(),drift=useDrift(reduced),dot=usePulseDot(reduced);
 const drops=useDrops(),data=drops.data?.enabled?drops.data:null;
 const live=Boolean(data&&data.now.boxes>0),next=!live?data?.next||null:null;
 // Every city with a player has boxes; Tbilisi keeps its campaign name.
 const city=data?.city&&!data.city.campaignCity?data.city:null;
 const left=useCountdown(next?.startsAt,()=>void drops.refetch());
 const cw=width-2*HUB.gutter,h=Math.round(Math.min(372,Math.max(300,cw*.9)));
 // The art is landscape (1200 × 670): fill the height and centre on the lit street, not the river.
 const ih=h*1.2,iw=ih*1200/670,il=cw/2-iw*.58,it=-h*.12;
 const pad=(n:number)=>String(n).padStart(2,'0');
 const countdown=left.d>0?tx(`${left.d} დღე ${pad(left.h)}:${pad(left.m)}`,`${left.d}d ${pad(left.h)}:${pad(left.m)}`):`${pad(left.h)}:${pad(left.m)}:${pad(left.s)}`;
 const status=live&&data
  ?tx(`ახლა ${data.now.boxes} ყუთი · ${data.now.openingsLeft} გახსნა დარჩა${data.now.coins?` · პირველს ${coinsText(data.now.coins)}`:''}`,`${data.now.boxes} boxes now · ${data.now.openingsLeft} openings left${data.now.coins?` · ${coinsText(data.now.coins)} for the first`:''}`)
  :next?tx(`შემდეგი ${next.boxes} ყუთი · ${dayWord(next.startsAt)} ${tbilisi(next.startsAt).clock} · ${countdown}`,`Next ${next.boxes} ${next.boxes===1?'box':'boxes'} · ${dayWord(next.startsAt)} ${tbilisi(next.startsAt).clock} · ${countdown}`)
  :city?.pending?tx('შენს ქალაქში ყუთებს ვამზადებთ — მალე გამოჩნდება.','We’re setting up boxes in your city — they appear soon.')
  :tx('იარე. იპოვე ყუთი. აიღე საჩუქარი.','Walk. Find a box. Get a prize.');

 return <View style={{height:h,borderRadius:HUB.cardRadius,overflow:'hidden',backgroundColor:'#030712'}}>
  <Animated.Image source={RUN_HERO} accessibilityIgnoresInvertColors resizeMode="cover" style={[{position:'absolute',top:it,left:il,width:iw,height:ih},drift]}/>
  <LinearGradient pointerEvents="none" colors={['rgba(3,7,18,0.9)','rgba(3,7,18,0.45)','rgba(3,7,18,0)']} locations={[0,.6,1]} style={{position:'absolute',top:0,left:0,right:0,height:150}}/>
  <LinearGradient pointerEvents="none" colors={['rgba(3,7,18,0)','rgba(3,7,18,0.86)','rgba(3,7,18,0.98)']} locations={[0,.45,1]} style={{position:'absolute',left:0,right:0,bottom:0,height:190}}/>

  {/* Top: streak on the left, the city's live state on the right. */}
  <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:14,paddingTop:12,gap:8}}>
   {streak>0?<Chip><Flame size={13} color="#FCD34D" fill="#FCD34D"/><Copy bold size={11} style={{color:'#FDE68A'}}>{streak} {tx('დღე ზედიზედ','day streak')}</Copy></Chip>:<View/>}
   {live?<Chip accent><Animated.View style={{width:8,height:8,borderRadius:4,backgroundColor:LIVE,opacity:dot}}/><Copy bold size={11} style={{color:'#fff'}}>{tx('ლაივ · ყუთები ქალაქშია','Live · boxes are out')}</Copy></Chip>
   :next?<Chip><Timer size={13} color={MINT}/><Copy bold size={11} style={{color:'#fff'}}>{dayWord(next.startsAt)} {tbilisi(next.startsAt).clock}</Copy></Chip>:null}
  </View>

  <View style={{paddingHorizontal:HUB.cardPad,marginTop:10}}>
   <Copy bold size={28} style={{color:'#fff',lineHeight:34,letterSpacing:-.4}}>{live?tx('ყუთები გელოდება.','The boxes are waiting.'):city?tx(`გაანათე ${city.name}.`,`Light up ${city.name}.`):tx('გაანათე თბილისი.','Light up Tbilisi.')}</Copy>
  </View>

  {/* The middle stays free: the lit street is the picture. */}
  <View style={{flex:1}}/>
  <View style={{paddingHorizontal:HUB.cardPad,paddingBottom:HUB.cardPad,gap:10}}>
   <Copy bold size={12} numberOfLines={2} style={{color:MINT,lineHeight:17,fontVariant:['tabular-nums']}}>{status}</Copy>
   <View style={{flexDirection:'row',alignItems:'center',gap:10}}>
    <Pressable accessibilityRole="button" accessibilityLabel={live?tx('წავედით ყუთების საძებნელად','Go find the boxes'):tx('დავიწყოთ გასეირნება','Start a walk')} onPress={onStart} style={{flex:1,minHeight:54,borderRadius:18,backgroundColor:RUN_CTA,paddingHorizontal:12,flexDirection:'row',alignItems:'center',gap:10}}>
     <View style={{width:32,height:32,borderRadius:11,backgroundColor:'rgba(255,255,255,0.18)',alignItems:'center',justifyContent:'center'}}><Play fill="#fff" color="#fff" size={14}/></View>
     <Copy bold size={15} numberOfLines={1} style={{flex:1,color:'#fff'}}>{live?tx('წავედით საძებნელად','Go find them'):tx('დავიწყოთ','Let’s go')}</Copy><ArrowUpRight color="#CCFBF1" size={20}/>
    </Pressable>
    <Pressable accessibilityRole="button" accessibilityLabel={tx('ივარჯიშე მიზნით','Train with a goal')} onPress={onGoal} style={{width:54,height:54,borderRadius:18,backgroundColor:GLASS,borderWidth:1,borderColor:EDGE,alignItems:'center',justifyContent:'center'}}><Target size={20} color={MINT}/></Pressable>
   </View>
  </View>
 </View>;
}
