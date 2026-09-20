import React,{useCallback,useState} from 'react';
import {Pressable,ScrollView,View} from 'react-native';
import {useFocusEffect,useRouter} from 'expo-router';
import {ArrowLeft,ArrowUpRight,BookOpen,ChevronRight,Compass,Footprints,Gift,Globe2,MapPin,Play,Route,Settings2,Target,Trophy,Volume2} from 'lucide-react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useAuth} from '@/store/AuthContext';
import {useThemeColors} from '@/theme/colors';
import {getRunState,hydrateActiveRun,isActiveRunPhase,prepareExploration,prepareRun} from '@/lib/run/store';
import {loadRunHistory,type RunSummary} from '@/lib/run/history';
import {formatRunDate} from '@/lib/run/presentation';
import {formatKm,type RunTarget} from '@/lib/run/geo';
import {getPulseClient,usePulse} from '@/lib/medipulsi/client';
import {useHeartbeat} from '@/lib/medipulsi/useHeartbeat';
import {EMPTY_SIGNAL} from '@/lib/medipulsi/types';
import {RunTargetSheet} from './RunTargetSheet';
import {PulsePanels,type PulsePanel} from './PulsePanels';
import {Action,Card,Copy,IconButton} from './PulseUi';
import {DiscoveryArtwork,MediRunLogo,PulseGlyph} from './PulseIdentity';

