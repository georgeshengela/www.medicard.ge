import React,{useEffect,useRef,useState} from 'react';
import {Animated,Easing,Platform,Pressable,View,useWindowDimensions} from 'react-native';
import * as Location from 'expo-location';
import {DeviceMotion} from 'expo-sensors';
import * as Haptics from 'expo-haptics';
import {ChevronLeft,ChevronRight} from 'lucide-react-native';
import {usePrefersReducedMotion} from '@/hooks/usePrefersReducedMotion';
import type {LatLng} from '@/lib/run/geo';
import {projectGift,wrapDeg} from '@/lib/run/giftProjection';
import {RUN_GIFT} from './runArt';
import {Copy} from './PulseUi';
import {tx} from '@/i18n/locale';

/**
 * The gift standing at its real place in the camera (Pokémon GO style, no AR kit needed): its bearing and distance
 * come from GPS, the phone's direction from the compass and its tilt from the motion sensor. The anchor is fixed
 * when the camera opens and only moves when you really walk (GPS > 3 m), so the box stays put on the pavement.
 */
const rad=(d:number)=>d*Math.PI/180,deg=(r:number)=>r*180/Math.PI,wrap=wrapDeg;
function offset(from:LatLng,to:{lat:number;lng:number}){       // metres east / north
 return {e:(to.lng-from.lng)*111320*Math.cos(rad(from.lat)),n:(to.lat-from.lat)*110540};
}

export function GiftInWorld({gift,me,onOpen,disabled,onVisible}:{gift:[number,number];me:LatLng|null;onOpen:()=>void;disabled:boolean;onVisible?:(inView:boolean)=>void}){
 const {width:W,height:H}=useWindowDimensions(),reduced=usePrefersReducedMotion();
 const x=useRef(new Animated.Value(-999)).current,y=useRef(new Animated.Value(-999)).current,size=useRef(new Animated.Value(120)).current;
 const bob=useRef(new Animated.Value(0)).current;
 const [inView,setInView]=useState(false),[side,setSide]=useState<'left'|'right'|null>(null),[calibrate,setCalibrate]=useState(false);
 const onVisibleRef=useRef(onVisible);onVisibleRef.current=onVisible;
 const state=useRef({heading:null as number|null,pitch:90,anchor:null as {e:number;n:number}|null,origin:null as LatLng|null,inView:false,side:null as 'left'|'right'|null});

 // Anchor: where the gift is relative to where you stood when the camera opened; re-anchored only after a real move.
 useEffect(()=>{
  if(!me)return;const s=state.current;
  if(!s.origin){s.origin=me;s.anchor=offset(me,{lat:gift[1],lng:gift[0]});return;}
  const moved=offset(s.origin,me);
  if(Math.hypot(moved.e,moved.n)>3){s.origin=me;s.anchor=offset(me,{lat:gift[1],lng:gift[0]});}
 },[me?.lat,me?.lng,gift[0],gift[1]]);

 useEffect(()=>{
  if(reduced)return;
  const loop=Animated.loop(Animated.sequence([Animated.timing(bob,{toValue:1,duration:1300,easing:Easing.inOut(Easing.sin),useNativeDriver:true}),Animated.timing(bob,{toValue:0,duration:1300,easing:Easing.inOut(Easing.sin),useNativeDriver:true})]));
  loop.start();return()=>loop.stop();
 },[reduced,bob]);

 useEffect(()=>{
  let headingSub:{remove:()=>void}|null=null,alive=true;
  const place=()=>{
   const s=state.current;if(!s.anchor||s.heading==null)return;
   const p=projectGift({east:s.anchor.e,north:s.anchor.n},s.heading,s.pitch,W,H);   // tested in giftProjection.test.ts
   x.setValue(p.x-p.size/2);y.setValue(p.y-p.size);size.setValue(p.size);
   const visible=p.visible,nextSide=p.side;
   if(visible!==s.inView){s.inView=visible;setInView(visible);onVisibleRef.current?.(visible);if(visible)void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(()=>{});}
   if(nextSide!==s.side){s.side=nextSide;setSide(nextSide);}
  };
  // compass: smoothed along the shortest way round
  void Location.watchHeadingAsync(h=>{
   if(!alive)return;
   const raw=h.trueHeading>=0?h.trueHeading:h.magHeading,s=state.current;
   s.heading=s.heading==null?raw:(s.heading+wrap(raw-s.heading)*0.25+360)%360;
   setCalibrate(h.accuracy!=null&&h.accuracy>=0&&(Platform.OS==='ios'?h.accuracy>25:h.accuracy<2));
   place();
  }).then(sub=>{if(alive)headingSub=sub;else sub.remove();}).catch(()=>{});
  // tilt: beta is 90° with the phone upright, less when the camera looks down at the pavement
  DeviceMotion.setUpdateInterval(33);
  const motion=DeviceMotion.addListener(m=>{
   if(!m.rotation)return;const s=state.current,b=deg(m.rotation.beta);
   s.pitch+= (b-s.pitch)*0.3;place();
  });
  return()=>{alive=false;headingSub?.remove();motion.remove();};
 },[W,H,x,y,size]);

 const lift=bob.interpolate({inputRange:[0,1],outputRange:[0,-10]});
 return <View pointerEvents="box-none" style={{position:'absolute',inset:0}}>
  <Animated.View pointerEvents={inView?'auto':'none'} style={{position:'absolute',left:0,top:0,width:size,height:size,opacity:inView?1:0,transform:[{translateX:x},{translateY:y}]}}>
   {/* shadow on the ground under the box */}
   <Animated.View style={{position:'absolute',left:'12%',right:'12%',bottom:'-4%',height:'14%',borderRadius:999,backgroundColor:'rgba(3,7,18,.45)',transform:[{scaleX:bob.interpolate({inputRange:[0,1],outputRange:[1,0.86]})}]}}/>
   <Pressable accessibilityRole="button" accessibilityLabel={tx('საჩუქრის ყუთის გახსნა', 'Open the gift box')} disabled={disabled||!inView} onPress={onOpen} style={{flex:1}}>
    <Animated.Image source={RUN_GIFT} accessibilityIgnoresInvertColors resizeMode="contain" style={{width:'100%',height:'100%',transform:[{translateY:lift}]}}/>
   </Pressable>
  </Animated.View>
  {side?<View pointerEvents="none" style={{position:'absolute',top:H*0.42,[side]:12,flexDirection:'row',alignItems:'center',gap:6,backgroundColor:'rgba(17,24,39,.82)',borderRadius:16,paddingVertical:8,paddingHorizontal:12}}>
   {side==='left'?<ChevronLeft size={18} color="#5EEAD4"/>:null}<Copy bold size={12} style={{color:'#fff'}}>{tx('ყუთი აქეთაა', 'The box is this way')}</Copy>{side==='right'?<ChevronRight size={18} color="#5EEAD4"/>:null}
  </View>:null}
  {calibrate?<View pointerEvents="none" style={{position:'absolute',top:H*0.2,alignSelf:'center',backgroundColor:'rgba(17,24,39,.82)',borderRadius:14,paddingVertical:7,paddingHorizontal:12}}><Copy size={11} style={{color:'#fff'}}>{tx('კომპასი არაზუსტია — ტელეფონი ჰაერში რვიანივით მოატრიალე', 'Compass is inaccurate — move your phone in a figure eight')}</Copy></View>:null}
 </View>;
}
