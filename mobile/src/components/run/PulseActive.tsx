import React,{useEffect,useMemo,useRef,useState} from 'react';
import {ActivityIndicator,AppState,BackHandler,Image,Linking,Pressable,View} from 'react-native';
import {RUN_GIFT} from './runArt';
import {useIsFocused,useLocalSearchParams,useRouter} from 'expo-router';
import {activateKeepAwakeAsync,deactivateKeepAwake} from 'expo-keep-awake';
import {ArrowLeft,BookOpen,Building2,Check,Compass,Footprints,Gauge,Gift,LocateFixed,MoreHorizontal,Navigation,Route,Settings2,Timer,Trophy,Users} from 'lucide-react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import {hideFloatingTabBar} from '@/components/navigation/tabChrome';
import {useAuth} from '@/store/AuthContext';
import {useIsDark,useThemeColors} from '@/theme/colors';
import {cancelRun,finishRun,getRunState,onRunEvent,pauseRun,prepareExploration,recheckLocationPermission,resumeRun,runDerived,setLitBuildings,startRun,useRunSession} from '@/lib/run/store';
import {onReturnToForeground} from '@/lib/appForeground';
import {primerSettingsLabel} from '@/lib/permissionPrimer';
import {backgroundLocationAvailable} from '@/lib/run/locationTask';
import {formatClock,formatDistanceShort,formatPace} from '@/lib/run/geo';
import {splitDurations} from '@/lib/run/insights';
import {coverageFeatures} from '@/lib/medipulsi/core/journey';
import {missionPercent} from '@/lib/medipulsi/core/missions';
import {usePulse} from '@/lib/medipulsi/client';
import {useHeartbeat} from '@/lib/medipulsi/useHeartbeat';
import {nightAt} from '@/lib/medipulsi/daylight';
import {targetLabel} from '@/lib/run/labels';
import {RunMap,type RunMapHandle} from './RunMap';
import {RunDock} from './RunDock';
import {PulsePanels,type PulsePanel} from './PulsePanels';
import {PulseGift} from './PulseGift';
import {Action,Card,Copy,IconButton,RUN_CTA,RUN_TEAL,Sheet} from './PulseUi';
import {MediRunLogo,PulseGlyph} from './PulseIdentity';
import { tx } from '@/i18n/locale';
import {useFeature} from '@/lib/featureFlags';
import {useRunWeather} from '@/hooks/useRunWeather';
import {runWeatherFx} from '@/lib/run/runWeather';
import {weatherConditionLabel} from '@/lib/weather';
import {Meteocon,meteoconSlugFor} from '@/components/weather/Meteocon';

type Notice={text:string;tone:'info'|'success'|'warn';sticky?:boolean};
const KEEP_AWAKE_TAG='medirun-session';

