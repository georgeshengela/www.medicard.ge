import React,{useCallback,useMemo,useState} from 'react';
import {Image,Pressable,ScrollView,View} from 'react-native';
import {useFocusEffect,useRouter} from 'expo-router';
import * as Location from 'expo-location';
import {ArrowUpRight,ChevronRight,Compass,Landmark,Mountain,Settings2,Trees,Waves} from 'lucide-react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useAuth} from '@/store/AuthContext';
import {useThemeColors} from '@/theme/colors';
import {HUB} from '@/theme/hub';
import {getRunState,hydrateActiveRun,isActiveRunPhase,prepareExploration,prepareRun} from '@/lib/run/store';
import {loadRunHistory,type RunSummary} from '@/lib/run/history';
import {formatRunDate} from '@/lib/run/presentation';
import {formatYmd} from '@/lib/format';
import {formatClock,formatKm,formatPace,type RunTarget} from '@/lib/run/geo';
import {dayMoment,personalRecords,walkStreak,weekBuckets} from '@/lib/run/insights';
import {getPulseClient,usePulse} from '@/lib/medipulsi/client';
import {missionPercent,missionProgress,type Mission} from '@/lib/medipulsi/core/missions';
import {distance,type Coordinate} from '@/lib/medipulsi/core/engine';
import {useHeartbeat} from '@/lib/medipulsi/useHeartbeat';
import {EMPTY_SIGNAL} from '@/lib/medipulsi/types';
import {RunTargetSheet} from './RunTargetSheet';
import {PulsePanels,type PulsePanel} from './PulsePanels';
import {Action,ArtTile,Bar,Card,Copy,Section} from './PulseUi';
import {MISSION_ART,RUN_GIFT,RUN_HERO,RUN_ICON} from './runArt';
import {ModuleHeader,ModuleHeaderButton} from '@/components/brand/ModuleHeader';
import {RouteThumb,WeekBars} from './RunVisuals';
import {PulseTerritory} from './PulseTerritory';
import {GrandPrizeCard} from './GrandPrizeCard';
import {RunDropsCard} from './RunDrops';
import {RunWallet} from './RunWallet';
import {RunHero} from './RunHero';
import {RunPrizeGoal} from './RunPrizeGoal';
import {RunRaceCard} from './RunRaceCard';
import { tx } from '@/i18n/locale';

export const MISSION_ICONS={trees:Trees,landmark:Landmark,waves:Waves,mountain:Mountain,bridge:Compass,flower:Trees};

/** Nearest unfinished mission when we know where you are, otherwise the one you already started. */
function suggestMission(missions:Mission[],book:ReturnType<typeof usePulse>['book'],here:Coordinate|null){
 const open=missions.filter(m=>!missionProgress(book,m).completedAt&&m.id!==book.selected);
 if(!open.length)return null;
 if(here)return open.map(m=>({m,d:distance(here,m.center)})).sort((a,b)=>a.d-b.d)[0];
 const started=open.find(m=>missionProgress(book,m).meters>0);
 return {m:started||open[0],d:null as number|null};
}
/** „4 ოქტომბერი“ — the year only when it is not this year (the row has little room). */
const walkDay=(iso:string)=>{const d=new Date(iso);if(!Number.isFinite(d.getTime()))return '';const ymd=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;return formatYmd(ymd,d.getFullYear()!==new Date().getFullYear());};
const away=(m:number)=>m<1000?tx(`${Math.round(m/10)*10} მ`, `${Math.round(m/10)*10} m`):tx(`${(m/1000).toFixed(m<10000?1:0)} კმ`, `${(m/1000).toFixed(m<10000?1:0)} km`);

