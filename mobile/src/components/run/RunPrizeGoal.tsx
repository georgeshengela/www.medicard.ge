import React,{useEffect,useMemo,useState} from 'react';
import {Image,Pressable,ScrollView,View} from 'react-native';
import {useRouter} from 'expo-router';
import {Check,ChevronRight,Target} from 'lucide-react-native';
import {useAccountQuery} from '@/hooks/useAccountQuery';
import {useDrops} from '@/lib/medipulsi/drops';
import {FRESH} from '@/lib/queryClient';
import {REWARDS_CATALOG_KEY,rewardsApi,type StoreCatalog,type StoreReward} from '@/lib/quest/rewardsApi';
import {getMediCoinBalanceHint,subscribeMediCoinBalance} from '@/lib/quest/cache';
import {getScopedPreference,setScopedPreference} from '@/lib/localAccount';
import {useFeatureState,isFeatureOn} from '@/lib/featureFlags';
import {rewardArt} from '@/components/quest/questArt';
import {QuestCoinMark} from '@/components/quest/QuestIcon';
import {rewardTitle} from '@/i18n/quest/rewards.js';
import {appLang,tx} from '@/i18n/locale';
import {useIsDark,useThemeColors} from '@/theme/colors';
import {HUB,hubTint} from '@/theme/hub';
import {Action,Bar,Card,Copy,RUN_TEAL,Section,runInk} from './PulseUi';
import {Bone} from '@/components/ui/Skeleton';

const GOAL_KEY='medirun.prizeGoal';
const num=(n:number)=>Math.max(0,Math.round(n)).toLocaleString('en-US').replace(/,/g,' ');
const soldOut=(r:StoreReward)=>r.inventoryState==='OUT_OF_STOCK'||r.inventoryState==='SOLD_OUT';

function Stage({reward,size}:{reward:StoreReward;size:number}){
 const dark=useIsDark(),photo=Boolean(reward.imageUrl);
 return <View style={{width:size,height:size,borderRadius:16,backgroundColor:hubTint(runInk('teal',dark),dark),alignItems:'center',justifyContent:'center',overflow:'hidden'}}>
  <Image source={rewardArt(reward)} accessibilityIgnoresInvertColors resizeMode="contain" style={{width:size*(photo?.86:.6),height:size*(photo?.86:.6)}}/>
 </View>;
}

/**
 * „შენი მიზანი“ on the MEDIRUN hub (owner 2026-10-04): the boxes pay Medi Coins, so the hub shows the store too —
 * pick the prize you are walking for and always see how many coins are still missing. The choice lives on this
 * device per account; redeeming stays on the MEDIQUEST store page.
 */
