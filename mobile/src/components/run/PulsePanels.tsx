import React,{useEffect,useState} from 'react';
import {ActivityIndicator,Keyboard,Pressable,ScrollView,Switch,View} from 'react-native';
import {Check,ChevronDown,ChevronUp,Compass,Crown,Globe2,Landmark,MapPin,Mountain,RefreshCw,Trees,Trophy,Volume2,Waves} from 'lucide-react-native';
import {getPulseClient,pulseApi,usePulse} from '@/lib/medipulsi/client';
import {CHAPTERS,missionPercent,missionProgress,type Mission} from '@/lib/medipulsi/core/missions';
import {distance} from '@/lib/medipulsi/core/engine';
import type {PulseSettings} from '@/lib/medipulsi/types';
import {useThemeColors} from '@/theme/colors';
import {useTheme} from '@/store/ThemeContext';
import {Action,Bar,Card,Copy,RUN_CTA,Segmented,Sheet,Tile,useRunInk} from './PulseUi';
import {PulseCollection} from './PulseCollection';
import {PulseNicknameField} from './PulseNicknameField';
export type PulsePanel='missions'|'collection'|'leaderboard'|'settings'|'help';
const titles:Record<PulsePanel,string>={missions:'თბილისის პასპორტი',collection:'შენი აღმოჩენები',leaderboard:'ერთად უფრო შორს',settings:'შენი რიტმი',help:'როგორ მუშაობს?'};
const icons={trees:Trees,landmark:Landmark,waves:Waves,mountain:Mountain,bridge:Compass,flower:Trees};
export const HELP=[
 ['01 · დაიწყე იქ, სადაც ხარ','MEDI RUN და MEDIPULSI ერთი გამოცდილებაა. თავისუფალი გასეირნება მუშაობს ნებისმიერ ქვეყანაში: აირჩიე შენი მიმართულება. მიზნით ვარჯიშში მიუთითე მანძილი ან ნაბიჯები. თბილისის პასპორტის მისიები ჯერ მხოლოდ თბილისშია.'],
 ['02 · ერთი სესია, ერთი ჩანაწერი','დაწყების შემდეგ ითვლება GPS-ით მიღებული მანძილი, სიჩქარე, დრო და სავარაუდო ნაბიჯები. ნაბიჯები გამოითვლება მანძილიდან (0.72 მ თითო ნაბიჯზე); ეს ტელეფონის პედომეტრის ზუსტი ჩანაწერი არ არის. კალორიაც შეფასებაა.'],
 ['03 · შენი გზა რჩება','მიღებული GPS მონაკვეთები რუკაზე ფერადად რჩება და MEDICARD ანგარიშში ინახება. პაუზა, ცუდი სიგნალი და დიდი ნახტომი არ იკვრება გამოგონილი ხაზით. სხვადასხვა მოწყობილობიდან გამოიყენე იგივე ანგარიში, ჩაწერისთვის კი ერთდროულად ერთი მოწყობილობა.'],
 ['04 · პროგრესის ორი სახე','მსოფლიოში ინახება გავლილი გზა და მანძილი. ვაკის პარკში დამატებით ითვლება უნიკალურად გავლილი, საჯაროდ ხელმისაწვდომი ბილიკების პროცენტი. 85%-ზე პარკი გახსნილია. ერთი გზის გამეორება ამ პროცენტს აღარ ზრდის. ქალაქის მთელი ფართობის პროცენტი არ გამოითვლება იქ, სადაც დამოწმებული საფეხმავლო ქსელი არ გვაქვს.'],
 ['05 · თბილისის პასპორტი','აირჩიე მისია. პროგრესი გროვდება მხოლოდ მისი ზონის შიგნით მიღებულ მოძრაობაზე, მითითებული მანძილისა და აქტიური დროის შესრულებით. შეგიძლია რამდენიმე გასეირნებად დაასრულო. წყალში, შენობაში ან ზონის ზუსტ ცენტრში მისვლა საჭირო არ არის.'],
 ['06 · მოუსმინე აღმოჩენას','საჩუქარი წინასწარ არ ჩანს. ადმინისტრატორის განთავსებულ საჩუქართან მიახლოებისას იწყება ორმაგი გულისცემის ხმა და ჰაპტიკა. რიტმი ახლოს მისვლისას ჩქარდება. ხმა და ვიბრაცია შეგიძლია ცალ-ცალკე მართო. ეს თამაშის სიგნალია და არა გაზომილი გულისცემა.'],
 ['07 · ყუთი კამერაში','ყუთი გამოჩნდება მხოლოდ აღმოჩენის დიაპაზონში, საკმარისად ზუსტი და ახალი GPS სიგნალით. ღილაკით ჩართე კამერა, შემდეგ შეეხე ვირტუალურ ყუთს. ფოტო და ვიდეო არ ინახება. პრიზის ხელმისაწვდომობას სერვერი ხელახლა ამოწმებს; ფიზიკური პრიზი დადასტურებას და გადაცემას ელოდება.'],
 ['08 · პაუზა და დასრულება','პაუზის დროს დრო, მანძილი და პულსი ჩერდება. ამ ვერსიაში ეკრანის ჩაკეტვა ან აპიდან გასვლაც აჩერებს სესიას; დაბრუნებისას დააჭირე გაგრძელებას. დასრულება ინახავს ისტორიას და დაგროვილ რუკას. GPS თამაშს ეკრანზე აქტიური აპი სჭირდება.'],
 ['09 · კავშირი და სიზუსტე','სესიის დასაწყებად ინტერნეტია საჭირო. დაწყებულ სესიაში კავშირის დროებითი დაკარგვისას ჩანაწერი ტელეფონში რიგდება და კავშირის აღდგენისას იგზავნება; სერვერი ბოლო 24 საათის ნიმუშებს იღებს. საჩუქრები კავშირის გარეშე არ იხსნება. 25 მ-ზე უარესი სიზუსტე, მოძველებული GPS, არარეალური ნახტომი და ავტომობილით მოძრაობა პროგრესს არ მატებს.'],
 ['10 · ლიდერბორდი','მონაწილეობა ნებაყოფლობითია. სიაში ჩანს არჩეული სახელი და დასრულებულ სესიებში დადასტურებული მანძილი, ბოლო 7 ან 90 დღეზე. ზუსტი მდებარეობა, მარშრუტი და ჯანმრთელობის მონაცემები საჯაროდ არ ჩანს. უფრო სწრაფად სირბილი დამატებითი ქულა არ არის.'],
 ['11 · კილომეტრები და რეკორდები','ყოველ სრულ კილომეტრზე ეკრანზე ჩანს ამ კილომეტრის ტემპი; ვიბრაცია ჩართულია, თუ ორმაგი ვიბრაცია ჩართული გაქვს. შეჯამებაში ნახავ თითოეული კილომეტრის ტემპს. რეკორდები (ყველაზე გრძელი, საუკეთესო ტემპი 1 კმ-დან, ყველაზე ხანგრძლივი) ამ ტელეფონში შენახული გასეირნებებიდან ითვლება.'],
];

