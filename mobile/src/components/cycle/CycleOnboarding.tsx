import { CyclePressable as Pressable } from '@/components/cycle/CyclePressable';
import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CalendarHeart, ChevronLeft, ShieldCheck, SlidersHorizontal } from 'lucide-react-native';
import { CycleCalendar } from './CycleCalendar';
import { CycleAtmosphere, CyclePrimaryButton, formatCycleDateKa } from './CycleUI';
import { cycleDatePickable } from '@/lib/cycleExperience';
import type { CycleContraceptionMethod } from '@/lib/api';
import { ka } from '@/i18n/ka';
import { useCycleColors } from '@/theme/cycle';

type Props = {
 visible:boolean; saving?:boolean; userName?:string|null; error?:string|null;
 onSave:(iso:string)=>Promise<boolean>;
 onBack?:()=>void; onChooseMode?:()=>void;
 onFinishContraception?:(input:{method:CycleContraceptionMethod|null;startedAt:string|null})=>void|Promise<void>;
};
export function CycleOnboarding({visible,saving,userName,error,onSave,onBack,onChooseMode,onFinishContraception}:Props){
 const c=useCycleColors(),insets=useSafeAreaInsets(),now=new Date();
 const [date,setDate]=useState(''),[step,setStep]=useState<'date'|'contraception'>('date');
 const [method,setMethod]=useState<CycleContraceptionMethod|null>(null);
 const [cursor,setCursor]=useState(()=>({y:now.getFullYear(),m:now.getMonth()}));
 const [localError,setLocalError]=useState<string|null>(null);
 const busy=useRef(false),alive=useRef(true);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 if(!visible)return null;
 const advance=async()=>{
  if(busy.current||saving||!date)return;
  busy.current=true;setLocalError(null);
  try{if(await onSave(date)&&alive.current)setStep('contraception');}
  catch{if(alive.current)setLocalError(ka.common.error);}
  finally{busy.current=false;}
 };
 const finish=async(skip=false)=>{
  if(busy.current||saving)return;busy.current=true;setLocalError(null);
  try{await onFinishContraception?.({method:skip?null:method,startedAt:null});}
  catch{if(alive.current)setLocalError(ka.common.error);}
  finally{busy.current=false;}
 };
 const move=(delta:number)=>{
  const d=new Date(cursor.y,cursor.m+delta,1),min=new Date(now.getFullYear(),now.getMonth()-18,1),max=new Date(now.getFullYear(),now.getMonth(),1);
  if(d>=min&&d<=max)setCursor({y:d.getFullYear(),m:d.getMonth()});
 };
 const name=(userName||'').trim().split(/\s+/)[0];
 return <CycleAtmosphere>
  <View style={{flex:1,paddingTop:insets.top+6,minHeight:0}}>
   <View style={{flexDirection:'row',alignItems:'center',paddingHorizontal:16,gap:12}}>
    <Pressable accessibilityRole="button" accessibilityLabel={ka.common.back} disabled={saving}
     onPress={()=>step==='contraception'?setStep('date'):onBack?.()} style={{width:44,height:44,borderRadius:16,alignItems:'center',justifyContent:'center',backgroundColor:c.card}}>
     <ChevronLeft size={22} color={c.ink}/>
    </Pressable>
    <Text style={{flex:1,color:c.muted,fontSize:12,fontFamily:'NotoSansGeorgian_600SemiBold'}}>შენი ციკლის სივრცე</Text>
    <Text style={{color:c.brand,fontSize:12,fontFamily:'NotoSansGeorgian_700Bold'}}>{step==='date'?'01':'02'} / 02</Text>
   </View>
   <View style={{flexDirection:'row',gap:8,marginHorizontal:20,marginTop:16}}>{[0,1].map(i=><View key={i} style={{flex:1,height:3,borderRadius:3,backgroundColor:i===0||step==='contraception'?c.brand:c.gaugeTrack}}/>)}</View>
   <ScrollView style={{flex:1}} contentContainerStyle={{padding:20,paddingBottom:24}} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
    <View style={{width:56,height:56,borderRadius:20,backgroundColor:c.accentSoft,alignItems:'center',justifyContent:'center',marginBottom:16}}>
     <CalendarHeart size={27} color={c.brand}/>
    </View>
    <Text style={{color:c.muted,fontSize:13,fontFamily:'NotoSansGeorgian_500Medium'}}>{name?name+', ეს შენი სივრცეა':'ეს შენი სივრცეა'}</Text>
    <Text accessibilityRole="header" style={{color:c.ink,fontSize:28,lineHeight:38,fontFamily:'NotoSansGeorgian_600SemiBold',marginTop:6}}>
     {step==='date'?'შენი რიტმი.\nშენი უკეთ გაგება.':ka.cycle.contraceptionAsk}
    </Text>
    <Text style={{color:c.muted,fontSize:14,lineHeight:22,fontFamily:'NotoSansGeorgian_400Regular',marginTop:10,marginBottom:20}}>
     {step==='date'?'მონიშნე ბოლო მენსტრუაციის პირველი დღე. ყოველდღიური ჩანაწერები დაგეხმარება შენი ციკლისა და შეგრძნებების უკეთ დანახვაში.':ka.cycle.contraceptionLead}
    </Text>
    {step==='date'?<>
     <CycleCalendar year={cursor.y} month={cursor.m} marks={date?{[date]:{period:true}}:{}} selected={date||null}
      onSelect={iso=>{if(cycleDatePickable(iso))setDate(iso);}} onPrev={()=>move(-1)} onNext={()=>move(1)} canSelect={cycleDatePickable}/>
     <View style={{padding:14,borderRadius:16,backgroundColor:c.card,borderWidth:1,borderColor:date?c.period:c.border,marginTop:16}}>
      <Text style={{color:c.muted,fontSize:11,fontFamily:'NotoSansGeorgian_500Medium'}}>ბოლო მენსტრუაციის პირველი დღე</Text>
      <Text style={{color:c.ink,fontSize:15,lineHeight:22,fontFamily:'NotoSansGeorgian_700Bold',marginTop:4}}>{date?formatCycleDateKa(date):'აირჩიე კალენდარში'}</Text>
     </View>
     <Pressable onPress={onChooseMode} disabled={saving} accessibilityRole="button" accessibilityLabel="სხვა რეჟიმის არჩევა"
      style={{flexDirection:'row',gap:12,paddingVertical:18,alignItems:'center'}}>
      <SlidersHorizontal size={20} color={c.lavender}/>
      <View style={{flex:1}}><Text style={{color:c.ink,fontSize:13,fontFamily:'NotoSansGeorgian_600SemiBold'}}>სხვა ეტაპზე ხარ?</Text>
       <Text style={{color:c.muted,fontSize:12,lineHeight:19,marginTop:3}}>ორსულობა, მშობიარობის შემდგომი პერიოდი ან სხვა რეჟიმი</Text></View>
     </Pressable>
    </>:<View style={{gap:8}}>
     {(Object.keys(ka.cycle.contraceptionMethod) as CycleContraceptionMethod[]).map(id=><Pressable key={id} onPress={()=>setMethod(id)}
      accessibilityRole="radio" accessibilityState={{checked:method===id}} style={{minHeight:52,borderRadius:16,padding:14,backgroundColor:method===id?c.accentSoft:c.card,borderWidth:1,borderColor:method===id?c.period:c.border,flexDirection:'row',alignItems:'center',gap:12}}>
      <View style={{width:20,height:20,borderRadius:10,borderWidth:2,borderColor:method===id?c.period:c.border,alignItems:'center',justifyContent:'center'}}>{method===id?<View style={{width:10,height:10,borderRadius:5,backgroundColor:c.period}}/>:null}</View>
      <Text style={{flex:1,color:c.ink,fontSize:13,lineHeight:20,fontFamily:'NotoSansGeorgian_600SemiBold'}}>{ka.cycle.contraceptionMethod[id]}</Text>
     </Pressable>)}
    </View>}
    <View style={{flexDirection:'row',gap:8,marginTop:14,alignItems:'flex-start'}}><ShieldCheck size={16} color={c.todayRing}/>
     <Text style={{flex:1,color:c.muted,fontSize:11,lineHeight:18}}>{ka.cycle.onboardPrivacy}</Text></View>
   </ScrollView>
   <View style={{paddingHorizontal:20,paddingTop:12,paddingBottom:Math.max(insets.bottom,12),borderTopWidth:1,borderColor:c.border,backgroundColor:c.card}}>
    {error||localError?<Text accessibilityRole="alert" style={{color:c.danger,fontSize:12,lineHeight:18,marginBottom:10}}>{error||localError}</Text>:null}
    <CyclePrimaryButton label={step==='date'?'გაგრძელება':'ჩემი სივრცის გახსნა'} onPress={()=>void(step==='date'?advance():finish())} loading={saving} disabled={step==='date'&&!date}/>
    {step==='contraception'?<Pressable accessibilityRole="button" disabled={saving} onPress={()=>void finish(true)} style={{minHeight:44,alignItems:'center',justifyContent:'center'}}><Text style={{color:c.muted,fontSize:12}}>{ka.cycle.contraceptionSkip}</Text></Pressable>:null}
   </View>
  </View>
 </CycleAtmosphere>;
}
