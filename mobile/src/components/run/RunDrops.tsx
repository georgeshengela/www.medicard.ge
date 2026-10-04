import React,{useEffect,useState} from 'react';
import {Linking,Pressable,View} from 'react-native';
import {ChevronRight,Gift,MapPin} from 'lucide-react-native';
import {useIsDark,useThemeColors} from '@/theme/colors';
import {hubTint} from '@/theme/hub';
import {formatYmd} from '@/lib/format';
import {countdownParts,useDrops,type CoinRange,type Drops} from '@/lib/medipulsi/drops';
import {tx} from '@/i18n/locale';
import {Card,Copy,Section,Sheet,runInk} from './PulseUi';

const TBILISI_MS=4*3600_000;
export const num=(n:number)=>Math.round(n).toLocaleString('en-US').replace(/,/g,' ');
/** Clock and day of an instant in Tbilisi time, whatever the phone's zone. */
export const tbilisi=(iso:string)=>{const t=new Date(Date.parse(iso)+TBILISI_MS).toISOString();return {ymd:t.slice(0,10),clock:t.slice(11,16)};};
export function dayWord(iso:string,now=Date.now()){
 const at=tbilisi(iso).ymd,today=tbilisi(new Date(now).toISOString()).ymd,tomorrow=tbilisi(new Date(now+86400_000).toISOString()).ymd;
 return at===today?tx('დღეს','today'):at===tomorrow?tx('ხვალ','tomorrow'):formatYmd(at);
}
export const coinsText=(c:CoinRange)=>!c?'':c.min===c.max?`${num(c.min)} Medi Coins`:`${num(c.min)}–${num(c.max)} Medi Coins`;

/** Ticks every second until `to`; calls `onDone` once it is reached. */
export function useCountdown(to:string|null|undefined,onDone?:()=>void){
 const [now,setNow]=useState(Date.now());
 useEffect(()=>{if(!to)return;const t=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(t);},[to]);
 const left=to?Date.parse(to)-now:0,done=Boolean(to)&&left<=0;
 useEffect(()=>{if(done)onDone?.();},[done]);// eslint-disable-line react-hooks/exhaustive-deps
 return countdownParts(left);
}

function nextNote(next:NonNullable<Drops['next']>){
 if(next.kind==='saturday')return tx('ქოინების წვიმა ერთ პარკში — პარკს 15:00-სა და 15:30-ზე სთორიში გამოცანით გავამხელთ.','A coin rain in one park — revealed with a riddle in our stories at 15:00 and 15:30.');
 if(next.kind==='lantern')return tx('ფარნის ყუთები — თბილისის 0,25%-დან.','Lantern boxes — from 0.25% of Tbilisi.');
 if(next.kind==='evening')return tx('საღამოს — განათებულ ბილიკებზე.','Evening — on lit paths.');
 return null;
}

/**
 * Under the hero: where the boxes are (districts) or what the next wave brings, today's openings and the
 * schedule. Short on purpose — the hero carries the numbers, this card the details.
 */
export function RunDropsCard(){
 const query=useDrops(),data=query.data,c=useThemeColors(),dark=useIsDark(),teal=runInk('teal',dark),[schedule,setSchedule]=useState(false);
 if(!data||!data.enabled)return null;
 const {now,next,today,me}=data,live=now.boxes>0;
 if(!live&&!next)return null;
 const note=!live&&next?nextNote(next):null;
 return <Section title={live?tx('სად არის ყუთები','Where the boxes are'):tx('შემდეგი ყუთები','Next boxes')} link={tx('განრიგი','Schedule')} onLink={()=>setSchedule(true)}>
  <Card style={{gap:12}}>
   {live?<>
    <View style={{flexDirection:'row',flexWrap:'wrap',gap:6}}>
     {now.districts.slice(0,10).map(d=><View key={d.name} style={{flexDirection:'row',alignItems:'center',gap:5,paddingHorizontal:10,paddingVertical:6,borderRadius:12,backgroundColor:hubTint(teal,dark)}}><MapPin size={12} color={teal}/><Copy size={12}>{d.name}</Copy><Copy bold size={12} style={{color:teal}}>{d.boxes}</Copy></View>)}
    </View>
    <View style={{flexDirection:'row',alignItems:'center',gap:8}}><Gift size={15} color={teal}/><Copy muted size={12} style={{flex:1}}>{[now.coins?tx(`თითოში ${coinsText(now.coins)}`,`${coinsText(now.coins)} each`):'',now.endsAt?tx(`${tbilisi(now.endsAt).clock}-მდე`,`until ${tbilisi(now.endsAt).clock}`):''].filter(Boolean).join(' · ')}</Copy></View>
   </>:next?<>
    <View style={{flexDirection:'row',alignItems:'baseline',gap:8}}>
     <Copy bold size={22} style={{fontVariant:['tabular-nums']}}>{tbilisi(next.startsAt).clock}</Copy>
     <Copy muted size={13} style={{flex:1}}>{dayWord(next.startsAt)} · {tx(`${next.boxes} ყუთი`,`${next.boxes} ${next.boxes===1?'box':'boxes'}`)}</Copy>
    </View>
    {next.coins?<View style={{flexDirection:'row',alignItems:'center',gap:8}}><Gift size={15} color={teal}/><Copy muted size={12} style={{flex:1}}>{tx(`თითოში ${coinsText(next.coins)}`,`${coinsText(next.coins)} each`)}</Copy></View>:null}
    {note?<Copy muted size={12}>{note}</Copy>:null}
   </>:null}
   <View style={{borderTopWidth:1,borderColor:c.bg200,paddingTop:10}}>
    <Copy muted size={12}>{today.opened?tx(`დღეს გაიხსნა ${today.opened}-ჯერ · ${num(today.coins)} ქოინი`,`Opened ${today.opened}× today · ${num(today.coins)} coins`):tx('დღეს ჯერ არავის გაუხსნია — იყავი პირველი.','Nobody has opened one today — be the first.')}{me.coins?<Copy bold size={12} style={{color:teal}}>{tx(` · შენ +${num(me.coins)}`,` · you +${num(me.coins)}`)}</Copy>:null}</Copy>
   </View>
  </Card>
  <ScheduleSheet visible={schedule} onClose={()=>setSchedule(false)} data={data}/>
 </Section>;
}