type Row={handle:string;meters:number;newMeters:number};
type View_=ReturnType<typeof usePulse>;
const MEDALS=['#F59E0B','#94A3B8','#B45309'];

function MissionCard({m,view,busy,onSelect}:{m:Mission;view:View_;busy:boolean;onSelect:(id:string)=>void}){
 const c=useThemeColors(),ink=useRunInk(),[open,setOpen]=useState(false);
 const Icon=icons[m.icon]||MapPin,p=missionProgress(view.book,m),percent=missionPercent(view.book,m),selected=view.book.selected===m.id,done=Boolean(p.completedAt);
 const km=view.journey.accuracy<=25?distance(view.journey.position,m.center)/1000:null;
 return <Card style={selected?{borderWidth:1.5,borderColor:'#14B8A6'}:undefined}>
  <Pressable accessibilityRole="button" accessibilityState={{expanded:open}} accessibilityLabel={`${m.name}, ${percent} პროცენტი`} onPress={()=>setOpen(v=>!v)} style={{flexDirection:'row',alignItems:'center',gap:12}}>
   <Tile icon={done?Check:Icon} ink={done?'green':'teal'}/>
   <View style={{flex:1,minWidth:0}}><Copy bold size={15} numberOfLines={1}>{m.name}</Copy><Copy muted size={11}>{m.meters} მ · მინ. {Math.ceil(m.seconds/60)} წთ{km!=null?` · ${km<1?Math.round(km*1000)+' მ':km.toFixed(1)+' კმ'} შენგან`:''}</Copy></View>
   {selected?<View style={{paddingHorizontal:8,paddingVertical:3,borderRadius:8,backgroundColor:c.accent100}}><Copy bold size={10} style={{color:c.primary100}}>აქტიური</Copy></View>:done?<Copy bold size={11} style={{color:c.success}}>შენია</Copy>:<Copy bold size={12} style={{color:percent?ink:c.text300}}>{percent}%</Copy>}
   {open?<ChevronUp size={18} color={c.text300}/>:<ChevronDown size={18} color={c.text300}/>}
  </Pressable>
  {!done&&percent>0?<Bar value={percent} height={5} label={`${m.name} პროგრესი`}/>:null}
  {open?<>
   <Copy bold size={13}>{m.title}</Copy>
   <Copy muted size={13}>{m.story}</Copy>
   <Copy size={12} muted>{Math.floor(p.meters)} / {m.meters} მ · {Math.floor(p.seconds)} / {m.seconds} წმ</Copy>
   <Copy size={12} muted>{m.tip}</Copy>
   {done?null:<Action secondary={!selected} disabled={selected} busy={busy} label={selected?'აქტიური მისია':'ავირჩიოთ ეს ადგილი'} onPress={()=>onSelect(m.id)}/>}
  </>:null}
 </Card>;
}

