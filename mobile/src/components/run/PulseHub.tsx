import React,{useCallback,useMemo,useState} from 'react';
import {Image,Pressable,ScrollView,View} from 'react-native';
import Svg,{Defs,LinearGradient,Rect,Stop} from 'react-native-svg';
import {useFocusEffect,useRouter} from 'expo-router';
import * as Location from 'expo-location';
import {ArrowUpRight,BookOpen,ChevronRight,Compass,Flame,Gauge,Gift,Landmark,MapPin,Mountain,Play,Route,Settings2,Target,Timer,Trees,Trophy,Volume2,Waves} from 'lucide-react-native';
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
import {Action,ArtTile,Bar,Card,Copy,RUN_CTA,Section,useRunInk} from './PulseUi';
import {MISSION_ART,RUN_GIFT,RUN_HERO,RUN_ICON} from './runArt';
import {PulseGlyph} from './PulseIdentity';
import {ModuleHeader,ModuleHeaderButton} from '@/components/brand/ModuleHeader';
import {RouteThumb,WeekBars} from './RunVisuals';
import {PulseTerritory} from './PulseTerritory';
import {GrandPrizeCard} from './GrandPrizeCard';
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
const away=(m:number)=>m<1000?tx(`${Math.round(m/10)*10} მ`, `${Math.round(m/10)*10} m`):tx(`${(m/1000).toFixed(m<10000?1:0)} კმ`, `${(m/1000).toFixed(m<10000?1:0)} km`);

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
  records.longest&&{id:records.longest.id,art:RUN_ICON.route,value:formatKm(records.longest.distanceM,2),unit:tx('კმ', 'km'),label:tx('ყველაზე გრძელი', 'Longest')},
  records.fastest&&{id:records.fastest.id,art:RUN_ICON.pace,value:formatPace(records.fastest.paceSecPerKm),unit:tx('/კმ', '/km'),label:tx('საუკეთესო ტემპი', 'Best pace')},
  records.longestTime&&{id:records.longestTime.id,art:RUN_ICON.timer,value:formatClock(records.longestTime.movingMs),unit:'',label:tx('ყველაზე ხანგრძლივი', 'Longest duration')},
 ].filter(Boolean) as {id:string;art:typeof RUN_HERO;value:string;unit:string;label:string}[];
 const shown=allWalks?history:history.slice(0,3);

 return <View style={{flex:1,backgroundColor:c.bg100}}><ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{paddingTop:insets.top+12,paddingBottom:insets.bottom+32,paddingHorizontal:HUB.gutter,gap:HUB.sectionGap}}>
  <ModuleHeader module="run" backLabel={tx('MEDICARD-ში დაბრუნება', 'Back to MEDICARD')} onBack={leave} subtitle={`${dayMoment()} ${tx('· შენი ქალაქის პულსი', '· your city’s pulse')}`}
   right={<ModuleHeaderButton label={tx('პარამეტრები', 'Settings')} icon={Settings2} onPress={()=>setPanel('settings')}/>}/>

  {/* The page's one spotlight. */}
  <View style={{backgroundColor:HUB.spotlightBg,borderRadius:HUB.cardRadius,overflow:'hidden'}}>
   <View style={{paddingHorizontal:HUB.cardPad+2,paddingTop:HUB.cardPad+2,gap:8}}>
    <View style={{flexDirection:'row',alignItems:'center',gap:8}}>
     {streak>0?<View style={{flexDirection:'row',alignItems:'center',gap:5,backgroundColor:'rgba(251,191,36,0.14)',borderRadius:10,paddingHorizontal:9,paddingVertical:3}}><Flame size={13} color="#FCD34D" fill="#FCD34D"/><Copy bold size={11} style={{color:'#FDE68A'}}>{streak} {tx('დღე ზედიზედ', 'day streak')}</Copy></View>
      :<View style={{flexDirection:'row',alignItems:'center',gap:7}}><View style={{width:6,height:6,borderRadius:3,backgroundColor:'#2DD4BF'}}/><Copy bold size={11} style={{color:'#99F6E4'}}>{tx('შენი ტემპით · ნებისმიერ ქალაქში', 'At your pace · in any city')}</Copy></View>}
    </View>
    <Copy bold size={27} style={{lineHeight:38,color:'#fff'}}>{streak>1?tx('რიტმს ნუ დაკარგავ.\nგზა გელოდება.','Keep the rhythm.\nYour path is waiting.'):tx('გარეთ ახალი\nამბავი იწყება.','A new story\nstarts outside.')}</Copy>
    <Copy size={13} style={{color:'#C5DADA'}}>{weekKm>0?tx(`ამ კვირაში უკვე ${weekKm.toFixed(1)} კმ გაიარე.`, `You’ve already walked ${weekKm.toFixed(1)} km this week.`):tx('გადადგი პირველი ნაბიჯი. დანარჩენს გზად აღმოაჩენ.', 'Take the first step. You’ll discover the rest along the way.')}</Copy>
   </View>
   <View style={{marginTop:6,height:176}}>
    <Image source={RUN_HERO} accessibilityIgnoresInvertColors resizeMode="cover" style={{width:'100%',height:'100%'}}/>
    {/* Melt the illustration into the card above and below. */}
    <Svg pointerEvents="none" style={{position:'absolute',inset:0}} width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 10 10"><Defs><LinearGradient id="heroFade" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor={HUB.spotlightBg} stopOpacity="1"/><Stop offset=".22" stopColor={HUB.spotlightBg} stopOpacity="0"/><Stop offset=".78" stopColor={HUB.spotlightBg} stopOpacity="0"/><Stop offset="1" stopColor={HUB.spotlightBg} stopOpacity="1"/></LinearGradient></Defs><Rect x="0" y="0" width="10" height="10" fill="url(#heroFade)"/></Svg>
   </View>
   <View style={{padding:HUB.cardPad,paddingTop:4,gap:8}}>
    {active?<Pressable accessibilityRole="button" accessibilityLabel={tx(`აქტიური მისია ${active.name}, ${missionPercent(pulse.book,active)} პროცენტი`, `Active mission ${active.name}, ${missionPercent(pulse.book,active)} percent`)} onPress={()=>setPanel('missions')} style={{flexDirection:'row',alignItems:'center',gap:10,paddingHorizontal:12,paddingVertical:9,borderRadius:14,backgroundColor:'rgba(255,255,255,0.07)'}}>
     <Compass size={15} color="#99F6E4"/><Copy bold size={12} numberOfLines={1} style={{flex:1,color:'#fff'}}>{tx('მისია ·', 'Mission ·')} {active.name}</Copy><Copy bold size={12} style={{color:'#99F6E4'}}>{missionPercent(pulse.book,active)}%</Copy>
    </Pressable>:null}
    <Pressable accessibilityRole="button" accessibilityLabel={tx('დავიწყოთ აღმოჩენა — თავისუფალი გასეირნება', 'Start exploring — free walk')} onPress={()=>start()} style={{minHeight:58,borderRadius:18,backgroundColor:RUN_CTA,paddingHorizontal:14,flexDirection:'row',alignItems:'center',gap:12}}>
     <View style={{width:34,height:34,borderRadius:12,backgroundColor:'rgba(255,255,255,0.16)',alignItems:'center',justifyContent:'center'}}><Play fill="#fff" color="#fff" size={15}/></View>
     <Copy bold size={15} style={{flex:1,color:'#fff'}}>{tx('დავიწყოთ აღმოჩენა', 'Start exploring')}</Copy><ArrowUpRight color="#CCFBF1" size={22}/>
    </Pressable>
    <Pressable accessibilityRole="button" onPress={()=>setTargetSheet(true)} style={{minHeight:44,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8}}><Target size={16} color="#99F6E4"/><Copy bold size={12} style={{color:'#fff'}}>{tx('ან ივარჯიშე მიზნით', 'or train with a goal')}</Copy><ChevronRight size={14} color="#99F6E4"/></Pressable>
   </View>
  </View>

  {error&&!pulse.snapshot?<Card><Copy muted>{error}</Copy><Action secondary label={tx('კავშირის განახლება', 'Reconnect')} onPress={()=>{setError('');void getPulseClient().refresh().catch(e=>setError(e.message));}}/></Card>:null}

  <GrandPrizeCard/>

  <Section title={tx('ეს კვირა', 'This week')} link={tx('ისტორია', 'History')} onLink={()=>setPanel('collection')}>
   <Card style={{gap:18}}>
    <View style={{flexDirection:'row',alignItems:'flex-end',gap:12}}>
     <View style={{flex:1}}><View style={{flexDirection:'row',alignItems:'baseline',gap:6}}><Copy bold size={34} style={{lineHeight:42,letterSpacing:-1,fontVariant:['tabular-nums']}}>{weekKm.toFixed(1)}</Copy><Copy bold size={14} style={{color:c.primary100}}>{tx('კმ', 'km')}</Copy></View><Copy muted size={12}>{weekWalks?tx(`${weekWalks} აქტიური დღე ბოლო 7 დღეში`, `${weekWalks} active ${weekWalks===1?'day':'days'} in the last 7 days`):tx('ამ კვირაში ჯერ არ გაგისეირნია', 'No walks this week yet')}</Copy></View>
    </View>
    <WeekBars days={week}/>
    <View style={{flexDirection:'row',borderTopWidth:1,borderColor:c.bg200,paddingTop:14}}>
     {[{value:lifetimeKm.toFixed(1),label:tx('სულ კმ', 'Total km')},{value:String(walks.length),label:tx('გასეირნება', 'Walks')},{value:`${stamps}/${missionCount}`,label:tx('შტამპი', 'Stamps')}].map((s,i)=><View key={s.label} style={{flex:1,alignItems:'center',borderLeftWidth:i?1:0,borderColor:c.bg200}}><Copy bold size={17} style={{fontVariant:['tabular-nums']}}>{s.value}</Copy><Copy muted size={11}>{s.label}</Copy></View>)}
    </View>
   </Card>
  </Section>

  <PulseTerritory totalKm={lifetimeKm} walks={walks.length}/>

  {recordTiles.length?<Section title={tx('შენი რეკორდები', 'Your records')}>
   <View style={{flexDirection:'row',gap:10}}>{recordTiles.map(r=><Pressable key={r.label} accessibilityRole="button" accessibilityLabel={`${r.label}: ${r.value} ${r.unit}`} onPress={()=>router.push(`/run/${r.id}` as never)} style={{flex:1}}>
    <Card style={{padding:14,gap:10,minHeight:128}}><ArtTile source={r.art} size={44}/><View style={{gap:1}}><View style={{flexDirection:'row',alignItems:'baseline',gap:3}}><Copy bold size={18} numberOfLines={1} style={{fontVariant:['tabular-nums'],flexShrink:1}}>{r.value}</Copy>{r.unit?<Copy bold size={10} style={{color:c.primary100}}>{r.unit}</Copy>:null}</View><Copy muted size={11} numberOfLines={2}>{r.label}</Copy></View></Card>
   </Pressable>)}</View>
  </Section>:null}

  <Section title={tx('თბილისის პასპორტი', 'Tbilisi passport')} link={tx('ყველა მისია', 'All missions')} onLink={()=>setPanel('missions')}>
   <Card style={{gap:16}}>
    <View style={{flexDirection:'row',alignItems:'center',gap:14}}>
     <View style={{flex:1,gap:4}}><Copy bold size={16}>{tx('ქალაქი სავსეა ისტორიებით', 'The city is full of stories')}</Copy><Copy muted size={12}>{tx('პარკები, ტბები და ნაცნობი ადგილები ახალი თვალით.', 'Parks, lakes and familiar places through new eyes.')}</Copy></View>
     <View style={{width:84,height:84,alignItems:'center',justifyContent:'center'}}><Image source={RUN_ICON.passport} accessibilityIgnoresInvertColors resizeMode="contain" style={{width:84,height:84,transform:[{rotate:'-6deg'}]}}/><View style={{position:'absolute',right:-4,bottom:2,minWidth:44,paddingHorizontal:8,paddingVertical:3,borderRadius:12,backgroundColor:c.surface,borderWidth:1.5,borderColor:ink,alignItems:'center'}}><Copy bold size={12} style={{color:ink,fontVariant:['tabular-nums']}}>{stamps}/{missionCount}</Copy></View></View>
    </View>
    <Bar value={stamps/missionCount*100} label={tx('თბილისის პასპორტის შტამპები', 'Tbilisi passport stamps')}/>
    {next?<View style={{flexDirection:'row',alignItems:'center',gap:12,borderTopWidth:1,borderColor:c.bg200,paddingTop:14}}>
     <ArtTile source={MISSION_ART[next.m.id]||RUN_ICON.flag} size={58}/>
     <View style={{flex:1,minWidth:0}}><Copy muted size={11}>{next.d!=null?tx('შენთან ყველაზე ახლოს', 'Closest to you'):tx('შემდეგი აღმოჩენა', 'Next find')}</Copy><Copy bold size={14} numberOfLines={1}>{next.m.name}</Copy><Copy muted size={11}>{next.m.meters} {tx('მ ზონაში', 'm zone')}{next.d!=null?tx(` · ${away(next.d)} შენგან`, ` · ${away(next.d)} away`):''}</Copy></View>
     <Pressable accessibilityRole="button" accessibilityLabel={tx(`მისიის არჩევა: ${next.m.name}`, `Choose mission: ${next.m.name}`)} disabled={busy} onPress={()=>choose(next.m.id)} style={{minHeight:40,paddingHorizontal:14,borderRadius:14,backgroundColor:c.accent100,justifyContent:'center',opacity:busy?.6:1}}><Copy bold size={12} style={{color:c.primary100}}>{tx('არჩევა', 'Choose')}</Copy></Pressable>
    </View>:null}
   </Card>
  </Section>

  <View style={{flexDirection:'row',gap:12}}>{[{id:'collection' as const,label:tx('კოლექცია', 'Collection'),detail:tx(`${pulse.snapshot?.claims.length||0} საჩუქარი · ${stamps} შტამპი`, `${pulse.snapshot?.claims.length||0} ${(pulse.snapshot?.claims.length||0)===1?'gift':'gifts'} · ${stamps} ${stamps===1?'stamp':'stamps'}`),art:RUN_GIFT,ink:'amber' as const},{id:'leaderboard' as const,label:tx('ლიდერბორდი', 'Leaderboard'),detail:pulse.snapshot?.leaderboardOptIn?tx('შენ სიაში ხარ', 'You’re on the list'):tx('ერთად უფრო შორს', 'Further together'),art:RUN_ICON.trophy,ink:'violet' as const}].map(item=><Pressable key={item.id} accessibilityRole="button" accessibilityLabel={`${item.label}. ${item.detail}`} onPress={()=>setPanel(item.id)} style={{flex:1}}>
   <Card style={{minHeight:128,gap:10}}><View style={{flexDirection:'row',justifyContent:'space-between'}}><ArtTile source={item.art} ink={item.ink} size={52}/><ArrowUpRight size={17} color={c.text300}/></View><View><Copy bold size={15}>{item.label}</Copy><Copy muted size={11}>{item.detail}</Copy></View></Card>
  </Pressable>)}</View>

  {history.length?<Section title={tx('ბოლო გასეირნებები', 'Recent walks')} link={history.length>3?(allWalks?tx('ნაკლები', 'Less'):tx(`ყველა · ${history.length}`, `All · ${history.length}`)):undefined} onLink={()=>setAllWalks(v=>!v)}>
   <Card style={{paddingVertical:6,gap:0}}>{shown.map((run,i)=><Pressable key={run.id} accessibilityRole="button" accessibilityLabel={tx(`${formatKm(run.distanceM,2)} კილომეტრი, ${formatRunDate(run.startedAt)}`, `${formatKm(run.distanceM,2)} kilometers, ${formatRunDate(run.startedAt)}`)} onPress={()=>router.push(`/run/${run.id}` as never)} style={{flexDirection:'row',alignItems:'center',gap:14,paddingVertical:12,borderTopWidth:i?1:0,borderColor:c.bg200}}>
    <RouteThumb segments={run.segments?.length?run.segments:[run.path]}/>
    <View style={{flex:1,minWidth:0}}><Copy bold size={15} style={{fontVariant:['tabular-nums']}}>{formatKm(run.distanceM,2)} {tx('კმ', 'km')}</Copy><Copy muted size={11} numberOfLines={1}>{formatRunDate(run.startedAt)} · {Math.max(1,Math.round(run.movingMs/60000))} {tx('წთ ·', 'min ·')} {formatPace(run.paceSecPerKm)} {tx('/კმ', '/km')}</Copy></View>
    <ChevronRight color={c.text300} size={17}/>
   </Pressable>)}</Card>
  </Section>:null}

  <Pressable accessibilityRole="button" accessibilityLabel={tx('აღმოჩენის პულსის მოსმენა', 'Listen to the discovery pulse')} onPress={()=>void testPulse()}><Card style={{flexDirection:'row',alignItems:'center',gap:14}}><PulseGlyph size={42}/><View style={{flex:1,gap:2}}><Copy bold size={14}>{tx('ჯერ იგრძნობ. მერე დაინახავ.', 'First you feel it. Then you see it.')}</Copy><Copy muted size={12}>{tx('მოუსმინე, როგორ გიხმობს საჩუქარი', 'Hear how a gift calls to you')}</Copy></View><Volume2 size={19} color={c.primary100}/></Card></Pressable>

  <Pressable accessibilityRole="button" onPress={()=>setPanel('help')} style={{minHeight:44,marginTop:-12,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:9}}><BookOpen size={16} color={c.text200}/><Copy muted size={12}>{tx('როგორ მუშაობს MEDIRUN?', 'How does MEDIRUN work?')}</Copy><ChevronRight size={15} color={c.text300}/></Pressable>
 </ScrollView><RunTargetSheet visible={targetSheet} onClose={()=>setTargetSheet(false)} onConfirm={start} weightKg={healthProfile?.weightKg} heightCm={healthProfile?.heightCm}/><PulsePanels panel={panel} onClose={()=>setPanel(null)} onTestPulse={()=>void testPulse()}/></View>;
}
