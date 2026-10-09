import React,{useMemo,useState} from 'react';
import {Pressable,View} from 'react-native';
import {useRouter} from 'expo-router';
import {BookOpen,ChevronRight,Clapperboard,Flame,Settings2,TrendingUp,Trophy} from 'lucide-react-native';
import {useIsDark,useThemeColors} from '@/theme/colors';
import {HUB,hubTint} from '@/theme/hub';
import {tx} from '@/i18n/locale';
import {formatClock,formatKm,formatPace} from '@/lib/run/geo';
import {personalRecords,recordsSetBy,type DayBucket} from '@/lib/run/insights';
import type {RunSummary} from '@/lib/run/history';
import {ArtTile,Card,Copy,Section,Tile,runInk} from './PulseUi';
import {RouteThumb} from './RunVisuals';
import {RUN_ICON} from './runArt';

/*
 * MEDIRUN hub, owner 2026-10-09 („პროგრესი არ მომწონს … გასეირნებები დაწყებაზე, უფრო გასაგები“):
 *  - Start keeps what you do now; „შენი გასეირნებები“ moved there as clear rows (when, how far, how long, pace).
 *  - Progress opens with one spotlight — this week against the week before — then records, cities, and the
 *    rules / settings as two quiet rows.
 */

const MINT='#5EEAD4',SOFT='rgba(255,255,255,0.62)',FAINT='rgba(255,255,255,0.1)';
const dayStart=(t:number)=>{const d=new Date(t);return new Date(d.getFullYear(),d.getMonth(),d.getDate()).getTime();};
/** „დღეს · 18:40“, „გუშინ · 08:12“, „ორშ, 6 ოქტ · 19:05“. */
export function walkWhen(iso:string,now=Date.now()){
 const t=Date.parse(iso);if(!Number.isFinite(t))return '';
 const d=new Date(t),clock=`${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
 const days=Math.round((dayStart(now)-dayStart(t))/86400_000);
 if(days===0)return tx(`დღეს · ${clock}`,`Today · ${clock}`);
 if(days===1)return tx(`გუშინ · ${clock}`,`Yesterday · ${clock}`);
 const wk=tx(['კვ','ორშ','სამ','ოთხ','ხუთ','პარ','შაბ'][d.getDay()],['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()]);
 const mo=tx(['იან','თებ','მარ','აპრ','მაი','ივნ','ივლ','აგვ','სექ','ოქტ','ნოე','დეკ'][d.getMonth()],['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()]);
 const year=d.getFullYear()!==new Date(now).getFullYear()?` ${d.getFullYear()}`:'';
 return tx(`${wk}, ${d.getDate()} ${mo}${year} · ${clock}`,`${wk}, ${mo} ${d.getDate()}${year} · ${clock}`);
}

/** Start tab: the latest walks, newest first, three at a time; a record walk carries its badge. */
export function RecentWalks({history}:{history:RunSummary[]}){
 const router=useRouter(),c=useThemeColors(),dark=useIsDark(),teal=runInk('teal',dark),amber=runInk('amber',dark),[all,setAll]=useState(false);
 const badges=useMemo(()=>new Map(history.map(run=>[run.id,recordsSetBy(run,history)])),[history]);
 if(!history.length)return null;
 const shown=all?history:history.slice(0,3);
 return <Section title={tx('შენი გასეირნებები','Your walks')} link={history.length>3?(all?tx('ნაკლები','Less'):tx(`ყველა · ${history.length}`,`All · ${history.length}`)):undefined} onLink={()=>setAll(v=>!v)}>
  <Card style={{paddingVertical:4,paddingHorizontal:14,gap:0}}>
   {shown.map((run,i)=>{
    const record=(badges.get(run.id)||[]).length>0,min=Math.max(1,Math.round(run.movingMs/60000));
    return <Pressable key={run.id} accessibilityRole="button" accessibilityLabel={tx(`${walkWhen(run.startedAt)}: ${formatKm(run.distanceM,2)} კილომეტრი, ${min} წუთი`,`${walkWhen(run.startedAt)}: ${formatKm(run.distanceM,2)} kilometers, ${min} minutes`)} onPress={()=>router.push(`/run/${run.id}` as never)} style={{flexDirection:'row',alignItems:'center',gap:14,paddingVertical:12,borderTopWidth:i?1:0,borderColor:c.bg200}}>
     <RouteThumb segments={run.segments?.length?run.segments:[run.path]} size={58}/>
     <View style={{flex:1,minWidth:0,gap:3}}>
      <View style={{flexDirection:'row',alignItems:'center',gap:6}}>
       <Copy muted size={11} numberOfLines={1} style={{flexShrink:1}}>{walkWhen(run.startedAt)}</Copy>
       {record?<View style={{flexDirection:'row',alignItems:'center',gap:3,paddingHorizontal:6,paddingVertical:1,borderRadius:8,backgroundColor:hubTint(amber,dark)}}><Trophy size={10} color={amber}/><Copy bold size={9} style={{color:amber}}>{tx('რეკორდი','Record')}</Copy></View>:null}
      </View>
      <View style={{flexDirection:'row',alignItems:'baseline',gap:4}}><Copy bold size={20} style={{fontVariant:['tabular-nums'],lineHeight:25}}>{formatKm(run.distanceM,2)}</Copy><Copy bold size={12} style={{color:teal}}>{tx('კმ','km')}</Copy></View>
      <Copy muted size={11} numberOfLines={1} style={{fontVariant:['tabular-nums']}}>{tx(`${min} წთ`,`${min} min`)}{run.paceSecPerKm?` · ${formatPace(run.paceSecPerKm)} ${tx('/კმ','/km')}`:''}{run.steps?tx(` · ${run.steps.toLocaleString('en-US').replace(/,/g,' ')} ნაბიჯი`,` · ${run.steps.toLocaleString('en-US')} steps`):''}</Copy>
     </View>
     {run.distanceM>=200?<Pressable accessibilityRole="button" accessibilityLabel={tx('ვიდეოდ გაზიარება','Share as a video')} hitSlop={6} onPress={()=>router.push(`/run/${run.id}?video=1` as never)} style={{width:40,height:40,borderRadius:13,backgroundColor:hubTint(teal,dark),alignItems:'center',justifyContent:'center'}}><Clapperboard size={18} color={teal}/></Pressable>
     :<ChevronRight color={c.text300} size={18}/>}
    </Pressable>;
   })}
  </Card>
 </Section>;
}

type WeekWalk={startedAt:string;meters:number;seconds:number;newMeters:number};
/**
 * Progress spotlight: this week's kilometres big, against the seven days before, the days as bars on the dark
 * card, then walks / new streets / active minutes and the all-time line.
 */
export function WeekSpotlight({week,walks,streak,lifetimeKm,lifetimeWalks}:{week:DayBucket[];walks:WeekWalk[];streak:number;lifetimeKm:number;lifetimeWalks:number}){
 const startThis=useMemo(()=>{const d=new Date();return new Date(d.getFullYear(),d.getMonth(),d.getDate()-6).getTime();},[]);
 const startPrev=startThis-7*86400_000;
 const inThis=walks.filter(w=>Date.parse(w.startedAt)>=startThis&&w.meters>0);
 const prevKm=walks.filter(w=>{const t=Date.parse(w.startedAt);return t>=startPrev&&t<startThis;}).reduce((s,w)=>s+w.meters,0)/1000;
 const km=week.reduce((s,d)=>s+d.meters,0)/1000,delta=km-prevKm;
 const newKm=inThis.reduce((s,w)=>s+w.newMeters,0)/1000,minutes=Math.round(inThis.reduce((s,w)=>s+w.seconds,0)/60);
 const max=Math.max(1000,...week.map(d=>d.meters));
 const up=delta>=0.05,down=delta<=-0.05;
 const trend=!km&&!prevKm?tx('ამ კვირაში ჯერ არ გაგისეირნია — დღეს დაიწყე.','No walks this week yet — start today.')
  :!prevKm?tx('პირველი აქტიური კვირა — კარგი დასაწყისია.','Your first active week — a good start.')
  :up?tx(`${delta.toFixed(1)} კმ-ით მეტი, ვიდრე წინა 7 დღეში`,`${delta.toFixed(1)} km more than the 7 days before`)
  :down?tx(`წინა 7 დღეში — ${prevKm.toFixed(1)} კმ. ყოველი გასეირნება ითვლება.`,`The 7 days before: ${prevKm.toFixed(1)} km. Every walk counts.`)
  :tx('იგივე, რაც წინა 7 დღეში','Same as the 7 days before');
 const TrendIcon=TrendingUp;
 return <View accessible accessibilityLabel={tx(`ბოლო 7 დღე: ${km.toFixed(1)} კილომეტრი. ${trend}`,`Last 7 days: ${km.toFixed(1)} kilometers. ${trend}`)} style={{backgroundColor:HUB.spotlightBg,borderRadius:HUB.cardRadius,padding:HUB.cardPad,gap:16,overflow:'hidden'}}>
  <View pointerEvents="none" style={{position:'absolute',right:-60,top:-70,width:200,height:200,borderRadius:100,backgroundColor:'rgba(94,234,212,0.08)'}}/>
  <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}>
   <Copy bold size={12} style={{color:MINT,letterSpacing:.3}}>{tx('ბოლო 7 დღე','Last 7 days')}</Copy>
   {streak>0?<View style={{flexDirection:'row',alignItems:'center',gap:5,paddingHorizontal:9,paddingVertical:4,borderRadius:12,backgroundColor:'rgba(252,211,77,0.14)'}}><Flame size={12} color="#FCD34D" fill="#FCD34D"/><Copy bold size={11} style={{color:'#FDE68A'}}>{tx(`${streak} დღე ზედიზედ`,`${streak}-day streak`)}</Copy></View>:null}
  </View>
  <View style={{gap:4}}>
   <View style={{flexDirection:'row',alignItems:'baseline',gap:6}}><Copy bold size={46} style={{color:'#fff',lineHeight:52,letterSpacing:-1.5,fontVariant:['tabular-nums']}}>{km.toFixed(1)}</Copy><Copy bold size={16} style={{color:MINT}}>{tx('კმ','km')}</Copy></View>
   <View style={{flexDirection:'row',alignItems:'center',gap:6}}>{up?<TrendIcon size={14} color={MINT}/>:null}<Copy size={12} style={{color:SOFT,flex:1}}>{trend}</Copy></View>
  </View>
  <View style={{flexDirection:'row',alignItems:'flex-end',gap:6}}>
   {week.map(day=>{const h=day.meters>0?Math.max(8,(day.meters/max)*84):5;return <View key={day.key} style={{flex:1,alignItems:'center',gap:7}}>
    <View style={{height:84,justifyContent:'flex-end',width:'100%',alignItems:'center'}}>
     <View style={{width:'100%',maxWidth:28,height:h,borderRadius:9,backgroundColor:day.meters>0?(day.isToday?MINT:'rgba(94,234,212,0.42)'):FAINT}}/>
    </View>
    <Copy size={10} bold={day.isToday} style={{color:day.isToday?MINT:SOFT}}>{day.label}</Copy>
   </View>;})}
  </View>
  <View style={{flexDirection:'row',borderTopWidth:1,borderColor:FAINT,paddingTop:14}}>
   {[{value:String(inThis.length),label:tx('გასეირნება','Walks')},{value:newKm.toFixed(1),label:tx('ახალი ქუჩა, კმ','New streets, km')},{value:String(minutes),label:tx('აქტიური წთ','Active min')}].map((st,i)=><View key={st.label} style={{flex:1,alignItems:'center',borderLeftWidth:i?1:0,borderColor:FAINT}}>
    <Copy bold size={18} style={{color:'#fff',fontVariant:['tabular-nums']}}>{st.value}</Copy><Copy size={10} style={{color:SOFT}}>{st.label}</Copy>
   </View>)}
  </View>
  {lifetimeWalks?<Copy size={11} style={{color:SOFT,textAlign:'center',marginTop:-4}}>{tx(`სულ MEDIRUN-ში: ${lifetimeKm.toFixed(1)} კმ · ${lifetimeWalks} გასეირნება`,`All-time in MEDIRUN: ${lifetimeKm.toFixed(1)} km · ${lifetimeWalks} ${lifetimeWalks===1?'walk':'walks'}`)}</Copy>:null}
 </View>;
}

/** Progress: the three personal bests, each opening its walk. */
export function RecordTiles({history}:{history:RunSummary[]}){
 const router=useRouter(),c=useThemeColors(),dark=useIsDark(),teal=runInk('teal',dark);
 const r=useMemo(()=>personalRecords(history),[history]);
 const tiles=[
  r.longest&&{id:r.longest.id,art:RUN_ICON.route,value:formatKm(r.longest.distanceM,2),unit:tx('კმ','km'),label:tx('უგრძესი','Longest')},
  r.fastest&&{id:r.fastest.id,art:RUN_ICON.pace,value:formatPace(r.fastest.paceSecPerKm),unit:tx('/კმ','/km'),label:tx('უსწრაფესი','Fastest')},
  r.longestTime&&{id:r.longestTime.id,art:RUN_ICON.timer,value:formatClock(r.longestTime.movingMs),unit:'',label:tx('უხანგრძლივესი','Longest time')},
 ].filter(Boolean) as {id:string;art:typeof RUN_ICON.route;value:string;unit:string;label:string}[];
 if(!tiles.length)return null;
 return <Section title={tx('რეკორდები','Records')}>
  <View style={{flexDirection:'row',gap:10}}>{tiles.map(t=><Pressable key={t.label} accessibilityRole="button" accessibilityLabel={`${t.label}: ${t.value} ${t.unit}`} onPress={()=>router.push(`/run/${t.id}` as never)} style={{flex:1,backgroundColor:c.surface,borderRadius:HUB.cardRadius,paddingVertical:14,paddingHorizontal:12,gap:8}}>
   <ArtTile source={t.art} size={38}/>
   <View><View style={{flexDirection:'row',alignItems:'baseline',gap:2}}><Copy bold size={17} numberOfLines={1} style={{fontVariant:['tabular-nums'],flexShrink:1}}>{t.value}</Copy>{t.unit?<Copy bold size={10} style={{color:teal}}>{t.unit}</Copy>:null}</View>
   <Copy muted size={11} numberOfLines={1}>{t.label}</Copy></View>
  </Pressable>)}</View>
 </Section>;
}

/** Progress, last: how MEDIRUN works and its settings as two quiet rows. */
export function HubMoreRows({onHelp,onSettings}:{onHelp:()=>void;onSettings:()=>void}){
 const c=useThemeColors();
 const rows=[{id:'help',icon:BookOpen,label:tx('როგორ მუშაობს MEDIRUN','How MEDIRUN works'),detail:tx('ყუთები, ქოინები, მისიები','Boxes, coins, missions'),onPress:onHelp},{id:'settings',icon:Settings2,label:tx('პარამეტრები','Settings'),detail:tx('ხმა, ვიბრაცია, რუკა','Sound, haptics, map'),onPress:onSettings}];
 return <Card style={{paddingVertical:4,paddingHorizontal:14,gap:0}}>
  {rows.map((row,i)=><Pressable key={row.id} accessibilityRole="button" accessibilityLabel={`${row.label}. ${row.detail}`} onPress={row.onPress} style={{flexDirection:'row',alignItems:'center',gap:12,minHeight:60,paddingVertical:10,borderTopWidth:i?1:0,borderColor:c.bg200}}>
   <Tile icon={row.icon}/>
   <View style={{flex:1,minWidth:0}}><Copy bold size={14} numberOfLines={1}>{row.label}</Copy><Copy muted size={11} numberOfLines={1}>{row.detail}</Copy></View>
   <ChevronRight color={c.text300} size={18}/>
  </Pressable>)}
 </Card>;
}