export default function PulseActive(){
 const router=useRouter(),c=useThemeColors(),dark=useIsDark(),insets=useSafeAreaInsets(),{healthProfile,user}=useAuth(),run=useRunSession(),pulse=usePulse(),derived=runDerived(run);
 const map=useRef<RunMapHandle>(null),[ready,setReady]=useState(false),[following,setFollowing]=useState(true),[details,setDetails]=useState(false),[menu,setMenu]=useState(false),[finish,setFinish]=useState(false),[gift,setGift]=useState(false),[panel,setPanel]=useState<PulsePanel|null>(null),[busy,setBusy]=useState(false),[notice,setNotice]=useState<Notice|null>(null),[mapError,setMapError]=useState('');
 const settings=pulse.snapshot?.settings||{},running=run.phase==='running',active=running||run.phase==='paused';
 const testPulse=useHeartbeat(pulse.signal,settings,running);
 const [dockHeight,setDockHeight]=useState(170);
 const mission=pulse.snapshot?.missions.find(m=>m.id===pulse.book.selected);
 const [lit,setLit]=useState(0);   // buildings the Glow map lit during this session
 const center=run.current||run.origin;
 const mapDark=settings.mapMode==='night'||(settings.mapMode!=='day'&&Boolean(center&&nightAt(center.lat,center.lng)));
 const hapticOn=settings.haptic!==false;
 const hapticRef=useRef(hapticOn);hapticRef.current=hapticOn;
 const focused=useIsFocused(),params=useLocalSearchParams<{resume?:string;gift?:string}>();
 // Live weather where the runner is: the map rains when it rains there (admin „ამინდი“ switch pauses it).
 const weather=useRunWeather(center,useFeature('weather')&&focused);
 const fx=useMemo(()=>runWeatherFx(weather?.snapshot),[weather?.snapshot]);
 // Crew members walking next to you right now (nicknames only — never where they are).
 const together=running?pulse.signal.together||null:null;
 const pills=Boolean(mission||lit>0||weather||together);
 // While the phone is locked or another app is open the map gets nothing; coming back sends the latest state once.
 const [appActive,setAppActive]=useState(AppState.currentState!=='background'),[mapEpoch,setMapEpoch]=useState(0);
 const live=ready&&appActive;
 useEffect(()=>{const sub=AppState.addEventListener('change',next=>setAppActive(next!=='background'));return()=>sub.remove();},[]);
 useEffect(()=>hideFloatingTabBar(),[]);
 // Like a navigation app: while a session records and its map is on screen, the screen does not dim and lock.
 // A long drive (drive mode) lets it sleep — the session keeps recording in the background.
 useEffect(()=>{if(!running||!focused||run.driving)return;void activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(()=>{});return()=>{void deactivateKeepAwake(KEEP_AWAKE_TAG).catch(()=>{});};},[running,focused,run.driving]);
 useEffect(()=>{if(run.phase==='finished')router.replace('/run/summary' as never);},[run.phase,router]);
 useEffect(()=>{if(pulse.conflict&&running)pauseRun();},[pulse.conflict,running]);
 // Transient notices fade on their own; warnings stay until tapped.
 useEffect(()=>{if(!notice||notice.sticky)return;const t=setTimeout(()=>setNotice(null),notice.tone==='success'?6000:4500);return()=>clearTimeout(t);},[notice]);
 useEffect(()=>onRunEvent(event=>{
  if(event==='km_split'){
   const s=getRunState(),km=s.splits.length,last=splitDurations(s.splits).at(-1);
   setNotice({text:last!=null?tx(`${km} კმ · ამ კილომეტრის ტემპი ${formatPace(last/1000)}`, `${km} km · pace for this kilometer ${formatPace(last/1000)}`):tx(`${km} კმ გაიარე — ასე გააგრძელე!`, `${km} km done — keep it up!`),tone:'success'});
   if(hapticRef.current)void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).then(()=>new Promise(r=>setTimeout(r,140))).then(()=>Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)).catch(()=>{});
   return;
  }
  if(event==='transport_warning'){if(hapticRef.current)void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(()=>{});return;}
  if(event==='transport_resumed'){setNotice({text:tx('ათვლა განახლდა — გააგრძელე!', 'Counting again — keep going!'),tone:'success'});return;}
  if(event==='auto_resumed'){setNotice({text:tx('სესია გაგრძელდა — შენი გზა ისევ იწერება', 'Session resumed — your path is recording again'),tone:'success'});return;}
  if(event==='target_completed'||event==='pin_reached'){setNotice({text:event==='target_completed'?tx('მიზანი შესრულებულია! შეგიძლია გააგრძელო აღმოჩენა.', 'Goal reached! You can keep exploring.'):tx('დანიშნულების ადგილს მიაღწიე!', 'You’ve reached your destination!'),tone:'success'});void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(()=>{});}
 }),[]);
 // „ერთად“: a crew member joins you → one tap on the wrist and a line; each paid together-km says so.
 const togetherCount=together?.count||0,togetherCoins=together?.coins||0,prevTogether=useRef(0);
 useEffect(()=>{
  if(togetherCount>0&&prevTogether.current===0&&together){setNotice({text:tx(`${together.with.join(', ')} შენ გვერდითაა — ერთად ანათებთ ქალაქს`,`${together.with.join(', ')} is right next to you — you’re lighting the city together`),tone:'success'});if(hapticRef.current)void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(()=>{});}
  prevTogether.current=togetherCount;
 },[togetherCount]);// eslint-disable-line react-hooks/exhaustive-deps
 useEffect(()=>{if(togetherCoins>0)setNotice({text:tx(`+${togetherCoins} Medi Coins · ერთად გავლილი კილომეტრი`,`+${togetherCoins} Medi Coins · a kilometre together`),tone:'success'});},[togetherCoins,together?.meters]);// eslint-disable-line react-hooks/exhaustive-deps
 // Starter box (new players): say once that it is close, and open the reveal by itself the moment it is in reach.
 const starterLeft=running?pulse.signal.starter?.pending.meters:undefined,starterTold=useRef(false),opened=useRef(new Set<string>());
 useEffect(()=>{if(starterLeft==null||starterTold.current)return;starterTold.current=true;setNotice({text:tx(`პირველი ყუთი ახლოსაა — გაიარე კიდევ ${Math.max(10,Math.round(starterLeft/10)*10)} მ`,`Your first box is close — walk ${Math.max(10,Math.round(starterLeft/10)*10)} m more`),tone:'info'});},[starterLeft]);
 const starterId=running&&pulse.signal.revealed&&pulse.signal.gift?.starter?pulse.signal.gift.id:null;
 useEffect(()=>{if(!starterId||opened.current.has(starterId)||!focused)return;opened.current.add(starterId);if(hapticRef.current)void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(()=>{});setGift(true);},[starterId,focused]);
 const leave=()=>{if(active){if(running)pauseRun();setFinish(true);}else{cancelRun();router.replace('/run' as never);}};
 useEffect(()=>{const sub=BackHandler.addEventListener('hardwareBackPress',()=>{leave();return true;});return()=>sub.remove();},[active,running]);
 useEffect(()=>{if(!live||!run.origin)return;map.current?.send({type:'init',origin:run.current||run.origin,pin:run.pin,route:run.route?.coords||null,fit:false,hero:user?.gender==='FEMALE'?'f':'m'});},[live,mapEpoch,run.origin,run.pin,run.route,user?.gender]);
 useEffect(()=>{if(live)map.current?.send({type:'activity',value:running?'auto':'idle'});},[live,mapEpoch,running]);
 useEffect(()=>{if(live)map.current?.send({type:'layout',top:insets.top+8+44+8+(pills?42:0),bottom:Math.max(12,insets.bottom)+dockHeight+12});},[live,mapEpoch,insets.top,insets.bottom,dockHeight,pills]);
 useEffect(()=>{if(live&&run.current)map.current?.send({type:'fix',lat:run.current.lat,lng:run.current.lng,heading:run.headingDeg,speed:running?run.speedKmh/3.6:0});},[live,mapEpoch,run.current,run.headingDeg]);
 const paint=useMemo(()=>[...(pulse.journey.trail||[]),...coverageFeatures(pulse.journey).features.map(f=>f.geometry.coordinates)], [pulse.journey.trail,pulse.journey.covered]);
 useEffect(()=>{if(live)map.current?.send({type:'paint',lines:paint});},[live,mapEpoch,paint]);
 useEffect(()=>{if(live)map.current?.send({type:'mission',center:mission?.center||null,radius:mission?.radius});},[live,mapEpoch,mission]);
 useEffect(()=>{if(live)map.current?.send({type:'gift',position:running&&pulse.signal.revealed?pulse.signal.gift?.position||null:null});},[live,mapEpoch,running,pulse.signal.revealed,pulse.signal.gift]);
 useEffect(()=>{if(live)map.current?.send({type:'weather',fx});},[live,mapEpoch,fx?.kind,fx?.wind]);
 useEffect(()=>{if(live)map.current?.send({type:'options',rotate:settings.followBearing!==false,threeD:settings.threeD!==false});},[live,mapEpoch,settings.followBearing,settings.threeD]);
 const begin=async()=>{if(busy)return;setBusy(true);try{await (run.phase==='paused'?resumeRun():startRun());}finally{setBusy(false);}};
 const end=async()=>{if(busy)return;setBusy(true);try{await finishRun();setFinish(false);}finally{setBusy(false);}};
 // „გაგრძელება“ on the lock-screen Live Activity opens medicard://run/active?resume=1.
 useEffect(()=>{if(params.resume!=='1'||(run.phase!=='paused'&&run.phase!=='running'))return;router.setParams({resume:undefined} as never);if(run.phase==='paused')void begin();},[params.resume,run.phase]);
 // „საჩუქარი გვერდითაა“ notification opens medicard://run/active?gift=1: the camera finder opens once the pulse confirms it.
 useEffect(()=>{if(params.gift!=='1'||!running||!pulse.signal.revealed)return;router.setParams({gift:undefined} as never);setGift(true);},[params.gift,running,pulse.signal.revealed]);
 // Location refused and the OS will not ask again: the button opens Settings. Back in the app, the permission
 // is re-read (never requested) and, once it is on, the location is found by itself.
 const locationOff=run.error==='permission'&&run.permissionBlocked;
 useEffect(()=>{if(!focused||run.error!=='permission')return;return onReturnToForeground(()=>void recheckLocationPermission({weightKg:healthProfile?.weightKg,heightCm:healthProfile?.heightCm}));},[focused,run.error,healthProfile?.weightKg,healthProfile?.heightCm]);
 const openPanel=(value:PulsePanel)=>{setMenu(false);setPanel(value);};
 const gpsGood=run.accuracyM!=null&&run.accuracyM<=25;
 const remaining=run.targetMeters>0?Math.max(0,run.targetMeters-run.distanceM):0;
 const status=running?(run.transportWarning?(run.driving?tx('მანქანაში · სესია ავტო-პაუზაზეა', 'In a vehicle · session auto-paused'):tx('ტრანსპორტი · პროგრესი პაუზაზეა', 'Vehicle · progress on hold')):gpsGood?tx('შენი გზა ფერადდება', 'Your path is filling with color'):tx('ზუსტ GPS-ს ველოდებით', 'Waiting for accurate GPS')):run.phase==='paused'?tx('პაუზა · შენი გზა შენახულია', 'Paused · your path is saved'):tx('დღეს სად მიგიყვანს გზა?', 'Where will your path take you today?');
 // System messages outrank transient toasts.
 const banner:Notice|null=run.syncError?{text:run.syncError,tone:'warn',sticky:true}:mapError?{text:mapError,tone:'warn',sticky:true}:run.error==='location'?{text:tx('GPS შეწყდა. შეამოწმე მდებარეობის წვდომა და გააგრძელე.', 'GPS stopped. Check location access and continue.'),tone:'warn',sticky:true}:run.transportWarning?{text:run.transportResuming?tx('სიჩქარე დაიკლო · ათვლა გაგრძელდება, როცა რამდენიმე წამს ფეხით იმოძრავებ.', 'Speed dropped · counting resumes after a few seconds on foot.'):run.driving?tx('მანქანაში ხარ · დრო და მანძილი შეჩერებულია. ეკრანი შეგიძლია ჩაკეტო — ფეხით სვლისას ათვლა თავისით გაგრძელდება.', 'You’re in a vehicle · time and distance are on hold. You can lock the screen — counting resumes on its own once you walk.'):tx(`მაღალი სიჩქარე (${Math.round(run.speedKmh)} კმ/სთ) · ტრანსპორტში მანძილი და აქტიური დრო არ ითვლება. სიჩქარე რომ დაიკლებს, ათვლა თავისით გაგრძელდება.`, `High speed (${Math.round(run.speedKmh)} km/h) · distance and active time don’t count in a vehicle. Counting resumes on its own once you slow down.`),tone:'warn',sticky:true}:notice;
 const bannerColor=banner?.tone==='success'?RUN_TEAL:banner?.tone==='warn'?'#F59E0B':c.primary100;
 return <View style={{flex:1,backgroundColor:c.bg100}}>
  {center?<RunMap ref={map} center={center} mapDark={mapDark} onReady={()=>{setReady(true);setMapEpoch(e=>e+1);}} onFollowChange={setFollowing} onError={setMapError} onLit={n=>{setLit(n);setLitBuildings(n);}}/>:<View style={{flex:1,alignItems:'center',justifyContent:'center',padding:30,gap:18}}>
   <View style={{width:88,height:88,borderRadius:44,backgroundColor:c.accent100,alignItems:'center',justifyContent:'center'}}><Compass color={c.primary100} size={40}/></View>
   {run.phase==='preparing'?<><ActivityIndicator color={RUN_TEAL}/><Copy>{tx('შენი მდებარეობა იძებნება…', 'Finding your location…')}</Copy></>:<><Copy bold size={22} style={{textAlign:'center'}}>{tx('მზად ხარ გასასვლელად?', 'Ready to head out?')}</Copy><Copy muted style={{textAlign:'center'}}>{locationOff?tx('მდებარეობაზე წვდომა გამორთულია. ჩართე ტელეფონის პარამეტრებში და აქ დაბრუნდი.', 'Location access is off. Turn it on in your phone’s Settings, then come back here.'):run.error==='permission'?tx('MEDIRUN-ს მდებარეობის წვდომა სჭირდება, რომ შენი გზა დახატოს.', 'MEDIRUN needs location access to draw your path.'):tx('დავიწყოთ შენი მდებარეობიდან.', 'Let’s start from your location.')}</Copy><View style={{alignSelf:'stretch'}}>{locationOff?<Action label={primerSettingsLabel()} icon={Settings2} onPress={()=>void Linking.openSettings().catch(()=>{})}/>:<Action label={tx('მდებარეობის მიღება', 'Get my location')} icon={LocateFixed} onPress={()=>void prepareExploration({weightKg:healthProfile?.weightKg,heightCm:healthProfile?.heightCm})}/>}</View><Action secondary label={tx('უკან დაბრუნება', 'Go back')} onPress={leave}/></>}
  </View>}
  <View pointerEvents="box-none" style={{position:'absolute',top:insets.top+8,left:14,right:14,gap:8}}>
   <View style={{flexDirection:'row',alignItems:'center',gap:8}}>
    <IconButton floating label={tx('უკან', 'Back')} icon={ArrowLeft} onPress={leave}/>
    <Card floating style={{flex:1,paddingVertical:7,paddingHorizontal:14,borderRadius:18,gap:0}}>
     <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}><MediRunLogo size={16}/><View accessibilityLabel={gpsGood?tx('GPS ზუსტია', 'GPS is accurate'):tx('GPS სუსტია', 'GPS is weak')} style={{flexDirection:'row',alignItems:'center',gap:5}}>{[0,1,2].map(i=><View key={i} style={{width:3,height:5+i*3,borderRadius:2,backgroundColor:run.accuracyM==null?c.bg300:run.accuracyM<=(i===0?45:i===1?25:12)?RUN_TEAL:c.bg300}}/>)}<View style={{width:7,height:7,borderRadius:4,marginLeft:4,backgroundColor:running?RUN_TEAL:run.phase==='paused'?'#F59E0B':c.text300}}/></View></View>
     <Copy size={10} muted numberOfLines={1}>{status}</Copy>
    </Card>
    <IconButton floating label={tx('მენიუ', 'Menu')} icon={MoreHorizontal} onPress={()=>setMenu(true)}/>
   </View>
   {pills?<View pointerEvents="box-none" style={{flexDirection:'row',alignItems:'center',flexWrap:'wrap',gap:8}}>{mission?<Pressable accessibilityRole="button" accessibilityLabel={tx(`მისია ${mission.name}, ${missionPercent(pulse.book,mission)} პროცენტი`, `Mission ${mission.name}, ${missionPercent(pulse.book,mission)} percent`)} onPress={()=>setPanel('missions')} style={{flexDirection:'row',alignItems:'center',gap:7,backgroundColor:c.surface,borderRadius:16,paddingVertical:8,paddingHorizontal:12,shadowColor:'#030712',shadowOpacity:.14,shadowRadius:10,shadowOffset:{width:0,height:4},elevation:4}}><Compass size={13} color={c.primary100}/><Copy size={11} bold>{mission.name}</Copy><View style={{width:1,height:12,backgroundColor:c.bg300}}/><Copy size={11} bold style={{color:c.primary100}}>{missionPercent(pulse.book,mission)}%</Copy></Pressable>:null}{lit>0?<View accessible accessibilityLabel={tx(`ანთია ${lit} შენობა`, `${lit} buildings lit`)} style={{flexDirection:'row',alignItems:'center',gap:7,backgroundColor:c.surface,borderRadius:16,paddingVertical:8,paddingHorizontal:12,shadowColor:'#030712',shadowOpacity:.14,shadowRadius:10,shadowOffset:{width:0,height:4},elevation:4}}><Building2 size={13} color={dark?'#FCD34D':'#B45309'}/><Copy size={11} bold style={{color:dark?'#FCD34D':'#B45309',fontVariant:['tabular-nums']}}>{lit}</Copy><Copy size={11} muted>{tx('ანთია', 'lit')}</Copy></View>:null}{together?<View accessible accessibilityLabel={tx(`ერთად: ${together.with.join(', ')}`,`Together: ${together.with.join(', ')}`)} style={{flexDirection:'row',alignItems:'center',gap:7,backgroundColor:c.surface,borderRadius:16,paddingVertical:8,paddingHorizontal:12,shadowColor:'#030712',shadowOpacity:.14,shadowRadius:10,shadowOffset:{width:0,height:4},elevation:4}}><Users size={13} color={RUN_TEAL}/><Copy size={11} bold style={{color:RUN_TEAL}}>{tx('ერთად','Together')}</Copy><Copy size={11} muted numberOfLines={1} style={{maxWidth:120}}>{together.with.join(', ')}</Copy></View>:null}{weather?<WeatherBadge weather={weather} onPress={()=>setNotice({text:weatherLine(weather),tone:'info'})}/>:null}</View>:null}
   {banner?<Pressable accessibilityRole="button" accessibilityLabel={tx('შეტყობინების დახურვა', 'Dismiss message')} onPress={()=>{setNotice(null);setMapError('');}}><Card floating style={{paddingVertical:11,paddingHorizontal:14,borderRadius:16,flexDirection:'row',alignItems:'center',gap:10}}><View style={{width:4,alignSelf:'stretch',borderRadius:2,backgroundColor:bannerColor}}/><Copy size={12} bold={banner.tone==='success'} style={{flex:1}}>{banner.text}</Copy></Card></Pressable>:null}
  </View>
  {center?<View pointerEvents="box-none" style={{position:'absolute',bottom:Math.max(12,insets.bottom)+dockHeight+12,right:14,alignItems:'flex-end',gap:9}}><IconButton floating label={tx('ჩემს მდებარეობაზე დაბრუნება', 'Back to my location')} icon={LocateFixed} active={following} onPress={()=>map.current?.send({type:'follow'})}/></View>:null}
  {center?<View onLayout={event=>setDockHeight(event.nativeEvent.layout.height)} style={{position:'absolute',bottom:Math.max(12,insets.bottom),left:14,right:14,gap:10}}>
   {running&&pulse.signal.signal?<Pressable accessibilityRole="button" accessibilityLabel={pulse.signal.revealed?tx('საჩუქრის აღმოჩენა', 'Find the gift'):tx('გულისცემის სიგნალი', 'Heartbeat signal')} onPress={()=>{if(pulse.signal.revealed)setGift(true);else setNotice({text:tx('მოუსმინე რიტმს. უფრო სწრაფი ორმაგი პულსი ნიშნავს, რომ უახლოვდები.', 'Listen to the rhythm. A faster double pulse means you’re getting closer.'),tone:'info'});}} style={{backgroundColor:pulse.signal.revealed?RUN_CTA:c.surface,borderRadius:22,padding:12,flexDirection:'row',alignItems:'center',gap:12,shadowColor:'#030712',shadowOpacity:.16,shadowRadius:14,shadowOffset:{width:0,height:6},elevation:6}}><PulseGlyph active period={pulse.signal.period}/><View style={{flex:1}}><Copy bold size={13} style={pulse.signal.revealed?{color:'#fff'}:undefined}>{pulse.signal.revealed?tx('აღმოჩენა შენ გვერდითაა', 'The find is right next to you'):tx('გესმის? რაღაც ახლოსაა…', 'Hear that? Something’s nearby…')}</Copy><Copy size={11} style={{color:pulse.signal.revealed?'#CCFBF1':c.text200}}>{pulse.signal.revealed?tx('შეეხე და გახსენი', 'Tap to open it'):tx('მოუსმინე პულსს · მიჰყევი რიტმს', 'Listen to the pulse · follow the rhythm')}</Copy></View>{pulse.signal.revealed?<Image source={RUN_GIFT} accessibilityIgnoresInvertColors style={{width:34,height:34}}/>:null}</Pressable>:null}
   <RunDock run={run} pace={derived.pace} progress={derived.progress} busy={busy} onPrimary={()=>running?pauseRun():void begin()} onFinish={()=>{if(running)pauseRun();setFinish(true);}} onDetails={()=>setDetails(true)}/>
  </View>:null}
  <Sheet title={tx('შენი გასეირნება', 'Your walk')} visible={details} onClose={()=>setDetails(false)}>
   <Card><Copy bold size={18}>{run.target?targetLabel(run.target):tx('თავისუფალი გასეირნება', 'Free walk')}</Copy>{[{label:tx('სავარაუდო ნაბიჯები', 'Estimated steps'),value:derived.steps.toLocaleString(),icon:Footprints},{label:tx('საშუალო ტემპი', 'Average pace'),value:formatPace(derived.pace)+tx(' /კმ', ' /km'),icon:Gauge},{label:tx('მიმდინარე სიჩქარე', 'Current speed'),value:run.speedKmh.toFixed(1)+tx(' კმ/სთ', ' km/h'),icon:Navigation},{label:tx('სესიის დრო პაუზების ჩათვლით', 'Session time incl. pauses'),value:formatClock(run.elapsedMs),icon:Timer},{label:tx('GPS სიზუსტე', 'GPS accuracy'),value:run.accuracyM==null?tx('ველოდებით', 'Waiting'):Math.round(run.accuracyM)+tx(' მ', ' m'),icon:LocateFixed}].map(row=><View key={row.label} style={{flexDirection:'row',gap:10,alignItems:'center',minHeight:30}}><row.icon size={18} color={c.primary100}/><Copy muted size={12} style={{flex:1}}>{row.label}</Copy><Copy bold size={13}>{row.value}</Copy></View>)}</Card>
   {run.splits.length?<Card><Copy bold>{tx('კილომეტრები', 'Kilometers')}</Copy>{splitDurations(run.splits).map((ms,i)=><View key={i} style={{flexDirection:'row',alignItems:'center',gap:10}}><Copy muted size={12} style={{flex:1}}>{i+1} {tx('კმ', 'km')}</Copy><Copy bold size={13} style={{fontVariant:['tabular-nums']}}>{ms!=null?formatPace(ms/1000):'–'}</Copy></View>)}</Card>:null}
   <Card><Copy bold>{pulse.pending?tx('შენახულია ტელეფონში · იგზავნება', 'Saved on your phone · sending'):tx('ანგარიშთან სინქრონიზაცია', 'Syncing with your account')}</Copy><Copy muted>{pulse.message}</Copy><Copy muted size={12}>{backgroundLocationAvailable()?tx('რუკაზე ყოფნისას ეკრანი ანთებული რჩება. ტელეფონი შეგიძლია ჩაკეტო ან სხვა აპი გახსნა — სესია ფონზეც იწერება, სანამ პაუზას ან დასრულებას არ დააჭერ.', 'The screen stays on while the map is open. You can lock your phone or open another app — the session keeps recording in the background until you pause or finish it.'):tx('სესიის დროს ეკრანი ანთებული რჩება. თუ აპიდან გახვალ ან ტელეფონს ჩაკეტავ, სესია პაუზდება და დაბრუნებისას თავისით გაგრძელდება.', 'The screen stays on during a session. If you leave the app or lock your phone, the session pauses and continues on its own when you’re back.')}</Copy></Card>
  </Sheet>
  <Sheet title={tx('შენი მოძრაობის სივრცე', 'Your activity space')} visible={menu} onClose={()=>setMenu(false)}><Action secondary label={tx('გავლილი გზების რუკა', 'Map of your paths')} icon={Route} disabled={paint.length===0} onPress={()=>{setMenu(false);map.current?.send({type:'fit',bottom:dockHeight+35,paintOnly:true});}}/>{([{id:'missions',label:tx('თბილისის პასპორტი', 'Tbilisi passport'),icon:Compass},{id:'collection',label:tx('ჩემი აღმოჩენები', 'My finds'),icon:Gift},{id:'leaderboard',label:tx('ლიდერბორდი', 'Leaderboard'),icon:Trophy},{id:'settings',label:tx('პარამეტრები', 'Settings'),icon:Settings2},{id:'help',label:tx('როგორ მუშაობს?', 'How it works'),icon:BookOpen}] as const).map(item=><Action key={item.id} secondary label={item.label} icon={item.icon} onPress={()=>openPanel(item.id)}/>)}</Sheet>
  <Sheet title={tx('დავასრულოთ გასეირნება?', 'Finish your walk?')} visible={finish} onClose={()=>setFinish(false)}>
   <Card style={{gap:16}}>
    <View style={{flexDirection:'row'}}>{[{label:tx('მანძილი', 'Distance'),value:formatDistanceShort(run.distanceM)},{label:tx('დრო', 'Time'),value:formatClock(run.movingMs)},{label:tx('ტემპი', 'Pace'),value:formatPace(derived.pace)}].map((s,i)=><View key={s.label} style={{flex:1,alignItems:i===0?'flex-start':i===2?'flex-end':'center'}}><Copy muted size={11}>{s.label}</Copy><Copy bold size={i===0?24:18} style={{fontVariant:['tabular-nums']}}>{s.value}</Copy></View>)}</View>
    <Copy muted size={13}>{tx('გავლილი გზა, მისიის პროგრესი და აღმოჩენები შენარჩუნდება. კავშირის გარეშე ჩანაწერი გაგზავნას დაელოდება.', 'Your path, mission progress and finds are kept. Without a connection, the record waits to be sent.')}</Copy>
    <Action label={tx('დასრულება და შენახვა', 'Finish and save')} icon={Check} busy={busy} onPress={()=>void end()}/>
    <Action secondary label={tx('ჯერ პაუზაზე დარჩეს', 'Stay paused for now')} onPress={()=>setFinish(false)}/>
   </Card>
  </Sheet>
  <PulsePanels panel={panel} onClose={()=>setPanel(null)} onTestPulse={()=>void testPulse()}/><PulseGift visible={gift} signal={pulse.signal} onClose={()=>setGift(false)}/>
 </View>;
}

