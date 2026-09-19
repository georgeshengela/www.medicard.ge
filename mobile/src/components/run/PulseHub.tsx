import React,{useCallback,useState} from 'react';
import {Pressable,ScrollView,View} from 'react-native';
import {useFocusEffect,useRouter} from 'expo-router';
import {ArrowLeft,BookOpen,ChevronRight,Compass,Footprints,Gift,Globe2,Play,Route,Settings2,Target,Trophy} from 'lucide-react-native';
import Svg,{Circle,Path} from 'react-native-svg';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useTabBarInset} from '@/components/navigation/FloatingTabBar';
import {useAuth} from '@/store/AuthContext';
import {useThemeColors} from '@/theme/colors';
import {getRunState,hydrateActiveRun,isActiveRunPhase,prepareExploration,prepareRun} from '@/lib/run/store';
import {loadRunHistory,type RunSummary} from '@/lib/run/history';
import {formatKm,type RunTarget} from '@/lib/run/geo';
import {getPulseClient,usePulse} from '@/lib/medipulsi/client';
import {useHeartbeat} from '@/lib/medipulsi/useHeartbeat';
import {EMPTY_SIGNAL} from '@/lib/medipulsi/types';
import {RunTargetSheet} from './RunTargetSheet';
import {PulsePanels,type PulsePanel} from './PulsePanels';
import {Action,Card,Copy,IconButton} from './PulseUi';