export function PulsePanels({panel,onClose,onTestPulse}:{panel:PulsePanel|null;onClose:()=>void;onTestPulse?:()=>void}){
 const view=usePulse(),client=getPulseClient(),c=useThemeColors(),theme=useTheme();
 const [error,setError]=useState(''),[busy,setBusy]=useState(false),[period,setPeriod]=useState<'week'|'season'>('week'),[rows,setRows]=useState<Row[]>([]),[loadingRows,setLoadingRows]=useState(false),[handle,setHandle]=useState(''),[chapter,setChapter]=useState<'all'|Mission['chapter']>('all');
 const settings=view.snapshot?.settings||{};
 const execute=async(action:()=>Promise<unknown>)=>{if(busy)return;setError('');setBusy(true);try{await action();}catch(e){setError((e as Error).message);}finally{setBusy(false);}};
 useEffect(()=>{if(!panel)return;setError('');void client.refresh().catch(e=>setError(e.message));setHandle(view.snapshot?.handle||'');},[panel]);
 useEffect(()=>{if(panel!=='leaderboard')return;let alive=true;setLoadingRows(true);void pulseApi<{rows:Row[]}>('/leaderboard?period='+period).then(data=>{if(alive)setRows(data.rows);}).catch(e=>{if(alive)setError(e.message);}).finally(()=>{if(alive)setLoadingRows(false);});return()=>{alive=false;};},[panel,period]);
 const update=(patch:PulseSettings)=>void execute(()=>client.settings(patch));
 const saveNickname=()=>{if(!view.snapshot)return;const nickname=handle.trim()||view.snapshot.handle;void execute(async()=>{await client.settings({handle:nickname,leaderboardOptIn:true});setHandle(nickname);Keyboard.dismiss();});};
 const missions=view.snapshot?.missions||[],total=missions.length||24;
 // Active first, then started, then untouched (nearest first when GPS is precise), finished last.
 const rank=(m:Mission)=>{const p=missionProgress(view.book,m);if(view.book.selected===m.id)return 0;if(p.completedAt)return 3;return p.meters>0?1:2;};
 const listed=missions.filter(m=>chapter==='all'||m.chapter===chapter).map(m=>({m,r:rank(m),d:view.journey.accuracy<=25?distance(view.journey.position,m.center):0})).sort((a,b)=>a.r-b.r||a.d-b.d).map(x=>x.m);
 const done=missions.filter(m=>missionProgress(view.book,m).completedAt).length;
 const me=view.snapshot?.leaderboardOptIn?view.snapshot.handle:null;
 const myIndex=me?rows.findIndex(r=>r.handle===me):-1;
 return <Sheet visible={Boolean(panel)} title={panel?titles[panel]:''} onClose={onClose} keyboardAware={panel==='leaderboard'} footer={panel==='leaderboard'?<Action busy={busy} disabled={!view.snapshot} label={view.snapshot?.leaderboardOptIn?'სახელის შენახვა':'ლიდერბორდში ჩართვა'} onPress={saveNickname}/>:undefined}>
  {error&&panel!=='leaderboard'?<Card><Copy style={{color:c.danger}}>{error}</Copy><Action label="ხელახლა ცდა" secondary icon={RefreshCw} onPress={()=>void execute(()=>client.refresh())}/></Card>:null}
  {panel==='collection'&&view.snapshot&&view.pending>0&&!view.running?<Card><Copy bold>ჩანაწერების ნაწილი გაგზავნას ელოდება</Copy><Copy muted>{view.message}</Copy><Action label="ჩანაწერების ხელახლა გაგზავნა" secondary busy={busy} icon={RefreshCw} onPress={()=>void execute(()=>client.refresh())}/></Card>:null}
  {panel==='missions'?<>
   <Card style={{gap:14}}>
    <View style={{flexDirection:'row',alignItems:'center',gap:12}}><Tile icon={Globe2}/><View style={{flex:1}}><Copy bold size={15}>შენი გზა — ყველგან. პასპორტი — თბილისში.</Copy><Copy muted size={12}>{done} / {total} შტამპი შეგროვებულია</Copy></View></View>
    <Bar value={done/total*100} label="შეგროვებული შტამპები"/>
    <Copy muted size={12}>აირჩიე ადგილი, იარე მის ზონაში და შეაგროვე პერსონალური შტამპები. მისიის შესრულება რამდენიმე გასეირნებადაც შეგიძლია.</Copy>
    {view.book.selected?<Action secondary label="თავისუფალ აღმოჩენაზე დაბრუნება" onPress={()=>void execute(()=>client.selectMission(null))} busy={busy}/>:null}
   </Card>
   <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:8}}>{[{id:'all' as const,name:'ყველა'},...CHAPTERS].map(ch=>{const on=chapter===ch.id;return <Pressable key={ch.id} accessibilityRole="button" accessibilityState={{selected:on}} onPress={()=>setChapter(ch.id)} style={{minHeight:38,paddingHorizontal:14,borderRadius:19,justifyContent:'center',backgroundColor:on?RUN_CTA:c.surface}}><Copy bold size={12} style={{color:on?'#fff':c.text100}}>{ch.name}</Copy></Pressable>;})}</ScrollView>
   {listed.map(m=><MissionCard key={m.id} m={m} view={view} busy={busy} onSelect={id=>void execute(()=>client.selectMission(id))}/>)}
  </>:null}
  {panel==='collection'?<PulseCollection view={view}/>:null}
  {panel==='leaderboard'?<>
   <PulseNicknameField value={handle} onChange={setHandle} placeholder={view.snapshot?.handle} disabled={busy||!view.snapshot}/>
   {error?<Card><Copy style={{color:c.danger}}>{error}</Copy><Action label="ხელახლა ცდა" secondary icon={RefreshCw} onPress={()=>void execute(()=>client.refresh())}/></Card>:null}
   <Segmented value={period} onChange={setPeriod} options={[{value:'week',label:'7 დღე'},{value:'season',label:'90 დღე'}]}/>
   {myIndex>=0?<Card style={{flexDirection:'row',alignItems:'center',gap:12,backgroundColor:c.accent100}}><Crown size={20} color={c.primary100}/><Copy bold style={{flex:1}}>შენ ხარ #{myIndex+1}</Copy><Copy bold style={{fontVariant:['tabular-nums']}}>{(rows[myIndex].meters/1000).toFixed(2)} კმ</Copy></Card>:null}
   {loadingRows&&!rows.length?<Card><ActivityIndicator color={c.primary100}/></Card>:!rows.length?<Card><Trophy color={c.primary100} size={24}/><Copy muted>ამ პერიოდში დასრულებული გასეირნებები ჯერ არ გამოჩენილა. იყავი პირველი.</Copy></Card>:<Card style={{paddingVertical:6,gap:0}}>{rows.map((row,index)=>{const mine=index===myIndex;return <View key={index} style={{flexDirection:'row',alignItems:'center',gap:12,paddingVertical:12,borderTopWidth:index?1:0,borderColor:c.bg200}}>
    <View style={{width:30,height:30,borderRadius:15,alignItems:'center',justifyContent:'center',backgroundColor:index<3?MEDALS[index]+'26':'transparent'}}><Copy bold size={13} style={{color:index<3?MEDALS[index]:c.text200}}>{index+1}</Copy></View>
    <Copy bold numberOfLines={1} style={{flex:1,color:mine?c.primary100:c.text100}}>{row.handle}{mine?' · შენ':''}</Copy>
    <Copy bold style={{fontVariant:['tabular-nums']}}>{(row.meters/1000).toFixed(2)} კმ</Copy>
   </View>;})}</Card>}
   <Copy muted size={12}>დასრულებული სესიების დადასტურებული მანძილი, ნებისმიერი ქალაქიდან. სიაში მონაწილეობას შენ ირჩევ; მარშრუტი და მდებარეობა არ ჩანს.</Copy>
   {view.snapshot?.leaderboardOptIn?<Action secondary label="მონაწილეობის გამორთვა" busy={busy} onPress={()=>{if(view.snapshot)void execute(()=>client.settings({handle:handle.trim()||view.snapshot!.handle,leaderboardOptIn:false}));}}/>:null}
  </>:null}
  {panel==='settings'?<>
   <Card><Copy bold>აპის თემა</Copy><Segmented value={theme.preference} onChange={value=>theme.setPreference(value)} options={[{value:'system',label:'სისტემა'},{value:'light',label:'ღია'},{value:'dark',label:'მუქი'}] as const}/></Card>
   <Card><Copy bold>რუკის განათება</Copy><Segmented disabled={busy} value={settings.mapMode||'auto'} onChange={value=>update({mapMode:value})} options={[{value:'auto',label:'მზე / ავტო'},{value:'day',label:'დღე'},{value:'night',label:'ღამე'}] as const}/><Copy muted size={12}>ავტომატური რეჟიმი მზის მდებარეობას ითვალისწინებს შენს მიმდინარე კოორდინატებზე.</Copy></Card>
   <Card>{[{key:'sound' as const,label:'გულისცემის ხმა'},{key:'haptic' as const,label:'ვიბრაცია (პულსი და კილომეტრები)'},{key:'followBearing' as const,label:'რუკა ტელეფონის მიმართულებით'},{key:'threeD' as const,label:'რუკის 3D ხედვა'}].map(row=><View key={row.key} style={{flexDirection:'row',alignItems:'center',gap:12,minHeight:44}}><Copy style={{flex:1}}>{row.label}</Copy><Switch accessibilityLabel={row.label} disabled={busy} value={settings[row.key]!==false} onValueChange={value=>update({[row.key]:value})} trackColor={{true:RUN_CTA,false:c.bg300}}/></View>)}<Copy muted size={12}>ვიბრაცია და ხმა მოწყობილობის მხარდაჭერასა და სისტემურ პარამეტრებზეც არის დამოკიდებული.</Copy>{onTestPulse?<Action secondary label="პულსის გამოცდა" icon={Volume2} onPress={onTestPulse}/>:null}</Card>
  </>:null}
  {panel==='help'?HELP.map(([title,body])=><Card key={title}><Copy bold size={16}>{title}</Copy><Copy muted>{body}</Copy></Card>):null}
 </Sheet>;
}
