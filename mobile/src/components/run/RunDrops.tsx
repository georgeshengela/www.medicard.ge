import React,{useEffect,useState} from 'react';
import {Linking,Pressable,View} from 'react-native';
import {CalendarClock,ChevronRight,Gift,MapPin,Sparkles} from 'lucide-react-native';
import {useThemeColors} from '@/theme/colors';
import {formatYmd} from '@/lib/format';
import {countdownParts,useDrops,type CoinRange,type Drops} from '@/lib/medipulsi/drops';
import {tx} from '@/i18n/locale';
import {Card,Copy,Sheet} from './PulseUi';

/** Colours on the dark teal hero (the panel lives inside it). */
const ON={text:'#FFFFFF',muted:'#C5DADA',accent:'#99F6E4',chip:'rgba(255,255,255,0.08)',line:'rgba(255,255,255,0.10)',panel:'rgba(255,255,255,0.06)',live:'#34D399'};
const TBILISI_MS=4*3600_000;
const num=(n:number)=>Math.round(n).toLocaleString('en-US').replace(/,/g,' ');
/** Clock and day of an instant in Tbilisi time, whatever the phone's zone. */
const tbilisi=(iso:string)=>{const t=new Date(Date.parse(iso)+TBILISI_MS).toISOString();return {ymd:t.slice(0,10),clock:t.slice(11,16)};};
function dayWord(iso:string,now:number){
 const at=tbilisi(iso).ymd,today=tbilisi(new Date(now).toISOString()).ymd,tomorrow=tbilisi(new Date(now+86400_000).toISOString()).ymd;
 return at===today?tx('დღეს','today'):at===tomorrow?tx('ხვალ','tomorrow'):formatYmd(at);
}
export const coinsText=(c:CoinRange)=>!c?'':c.min===c.max?`${num(c.min)} Medi Coins`:`${num(c.min)}–${num(c.max)} Medi Coins`;
const boxWord=(n:number)=>tx(`${n} ყუთი`,`${n} ${n===1?'box':'boxes'}`);

function Countdown({to,onDone}:{to:string;onDone:()=>void}){
 const [now,setNow]=useState(Date.now());
 const left=Date.parse(to)-now;
 useEffect(()=>{const t=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(t);},[]);
 useEffect(()=>{if(left<=0)onDone();},[left<=0]);// eslint-disable-line react-hooks/exhaustive-deps
 const {d,h,m,s}=countdownParts(left),pad=(n:number)=>String(n).padStart(2,'0');
 const cells=d>0?[[d,tx('დღე','d')],[h,tx('სთ','h')],[m,tx('წთ','m')]]:[[h,tx('სთ','h')],[m,tx('წთ','m')],[s,tx('წმ','s')]];
 return <View accessible accessibilityLabel={tx(`დარჩა ${d?d+' დღე ':''}${h} საათი ${m} წუთი`,`${d?d+' days ':''}${h} hours ${m} minutes left`)} style={{flexDirection:'row',gap:8}}>
  {cells.map(([v,u],i)=><View key={i} style={{minWidth:62,paddingVertical:8,paddingHorizontal:8,borderRadius:14,backgroundColor:ON.chip,alignItems:'center'}}>
   <Copy bold size={26} style={{color:ON.text,lineHeight:32,fontVariant:['tabular-nums']}}>{pad(Number(v))}</Copy>
   <Copy size={10} style={{color:ON.muted,lineHeight:14}}>{u}</Copy>
  </View>)}
 </View>;
}

function nextNote(next:NonNullable<Drops['next']>){
 if(next.kind==='saturday')return tx('ქოინების წვიმა ერთ პარკში. პარკს 15:00-სა და 15:30-ზე Instagram-ისა და Facebook-ის სთორიში გამოცანით გავამხელთ.','A coin rain in one park. We reveal the park with a riddle in our Instagram and Facebook stories at 15:00 and 15:30.');
 if(next.kind==='lantern')return tx('ფარნის ყუთები — მხოლოდ მათთვის, ვისაც თბილისის 0,25% აქვს განათებული.','Lantern boxes — only for players who have lit 0.25% of Tbilisi.');
 if(next.kind==='evening')return tx('საღამოს ყუთები განათებულ ბილიკებზე დგება.','Evening boxes sit on lit paths.');
 return tx('ყუთები პარკების სიღრმეში, საფეხმავლო ბილიკებზე დგება.','Boxes sit deep inside parks, on footpaths.');
}

