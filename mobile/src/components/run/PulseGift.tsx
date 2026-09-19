import React,{useEffect,useState} from 'react';
import {AppState,Modal,Pressable,View} from 'react-native';
import {CameraView,useCameraPermissions} from 'expo-camera';
import {Camera,Check,Gift,X} from 'lucide-react-native';
import Svg,{Ellipse,Path} from 'react-native-svg';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {APP_MODAL_PROPS} from '@/components/ui/appModal';
import {getRunState,resumeRun} from '@/lib/run/store';
import {getPulseClient} from '@/lib/medipulsi/client';
import type {Claim,GiftSignal} from '@/lib/medipulsi/types';
import {useThemeColors} from '@/theme/colors';
import {Action,Card,Copy,IconButton} from './PulseUi';
export function GiftArtwork({size=190}:{size?:number}){return <Svg width={size} height={size*1.125} viewBox="0 0 64 72"><Ellipse cx="32" cy="65" rx="23" ry="5" fill="#030712" opacity=".2"/><Path d="M9 29 L32 18 L55 29 L55 53 L32 66 L9 53Z" fill="#0D9488"/><Path d="M32 42 L55 29 L55 53 L32 66Z" fill="#0F766E"/><Path d="M6 26 L32 13 L58 26 L32 40Z" fill="#5EEAD4"/><Path d="M6 26 L6 33 L32 47 L58 33 L58 26 L32 40Z" fill="#14B8A6"/><Path d="M26 37 L34 41 L34 64 L26 60Z M16 21 L40 34 L47 30 L23 17Z" fill="#CCFBF1"/><Path d="M31 17 C8 17 18 0 27 9 L32 17 C53 17 44 0 36 9Z" stroke="#CCFBF1" strokeWidth="3.5" fill="none"/></Svg>;}
export function PulseGift({visible,signal,onClose}:{visible:boolean;signal:GiftSignal;onClose:()=>void}){
 const c=useThemeColors(),insets=useSafeAreaInsets(),[permission,requestPermission]=useCameraPermissions();
 const [camera,setCamera]=useState(false),[foreground,setForeground]=useState(true),[ready,setReady]=useState(false),[claim,setClaim]=useState<Claim|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{if(!visible){setCamera(false);setReady(false);setClaim(null);setError('');}const sub=AppState.addEventListener('change',state=>setForeground(state==='active'));return()=>sub.remove();},[visible]);
 const openCamera=async()=>{setError('');try{const result=permission?.granted?permission:await requestPermission();if(result.granted){if(getRunState().phase==='paused')await resumeRun();setCamera(true);}else setError('კამერის წვდომა გამორთულია. შეგიძლია MEDICARD-ის ნებართვებში ჩართო.');}catch{setError('კამერა ვერ ჩაირთო.');}};
 const openGift=async()=>{if(busy||!signal.revealed||!signal.gift||!ready)return;setBusy(true);setError('');try{const next=await getPulseClient().claim(signal.gift.id);setClaim(next);setCamera(false);}catch(e){setError((e as Error).message);}finally{setBusy(false);}};
 return <Modal {...APP_MODAL_PROPS} visible={visible} onRequestClose={onClose}><View style={{flex:1,backgroundColor:c.bg100,paddingTop:insets.top+12,paddingBottom:insets.bottom+20}}>
  {camera&&permission?.granted&&foreground&&!claim?<CameraView facing="back" mode="picture" onCameraReady={()=>setReady(true)} onMountError={()=>setError('კამერა მიუწვდომელია. დახურე სხვა აპში გამოყენებული კამერა.')} style={{position:'absolute',inset:0}}/>:null}
  <View style={{paddingHorizontal:20,flexDirection:'row',alignItems:'center',gap:12}}><Card style={{padding:10,flex:1}}><Copy bold>{claim?'შენი ახალი აღმოჩენა':'პულსმა აქ მოგიყვანა'}</Copy></Card><IconButton label="დახურვა" icon={X} onPress={onClose}/></View>
  <View style={{flex:1,justifyContent:'center',alignItems:'center',padding:24,gap:18}}>
   {claim?<Card style={{width:'100%'}}><Check color={c.success} size={36}/><Copy bold size={24}>{claim.reward.title}</Copy><Copy muted>{claim.status==='PENDING'?'საჩუქარი დაჯავშნილია. ადმინისტრატორი გადაამოწმებს და გადმოცემის სტატუსი კოლექციაში გამოჩნდება.':'საჩუქარი დადასტურებულია და შენს კოლექციაში ინახება.'}</Copy><Copy>{claim.code}</Copy><Action label="ჩემია!" onPress={onClose}/></Card>:<><Pressable accessibilityRole="button" accessibilityLabel="საჩუქრის ყუთის გახსნა" disabled={!camera||!ready||!signal.revealed||busy} onPress={()=>void openGift()}><GiftArtwork/></Pressable>{!camera?<Card style={{width:'100%'}}><Copy bold size={22}>აღმოჩენა ახლოსაა</Copy><Copy muted>{signal.gift?.description||'ჩართე კამერა და შეეხე ყუთს. მოათავსე ტელეფონი სტაბილურად.'}</Copy><Action label="კამერის ჩართვა" icon={Camera} onPress={()=>void openCamera()}/><Copy muted size={11}>კამერაში ვირტუალური ყუთი გამოჩნდება. ფოტო და ვიდეო არ ინახება.</Copy></Card>:<Card style={{width:'100%'}}><Copy bold>{signal.revealed?'შეეხე ყუთს და გახსენი':'საჩუქრის დიაპაზონს გასცდი'}</Copy><Action label={ready?'ყუთის გახსნა':'კამერა მზადდება…'} busy={busy} disabled={!ready||!signal.revealed} icon={Gift} onPress={()=>void openGift()}/></Card>}</>}
   {error?<Card style={{width:'100%'}}><Copy style={{color:c.danger}}>{error}</Copy></Card>:null}
  </View>
 </View></Modal>;
}
