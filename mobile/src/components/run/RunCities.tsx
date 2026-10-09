import React,{useEffect,useMemo,useState} from 'react';
import {Pressable,ScrollView,Share,View,useWindowDimensions} from 'react-native';
import {useRouter} from 'expo-router';
import {LinearGradient} from 'expo-linear-gradient';
import {Footprints,MapPin,Share2} from 'lucide-react-native';
import Svg,{Circle,Path,Rect} from 'react-native-svg';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {ModuleHeader} from '@/components/brand/ModuleHeader';
import {Bone} from '@/components/ui/Skeleton';
import {useAccountQuery} from '@/hooks/useAccountQuery';
import {FRESH} from '@/lib/queryClient';
import {pulseApi} from '@/lib/medipulsi/client';
import {cityLevel,cityScale,meterSegments} from '@/lib/medipulsi/cityLevels';
import {grandPercent,levelPercent} from '@/lib/medipulsi/grand';
import {formatArea,type TerritoryMap} from '@/lib/medipulsi/territory';
import {formatYmd} from '@/lib/format';
import {useIsDark,useThemeColors} from '@/theme/colors';
import {HUB,hubTint} from '@/theme/hub';
import {shareLink} from '@/lib/medipulsi/social';
import {appLang,tx} from '@/i18n/locale';
import {Action,Card,Copy,Section,runInk} from './PulseUi';

/** `GET /api/medipulsi/cities` — server `src/lib/medipulsi/cityVisits.js`. */
export type LitCity={id:string;name:string;countryCode:string|null;country:string|null;percent:number;paintedKm2:number;areaKm2:number;map:TerritoryMap|null;firstAt:string|null;lastAt:string|null};
export type VisitedCity={id:string;name:string;countryCode:string|null;country:string|null;firstAt:string;lastAt:string};
export type MyCities={summary:{lit:number;visited:number;countries:number;paintedKm2:number};lit:LitCity[];visited:VisitedCity[];pending:boolean};

export function useMyCities(){
 return useAccountQuery<MyCities>({key:['medirun','cities'],fetch:()=>pulseApi<MyCities>('/cities'),staleTime:FRESH.SHORT,retry:(n,e)=>(e as {status?:number}|null)?.status!==404&&n<1});
}

const MINT='#5EEAD4',GOLD='#FCD34D',SEGMENTS=20;
const day=(iso:string|null)=>{if(!iso)return '';const d=new Date(iso);if(!Number.isFinite(d.getTime()))return '';const ymd=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;return formatYmd(ymd,d.getFullYear()!==new Date().getFullYear());};
const pct=(p:number)=>grandPercent(p);

/** The lit squares of a city on the night canvas: the outline as a hairline, lit squares glowing by how lit they are. */
function CityGlowMap({map,width,height,gold}:{map:TerritoryMap;width:number;height:number;gold:boolean}){
 const cell=Math.min(width/map.cols,height/map.rows),w=map.cols*cell,h=map.rows*cell,ox=(width-w)/2,oy=(height-h)/2,lit=gold?GOLD:MINT;
 const dots=useMemo(()=>{
  const out:{x:number;y:number;v:number}[]=[];
  map.grid.forEach((row,y)=>{for(let x=0;x<row.length;x++){const ch=row.charCodeAt(x)-48;if(ch>=1)out.push({x,y,v:ch});}});
  return out;
 },[map]);
 const outline=useMemo(()=>map.outline.map(ring=>ring.map(([x,y],i)=>`${i?'L':'M'}${(ox+x*cell).toFixed(1)} ${(oy+y*cell).toFixed(1)}`).join(' ')+'Z').join(' '),[map,cell,ox,oy]);
 return <Svg width={width} height={height}>
  {dots.map(d=>d.v===1
   ?<Rect key={`${d.x}:${d.y}`} x={ox+d.x*cell+cell*.42} y={oy+d.y*cell+cell*.42} width={Math.max(.8,cell*.16)} height={Math.max(.8,cell*.16)} fill="#94A3B8" opacity={.28}/>
   :<React.Fragment key={`${d.x}:${d.y}`}>
     <Circle cx={ox+(d.x+.5)*cell} cy={oy+(d.y+.5)*cell} r={cell*1.15} fill={lit} opacity={.07+.02*(d.v-2)}/>
     <Circle cx={ox+(d.x+.5)*cell} cy={oy+(d.y+.5)*cell} r={Math.max(1.2,cell*.32)} fill={lit} opacity={.75+.035*(d.v-2)}/>
    </React.Fragment>)}
  {outline?<Path d={outline} stroke={lit} strokeOpacity={.35} strokeWidth={1} fill="none"/>:null}
 </Svg>;
}

