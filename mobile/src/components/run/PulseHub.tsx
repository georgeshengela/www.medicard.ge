import React,{useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {AppState,Image,Pressable,ScrollView,View,useWindowDimensions} from 'react-native';
import {useFocusEffect,useIsFocused,useLocalSearchParams,useRouter} from 'expo-router';
import * as Location from 'expo-location';
import {ArrowUpRight,Compass,House,Landmark,Mountain,Trees,Waves} from 'lucide-react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useAuth} from '@/store/AuthContext';
import {useThemeColors} from '@/theme/colors';
import {HUB} from '@/theme/hub';
import {getRunState,hydrateActiveRun,isActiveRunPhase,prepareExploration,prepareRun} from '@/lib/run/store';
import {startHunt} from '@/lib/run/hunt';
import {setDropsAt} from '@/lib/medipulsi/drops';
import {loadRunHistory,type RunSummary} from '@/lib/run/history';
import {type RunTarget} from '@/lib/run/geo';
import {dayMoment,walkStreak,weekBuckets} from '@/lib/run/insights';
import {getPulseClient,usePulse} from '@/lib/medipulsi/client';
import {missionPercent,missionProgress,type Mission} from '@/lib/medipulsi/core/missions';
import {distance,type Coordinate} from '@/lib/medipulsi/core/engine';
import {useHeartbeat} from '@/lib/medipulsi/useHeartbeat';
import {EMPTY_SIGNAL} from '@/lib/medipulsi/types';
import {RunTargetSheet} from './RunTargetSheet';
import {PulsePanels,type PulsePanel} from './PulsePanels';
import {Action,ArtTile,Bar,Card,Copy,Section} from './PulseUi';
import {MISSION_ART,RUN_GIFT,RUN_ICON} from './runArt';
import {ModuleHeader,ModuleHeaderButton} from '@/components/brand/ModuleHeader';
import {GrandPrizeCard} from './GrandPrizeCard';
import {RunDropsCard,type HuntPlace} from './RunDrops';
import {RunWallet} from './RunWallet';
import {RunLobby} from './RunLobby';
import {FirstWalkGuide,TodayStrip} from './RunToday';
import {RunWaveAlert} from './RunWaveAlert';
import {RunPendingPrizes} from './RunPendingPrizes';
import {RunStampGrid} from './RunStampGrid';
import {RunPrizeGoal} from './RunPrizeGoal';
import {RunRaceCard} from './RunRaceCard';
import {RunCrewCard} from './RunCrewCard';
import {RunCityCard} from './RunCityCard';
import {RunWrappedCard} from './RunWrappedCard';
import {RunHubTabBar,useRunHubTabsInset,type RunHubTab} from './RunHubTabs';
import {RunCitiesEntry} from './RunCities';
import {HubMoreRows,RecentWalks,RecordTiles,WeekSpotlight} from './RunProgress';

/** The section the person was on: a walk detail and back, or a finished walk, opens the hub where they left it. */
let lastTab:RunHubTab='start';
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
 const router=useRouter(),c=useThemeColors(),insets=useSafeAreaInsets(),{healthProfile}=useAuth(),pulse=usePulse(),params=useLocalSearchParams<{crew?:string}>();
 // The lobby's 3D city runs only while Start is on screen and the app is in front.
 const focused=useIsFocused(),{height:winH}=useWindowDimensions(),[appActive,setAppActive]=useState(AppState.currentState==='active');
 useEffect(()=>{const sub=AppState.addEventListener('change',st=>setAppActive(st==='active'));return()=>sub.remove();},[]);
 // Scrolled past the lobby: the 3D city stops (owner 2026-10-09: the phone got hot).
 const [lobbySeen,setLobbySeen]=useState(true);
 const [history,setHistory]=useState<RunSummary[]>([]),[targetSheet,setTargetSheet]=useState(false),[panel,setPanel]=useState<PulsePanel|null>(null),[error,setError]=useState(''),[missionError,setMissionError]=useState(''),[here,setHere]=useState<Coordinate|null>(null),[busy,setBusy]=useState(false);
 const testPulse=useHeartbeat(EMPTY_SIGNAL,pulse.snapshot?.settings||{},false);
 useFocusEffect(useCallback(()=>{
  let alive=true;
  // A live session stays on the hub (owner 2026-10-08): back from the map lands here; the top badge reopens the map.
  void hydrateActiveRun().then(()=>{if(!alive)return;const phase=getRunState().phase;if(phase==='ready'||phase==='preparing')router.replace('/run/active' as never);});
  void loadRunHistory().then(list=>{if(alive)setHistory(list);});
  void getPulseClient().refresh().catch(e=>{if(alive)setError(e.message);});
  // Read-only: a last known (else one fresh) fix orders missions and box districts by distance. Never asks for permission here.
  // The boxes card needs only the city: any last known fix (even an old one) goes at once, a fresh one follows.
  void Location.getForegroundPermissionsAsync().then(async p=>{
   if(!p.granted)return;
   const old=await Location.getLastKnownPositionAsync().catch(()=>null);
   if(alive&&old)setDropsAt([old.coords.longitude,old.coords.latitude]);
   const fix=(await Location.getLastKnownPositionAsync({maxAge:15*60_000}).catch(()=>null))||await Location.getCurrentPositionAsync({accuracy:Location.Accuracy.Balanced}).catch(()=>null);
   if(alive&&fix){setHere([fix.coords.longitude,fix.coords.latitude]);setDropsAt([fix.coords.longitude,fix.coords.latitude]);}
  }).catch(()=>{});
  return()=>{alive=false;};
 },[router]));
 // A place from „სად არის ყუთები“: the map opens on it (a running walk just gets the new destination).
 const hunt=(place:HuntPlace)=>{startHunt(place);if(isActiveRunPhase(getRunState().phase))router.push('/run/active' as never);else start();};
 const start=(target?:RunTarget)=>{setTargetSheet(false);const body={weightKg:healthProfile?.weightKg,heightCm:healthProfile?.heightCm};void (target?prepareRun(target,body):prepareExploration(body));router.push('/run/active' as never);};
 const saved=pulse.snapshot?.history||[];
 const walks=useMemo(()=>saved.length?saved.map(s=>({startedAt:s.startedAt,meters:s.meters,seconds:s.seconds||0,newMeters:s.newMeters||0})):history.map(r=>({startedAt:r.startedAt,meters:r.distanceM,seconds:Math.round((r.movingMs||0)/1000),newMeters:0})),[saved,history]);
 const week=useMemo(()=>weekBuckets(walks),[walks]),streak=useMemo(()=>walkStreak(walks),[walks]);
 // Lifetime numbers from the server's totals: its history list holds only the latest 50 walks.
 const totals=pulse.snapshot?.totals,lifetimeKm=(totals?totals.meters:walks.reduce((s,w)=>s+w.meters,0))/1000,lifetimeWalks=totals?totals.walks:walks.length;
 // Stage 2 (owner 2026-10-09): the day at a glance and the first-walk steps.
 const todayKm=useMemo(()=>{const d=new Date(),from=new Date(d.getFullYear(),d.getMonth(),d.getDate()).getTime();return walks.filter(w=>Date.parse(w.startedAt)>=from).reduce((s,w)=>s+w.meters,0)/1000;},[walks]);
 const walkedOnce=lifetimeKm>=0.2||walks.some(w=>w.meters>=200),litOnce=Boolean((totals?.newMeters||0)>0||walks.some(w=>w.newMeters>0)),openedOnce=Boolean(pulse.snapshot?.claims.length);
 const missions=pulse.snapshot?.missions||[],missionCount=missions.length||24;
 const stamps=Object.values(pulse.book.progress).filter(p=>p.completedAt).length;
 const active=missions.find(m=>m.id===pulse.book.selected);
 const next=useMemo(()=>suggestMission(missions,pulse.book,here),[missions,pulse.book,here]);
 const leave=()=>router.canGoBack()?router.back():router.replace('/(tabs)/home' as never);
 const goHome=()=>router.replace('/(tabs)/home' as never);
 const [tab,setTabState]=useState<RunHubTab>(lastTab),scroll=useRef<ScrollView>(null),tabsInset=useRunHubTabsInset();
 const setTab=(next:RunHubTab)=>{lastTab=next;if(next!==tab){setTabState(next);setLobbySeen(true);scroll.current?.scrollTo({y:0,animated:false});}else scroll.current?.scrollTo({y:0,animated:true});};
 // A crew invite link opens the „ერთად“ section with the join sheet.
 useEffect(()=>{if(params.crew){lastTab='together';setTabState('together');}},[params.crew]);
 const choose=(id:string)=>{if(busy)return;setBusy(true);setMissionError('');void getPulseClient().selectMission(id).catch(()=>setMissionError(tx('მისია ვერ აირჩა. შეამოწმე ინტერნეტი და სცადე თავიდან.','Couldn’t choose the mission. Check your connection and try again.'))).finally(()=>setBusy(false));};

 const headerEl=<ModuleHeader module="run" backLabel={tx('MEDICARD-ში დაბრუნება', 'Back to MEDICARD')} onBack={leave} subtitle={`${dayMoment()} ${tx('· შენი ქალაქის პულსი', '· your city’s pulse')}`}
   right={<ModuleHeaderButton label={tx('მთავარზე დაბრუნება', 'Back to Home')} icon={House} onPress={goHome}/>}/>;
 return <View style={{flex:1,backgroundColor:c.bg100}}><ScrollView ref={scroll} scrollEventThrottle={250} onScroll={e=>{const seen=e.nativeEvent.contentOffset.y<Math.max(560,winH-150)*0.7;if(seen!==lobbySeen)setLobbySeen(seen);}} showsVerticalScrollIndicator={false} contentContainerStyle={{paddingTop:insets.top+12,paddingBottom:tabsInset,paddingHorizontal:HUB.gutter,gap:HUB.sectionGap}}>
  {tab!=='start'?headerEl:null}


  {error&&!pulse.snapshot?<Card><Copy bold size={15}>{tx('MEDIRUN-თან კავშირი ვერ დამყარდა', 'Couldn’t reach MEDIRUN')}</Copy><Copy muted size={12}>{tx('შეამოწმე ინტერნეტი. გასეირნება მაინც შეგიძლია — გზა შენახული დარჩება.', 'Check your connection. You can still walk — the route is saved.')}</Copy><Action secondary label={tx('ხელახლა ცდა', 'Try again')} onPress={()=>{setError('');void getPulseClient().refresh().catch(e=>setError(e.message));}}/></Card>:null}

  {/* Owner 2026-10-05: the page grew too long — four sections under a bottom menu, each short. */}
  {tab==='start'?<>
  <RunLobby header={headerEl} today={<TodayStrip todayKm={todayKm}/>} active={focused&&appActive&&lobbySeen} onStart={()=>start()} onGoal={()=>setTargetSheet(true)} onMore={()=>scroll.current?.scrollTo({y:Math.max(560,winH-150)-insets.top-60,animated:true})}/>

  {pulse.snapshot?<FirstWalkGuide walked={walkedOnce} lit={litOnce} opened={openedOnce} onStart={()=>start()}/>:null}
  <RunDropsCard here={here} onHunt={hunt}/>
  <RunWaveAlert/>
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
    <RunStampGrid missions={missions} book={pulse.book} nextId={next?.m.id||null} onOpen={()=>setPanel('missions')}/>
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

  {/* What you did, under what to do next (owner 2026-10-09: walks live on Start). */}
  <RecentWalks history={history}/>
  </>:null}

  {tab==='rewards'?<>
  {/* Owner 2026-10-09 order (research: balance first, then the goal, then the big prize, then the collection). */}
  <RunWallet/>
  <RunPendingPrizes/>
  <RunPrizeGoal/>
  <Section title={tx('გაანათე თბილისი','Light up Tbilisi')}>
   <GrandPrizeCard/>
  </Section>
  <Pressable accessibilityRole="button" accessibilityLabel={tx(`კოლექცია: ${pulse.snapshot?.claims.length||0} საჩუქარი, ${stamps} შტამპი`,`Collection: ${pulse.snapshot?.claims.length||0} gifts, ${stamps} stamps`)} onPress={()=>setPanel('collection')}>
   <Card style={{flexDirection:'row',alignItems:'center',gap:14}}>
    <ArtTile source={RUN_GIFT} ink="amber" size={52}/>
    <View style={{flex:1,minWidth:0}}><Copy bold size={15}>{tx('ჩემი კოლექცია','My collection')}</Copy><Copy muted size={12} numberOfLines={1}>{tx(`${pulse.snapshot?.claims.length||0} გახსნილი ყუთი · ${stamps} პასპორტის შტამპი`,`${pulse.snapshot?.claims.length||0} boxes opened · ${stamps} passport stamps`)}</Copy></View>
    <ArrowUpRight size={18} color={c.text300}/>
   </Card>
  </Pressable>
  </>:null}

  {tab==='together'?<>
  {/* Friends walk together: crews, „ერთად“ and together-km coins (owner 2026-10-05); friends before the city board. */}
  <RunCrewCard joinCode={params.crew} onJoinCodeUsed={()=>router.setParams({crew:undefined} as never)}/>
  <RunRaceCard optedIn={Boolean(pulse.snapshot?.leaderboardOptIn)} onOpen={()=>setPanel('leaderboard')}/>

  <RunCityCard/>
  </>:null}

  {tab==='progress'?<>
  {/* Monday–Wednesday: last week in one card with a video to share (owner 2026-10-05). */}
  <RunWrappedCard/>
  <WeekSpotlight week={week} walks={walks} streak={streak} lifetimeKm={lifetimeKm} lifetimeWalks={lifetimeWalks}/>
  <RecordTiles history={history}/>
  <RunCitiesEntry/>
  <HubMoreRows onHelp={()=>setPanel('help')} onSettings={()=>setPanel('settings')}/>
  </>:null}
 </ScrollView><RunHubTabBar value={tab} onChange={setTab}/><RunTargetSheet visible={targetSheet} onClose={()=>setTargetSheet(false)} onConfirm={start} weightKg={healthProfile?.weightKg} heightCm={healthProfile?.heightCm}/><PulsePanels panel={panel} onClose={()=>setPanel(null)} onTestPulse={()=>void testPulse()}/></View>;
}
