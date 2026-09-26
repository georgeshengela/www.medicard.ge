import React,{useEffect,useMemo,useRef,useState} from 'react';
import {ActivityIndicator,BackHandler,Pressable,View} from 'react-native';
import {useRouter} from 'expo-router';
import {ArrowLeft,BookOpen,Check,Compass,Flag,Footprints,Gauge,Gift,LocateFixed,MoreHorizontal,Navigation,Pause,Play,Route,Settings2,Timer,Trophy} from 'lucide-react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import {hideFloatingTabBar} from '@/components/navigation/tabChrome';
import {useAuth} from '@/store/AuthContext';
import {useThemeColors} from '@/theme/colors';
import {cancelRun,finishRun,getRunState,onRunEvent,pauseRun,prepareExploration,resumeRun,runDerived,startRun,useRunSession} from '@/lib/run/store';
import {formatClock,formatDistanceShort,formatPace} from '@/lib/run/geo';
import {splitDurations} from '@/lib/run/insights';
import {coverageFeatures} from '@/lib/medipulsi/core/journey';
import {missionPercent} from '@/lib/medipulsi/core/missions';
import {usePulse} from '@/lib/medipulsi/client';
import {useHeartbeat} from '@/lib/medipulsi/useHeartbeat';
import {nightAt} from '@/lib/medipulsi/daylight';
import {targetLabel} from '@/lib/run/labels';
import {RunMap,type RunMapHandle} from './RunMap';
import {PulsePanels,type PulsePanel} from './PulsePanels';
import {PulseGift} from './PulseGift';
import {Action,Bar,Card,Copy,IconButton,RUN_CTA,RUN_TEAL,Sheet} from './PulseUi';
import {MediRunLogo,PulseGlyph} from './PulseIdentity';

type Notice={text:string;tone:'info'|'success'|'warn';sticky?:boolean};

