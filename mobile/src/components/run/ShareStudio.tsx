import React,{useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {ActivityIndicator,Pressable,View,useWindowDimensions} from 'react-native';
import {WebView,type WebViewMessageEvent} from 'react-native-webview';
import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as Haptics from 'expo-haptics';
import {LinearGradient} from 'expo-linear-gradient';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {Clapperboard,Image as ImageIcon,RotateCcw,Share2,X} from 'lucide-react-native';
import {APP_MODAL_PROPS,Modal} from '@/components/ui/appModal';
import {usePrefersReducedMotion} from '@/hooks/usePrefersReducedMotion';
import {resolveMapboxToken} from '@/lib/run/mapbox';
import {buildShareStudioHtml,sceneDefaults,type ShareScene,type StudioMessage} from '@/lib/run/shareStudio';
import {printedLink,shareLink} from '@/lib/medipulsi/social';
import {trackFunnel} from '@/lib/funnel';
import {tx} from '@/i18n/locale';
import {Action,Copy,REGULAR} from './PulseUi';

/** What a screen hands the studio: everything but the invite link and the fixed lines, which the studio adds. */
type Omit3<T>=T extends unknown?Omit<T,'link'|'cta'|'attribution'>:never;
export type ShareSceneInput=Omit3<ShareScene>;
export const canRecordClips=true;

const MINT='#99F6E4',WHITE='#FFFFFF';
type Phase='preparing'|'recording'|'saving'|'ready'|'error';

function metroBaseUrl(){
 const host=Constants.expoConfig?.hostUri??Constants.expoGoConfig?.debuggerHost??'localhost:8081';
 return `http://${String(host).replace(/^https?:\/\//,'').split('/')[0]}/`;
}

/**
 * Records a MEDIRUN share clip (walk, „my lit city“ or the box opening) in a WebView and opens the share sheet.
 * Video where the phone's WebView can record mp4, otherwise the same final frame as a picture — sharing never fails
 * because of the format. The invite link on the picture is the person's own (both get coins), else /medirun.
 */
export function ShareStudio({visible,scene,onClose,source}:{visible:boolean;scene:ShareSceneInput|null;onClose:()=>void;source:'walk'|'city'|'box'|'wrapped'}){
 const insets=useSafeAreaInsets(),{width,height}=useWindowDimensions(),reduced=usePrefersReducedMotion();
 const [html,setHtml]=useState(''),[phase,setPhase]=useState<Phase>('preparing'),[progress,setProgress]=useState(0),[error,setError]=useState('');
 const [video,setVideo]=useState<{uri:string;mime:string}|null>(null),[image,setImage]=useState<string|null>(null),[mode,setMode]=useState<'video'|'image'|null>(null),[busy,setBusy]=useState(false);
 const chunks=useRef<string[]>([]),expected=useRef<{n:number;mime:string}|null>(null),run=useRef(0),files=useRef<string[]>([]);
 const baseUrl=useMemo(()=>metroBaseUrl(),[]);
 // The scene is taken once when the studio opens: a card refreshing underneath must never restart a recording.
 const sceneRef=useRef(scene);if(!visible||!sceneRef.current)sceneRef.current=scene;
 const boxW=Math.min(width-48,(height-insets.top-insets.bottom-260)*9/16,360),boxH=boxW*16/9;

 const reset=useCallback(()=>{chunks.current=[];expected.current=null;setVideo(null);setImage(null);setMode(null);setProgress(0);setError('');},[]);
 const start=useCallback(async()=>{
  const scene=sceneRef.current;
  if(!scene)return;
  const id=++run.current;reset();setPhase('preparing');setHtml('');
  try{
   const [token,link]=await Promise.all([scene.kind==='box'?Promise.resolve(''):resolveMapboxToken(),shareLink()]);
   if(id!==run.current)return;
   if(scene.kind!=='box'&&!token.startsWith('pk.'))throw new Error(tx('რუკის ჩატვირთვა ვერ მოხერხდა. შეამოწმე ინტერნეტი.','The map couldn’t load. Check your connection.'));
   const full={...scene,link:printedLink(link),cta:sceneDefaults.cta(),attribution:sceneDefaults.attribution()} as ShareScene;
   setHtml(buildShareStudioHtml({token,scene:full,reducedMotion:reduced}));
  }catch(e){if(id===run.current){setPhase('error');setError((e as Error).message);}}
 },[reset,reduced]);

 const hasScene=Boolean(scene);
 useEffect(()=>{if(visible&&hasScene)void start();else{run.current++;setHtml('');}},[visible,hasScene]);// eslint-disable-line react-hooks/exhaustive-deps
 // Nothing may hang: the city has 30 s to load and start, the clip 45 s to come back.
 useEffect(()=>{
  if(!visible||phase==='ready'||phase==='error')return;
  const limit=phase==='preparing'?30_000:45_000,id=run.current;
  const t=setTimeout(()=>{if(id!==run.current)return;if(image){setPhase('ready');return;}setPhase('error');setError(tx('ჩაწერა ვერ დასრულდა. სცადე თავიდან — კარგ ინტერნეტზე უფრო სწრაფია.','The recording didn’t finish. Try again — it’s faster on a good connection.'));},limit);
  return()=>clearTimeout(t);
 },[visible,phase,image]);
 // Old clips in the cache go when the studio closes.
 useEffect(()=>{if(visible)return;const old=files.current;files.current=[];for(const f of old)void FileSystem.deleteAsync(f,{idempotent:true}).catch(()=>{});},[visible]);

 const write=async(b64:string,ext:string)=>{
  const uri=`${FileSystem.cacheDirectory}medirun-${source}-${Date.now()}.${ext}`;
  await FileSystem.writeAsStringAsync(uri,b64,{encoding:FileSystem.EncodingType.Base64});
  files.current.push(uri);
  return uri;
 };
 const onMessage=useCallback((e:WebViewMessageEvent)=>{
  let m:StudioMessage&{none?:boolean};
  try{m=JSON.parse(e.nativeEvent.data);}catch{return;}
  const id=run.current;
  if(m.type==='started'){setMode(m.mode);setPhase('recording');return;}
  if(m.type==='progress'){setProgress(Math.max(0,Math.min(1,Number(m.p)||0)));return;}
  if(m.type==='error'){setPhase('error');setError(m.message==='token'?tx('რუკის წვდომა ვერ დადასტურდა.','Map access couldn’t be verified.'):tx('ჩაწერა ვერ მოხერხდა. სცადე თავიდან.','The recording didn’t work. Try again.'));return;}
  if(m.type==='image'){setPhase('saving');void write(m.data,'jpg').then(uri=>{if(id===run.current)setImage(uri);}).catch(()=>{});return;}
  if(m.type==='video-start'){expected.current={n:m.chunks,mime:m.mime};chunks.current=[];return;}
  if(m.type==='video-chunk'){chunks.current[m.i]=m.data;return;}
  if(m.type==='video-end'){
   const exp=expected.current;
   if(m.none||!exp||chunks.current.filter(Boolean).length!==exp.n){setPhase('ready');void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(()=>{});return;}
   const b64=chunks.current.join('');chunks.current=[];
   void write(b64,exp.mime.includes('quicktime')?'mov':'mp4').then(uri=>{if(id!==run.current)return;setVideo({uri,mime:exp.mime});setPhase('ready');void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(()=>{});}).catch(()=>{if(id===run.current)setPhase('ready');});
  }
 },[source]);

 const share=async(kind:'video'|'image')=>{
  const file=kind==='video'?video:image?{uri:image,mime:'image/jpeg'}:null;
  if(!file||busy)return;
  setBusy(true);
  try{
   if(!(await Sharing.isAvailableAsync()))throw new Error('unavailable');
   const uti=file.mime==='image/jpeg'?'public.jpeg':file.mime.includes('quicktime')?'com.apple.quicktime-movie':'public.mpeg-4';
   await Sharing.shareAsync(file.uri,{mimeType:file.mime,UTI:uti,dialogTitle:tx('MEDIRUN-ის გაზიარება','Share MEDIRUN')});
   trackFunnel('medirun_shared',{kind:source,format:kind});
  }catch{setError(tx('გაზიარება ვერ მოხერხდა. სცადე თავიდან.','Couldn’t share. Please try again.'));}
  finally{setBusy(false);}
 };

 const status=phase==='preparing'?tx('ქალაქი იტვირთება…','Loading the city…')
  :phase==='recording'?(mode==='video'?tx(`ვიდეო იწერება · ${Math.round(progress*100)}%`,`Recording · ${Math.round(progress*100)}%`):tx(`სურათი იქმნება · ${Math.round(progress*100)}%`,`Making the picture · ${Math.round(progress*100)}%`))
  :phase==='saving'?tx('ინახება…','Saving…')
  :phase==='ready'?(video?tx('ვიდეო მზადაა','Your video is ready'):tx('სურათი მზადაა','Your picture is ready')):'';
 return <Modal {...APP_MODAL_PROPS} visible={visible} onRequestClose={onClose}>
  <LinearGradient colors={['#030712','#042F2E']} style={{flex:1,paddingTop:insets.top+8,paddingBottom:insets.bottom+14}}>
   <View style={{paddingHorizontal:20,flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}>
    <Copy bold size={12} style={{color:MINT,letterSpacing:1.5}}>{tx('MEDIRUN · გაზიარება','MEDIRUN · SHARE')}</Copy>
    <Pressable accessibilityRole="button" accessibilityLabel={tx('დახურვა','Close')} hitSlop={8} onPress={onClose} style={{width:40,height:40,borderRadius:14,backgroundColor:'rgba(255,255,255,0.10)',alignItems:'center',justifyContent:'center'}}><X size={18} color={WHITE}/></Pressable>
   </View>
   <View style={{flex:1,alignItems:'center',justifyContent:'center',gap:14}}>
    <View style={{width:boxW,height:boxH,borderRadius:24,overflow:'hidden',backgroundColor:'#030712'}}>
     {html?<WebView key={html.length+':'+run.current} source={{html,baseUrl}} originWhitelist={['*']} onMessage={onMessage} javaScriptEnabled domStorageEnabled
      onContentProcessDidTerminate={()=>{setPhase('error');setError(tx('ჩაწერა შეწყდა. სცადე თავიდან.','The recording stopped. Try again.'));}}
      onRenderProcessGone={()=>{setPhase('error');setError(tx('ჩაწერა შეწყდა. სცადე თავიდან.','The recording stopped. Try again.'));}}
      onShouldStartLoadWithRequest={r=>r.url===baseUrl||r.url==='about:blank'||r.url.startsWith('about:srcdoc')}
      scrollEnabled={false} bounces={false} overScrollMode="never" setSupportMultipleWindows={false} mixedContentMode="never" androidLayerType="hardware"
      allowFileAccess={false} allowFileAccessFromFileURLs={false} allowUniversalAccessFromFileURLs={false} style={{flex:1,backgroundColor:'transparent'}}/>:null}
     {phase==='preparing'||phase==='error'?<View pointerEvents="none" style={{position:'absolute',left:0,right:0,top:0,bottom:0,alignItems:'center',justifyContent:'center'}}>{phase==='preparing'?<ActivityIndicator color={MINT}/>:null}</View>:null}
    </View>
    {status?<View style={{alignItems:'center',gap:8,width:boxW}}>
     <Copy bold size={14} style={{color:WHITE}}>{status}</Copy>
     {phase==='recording'?<View style={{height:4,alignSelf:'stretch',borderRadius:2,backgroundColor:'rgba(255,255,255,0.12)',overflow:'hidden'}}><View style={{width:`${Math.round(progress*100)}%`,height:4,backgroundColor:'#2DD4BF'}}/></View>:null}
     {phase==='ready'&&!video?<Copy size={11} style={{color:'rgba(204,251,241,0.7)',textAlign:'center',fontFamily:REGULAR}}>{tx('ამ ტელეფონზე ვიდეოს ჩაწერა ვერ ხერხდება — სურათი იგივე ლამაზია.','This phone can’t record the video here — the picture looks just as good.')}</Copy>:null}
    </View>:null}
   </View>
   <View style={{paddingHorizontal:20,gap:10}}>
    {error?<View style={{padding:12,borderRadius:16,backgroundColor:'rgba(248,113,113,0.16)'}}><Copy size={13} style={{color:'#FECACA',textAlign:'center'}}>{error}</Copy></View>:null}
    {phase==='error'?<Action label={tx('თავიდან ცდა','Try again')} icon={RotateCcw} onPress={()=>void start()}/>
     :phase==='ready'?<>
      <Action label={video?tx('ვიდეოს გაზიარება','Share the video'):tx('სურათის გაზიარება','Share the picture')} icon={video?Clapperboard:Share2} busy={busy} disabled={!video&&!image} onPress={()=>void share(video?'video':'image')}/>
      {video&&image?<Action secondary label={tx('სურათის გაზიარება','Share the picture')} icon={ImageIcon} disabled={busy} onPress={()=>void share('image')}/>:null}
     </>
     :<Copy size={11} style={{color:'rgba(204,251,241,0.75)',textAlign:'center',fontFamily:REGULAR}}>{tx('ნუ დახურავ — რამდენიმე წამი. ბოლოში შენი მოწვევის ბმულია: ვინც მისით შემოვა, ორივე მიიღებთ Medi Coins-ს.','Keep this open — a few seconds. Your invite link is at the bottom: whoever joins with it, you both get Medi Coins.')}</Copy>}
   </View>
  </LinearGradient>
 </Modal>;
}