/**
 * Twenty LED segments on a fixed, honest scale (0–1%, then 0–10%): a tiny share stays a spark in the first segment.
 * Thin ticks mark the light levels on the way (owner 2026-10-05: „0,03% ნამეტანი დიდად ჩანს“).
 */
function LedMeter({percent,gold,dashed=false}:{percent:number;gold:boolean;dashed?:boolean}){
 const c=useThemeColors(),dark=useIsDark(),on=gold?(dark?GOLD:'#D97706'):(dark?MINT:'#0D9488'),s=cityScale(dashed?0:percent);
 return <View style={{height:9,justifyContent:'flex-end'}}>
  <View style={{flexDirection:'row',gap:2,height:4}}>
   {meterSegments(s.fill,SEGMENTS).map((v,i)=><View key={i} style={{flex:1,borderRadius:1,backgroundColor:v?on:c.bg300,opacity:v===0.5?.55:dashed?.5:1}}/>)}
  </View>
  {s.ticks.map(t=><View key={t.at} pointerEvents="none" style={{position:'absolute',left:`${t.at*100}%`,top:0,width:1,height:9,marginLeft:-1,backgroundColor:t.reached?on:c.text300,opacity:t.reached?.9:.45}}/>)}
 </View>;
}
/** „0,03% · ნაპერწკალამდე 0,1% · შუქურამდე 1%“ — the honest scale in words. */
function meterLine(percent:number){
 const lv=cityLevel(percent),s=cityScale(percent);
 const reached=lv.current?tx(`${lv.current.name} ✓`,`${lv.current.name} ✓`):'';
 const next=lv.next?tx(`შემდეგი — ${lv.next.name} ${levelPercent(lv.next.percent)}`,`next — ${lv.next.name} ${levelPercent(lv.next.percent)}`):'';
 const scale=tx(`ზოლი 0–${s.max}%`,`bar 0–${s.max}%`);
 return [reached,next,scale].filter(Boolean).join(' · ');
}

/** One compact row: number · city / country · share, then the LED meter toward the next level. */
function CityRow({index,city,selected,onPress}:{index:number;city:LitCity;selected:boolean;onPress:()=>void}){
 const c=useThemeColors(),dark=useIsDark(),teal=runInk('teal',dark),lv=cityLevel(city.percent),gold=Boolean(lv.current?.gold),ink=gold?(dark?GOLD:'#B45309'):teal;
 return <Pressable accessibilityRole="button" accessibilityState={{selected}} accessibilityLabel={tx(`${city.name}, ${pct(city.percent)}`,`${city.name}, ${pct(city.percent)}`)} onPress={onPress}
  style={{paddingVertical:11,paddingHorizontal:12,borderRadius:16,backgroundColor:selected?c.bg200:'transparent',gap:8}}>
  <View style={{flexDirection:'row',alignItems:'center',gap:10}}>
   <Copy bold size={11} style={{width:20,color:c.text300,fontVariant:['tabular-nums']}}>{String(index+1).padStart(2,'0')}</Copy>
   <View style={{flex:1,minWidth:0}}>
    <Copy bold size={14} numberOfLines={1}>{city.name}</Copy>
    <Copy muted size={11} numberOfLines={1}>{[city.country,formatArea(city.paintedKm2,appLang())].filter(Boolean).join(' · ')}</Copy>
   </View>
   <Copy bold size={15} style={{color:ink,fontVariant:['tabular-nums']}}>{pct(city.percent)}</Copy>
  </View>
  <View style={{paddingLeft:30,gap:5}}>
   <LedMeter percent={city.percent} gold={gold}/>
   <Copy size={10} muted numberOfLines={1}>{meterLine(city.percent)}</Copy>
  </View>
 </Pressable>;
}

