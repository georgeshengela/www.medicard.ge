import React from 'react';
import {Pressable,View} from 'react-native';
import {useRouter} from 'expo-router';
import {ChevronRight,Gift,RefreshCw,Sparkles,Store,Trophy} from 'lucide-react-native';
import {Bone} from '@/components/ui/Skeleton';
import {QuestCoinMark} from '@/components/quest/QuestIcon';
import {questDate} from '@/components/quest/store/QuestStoreKit';
import {useFeatureState,isFeatureOn} from '@/lib/featureFlags';
import {useRunWallet,type WalletRow} from '@/lib/medipulsi/wallet';
import {tx} from '@/i18n/locale';
import {useIsDark,useThemeColors} from '@/theme/colors';
import {hubTint} from '@/theme/hub';
import {Card,Copy,Section,runInk} from './PulseUi';
import {num} from './RunDrops';
import {shortDay} from '@/lib/medipulsi/leaderboard';

const AMBER_LIGHT='#B45309',AMBER_DARK='#FCD34D';
const clock=(iso:string)=>{const d=new Date(iso);return Number.isFinite(d.getTime())?`${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`:'';};
const ordinal=(n:number)=>tx(n===1?'პირველი':`მე-${n}`,n===1?'first':`#${n}`);

/** What a movement was, in words: the box's park (and the opener's place) or the weekly prize's board. */
export function rowTitle(row:WalletRow){
 if(row.kind==='prize')return tx(`კვირის პრიზი · ${row.board==='meters'?'მანძილი':'ყუთები'}`,`Weekly prize · ${row.board==='meters'?'distance':'boxes'}`);
 if(row.kind==='grand')return tx('დიდი საჩუქარი','Grand prize');
 const where=row.place||row.district||row.city;
 return where?tx(`ყუთი · ${where}`,`Box · ${where}`):tx('ყუთი','Box');
}
export function rowDetail(row:WalletRow){
 const when=`${questDate(row.createdAt)} · ${clock(row.createdAt)}`;
 if(row.kind==='prize'&&row.rank)return `${when} · ${['🥇','🥈','🥉'][row.rank-1]||`#${row.rank}`}`;
 if(row.kind==='box'&&row.rank)return `${when} · ${row.rank===1?tx('პირველი აღმომჩენი','first finder'):tx(`${ordinal(row.rank)} გამხსნელი`,`opener ${ordinal(row.rank)}`)}`;
 return when;
}

/**
 * Medi Coins on the MEDIRUN hub (owner 2026-10-04): the balance the boxes feed, this season's earnings in three
 * numbers, and the last movements — when, where and how much. The full history stays on the MEDIQUEST wallet.
 */
