import React,{useMemo,useState} from 'react';
import {View} from 'react-native';
import {Check,Clapperboard,Users} from 'lucide-react-native';
import {useAuth} from '@/store/AuthContext';
import {useIsDark,useThemeColors} from '@/theme/colors';
import {hubTint} from '@/theme/hub';
import {usePulse} from '@/lib/medipulsi/client';
import {coverageFeatures} from '@/lib/medipulsi/core/journey';
import {useCityMeter,type CityMeter} from '@/lib/medipulsi/social';
import {grandPercent,levelPercent} from '@/lib/medipulsi/grand';
import {cityLines,lineLength,thin,trimEnds,type LngLat} from '@/lib/run/shareStudio';
import {tx} from '@/i18n/locale';
import {Action,Bar,Card,Copy,Section,runInk} from './PulseUi';
import {useGrandPrize} from './GrandPrizeCard';
import {num} from './RunDrops';
import {ShareStudio,canRecordClips,type ShareSceneInput} from './ShareStudio';

/** „0,84%“ with the precision a small city share needs (0,003% early on, 12% later). */
export function meterPercent(p:number){return grandPercent(p);}
/** Progress from the last milestone to the next one, 0–100. */
export function milestoneProgress(m:CityMeter){
 const next=m.milestones.next?.percent,last=m.milestones.last?.percent??0;
 if(!next)return 100;
 return Math.max(0,Math.min(100,(m.percent-last)/(next-last)*100));
}

/**
 * „თბილისი ერთად“ (owner 2026-10-05): how much of the city every player has lit together, the next city milestone
 * and the person's own lit city as a video to share. Aggregates only — never anybody's route.
 */
export function RunCityCard(){
 const c=useThemeColors(),dark=useIsDark(),teal=runInk('teal',dark),{user}=useAuth(),pulse=usePulse();
 const meter=useCityMeter().data?.meter||null,grand=useGrandPrize().data,[studio,setStudio]=useState(false);
 // My lit streets for the clip: the GPS trail plus verified park paths, 200 m cut at every end, one city only.
 const lines=useMemo(()=>{
  const raw=[...(pulse.journey.trail||[]),...coverageFeatures(pulse.journey).features.map(f=>f.geometry.coordinates)] as LngLat[][];
  return cityLines(trimEnds(raw,200)).slice(-160).map(l=>thin(l,300));
 },[pulse.journey.trail,pulse.journey.covered]);
 const mine=grand?.me?.percent??null;
 const scene=useMemo<ShareSceneInput|null>(()=>canRecordClips&&lines.length&&lines.reduce((s,l)=>s+lineLength(l),0)>=150?{kind:'city',lines,hero:user?.gender==='FEMALE'?'f':'m',
  kicker:tx('გაანათე თბილისი','Light up Tbilisi'),title:tx('ჩემი განათებული ქალაქი','My lit-up city'),big:mine!=null?meterPercent(mine).replace('%',''):String(lines.length),unit:mine!=null?'%':tx('ქუჩა','streets'),
  stats:[
   ...(meter?[{value:`${meterPercent(meter.percent)}`,label:tx(`${meter.city} ერთად`,`${meter.city} together`)}]:[]),
   ...(meter?[{value:num(meter.people),label:tx('ადამიანი ანათებს','people lighting it')}]:[]),
  ]}:null,[lines,user?.gender,mine,meter]);
 if(!meter)return null;
 const next=meter.milestones.next;
 return <Section title={tx(`${meter.city} ერთად`,`${meter.city} together`)}>
  <Card style={{gap:14}}>
   <View style={{flexDirection:'row',alignItems:'flex-end',gap:12}}>
    <View style={{flex:1}}>
     <Copy muted size={12}>{tx('ყველამ ერთად გავანათეთ','Lit by everyone together')}</Copy>
     <Copy bold size={34} style={{lineHeight:42,letterSpacing:-1,fontVariant:['tabular-nums'],color:teal}}>{meterPercent(meter.percent)}</Copy>
    </View>
    <View style={{flexDirection:'row',alignItems:'center',gap:6,paddingHorizontal:10,paddingVertical:7,borderRadius:12,backgroundColor:hubTint(teal,dark)}}><Users size={14} color={teal}/><Copy bold size={12} style={{color:teal}}>{num(meter.people)}</Copy><Copy size={12} muted>{tx('ადამიანი','people')}</Copy></View>
   </View>
   {next?<View style={{gap:6}}>
    <Bar value={milestoneProgress(meter)} label={tx(`შემდეგი ეტაპი ${levelPercent(next.percent)}`,`Next milestone ${levelPercent(next.percent)}`)}/>
    <Copy muted size={12}>{tx(`შემდეგი ეტაპი — ${levelPercent(next.percent)} · დარჩა ${meterPercent(next.remaining)}. ყოველი ახალი ქუჩა ითვლება — ერთად უფრო სწრაფია.`,`Next milestone — ${levelPercent(next.percent)} · ${meterPercent(next.remaining)} to go. Every new street counts — it’s faster together.`)}</Copy>
   </View>:null}
   {meter.milestones.list.some(m=>m.reached)?<View style={{flexDirection:'row',flexWrap:'wrap',gap:6}}>
    {meter.milestones.list.filter(m=>m.reached).slice(-6).map(m=><View key={m.percent} style={{flexDirection:'row',alignItems:'center',gap:4,paddingHorizontal:9,paddingVertical:5,borderRadius:10,backgroundColor:c.bg200}}><Check size={12} color={teal}/><Copy size={11} bold>{levelPercent(m.percent)}</Copy></View>)}
   </View>:null}
   {mine!=null?<Copy muted size={12}>{tx(`შენი წილი — ${meterPercent(mine)}. ქუჩა, რომელიც სხვამ უკვე გაანათა, შენთვისაც ითვლება.`,`Your share — ${meterPercent(mine)}. A street someone else lit still counts for you.`)}</Copy>:null}
   {scene?<Action secondary label={tx('ჩემი ქალაქი ვიდეოდ','My city as a video')} icon={Clapperboard} onPress={()=>setStudio(true)}/>:null}
  </Card>
  <ShareStudio visible={studio} scene={scene} source="city" onClose={()=>setStudio(false)}/>
 </Section>;
}