export default function PulseHub(){
 const router=useRouter(),c=useThemeColors(),insets=useSafeAreaInsets(),{healthProfile}=useAuth(),pulse=usePulse();
 const [history,setHistory]=useState<RunSummary[]>([]),[targetSheet,setTargetSheet]=useState(false),[panel,setPanel]=useState<PulsePanel|null>(null),[error,setError]=useState('');
 const testPulse=useHeartbeat(EMPTY_SIGNAL,pulse.snapshot?.settings||{},false);
 useFocusEffect(useCallback(()=>{let alive=true;void hydrateActiveRun().then(()=>{if(!alive)return;const phase=getRunState().phase;if(isActiveRunPhase(phase)||phase==='ready'||phase==='preparing')router.replace('/run/active' as never);});void loadRunHistory().then(list=>{if(alive)setHistory(list);});void getPulseClient().refresh().catch(e=>{if(alive)setError(e.message);});return()=>{alive=false;};},[router]));
 const start=(target?:RunTarget)=>{setTargetSheet(false);const body={weightKg:healthProfile?.weightKg,heightCm:healthProfile?.heightCm};void (target?prepareRun(target,body):prepareExploration(body));router.push('/run/active' as never);};
 const saved=pulse.snapshot?.history||[],kilometers=saved.reduce((sum,s)=>sum+s.meters,0)/1000;
 const stamps=Object.values(pulse.book.progress).filter(p=>p.completedAt).length,missions=pulse.snapshot?.missions.length||24;
 const leave=()=>router.canGoBack()?router.back():router.replace('/(tabs)/home' as never);
 return <View style={{flex:1,backgroundColor:c.bg100}}><ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{paddingTop:insets.top+12,paddingBottom:insets.bottom+28,paddingHorizontal:20,gap:22}}>
  <View style={{flexDirection:'row',alignItems:'center',gap:12}}><IconButton label="MEDICARD-ში დაბრუნება" icon={ArrowLeft} onPress={leave}/><View style={{flex:1}}><MediRunLogo/><Copy muted size={10}>შენი ქალაქის პულსი</Copy></View><IconButton label="პარამეტრები" icon={Settings2} onPress={()=>setPanel('settings')}/></View>
  <Card style={{padding:0,overflow:'hidden',borderRadius:30,gap:0}}>
   <View style={{paddingHorizontal:22,paddingTop:22,gap:9}}>
    <View style={{flexDirection:'row',alignItems:'center',gap:7}}><View style={{width:6,height:6,borderRadius:3,backgroundColor:'#14B8A6'}}/><Copy bold size={10} style={{color:c.primary100,letterSpacing:.3}}>შენი ტემპით · ნებისმიერ ქალაქში</Copy></View>
    <Copy bold size={29} style={{lineHeight:41}}>გარეთ ახალი{'\n'}ამბავი იწყება.</Copy>
    <Copy muted size={12}>გადადგი პირველი ნაბიჯი.{'\n'}დანარჩენს გზად აღმოაჩენ.</Copy>
   </View>
   <View style={{marginTop:12,marginBottom:2}}><DiscoveryArtwork/></View>
   <View style={{padding:18,paddingTop:8,gap:10}}>
    <Pressable accessibilityRole="button" accessibilityLabel="დავიწყოთ აღმოჩენა — თავისუფალი გასეირნება" onPress={()=>start()} style={{minHeight:58,borderRadius:20,backgroundColor:'#0D9488',paddingHorizontal:17,flexDirection:'row',alignItems:'center',gap:12}}>
     <View style={{width:31,height:31,borderRadius:11,backgroundColor:'#0F766E',alignItems:'center',justifyContent:'center'}}><Play fill="#fff" color="#fff" size={15}/></View><Copy bold size={15} style={{flex:1,color:'#fff'}}>დავიწყოთ აღმოჩენა</Copy><ArrowUpRight color="#CCFBF1" size={23}/>
    </Pressable>
    <Pressable accessibilityRole="button" onPress={()=>setTargetSheet(true)} style={{minHeight:44,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8}}><Target size={16} color={c.primary100}/><Copy bold size={12}>ან ივარჯიშე მიზნით</Copy><ChevronRight size={14} color={c.text300}/></Pressable>
   </View>
  </Card>
  <View style={{gap:12}}>
   <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center'}}><Copy bold size={16}>შენი გზა აქ რჩება</Copy><Route color={c.primary100} size={18}/></View>
   <Pressable accessibilityRole="button" accessibilityLabel="შენი პროგრესისა და გასეირნებების ნახვა" onPress={()=>setPanel('collection')}><Card style={{padding:16,borderRadius:22,flexDirection:'row',gap:0}}>
    {[{value:kilometers.toFixed(1),label:'კილომეტრი',icon:Route},{value:String(saved.length),label:'გასეირნება',icon:Footprints},{value:String(stamps),label:'შტამპი',icon:Compass}].map((stat,i)=><View key={stat.label} style={{flex:1,alignItems:'center',gap:3,borderLeftWidth:i?1:0,borderColor:c.bg300}}><stat.icon size={15} color={c.primary100}/><Copy bold size={23} style={{lineHeight:33}}>{stat.value}</Copy><Copy muted size={10}>{stat.label}</Copy></View>)}
   </Card></Pressable>
  </View>
  {error&&!pulse.snapshot?<Card><Copy muted>{error}</Copy><Action secondary label="კავშირის განახლება" onPress={()=>{setError('');void getPulseClient().refresh().catch(e=>setError(e.message));}}/></Card>:null}
  <View style={{gap:12}}><View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}><Copy bold size={16}>გზად მეტი გელოდება</Copy><Copy size={10} muted>აღმოაჩინე</Copy></View>
   <Pressable accessibilityRole="button" accessibilityLabel={`თბილისის პასპორტი — ${missions} მისია`} onPress={()=>setPanel('missions')}><Card style={{borderRadius:25,padding:20,gap:15}}>
    <View style={{flexDirection:'row',alignItems:'center',gap:8}}><View style={{width:36,height:36,borderRadius:12,backgroundColor:c.accent100,alignItems:'center',justifyContent:'center'}}><Globe2 size={21} color={c.primary100}/></View><Copy bold size={10} style={{color:c.primary100,flex:1}}>თბილისის პასპორტი</Copy><ArrowUpRight size={20} color={c.text100}/></View>
    <View style={{flexDirection:'row',gap:14,alignItems:'center'}}><View style={{flex:1,gap:5}}><Copy bold size={21} style={{lineHeight:31}}>ქალაქი სავსეა{'\n'}ისტორიებით.</Copy><Copy size={11} muted>პარკები, ტბები და ნაცნობი ადგილები{'\n'}ახალი თვალით.</Copy></View><View style={{width:70,height:81,borderWidth:1.5,borderStyle:'dashed',borderColor:c.accent200,borderRadius:20,alignItems:'center',justifyContent:'center',gap:2,transform:[{rotate:'8deg'}]}}><MapPin color={c.primary100} size={23}/><Copy bold size={18} style={{color:c.primary100}}>{missions}</Copy></View></View>
    <View style={{height:4,backgroundColor:c.bg200,borderRadius:3,overflow:'hidden'}}><View style={{height:4,width:`${Math.min(100,stamps/missions*100)}%`,backgroundColor:'#14B8A6'}}/></View><View style={{flexDirection:'row',justifyContent:'space-between'}}><Copy size={10} muted>{stamps} / {missions} აღმოჩენა</Copy><Copy size={10} bold style={{color:c.primary100}}>აირჩიე მისია →</Copy></View>
   </Card></Pressable>
   <View style={{flexDirection:'row',gap:12}}>{[{id:'collection' as const,label:'კოლექცია',detail:'შენი გზის ისტორია',icon:Gift},{id:'leaderboard' as const,label:'ლიდერბორდი',detail:'ერთად უფრო შორს',icon:Trophy}].map(item=><Pressable key={item.id} accessibilityRole="button" onPress={()=>setPanel(item.id)} style={{flex:1}}><Card style={{minHeight:140,padding:17,borderRadius:23,gap:7}}><View style={{flexDirection:'row',justifyContent:'space-between',marginBottom:7}}><item.icon size={24} color={c.primary100}/><ArrowUpRight size={16} color={c.text300}/></View><Copy bold size={14}>{item.label}</Copy><Copy muted size={10}>{item.detail}</Copy></Card></Pressable>)}</View>
  </View>
  <Pressable accessibilityRole="button" accessibilityLabel="აღმოჩენის პულსის მოსმენა" onPress={()=>void testPulse()}><Card style={{borderRadius:24,padding:18,flexDirection:'row',alignItems:'center',gap:13}}><PulseGlyph size={44}/><View style={{flex:1,gap:3}}><Copy bold size={13}>ჯერ იგრძნობ. მერე დაინახავ.</Copy><Copy muted size={10}>მოუსმინე აღმოჩენის პულსს</Copy></View><Volume2 size={19} color={c.primary100}/></Card></Pressable>
  {history.length?<View style={{gap:10}}><Copy bold size={16}>ბოლო ვარჯიშები</Copy>{history.slice(0,3).map(run=><Pressable key={run.id} accessibilityRole="button" onPress={()=>router.push(`/run/${run.id}` as never)}><Card style={{padding:16,borderRadius:20,flexDirection:'row',alignItems:'center',gap:12}}><Footprints color={c.primary100} size={19}/><View style={{flex:1}}><Copy bold size={14}>{formatKm(run.distanceM,2)} კმ</Copy><Copy muted size={10}>{formatRunDate(run.startedAt)} · {Math.round(run.movingMs/60000)} წთ</Copy></View><ChevronRight color={c.text300} size={17}/></Card></Pressable>)}</View>:null}
  <Pressable accessibilityRole="button" onPress={()=>setPanel('help')} style={{minHeight:48,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:9}}><BookOpen size={17} color={c.text200}/><Copy muted size={12}>როგორ მუშაობს MEDIRUN?</Copy><ChevronRight size={15} color={c.text300}/></Pressable>
 </ScrollView><RunTargetSheet visible={targetSheet} onClose={()=>setTargetSheet(false)} onConfirm={start} weightKg={healthProfile?.weightKg} heightCm={healthProfile?.heightCm}/><PulsePanels panel={panel} onClose={()=>setPanel(null)} onTestPulse={()=>void testPulse()}/></View>;
}
