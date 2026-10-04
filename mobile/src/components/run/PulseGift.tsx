import React,{useEffect,useRef,useState} from 'react';
import {Animated,Easing,Pressable,ScrollView,View} from 'react-native';
import {LinearGradient} from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import {Gift,X} from 'lucide-react-native';
import Svg,{Defs,Ellipse,RadialGradient,Stop} from 'react-native-svg';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {usePrefersReducedMotion} from '@/hooks/usePrefersReducedMotion';
import {APP_MODAL_PROPS,Modal} from '@/components/ui/appModal';
import {getRunState,resumeRun} from '@/lib/run/store';
import {getPulseClient} from '@/lib/medipulsi/client';
import {publishMediCoinBalance} from '@/lib/quest/cache';
import type {Claim,GiftSignal} from '@/lib/medipulsi/types';
import {tx} from '@/i18n/locale';
import {RUN_GIFT,RUN_GIFT_OPEN} from './runArt';
import {Action,Copy,REGULAR} from './PulseUi';
import {num} from './RunDrops';

const NIGHT=['#030712','#042F2E','#0F766E'] as const,AMBER='#FCD34D',MINT='#99F6E4',WHITE='#FFFFFF';
const COINS=10;

/** Generated 3D gift (fal.ai) floating in its own glow; `open` is the discovered state. */
export function GiftArtwork({size=210,open=false,shake}:{size?:number;open?:boolean;shake?:Animated.Value}){
 const reduced=usePrefersReducedMotion(),float=useRef(new Animated.Value(0)).current,glow=open?AMBER:'#5EEAD4',box=Math.round(size*1.4);
 useEffect(()=>{if(reduced)return;const wave=(to:number)=>Animated.timing(float,{toValue:to,duration:1500,easing:Easing.inOut(Easing.sin),useNativeDriver:true});const loop=Animated.loop(Animated.sequence([wave(1),wave(0)]));loop.start();return()=>loop.stop();},[reduced,float]);
 const rotate=shake?shake.interpolate({inputRange:[-1,0,1],outputRange:['-6deg','0deg','6deg']}):'0deg';
 // A square stage: the glow is a sibling behind the picture, the picture keeps its own square and is never
 // rotated itself (a rotated image gets clipped on Android) — the wrapper view shakes instead.
 return <View style={{width:box,height:box,alignItems:'center',justifyContent:'center',overflow:'visible'}}>
  <Svg pointerEvents="none" style={{position:'absolute',left:0,top:0}} width={box} height={box}><Defs><RadialGradient id={open?'giftGlowOpen':'giftGlow'} cx="50%" cy="50%" r="50%"><Stop offset="0" stopColor={glow} stopOpacity={open?.55:.34}/><Stop offset="1" stopColor={glow} stopOpacity="0"/></RadialGradient></Defs><Ellipse cx="50%" cy="50%" rx="50%" ry="50%" fill={`url(#${open?'giftGlowOpen':'giftGlow'})`}/></Svg>
  <Animated.View style={{width:size,height:size,overflow:'visible',transform:[{translateY:float.interpolate({inputRange:[0,1],outputRange:[0,-10]})},{rotate}]}}>
   <Animated.Image source={open?RUN_GIFT_OPEN:RUN_GIFT} accessibilityIgnoresInvertColors resizeMode="contain" style={{width:size,height:size,backgroundColor:'transparent'}}/>
  </Animated.View>
 </View>;
}

/** Ten coins bursting out of the open box and fading — the reward made visible. */
function CoinBurst({play}:{play:boolean}){
 const reduced=usePrefersReducedMotion(),t=useRef(new Animated.Value(0)).current;
 useEffect(()=>{if(!play)return;t.setValue(0);if(reduced){t.setValue(1);return;}Animated.timing(t,{toValue:1,duration:1100,easing:Easing.out(Easing.cubic),useNativeDriver:true}).start();},[play,reduced,t]);
 if(!play||reduced)return null;
 return <View pointerEvents="none" style={{position:'absolute',left:0,right:0,top:0,bottom:0,alignItems:'center',justifyContent:'center'}}>
  {Array.from({length:COINS},(_,i)=>{const a=(i/COINS)*Math.PI*2+.4,r=90+(i%3)*28,size=10+(i%3)*4;
   return <Animated.View key={i} style={{position:'absolute',width:size,height:size,borderRadius:size/2,backgroundColor:i%2?AMBER:'#F59E0B',opacity:t.interpolate({inputRange:[0,.15,1],outputRange:[0,1,0]}),transform:[{translateX:t.interpolate({inputRange:[0,1],outputRange:[0,Math.cos(a)*r]})},{translateY:t.interpolate({inputRange:[0,1],outputRange:[0,Math.sin(a)*r-40]})},{scale:t.interpolate({inputRange:[0,.3,1],outputRange:[.3,1.1,.7]})}]}}/>;})}
 </View>;
}