function ScheduleSheet({visible,onClose,data}:{visible:boolean;onClose:()=>void;data:Drops}){
 const c=useThemeColors();
 const period=`${formatYmd(data.campaign.start)} – ${formatYmd(data.campaign.end)}`;
 const city=data.city&&!data.city.campaignCity?data.city.name:null;
 return <Sheet title={tx('ყუთების განრიგი','Box schedule')} visible={visible} onClose={onClose}>
  <Copy muted size={13}>{city?tx(`${city} · ${period}. ყუთები თავისით ჩნდება ქალაქის პარკებში, ყოველდღე სხვა ადგილას. დრო — ადგილობრივი.`,`${city} · ${period}. Boxes appear by themselves in the city’s parks, in a different place every day. Local time.`):tx(`„${data.campaign.name}“ · ${period}. ყუთები თავისით ჩნდება თბილისის პარკებში, ყოველდღე სხვა უბნებში.`,`„${data.campaign.name}“ · ${period}. Boxes appear by themselves in Tbilisi parks, in different districts every day.`)}</Copy>
  <Card style={{paddingVertical:4,gap:0}}>
   {data.schedule.map((row,i)=><View key={row.id} style={{flexDirection:'row',alignItems:'center',gap:12,minHeight:60,paddingVertical:10,borderTopWidth:i?1:0,borderColor:c.bg200}}>
    <View style={{flex:1,minWidth:0}}><Copy bold size={14}>{row.label}</Copy><Copy muted size={12}>{coinsText(row.coins)} {tx('თითო ყუთში','per box')}</Copy></View>
    <Copy bold size={14} style={{color:c.primary100,fontVariant:['tabular-nums']}}>{row.times}</Copy>
   </View>)}
  </Card>
  <Card style={{gap:8}}>
   <Copy bold size={14}>{tx('როგორ იხსნება ყუთი','How a box opens')}</Copy>
   <Copy muted size={12}>{tx('1. დაიწყე გასეირნება MEDIRUN-ში. 2. ყუთიდან 250–350 მ-ზე პულსი ჩაგერთვება — რაც ახლოს ხარ, მით ჩქარია. 3. 20–25 მ-ზე ყუთი კამერაში გამოჩნდება — შეეხე და ქოინები მაშინვე ჩაგერიცხება. ერთ ყუთს რამდენიმე ადამიანი ხსნის, სანამ მარაგი არ ამოიწურება.','1. Start a walk in MEDIRUN. 2. 250–350 m from a box a pulse starts — the closer you are, the faster it beats. 3. At 20–25 m the box shows up in the camera — tap it and the coins land at once. Several people can open one box until it runs out.')}</Copy>
   <Copy muted size={12}>{tx('ქოინებს MEDIQUEST-ის მაღაზიაში ცვლი სასაჩუქრე ბარათებსა და გაჯეტებზე.','You swap the coins for gift cards and gadgets in the MEDIQUEST store.')}</Copy>
  </Card>
  {city?null:<Pressable accessibilityRole="link" onPress={()=>void Linking.openURL(data.campaign.rulesUrl)} style={{minHeight:44,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:6}}>
   <Copy bold size={13} style={{color:c.primary100}}>{tx('კამპანიის წესები','Campaign rules')}</Copy><ChevronRight size={14} color={c.primary100}/>
  </Pressable>}
 </Sheet>;
}
