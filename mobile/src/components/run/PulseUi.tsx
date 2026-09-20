import React,{useEffect,useState} from 'react';
import {ActivityIndicator,Keyboard,KeyboardAvoidingView,Modal,Platform,Pressable,ScrollView,Text,View,type TextStyle,type ViewStyle} from 'react-native';
import {ChevronDown,X,type LucideIcon} from 'lucide-react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {APP_MODAL_PROPS,APP_MODAL_OVERLAY} from '@/components/ui/appModal';
import {useThemeColors} from '@/theme/colors';
export const BOLD='NotoSansGeorgian_700Bold',REGULAR='NotoSansGeorgian_400Regular';
export function Copy({children,size=14,muted=false,bold=false,style}:{children:React.ReactNode;size?:number;muted?:boolean;bold?:boolean;style?:TextStyle}){const c=useThemeColors();return <Text style={[{fontFamily:bold?BOLD:REGULAR,fontSize:size,lineHeight:Math.round(size*1.55),color:muted?c.text200:c.text100},style]}>{children}</Text>;}
export function Card({children,style}:{children:React.ReactNode;style?:ViewStyle}){const c=useThemeColors();return <View style={[{backgroundColor:c.surface,borderWidth:1,borderColor:c.bg300,borderRadius:24,padding:18,gap:12},style]}>{children}</View>;}
export function Action({label,onPress,icon:Icon,secondary=false,busy=false,disabled=false}:{label:string;onPress:()=>void;icon?:LucideIcon;secondary?:boolean;busy?:boolean;disabled?:boolean}){const c=useThemeColors();return <Pressable accessibilityRole="button" accessibilityState={{disabled:disabled||busy}} disabled={disabled||busy} onPress={onPress} style={{minHeight:52,paddingHorizontal:16,paddingVertical:12,borderRadius:18,backgroundColor:secondary?c.bg200:'#0D9488',flexDirection:'row',alignItems:'center',justifyContent:'center',gap:10,opacity:disabled||busy?0.6:1}}>{busy?<ActivityIndicator color={secondary?c.primary100:'#fff'}/>:Icon?<Icon size={20} color={secondary?c.primary100:'#fff'}/>:null}<Copy bold style={{color:secondary?c.text100:'#fff',flexShrink:1,textAlign:'center'}}>{label}</Copy></Pressable>;}
export function IconButton({label,icon:Icon,onPress,active=false}:{label:string;icon:LucideIcon;onPress:()=>void;active?:boolean}){const c=useThemeColors();return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{selected:active}} onPress={onPress} style={{height:44,width:44,borderRadius:16,backgroundColor:active?c.accent100:c.surface,borderWidth:1,borderColor:c.bg300,justifyContent:'center',alignItems:'center'}}><Icon size={20} color={active?c.primary100:c.text100}/></Pressable>;}
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
      <View style={{paddingHorizontal:18,paddingVertical:keyboardOpen?10:18,flexDirection:'row',alignItems:'center',gap:10,flexShrink:0}}><Copy size={20} bold style={{flex:1}}>{title}</Copy>{keyboardOpen?<IconButton label="კლავიატურის დამალვა" icon={ChevronDown} onPress={()=>Keyboard.dismiss()}/>:null}<IconButton label="დახურვა" icon={X} onPress={close}/></View>
      <ScrollView style={{flexShrink:1}} keyboardShouldPersistTaps="handled" keyboardDismissMode={Platform.OS==='ios'?'interactive':'on-drag'} automaticallyAdjustKeyboardInsets={false} contentContainerStyle={{paddingHorizontal:18,paddingBottom:footer?14:20,gap:14}}>{children}</ScrollView>
      {footer?<View style={{paddingHorizontal:18,paddingTop:12,borderTopWidth:1,borderColor:c.bg300,flexShrink:0}}>{footer}</View>:null}
     </View>
    </View>
   </KeyboardAvoidingView>
  </View>
 </Modal>;
}