export function RunPrizeGoal(){
 const router=useRouter(),c=useThemeColors(),dark=useIsDark(),teal=runInk('teal',dark),flags=useFeatureState();
 const storeOn=isFeatureOn('quest',flags)&&isFeatureOn('rewardsStore',flags);
 const query=useAccountQuery<StoreCatalog>({key:[...REWARDS_CATALOG_KEY],fetch:()=>rewardsApi.catalog(),staleTime:FRESH.LONG,enabled:storeOn});
 const [live,setLive]=useState<number|null>(()=>getMediCoinBalanceHint());
 const [goalId,setGoalId]=useState<string|null>(null);
 useEffect(()=>subscribeMediCoinBalance(v=>{if(v==null)void query.refetch();setLive(v);}),[query.refetch]);// eslint-disable-line react-hooks/exhaustive-deps
 useEffect(()=>{let alive=true;void getScopedPreference(GOAL_KEY).then(v=>{if(alive)setGoalId(v||null);}).catch(()=>{});return()=>{alive=false;};},[]);
 const items=useMemo(()=>{
  const seen=new Set<string>();
  const all=[...(query.data?.featured||[]),...(query.data?.available||[])].filter(r=>!seen.has(r.id)&&seen.add(r.id)&&!soldOut(r)&&r.coinCost>0);
  // People walk for gift cards and gadgets; app styles stay in the store.
  const prizes=all.filter(r=>r.type==='PHYSICAL_PRIZE');
  return (prizes.length?prizes:all).sort((a,b)=>a.coinCost-b.coinCost);
 },[query.data]);
 if(!storeOn)return null;
 const balance=live??query.data?.balance.coins??0;
 const goal=items.find(r=>r.id===goalId)||null;
 const choose=(r:StoreReward)=>{
  if(r.id===goalId){router.push(`/medi-quest/rewards/${r.id}` as never);return;}
  setGoalId(r.id);void setScopedPreference(GOAL_KEY,r.id).catch(()=>{});
 };
 const open=(r:StoreReward)=>router.push(`/medi-quest/rewards/${r.id}` as never);
 const title=(r:StoreReward)=>rewardTitle(r.titleKey,appLang());

 return <Section title={tx('შენი მიზანი','Your goal')} link={tx('მაღაზია','Store')} onLink={()=>router.push('/medi-quest/rewards' as never)}>
  <Card style={{gap:14}}>
   {!query.data?(query.isError
    ?<View style={{gap:8}}><Copy bold size={15}>{tx('მაღაზია ვერ ჩაიტვირთა','Couldn’t load the store')}</Copy><Action secondary label={tx('ხელახლა ცდა','Try again')} onPress={()=>void query.refetch()}/></View>
    :<View style={{flexDirection:'row',gap:14,alignItems:'center'}}><Bone width={76} height={76} radius={16}/><View style={{flex:1,gap:8}}><Bone width={140} height={14}/><Bone height={8}/><Bone width={100} height={12}/></View></View>)
   :goal?<GoalBody goal={goal} balance={balance} title={title(goal)} onOpen={()=>open(goal)}/>
   :<View style={{flexDirection:'row',gap:12,alignItems:'center'}}>
     <View style={{width:52,height:52,borderRadius:HUB.tileRadius,backgroundColor:hubTint(teal,dark),alignItems:'center',justifyContent:'center'}}><Target size={24} color={teal}/></View>
     <View style={{flex:1,gap:3}}>
      <Copy bold size={15}>{tx('აირჩიე, რისთვის აგროვებ','Pick what you’re saving for')}</Copy>
      <Copy muted size={12}>{tx(`ყუთების ქოინები ბალანსზე მაშინვე ჯდება. ახლა გაქვს ${num(balance)} ქოინი.`,`Box coins land on your balance at once. You have ${num(balance)} coins now.`)}</Copy>
     </View>
    </View>}

   {items.length?<View style={{gap:8,borderTopWidth:1,borderColor:c.bg200,paddingTop:12,marginHorizontal:-HUB.cardPad}}>
    <Copy muted size={11} style={{paddingHorizontal:HUB.cardPad}}>{goal?tx('სხვა მიზანი? შეეხე საჩუქარს.','Another goal? Tap a prize.'):tx('შეეხე საჩუქარს — მიზნად დავაყენებთ.','Tap a prize to set it as your goal.')}</Copy>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:10,paddingHorizontal:HUB.cardPad}}>
     {items.slice(0,12).map(r=>{const on=r.id===goal?.id,pct=Math.min(100,balance/r.coinCost*100);return <Pressable key={r.id} accessibilityRole="button" accessibilityState={{selected:on}} accessibilityLabel={tx(`${title(r)}, ${num(r.coinCost)} ქოინი${on?', შენი მიზანი':''}`,`${title(r)}, ${num(r.coinCost)} coins${on?', your goal':''}`)} onPress={()=>choose(r)} style={{width:118,gap:6,padding:8,borderRadius:18,borderWidth:2,borderColor:on?teal:'transparent',backgroundColor:on?hubTint(teal,dark):c.bg100}}>
      <View><Stage reward={r} size={98}/>{on?<View style={{position:'absolute',top:6,right:6,width:22,height:22,borderRadius:11,backgroundColor:RUN_TEAL,alignItems:'center',justifyContent:'center'}}><Check size={13} color="#fff" strokeWidth={3}/></View>:null}</View>
      <Copy bold size={12} numberOfLines={2} style={{minHeight:36,lineHeight:18}}>{title(r)}</Copy>
      <View style={{flexDirection:'row',alignItems:'center',gap:4}}><QuestCoinMark size={14}/><Copy bold size={12} style={{fontVariant:['tabular-nums']}}>{num(r.coinCost)}</Copy></View>
      <Bar value={pct} height={4} color={pct>=100?c.success:RUN_TEAL}/>
     </Pressable>;})}
     <Pressable accessibilityRole="button" onPress={()=>router.push('/medi-quest/rewards' as never)} style={{width:96,borderRadius:18,backgroundColor:c.bg100,alignItems:'center',justifyContent:'center',gap:6,padding:8}}>
      <ChevronRight size={22} color={teal}/><Copy bold size={12} style={{color:teal,textAlign:'center'}}>{tx('ყველა საჩუქარი','All prizes')}</Copy>
     </Pressable>
    </ScrollView>
   </View>:null}
  </Card>
 </Section>;
}

