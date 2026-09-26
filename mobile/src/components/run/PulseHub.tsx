import React,{useCallback,useMemo,useState} from 'react';
import {Pressable,ScrollView,View} from 'react-native';
import {useFocusEffect,useRouter} from 'expo-router';
import * as Location from 'expo-location';
import {ArrowLeft,ArrowUpRight,BookOpen,ChevronRight,Compass,Flame,Gauge,Gift,Landmark,MapPin,Mountain,Play,Route,Settings2,Target,Timer,Trees,Trophy,Volume2,Waves} from 'lucide-react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useAuth} from '@/store/AuthContext';
import {useThemeColors} from '@/theme/colors';
import {HUB} from '@/theme/hub';
import {getRunState,hydrateActiveRun,isActiveRunPhase,prepareExploration,prepareRun} from '@/lib/run/store';
import {loadRunHistory,type RunSummary} from '@/lib/run/history';
import {formatRunDate} from '@/lib/run/presentation';
import {formatClock,formatKm,formatPace,type RunTarget} from '@/lib/run/geo';
import {dayMoment,personalRecords,walkStreak,weekBuckets} from '@/lib/run/insights';
import {getPulseClient,usePulse} from '@/lib/medipulsi/client';
import {missionPercent,missionProgress,type Mission} from '@/lib/medipulsi/core/missions';
import {distance,type Coordinate} from '@/lib/medipulsi/core/engine';
import {useHeartbeat} from '@/lib/medipulsi/useHeartbeat';
import {EMPTY_SIGNAL} from '@/lib/medipulsi/types';
import {RunTargetSheet} from './RunTargetSheet';
import {PulsePanels,type PulsePanel} from './PulsePanels';
import {Action,Bar,Card,Copy,IconButton,RUN_CTA,Section,Tile,useRunInk} from './PulseUi';
import {DiscoveryArtwork,MediRunLogo,PulseGlyph} from './PulseIdentity';
import {RouteThumb,WeekBars} from './RunVisuals';

export const MISSION_ICONS={trees:Trees,landmark:Landmark,waves:Waves,mountain:Mountain,bridge:Compass,flower:Trees};

/** Nearest unfinished mission when we know where you are, otherwise the one you already started. */
function suggestMission(missions:Mission[],book:ReturnType<typeof usePulse>['book'],here:Coordinate|null){
 const open=missions.filter(m=>!missionProgress(book,m).completedAt&&m.id!==book.selected);
 if(!open.length)return null;
 if(here)return open.map(m=>({m,d:distance(here,m.center)})).sort((a,b)=>a.d-b.d)[0];
 const started=open.find(m=>missionProgress(book,m).meters>0);
 return {m:started||open[0],d:null as number|null};
}
const away=(m:number)=>m<1000?`${Math.round(m/10)*10} მ`:`${(m/1000).toFixed(m<10000?1:0)} კმ`;

