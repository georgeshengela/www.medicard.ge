import React,{useEffect,useMemo,useRef,useState} from 'react';
import {ActivityIndicator,BackHandler,Pressable,View} from 'react-native';
import {useRouter} from 'expo-router';
import {ArrowLeft,BookOpen,Check,Compass,Flag,Footprints,Gift,Heart,LocateFixed,MoreHorizontal,Navigation,Pause,Play,Route,Settings2,Timer,Trophy,Volume2} from 'lucide-react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import {hideFloatingTabBar} from '@/components/navigation/tabChrome';
import {useAuth} from '@/store/AuthContext';
import {useThemeColors} from '@/theme/colors';
import {cancelRun,finishRun,onRunEvent,pauseRun,prepareExploration,resumeRun,runDerived,startRun,useRunSession} from '@/lib/run/store';
import {formatClock,formatDistanceShort} from '@/lib/run/geo';
import {coverageFeatures} from '@/lib/medipulsi/core/journey';
import {missionPercent} from '@/lib/medipulsi/core/missions';
import {getPulseClient,usePulse} from '@/lib/medipulsi/client';
import {useHeartbeat} from '@/lib/medipulsi/useHeartbeat';
import {nightAt} from '@/lib/medipulsi/daylight';
import {targetLabel} from '@/lib/run/labels';
import {RunMap,type RunMapHandle} from './RunMap';
import {PulsePanels,type PulsePanel} from './PulsePanels';
import {PulseGift} from './PulseGift';
import {Action,Card,Copy,IconButton,Sheet} from './PulseUi';
import {MediRunLogo,PulseGlyph} from './PulseIdentity';

