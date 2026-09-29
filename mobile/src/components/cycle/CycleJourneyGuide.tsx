import { CyclePressable as Pressable } from '@/components/cycle/CyclePressable';
import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { BookOpen, ChevronDown, HeartHandshake, PencilLine, ShieldCheck, Sparkles } from 'lucide-react-native';
import { useCycleColors } from '@/theme/cycle';
import { tx } from '@/i18n/locale';
const COPY:Record<string,{title:string;body:string}> = {
 TRACK_PERIOD:{title:tx('შენი რიტმის უკეთ გაგება','Get to know your rhythm'),body:tx('კალენდარში მონიშნე რეალური დღეები, დღიურში — შენი შეგრძნებები. მეტი ჩანაწერი პირადი ტენდენციების დანახვაში გეხმარება.','Mark your actual days in the calendar and how you feel in the journal. More entries help you see your personal patterns.')},
 TRY_TO_CONCEIVE:{title:tx('შენი გზა დაგეგმვისკენ','Your path to conceiving'),body:tx('ერთ სივრცეში შეინახე ტესტები, ბაზალური ტემპერატურა და შეგრძნებები. ნაყოფიერი ფანჯარა შეფასებაა და ოვულაციას არ ადასტურებს.','Keep your tests, basal temperature and how you feel in one place. The fertile window is an estimate and does not confirm ovulation.')},
 PREGNANCY:{title:tx('შენთან ერთად, კვირიდან კვირამდე','With you, week by week'),body:tx('მიმდინარე კვირა, შენი ჩანაწერები და ზრუნვის გეგმა ერთ სივრცეშია. დათარიღება სავარაუდოა; ექიმის მითითებით მისი შესწორება პარამეტრებში შეგიძლია.','Your current week, your entries and your care plan in one place. Dating is an estimate; you can correct it in settings as your doctor advises.')},
 POSTPARTUM:{title:tx('სივრცე შენი აღდგენისთვის','A space for your recovery'),body:tx('აღრიცხე შეგრძნებები და სისხლდენა შენს ტემპში. მშობიარობის შემდგომი სისხლდენა ციკლის დაბრუნებას ავტომატურად არ ნიშნავს.','Log how you feel and any bleeding at your own pace. Bleeding after giving birth does not automatically mean your cycle is back.')},
 PERIMENOPAUSE:{title:tx('შენი ცვლილებების დღიური','A journal of your changes'),body:tx('დააკვირდი შეგრძნებებსა და ცვლილებებს, შეინახე ჩანაწერები და საჭიროებისას გაუზიარე შეჯამება ექიმს.','Notice how you feel and what changes, keep notes and share a summary with your doctor when needed.')},
};
export function CycleJourneyGuide({mode}:{mode:string}){
 const c=useCycleColors(),[open,setOpen]=useState(false),copy=COPY[mode]||COPY.TRACK_PERIOD;
 return <View style={{marginHorizontal:16,marginBottom:18,borderWidth:1,borderColor:c.border,borderRadius:22,backgroundColor:c.card,overflow:'hidden'}}>
  <Pressable accessibilityRole="button" accessibilityLabel={tx('როგორ მუშაობს ციკლი','How cycle tracking works')} accessibilityState={{expanded:open}} onPress={()=>setOpen(v=>!v)}
   style={{flexDirection:'row',alignItems:'center',gap:12,padding:16}}>
   <View style={{width:40,height:40,borderRadius:14,backgroundColor:c.accentSoft,alignItems:'center',justifyContent:'center'}}><BookOpen size={20} color={c.brand}/></View>
   <View style={{flex:1}}><Text style={{color:c.ink,fontSize:14,lineHeight:22,fontFamily:'NotoSansGeorgian_600SemiBold'}}>{tx('როგორ მუშაობს?','How does it work?')}</Text>
    <Text style={{color:c.muted,fontSize:12,lineHeight:20,marginTop:4}}>{copy.title}</Text></View>
   <ChevronDown size={18} color={c.muted} style={{transform:[{rotate:open?'180deg':'0deg'}]}}/>
  </Pressable>
  {open?<View style={{paddingHorizontal:16,paddingBottom:18,gap:14}}>
   <Text style={{color:c.muted,fontSize:13,lineHeight:22}}>{copy.body}</Text>
   {[
    {Icon:PencilLine,title:tx('ჩანაწერი — შენი გამოცდილებაა','An entry is your experience'),body:tx('აირჩიე დღე და აღრიცხე ის, რაც ნამდვილად შენიშნე. შენახულის შეცვლაც შეგიძლია.','Pick a day and log what you actually noticed. You can change what you saved, too.')},
    {Icon:Sparkles,title:tx('პროგნოზი — სავარაუდო შეფასებაა','A prediction is an estimate'),body:tx('შევსებული წრე — აღრიცხული სისხლდენაა; წყვეტილი კონტური — სავარაუდო პერიოდი. სამი წერტილი ნაყოფიერების შეფასებას აღნიშნავს, ვარსკვლავი — სავარაუდო ოვულაციას, რგოლი — დღევანდელ დღეს. მცირე ისტორიაზე პროგნოზი შეზღუდულია.','A filled circle is logged bleeding; a dashed outline is an estimated period. Three dots mark the estimated fertile window, a star the likely ovulation, a ring today. With little history, predictions are limited.')},
    {Icon:BookOpen,title:tx('შეჯამება — მეტი სიცხადისთვის','Summaries for more clarity'),body:tx('დღიური და ტენდენციები შენს ჩანაწერებს აერთიანებს. ეს ინფორმაცია დიაგნოზს ან ექიმის შეფასებას არ ცვლის.','The journal and trends bring your entries together. This does not replace a diagnosis or a doctor’s assessment.')},
    {Icon:ShieldCheck,title:tx('გაზიარებას შენ აკონტროლებ','You control sharing'),body:tx('პარტნიორთან გაზიარება არჩევითია. პარამეტრებში მართავ მის ფარგლებს, შეტყობინებების ტექსტს და მონაცემების ექსპორტს.','Sharing with a partner is optional. In settings you control what is shared, notification text and data export.')},
   ].map(({Icon,title,body})=><View key={title} style={{flexDirection:'row',gap:10}}><Icon size={17} color={c.todayRing} style={{marginTop:3}}/><View style={{flex:1}}><Text style={{color:c.ink,fontSize:12,lineHeight:20,fontFamily:'NotoSansGeorgian_600SemiBold'}}>{title}</Text><Text style={{color:c.muted,fontSize:12,lineHeight:20,marginTop:3}}>{body}</Text></View></View>)}
  </View>:null}
 </View>;
}
