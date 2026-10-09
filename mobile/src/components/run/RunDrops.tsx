import React,{useEffect,useMemo,useState} from 'react';
import {Linking,Pressable,View} from 'react-native';
import {ChevronDown,ChevronRight,ChevronUp,Gift,Hourglass,MapPin} from 'lucide-react-native';
import {useIsDark,useThemeColors} from '@/theme/colors';
import {hubTint} from '@/theme/hub';
import {formatYmd} from '@/lib/format';
import {countdownParts,useDrops,type CoinRange,type Drops} from '@/lib/medipulsi/drops';
import {tx} from '@/i18n/locale';
import {distance,type Coordinate} from '@/lib/medipulsi/core/engine';
import {Card,Copy,Section,Sheet,Tile,runInk} from './PulseUi';

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

/** Georgian „in <city>“: თბილისი → თბილისში, ვენა → ვენაში. */
export const kaIn=(name:string)=>(name.endsWith('ი')?name.slice(0,-1):name)+'ში';
/** „ახლა თბილისში 12 ადამიანი დადის · წვიმის ზონაში 5“ — numbers only (the server hides counts below three). */
export function liveText(data:Drops){
 const w=data.live?.walkers,r=data.live?.rain,city=data.city?.name||tx('თბილისი','Tbilisi');
 if(!w)return '';
 const head=tx(`ახლა ${kaIn(city)} ${w} ადამიანი დადის`,`${w} people are walking in ${city} right now`);
 return r?`${head} · ${tx(`ქოინების წვიმასთან ${r}`,`${r} at the coin rain`)}`:head;
}

function nextNote(next:NonNullable<Drops['next']>){
 if(next.kind==='saturday')return tx('ქოინების წვიმა ერთ პარკში — პარკს 15:00-სა და 15:30-ზე სთორიში გამოცანით გავამხელთ.','A coin rain in one park — revealed with a riddle in our stories at 15:00 and 15:30.');
 if(next.kind==='lantern')return tx('ფარნის ყუთები — თბილისის 0,25%-დან.','Lantern boxes — from 0.25% of Tbilisi.');
 if(next.kind==='evening')return tx('საღამოს — განათებულ ბილიკებზე.','Evening — on lit paths.');
 return null;
}