export default function PulseActive(){
 const router=useRouter(),c=useThemeColors(),insets=useSafeAreaInsets(),{healthProfile}=useAuth(),run=useRunSession(),pulse=usePulse(),derived=runDerived(run);
 const map=useRef<RunMapHandle>(null),[ready,setReady]=useState(false),[following,setFollowing]=useState(true),[details,setDetails]=useState(false),[menu,setMenu]=useState(false),[finish,setFinish]=useState(false),[gift,setGift]=useState(false),[panel,setPanel]=useState<PulsePanel|null>(null),[busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[mapError,setMapError]=useState(''),[minute,setMinute]=useState(0);
 const settings=pulse.snapshot?.settings||{},running=run.phase==='running',active=running||run.phase==='paused';
 const testPulse=useHeartbeat(pulse.signal,settings,running);
 const [dockHeight,setDockHeight]=useState(150);
 const mission=pulse.snapshot?.missions.find(m=>m.id===pulse.book.selected);
 const center=run.current||run.origin;
 const mapDark=settings.mapMode==='night'||(settings.mapMode!=='day'&&Boolean(center&&nightAt(center.lat,center.lng)));
 useEffect(()=>hideFloatingTabBar(),[]);
 useEffect(()=>{const timer=setInterval(()=>setMinute(x=>x+1),60000);return()=>clearInterval(timer);},[]);
 useEffect(()=>{if(run.phase==='finished')router.replace('/run/summary' as never);},[run.phase,router]);
 useEffect(()=>{if(pulse.conflict&&running)pauseRun();},[pulse.conflict,running]);
 useEffect(()=>onRunEvent(event=>{if(event==='target_completed'||event==='pin_reached'){setNotice(event==='target_completed'?'მიზანი შესრულებულია! შეგიძლია გააგრძელო აღმოჩენა.':'დანიშნულების ადგილს მიაღწიე!');void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(()=>{});}}),[]);
 const leave=()=>{if(active){if(running)pauseRun();setFinish(true);}else{cancelRun();router.replace('/run' as never);}};
 useEffect(()=>{const sub=BackHandler.addEventListener('hardwareBackPress',()=>{leave();return true;});return()=>sub.remove();},[active,running]);
 useEffect(()=>{if(!ready||!run.origin)return;map.current?.send({type:'init',origin:run.current||run.origin,pin:run.pin,route:run.route?.coords||null,fit:false});},[ready,run.origin,run.pin,run.route]);
 useEffect(()=>{if(ready&&run.current)map.current?.send({type:'fix',lat:run.current.lat,lng:run.current.lng,heading:run.headingDeg});},[ready,run.current,run.headingDeg]);
 const paint=useMemo(()=>[...(pulse.journey.trail||[]),...coverageFeatures(pulse.journey).features.map(f=>f.geometry.coordinates)], [pulse.journey.trail,pulse.journey.covered]);
 useEffect(()=>{if(ready)map.current?.send({type:'paint',lines:paint});},[ready,paint]);
 useEffect(()=>{if(ready)map.current?.send({type:'mission',center:mission?.center||null,radius:mission?.radius});},[ready,mission]);
 useEffect(()=>{if(ready)map.current?.send({type:'gift',position:running&&pulse.signal.revealed?pulse.signal.gift?.position||null:null});},[ready,running,pulse.signal.revealed,pulse.signal.gift]);
 useEffect(()=>{if(ready)map.current?.send({type:'options',rotate:settings.followBearing!==false,threeD:settings.threeD!==false});},[ready,settings.followBearing,settings.threeD]);
 const begin=async()=>{if(busy)return;setBusy(true);try{await (run.phase==='paused'?resumeRun():startRun());}finally{setBusy(false);}};
 const end=async()=>{if(busy)return;setBusy(true);try{await finishRun();setFinish(false);}finally{setBusy(false);}};
 const openPanel=(value:PulsePanel)=>{setMenu(false);setPanel(value);};
 return <View style={{flex:1,backgroundColor:c.bg100}}>
  {center?<RunMap ref={map} center={center} mapDark={mapDark} onReady={()=>setReady(true)} onFollowChange={setFollowing} onError={setMapError}/>:<View style={{flex:1,alignItems:'center',justifyContent:'center',padding:30,gap:20}}><Compass color={c.primary100} size={44}/>{run.phase==='preparing'?<><ActivityIndicator color="#14B8A6"/><Copy>შენი მდებარეობა იძებნება…</Copy></>:<><Copy bold size={22}>მზად ხარ გასასვლელად?</Copy><Copy muted>{run.error==='permission'?'MEDI RUN-ს მდებარეობის წვდომა სჭირდება.':'დავიწყოთ შენი მდებარეობიდან.'}</Copy><Action label="მდებარეობის მიღება" icon={LocateFixed} onPress={()=>void prepareExploration({weightKg:healthProfile?.weightKg,heightCm:healthProfile?.heightCm})}/></>}</View>}
  <View pointerEvents="box-none" style={{position:'absolute',top:insets.top+8,left:14,right:14,gap:8}}>
   <View style={{flexDirection:'row',alignItems:'center',gap:8}}><IconButton label="უკან" icon={ArrowLeft} onPress={leave}/><Card style={{flex:1,paddingVertical:8,paddingHorizontal:14,borderRadius:23,gap:1}}><View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}><MediRunLogo size={17}/><View style={{width:6,height:6,borderRadius:3,backgroundColor:running?'#14B8A6':c.text300}}/></View><Copy size={10} muted>{running?(run.accuracyM!=null&&run.accuracyM<=25?'შენი გზა ფერადდება':'ზუსტ GPS-ს ველოდებით'):run.phase==='paused'?'პაუზა · შენი გზა შენახულია':'დღეს სად მიგიყვანს გზა?'}</Copy></Card><IconButton label="მენიუ" icon={MoreHorizontal} onPress={()=>setMenu(true)}/></View>
   {mission?<Pressable accessibilityRole="button" onPress={()=>setPanel('missions')} style={{alignSelf:'flex-start',flexDirection:'row',alignItems:'center',gap:7,backgroundColor:c.surface,borderRadius:18,paddingVertical:8,paddingHorizontal:12,borderWidth:1,borderColor:c.bg300}}><Compass size={13} color={c.primary100}/><Copy size={10} bold>{mission.name}</Copy><View style={{width:1,height:12,backgroundColor:c.bg300}}/><Copy size={10} bold style={{color:c.primary100}}>{missionPercent(pulse.book,mission)}%</Copy></Pressable>:null}
   {(run.syncError||mapError||notice||run.transportWarning||run.error==='location')?<Pressable accessibilityRole="button" accessibilityLabel="შეტყობინების დახურვა" onPress={()=>{setNotice('');setMapError('');}}><Card style={{padding:10,borderRadius:14}}><Copy size={12}>{run.syncError||mapError||notice||(run.error==='location'?'GPS შეწყდა. შეამოწმე მდებარეობის წვდომა და გააგრძელე.':'მაღალი სიჩქარე — ეს მოძრაობა პროგრესში არ ითვლება.')}</Copy></Card></Pressable>:null}
  </View>
  {center?<View pointerEvents="box-none" style={{position:'absolute',bottom:Math.max(12,insets.bottom)+dockHeight+12,right:14,alignItems:'flex-end',gap:9}}><IconButton label="ჩემს მდებარეობაზე დაბრუნება" icon={LocateFixed} active={following} onPress={()=>map.current?.send({type:'follow'})}/></View>:null}
  {center?<View onLayout={event=>setDockHeight(event.nativeEvent.layout.height)} style={{position:'absolute',bottom:Math.max(12,insets.bottom),left:14,right:14,gap:10}}>
   {running&&pulse.signal.signal?<Pressable accessibilityRole="button" accessibilityLabel={pulse.signal.revealed?'საჩუქრის აღმოჩენა':'გულისცემის სიგნალი'} onPress={()=>{if(pulse.signal.revealed)setGift(true);else setNotice('მოუსმინე რიტმს. უფრო სწრაფი ორმაგი პულსი ნიშნავს, რომ უახლოვდები.');}} style={{backgroundColor:c.surface,borderColor:'#14B8A6',borderWidth:1,borderRadius:25,padding:12,flexDirection:'row',alignItems:'center',gap:12}}><PulseGlyph active period={pulse.signal.period}/><View style={{flex:1}}><Copy bold size={13}>{pulse.signal.revealed?'აღმოჩენა შენ გვერდითაა':'გესმის? რაღაც ახლოსაა…'}</Copy><Copy muted size={10}>{pulse.signal.revealed?'გახსენი კამერა და შეეხე ყუთს':'მოუსმინე პულსს · მიჰყევი რიტმს'}</Copy></View>{pulse.signal.revealed?<Gift color={c.primary100} size={22}/>:null}</Pressable>:null}
   <Card style={{padding:16,borderRadius:29,gap:13}}>
    <Pressable accessibilityRole="button" accessibilityLabel="გასეირნების დეტალები" onPress={()=>setDetails(true)} style={{flexDirection:'row',alignItems:'center',gap:15}}><View style={{flex:1}}><View style={{flexDirection:'row',gap:6,alignItems:'center'}}><Route size={13} color={c.primary100}/><Copy size={10} muted>შენი გზა</Copy></View><Copy bold size={28} style={{lineHeight:38,fontVariant:['tabular-nums']}}>{formatDistanceShort(run.distanceM)}</Copy></View><View style={{height:34,width:1,backgroundColor:c.bg300}}/><View style={{flex:1}}><View style={{flexDirection:'row',gap:6,alignItems:'center'}}><Timer size={13} color={c.primary100}/><Copy size={10} muted>აქტიური დრო</Copy></View><Copy bold size={25} style={{lineHeight:38,fontVariant:['tabular-nums']}}>{formatClock(run.movingMs)}</Copy></View><MoreHorizontal color={c.text300} size={20}/></Pressable>
    {run.targetMeters>0?<View style={{height:3,borderRadius:3,backgroundColor:c.bg200,overflow:'hidden'}}><View style={{width:`${derived.progress*100}%`,height:3,backgroundColor:'#14B8A6'}}/></View>:null}
    <View style={{flexDirection:'row',gap:10,alignItems:'center'}}><View style={{flex:1}}><Action label={running?'პაუზა':run.phase==='paused'?'გავაგრძელოთ გზა':'დავიწყოთ აღმოჩენა'} busy={busy} disabled={run.phase==='preparing'} icon={running?Pause:Play} secondary={running} onPress={()=>running?pauseRun():void begin()}/></View>{active?<IconButton label="სესიის დასრულება" icon={Flag} onPress={()=>{if(running)pauseRun();setFinish(true);}}/>:null}</View>
   </Card>
  </View>:null}
  <Sheet title="შენი გასეირნება" visible={details} onClose={()=>setDetails(false)}><Card><Copy bold size={20}>{run.target?targetLabel(run.target):'თავისუფალი გასეირნება'}</Copy>{[{label:'სავარაუდო ნაბიჯები',value:derived.steps.toLocaleString(),icon:Footprints},{label:'მიმდინარე სიჩქარე',value:run.speedKmh.toFixed(1)+' კმ/სთ',icon:Navigation},{label:'სესიის დრო პაუზების ჩათვლით',value:formatClock(run.elapsedMs),icon:Timer},{label:'GPS სიზუსტე',value:run.accuracyM==null?'ველოდებით':Math.round(run.accuracyM)+' მ',icon:LocateFixed}].map(row=><View key={row.label} style={{flexDirection:'row',gap:10,alignItems:'center'}}><row.icon size={18} color={c.primary100}/><Copy muted size={12} style={{flex:1}}>{row.label}</Copy><Copy bold size={13}>{row.value}</Copy></View>)}</Card><Card><Copy bold>{pulse.pending?'შენახულია ტელეფონში · იგზავნება':'ანგარიშთან სინქრონიზაცია'}</Copy><Copy muted>{pulse.message}</Copy><Copy muted size={12}>ეკრანის ჩაკეტვისას ან აპიდან გასვლისას სესია პაუზდება. დაბრუნებისას გააგრძელე.</Copy></Card></Sheet>
  <Sheet title="შენი მოძრაობის სივრცე" visible={menu} onClose={()=>setMenu(false)}><Action secondary label="გავლილი გზების რუკა" icon={Route} disabled={paint.length===0} onPress={()=>{setMenu(false);map.current?.send({type:'fit',bottom:dockHeight+35,paintOnly:true});}}/>{([{id:'missions',label:'თბილისის პასპორტი',icon:Compass},{id:'collection',label:'ჩემი აღმოჩენები',icon:Gift},{id:'leaderboard',label:'ლიდერბორდი',icon:Trophy},{id:'settings',label:'პარამეტრები',icon:Settings2},{id:'help',label:'როგორ მუშაობს?',icon:BookOpen}] as const).map(item=><Action key={item.id} secondary label={item.label} icon={item.icon} onPress={()=>openPanel(item.id)}/>)}</Sheet>
  <Sheet title="დავასრულოთ გასეირნება?" visible={finish} onClose={()=>setFinish(false)}><Card><Copy bold size={25}>{formatDistanceShort(run.distanceM)}</Copy><Copy muted>გავლილი გზა, მისიის პროგრესი და აღმოჩენები შენარჩუნდება. კავშირის გარეშე ჩანაწერი გაგზავნას დაელოდება.</Copy><Action label="დასრულება და შენახვა" icon={Check} busy={busy} onPress={()=>void end()}/><Action secondary label="ჯერ პაუზაზე დარჩეს" onPress={()=>setFinish(false)}/></Card></Sheet>
  <PulsePanels panel={panel} onClose={()=>setPanel(null)} onTestPulse={()=>void testPulse()}/><PulseGift visible={gift} signal={pulse.signal} onClose={()=>setGift(false)}/>
 </View>;
}