/** „ყუთში 20–120 ქოინი“ from today's real schedule (economy 2 changed the amounts; never hard-code them). */
function useBoxRange(){
 const drops=useDrops().data;
 const rows=(drops?.schedule||[]).map(r=>r.coins).filter((r):r is NonNullable<typeof r>=>Boolean(r));
 if(!rows.length)return null;
 return {min:Math.min(...rows.map(r=>r.min)),max:Math.max(...rows.map(r=>r.max))};
}

function GoalBody({goal,balance,title,onOpen}:{goal:StoreReward;balance:number;title:string;onOpen:()=>void}){
 const c=useThemeColors(),need=Math.max(0,goal.coinCost-balance),ready=need===0,range=useBoxRange();
 return <View style={{gap:12}}>
  <Pressable accessibilityRole="button" accessibilityLabel={tx(`შენი მიზანი: ${title}. ${ready?'საკმარისი ქოინი გაქვს':`აკლია ${num(need)} ქოინი`}`,`Your goal: ${title}. ${ready?'You have enough coins':`${num(need)} coins to go`}`)} onPress={onOpen} style={{flexDirection:'row',gap:14,alignItems:'center'}}>
   <Stage reward={goal} size={76}/>
   <View style={{flex:1,minWidth:0,gap:2}}>
    <Copy muted size={11}>{tx('აგროვებ:','Saving for:')}</Copy>
    <Copy bold size={15} numberOfLines={2}>{title}</Copy>
    {ready?<Copy bold size={15} style={{color:c.success}}>{tx('საკმარისი გაქვს!','You have enough!')}</Copy>
     :<Copy bold size={22} style={{color:c.primary100,lineHeight:28,fontVariant:['tabular-nums']}}>{tx(`აკლია ${num(need)}`,`${num(need)}`)}<Copy bold size={13} style={{color:c.primary100}}>{tx(' ქოინი',' coins to go')}</Copy></Copy>}
   </View>
   <ChevronRight size={18} color={c.text300}/>
  </Pressable>
  <View style={{gap:6}}>
   <Bar value={balance/goal.coinCost*100} height={8} color={ready?c.success:RUN_TEAL} label={tx('დაგროვებული ქოინები მიზნამდე','Coins saved toward the goal')}/>
   <View style={{flexDirection:'row',alignItems:'center',gap:6}}>
    <QuestCoinMark size={14}/>
    <Copy muted size={11} style={{flex:1,fontVariant:['tabular-nums']}}>{num(Math.min(balance,goal.coinCost))} / {num(goal.coinCost)}</Copy>
    {range?<Copy muted size={11}>{tx(`ყუთში ${num(range.min)}–${num(range.max)}`,`A box holds ${num(range.min)}–${num(range.max)}`)}</Copy>:null}
   </View>
  </View>
  {ready?<Action label={tx('აიღე საჩუქარი','Get the prize')} onPress={onOpen}/>:null}
 </View>;
}