/** „+40“ counting up from zero over ~0.9 s. */
function CountUp({to}:{to:number}){
 const reduced=usePrefersReducedMotion(),v=useRef(new Animated.Value(0)).current,[shown,setShown]=useState(reduced?to:0);
 useEffect(()=>{if(reduced){setShown(to);return;}const id=v.addListener(({value})=>setShown(Math.round(value)));Animated.timing(v,{toValue:to,duration:900,easing:Easing.out(Easing.cubic),useNativeDriver:false}).start();return()=>v.removeListener(id);},[to,reduced,v]);
 return <Copy bold size={56} style={{color:WHITE,lineHeight:64,fontVariant:['tabular-nums'],letterSpacing:-1}}>+{num(shown)}</Copy>;
}

/** Which opening this would be, in words (economy 2): first = the full coins, later = a smaller share. */
function rankLine(g:{rank?:number;base?:number;opened?:number;stock?:number}){
 if(!g.rank)return '';
 const left=g.stock!=null&&g.opened!=null?Math.max(0,g.stock-g.opened):null;
 if(g.rank===1)return tx('შენ პირველი იქნები — სრული თანხა შენია','You’d be first — the full amount is yours');
 return tx(`მე-${g.rank} გამხსნელი · პირველმა ${num(g.base||0)} აიღო${left!=null?` · დარჩა ${left} გახსნა`:''}`,`Opener #${g.rank} · the first got ${num(g.base||0)}${left!=null?` · ${left} left`:''}`);
}
const haptic=(kind:'tap'|'win')=>{(kind==='tap'?Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium):Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)).catch(()=>undefined);};

/**
 * The opening moment (owner 2026-10-04: no camera for now — one beautiful reveal). The pulse led the person to
 * the box; one tap opens it; the box shakes, bursts into coins, the amount counts up, the place in the ladder and
 * the new balance are shown. Claims still need a fresh, precise GPS fix within the reveal radius (server rule).
 */
