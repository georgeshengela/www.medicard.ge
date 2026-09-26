import React,{useEffect,useState} from 'react';
import {ActivityIndicator,Keyboard,KeyboardAvoidingView,Modal,Platform,Pressable,ScrollView,Text,View,type TextStyle,type ViewStyle} from 'react-native';
import {ChevronDown,X,type LucideIcon} from 'lucide-react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {APP_MODAL_PROPS,APP_MODAL_OVERLAY} from '@/components/ui/appModal';
import {HomeSectionHeading} from '@/components/home/HomeSectionHeading';
import {useIsDark,useThemeColors} from '@/theme/colors';
import {HUB,hubInk,hubTint,type HubInk} from '@/theme/hub';
export const BOLD='NotoSansGeorgian_700Bold',SEMIBOLD='NotoSansGeorgian_600SemiBold',REGULAR='NotoSansGeorgian_400Regular';
/** MEDIRUN brand teal and its filled-CTA shade. */
export const RUN_TEAL='#14B8A6',RUN_CTA='#0D9488';
/** Lifted look for controls that float over the live map (the map is not a hub page). */
const FLOAT:ViewStyle={shadowColor:'#030712',shadowOpacity:.16,shadowRadius:14,shadowOffset:{width:0,height:6},elevation:6};

export function Copy({children,size=14,muted=false,bold=false,style,numberOfLines}:{children:React.ReactNode;size?:number;muted?:boolean;bold?:boolean;style?:TextStyle|TextStyle[];numberOfLines?:number}){const c=useThemeColors();return <Text numberOfLines={numberOfLines} style={[{fontFamily:bold?BOLD:REGULAR,fontSize:size,lineHeight:Math.round(size*1.55),color:muted?c.text200:c.text100},style as TextStyle]}>{children}</Text>;}

/** Hub card: flat surface, radius 22, no border. `floating` only for map overlays. */
export function Card({children,style,floating=false}:{children:React.ReactNode;style?:ViewStyle;floating?:boolean}){const c=useThemeColors();return <View style={[{backgroundColor:c.surface,borderRadius:HUB.cardRadius,padding:HUB.cardPad,gap:12},floating?FLOAT:null,style]}>{children}</View>;}

/** Title above, content below — the hub section rule. */
export function Section({title,link,onLink,children,style}:{title:string;link?:string;onLink?:()=>void;children:React.ReactNode;style?:ViewStyle}){return <View style={style}><HomeSectionHeading title={title} linkLabel={link} onLink={onLink}/>{children}</View>;}

/** 42px icon tile tinted with its ink. */
export function Tile({icon:Icon,ink='teal',size=HUB.tile}:{icon:LucideIcon;ink?:HubInk;size?:number}){const dark=useIsDark(),hex=hubInk(ink,dark);return <View style={{width:size,height:size,borderRadius:HUB.tileRadius,backgroundColor:hubTint(hex,dark),alignItems:'center',justifyContent:'center'}}><Icon size={Math.round(size*.5)} color={hex} strokeWidth={1.9}/></View>;}

export function useRunInk(ink:HubInk='teal'){return hubInk(ink,useIsDark());}

export function Bar({value,height=6,color=RUN_TEAL,label}:{value:number;height?:number;color?:string;label?:string}){const c=useThemeColors(),pct=Math.max(0,Math.min(100,value));return <View accessibilityRole="progressbar" accessibilityLabel={label} accessibilityValue={{min:0,max:100,now:Math.round(pct)}} style={{height,borderRadius:height,backgroundColor:c.bg200,overflow:'hidden'}}><View style={{height,width:`${pct}%`,borderRadius:height,backgroundColor:color}}/></View>;}

/** Segmented choice — one row of equal pills. */
export function Segmented<T extends string>({options,value,onChange,disabled=false}:{options:ReadonlyArray<{value:T;label:string}>;value:T;onChange:(value:T)=>void;disabled?:boolean}){
 const c=useThemeColors();
 return <View accessibilityRole="tablist" style={{flexDirection:'row',gap:4,padding:4,borderRadius:16,backgroundColor:c.bg200}}>{options.map(o=>{const on=o.value===value;return <Pressable key={o.value} disabled={disabled} accessibilityRole="tab" accessibilityState={{selected:on,disabled}} onPress={()=>onChange(o.value)} style={{flex:1,minHeight:40,borderRadius:12,alignItems:'center',justifyContent:'center',paddingHorizontal:6,backgroundColor:on?c.surface:'transparent'}}><Copy size={12} bold style={{color:on?c.text100:c.text200,textAlign:'center'}}>{o.label}</Copy></Pressable>;})}</View>;
}