/** „≈ 2,5 კმ“: the district point is a ~1 km grid, so whole halves of a kilometre are as exact as it gets. */
export function approxKm(m:number){
 if(m<1000)return tx('1 კმ-მდე','under 1 km');
 const km=m<20_000?Math.round(m/500)/2:Math.round(m/1000);
 return tx(`≈ ${String(km).replace('.',',')} კმ`,`≈ ${km} km`);
}
/** Walking time at ~5 km/h, in 5-minute steps; hours past 90 minutes. */
export function walkTime(m:number){
 const min=Math.max(5,Math.round(m/1000*12/5)*5);
 if(min<=90)return tx(`~${min} წთ ფეხით`,`~${min} min on foot`);
 const h=Math.round(min/30)/2;
 return tx(`~${String(h).replace('.',',')} სთ ფეხით`,`~${h} h on foot`);
}
const boxesWord=(n:number)=>tx(`${n} ყუთი`,`${n} ${n===1?'box':'boxes'}`);
const ROWS=5;
const pad2=(n:number)=>String(n).padStart(2,'0');
/** „1:42:05“ / „07:09“ — how long the boxes of one place stay out. */
export function clockLeft(ms:number){const {d,h,m,s}=countdownParts(ms),hours=d*24+h;return hours?`${hours}:${pad2(m)}:${pad2(s)}`:`${pad2(m)}:${pad2(s)}`;}
/** Ink of a disappearing countdown: teal, amber under 15 minutes, red under 5. */
const leftInk=(left:number,dark:boolean)=>left<5*60_000?(dark?'#FCA5A5':'#DC2626'):left<15*60_000?(dark?'#FCD34D':'#B45309'):runInk('teal',dark);
/** „დაიყრება 9:14:20“ — the same pill as a place timer, counting to the next wave. */
function DropTimer({to,now}:{to:string;now:number}){
 const dark=useIsDark(),ink=runInk('teal',dark),left=Date.parse(to)-now;
 return <View accessible accessibilityRole="timer" accessibilityLabel={tx(`დაიყრება ${clockLeft(left)}-ში`,`Drops in ${clockLeft(left)}`)} style={{flexDirection:'row',alignItems:'center',gap:5,paddingLeft:7,paddingRight:9,paddingVertical:3,borderRadius:10,backgroundColor:hubTint(ink,dark)}}>
  <Hourglass size={11} color={ink} strokeWidth={2.4}/>
  <Copy bold size={11} style={{color:ink,fontVariant:['tabular-nums'],lineHeight:15}}>{clockLeft(left)}</Copy>
 </View>;
}
/** Teal while there is time, amber under 15 minutes, red under 5 — and a bar that drains with the wave. */
function PlaceTimer({startsAt,endsAt,now}:{startsAt?:string;endsAt:string;now:number}){
 const dark=useIsDark(),c=useThemeColors(),end=Date.parse(endsAt),left=end-now,from=startsAt?Date.parse(startsAt):NaN;
 const ink=leftInk(left,dark);
 const share=Number.isFinite(from)&&end>from?Math.max(0,Math.min(1,left/(end-from))):null;
 return <View accessible accessibilityLabel={tx(`გაქრება ${clockLeft(left)}-ში`,`Gone in ${clockLeft(left)}`)} style={{gap:5,alignItems:'flex-start'}}>
  <View style={{flexDirection:'row',alignItems:'center',gap:5,paddingLeft:7,paddingRight:9,paddingVertical:3,borderRadius:10,backgroundColor:hubTint(ink,dark)}}>
   <Hourglass size={11} color={ink} strokeWidth={2.4}/>
   <Copy bold size={11} style={{color:ink,fontVariant:['tabular-nums'],lineHeight:15}}>{clockLeft(left)}</Copy>
  </View>
  {share!=null?<View style={{alignSelf:'stretch',height:3,borderRadius:2,backgroundColor:c.bg200,overflow:'hidden'}}><View style={{width:`${Math.round(share*1000)/10}%`,height:3,borderRadius:2,backgroundColor:ink}}/></View>:null}
 </View>;
}

/**
 * Under the hero: where the boxes are (districts, nearest first with an approximate distance from the reader)
 * or what the next wave brings, today's openings and the schedule.
 */