export default function PulseHub(){
 const router=useRouter(),c=useThemeColors(),insets=useSafeAreaInsets(),{healthProfile}=useAuth(),pulse=usePulse();
 const [history,setHistory]=useState<RunSummary[]>([]),[targetSheet,setTargetSheet]=useState(false),[panel,setPanel]=useState<PulsePanel|null>(null),[error,setError]=useState(''),[missionError,setMissionError]=useState(''),[here,setHere]=useState<Coordinate|null>(null),[allWalks,setAllWalks]=useState(false),[busy,setBusy]=useState(false);
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
 const walks=useMemo(()=>saved.length?saved.map(s=>({startedAt:s.startedAt,meters:s.meters,seconds:s.seconds||0,newMeters:s.newMeters||0})):history.map(r=>({startedAt:r.startedAt,meters:r.distanceM,seconds:Math.round((r.movingMs||0)/1000),newMeters:0})),[saved,history]);
 const week=useMemo(()=>weekBuckets(walks),[walks]),streak=useMemo(()=>walkStreak(walks),[walks]);
 const weekKm=week.reduce((s,d)=>s+d.meters,0)/1000,weekDays=week.filter(d=>d.meters>0).length;
 // The same seven local days as the bars (today and the six before it).
 const weekStart=useMemo(()=>{const d=new Date();return new Date(d.getFullYear(),d.getMonth(),d.getDate()-6).getTime();},[]);
 const thisWeek=walks.filter(w=>Date.parse(w.startedAt)>=weekStart&&w.meters>0);
 const weekNewKm=thisWeek.reduce((sum,w)=>sum+w.newMeters,0)/1000,weekMin=Math.round(thisWeek.reduce((sum,w)=>sum+w.seconds,0)/60);
 // Lifetime numbers from the server's totals: its history list holds only the latest 50 walks.
 const totals=pulse.snapshot?.totals,lifetimeKm=(totals?totals.meters:walks.reduce((s,w)=>s+w.meters,0))/1000,lifetimeWalks=totals?totals.walks:walks.length;
 const records=useMemo(()=>personalRecords(history),[history]);
 const missions=pulse.snapshot?.missions||[],missionCount=missions.length||24;
 const stamps=Object.values(pulse.book.progress).filter(p=>p.completedAt).length;
 const active=missions.find(m=>m.id===pulse.book.selected);
 const next=useMemo(()=>suggestMission(missions,pulse.book,here),[missions,pulse.book,here]);
 const leave=()=>router.canGoBack()?router.back():router.replace('/(tabs)/home' as never);
 const choose=(id:string)=>{if(busy)return;setBusy(true);setMissionError('');void getPulseClient().selectMission(id).catch(()=>setMissionError(tx('მისია ვერ აირჩა. შეამოწმე ინტერნეტი და სცადე თავიდან.','Couldn’t choose the mission. Check your connection and try again.'))).finally(()=>setBusy(false));};
 const recordTiles=[
  records.longest&&{id:records.longest.id,art:RUN_ICON.route,value:formatKm(records.longest.distanceM,2),unit:tx('კმ', 'km'),label:tx('უგრძესი', 'Longest')},
  records.fastest&&{id:records.fastest.id,art:RUN_ICON.pace,value:formatPace(records.fastest.paceSecPerKm),unit:tx('/კმ', '/km'),label:tx('უსწრაფესი', 'Fastest')},
  records.longestTime&&{id:records.longestTime.id,art:RUN_ICON.timer,value:formatClock(records.longestTime.movingMs),unit:'',label:tx('უხანგრძლივესი', 'Longest time')},
 ].filter(Boolean) as {id:string;art:typeof RUN_HERO;value:string;unit:string;label:string}[];
 const shown=allWalks?history:history.slice(0,3);

 return <View style={{flex:1,backgroundColor:c.bg100}}><ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{paddingTop:insets.top+12,paddingBottom:insets.bottom+32,paddingHorizontal:HUB.gutter,gap:HUB.sectionGap}}>
  <ModuleHeader module="run" backLabel={tx('MEDICARD-ში დაბრუნება', 'Back to MEDICARD')} onBack={leave} subtitle={`${dayMoment()} ${tx('· შენი ქალაქის პულსი', '· your city’s pulse')}`}
   right={<ModuleHeaderButton label={tx('პარამეტრები', 'Settings')} icon={Settings2} onPress={()=>setPanel('settings')}/>}/>

  {/* The page's one spotlight: the lit city, live boxes and the start button. */}
  <RunHero streak={streak} onStart={()=>start()} onGoal={()=>setTargetSheet(true)}/>

  {error&&!pulse.snapshot?<Card><Copy bold size={15}>{tx('MEDIRUN-თან კავშირი ვერ დამყარდა', 'Couldn’t reach MEDIRUN')}</Copy><Copy muted size={12}>{tx('შეამოწმე ინტერნეტი. გასეირნება მაინც შეგიძლია — გზა შენახული დარჩება.', 'Check your connection. You can still walk — the route is saved.')}</Copy><Action secondary label={tx('ხელახლა ცდა', 'Try again')} onPress={()=>{setError('');void getPulseClient().refresh().catch(e=>setError(e.message));}}/></Card>:null}

  {/* Owner 2026-10-05 (third pass, by what moves people): where the boxes are, this week's race for the Monday
      prizes, the prize you are saving for and the coins that feed it, the Tbilisi campaign — then your last
      seven days, the passport and your walks. */}
  <RunDropsCard/>

  <RunRaceCard optedIn={Boolean(pulse.snapshot?.leaderboardOptIn)} onOpen={()=>setPanel('leaderboard')}/>

  <RunPrizeGoal/>

  {/* Owner 2026-10-04: the coins the boxes paid — balance and every movement — live on the MEDIRUN page too. */}
  <RunWallet/>

  <Section title={tx('გაანათე თბილისი','Light up Tbilisi')}>
   <GrandPrizeCard/>
  </Section>
  <PulseTerritory totalKm={lifetimeKm} walks={lifetimeWalks} weekNewKm={weekNewKm}/>

  <Section title={tx('ბოლო 7 დღე', 'Last 7 days')}>
   <Card style={{gap:18}}>
    <View style={{flexDirection:'row',alignItems:'baseline',gap:6}}><Copy bold size={34} style={{lineHeight:42,letterSpacing:-1,fontVariant:['tabular-nums']}}>{weekKm.toFixed(1)}</Copy><Copy bold size={14} style={{color:c.primary100}}>{tx('კმ', 'km')}</Copy><View style={{flex:1}}/><Copy muted size={12}>{weekDays?tx(`${weekDays} აქტიური დღე`, `${weekDays} active ${weekDays===1?'day':'days'}`):tx('ბოლო 7 დღეში ჯერ არ გაგისეირნია', 'No walks in the last 7 days')}</Copy></View>
    <WeekBars days={week}/>
    <View style={{flexDirection:'row',borderTopWidth:1,borderColor:c.bg200,paddingTop:14}}>
     {[{value:String(thisWeek.length),label:tx('გასეირნება', 'Walks')},{value:weekNewKm.toFixed(1),label:tx('ახალი ქუჩა, კმ', 'New streets, km')},{value:String(weekMin),label:tx('აქტიური წთ', 'Active min')}].map((st,i)=><View key={st.label} style={{flex:1,alignItems:'center',borderLeftWidth:i?1:0,borderColor:c.bg200}}><Copy bold size={17} style={{fontVariant:['tabular-nums']}}>{st.value}</Copy><Copy muted size={11} numberOfLines={1}>{st.label}</Copy></View>)}
    </View>
    {lifetimeWalks?<Copy muted size={11} style={{textAlign:'center',marginTop:-6}}>{tx(`სულ MEDIRUN-ში: ${lifetimeKm.toFixed(1)} კმ · ${lifetimeWalks} გასეირნება`,`All-time in MEDIRUN: ${lifetimeKm.toFixed(1)} km · ${lifetimeWalks} ${lifetimeWalks===1?'walk':'walks'}`)}</Copy>:null}
   </Card>
  </Section>

  <Section title={tx('თბილისის პასპორტი', 'Tbilisi passport')} link={tx('ყველა მისია', 'All missions')} onLink={()=>setPanel('missions')}>
   <Card style={{gap:16}}>
    <View style={{flexDirection:'row',alignItems:'center',gap:14}}>
     <View style={{flex:1,gap:6}}>
      <Copy bold size={16}>{tx(`${stamps} შტამპი ${missionCount}-დან`, `${stamps} of ${missionCount} stamps`)}</Copy>
      <Copy muted size={12}>{tx('პარკები, ტბები და ნაცნობი ადგილები — თითო ადგილი, თითო შტამპი.', 'Parks, lakes and familiar places — one stamp each.')}</Copy>
      <Bar value={stamps/missionCount*100} label={tx('თბილისის პასპორტის შტამპები', 'Tbilisi passport stamps')}/>
     </View>
     <Image source={RUN_ICON.passport} accessibilityIgnoresInvertColors resizeMode="contain" style={{width:76,height:76,transform:[{rotate:'-6deg'}]}}/>
    </View>
    {active?<Pressable accessibilityRole="button" accessibilityLabel={tx(`აქტიური მისია ${active.name}, ${missionPercent(pulse.book,active)} პროცენტი`, `Active mission ${active.name}, ${missionPercent(pulse.book,active)} percent`)} onPress={()=>setPanel('missions')} style={{flexDirection:'row',alignItems:'center',gap:10,paddingHorizontal:12,minHeight:44,borderRadius:14,backgroundColor:c.accent100}}>
     <Compass size={15} color={c.primary100}/><Copy bold size={12} numberOfLines={1} style={{flex:1}}>{tx('აქტიური მისია ·', 'Active mission ·')} {active.name}</Copy><Copy bold size={12} style={{color:c.primary100}}>{missionPercent(pulse.book,active)}%</Copy>
    </Pressable>:null}
    {next?<View style={{flexDirection:'row',alignItems:'center',gap:12,borderTopWidth:1,borderColor:c.bg200,paddingTop:14}}>
     <ArtTile source={MISSION_ART[next.m.id]||RUN_ICON.flag} size={56}/>
     <View style={{flex:1,minWidth:0}}><Copy muted size={11}>{next.d!=null?tx('შენთან ყველაზე ახლოს', 'Closest to you'):tx('შემდეგი აღმოჩენა', 'Next find')}</Copy><Copy bold size={14} numberOfLines={1}>{next.m.name}</Copy><Copy muted size={11} numberOfLines={1}>{next.m.meters} {tx('მ ზონაში', 'm zone')}{next.d!=null?tx(` · ${away(next.d)} შენგან`, ` · ${away(next.d)} away`):''}</Copy></View>
     <Pressable accessibilityRole="button" accessibilityLabel={tx(`მისიის არჩევა: ${next.m.name}`, `Choose mission: ${next.m.name}`)} disabled={busy} onPress={()=>choose(next.m.id)} style={{minHeight:44,paddingHorizontal:16,borderRadius:14,backgroundColor:c.accent100,justifyContent:'center',opacity:busy?.6:1}}><Copy bold size={12} style={{color:c.primary100}}>{tx('არჩევა', 'Choose')}</Copy></Pressable>
    </View>:null}
    {missionError?<Copy size={12} style={{color:c.danger}}>{missionError}</Copy>:null}
   </Card>
  </Section>

  {history.length?<Section title={tx('შენი გასეირნებები', 'Your walks')} link={history.length>3?(allWalks?tx('ნაკლები', 'Less'):tx(`ყველა · ${history.length}`, `All · ${history.length}`)):undefined} onLink={()=>setAllWalks(v=>!v)}>
   {recordTiles.length?<View style={{flexDirection:'row',gap:8,marginBottom:10}}>{recordTiles.map(r=><Pressable key={r.label} accessibilityRole="button" accessibilityLabel={`${r.label}: ${r.value} ${r.unit}`} onPress={()=>router.push(`/run/${r.id}` as never)} style={{flex:1,backgroundColor:c.surface,borderRadius:18,paddingVertical:12,paddingHorizontal:10,gap:6}}>
    <ArtTile source={r.art} size={34}/>
    <View style={{flexDirection:'row',alignItems:'baseline',gap:2}}><Copy bold size={16} numberOfLines={1} style={{fontVariant:['tabular-nums'],flexShrink:1}}>{r.value}</Copy>{r.unit?<Copy bold size={10} style={{color:c.primary100}}>{r.unit}</Copy>:null}</View>
    <Copy muted size={10} numberOfLines={1}>{r.label}</Copy>
   </Pressable>)}</View>:null}
   <Card style={{paddingVertical:6,gap:0}}>{shown.map((run,i)=><Pressable key={run.id} accessibilityRole="button" accessibilityLabel={tx(`${formatKm(run.distanceM,2)} კილომეტრი, ${formatRunDate(run.startedAt)}`, `${formatKm(run.distanceM,2)} kilometers, ${formatRunDate(run.startedAt)}`)} onPress={()=>router.push(`/run/${run.id}` as never)} style={{flexDirection:'row',alignItems:'center',gap:14,paddingVertical:12,borderTopWidth:i?1:0,borderColor:c.bg200}}>
    <RouteThumb segments={run.segments?.length?run.segments:[run.path]}/>
    <View style={{flex:1,minWidth:0}}><Copy bold size={15} style={{fontVariant:['tabular-nums']}}>{formatKm(run.distanceM,2)} {tx('კმ', 'km')}</Copy><Copy muted size={11} numberOfLines={1}>{walkDay(run.startedAt)} · {Math.max(1,Math.round(run.movingMs/60000))} {tx('წთ', 'min')}</Copy></View>
    <Copy muted size={11} style={{fontVariant:['tabular-nums']}}>{formatPace(run.paceSecPerKm)}{tx('/კმ', '/km')}</Copy>
    <ChevronRight color={c.text300} size={17}/>
   </Pressable>)}</Card>
  </Section>:null}

  <View style={{flexDirection:'row',gap:12}}>{[{id:'collection' as const,label:tx('კოლექცია', 'Collection'),detail:tx(`${pulse.snapshot?.claims.length||0} საჩუქარი · ${stamps} შტამპი`, `${pulse.snapshot?.claims.length||0} ${(pulse.snapshot?.claims.length||0)===1?'gift':'gifts'} · ${stamps} ${stamps===1?'stamp':'stamps'}`),art:RUN_GIFT,ink:'amber' as const},{id:'help' as const,label:tx('წესები', 'Rules'),detail:tx('როგორ მუშაობს', 'How it works'),art:RUN_ICON.atlas,ink:'teal' as const}].map(item=><Pressable key={item.id} accessibilityRole="button" accessibilityLabel={`${item.label}. ${item.detail}`} onPress={()=>setPanel(item.id)} style={{flex:1}}>
   <Card style={{minHeight:120,gap:10}}><View style={{flexDirection:'row',justifyContent:'space-between'}}><ArtTile source={item.art} ink={item.ink} size={48}/><ArrowUpRight size={17} color={c.text300}/></View><View><Copy bold size={15} numberOfLines={1}>{item.label}</Copy><Copy muted size={11} numberOfLines={1}>{item.detail}</Copy></View></Card>
  </Pressable>)}</View>
 </ScrollView><RunTargetSheet visible={targetSheet} onClose={()=>setTargetSheet(false)} onConfirm={start} weightKg={healthProfile?.weightKg} heightCm={healthProfile?.heightCm}/><PulsePanels panel={panel} onClose={()=>setPanel(null)} onTestPulse={()=>void testPulse()}/></View>;
}