/**
 * „ყუთები ახლა“ inside the MEDIRUN hero (owner 2026-10-04): how many boxes are out this minute and in which
 * districts, or a countdown to the next ones, what one box gives, and today's openings — the reason to go out now.
 */
export function RunDrops(){
 const query=useDrops(),data=query.data,[schedule,setSchedule]=useState(false);
 if(!data){
  if(query.isError&&(query.error as {status?:number}|null)?.status===404)return null;
  if(query.isError)return <Panel><Pressable accessibilityRole="button" onPress={()=>void query.refetch()} style={{minHeight:44,flexDirection:'row',alignItems:'center',gap:8}}><Gift size={16} color={ON.accent}/><Copy size={12} style={{flex:1,color:ON.muted}}>{tx('ყუთების სტატუსი ვერ ჩაიტვირთა.','Couldn’t load the boxes.')}</Copy><Copy bold size={12} style={{color:ON.accent}}>{tx('ხელახლა ცდა','Try again')}</Copy></Pressable></Panel>;
  return <Panel><View style={{height:18,width:120,borderRadius:6,backgroundColor:ON.chip}}/><View style={{height:44,width:180,borderRadius:10,backgroundColor:ON.chip}}/><View style={{height:14,borderRadius:6,backgroundColor:ON.chip}}/></Panel>;
 }
 if(!data.enabled)return <Panel><Copy bold size={13} style={{color:ON.text}}>{tx('ყუთები დროებით შეჩერებულია','Boxes are paused for now')}</Copy><Copy size={12} style={{color:ON.muted}}>{tx('გასეირნება და ქალაქის განათება ჩვეულებრივ მუშაობს.','Walks and lighting up the city work as usual.')}</Copy></Panel>;
 const {now,next,today,me,campaign}=data,live=now.boxes>0;
 if(!live&&!next&&campaign.status==='ended')return null;
 return <Panel>
  {live?<>
   <View style={{flexDirection:'row',alignItems:'center',gap:8}}>
    <View style={{width:8,height:8,borderRadius:4,backgroundColor:ON.live}}/>
    <Copy bold size={12} style={{flex:1,color:ON.accent}}>{tx('ახლა ქალაქშია','Out in the city now')}</Copy>
    {now.endsAt?<Copy size={11} style={{color:ON.muted}}>{tx(`${tbilisi(now.endsAt).clock}-მდე`,`until ${tbilisi(now.endsAt).clock}`)}</Copy>:null}
   </View>
   <View style={{flexDirection:'row',alignItems:'flex-end',gap:10}}>
    <Copy bold size={46} style={{color:ON.text,lineHeight:52,letterSpacing:-1.5,fontVariant:['tabular-nums']}}>{now.boxes}</Copy>
    <View style={{flex:1,paddingBottom:6}}>
     <Copy bold size={15} style={{color:ON.text,lineHeight:20}}>{tx('ყუთი',now.boxes===1?'box':'boxes')}</Copy>
     <Copy size={11} style={{color:ON.muted,lineHeight:16}}>{tx(`კიდევ ${now.openingsLeft}-ჯერ გაიხსნება`,`${now.openingsLeft} openings left`)}</Copy>
    </View>
   </View>
   {now.coins?<View style={{flexDirection:'row',alignItems:'center',gap:8}}><Gift size={15} color={ON.accent}/><Copy size={12} style={{flex:1,color:ON.text}}>{tx(`თითოში ${coinsText(now.coins)} — მაშინვე შენს ბალანსზე`,`${coinsText(now.coins)} in each — straight to your balance`)}</Copy></View>:null}
   {now.districts.length?<View style={{flexDirection:'row',flexWrap:'wrap',gap:6}}>
    {now.districts.slice(0,8).map(d=><View key={d.name} style={{flexDirection:'row',alignItems:'center',gap:5,paddingHorizontal:10,paddingVertical:5,borderRadius:10,backgroundColor:ON.chip}}><MapPin size={11} color={ON.accent}/><Copy size={11} style={{color:ON.text}}>{d.name}</Copy><Copy bold size={11} style={{color:ON.accent}}>{d.boxes}</Copy></View>)}
   </View>:null}
   {now.lanternBoxes?<Copy size={11} style={{color:ON.muted}}>{tx(`მათ შორის ${now.lanternBoxes} ფარნის ყუთია — ჩანს თბილისის 0,25%-დან.`,`${now.lanternBoxes} of them are lantern boxes — visible from 0.25% of Tbilisi.`)}</Copy>:null}
   <Copy size={11} style={{color:ON.muted}}>{tx('ზუსტი ადგილი არ ჩანს: ყუთიდან რამდენიმე ასეულ მეტრზე პულსი ჩაგერთვება და ახლოს ჩქარდება.','The exact spot is hidden: a few hundred metres away a pulse starts and speeds up as you get closer.')}</Copy>
  </>:next?<>
   <View style={{flexDirection:'row',alignItems:'center',gap:8}}>
    <CalendarClock size={15} color={ON.accent}/>
    <Copy bold size={12} style={{flex:1,color:ON.accent}}>{campaign.status==='upcoming'?tx(`„${campaign.name}“ იწყება`,`„${campaign.name}“ starts`):next.kind==='saturday'?tx('შაბათის ქოინების წვიმა','Saturday coin rain'):tx('შემდეგი ყუთები','Next boxes')}</Copy>
    <Copy size={11} style={{color:ON.muted}}>{dayWord(next.startsAt,Date.now())}, {tbilisi(next.startsAt).clock}</Copy>
   </View>
   <Countdown to={next.startsAt} onDone={()=>void query.refetch()}/>
   <View style={{flexDirection:'row',alignItems:'center',gap:8}}><Gift size={15} color={ON.accent}/><Copy size={12} style={{flex:1,color:ON.text}}>{boxWord(next.boxes)}{next.coins?tx(` · თითოში ${coinsText(next.coins)}`,` · ${coinsText(next.coins)} each`):''}</Copy></View>
   <Copy size={11} style={{color:ON.muted}}>{nextNote(next)}</Copy>
  </>:<Copy size={12} style={{color:ON.muted}}>{tx('ახლა ყუთი არ არის. ახლები მალე გამოჩნდება.','No boxes right now. New ones appear soon.')}</Copy>}

  <View style={{flexDirection:'row',alignItems:'center',gap:10,borderTopWidth:1,borderColor:ON.line,paddingTop:10}}>
   <Sparkles size={14} color={ON.accent}/>
   <Copy size={11} numberOfLines={2} style={{flex:1,color:ON.muted}}>
    {today.opened?tx(`დღეს გაიხსნა ${today.opened}-ჯერ · გაიცა ${num(today.coins)} ქოინი`,`Opened ${today.opened} ${today.opened===1?'time':'times'} today · ${num(today.coins)} coins given`):tx('დღეს ჯერ არავის გაუხსნია — იყავი პირველი.','Nobody has opened one today yet — be the first.')}
    {me.coins?<Copy bold size={11} style={{color:ON.accent}}>{tx(` · შენ +${num(me.coins)}`,` · you +${num(me.coins)}`)}</Copy>:null}
   </Copy>
   <Pressable accessibilityRole="button" accessibilityLabel={tx('ყუთების განრიგი','Box schedule')} onPress={()=>setSchedule(true)} hitSlop={8} style={{minHeight:32,flexDirection:'row',alignItems:'center',gap:2}}>
    <Copy bold size={11} style={{color:ON.accent}}>{tx('განრიგი','Schedule')}</Copy><ChevronRight size={13} color={ON.accent}/>
   </Pressable>
  </View>
  <ScheduleSheet visible={schedule} onClose={()=>setSchedule(false)} data={data}/>
 </Panel>;
}

function Panel({children}:{children:React.ReactNode}){
 return <View style={{borderRadius:18,backgroundColor:ON.panel,padding:14,gap:10}}>{children}</View>;
}

function ScheduleSheet({visible,onClose,data}:{visible:boolean;onClose:()=>void;data:Drops}){
 const c=useThemeColors();
 const period=`${formatYmd(data.campaign.start)} – ${formatYmd(data.campaign.end)}`;
 return <Sheet title={tx('ყუთების განრიგი','Box schedule')} visible={visible} onClose={onClose}>
  <Copy muted size={13}>{tx(`„${data.campaign.name}“ · ${period}. ყუთები თავისით ჩნდება თბილისის პარკებში, ყოველდღე სხვა უბნებში.`,`„${data.campaign.name}“ · ${period}. Boxes appear by themselves in Tbilisi parks, in different districts every day.`)}</Copy>
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
  <Pressable accessibilityRole="link" onPress={()=>void Linking.openURL(data.campaign.rulesUrl)} style={{minHeight:44,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:6}}>
   <Copy bold size={13} style={{color:c.primary100}}>{tx('კამპანიის წესები','Campaign rules')}</Copy><ChevronRight size={14} color={c.primary100}/>
  </Pressable>
 </Sheet>;
}