export function Action({label,onPress,icon:Icon,secondary=false,busy=false,disabled=false,tone}:{label:string;onPress:()=>void;icon?:LucideIcon;secondary?:boolean;busy?:boolean;disabled?:boolean;tone?:'danger'}){const c=useThemeColors();const fg=tone==='danger'?c.danger:secondary?c.text100:'#fff',ic=tone==='danger'?c.danger:secondary?c.primary100:'#fff';return <Pressable accessibilityRole="button" accessibilityState={{disabled:disabled||busy}} disabled={disabled||busy} onPress={onPress} style={{minHeight:52,paddingHorizontal:16,paddingVertical:12,borderRadius:18,backgroundColor:secondary||tone?c.bg200:RUN_CTA,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:10,opacity:disabled||busy?0.6:1}}>{busy?<ActivityIndicator color={secondary?c.primary100:'#fff'}/>:Icon?<Icon size={20} color={ic}/>:null}<Copy bold style={{color:fg,flexShrink:1,textAlign:'center'}}>{label}</Copy></Pressable>;}

export function IconButton({label,icon:Icon,onPress,active=false,floating=false}:{label:string;icon:LucideIcon;onPress:()=>void;active?:boolean;floating?:boolean}){const c=useThemeColors();return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{selected:active}} onPress={onPress} hitSlop={4} style={[{height:44,width:44,borderRadius:16,backgroundColor:active?c.accent100:c.surface,justifyContent:'center',alignItems:'center'},floating?FLOAT:null]}><Icon size={20} color={active?c.primary100:c.text100}/></Pressable>;}

export function Sheet({title,visible,onClose,children,keyboardAware=false,footer}:{title:string;visible:boolean;onClose:()=>void;children:React.ReactNode;keyboardAware?:boolean;footer?:React.ReactNode}){
 const c=useThemeColors(),insets=useSafeAreaInsets();
 const [keyboardOpen,setKeyboardOpen]=useState(false);
 useEffect(()=>{
  if(!visible||!keyboardAware){setKeyboardOpen(false);return;}
  setKeyboardOpen(Keyboard.isVisible());
  const show=Keyboard.addListener(Platform.OS==='ios'?'keyboardWillShow':'keyboardDidShow',()=>setKeyboardOpen(true));
  const hide=Keyboard.addListener(Platform.OS==='ios'?'keyboardWillHide':'keyboardDidHide',()=>setKeyboardOpen(false));
  return()=>{show.remove();hide.remove();};
 },[visible,keyboardAware]);
 const close=()=>{if(keyboardAware)Keyboard.dismiss();onClose();};
 return <Modal {...APP_MODAL_PROPS} visible={visible} onRequestClose={close}>
  <View style={{flex:1}}>
   <Pressable accessibilityLabel="დახურვა" onPress={close} style={{position:'absolute',inset:0,backgroundColor:APP_MODAL_OVERLAY}}/>
   {/* Android's native Modal already uses adjustResize; only iOS needs an extra keyboard inset. */}
   <KeyboardAvoidingView enabled={keyboardAware&&Platform.OS==='ios'} behavior="padding" keyboardVerticalOffset={0} pointerEvents="box-none" style={{flex:1}}>
    <View pointerEvents="box-none" style={{flex:1,justifyContent:'flex-end',paddingTop:insets.top+12}}>
     <View accessibilityViewIsModal style={{flexShrink:1,backgroundColor:c.bg100,maxHeight:keyboardOpen?'100%':'88%',borderTopLeftRadius:30,borderTopRightRadius:30,paddingBottom:keyboardOpen?10:Math.max(18,insets.bottom)}}>
      <View style={{width:34,height:4,backgroundColor:c.bg300,borderRadius:5,alignSelf:'center',marginTop:10,flexShrink:0}}/>
      <View style={{paddingHorizontal:HUB.gutter,paddingVertical:keyboardOpen?10:16,flexDirection:'row',alignItems:'center',gap:10,flexShrink:0}}><Copy size={20} bold style={{flex:1}}>{title}</Copy>{keyboardOpen?<IconButton label="კლავიატურის დამალვა" icon={ChevronDown} onPress={()=>Keyboard.dismiss()}/>:null}<IconButton label="დახურვა" icon={X} onPress={close}/></View>
      <ScrollView style={{flexShrink:1}} keyboardShouldPersistTaps="handled" keyboardDismissMode={Platform.OS==='ios'?'interactive':'on-drag'} automaticallyAdjustKeyboardInsets={false} contentContainerStyle={{paddingHorizontal:HUB.gutter,paddingBottom:footer?14:20,gap:14}}>{children}</ScrollView>
      {footer?<View style={{paddingHorizontal:HUB.gutter,paddingTop:12,borderTopWidth:1,borderColor:c.bg300,flexShrink:0}}>{footer}</View>:null}
     </View>
    </View>
   </KeyboardAvoidingView>
  </View>
 </Modal>;
}