export function RunWallet(){
 const router=useRouter(),c=useThemeColors(),dark=useIsDark(),teal=runInk('teal',dark),amber=dark?AMBER_DARK:AMBER_LIGHT,flags=useFeatureState();
 const query=useRunWallet(),data=query.data;
 const balance=query.liveBalance??data?.balance??null,failed=query.isError&&!data;
 const storeOn=isFeatureOn('quest',flags)&&isFeatureOn('rewardsStore',flags);
 const rows=(data?.rows||[]).slice(0,5);
 const toWallet=()=>router.push('/medi-quest/wallet' as never),toStore=()=>router.push('/medi-quest/rewards' as never);
 return <Section title="Medi Coins" link={tx('ყველა ისტორია','Full history')} onLink={toWallet}>
  <View style={{gap:12}}>
  <Card style={{gap:14}}>
   <View style={{flexDirection:'row',alignItems:'center',gap:12}}>
    <View style={{width:46,height:46,borderRadius:15,backgroundColor:hubTint(amber,dark),alignItems:'center',justifyContent:'center'}}><QuestCoinMark size={26}/></View>
    <View style={{flex:1,minWidth:0}}>
     <Copy muted size={12}>{tx('ბალანსი','Balance')}</Copy>
     {balance==null?<Bone height={30} width={120} radius={8}/>:<Copy bold size={28} style={{lineHeight:34,fontVariant:['tabular-nums']}}>{num(balance)}</Copy>}
    </View>
    {storeOn?<Pressable accessibilityRole="button" accessibilityLabel={tx('მაღაზია','Store')} onPress={toStore} style={{minHeight:40,paddingHorizontal:14,borderRadius:14,backgroundColor:hubTint(teal,dark),flexDirection:'row',alignItems:'center',gap:6}}><Store size={15} color={teal}/><Copy bold size={12} style={{color:teal}}>{tx('მაღაზია','Store')}</Copy></Pressable>:null}
   </View>
   {data?<Copy muted size={11} style={{marginBottom:-6}}>{tx(`სეზონი · ${shortDay(data.season.start)} – ${shortDay(data.season.end)}`,`Season · ${shortDay(data.season.start)} – ${shortDay(data.season.end)}`)}</Copy>:null}
   <View style={{flexDirection:'row',gap:8}}>
    {[
     {label:tx('ქოინი','Coins'),value:data?`+${num(data.season.earned)}`:'—',tone:teal},
     {label:tx('ყუთი','Boxes'),value:data?num(data.season.boxes):'—',tone:c.text100},
     {label:tx('პირველი','First finds'),value:data?num(data.season.firsts):'—',tone:amber},
    ].map(stat=><View key={stat.label} style={{flex:1,borderRadius:14,paddingVertical:10,paddingHorizontal:10,backgroundColor:c.bg200}}><Copy bold size={16} style={{color:stat.tone,fontVariant:['tabular-nums']}}>{stat.value}</Copy><Copy muted size={11} numberOfLines={1}>{stat.label}</Copy></View>)}
   </View>
  </Card>
  {query.isLoading&&!data?<Card style={{gap:10}}>{[0,1,2].map(i=><Bone key={i} height={44} radius={12}/>)}</Card>
  :failed?<Card style={{gap:10}}><Copy bold size={14}>{tx('ისტორია ვერ ჩაიტვირთა','Couldn’t load your history')}</Copy><Copy muted size={12}>{tx('შეამოწმე ინტერნეტი და სცადე ხელახლა.','Check your connection and try again.')}</Copy><Pressable accessibilityRole="button" onPress={()=>void query.refetch()} style={{alignSelf:'flex-start',minHeight:40,paddingHorizontal:14,borderRadius:14,backgroundColor:hubTint(teal,dark),flexDirection:'row',alignItems:'center',gap:6}}><RefreshCw size={14} color={teal}/><Copy bold size={12} style={{color:teal}}>{tx('ხელახლა ცდა','Try again')}</Copy></Pressable></Card>
  :!rows.length?<Card><Copy muted size={13}>{tx('ყუთი ჯერ არ გაგიხსნია. პირველივე გახსნის ქოინები აქ გამოჩნდება — როდის, სად და რამდენი.','No box opened yet. The coins from your first opening show up here — when, where and how much.')}</Copy></Card>
  :<Card style={{paddingVertical:6,gap:0}}>
   {rows.map((row,i)=>{
    const Icon=row.kind==='prize'?Trophy:row.kind==='grand'?Sparkles:Gift,ink=row.kind==='box'?teal:amber;
    return <View key={row.id} style={{flexDirection:'row',alignItems:'center',gap:12,minHeight:58,paddingVertical:10,borderTopWidth:i?1:0,borderColor:c.bg200}}>
     <View style={{width:38,height:38,borderRadius:12,backgroundColor:hubTint(ink,dark),alignItems:'center',justifyContent:'center'}}><Icon size={18} color={ink} strokeWidth={1.9}/></View>
     <View style={{flex:1,minWidth:0}}><Copy bold size={13} numberOfLines={1}>{rowTitle(row)}</Copy><Copy muted size={11} numberOfLines={1}>{rowDetail(row)}</Copy></View>
     <Copy bold size={15} style={{color:row.amount>0?teal:c.text200,fontVariant:['tabular-nums']}}>{row.amount>0?'+':'−'}{num(Math.abs(row.amount))}</Copy>
    </View>;
   })}
   {(data?.rows.length||0)>rows.length?<Pressable accessibilityRole="button" onPress={toWallet} style={{minHeight:44,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:6,borderTopWidth:1,borderColor:c.bg200}}><Copy bold size={13} style={{color:teal}}>{tx('ყველა მოძრაობა','All movements')}</Copy><ChevronRight size={14} color={teal}/></Pressable>:null}
  </Card>}
  </View>
 </Section>;
}
