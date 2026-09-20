import React,{useEffect,useRef} from 'react';
import {Animated,Text,View} from 'react-native';
import Svg,{Circle,G,Path,Rect} from 'react-native-svg';
import {useThemeColors} from '@/theme/colors';
import {usePrefersReducedMotion} from '@/hooks/usePrefersReducedMotion';
import {BOLD} from './PulseUi';

export function MediRunLogo({size=25}:{size?:number}){
 const c=useThemeColors();
 return <View accessible accessibilityLabel="MEDIRUN" style={{flexDirection:'row',alignItems:'center',paddingRight:4}}>
  <Text style={{fontFamily:BOLD,fontSize:size,lineHeight:size*1.3,letterSpacing:-1.1,color:c.text100}}>MEDI</Text>
  <Text style={{fontFamily:BOLD,fontSize:size,lineHeight:size*1.3,letterSpacing:-1.1,color:'#14B8A6',transform:[{skewX:'-10deg'}],marginLeft:1}}>RUN</Text>
 </View>;
}

/** Editorial city illustration, unrelated to live gift locations. */
export function DiscoveryArtwork(){
 const c=useThemeColors();
 return <Svg width="100%" height={172} viewBox="0 0 340 172" accessible={false}>
  <Path d="M270 -20 C211 18 277 48 220 97 S221 169 157 193" stroke={c.accent100} strokeWidth="29" fill="none"/>
  <G fill={c.bg200} stroke={c.bg300} strokeWidth=".7">
   <Rect x="8" y="5" width="48" height="37" rx="8"/><Rect x="71" y="5" width="58" height="37" rx="8"/><Rect x="147" y="-12" width="45" height="54" rx="8"/>
   <Rect x="9" y="61" width="47" height="39" rx="8"/><Rect x="72" y="61" width="58" height="38" rx="8"/><Rect x="147" y="61" width="45" height="67" rx="8"/>
   <Rect x="-15" y="120" width="71" height="41" rx="8"/><Rect x="73" y="120" width="57" height="57" rx="8"/>
   <Rect x="281" y="8" width="64" height="35" rx="8"/><Rect x="281" y="62" width="41" height="40" rx="8"/><Rect x="264" y="121" width="80" height="51" rx="8"/>
  </G>
  <Path d="M-12 110 H111 Q139 110 139 85 V71 Q139 51 159 51 H250 Q270 51 270 30 V-10" fill="none" stroke={c.bg300} strokeWidth="2" strokeDasharray="3 7" strokeLinecap="round"/>
  <Path d="M-12 110 H111 Q139 110 139 85 V71 Q139 51 159 51 H207" fill="none" stroke="#14B8A6" strokeWidth="14" strokeOpacity=".12" strokeLinecap="round"/>
  <Path d="M-12 110 H111 Q139 110 139 85 V71 Q139 51 159 51 H207" fill="none" stroke="#14B8A6" strokeWidth="5" strokeLinecap="round"/>
  <Circle cx="72" cy="110" r="5" fill={c.surface} stroke="#14B8A6" strokeWidth="2"/>
  <Circle cx="207" cy="51" r="25" fill="#14B8A6" fillOpacity=".09"/><Circle cx="207" cy="51" r="17" fill="#14B8A6" fillOpacity=".12"/>
  <Circle cx="207" cy="51" r="11" fill="#0D9488" stroke={c.surface} strokeWidth="3"/>
  <Path d="M211 42 L215 56 L203 51Z" fill="#CCFBF1"/>
  <G fill={c.accent100} stroke={c.accent200} strokeWidth=".8"><Circle cx="245" cy="146" r="7"/><Circle cx="237" cy="127" r="6"/><Circle cx="321" cy="113" r="5"/></G>
  <G transform="translate(281 18)" fill="none" stroke={c.primary100} strokeWidth="1.5" strokeLinecap="round"><Path d="M7 0 V14 M0 7 H14"/></G>
 </Svg>;
}

export function PulseGlyph({active=false,period=1800,size=38}:{active?:boolean;period?:number;size?:number}){
 const scale=useRef(new Animated.Value(1)).current,reduced=usePrefersReducedMotion();
 useEffect(()=>{
  scale.setValue(1);if(!active||reduced)return;
  const animation=Animated.loop(Animated.sequence([
   Animated.timing(scale,{toValue:1.1,duration:100,useNativeDriver:true}),Animated.timing(scale,{toValue:1,duration:100,useNativeDriver:true}),
   Animated.timing(scale,{toValue:1.06,duration:90,useNativeDriver:true}),Animated.timing(scale,{toValue:1,duration:150,useNativeDriver:true}),Animated.delay(Math.max(260,period-440))
  ]));animation.start();return()=>{animation.stop();scale.setValue(1);};
 },[active,period,reduced,scale]);
 return <Animated.View style={{width:size,height:size,transform:[{scale}]}}><Svg width={size} height={size} viewBox="0 0 40 40" accessible={false}><Circle cx="20" cy="20" r="19" fill="#14B8A6" fillOpacity=".12"/><Path d="M5 21 H12 L16 13 L21 29 L25 17 L28 21 H35" fill="none" stroke="#14B8A6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></Svg></Animated.View>;
}