export default function PulseActive(){
 const router=useRouter(),c=useThemeColors(),insets=useSafeAreaInsets(),{healthProfile}=useAuth(),run=useRunSession(),pulse=usePulse(),derived=runDerived(run);
 const map=useRef<RunMapHandle>(null),[ready,setReady]=useState(false),[following,setFollowing]=useState(true),[details,setDetails]=useState(false),[menu,setMenu]=useState(false),[finish,setFinish]=useState(false),[gift,setGift]=useState(false),[panel,setPanel]=useState<PulsePanel|null>(null),[busy,setBusy]=useState(false),[notice,setNotice]=useState<Notice|null>(null),[mapError,setMapError]=useState('');
 const settings=pulse.snapshot?.settings||{},running=run.phase==='running',active=running||run.phase==='paused';
 const testPulse=useHeartbeat(pulse.signal,settings,running);
 const [dockHeight,setDockHeight]=useState(170);
 const mission=pulse.snapshot?.missions.find(m=>m.id===pulse.book.selected);
 const center=run.current||run.origin;
 const mapDark=settings.mapMode==='night'||(settings.mapMode!=='day'&&Boolean(center&&nightAt(center.lat,center.lng)));
 const hapticOn=settings.haptic!==false;
 const hapticRef=useRef(hapticOn);hapticRef.current=hapticOn;
 useEffect(()=>hideFloatingTabBar(),[]);
 useEffect(()=>{if(run.phase==='finished')router.replace('/run/summary' as never);},[run.phase,router]);
 useEffect(()=>{if(pulse.conflict&&running)pauseRun();},[pulse.conflict,running]);
 // Transient notices fade on their own; warnings stay until tapped.
 useEffect(()=>{if(!notice||notice.sticky)return;const t=setTimeout(()=>setNotice(null),notice.tone==='success'?6000:4500);return()=>clearTimeout(t);},[notice]);
 useEffect(()=>onRunEvent(event=>{
  if(event==='km_split'){
   const s=getRunState(),km=s.splits.length,last=splitDurations(s.splits).at(-1);
   setNotice({text:last!=null?`${km} კმ · ამ კილომეტრის ტემპი ${formatPace(last/1000)}`:`${km} კმ გაიარე — ასე გააგრძელე!`,tone:'success'});
   if(hapticRef.current)void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).then(()=>new Promise(r=>setTimeout(r,140))).then(()=>Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)).catch(()=>{});
   return;
  }
  if(event==='target_completed'||event==='pin_reached'){setNotice({text:event==='target_completed'?'მიზანი შესრულებულია! შეგიძლია გააგრძელო აღმოჩენა.':'დანიშნულების ადგილს მიაღწიე!',tone:'success'});void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(()=>{});}
 }),[]);
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
 const gpsGood=run.accuracyM!=null&&run.accuracyM<=25;
 const remaining=run.targetMeters>0?Math.max(0,run.targetMeters-run.distanceM):0;
 const status=running?(gpsGood?'შენი გზა ფერადდება':'ზუსტ GPS-ს ველოდებით'):run.phase==='paused'?'პაუზა · შენი გზა შენახულია':'დღეს სად მიგიყვანს გზა?';
 // System messages outrank transient toasts.
 const banner:Notice|null=run.syncError?{text:run.syncError,tone:'warn',sticky:true}:mapError?{text:mapError,tone:'warn',sticky:true}:run.error==='location'?{text:'GPS შეწყდა. შეამოწმე მდებარეობის წვდომა და გააგრძელე.',tone:'warn',sticky:true}:run.transportWarning?{text:'მაღალი სიჩქარე — ეს მოძრაობა პროგრესში არ ითვლება.',tone:'warn',sticky:true}:notice;
 const bannerColor=banner?.tone==='success'?RUN_TEAL:banner?.tone==='warn'?'#F59E0B':c.primary100;
 return <View style={{flex:1,backgroundColor:c.bg100}}>
  {center?<RunMap ref={map} center={center} mapDark={mapDark} onReady={()=>setReady(true)} onFollowChange={setFollowing} onError={setMapError}/>:<View style={{flex:1,alignItems:'center',justifyContent:'center',padding:30,gap:18}}>
   <View style={{width:88,height:88,borderRadius:44,backgroundColor:c.accent100,alignItems:'center',justifyContent:'center'}}><Compass color={c.primary100} size={40}/></View>
   {run.phase==='preparing'?<><ActivityIndicator color={RUN_TEAL}/><Copy>შენი მდებარეობა იძებნება…</Copy></>:<><Copy bold size={22} style={{textAlign:'center'}}>მზად ხარ გასასვლელად?</Copy><Copy muted style={{textAlign:'center'}}>{run.error==='permission'?'MEDI RUN-ს მდებარეობის წვდომა სჭირდება, რომ შენი გზა დახატოს.':'დავიწყოთ შენი მდებარეობიდან.'}</Copy><View style={{alignSelf:'stretch'}}><Action label="მდებარეობის მიღება" icon={LocateFixed} onPress={()=>void prepareExploration({weightKg:healthProfile?.weightKg,heightCm:healthProfile?.heightCm})}/></View><Action secondary label="უკან დაბრუნება" onPress={leave}/></>}
  </View>}
  <View pointerEvents="box-none" style={{position:'absolute',top:insets.top+8,left:14,right:14,gap:8}}>
   <View style={{flexDirection:'row',alignItems:'center',gap:8}}>
    <IconButton floating label="უკან" icon={ArrowLeft} onPress={leave}/>
    <Card floating style={{flex:1,paddingVertical:7,paddingHorizontal:14,borderRadius:18,gap:0}}>
     <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}><MediRunLogo size={16}/><View accessibilityLabel={gpsGood?'GPS ზუსტია':'GPS სუსტია'} style={{flexDirection:'row',alignItems:'center',gap:5}}>{[0,1,2].map(i=><View key={i} style={{width:3,height:5+i*3,borderRadius:2,backgroundColor:run.accuracyM==null?c.bg300:run.accuracyM<=(i===0?45:i===1?25:12)?RUN_TEAL:c.bg300}}/>)}<View style={{width:7,height:7,borderRadius:4,marginLeft:4,backgroundColor:running?RUN_TEAL:run.phase==='paused'?'#F59E0B':c.text300}}/></View></View>
     <Copy size={10} muted numberOfLines={1}>{status}</Copy>
    </Card>
    <IconButton floating label="მენიუ" icon={MoreHorizontal} onPress={()=>setMenu(true)}/>
   </View>
   {mission?<Pressable accessibilityRole="button" accessibilityLabel={`მისია ${mission.name}, ${missionPercent(pulse.book,mission)} პროცენტი`} onPress={()=>setPanel('missions')} style={{alignSelf:'flex-start',flexDirection:'row',alignItems:'center',gap:7,backgroundColor:c.surface,borderRadius:16,paddingVertical:8,paddingHorizontal:12,shadowColor:'#030712',shadowOpacity:.14,shadowRadius:10,shadowOffset:{width:0,height:4},elevation:4}}><Compass size={13} color={c.primary100}/><Copy size={11} bold>{mission.name}</Copy><View style={{width:1,height:12,backgroundColor:c.bg300}}/><Copy size={11} bold style={{color:c.primary100}}>{missionPercent(pulse.book,mission)}%</Copy></Pressable>:null}
   {banner?<Pressable accessibilityRole="button" accessibilityLabel="შეტყობინების დახურვა" onPress={()=>{setNotice(null);setMapError('');}}><Card floating style={{paddingVertical:11,paddingHorizontal:14,borderRadius:16,flexDirection:'row',alignItems:'center',gap:10}}><View style={{width:4,alignSelf:'stretch',borderRadius:2,backgroundColor:bannerColor}}/><Copy size={12} bold={banner.tone==='success'} style={{flex:1}}>{banner.text}</Copy></Card></Pressable>:null}
  </View>
  {center?<View pointerEvents="box-none" style={{position:'absolute',bottom:Math.max(12,insets.bottom)+dockHeight+12,right:14,alignItems:'flex-end',gap:9}}><IconButton floating label="ჩემს მდებარეობაზე დაბრუნება" icon={LocateFixed} active={following} onPress={()=>map.current?.send({type:'follow'})}/></View>:null}
  {center?<View onLayout={event=>setDockHeight(event.nativeEvent.layout.height)} style={{position:'absolute',bottom:Math.max(12,insets.bottom),left:14,right:14,gap:10}}>
   {running&&pulse.signal.signal?<Pressable accessibilityRole="button" accessibilityLabel={pulse.signal.revealed?'საჩუქრის აღმოჩენა':'გულისცემის სიგნალი'} onPress={()=>{if(pulse.signal.revealed)setGift(true);else setNotice({text:'მოუსმინე რიტმს. უფრო სწრაფი ორმაგი პულსი ნიშნავს, რომ უახლოვდები.',tone:'info'});}} style={{backgroundColor:pulse.signal.revealed?RUN_CTA:c.surface,borderRadius:22,padding:12,flexDirection:'row',alignItems:'center',gap:12,shadowColor:'#030712',shadowOpacity:.16,shadowRadius:14,shadowOffset:{width:0,height:6},elevation:6}}><PulseGlyph active period={pulse.signal.period}/><View style={{flex:1}}><Copy bold size={13} style={pulse.signal.revealed?{color:'#fff'}:undefined}>{pulse.signal.revealed?'აღმოჩენა შენ გვერდითაა':'გესმის? რაღაც ახლოსაა…'}</Copy><Copy size={11} style={{color:pulse.signal.revealed?'#CCFBF1':c.text200}}>{pulse.signal.revealed?'გახსენი კამერა და შეეხე ყუთს':'მოუსმინე პულსს · მიჰყევი რიტმს'}</Copy></View>{pulse.signal.revealed?<Gift color="#fff" size={22}/>:null}</Pressable>:null}
   <Card floating style={{padding:16,borderRadius:26,gap:14}}>
    <Pressable accessibilityRole="button" accessibilityLabel="გასეირნების დეტალები" onPress={()=>setDetails(true)} style={{gap:12}}>
     <View style={{flexDirection:'row',alignItems:'flex-end'}}>
      <View style={{flex:1.25}}><Copy size={10} muted>მანძილი</Copy><Copy bold size={34} style={{lineHeight:42,letterSpacing:-1,fontVariant:['tabular-nums']}}>{formatDistanceShort(run.distanceM)}</Copy></View>
      <View style={{flex:1}}><Copy size={10} muted>აქტიური დრო</Copy><Copy bold size={21} style={{lineHeight:30,fontVariant:['tabular-nums']}}>{formatClock(run.movingMs)}</Copy></View>
      <View style={{flex:.8,alignItems:'flex-end'}}><Copy size={10} muted>ტემპი</Copy><Copy bold size={21} style={{lineHeight:30,fontVariant:['tabular-nums']}}>{formatPace(derived.pace)}</Copy></View>
     </View>
     {run.targetMeters>0?<View style={{gap:6}}><Bar value={derived.progress*100} height={5} label="მიზნის პროგრესი"/><View style={{flexDirection:'row',justifyContent:'space-between'}}><Copy size={10} muted>{run.target?targetLabel(run.target):''}</Copy><Copy size={10} bold style={{color:c.primary100}}>{remaining>0?`დარჩა ${formatDistanceShort(remaining)}`:'მიზანი შესრულდა ✓'}</Copy></View></View>:null}
    </Pressable>
    <View style={{flexDirection:'row',gap:10,alignItems:'center'}}><View style={{flex:1}}><Action label={running?'პაუზა':run.phase==='paused'?'გავაგრძელოთ გზა':'დავიწყოთ აღმოჩენა'} busy={busy} disabled={run.phase==='preparing'} icon={running?Pause:Play} secondary={running} onPress={()=>running?pauseRun():void begin()}/></View>{active?<Pressable accessibilityRole="button" accessibilityLabel="სესიის დასრულება" onPress={()=>{if(running)pauseRun();setFinish(true);}} style={{width:52,height:52,borderRadius:18,backgroundColor:c.bg200,alignItems:'center',justifyContent:'center'}}><Flag size={20} color={c.danger}/></Pressable>:null}</View>
   </Card>
  </View>:null}
  <Sheet title="შენი გასეირნება" visible={details} onClose={()=>setDetails(false)}>
   <Card><Copy bold size={18}>{run.target?targetLabel(run.target):'თავისუფალი გასეირნება'}</Copy>{[{label:'სავარაუდო ნაბიჯები',value:derived.steps.toLocaleString(),icon:Footprints},{label:'საშუალო ტემპი',value:formatPace(derived.pace)+' /კმ',icon:Gauge},{label:'მიმდინარე სიჩქარე',value:run.speedKmh.toFixed(1)+' კმ/სთ',icon:Navigation},{label:'სესიის დრო პაუზების ჩათვლით',value:formatClock(run.elapsedMs),icon:Timer},{label:'GPS სიზუსტე',value:run.accuracyM==null?'ველოდებით':Math.round(run.accuracyM)+' მ',icon:LocateFixed}].map(row=><View key={row.label} style={{flexDirection:'row',gap:10,alignItems:'center',minHeight:30}}><row.icon size={18} color={c.primary100}/><Copy muted size={12} style={{flex:1}}>{row.label}</Copy><Copy bold size={13}>{row.value}</Copy></View>)}</Card>
   {run.splits.length?<Card><Copy bold>კილომეტრები</Copy>{splitDurations(run.splits).map((ms,i)=><View key={i} style={{flexDirection:'row',alignItems:'center',gap:10}}><Copy muted size={12} style={{flex:1}}>{i+1} კმ</Copy><Copy bold size={13} style={{fontVariant:['tabular-nums']}}>{ms!=null?formatPace(ms/1000):'–'}</Copy></View>)}</Card>:null}
   <Card><Copy bold>{pulse.pending?'შენახულია ტელეფონში · იგზავნება':'ანგარიშთან სინქრონიზაცია'}</Copy><Copy muted>{pulse.message}</Copy><Copy muted size={12}>ეკრანის ჩაკეტვისას ან აპიდან გასვლისას სესია პაუზდება. დაბრუნებისას გააგრძელე.</Copy></Card>
  </Sheet>
  <Sheet title="შენი მოძრაობის სივრცე" visible={menu} onClose={()=>setMenu(false)}><Action secondary label="გავლილი გზების რუკა" icon={Route} disabled={paint.length===0} onPress={()=>{setMenu(false);map.current?.send({type:'fit',bottom:dockHeight+35,paintOnly:true});}}/>{([{id:'missions',label:'თბილისის პასპორტი',icon:Compass},{id:'collection',label:'ჩემი აღმოჩენები',icon:Gift},{id:'leaderboard',label:'ლიდერბორდი',icon:Trophy},{id:'settings',label:'პარამეტრები',icon:Settings2},{id:'help',label:'როგორ მუშაობს?',icon:BookOpen}] as const).map(item=><Action key={item.id} secondary label={item.label} icon={item.icon} onPress={()=>openPanel(item.id)}/>)}</Sheet>
  <Sheet title="დავასრულოთ გასეირნება?" visible={finish} onClose={()=>setFinish(false)}>
   <Card style={{gap:16}}>
    <View style={{flexDirection:'row'}}>{[{label:'მანძილი',value:formatDistanceShort(run.distanceM)},{label:'დრო',value:formatClock(run.movingMs)},{label:'ტემპი',value:formatPace(derived.pace)}].map((s,i)=><View key={s.label} style={{flex:1,alignItems:i===0?'flex-start':i===2?'flex-end':'center'}}><Copy muted size={11}>{s.label}</Copy><Copy bold size={i===0?24:18} style={{fontVariant:['tabular-nums']}}>{s.value}</Copy></View>)}</View>
    <Copy muted size={13}>გავლილი გზა, მისიის პროგრესი და აღმოჩენები შენარჩუნდება. კავშირის გარეშე ჩანაწერი გაგზავნას დაელოდება.</Copy>
    <Action label="დასრულება და შენახვა" icon={Check} busy={busy} onPress={()=>void end()}/>
    <Action secondary label="ჯერ პაუზაზე დარჩეს" onPress={()=>setFinish(false)}/>
   </Card>
  </Sheet>
  <PulsePanels panel={panel} onClose={()=>setPanel(null)} onTestPulse={()=>void testPulse()}/><PulseGift visible={gift} signal={pulse.signal} onClose={()=>setGift(false)}/>
 </View>;
}