/** „ახლა გარეთ“: one line for the badge tap — city, temperature, sky and wind. */
function weatherLine({snapshot,city}:NonNullable<ReturnType<typeof useRunWeather>>):string{
 const cur=snapshot.current,parts=[city,`${Math.round(cur.temperatureC)}°`,weatherConditionLabel(cur.condition)];
 if(cur.windKmh>=15)parts.push(tx(`ქარი ${Math.round(cur.windKmh)} კმ/სთ`,`wind ${Math.round(cur.windKmh)} km/h`));
 if(Math.round(cur.feelsLikeC)!==Math.round(cur.temperatureC))parts.push(tx(`იგრძნობა ${Math.round(cur.feelsLikeC)}°`,`feels like ${Math.round(cur.feelsLikeC)}°`));
 return parts.filter(Boolean).join(' · ');
}

/** Small weather pill beside the mission / lit pills: the sky icon, the temperature and the city. */
function WeatherBadge({weather,onPress}:{weather:NonNullable<ReturnType<typeof useRunWeather>>;onPress:()=>void}){
 const c=useThemeColors(),cur=weather.snapshot.current;
 return <Pressable accessibilityRole="button" accessibilityLabel={tx(`ამინდი: ${weatherLine(weather)}`,`Weather: ${weatherLine(weather)}`)} onPress={onPress} style={{flexDirection:'row',alignItems:'center',gap:4,backgroundColor:c.surface,borderRadius:16,paddingVertical:4,paddingLeft:6,paddingRight:12,minHeight:33,shadowColor:'#030712',shadowOpacity:.14,shadowRadius:10,shadowOffset:{width:0,height:4},elevation:4}}>
  <View style={{width:24,height:24,overflow:'hidden',alignItems:'center',justifyContent:'center'}}><Meteocon slug={meteoconSlugFor(cur.condition,cur.isDay)} size={24}/></View>
  <Copy size={11} bold style={{fontVariant:['tabular-nums']}}>{`${Math.round(cur.temperatureC)}°`}</Copy>
  {weather.city?<Copy size={11} muted numberOfLines={1} style={{maxWidth:110}}>{weather.city}</Copy>:null}
 </Pressable>;
}
