import React from 'react';
import {Pressable,View} from 'react-native';
import {ChevronRight,Timer} from 'lucide-react-native';
import {Bone} from '@/components/ui/Skeleton';
import {QuestCoinMark} from '@/components/quest/QuestIcon';
import {useDrops} from '@/lib/medipulsi/drops';
import {leaderboardWindow,shortDay,useLeaderboard} from '@/lib/medipulsi/leaderboard';
import {tx} from '@/i18n/locale';
import {useIsDark,useThemeColors} from '@/theme/colors';
import {hubTint} from '@/theme/hub';
import {ArtTile,Card,Copy,Section,runInk} from './PulseUi';
import {RUN_ICON} from './runArt';
import {num,useCountdown} from './RunDrops';

const MEDALS=['#F59E0B','#94A3B8','#B45309'];
const MEDAL_WORDS=['🥇','🥈','🥉'];

/**
 * „კვირის რბოლა“ on the MEDIRUN hub (owner 2026-10-05: the leaderboard sat at the very bottom as a small tile and
 * looked broken when this week had nothing yet). Box hunters this Tbilisi week — your place or what puts you on
 * the list, the Monday prizes with their countdown, the top three — and the dates, so the reset is never a
 * mystery. Tapping opens the full list.
 */
export function RunRaceCard({optedIn,onOpen}:{optedIn:boolean;onOpen:()=>void}){
 const c=useThemeColors(),dark=useIsDark(),violet=runInk('violet',dark),teal=runInk('teal',dark);
 const lb=useLeaderboard('week','boxes'),drops=useDrops();
 const data=lb.data,me=data?.me||null,rows=(data?.rows||[]).slice(0,3),prizes=data?.prizes||null;
 const left=useCountdown(prizes?.endsAt);
 const w=leaderboardWindow('week',drops.data?.campaign);
 if(lb.isError&&!data)return null;
 const range=`${shortDay(w.from)} – ${shortDay(w.to)}`;
 const ranked=Boolean(me?.rank);
 const mineAt=me?.listed&&me.rank?me.rank-1:-1;
 const headline=ranked
  ?tx(`შენ ხარ #${me!.rank}`,`You’re #${me!.rank}`)
  :tx('ამ კვირაში ჯერ ყუთი არ გაგიხსნია','No box opened this week yet');
 const detail=ranked
  ?tx(`${num(me!.coins)} ქოინი · ${me!.boxes} ყუთი${me!.firsts?` · ${me!.firsts}-ჯერ პირველი`:''}`,`${num(me!.coins)} coins · ${me!.boxes} ${me!.boxes===1?'box':'boxes'}${me!.firsts?` · first ${me!.firsts}×`:''}`)
  :tx('კვირა ორშაბათს 00:00-ზე თავიდან იწყება. პირველივე გახსნა სიაში ჩაგსვამს.','The week restarts Monday 00:00. Your first opening puts you on the list.');
 const pad=(n:number)=>String(n).padStart(2,'0');
 const countdown=left.d>0?tx(`${left.d} დღე ${left.h} სთ`,`${left.d}d ${left.h}h`):tx(`${pad(left.h)}:${pad(left.m)}`,`${pad(left.h)}:${pad(left.m)}`);

 return <Section title={tx('კვირის რბოლა','This week’s race')} link={tx('სრული სია','Full list')} onLink={onOpen}>
  <Pressable accessibilityRole="button" accessibilityLabel={`${tx('კვირის რბოლა','This week’s race')}, ${range}. ${headline}. ${detail}`} onPress={onOpen}>
   <Card style={{gap:14}}>
    <View style={{flexDirection:'row',alignItems:'center',gap:12}}>
     <ArtTile source={RUN_ICON.trophy} ink="violet" size={44}/>
     <View style={{flex:1,minWidth:0}}>
      <Copy bold size={13} numberOfLines={1} style={{fontVariant:['tabular-nums']}}>{range}</Copy>
      <Copy muted size={11} numberOfLines={1}>{tx('ყუთების სია','Boxes list')}</Copy>
     </View>
     {prizes?<View accessibilityLabel={tx(`პრიზებამდე ${countdown}`,`${countdown} to the prizes`)} style={{flexDirection:'row',alignItems:'center',gap:5,paddingHorizontal:9,paddingVertical:5,borderRadius:11,backgroundColor:hubTint(violet,dark)}}>
      <Timer size={12} color={violet}/><Copy bold size={11} style={{color:violet,fontVariant:['tabular-nums']}}>{countdown}</Copy>
     </View>:<ChevronRight size={18} color={c.text300}/>}
    </View>
    <View style={{gap:3}}>
     {!data?<Bone height={24} width={180} radius={8}/>
      :<Copy bold size={ranked?26:17} style={{lineHeight:ranked?32:24,color:ranked?violet:c.text100,fontVariant:['tabular-nums']}}>{headline}</Copy>}
     {data?<Copy muted size={12}>{detail}</Copy>:null}
    </View>

    {prizes?<View style={{flexDirection:'row',gap:8}}>
     {prizes.coins.slice(0,3).map((n,i)=><View key={i} style={{flex:1,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:5,paddingVertical:9,borderRadius:14,backgroundColor:c.bg200}}>
      <Copy size={13}>{MEDAL_WORDS[i]}</Copy><QuestCoinMark size={13}/><Copy bold size={13} style={{fontVariant:['tabular-nums']}}>{num(n)}</Copy>
     </View>)}
    </View>:null}

    {rows.length?<View style={{borderTopWidth:1,borderColor:c.bg200,paddingTop:4}}>
     {rows.map((row,i)=><View key={i} style={{flexDirection:'row',alignItems:'center',gap:10,paddingVertical:8}}>
      <View style={{width:24,height:24,borderRadius:12,alignItems:'center',justifyContent:'center',backgroundColor:MEDALS[i]+'26'}}><Copy bold size={11} style={{color:MEDALS[i]}}>{i+1}</Copy></View>
      <Copy bold size={13} numberOfLines={1} style={{flex:1,color:i===mineAt?violet:c.text100}}>{row.handle}{i===mineAt?tx(' · შენ',' · you'):''}</Copy>
      <Copy muted size={11}>{tx(`${row.boxes||0} ყუთი`,`${row.boxes||0} ${(row.boxes||0)===1?'box':'boxes'}`)}</Copy>
      <Copy bold size={13} style={{color:teal,fontVariant:['tabular-nums'],minWidth:48,textAlign:'right'}}>{num(row.coins||0)}</Copy>
     </View>)}
    </View>
    :data?<Copy muted size={12} style={{borderTopWidth:1,borderColor:c.bg200,paddingTop:12}}>{tx('ამ კვირის სიაში ჯერ არავინაა — ახლა დაწყება ნიშნავს პირველ ადგილს.','Nobody is on this week’s list yet — starting now means first place.')}</Copy>:null}

    {data&&!optedIn?<Copy bold size={12} style={{color:violet}}>{tx('შენ სიაში არ ჩანხარ — შეეხე და ჩაერთე, რომ პრიზი მიიღო.','You’re not shown on the list — tap to join and win a prize.')}</Copy>:null}
   </Card>
  </Pressable>
 </Section>;
}