/**
 * „ჩემი ქალაქები“ (owner 2026-10-05): every city the player lit, with its share and the way to the next light
 * level, the night map of the chosen one, and the cities they were in without lighting anything yet.
 */
export default function RunCities(){
 const router=useRouter(),c=useThemeColors(),dark=useIsDark(),insets=useSafeAreaInsets(),{width}=useWindowDimensions(),teal=runInk('teal',dark);
 const q=useMyCities(),data=q.data,[pick,setPick]=useState<string|null>(null);
 const chosen=data?.lit.find(x=>x.id===pick)||data?.lit.find(x=>x.map)||data?.lit[0]||null;
 useEffect(()=>{if(!pick&&chosen)setPick(chosen.id);},[chosen?.id]);// eslint-disable-line react-hooks/exhaustive-deps
 const heroW=width-HUB.gutter*2,mapW=heroW-32,mapH=Math.round(mapW*0.62),lv=chosen?cityLevel(chosen.percent):null,gold=Boolean(lv?.current?.gold);
 const back=()=>router.canGoBack()?router.back():router.replace('/run' as never);
 return <ScrollView style={{flex:1,backgroundColor:c.bg100}} showsVerticalScrollIndicator={false} contentContainerStyle={{paddingTop:insets.top+12,paddingBottom:insets.bottom+32,paddingHorizontal:HUB.gutter,gap:HUB.sectionGap}}>
  <ModuleHeader module="run" subtitle={tx('ჩემი განათებული ქალაქები','My lit cities')} onBack={back}/>

  {q.isLoading&&!data?<View style={{gap:12}}><Bone height={300} radius={24}/><Bone height={64} radius={16}/><Bone height={64} radius={16}/></View>
  :q.isError&&!data?<Card style={{gap:10}}><Copy bold size={15}>{tx('ქალაქები ვერ ჩაიტვირთა','Couldn’t load your cities')}</Copy><Copy muted size={12}>{tx('შეამოწმე ინტერნეტი და სცადე ხელახლა.','Check your connection and try again.')}</Copy><Action secondary label={tx('ხელახლა ცდა','Try again')} onPress={()=>void q.refetch()}/></Card>
  :data?<>
   {/* The page's one spotlight: the night map of the chosen city. */}
   <LinearGradient colors={['#030712','#06201F','#0B3B37']} start={{x:0,y:0}} end={{x:1,y:1}} style={{borderRadius:24,padding:16,gap:12,overflow:'hidden'}}>
    <View style={{flexDirection:'row',alignItems:'flex-end',justifyContent:'space-between',gap:12}}>
     <View style={{flex:1,minWidth:0}}>
      <Copy size={11} style={{color:'rgba(204,251,241,0.7)',letterSpacing:1.2}}>{chosen?(chosen.country||'').toUpperCase():tx('შენი რუკა','YOUR MAP')}</Copy>
      <Copy bold size={24} numberOfLines={1} style={{color:'#FFFFFF',lineHeight:32}}>{chosen?chosen.name:tx('ჯერ ცარიელია','Still dark')}</Copy>
     </View>
     {chosen?<View style={{alignItems:'flex-end'}}><Copy bold size={28} style={{color:gold?GOLD:MINT,fontVariant:['tabular-nums'],lineHeight:34}}>{pct(chosen.percent)}</Copy><Copy size={10} style={{color:'rgba(204,251,241,0.7)'}}>{lv?.current?.name||tx('განათების გზაზე','on the way')}</Copy></View>:null}
    </View>
    <View style={{height:mapH,alignItems:'center',justifyContent:'center'}}>
     {chosen?.map?<CityGlowMap map={chosen.map} width={mapW} height={mapH} gold={gold}/>
     :<View style={{alignItems:'center',gap:8}}><MapPin size={28} color={MINT}/><Copy size={12} style={{color:'#CCFBF1',textAlign:'center'}}>{chosen?tx('ამ ქალაქის რუკა მზადდება','This city’s map is on its way'):tx('პირველი გასეირნების შემდეგ აქ შენი ქალაქი აინთება.','After your first walk your city lights up here.')}</Copy></View>}
    </View>
    <View style={{flexDirection:'row',borderTopWidth:1,borderColor:'rgba(153,246,228,0.14)',paddingTop:12}}>
     {[{v:String(data.summary.lit),l:tx('განათებული','lit')},{v:String(data.summary.countries),l:tx('ქვეყანა','countries')},{v:formatArea(data.summary.paintedKm2,appLang()),l:tx('სინათლე სულ','light in all')}].map((s,i)=><View key={s.l} style={{flex:1,alignItems:i===0?'flex-start':i===2?'flex-end':'center'}}><Copy bold size={16} style={{color:'#FFFFFF',fontVariant:['tabular-nums']}}>{s.v}</Copy><Copy size={10} style={{color:'rgba(204,251,241,0.7)'}}>{s.l}</Copy></View>)}
    </View>
    {chosen&&(chosen.firstAt||chosen.lastAt)?<Copy size={10} style={{color:'rgba(204,251,241,0.6)'}}>{[chosen.firstAt?tx(`პირველად ${day(chosen.firstAt)}`,`first ${day(chosen.firstAt)}`):'',chosen.lastAt?tx(`ბოლოს ${day(chosen.lastAt)}`,`last ${day(chosen.lastAt)}`):''].filter(Boolean).join(' · ')}</Copy>:null}
   </LinearGradient>

   {data.lit.length?<Section title={tx('განათებული','Lit')}>
    <Card style={{padding:6,gap:2}}>{data.lit.map((city,i)=><CityRow key={city.id} index={i} city={city} selected={city.id===chosen?.id} onPress={()=>setPick(city.id)}/>)}</Card>
    <Copy muted size={11} style={{marginTop:8}}>{tx('ზოლი ნამდვილი მასშტაბითაა — 0-დან შუქურამდე (1%). ნიშნები: ნაპერწკალი 0,1% · ფარანი 0,25% · ჩირაღდანი 0,5%. ერთი ქუჩა ერთხელ ითვლება.','The bar is to scale — from 0 to Lighthouse (1%). Marks: Spark 0.1% · Lantern 0.25% · Torch 0.5%. Each street counts once.')}</Copy>
   </Section>:null}

   {data.visited.length?<Section title={tx('ნამყოფი — ჯერ ჩაუქრობელი','Visited — still dark')}>
    <Card style={{padding:6,gap:2}}>{data.visited.map((city,i)=><View key={city.id} style={{paddingVertical:11,paddingHorizontal:12,gap:8}}>
     <View style={{flexDirection:'row',alignItems:'center',gap:10}}>
      <Copy bold size={11} style={{width:20,color:c.text300,fontVariant:['tabular-nums']}}>{String(i+1).padStart(2,'0')}</Copy>
      <View style={{flex:1,minWidth:0}}><Copy bold size={14} numberOfLines={1} style={{color:c.text200}}>{city.name}</Copy><Copy muted size={11} numberOfLines={1}>{[city.country,tx(`აქ იყავი ${day(city.lastAt)}`,`here ${day(city.lastAt)}`)].filter(Boolean).join(' · ')}</Copy></View>
      <Copy muted size={13}>0%</Copy>
     </View>
     <View style={{paddingLeft:30}}><LedMeter percent={0} gold={false} dashed/></View>
    </View>)}</Card>
   </Section>:null}

   {!data.lit.length&&!data.visited.length?<Card style={{gap:10}}><Copy bold size={15}>{tx('აანთე პირველი ქალაქი','Light up your first city')}</Copy><Copy muted size={12}>{tx('დაიწყე გასეირნება MEDIRUN-ში — ყოველი ახალი ქუჩა შენს ქალაქს ანათებს და ის აქ გამოჩნდება.','Start a walk in MEDIRUN — every new street lights up your city and it appears here.')}</Copy><Action label={tx('გასეირნების დაწყება','Start a walk')} icon={Footprints} onPress={()=>router.replace('/run' as never)}/></Card>:null}
   {data.pending?<Copy muted size={11} style={{textAlign:'center',color:teal}}>{tx('ზოგიერთი ქალაქი ჯერ იტვირთება — მალე გამოჩნდება.','Some cities are still loading — they’ll appear shortly.')}</Copy>:null}
  </>:null}
 </ScrollView>;
}

