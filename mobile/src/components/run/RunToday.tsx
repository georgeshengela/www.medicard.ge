import React from 'react';
import {Pressable,View} from 'react-native';
import {Check,Play} from 'lucide-react-native';
import {useThemeColors} from '@/theme/colors';
import {HUB} from '@/theme/hub';
import {tx} from '@/i18n/locale';
import {useDrops} from '@/lib/medipulsi/drops';
import {Card,Copy,RUN_CTA,Section} from './PulseUi';
import {useMyCities} from './RunCities';
import {meterPercent} from './RunCityCard';

/*
 * MEDIRUN stage 2 (owner 2026-10-09, „ეტაპ ეტაპ“): the day at a glance in the lobby — like Pokémon GO's Today view —
 * and a three-step first walk for people who have not walked yet; it disappears once all three are done.
 */
const SOFT='rgba(255,255,255,0.62)',LINE='rgba(255,255,255,0.12)';

/** „1,2 კმ დღეს · 2 ყუთი · ლიეჟი 0,03%“ as one glass row above the lobby headline. */
export function TodayStrip({todayKm}:{todayKm:number}){
 const drops=useDrops().data,cities=useMyCities().data;
 const cityName=drops?.city?.name||null;
 const city=cities?.lit.find(c=>c.name===cityName)||cities?.lit[0]||null;
 const cells=[
  {value:todayKm.toFixed(1).replace('.',tx(',','.')),unit:tx('კმ','km'),label:tx('დღეს გავლილი','walked today')},
  {value:String(drops?.me.opened||0),unit:'',label:tx('ყუთი დღეს','boxes today')},
  {value:city?meterPercent(city.percent):'0%',unit:'',label:city?tx(`${city.name} განათებული`,`of ${city.name} lit`):tx('ქალაქი განათებული','of the city lit')},
 ];
 return <View accessible accessibilityLabel={tx(`დღეს: ${cells[0].value} კილომეტრი, ${cells[1].value} ყუთი, ${cells[2].value} ${cells[2].label}`,`Today: ${cells[0].value} km, ${cells[1].value} boxes, ${cells[2].value} ${cells[2].label}`)} style={{flexDirection:'row',backgroundColor:'rgba(5,11,22,0.58)',borderWidth:1,borderColor:'rgba(255,255,255,0.14)',borderRadius:16,paddingVertical:9}}>
  {cells.map((c,i)=><View key={c.label} style={{flex:1,alignItems:'center',borderLeftWidth:i?1:0,borderColor:LINE,paddingHorizontal:4}}>
   <View style={{flexDirection:'row',alignItems:'baseline',gap:2}}><Copy bold size={16} style={{color:'#fff',fontVariant:['tabular-nums'],lineHeight:20}}>{c.value}</Copy>{c.unit?<Copy bold size={10} style={{color:'#99F6E4'}}>{c.unit}</Copy>:null}</View>
   <Copy size={10} numberOfLines={1} style={{color:SOFT,lineHeight:13}}>{c.label}</Copy>
  </View>)}
 </View>;
}

/** Three steps for a first walk; each ticks itself from what the server already knows. */
export function FirstWalkGuide({walked,lit,opened,onStart}:{walked:boolean;lit:boolean;opened:boolean;onStart:()=>void}){
 const c=useThemeColors();
 if(walked&&lit&&opened)return null;
 const steps=[
  {done:walked,title:tx('დაიწყე და გაიარე 200 მეტრი','Start and walk 200 metres'),detail:tx('ტელეფონი შეგიძლია ჯიბეში ჩაიდო — გზა ფონზეც იწერება.','You can pocket the phone — the path records in the background.')},
  {done:lit,title:tx('აანთე პირველი ქუჩა','Light your first street'),detail:tx('რუკაზე შენი გზა ფერადდება, ქუჩის შენობები ინთება.','Your path colours the map and the buildings on it light up.')},
  {done:opened,title:tx('გახსენი პირველი ყუთი','Open your first box'),detail:tx('პირველ გასეირნებაზე საჩუქრად გელოდება ყუთი — სულ ახლოს გამოჩნდება.','A welcome box waits on your first walk — it appears right next to you.')},
 ];
 const next=steps.findIndex(s=>!s.done);
 return <Section title={tx('პირველი გასეირნება','Your first walk')}>
  <Card style={{gap:14}}>
   <Copy muted size={12}>{tx(`სამი ნაბიჯი — ${steps.filter(s=>s.done).length} / 3 შესრულებული.`,`Three steps — ${steps.filter(s=>s.done).length} of 3 done.`)}</Copy>
   <View style={{gap:12}}>
    {steps.map((s,i)=>{const current=i===next;return <View key={s.title} accessible accessibilityLabel={`${s.title}${s.done?tx(', შესრულებულია',', done'):''}`} style={{flexDirection:'row',gap:12,alignItems:'flex-start',opacity:s.done||current?1:.55}}>
     <View style={{width:28,height:28,borderRadius:14,alignItems:'center',justifyContent:'center',backgroundColor:s.done?'#14B8A6':current?'rgba(20,184,166,0.18)':c.bg200,borderWidth:current?1.5:0,borderColor:'#5EEAD4'}}>
      {s.done?<Check size={15} color="#fff" strokeWidth={3}/>:<Copy bold size={12} style={{color:current?'#5EEAD4':c.text200}}>{i+1}</Copy>}
     </View>
     <View style={{flex:1,minWidth:0}}>
      <Copy bold size={14} style={{textDecorationLine:s.done?'line-through':'none',color:s.done?c.text200:c.text100}}>{s.title}</Copy>
      {current?<Copy muted size={12}>{s.detail}</Copy>:null}
     </View>
    </View>;})}
   </View>
   <Pressable accessibilityRole="button" accessibilityLabel={tx('დავიწყოთ პირველი გასეირნება','Start the first walk')} onPress={onStart} style={{minHeight:52,borderRadius:HUB.tileRadius+4,backgroundColor:RUN_CTA,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:10}}>
    <Play size={16} color="#fff" fill="#fff"/><Copy bold size={15} style={{color:'#fff'}}>{tx('დავიწყოთ','Let’s go')}</Copy>
   </Pressable>
  </Card>
 </Section>;
}