export type HuntPlace={name:string;near:Coordinate;endsAt?:string|null};
export function RunDropsCard({here,onHunt}:{here?:Coordinate|null;onHunt?:(place:HuntPlace)=>void}){
 const query=useDrops(),data=query.data,c=useThemeColors(),dark=useIsDark(),teal=runInk('teal',dark),[schedule,setSchedule]=useState(false),[all,setAll]=useState(false);
 const rows=useMemo(()=>{
  const list=(data?.now.districts||[]).map(d=>({...d,meters:here&&d.near?distance(here,d.near):null}));
  return here?list.sort((a,b)=>(a.meters??Infinity)-(b.meters??Infinity)):list;
 },[data?.now.districts,here]);
 // One clock for every place timer; a place whose last box ended drops out and the counts are fetched again.
 const [tick,setTick]=useState(Date.now()),timed=Boolean(data?.now.endsAt||data?.next?.startsAt||rows.some(r=>r.endsAt));
 useEffect(()=>{if(!timed)return;const t=setInterval(()=>setTick(Date.now()),1000);return()=>clearInterval(t);},[timed]);
 const passed=(iso?:string|null)=>Boolean(iso&&Date.parse(iso)<=tick);
 const expired=passed(data?.now.endsAt)||passed(data?.next?.startsAt)||rows.some(r=>passed(r.endsAt));
 useEffect(()=>{if(expired)void query.refetch();},[expired]);// eslint-disable-line react-hooks/exhaustive-deps
 if(!data||!data.enabled)return null;
 const {now,next,today,me}=data,live=now.boxes>0;
 if(!live&&!next)return null;
 const note=!live&&next?nextNote(next):null;
 const open=rows.filter(r=>!r.endsAt||Date.parse(r.endsAt)>tick),measured=open.some(r=>r.meters!=null),shown=all?open:open.slice(0,ROWS);
 return <Section title={live?tx('სად არის ყუთები','Where the boxes are'):tx('შემდეგი ყუთები','Next boxes')} link={tx('განრიგი','Schedule')} onLink={()=>setSchedule(true)}>
  <Card style={{gap:12}}>
   {data.live?.walkers?<View accessible accessibilityLabel={liveText(data)} style={{flexDirection:'row',alignItems:'center',gap:8}}><View style={{width:8,height:8,borderRadius:4,backgroundColor:'#22C55E'}}/><Copy bold size={12} style={{flex:1}}>{liveText(data)}</Copy></View>:null}
   {live?<>
    <View style={{flexDirection:'row',alignItems:'center',gap:12}}>
     <Tile icon={Gift}/>
     <View style={{flex:1,minWidth:0}}>
      <Copy bold size={16}>{tx(`ახლა ქალაქშია ${boxesWord(now.boxes)}`,`${boxesWord(now.boxes)} out in the city now`)}</Copy>
      <Copy muted size={12}>{[now.coins?tx(`პირველს ${coinsText(now.coins)}`,`${coinsText(now.coins)} for the first`):'',next?tx(`შემდეგი დაყრა ${tbilisi(next.startsAt).clock}`,`next drop ${tbilisi(next.startsAt).clock}`):''].filter(Boolean).join(' · ')}</Copy>
     </View>
    </View>
    <View style={{borderRadius:18,backgroundColor:c.bg100,paddingHorizontal:12}}>
     {shown.map((d,i)=>{const nearest=measured&&i===0&&d.meters!=null,near=d.near,go=near&&onHunt?()=>onHunt({name:d.name,near,endsAt:d.endsAt||now.endsAt}):undefined;return <Pressable key={d.name} disabled={!go} onPress={go} accessibilityRole={go?'button':undefined} accessibilityHint={go?tx('რუკაზე გაჩვენებს ზონას და გზას','Shows the zone and the way on the map'):undefined} accessibilityLabel={[d.name,boxesWord(d.boxes),d.meters!=null?`${approxKm(d.meters)}, ${walkTime(d.meters)}`:''].filter(Boolean).join(', ')} style={{flexDirection:'row',alignItems:'center',gap:10,minHeight:56,paddingVertical:11,borderTopWidth:i?1:0,borderColor:c.bg200}}>
      <View style={{width:30,height:30,borderRadius:10,alignItems:'center',justifyContent:'center',backgroundColor:nearest?teal:hubTint(teal,dark)}}><MapPin size={15} color={nearest?(dark?'#042F2E':'#FFFFFF'):teal} strokeWidth={2.2}/></View>
      <View style={{flex:1,minWidth:0}}>
       <View style={{flexDirection:'row',alignItems:'center',gap:6}}><Copy bold size={14} numberOfLines={1} style={{flexShrink:1}}>{d.name}</Copy>{nearest?<View style={{paddingHorizontal:7,paddingVertical:1,borderRadius:8,backgroundColor:hubTint(teal,dark)}}><Copy bold size={10} style={{color:teal}}>{tx('უახლოესი','nearest')}</Copy></View>:null}</View>
       <View style={{flexDirection:'row',alignItems:'center',gap:8,marginTop:2}}>
        <Copy muted size={12}>{boxesWord(d.boxes)}</Copy>
        {d.endsAt||now.endsAt?<View style={{flex:1,maxWidth:120}}><PlaceTimer startsAt={d.startsAt} endsAt={(d.endsAt||now.endsAt)!} now={tick}/></View>:null}
       </View>
      </View>
      {d.meters!=null?<View style={{alignItems:'flex-end'}}>
       <Copy bold size={14} style={{color:nearest?teal:c.text100,fontVariant:['tabular-nums']}}>{approxKm(d.meters)}</Copy>
       <Copy muted size={11}>{walkTime(d.meters)}</Copy>
      </View>:null}
      {go?<ChevronRight size={16} color={c.text300}/>:null}
     </Pressable>;})}
     {open.length>ROWS?<Pressable accessibilityRole="button" onPress={()=>setAll(v=>!v)} style={{minHeight:44,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:4,borderTopWidth:1,borderColor:c.bg200}}>
      <Copy bold size={12} style={{color:teal}}>{all?tx('ნაკლები','Show less'):tx(`კიდევ ${open.length-ROWS} ადგილი`,`${open.length-ROWS} more places`)}</Copy>
      {all?<ChevronUp size={14} color={teal}/>:<ChevronDown size={14} color={teal}/>}
     </Pressable>:null}
    </View>
    {measured||!here?<Copy muted size={11}>{measured?tx('შეეხე ადგილს — რუკა ზონას და გზას გაჩვენებს. მანძილი მიახლოებითია, ზუსტ ადგილს პულსი გიჩვენებს.','Tap a place — the map shows the zone and the way. Distances are approximate; the pulse shows the exact spot.'):tx('მდებარეობის წვდომით აქ გამოჩნდება, რამდენი კმ-ია თითოეულ ადგილამდე.','With location access you’ll see how far each place is from you.')}</Copy>:null}
   </>:next?<>
    <View style={{flexDirection:'row',alignItems:'center',gap:12}}>
     <Tile icon={Gift}/>
     <View style={{flex:1,minWidth:0}}>
      <Copy bold size={16}>{`${dayWord(next.startsAt)} ${tbilisi(next.startsAt).clock} · ${boxesWord(next.boxes)}`}</Copy>
      <View style={{flexDirection:'row',alignItems:'center',gap:6,marginTop:2}}><Copy muted size={12}>{tx('დაიყრება','Drops in')}</Copy><DropTimer to={next.startsAt} now={tick}/></View>
     </View>
    </View>
    {next.coins?<View style={{flexDirection:'row',alignItems:'center',gap:8}}><Gift size={15} color={teal}/><Copy muted size={12} style={{flex:1}}>{tx(`პირველ გამხსნელს ${coinsText(next.coins)}`,`${coinsText(next.coins)} for the first to open`)}</Copy></View>:null}
    {note?<Copy muted size={12}>{note}</Copy>:null}
   </>:null}
   <View style={{borderTopWidth:1,borderColor:c.bg200,paddingTop:10}}>
    <Copy muted size={12}>{today.opened?tx(`დღეს გაიხსნა ${today.opened}-ჯერ · ${num(today.coins)} ქოინი`,`Opened ${today.opened}× today · ${num(today.coins)} coins`):tx('დღეს ჯერ არავის გაუხსნია — იყავი პირველი.','Nobody has opened one today — be the first.')}{me.coins?<Copy bold size={12} style={{color:teal}}>{tx(` · შენ +${num(me.coins)}`,` · you +${num(me.coins)}`)}</Copy>:null}</Copy>
   </View>
  </Card>
  <ScheduleSheet visible={schedule} onClose={()=>setSchedule(false)} data={data}/>
 </Section>;
}