/** MEDIRUN hub → „პროგრესი“: the way into „ჩემი ქალაქები“ — how many cities, the three brightest and their meters. */
/** Stage 8 (owner 2026-10-09): „გავანათე ლიეჟის 0,03%“ with the person's invite link, one tap from Progress. */
async function shareCity(city:LitCity){
 const link=await shareLink().catch(()=>'https://medicard.ge/medirun');
 await Share.share({message:tx(`MEDIRUN-ში ${city.name}-ის ${pct(city.percent)} უკვე გავანათე 🌃 შემომიერთდი და ერთად გავანათოთ: ${link}`,`I've lit ${pct(city.percent)} of ${city.name} in MEDIRUN 🌃 Join me and let's light it up together: ${link}`)}).catch(()=>{});
}

export function RunCitiesEntry(){
 const router=useRouter(),c=useThemeColors(),dark=useIsDark(),teal=runInk('teal',dark),data=useMyCities().data;
 if(!data)return null;
 const top=data.lit.slice(0,3);
 return <Section title={tx('ჩემი ქალაქები','My cities')} link={tx('ყველა','All')} onLink={()=>router.push('/run/cities' as never)}>
  <Pressable accessibilityRole="button" accessibilityLabel={tx(`ჩემი ქალაქები: ${data.summary.lit} განათებული, ${data.summary.visited} ნამყოფი`,`My cities: ${data.summary.lit} lit, ${data.summary.visited} visited`)} onPress={()=>router.push('/run/cities' as never)}>
   <Card style={{gap:12}}>
    <View style={{flexDirection:'row',alignItems:'baseline',gap:6}}>
     <Copy bold size={28} style={{color:teal,fontVariant:['tabular-nums'],lineHeight:34}}>{data.summary.lit}</Copy>
     <Copy muted size={12} style={{flex:1}}>{tx(`განათებული ქალაქი · ${data.summary.countries} ქვეყანა${data.summary.visited?` · ${data.summary.visited} ნამყოფი`:''}`,`lit ${data.summary.lit===1?'city':'cities'} · ${data.summary.countries} ${data.summary.countries===1?'country':'countries'}${data.summary.visited?` · ${data.summary.visited} visited`:''}`)}</Copy>
    </View>
    {top.length?top.map(city=>{const lv=cityLevel(city.percent);return <View key={city.id} style={{gap:5}}>
     <View style={{flexDirection:'row',alignItems:'center'}}><Copy bold size={12} numberOfLines={1} style={{flex:1}}>{city.name}</Copy><Copy bold size={12} style={{color:lv.current?.gold?(dark?GOLD:'#B45309'):teal,fontVariant:['tabular-nums']}}>{pct(city.percent)}</Copy></View>
     <LedMeter percent={city.percent} gold={Boolean(lv.current?.gold)}/>
    </View>;}):<Copy muted size={12}>{tx('პირველი გასეირნების შემდეგ შენი ქალაქი აქ აინთება.','After your first walk your city lights up here.')}</Copy>}
    {top.length?<Pressable accessibilityRole="button" accessibilityLabel={tx(`გაზიარება: ${top[0].name} ${pct(top[0].percent)}`,`Share: ${top[0].name} ${pct(top[0].percent)}`)} onPress={()=>void shareCity(top[0])} style={{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,minHeight:46,borderRadius:14,backgroundColor:hubTint(teal,dark)}}>
     <Share2 size={16} color={teal}/><Copy bold size={13} style={{color:teal}}>{tx(`გააზიარე · ${top[0].name} ${pct(top[0].percent)}`,`Share · ${top[0].name} ${pct(top[0].percent)}`)}</Copy>
    </Pressable>:null}
   </Card>
  </Pressable>
 </Section>;
}