export default function PulseHub(){
 const router=useRouter(),c=useThemeColors(),ink=useRunInk(),insets=useSafeAreaInsets(),{healthProfile}=useAuth(),pulse=usePulse();
 const [history,setHistory]=useState<RunSummary[]>([]),[targetSheet,setTargetSheet]=useState(false),[panel,setPanel]=useState<PulsePanel|null>(null),[error,setError]=useState(''),[here,setHere]=useState<Coordinate|null>(null),[allWalks,setAllWalks]=useState(false),[busy,setBusy]=useState(false);
 const testPulse=useHeartbeat(EMPTY_SIGNAL,pulse.snapshot?.settings||{},false);
 useFocusEffect(useCallback(()=>{
  let alive=true;
  void hydrateActiveRun().then(()=>{if(!alive)return;const phase=getRunState().phase;if(isActiveRunPhase(phase)||phase==='ready'||phase==='preparing')router.replace('/run/active' as never);});
  void loadRunHistory().then(list=>{if(alive)setHistory(list);});
  void getPulseClient().refresh().catch(e=>{if(alive)setError(e.message);});
  // Read-only: a last known fix orders missions by distance. Never asks for permission here.
  void Location.getForegroundPermissionsAsync().then(p=>p.granted?Location.getLastKnownPositionAsync({maxAge:15*60_000}):null).then(fix=>{if(alive&&fix)setHere([fix.coords.longitude,fix.coords.latitude]);}).catch(()=>{});
  return()=>{alive=false;};
 },[router]));
 const start=(target?:RunTarget)=>{setTargetSheet(false);const body={weightKg:healthProfile?.weightKg,heightCm:healthProfile?.heightCm};void (target?prepareRun(target,body):prepareExploration(body));router.push('/run/active' as never);};
 const saved=pulse.snapshot?.history||[];
 const walks=useMemo(()=>saved.length?saved.map(s=>({startedAt:s.startedAt,meters:s.meters})):history.map(r=>({startedAt:r.startedAt,meters:r.distanceM})),[saved,history]);
 const week=useMemo(()=>weekBuckets(walks),[walks]),streak=useMemo(()=>walkStreak(walks),[walks]);
 const weekKm=week.reduce((s,d)=>s+d.meters,0)/1000,weekWalks=week.filter(d=>d.meters>0).length;
 const lifetimeKm=walks.reduce((s,w)=>s+w.meters,0)/1000;
 const records=useMemo(()=>personalRecords(history),[history]);
 const missions=pulse.snapshot?.missions||[],missionCount=missions.length||24;
 const stamps=Object.values(pulse.book.progress).filter(p=>p.completedAt).length;
 const active=missions.find(m=>m.id===pulse.book.selected);
 const next=useMemo(()=>suggestMission(missions,pulse.book,here),[missions,pulse.book,here]);
 const leave=()=>router.canGoBack()?router.back():router.replace('/(tabs)/home' as never);
 const choose=(id:string)=>{if(busy)return;setBusy(true);void getPulseClient().selectMission(id).catch(e=>setError((e as Error).message)).finally(()=>setBusy(false));};
 const recordTiles=[
  records.longest&&{id:records.longest.id,icon:Route,value:formatKm(records.longest.distanceM,2),unit:'კმ',label:'ყველაზე გრძელი'},
  records.fastest&&{id:records.fastest.id,icon:Gauge,value:formatPace(records.fastest.paceSecPerKm),unit:'/კმ',label:'საუკეთესო ტემპი'},
  records.longestTime&&{id:records.longestTime.id,icon:Timer,value:formatClock(records.longestTime.movingMs),unit:'',label:'ყველაზე ხანგრძლივი'},
 ].filter(Boolean) as {id:string;icon:typeof Route;value:string;unit:string;label:string}[];
 const shown=allWalks?history:history.slice(0,3);

 return <View style={{flex:1,backgroundColor:c.bg100}}><ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{paddingTop:insets.top+12,paddingBottom:insets.bottom+32,paddingHorizontal:HUB.gutter,gap:HUB.sectionGap}}>
  <View style={{flexDirection:'row',alignItems:'center',gap:12}}>
   <IconButton label="MEDICARD-ში დაბრუნება" icon={ArrowLeft} onPress={leave}/>
   <View style={{flex:1}}><MediRunLogo/><Copy muted size={11}>{dayMoment()} · შენი ქალაქის პულსი</Copy></View>
   <IconButton label="პარამეტრები" icon={Settings2} onPress={()=>setPanel('settings')}/>
  </View>

  {/* The page's one spotlight. */}
  <View style={{backgroundColor:HUB.spotlightBg,borderRadius:HUB.cardRadius,overflow:'hidden'}}>
   <View style={{paddingHorizontal:HUB.cardPad+2,paddingTop:HUB.cardPad+2,gap:8}}>
    <View style={{flexDirection:'row',alignItems:'center',gap:8}}>
     {streak>0?<View style={{flexDirection:'row',alignItems:'center',gap:5,backgroundColor:'rgba(251,191,36,0.14)',borderRadius:10,paddingHorizontal:9,paddingVertical:3}}><Flame size={13} color="#FCD34D" fill="#FCD34D"/><Copy bold size={11} style={{color:'#FDE68A'}}>{streak} დღე ზედიზედ</Copy></View>
      :<View style={{flexDirection:'row',alignItems:'center',gap:7}}><View style={{width:6,height:6,borderRadius:3,backgroundColor:'#2DD4BF'}}/><Copy bold size={11} style={{color:'#99F6E4'}}>შენი ტემპით · ნებისმიერ ქალაქში</Copy></View>}
    </View>
    <Copy bold size={27} style={{lineHeight:38,color:'#fff'}}>{streak>1?'რიტმს ნუ დაკარგავ.\nგზა გელოდება.':'გარეთ ახალი\nამბავი იწყება.'}</Copy>
    <Copy size={13} style={{color:'#C5DADA'}}>{weekKm>0?`ამ კვირაში უკვე ${weekKm.toFixed(1)} კმ გაიარე.`:'გადადგი პირველი ნაბიჯი. დანარჩენს გზად აღმოაჩენ.'}</Copy>
   </View>
   <View style={{marginTop:6}}><DiscoveryArtwork tone="spotlight" height={150}/></View>
   <View style={{padding:HUB.cardPad,paddingTop:4,gap:8}}>
    {active?<Pressable accessibilityRole="button" accessibilityLabel={`აქტიური მისია ${active.name}, ${missionPercent(pulse.book,active)} პროცენტი`} onPress={()=>setPanel('missions')} style={{flexDirection:'row',alignItems:'center',gap:10,paddingHorizontal:12,paddingVertical:9,borderRadius:14,backgroundColor:'rgba(255,255,255,0.07)'}}>
     <Compass size={15} color="#99F6E4"/><Copy bold size={12} numberOfLines={1} style={{flex:1,color:'#fff'}}>მისია · {active.name}</Copy><Copy bold size={12} style={{color:'#99F6E4'}}>{missionPercent(pulse.book,active)}%</Copy>
    </Pressable>:null}
    <Pressable accessibilityRole="button" accessibilityLabel="დავიწყოთ აღმოჩენა — თავისუფალი გასეირნება" onPress={()=>start()} style={{minHeight:58,borderRadius:18,backgroundColor:RUN_CTA,paddingHorizontal:14,flexDirection:'row',alignItems:'center',gap:12}}>
     <View style={{width:34,height:34,borderRadius:12,backgroundColor:'rgba(255,255,255,0.16)',alignItems:'center',justifyContent:'center'}}><Play fill="#fff" color="#fff" size={15}/></View>
     <Copy bold size={15} style={{flex:1,color:'#fff'}}>დავიწყოთ აღმოჩენა</Copy><ArrowUpRight color="#CCFBF1" size={22}/>
    </Pressable>
    <Pressable accessibilityRole="button" onPress={()=>setTargetSheet(true)} style={{minHeight:44,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8}}><Target size={16} color="#99F6E4"/><Copy bold size={12} style={{color:'#fff'}}>ან ივარჯიშე მიზნით</Copy><ChevronRight size={14} color="#99F6E4"/></Pressable>
   </View>
  </View>

  {error&&!pulse.snapshot?<Card><Copy muted>{error}</Copy><Action secondary label="კავშირის განახლება" onPress={()=>{setError('');void getPulseClient().refresh().catch(e=>setError(e.message));}}/></Card>:null}

  <Section title="ეს კვირა" link="ისტორია" onLink={()=>setPanel('collection')}>
   <Card style={{gap:18}}>
    <View style={{flexDirection:'row',alignItems:'flex-end',gap:12}}>
     <View style={{flex:1}}><View style={{flexDirection:'row',alignItems:'baseline',gap:6}}><Copy bold size={34} style={{lineHeight:42,letterSpacing:-1,fontVariant:['tabular-nums']}}>{weekKm.toFixed(1)}</Copy><Copy bold size={14} style={{color:c.primary100}}>კმ</Copy></View><Copy muted size={12}>{weekWalks?`${weekWalks} აქტიური დღე ბოლო 7 დღეში`:'ამ კვირაში ჯერ არ გაგისეირნია'}</Copy></View>
    </View>
    <WeekBars days={week}/>
    <View style={{flexDirection:'row',borderTopWidth:1,borderColor:c.bg200,paddingTop:14}}>
     {[{value:lifetimeKm.toFixed(1),label:'სულ კმ'},{value:String(walks.length),label:'გასეირნება'},{value:`${stamps}/${missionCount}`,label:'შტამპი'}].map((s,i)=><View key={s.label} style={{flex:1,alignItems:'center',borderLeftWidth:i?1:0,borderColor:c.bg200}}><Copy bold size={17} style={{fontVariant:['tabular-nums']}}>{s.value}</Copy><Copy muted size={11}>{s.label}</Copy></View>)}
    </View>
   </Card>
  </Section>

  {recordTiles.length?<Section title="შენი რეკორდები">
   <View style={{flexDirection:'row',gap:10}}>{recordTiles.map(r=><Pressable key={r.label} accessibilityRole="button" accessibilityLabel={`${r.label}: ${r.value} ${r.unit}`} onPress={()=>router.push(`/run/${r.id}` as never)} style={{flex:1}}>
    <Card style={{padding:14,gap:10,minHeight:128}}><Tile icon={r.icon} size={36}/><View style={{gap:1}}><View style={{flexDirection:'row',alignItems:'baseline',gap:3}}><Copy bold size={18} numberOfLines={1} style={{fontVariant:['tabular-nums'],flexShrink:1}}>{r.value}</Copy>{r.unit?<Copy bold size={10} style={{color:c.primary100}}>{r.unit}</Copy>:null}</View><Copy muted size={11} numberOfLines={2}>{r.label}</Copy></View></Card>
   </Pressable>)}</View>
  </Section>:null}

  <Section title="თბილისის პასპორტი" link="ყველა მისია" onLink={()=>setPanel('missions')}>
   <Card style={{gap:16}}>
    <View style={{flexDirection:'row',alignItems:'center',gap:14}}>
     <View style={{flex:1,gap:4}}><Copy bold size={16}>ქალაქი სავსეა ისტორიებით</Copy><Copy muted size={12}>პარკები, ტბები და ნაცნობი ადგილები ახალი თვალით.</Copy></View>
     <View style={{width:62,height:70,borderWidth:1.5,borderStyle:'dashed',borderColor:ink,borderRadius:18,alignItems:'center',justifyContent:'center',transform:[{rotate:'7deg'}]}}><Copy bold size={18} style={{color:ink,lineHeight:24}}>{stamps}</Copy><Copy size={10} muted>/ {missionCount}</Copy></View>
    </View>
    <Bar value={stamps/missionCount*100} label="თბილისის პასპორტის შტამპები"/>
    {next?<View style={{flexDirection:'row',alignItems:'center',gap:12,borderTopWidth:1,borderColor:c.bg200,paddingTop:14}}>
     <Tile icon={MISSION_ICONS[next.m.icon]||MapPin}/>
     <View style={{flex:1,minWidth:0}}><Copy muted size={11}>{next.d!=null?'შენთან ყველაზე ახლოს':'შემდეგი აღმოჩენა'}</Copy><Copy bold size={14} numberOfLines={1}>{next.m.name}</Copy><Copy muted size={11}>{next.m.meters} მ ზონაში{next.d!=null?` · ${away(next.d)} შენგან`:''}</Copy></View>
     <Pressable accessibilityRole="button" accessibilityLabel={`მისიის არჩევა: ${next.m.name}`} disabled={busy} onPress={()=>choose(next.m.id)} style={{minHeight:40,paddingHorizontal:14,borderRadius:14,backgroundColor:c.accent100,justifyContent:'center',opacity:busy?.6:1}}><Copy bold size={12} style={{color:c.primary100}}>არჩევა</Copy></Pressable>
    </View>:null}
   </Card>
  </Section>

  <View style={{flexDirection:'row',gap:12}}>{[{id:'collection' as const,label:'კოლექცია',detail:`${pulse.snapshot?.claims.length||0} საჩუქარი · ${stamps} შტამპი`,icon:Gift,ink:'amber' as const},{id:'leaderboard' as const,label:'ლიდერბორდი',detail:pulse.snapshot?.leaderboardOptIn?'შენ სიაში ხარ':'ერთად უფრო შორს',icon:Trophy,ink:'violet' as const}].map(item=><Pressable key={item.id} accessibilityRole="button" accessibilityLabel={`${item.label}. ${item.detail}`} onPress={()=>setPanel(item.id)} style={{flex:1}}>
   <Card style={{minHeight:128,gap:10}}><View style={{flexDirection:'row',justifyContent:'space-between'}}><Tile icon={item.icon} ink={item.ink}/><ArrowUpRight size={17} color={c.text300}/></View><View><Copy bold size={15}>{item.label}</Copy><Copy muted size={11}>{item.detail}</Copy></View></Card>
  </Pressable>)}</View>

  {history.length?<Section title="ბოლო გასეირნებები" link={history.length>3?(allWalks?'ნაკლები':`ყველა · ${history.length}`):undefined} onLink={()=>setAllWalks(v=>!v)}>
   <Card style={{paddingVertical:6,gap:0}}>{shown.map((run,i)=><Pressable key={run.id} accessibilityRole="button" accessibilityLabel={`${formatKm(run.distanceM,2)} კილომეტრი, ${formatRunDate(run.startedAt)}`} onPress={()=>router.push(`/run/${run.id}` as never)} style={{flexDirection:'row',alignItems:'center',gap:14,paddingVertical:12,borderTopWidth:i?1:0,borderColor:c.bg200}}>
    <RouteThumb segments={run.segments?.length?run.segments:[run.path]}/>
    <View style={{flex:1,minWidth:0}}><Copy bold size={15} style={{fontVariant:['tabular-nums']}}>{formatKm(run.distanceM,2)} კმ</Copy><Copy muted size={11} numberOfLines={1}>{formatRunDate(run.startedAt)} · {Math.max(1,Math.round(run.movingMs/60000))} წთ · {formatPace(run.paceSecPerKm)} /კმ</Copy></View>
    <ChevronRight color={c.text300} size={17}/>
   </Pressable>)}</Card>
  </Section>:null}

  <Pressable accessibilityRole="button" accessibilityLabel="აღმოჩენის პულსის მოსმენა" onPress={()=>void testPulse()}><Card style={{flexDirection:'row',alignItems:'center',gap:14}}><PulseGlyph size={42}/><View style={{flex:1,gap:2}}><Copy bold size={14}>ჯერ იგრძნობ. მერე დაინახავ.</Copy><Copy muted size={12}>მოუსმინე, როგორ გიხმობს საჩუქარი</Copy></View><Volume2 size={19} color={c.primary100}/></Card></Pressable>

  <Pressable accessibilityRole="button" onPress={()=>setPanel('help')} style={{minHeight:44,marginTop:-12,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:9}}><BookOpen size={16} color={c.text200}/><Copy muted size={12}>როგორ მუშაობს MEDIRUN?</Copy><ChevronRight size={15} color={c.text300}/></Pressable>
 </ScrollView><RunTargetSheet visible={targetSheet} onClose={()=>setTargetSheet(false)} onConfirm={start} weightKg={healthProfile?.weightKg} heightCm={healthProfile?.heightCm}/><PulsePanels panel={panel} onClose={()=>setPanel(null)} onTestPulse={()=>void testPulse()}/></View>;
}
