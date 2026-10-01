import React,{useEffect,useRef,useState} from 'react';
import {Animated,AppState,Easing,Pressable,View} from 'react-native';
import {CameraView,useCameraPermissions} from 'expo-camera';
import {Camera,Check,Gift,X} from 'lucide-react-native';
import Svg,{Defs,Ellipse,RadialGradient,Stop} from 'react-native-svg';
import {usePrefersReducedMotion} from '@/hooks/usePrefersReducedMotion';
import {RUN_GIFT,RUN_GIFT_OPEN} from './runArt';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {APP_MODAL_PROPS, Modal } from '@/components/ui/appModal';
import {getRunState,resumeRun,useRunSession} from '@/lib/run/store';
import {GiftInWorld} from './GiftInWorld';
import {getPulseClient} from '@/lib/medipulsi/client';
import type {Claim,GiftSignal} from '@/lib/medipulsi/types';
import {useThemeColors} from '@/theme/colors';
import {Action,Card,Copy,IconButton} from './PulseUi';
import { tx } from '@/i18n/locale';
/** Generated 3D gift (fal.ai) floating in its own glow; `open` is the discovered state. */
export function GiftArtwork({size=210,open=false}:{size?:number;open?:boolean}){
 const reduced=usePrefersReducedMotion(),float=useRef(new Animated.Value(0)).current,glow=open?'#FCD34D':'#5EEAD4';
 useEffect(()=>{if(reduced)return;const wave=(to:number)=>Animated.timing(float,{toValue:to,duration:1500,easing:Easing.inOut(Easing.sin),useNativeDriver:true});const loop=Animated.loop(Animated.sequence([wave(1),wave(0)]));loop.start();return()=>loop.stop();},[reduced,float]);
 return <View style={{width:size*1.45,height:size*1.3,alignItems:'center',justifyContent:'center'}}>
  <Svg pointerEvents="none" style={{position:'absolute'}} width={size*1.45} height={size*1.3}><Defs><RadialGradient id="giftGlow" cx="50%" cy="50%" r="50%"><Stop offset="0" stopColor={glow} stopOpacity={open?.55:.32}/><Stop offset="1" stopColor={glow} stopOpacity="0"/></RadialGradient></Defs><Ellipse cx="50%" cy="50%" rx="50%" ry="50%" fill="url(#giftGlow)"/></Svg>
  <Animated.Image source={open?RUN_GIFT_OPEN:RUN_GIFT} accessibilityIgnoresInvertColors resizeMode="contain" style={{width:size,height:size,transform:[{translateY:float.interpolate({inputRange:[0,1],outputRange:[0,-10]})}]}}/>
 </View>;
}
export function PulseGift({visible,signal,onClose}:{visible:boolean;signal:GiftSignal;onClose:()=>void}){
 const c=useThemeColors(),insets=useSafeAreaInsets(),[permission,requestPermission]=useCameraPermissions();
 const run=useRunSession(),[inView,setInView]=useState(false);
 const [camera,setCamera]=useState(false),[foreground,setForeground]=useState(true),[ready,setReady]=useState(false),[claim,setClaim]=useState<Claim|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{if(!visible){setCamera(false);setReady(false);setClaim(null);setError('');setInView(false);}const sub=AppState.addEventListener('change',state=>setForeground(state==='active'));return()=>sub.remove();},[visible]);
 const openCamera=async()=>{setError('');try{const result=permission?.granted?permission:await requestPermission();if(result.granted){if(getRunState().phase==='paused')await resumeRun();setCamera(true);}else setError(tx('კამერის წვდომა გამორთულია. შეგიძლია MEDICARD-ის ნებართვებში ჩართო.', 'Camera access is off. You can turn it on in MEDICARD’s permissions.'));}catch{setError(tx('კამერა ვერ ჩაირთო.', 'The camera couldn’t start.'));}};
 const openGift=async()=>{if(busy||!signal.revealed||!signal.gift||!ready)return;setBusy(true);setError('');try{const next=await getPulseClient().claim(signal.gift.id);setClaim(next);setCamera(false);}catch(e){setError((e as Error).message);}finally{setBusy(false);}};
 return <Modal {...APP_MODAL_PROPS} visible={visible} onRequestClose={onClose}><View style={{flex:1,backgroundColor:c.bg100,paddingTop:insets.top+12,paddingBottom:insets.bottom+20}}>
  {camera&&permission?.granted&&foreground&&!claim?<CameraView facing="back" mode="picture" onCameraReady={()=>setReady(true)} onMountError={()=>setError(tx('კამერა მიუწვდომელია. დახურე სხვა აპში გამოყენებული კამერა.', 'The camera isn’t available. Close it in any other app that’s using it.'))} style={{position:'absolute',inset:0}}/>:null}
  {camera&&permission?.granted&&foreground&&!claim&&signal.gift?<GiftInWorld gift={signal.gift.position} me={run.current} disabled={busy||!ready||!signal.revealed} onOpen={()=>void openGift()} onVisible={setInView}/>:null}
  <View style={{paddingHorizontal:20,flexDirection:'row',alignItems:'center',gap:12}}><Card style={{padding:10,flex:1}}><Copy bold>{claim?tx('შენი ახალი აღმოჩენა', 'Your new find'):tx('პულსმა აქ მოგიყვანა', 'The pulse led you here')}</Copy></Card><IconButton label={tx('დახურვა', 'Close')} icon={X} onPress={onClose}/></View>
  <View style={{flex:1,justifyContent:'center',alignItems:'center',padding:24,gap:18}}>
   {claim?<Card style={{width:'100%'}}><View style={{alignItems:'center'}}><GiftArtwork open size={170}/></View><Copy bold size={24}>{claim.reward.title}</Copy><Copy muted>{claim.status==='PENDING'?tx('საჩუქარი დაჯავშნილია. ადმინისტრატორი გადაამოწმებს და გადმოცემის სტატუსი კოლექციაში გამოჩნდება.', 'The gift is reserved. An administrator will check it, and the handover status will appear in your collection.'):tx('საჩუქარი დადასტურებულია და შენს კოლექციაში ინახება.', 'The gift is confirmed and saved in your collection.')}</Copy><Copy>{claim.code}</Copy><Action label={tx('ჩემია!', 'It’s mine!')} onPress={onClose}/></Card>:<>{!camera?<GiftArtwork/>:<View style={{flex:1}}/>}{!camera?<Card style={{width:'100%'}}><Copy bold size={22}>{tx('აღმოჩენა ახლოსაა', 'A find is nearby')}</Copy><Copy muted>{signal.gift?.description||tx('ჩართე კამერა და შეეხე ყუთს. მოათავსე ტელეფონი სტაბილურად.', 'Turn on the camera and tap the box. Hold your phone steady.')}</Copy><Action label={tx('კამერის ჩართვა', 'Turn on camera')} icon={Camera} onPress={()=>void openCamera()}/><Copy muted size={11}>{tx('ყუთი თავის ადგილას დგას — კამერით მოძებნე, როგორც Pokémon GO-ში. ფოტო და ვიდეო არ ინახება.', 'The box stands in its real spot — find it with the camera, like in Pokémon GO. No photos or video are saved.')}</Copy></Card>:<Card style={{width:'100%'}}><Copy bold>{!signal.revealed?tx('საჩუქრის დიაპაზონს გასცდი', 'You’ve moved out of the gift’s range'):inView?tx('აი ის! შეეხე ყუთს და გახსენი', 'There it is! Tap the box to open it'):tx('მოძებნე ყუთი კამერაში — ნელა მოატრიალე ტელეფონი', 'Find the box in the camera — turn your phone slowly')}</Copy><Action label={ready?tx('ყუთის გახსნა', 'Open the box'):tx('კამერა მზადდება…', 'Getting the camera ready…')} busy={busy} disabled={!ready||!signal.revealed||!inView} icon={Gift} onPress={()=>void openGift()}/></Card>}</>}
   {error?<Card style={{width:'100%'}}><Copy style={{color:c.danger}}>{error}</Copy></Card>:null}
  </View>
 </View></Modal>;
}