export function PulseGift({visible,signal,onClose}:{visible:boolean;signal:GiftSignal;onClose:()=>void}){
 const insets=useSafeAreaInsets(),reduced=usePrefersReducedMotion();
 const [claim,setClaim]=useState<Claim|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const shake=useRef(new Animated.Value(0)).current,reveal=useRef(new Animated.Value(0)).current;
 useEffect(()=>{if(!visible){setClaim(null);setError('');setBusy(false);shake.setValue(0);reveal.setValue(0);}},[visible,shake,reveal]);
 const gift=signal.gift,coinsNow=gift?.coins||0,inRange=signal.revealed&&Boolean(gift);
 const openGift=async()=>{
  if(busy||!gift)return;
  setBusy(true);setError('');haptic('tap');
  if(!reduced)Animated.loop(Animated.sequence([Animated.timing(shake,{toValue:1,duration:70,useNativeDriver:true}),Animated.timing(shake,{toValue:-1,duration:70,useNativeDriver:true})]),{iterations:6}).start(()=>shake.setValue(0));
  try{
   if(getRunState().phase==='paused')await resumeRun();
   const next=await getPulseClient().claim(gift.id);
   // The opening paid coins: every balance on screen (hub wallet, store, Quest) learns the new number at once.
   if(typeof next.balance==='number')publishMediCoinBalance(next.balance);
   setClaim(next);haptic('win');
   if(reduced)reveal.setValue(1);else Animated.spring(reveal,{toValue:1,friction:6,tension:60,useNativeDriver:true}).start();
  }catch(e){setError((e as Error).message||tx('ყუთი ვერ გაიხსნა. სცადე ხელახლა.','The box couldn’t be opened. Try again.'));}
  finally{setBusy(false);}
 };
 const paid=claim?.reward.coins||0,rank=claim?.reward.rank||0,physical=claim?.status==='PENDING';
 return <Modal {...APP_MODAL_PROPS} visible={visible} onRequestClose={onClose}>
  <LinearGradient colors={[...NIGHT]} start={{x:.2,y:0}} end={{x:.8,y:1}} style={{flex:1,paddingTop:insets.top+8,paddingBottom:insets.bottom+16}}>
   <View style={{paddingHorizontal:20,flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}>
    <Copy bold size={12} style={{color:MINT,letterSpacing:1.5}}>{claim?tx('შენი ახალი აღმოჩენა','YOUR NEW FIND'):tx('MEDIRUN · აღმოჩენა','MEDIRUN · A FIND')}</Copy>
    <Pressable accessibilityRole="button" accessibilityLabel={tx('დახურვა','Close')} hitSlop={8} onPress={onClose} style={{width:40,height:40,borderRadius:14,backgroundColor:'rgba(255,255,255,0.10)',alignItems:'center',justifyContent:'center'}}><X size={18} color={WHITE}/></Pressable>
   </View>
   <ScrollView style={{flex:1}} contentContainerStyle={{flexGrow:1,alignItems:'center',justifyContent:'center',paddingHorizontal:24,paddingVertical:12,gap:6}} showsVerticalScrollIndicator={false} bounces={false}>
    <View style={{alignItems:'center',justifyContent:'center',overflow:'visible'}}><GiftArtwork size={claim?170:210} open={Boolean(claim)} shake={shake}/><CoinBurst play={Boolean(claim)}/></View>
    {claim?<Animated.View style={{alignItems:'center',gap:6,opacity:reveal,transform:[{translateY:reveal.interpolate({inputRange:[0,1],outputRange:[24,0]})}]}}>
     {physical?<Copy bold size={28} style={{color:WHITE,textAlign:'center'}}>{claim.reward.title}</Copy>:<><CountUp to={paid}/><Copy bold size={16} style={{color:MINT,marginTop:-6}}>Medi Coins</Copy></>}
     {rank?<View style={{marginTop:10,paddingHorizontal:14,paddingVertical:8,borderRadius:16,backgroundColor:rank===1?'rgba(252,211,77,0.18)':'rgba(255,255,255,0.10)'}}><Copy bold size={13} style={{color:rank===1?AMBER:WHITE,textAlign:'center'}}>{rank===1?tx('🏆 პირველი აღმომჩენი — სრული თანხა','🏆 First finder — the full amount'):tx(`მე-${rank} გამხსნელი${claim.reward.base?` · პირველმა ${num(claim.reward.base)} აიღო`:''}`,`Opener #${rank}${claim.reward.base?` · the first got ${num(claim.reward.base)}`:''}`)}</Copy></View>:null}
     {physical?<Copy size={13} style={{color:'#CCFBF1',textAlign:'center',marginTop:8}}>{tx('საჩუქარი დაჯავშნილია. ადმინისტრატორი გადაამოწმებს და გადმოცემის სტატუსი კოლექციაში გამოჩნდება.','The gift is reserved. An administrator will check it, and the handover status will appear in your collection.')}{'\n'}{claim.code}</Copy>
     :typeof claim.balance==='number'?<Copy size={13} style={{color:'#CCFBF1',marginTop:8}}>{tx(`ბალანსი · ${num(claim.balance)} Medi Coins`,`Balance · ${num(claim.balance)} Medi Coins`)}</Copy>:null}
    </Animated.View>
    :<View style={{alignItems:'center',gap:8}}>
     <Copy bold size={34} style={{color:WHITE,lineHeight:40,textAlign:'center'}}>{inRange?tx('აღმოჩენა!','A find!'):tx('თითქმის ხარ','Almost there')}</Copy>
     <Copy size={14} style={{color:'#CCFBF1',textAlign:'center'}}>{inRange?tx('პულსმა აქ მოგიყვანა — ყუთი შენს წინაა.','The pulse led you here — the box is right in front of you.'):tx('ყუთის დიაპაზონს გასცდი. მიუახლოვდი 20 მეტრზე და გახსნა ისევ გაჩნდება.','You’ve stepped out of the box’s range. Get within 20 metres and the opening comes back.')}</Copy>
     {coinsNow?<View style={{marginTop:8,alignItems:'center',paddingHorizontal:18,paddingVertical:12,borderRadius:20,backgroundColor:'rgba(255,255,255,0.10)',gap:2}}><Copy bold size={24} style={{color:AMBER,fontVariant:['tabular-nums']}}>{num(coinsNow)} Medi Coins</Copy><Copy size={12} style={{color:'#CCFBF1',textAlign:'center'}}>{rankLine(gift||{})}</Copy></View>:gift?.description?<Copy size={12} style={{color:'#CCFBF1',textAlign:'center'}}>{gift.description}</Copy>:null}
    </View>}
   </ScrollView>
   <View style={{paddingHorizontal:20,gap:10}}>
    {error?<View style={{padding:12,borderRadius:16,backgroundColor:'rgba(248,113,113,0.16)'}}><Copy size={13} style={{color:'#FECACA',textAlign:'center'}}>{error}</Copy></View>:null}
    {claim?<Action label={tx('ჩემია!','It’s mine!')} onPress={onClose}/>
    :<><Action label={busy?tx('იხსნება…','Opening…'):tx('ყუთის გახსნა','Open the box')} icon={Gift} busy={busy} disabled={!inRange} onPress={()=>void openGift()}/>
     <Copy size={11} style={{color:'rgba(204,251,241,0.75)',textAlign:'center',fontFamily:REGULAR}}>{tx('ქოინები მაშინვე ჩაირიცხება. გახსნას ზუსტი GPS სჭირდება — დადექი ყუთთან.','The coins land at once. Opening needs a precise GPS fix — stand by the box.')}</Copy></>}
   </View>
  </LinearGradient>
 </Modal>;
}
