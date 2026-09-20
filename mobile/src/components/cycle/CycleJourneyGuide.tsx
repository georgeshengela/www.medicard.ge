import { CyclePressable as Pressable } from '@/components/cycle/CyclePressable';
import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { BookOpen, ChevronDown, HeartHandshake, PencilLine, ShieldCheck, Sparkles } from 'lucide-react-native';
import { useCycleColors } from '@/theme/cycle';
const COPY:Record<string,{title:string;body:string}> = {
 TRACK_PERIOD:{title:'შენი რიტმის უკეთ გაგება',body:'კალენდარში მონიშნე რეალური დღეები, დღიურში — შენი შეგრძნებები. მეტი ჩანაწერი პირადი ტენდენციების დანახვაში გეხმარება.'},
 TRY_TO_CONCEIVE:{title:'შენი გზა დაგეგმვისკენ',body:'ერთ სივრცეში შეინახე ტესტები, ბაზალური ტემპერატურა და შეგრძნებები. ნაყოფიერი ფანჯარა შეფასებაა და ოვულაციას არ ადასტურებს.'},
 PREGNANCY:{title:'შენთან ერთად, კვირიდან კვირამდე',body:'მიმდინარე კვირა, შენი ჩანაწერები და ზრუნვის გეგმა ერთ სივრცეშია. დათარიღება სავარაუდოა; ექიმის მითითებით მისი შესწორება პარამეტრებში შეგიძლია.'},
 POSTPARTUM:{title:'სივრცე შენი აღდგენისთვის',body:'აღრიცხე შეგრძნებები და სისხლდენა შენს ტემპში. მშობიარობის შემდგომი სისხლდენა ციკლის დაბრუნებას ავტომატურად არ ნიშნავს.'},
 PERIMENOPAUSE:{title:'შენი ცვლილებების დღიური',body:'დააკვირდი შეგრძნებებსა და ცვლილებებს, შეინახე ჩანაწერები და საჭიროებისას გაუზიარე შეჯამება ექიმს.'},
};
export function CycleJourneyGuide({mode}:{mode:string}){
 const c=useCycleColors(),[open,setOpen]=useState(false),copy=COPY[mode]||COPY.TRACK_PERIOD;
 return <View style={{marginHorizontal:16,marginBottom:18,borderWidth:1,borderColor:c.border,borderRadius:22,backgroundColor:c.card,overflow:'hidden'}}>
  <Pressable accessibilityRole="button" accessibilityLabel="როგორ მუშაობს ციკლი" accessibilityState={{expanded:open}} onPress={()=>setOpen(v=>!v)}
   style={{flexDirection:'row',alignItems:'center',gap:12,padding:16}}>
   <View style={{width:40,height:40,borderRadius:14,backgroundColor:c.accentSoft,alignItems:'center',justifyContent:'center'}}><BookOpen size={20} color={c.brand}/></View>
   <View style={{flex:1}}><Text style={{color:c.ink,fontSize:14,lineHeight:22,fontFamily:'NotoSansGeorgian_600SemiBold'}}>როგორ მუშაობს?</Text>
    <Text style={{color:c.muted,fontSize:12,lineHeight:20,marginTop:4}}>{copy.title}</Text></View>
   <ChevronDown size={18} color={c.muted} style={{transform:[{rotate:open?'180deg':'0deg'}]}}/>
  </Pressable>
  {open?<View style={{paddingHorizontal:16,paddingBottom:18,gap:14}}>
   <Text style={{color:c.muted,fontSize:13,lineHeight:22}}>{copy.body}</Text>
   {[
    {Icon:PencilLine,title:'ჩანაწერი — შენი გამოცდილებაა',body:'აირჩიე დღე და აღრიცხე ის, რაც ნამდვილად შენიშნე. შენახულის შეცვლაც შეგიძლია.'},
    {Icon:Sparkles,title:'პროგნოზი — სავარაუდო შეფასებაა',body:'შევსებული წრე — აღრიცხული სისხლდენაა; წყვეტილი კონტური — სავარაუდო პერიოდი. სამი წერტილი ნაყოფიერების შეფასებას აღნიშნავს, ვარსკვლავი — სავარაუდო ოვულაციას, რგოლი — დღევანდელ დღეს. მცირე ისტორიაზე პროგნოზი შეზღუდულია.'},
    {Icon:BookOpen,title:'შეჯამება — მეტი სიცხადისთვის',body:'დღიური და ტენდენციები შენს ჩანაწერებს აერთიანებს. ეს ინფორმაცია დიაგნოზს ან ექიმის შეფასებას არ ცვლის.'},
    {Icon:ShieldCheck,title:'გაზიარებას შენ აკონტროლებ',body:'პარტნიორთან გაზიარება არჩევითია. პარამეტრებში მართავ მის ფარგლებს, შეტყობინებების ტექსტს და მონაცემების ექსპორტს.'},
   ].map(({Icon,title,body})=><View key={title} style={{flexDirection:'row',gap:10}}><Icon size={17} color={c.todayRing} style={{marginTop:3}}/><View style={{flex:1}}><Text style={{color:c.ink,fontSize:12,lineHeight:20,fontFamily:'NotoSansGeorgian_600SemiBold'}}>{title}</Text><Text style={{color:c.muted,fontSize:12,lineHeight:20,marginTop:3}}>{body}</Text></View></View>)}
  </View>:null}
 </View>;
}