/** „პირველი იღებს სრულს, მეორე 60%…“ from the server's ladder; the old flat rule when a server sends none. */
export function decayText(decay?:number[]){
 const d=(decay||[]).filter(n=>Number.isFinite(n));
 if(d.length<2||d[0]<=d[d.length-1])return tx('ერთ ყუთს რამდენიმე ადამიანი ხსნის, სანამ მარაგი არ ამოიწურება.','Several people can open one box until it runs out.');
 const ord=(i:number)=>tx(i===1?'მეორე':i===2?'მესამე':`მე-${i+1}`,i===1?'the second':i===2?'the third':`#${i+1}`);
 const parts=d.slice(1,-1).map((p,i)=>tx(`${ord(i+1)} — ${p}%`,`${ord(i+1)} ${p}%`));
 return tx(`ერთ ყუთს რამდენიმე ადამიანი ხსნის: პირველი იღებს სრულ თანხას, ${parts.join(', ')}, შემდეგი — ${d[d.length-1]}%. იჩქარე — ყუთი პირველს ეკუთვნის.`,`Several people open each box: the first gets the full amount, ${parts.join(', ')}, the next ones ${d[d.length-1]}%. Hurry — the box belongs to the first.`);
}
function ScheduleSheet({visible,onClose,data}:{visible:boolean;onClose:()=>void;data:Drops}){
 const c=useThemeColors();
 const period=`${formatYmd(data.campaign.start)} – ${formatYmd(data.campaign.end)}`;
 const city=data.city&&!data.city.campaignCity?data.city.name:null;
 return <Sheet title={tx('ყუთების განრიგი','Box schedule')} visible={visible} onClose={onClose}>
  <Copy muted size={13}>{city?tx(`${city} · ${period}. ყუთები თავისით ჩნდება ქალაქის პარკებში, ყოველდღე სხვა ადგილას. დრო — ადგილობრივი.`,`${city} · ${period}. Boxes appear by themselves in the city’s parks, in a different place every day. Local time.`):tx(`„${data.campaign.name}“ · ${period}. ყუთები თავისით ჩნდება თბილისის პარკებში, ყოველდღე სხვა უბნებში.`,`„${data.campaign.name}“ · ${period}. Boxes appear by themselves in Tbilisi parks, in different districts every day.`)}</Copy>
  <Card style={{paddingVertical:4,gap:0}}>
   {data.schedule.map((row,i)=><View key={row.id} style={{flexDirection:'row',alignItems:'center',gap:12,minHeight:60,paddingVertical:10,borderTopWidth:i?1:0,borderColor:c.bg200}}>
    <View style={{flex:1,minWidth:0}}><Copy bold size={14}>{row.label}</Copy><Copy muted size={12}>{coinsText(row.coins)} {tx('პირველ გამხსნელს','for the first opener')}</Copy></View>
    <Copy bold size={14} style={{color:c.primary100,fontVariant:['tabular-nums']}}>{row.times}</Copy>
   </View>)}
  </Card>
  <Card style={{gap:8}}>
   <Copy bold size={14}>{tx('როგორ იხსნება ყუთი','How a box opens')}</Copy>
   <Copy muted size={12}>{tx('1. დაიწყე გასეირნება MEDIRUN-ში. 2. ყუთიდან 250–350 მ-ზე პულსი ჩაგერთვება — რაც ახლოს ხარ, მით ჩქარია. 3. 20–25 მ-ზე გამოჩნდება „შეეხე და გახსენი“ — გახსენი და ქოინები მაშინვე ჩაგერიცხება.','1. Start a walk in MEDIRUN. 2. 250–350 m from a box a pulse starts — the closer you are, the faster it beats. 3. At 20–25 m “Tap to open” appears — open it and the coins land at once.')}</Copy>
   <Copy muted size={12}>{decayText(data.economy?.decay)}</Copy>
   <Copy muted size={12}>{tx('ქოინებს MEDIQUEST-ის მაღაზიაში ცვლი სასაჩუქრე ბარათებსა და გაჯეტებზე.','You swap the coins for gift cards and gadgets in the MEDIQUEST store.')}</Copy>
  </Card>
  {city?null:<Pressable accessibilityRole="link" onPress={()=>void Linking.openURL(data.campaign.rulesUrl)} style={{minHeight:44,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:6}}>
   <Copy bold size={13} style={{color:c.primary100}}>{tx('კამპანიის წესები','Campaign rules')}</Copy><ChevronRight size={14} color={c.primary100}/>
  </Pressable>}
 </Sheet>;
}
