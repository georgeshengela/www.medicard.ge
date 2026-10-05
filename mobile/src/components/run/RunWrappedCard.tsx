import React,{useEffect,useMemo,useState} from 'react';
import {View} from 'react-native';
import {Clapperboard,Trophy} from 'lucide-react-native';
import {useAuth} from '@/store/AuthContext';
import {useWrapped,type Wrapped} from '@/lib/medipulsi/social';
import {loadRunHistory,type RunSummary} from '@/lib/run/history';
import {formatKm} from '@/lib/run/geo';
import {formatYmd} from '@/lib/format';
import {cityLines,joinSegments,thin,trimEnds,type LngLat} from '@/lib/run/shareStudio';
import {tx} from '@/i18n/locale';
import {Action,Card,Copy,Section,runInk} from './PulseUi';
import {useIsDark,useThemeColors} from '@/theme/colors';
import {hubTint} from '@/theme/hub';
import {num} from './RunDrops';
import {ShareStudio,canRecordClips,type ShareSceneInput} from './ShareStudio';

const TB=4*3600_000;
/** Is this walk inside the wrapped week (Tbilisi dates, inclusive)? */
export function inWeek(startedAt:string,week:Wrapped['week']){
 const ymd=new Date(Date.parse(startedAt)+TB).toISOString().slice(0,10);
 return ymd>=week.start&&ymd<=week.end;
}
export const showWrapped=(w:Wrapped|undefined,now=Date.now())=>Boolean(w&&now<Date.parse(w.showUntil)&&(w.meters>0||w.boxes>0));

/**
 * „შენი კვირა“ (owner 2026-10-05): Monday to Wednesday the MEDIRUN hub opens with last week in one card — distance,
 * new streets, boxes, coins, places on both boards and any Monday prize — and a video of that week to share.
 */
export function RunWrappedCard(){
 const {user}=useAuth(),c=useThemeColors(),dark=useIsDark(),teal=runInk('teal',dark),amber=dark?'#FCD34D':'#B45309',w=useWrapped().data,[history,setHistory]=useState<RunSummary[]>([]),[studio,setStudio]=useState(false);
 const visible=showWrapped(w);
 useEffect(()=>{if(!visible)return;let alive=true;void loadRunHistory().then(list=>{if(alive)setHistory(list);});return()=>{alive=false;};},[visible]);
 const scene=useMemo<ShareSceneInput|null>(()=>{
  if(!w||!visible||!canRecordClips)return null;
  const lines=cityLines(trimEnds(history.filter(r=>inWeek(r.startedAt,w.week)).map(r=>joinSegments((r.segments?.length?r.segments:[r.path]).map(s=>s.map(p=>[p.lng,p.lat] as LngLat)))),200)).map(l=>thin(l,400));
  if(!lines.length)return null;
  return {kind:'city',lines,hero:user?.gender==='FEMALE'?'f':'m',kicker:`${formatYmd(w.week.start)} – ${formatYmd(w.week.end)}`,title:tx('ჩემი კვირა MEDIRUN-ში','My week in MEDIRUN'),big:formatKm(w.meters,1),unit:tx('კმ','km'),
   stats:[
    {value:formatKm(w.newMeters,1),label:tx('ახალი ქუჩა, კმ','new streets, km')},
    {value:num(w.boxes),label:tx('ყუთი','boxes')},
    w.rank.meters?{value:`#${w.rank.meters}`,label:tx('მანძილში','in distance')}:{value:num(w.coins),label:'Medi Coins'},
   ]};
 },[w,visible,history,user?.gender]);
 if(!w||!visible)return null;
 const prize=[...w.prizes].sort((a,b)=>a.rank-b.rank)[0];
 const cells=[
  {v:formatKm(w.meters,1),l:tx('კმ','km')},
  {v:formatKm(w.newMeters,1),l:tx('ახალი ქუჩა, კმ','new streets, km')},
  {v:num(w.boxes),l:tx('ყუთი','boxes')},
  {v:num(w.coins),l:'Medi Coins'},
 ];
 // A flat hub card (the hero stays the page's one spotlight).
 return <Section title={tx('შენი კვირა','Your week')}>
  <Card style={{gap:14}}>
   <Copy muted size={12}>{formatYmd(w.week.start)} – {formatYmd(w.week.end)}</Copy>
   <View style={{flexDirection:'row',flexWrap:'wrap',rowGap:12}}>{cells.map((cell,i)=><View key={cell.l} style={{width:'50%'}}><Copy bold size={24} style={{color:i===0?teal:c.text100,fontVariant:['tabular-nums']}}>{cell.v}</Copy><Copy muted size={11}>{cell.l}</Copy></View>)}</View>
   {w.rank.meters||w.rank.boxes?<Copy muted size={12}>{[w.rank.meters?tx(`მანძილში #${w.rank.meters}`,`#${w.rank.meters} in distance`):'',w.rank.boxes?tx(`ყუთებში #${w.rank.boxes}`,`#${w.rank.boxes} in boxes`):''].filter(Boolean).join(' · ')}</Copy>:null}
   {prize?<View style={{flexDirection:'row',alignItems:'center',gap:8,padding:10,borderRadius:14,backgroundColor:hubTint(amber,dark)}}><Trophy size={16} color={amber}/><Copy bold size={12} style={{color:amber,flex:1}}>{tx(`კვირის პრიზი: ${prize.board==='meters'?'მანძილი':'ყუთები'} #${prize.rank} · +${num(prize.coins)} Medi Coins`,`Weekly prize: ${prize.board==='meters'?'distance':'boxes'} #${prize.rank} · +${num(prize.coins)} Medi Coins`)}</Copy></View>:null}
   {scene?<Action label={tx('ჩემი კვირა ვიდეოდ','My week as a video')} icon={Clapperboard} onPress={()=>setStudio(true)}/>:null}
  </Card>
  <ShareStudio visible={studio} scene={scene} source="wrapped" onClose={()=>setStudio(false)}/>
 </Section>;
}
