import React from 'react';
import {Image,Pressable,View} from 'react-native';
import {useRouter} from 'expo-router';
import {ChevronRight,PackageCheck} from 'lucide-react-native';
import {useAccountQuery} from '@/hooks/useAccountQuery';
import {FRESH} from '@/lib/queryClient';
import {rewardsApi,type RedemptionItem} from '@/lib/quest/rewardsApi';
import {groupMineRedemptions} from '@/lib/quest/rewardsLogic';
import {rewardArt} from '@/components/quest/questArt';
import {rewardTitle} from '@/i18n/quest/rewards.js';
import {appLang,tx} from '@/i18n/locale';
import {useIsDark,useThemeColors} from '@/theme/colors';
import {hubTint} from '@/theme/hub';
import {Card,Copy,Section,runInk} from './PulseUi';

/**
 * MEDIRUN stage 5 (owner 2026-10-09): prizes bought with box coins that are waiting to be handed over, so nobody
 * wonders where the coins went. Same cache as MEDIQUEST „ჩემი საჩუქრები“; hidden when nothing is pending.
 */
export function RunPendingPrizes(){
 const router=useRouter(),c=useThemeColors(),dark=useIsDark(),amber=runInk('amber',dark);
 const query=useAccountQuery({key:['quest','rewards','mine'],fetch:async()=>groupMineRedemptions(await rewardsApi.mine()),staleTime:FRESH.SHORT});
 const pending=((query.data?.active||[]) as RedemptionItem[]).filter(r=>r.reward?.type==='PHYSICAL_PRIZE'&&r.status==='PENDING');
 if(!pending.length)return null;
 return <Section title={tx('გადასაცემი საჩუქრები','Prizes on their way')} link={tx('ყველა','All')} onLink={()=>router.push('/medi-quest/rewards/mine' as never)}>
  <Card style={{paddingVertical:4,paddingHorizontal:14,gap:0}}>
   {pending.slice(0,3).map((r,i)=><Pressable key={r.id} accessibilityRole="button" accessibilityLabel={`${r.reward?rewardTitle(r.reward.titleKey,appLang()):''}, ${tx('მზადდება გადასაცემად','being prepared for hand-over')}`} onPress={()=>router.push('/medi-quest/rewards/mine' as never)} style={{flexDirection:'row',alignItems:'center',gap:12,minHeight:64,paddingVertical:10,borderTopWidth:i?1:0,borderColor:c.bg200}}>
    <View style={{width:44,height:44,borderRadius:12,backgroundColor:hubTint(amber,dark),alignItems:'center',justifyContent:'center',overflow:'hidden'}}>
     {r.reward?<Image source={rewardArt(r.reward as never)} accessibilityIgnoresInvertColors resizeMode="contain" style={{width:38,height:38}}/>:<PackageCheck size={20} color={amber}/>}
    </View>
    <View style={{flex:1,minWidth:0}}>
     <Copy bold size={14} numberOfLines={1}>{r.reward?rewardTitle(r.reward.titleKey,appLang()):tx('საჩუქარი','Prize')}</Copy>
     <View style={{flexDirection:'row',alignItems:'center',gap:6,marginTop:2}}>
      <View style={{paddingHorizontal:7,paddingVertical:1,borderRadius:8,backgroundColor:hubTint(amber,dark)}}><Copy bold size={10} style={{color:amber}}>{tx('მზადდება','Preparing')}</Copy></View>
      <Copy muted size={11} numberOfLines={1} style={{flexShrink:1}}>{tx('დაგიკავშირდებით გადასაცემად','We’ll contact you to hand it over')}</Copy>
     </View>
    </View>
    <ChevronRight size={18} color={c.text300}/>
   </Pressable>)}
  </Card>
 </Section>;
}
