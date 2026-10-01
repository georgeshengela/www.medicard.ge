import React from 'react';
import {Pressable,View} from 'react-native';
import {useRouter} from 'expo-router';
import {ChevronRight} from 'lucide-react-native';
import {useThemeColors} from '@/theme/colors';
import {useAccountQuery} from '@/hooks/useAccountQuery';
import {FRESH} from '@/lib/queryClient';
import {pulseApi} from '@/lib/medipulsi/client';
import {dropDay,grandPercent,grandProgress,levelPercent,streetsLeftLabel,type GrandPrize} from '@/lib/medipulsi/grand';
import {tx} from '@/i18n/locale';
import {ArtTile,Bar,Card,Copy} from './PulseUi';
import {RUN_GIFT} from './runArt';

/** 404 = the server has no grand-prize endpoint yet: a calm "coming soon", never a retry storm. */
export function isGrandMissing(error:unknown){return (error as {status?:number}|null)?.status===404;}

/** One cache entry for the MEDIRUN hub card and the grand-prize page. */
export function useGrandPrize(){
 return useAccountQuery<GrandPrize>({key:['medirun','grand'],fetch:()=>pulseApi<GrandPrize>('/grand'),staleTime:FRESH.SHORT,retry:(count,error)=>!isGrandMissing(error)&&count<1});
}

/** What the eligibility pill says once the person has lit enough of the city. */
export function eligibleLabel(data:GrandPrize){
 const status=data.campaign.status;
 if(status==='live')return tx('შენ ხედავ დიდ საჩუქარს','You can see the grand prize');
 if(status==='ended'){const goal=levelPercent(data.requirement.percent);return tx(`${goal}-ს მიაღწიე`,`You reached ${goal}`);}
 return tx('შენ დაინახავ დიდ საჩუქარს','You’ll see the grand prize');
}

/** MEDIRUN hub entry: the date, the prize and a slim bar toward the goal. */
export function GrandPrizeCard(){
 const router=useRouter(),c=useThemeColors(),{data,error}=useGrandPrize();
 const me=data?.me||null,ended=data?.campaign.status==='ended';
 const title=`${data?dropDay(data.campaign.dropAt):tx('31 დეკემბერი','31 December')} · ${tx('დიდი საჩუქარი','Grand prize')}`;
 const subtitle=data?[data.campaign.prize,data.campaign.prizeDetail].filter(Boolean).join(' · '):tx('თბილისში დამალული MEDIRUN-ის საჩუქარი','A MEDIRUN gift hidden in Tbilisi');
 const status=!data?(error?(isGrandMissing(error)?tx('დეტალები მალე გამოჩნდება','Details coming soon'):tx('შეეხე დეტალების სანახავად','Tap for details')):tx('იტვირთება…','Loading…'))
  :!me?tx('შენი პროგრესი ითვლება…','Counting your progress…')
  :me.eligible?eligibleLabel(data)
  :ended?tx('კამპანია დასრულდა','The campaign has ended')
  :streetsLeftLabel(me.remainingStreetKm);
 return <Pressable accessibilityRole="button" accessibilityLabel={`${title}. ${subtitle}. ${status}`} onPress={()=>router.push('/run/grand' as never)}>
  <Card style={{gap:14}}>
   <View style={{flexDirection:'row',alignItems:'center',gap:12}}>
    <ArtTile source={RUN_GIFT} ink="amber" size={52}/>
    <View style={{flex:1,minWidth:0,gap:1}}>
     <Copy bold size={15} numberOfLines={2}>{title}</Copy>
     <Copy muted size={12} numberOfLines={1}>{subtitle}</Copy>
    </View>
    <ChevronRight size={18} color={c.text300}/>
   </View>
   {data&&me?<View style={{gap:8}}>
    <Bar value={grandProgress(data)*100} color={me.eligible?c.success:undefined} label={tx(`${grandPercent(me.percent)} ${levelPercent(data.requirement.percent)}-დან`,`${grandPercent(me.percent)} of ${levelPercent(data.requirement.percent)}`)}/>
    <View style={{flexDirection:'row',alignItems:'center',gap:10}}>
     <Copy muted size={11} numberOfLines={1} style={{flex:1}}>{status}</Copy>
     <Copy bold size={11} style={{color:me.eligible?c.success:c.primary100,fontVariant:['tabular-nums']}}>{grandPercent(me.percent)} / {levelPercent(data.requirement.percent)}</Copy>
    </View>
   </View>:<Copy muted size={11}>{status}</Copy>}
  </Card>
 </Pressable>;
}