export default function PulseHub(){
 const router=useRouter(),c=useThemeColors(),insets=useSafeAreaInsets(),bottom=useTabBarInset(),{healthProfile}=useAuth(),pulse=usePulse();
 const [history,setHistory]=useState<RunSummary[]>([]),[targetSheet,setTargetSheet]=useState(false),[panel,setPanel]=useState<PulsePanel|null>(null),[error,setError]=useState('');
 const testPulse=useHeartbeat(EMPTY_SIGNAL,pulse.snapshot?.settings||{},false);
 useFocusEffect(useCallback(()=>{let alive=true;void hydrateActiveRun().then(()=>{if(!alive)return;const phase=getRunState().phase;if(isActiveRunPhase(phase)||phase==='ready'||phase==='preparing')router.replace('/run/active' as never);});void loadRunHistory().then(list=>{if(alive)setHistory(list);});void getPulseClient().refresh().catch(e=>{if(alive)setError(e.message);});return()=>{alive=false;};},[router]));
 const start=(target?:RunTarget)=>{setTargetSheet(false);const body={weightKg:healthProfile?.weightKg,heightCm:healthProfile?.heightCm};void (target?prepareRun(target,body):prepareExploration(body));router.push('/run/active' as never);};
 const kilometers=(pulse.snapshot?.history||[]).reduce((sum,s)=>sum+s.meters,0)/1000;
 const menu:Array<{id:PulsePanel;title:string;subtitle:string;icon:typeof Compass}>=[{id:'missions',title:'თბილისის პასპორტი',subtitle:`${pulse.snapshot?.missions.length||24} ადგილი · შენი ახალი ისტორია`,icon:Compass},{id:'collection',title:'შენი აღმოჩენები',subtitle:'შტამპები, საჩუქრები და გავლილი გზა',icon:Gift},{id:'leaderboard',title:'ერთად უფრო შორს',subtitle:'მკვლევრები მთელი მსოფლიოდან',icon:Trophy}];
 return <View style={{flex:1,backgroundColor:c.bg100}}><ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{paddingTop:insets.top+8,paddingBottom:bottom+20,paddingHorizontal:18,gap:18}}>
  <View style={{flexDirection:'row',alignItems:'center',gap:12}}><IconButton label="უკან" icon={ArrowLeft} onPress={()=>router.back()}/><View style={{flex:1}}><Copy bold size={21}>MEDI RUN</Copy><Copy muted size={10}>MEDIPULSI · შენი მოძრაობის თამაში</Copy></View><IconButton label="პარამეტრები" icon={Settings2} onPress={()=>setPanel('settings')}/></View>
  <Card style={{overflow:'hidden',padding:22,paddingTop:24}}>
   <View style={{flexDirection:'row',alignItems:'center',gap:7}}><Globe2 size={15} color={c.primary100}/><Copy size={11} bold style={{color:c.primary100}}>ნებისმიერი ადგილი. შენი ტემპი.</Copy></View>
   <Copy bold size={30} style={{lineHeight:43}}>შენი გზა.{"\n"}შენი აღმოჩენები.</Copy>
   <View style={{height:108,marginVertical:0}}><Svg width="100%" height="108" viewBox="0 0 330 108"><Path d="M-15 92 H60 Q85 92 85 67 V44 Q85 20 110 20 H175 Q205 20 205 48 V61 Q205 90 232 90 H340" fill="none" stroke={c.bg200} strokeWidth="32"/><Path d="M-15 92 H60 Q85 92 85 67 V44 Q85 20 110 20 H175 Q205 20 205 48 V61 Q205 90 232 90 H340" fill="none" stroke={c.bg300} strokeWidth="1" strokeDasharray="4 7"/><Path d="M-15 92 H60 Q85 92 85 67 V44 Q85 20 110 20 H149" fill="none" stroke="#14B8A6" strokeWidth="8" strokeLinecap="round"/><Circle cx="150" cy="20" r="16" fill={c.accent100}/><Circle cx="150" cy="20" r="8" fill="#14B8A6" stroke="#fff" strokeWidth="3"/><Circle cx="263" cy="90" r="6" fill={c.bg300}/></Svg></View>
   <Copy muted>იარე, გააფერადე რუკა და მოუსმინე პულსს — შემდეგი აღმოჩენა შეიძლება ძალიან ახლოს იყოს.</Copy>
   <Action label="თავისუფალი გასეირნება" icon={Play} onPress={()=>start()}/><Action secondary label="ვარჯიში მიზნით" icon={Target} onPress={()=>setTargetSheet(true)}/>
  </Card>
  <View style={{flexDirection:'row',gap:10}}><Card style={{flex:1}}><Route size={21} color={c.primary100}/><Copy bold size={24}>{kilometers.toFixed(1)} <Copy size={12} muted>კმ</Copy></Copy><Copy muted size={11}>შენახული გასეირნებები</Copy></Card><Card style={{flex:1}}><Compass size={21} color={c.primary100}/><Copy bold size={24}>{Object.values(pulse.book.progress).filter(p=>p.completedAt).length}</Copy><Copy muted size={11}>აღმოჩენილი ადგილი</Copy></Card></View>
  {error&&!pulse.snapshot?<Card><Copy muted>{error}</Copy><Action secondary label="კავშირის განახლება" onPress={()=>{setError('');void getPulseClient().refresh().catch(e=>setError(e.message));}}/></Card>:null}
  {menu.map(item=><Pressable key={item.id} accessibilityRole="button" onPress={()=>setPanel(item.id)}><Card><View style={{flexDirection:'row',alignItems:'center',gap:14}}><View style={{width:46,height:46,borderRadius:16,backgroundColor:c.accent100,alignItems:'center',justifyContent:'center'}}><item.icon color={c.primary100} size={23}/></View><View style={{flex:1,gap:3}}><Copy bold size={15}>{item.title}</Copy><Copy size={11} muted>{item.subtitle}</Copy></View><ChevronRight color={c.text300} size={18}/></View></Card></Pressable>)}
  <Action secondary label="როგორ მუშაობს?" icon={BookOpen} onPress={()=>setPanel('help')}/>
  {history.length?<View style={{gap:12}}><Copy bold size={18}>MEDI RUN-ის ისტორია</Copy>{history.slice(0,5).map(run=><Pressable key={run.id} accessibilityRole="button" onPress={()=>router.push(`/run/${run.id}` as never)}><Card><View style={{flexDirection:'row',alignItems:'center',gap:12}}><Footprints color={c.primary100}/><View style={{flex:1}}><Copy bold>{formatKm(run.distanceM,2)} კმ</Copy><Copy muted size={11}>{new Date(run.startedAt).toLocaleDateString('ka-GE')} · {Math.round(run.movingMs/60000)} წთ</Copy></View><ChevronRight color={c.text300} size={18}/></View></Card></Pressable>)}</View>:null}
 </ScrollView><RunTargetSheet visible={targetSheet} onClose={()=>setTargetSheet(false)} onConfirm={start} weightKg={healthProfile?.weightKg} heightCm={healthProfile?.heightCm}/><PulsePanels panel={panel} onClose={()=>setPanel(null)} onTestPulse={()=>void testPulse()}/></View>;
}
