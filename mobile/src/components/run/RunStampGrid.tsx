import React,{useMemo} from 'react';
import {Image,Pressable,View} from 'react-native';
import {Check} from 'lucide-react-native';
import {tx} from '@/i18n/locale';
import {useIsDark,useThemeColors} from '@/theme/colors';
import {hubTint} from '@/theme/hub';
import {missionPercent,missionProgress,type Mission,type MissionBook} from '@/lib/medipulsi/core/missions';
import {Copy,runInk} from './PulseUi';
import {MISSION_ART,RUN_ICON} from './runArt';

/**
 * MEDIRUN stage 7 (owner 2026-10-09): the passport as a collection — stamps earned glow, places still to visit sit
 * dim, the suggested next one is ringed. Eight tiles, earned first, then the suggestion, then the most walked; the
 * last tile opens every mission.
 */
export function RunStampGrid({missions,book,nextId,onOpen}:{missions:Mission[];book:MissionBook;nextId:string|null;onOpen:()=>void}){
 const c=useThemeColors(),dark=useIsDark(),teal=runInk('teal',dark),gold=runInk('amber',dark);
 const tiles=useMemo(()=>{
  const rank=(m:Mission)=>missionProgress(book,m).completedAt?0:m.id===nextId?1:2;
  return [...missions].sort((a,b)=>rank(a)-rank(b)||missionPercent(book,b)-missionPercent(book,a)).slice(0,7);
 },[missions,book,nextId]);
 if(!missions.length)return null;
 const more=missions.length-tiles.length;
 return <View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>
  {tiles.map(m=>{const done=Boolean(missionProgress(book,m).completedAt),next=m.id===nextId,pct=missionPercent(book,m);
   return <Pressable key={m.id} accessibilityRole="button" accessibilityLabel={`${m.name}: ${done?tx('შტამპი მიღებულია','stamp earned'):tx(`${pct} პროცენტი`,`${pct} percent`)}`} onPress={onOpen} style={{width:'23%',aspectRatio:1,borderRadius:16,backgroundColor:done?hubTint(gold,dark):c.bg200,borderWidth:next?2:done?1:0,borderColor:next?teal:gold,alignItems:'center',justifyContent:'center',overflow:'hidden'}}>
    <Image source={MISSION_ART[m.id]||RUN_ICON.flag} accessibilityIgnoresInvertColors resizeMode="contain" style={{width:'74%',height:'74%',opacity:done?1:next?.85:.32}}/>
    {done?<View style={{position:'absolute',right:5,top:5,width:16,height:16,borderRadius:8,backgroundColor:gold,alignItems:'center',justifyContent:'center'}}><Check size={10} color="#1F1300" strokeWidth={3.2}/></View>
    :pct>0?<View style={{position:'absolute',left:6,right:6,bottom:5,height:3,borderRadius:2,backgroundColor:'rgba(255,255,255,0.15)',overflow:'hidden'}}><View style={{width:`${pct}%`,height:3,backgroundColor:teal}}/></View>:null}
   </Pressable>;})}
  <Pressable accessibilityRole="button" accessibilityLabel={tx(`ყველა მისია, კიდევ ${more}`,`All missions, ${more} more`)} onPress={onOpen} style={{width:'23%',aspectRatio:1,borderRadius:16,backgroundColor:c.bg200,alignItems:'center',justifyContent:'center'}}>
   <Copy bold size={16} style={{color:teal}}>{more>0?`+${more}`:'›'}</Copy>
   <Copy muted size={9}>{tx('ყველა','all')}</Copy>
  </Pressable>
 </View>;
}
