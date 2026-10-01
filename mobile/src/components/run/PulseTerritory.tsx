import React,{useMemo,useRef,useState} from 'react';
import {Platform,Pressable,View,useWindowDimensions} from 'react-native';
import Svg,{Circle,Defs,G,Line,LinearGradient,RadialGradient,Rect,Stop,Text as SvgText,TSpan} from 'react-native-svg';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import {Share2,X} from 'lucide-react-native';
import {Modal,APP_MODAL_PROPS,APP_MODAL_OVERLAY} from '@/components/ui/appModal';
import {useThemeColors} from '@/theme/colors';
import {useAccountQuery} from '@/hooks/useAccountQuery';
import {FRESH} from '@/lib/queryClient';
import {pulseApi} from '@/lib/medipulsi/client';
import {formatArea,formatPercent,type Territory,type TerritoryArea} from '@/lib/medipulsi/territory';
import {appLang,tx} from '@/i18n/locale';
import {Action,Card,Copy,Section,BOLD,SEMIBOLD,REGULAR} from './PulseUi';

const W=1080,H=1350,TEAL='#2DD4BF',MINT='#99F6E4';

/** Deterministic little city: blocks along a lit path, unique per place but never the person's real route. */
function cityArt(seed:string,share:number){
 let h=2166136261;for(const ch of seed)h=Math.imul(h^ch.charCodeAt(0),16777619)>>>0;
 const rnd=()=>{h=Math.imul(h^(h>>>15),2246822507)>>>0;h=Math.imul(h^(h>>>13),3266489909)>>>0;return ((h^=h>>>16)>>>0)/4294967296;};
 const cols=9,rows=6,cw=104,ch=70,gap=14,x0=(W-cols*cw-(cols-1)*gap)/2,y0=250;
 // A walk across the grid: right/down steps through the street gaps.
 let cx=0,cy=Math.floor(rnd()*rows);const path:[number,number][]=[[cx,cy]];
 while(cx<cols){if(rnd()<.6||cy<=0&&rnd()<.5||cy>=rows-1)cx++;else cy+=rnd()<.5?-1:1;cy=Math.max(0,Math.min(rows-1,cy));path.push([cx,cy]);}
 const lit=new Set(path.map(([x,y])=>`${x}:${y}`));
 // A bigger share lights a few more neighbours, so a growing city looks fuller.
 const extra=Math.min(10,Math.floor(Math.log10(1+share*1e4)*2));
 for(let i=0;i<extra;i++){const [x,y]=path[Math.floor(rnd()*path.length)];lit.add(`${Math.min(cols-1,x+(rnd()<.5?0:1))}:${Math.max(0,Math.min(rows-1,y+(rnd()<.5?-1:1)))}`);}
 const blocks=[];for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){const on=lit.has(`${x}:${y}`);blocks.push({x:x0+x*(cw+gap),y:y0+y*(ch+gap),w:cw,h:ch*(on?1:.82+rnd()*.18),on});}
 const pts=path.map(([x,y])=>[x0+Math.min(x,cols-1)*(cw+gap)+(x>=cols?cw:-gap/2),y0+y*(ch+gap)+ch/2] as [number,number]);
 return {blocks,pts};
}

function ShareCard({city,country,paintedKm2,totalKm,lang}:{city:TerritoryArea|null;country:TerritoryArea|null;paintedKm2:number;totalKm:number;lang:'ka'|'en'}){
 const main=city||country;
 const percent=`${formatPercent(main?.percent||0)}%`;
 const art=useMemo(()=>cityArt(main?.id||'medirun',main?.percent||0),[main?.id,main?.percent]);
 const t=(ka:string,en:string)=>lang==='en'?en:ka;
 const name=main?.name||'';
 const stats=[
  country&&city?{label:country.name,value:`${formatPercent(country.percent)}%`}:null,
  {label:t('გაფერადებული','Painted'),value:formatArea(paintedKm2,lang)},
  {label:t('გავლილი','Walked'),value:`${totalKm.toFixed(1)} ${t('კმ','km')}`},
 ].filter(Boolean) as {label:string;value:string}[];
 return <>
  <Defs>
   <LinearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor="#030712"/><Stop offset=".62" stopColor="#06201F"/><Stop offset="1" stopColor="#042F2E"/></LinearGradient>
   <RadialGradient id="glow" cx="50%" cy="38%" r="55%"><Stop offset="0" stopColor={TEAL} stopOpacity=".28"/><Stop offset="1" stopColor={TEAL} stopOpacity="0"/></RadialGradient>
  </Defs>
  <Rect x="0" y="0" width={W} height={H} fill="url(#bg)"/>
  <Rect x="0" y="0" width={W} height={H} fill="url(#glow)"/>
  <SvgText x={W/2} y="118" textAnchor="middle" fontFamily={BOLD} fontSize="64" fill="#FFFFFF" letterSpacing="2">MEDI<TSpan fill={TEAL} fontStyle="italic">RUN</TSpan></SvgText>
  <SvgText x={W/2} y="178" textAnchor="middle" fontFamily={SEMIBOLD} fontSize="32" fill={MINT}>{t('ჩემი გაფერადებული ქალაქი','My painted city')}</SvgText>
  <G>{art.blocks.map((b,i)=><Rect key={i} x={b.x} y={b.y+(70-b.h)} width={b.w} height={b.h} rx="14" fill={b.on?TEAL:'#1F2937'} fillOpacity={b.on?.9:.75}/>)}</G>
  {art.pts.slice(1).map((p,i)=><Line key={i} x1={art.pts[i][0]} y1={art.pts[i][1]} x2={p[0]} y2={p[1]} stroke={MINT} strokeWidth="10" strokeLinecap="round" strokeOpacity=".95"/>)}
  <Circle cx={art.pts.at(-1)![0]} cy={art.pts.at(-1)![1]} r="16" fill="#FFFFFF"/><Circle cx={art.pts.at(-1)![0]} cy={art.pts.at(-1)![1]} r="30" fill={MINT} fillOpacity=".25"/>
  <SvgText x={W/2} y="858" textAnchor="middle" fontFamily={BOLD} fontSize={Math.min(76,1500/Math.max(1,name.length))} fill="#FFFFFF">{name}</SvgText>
  <SvgText x={W/2} y="1000" textAnchor="middle" fontFamily={BOLD} fontSize={Math.min(150,1650/percent.length)} fill={TEAL} letterSpacing="-2">{percent}</SvgText>
  <SvgText x={W/2} y="1056" textAnchor="middle" fontFamily={REGULAR} fontSize="32" fill="#C5DADA">{city?t('ქალაქის ფართობიდან გაფერადებულია','of the city is painted'):t('ქვეყნის ფართობიდან გაფერადებულია','of the country is painted')}</SvgText>
  <Line x1="90" y1="1108" x2={W-90} y2="1108" stroke="#FFFFFF" strokeOpacity=".12" strokeWidth="2"/>
  {stats.map((s,i)=>{const x=W/(stats.length*2)*(i*2+1);return <G key={s.label}>
   <SvgText x={x} y="1180" textAnchor="middle" fontFamily={BOLD} fontSize={Math.min(44,640/stats.length/Math.max(4,s.value.length)*1.7)} fill="#FFFFFF">{s.value}</SvgText>
   <SvgText x={x} y="1226" textAnchor="middle" fontFamily={REGULAR} fontSize="26" fill="#9CA3AF">{s.label}</SvgText>
  </G>;})}
  <SvgText x={W/2} y="1305" textAnchor="middle" fontFamily={SEMIBOLD} fontSize="28" fill={MINT} fillOpacity=".8">{t('გაფერადე შენი ქალაქიც · medicard.ge','Paint your city too · medicard.ge')}</SvgText>
 </>;
}

export function PulseTerritory({totalKm,walks}:{totalKm:number;walks:number}){
 const c=useThemeColors(),lang=appLang()==='en'?'en':'ka';
 const query=useAccountQuery<Territory>({key:['medirun','territory',walks],fetch:()=>pulseApi<Territory>('/territory'),staleTime:FRESH.SHORT,refetchInterval:q=>q.state.data?.pending?15_000:false});
 const data=query.data;
 const [open,setOpen]=useState(false),[pick,setPick]=useState<string|null>(null);
 const city=data?.cities.find(a=>a.id===pick)||data?.cities[0]||null;
 const country=data?.countries.find(a=>a.countryCode===city?.countryCode)||data?.countries[0]||null;
 const has=Boolean(data&&data.paintedKm2>0);
 return <Section title={tx('ჩემი გაფერადებული ქალაქი','My painted city')}>
  <Card style={{gap:14}}>
   {!data?<Copy muted size={12}>{query.isError?tx('პროგრესი ვერ ჩაიტვირთა.','Couldn’t load your progress.'):tx('ვითვლით შენს ფერად ქუჩებს…','Counting your coloured streets…')}</Copy>
   :!has?<View style={{gap:4}}><Copy bold size={16}>{tx('ქალაქი შენს ფერს ელოდება','The city is waiting for your colour')}</Copy><Copy muted size={12}>{tx('გაისეირნე და აქ ნახავ, ქალაქისა და ქვეყნის რა ნაწილი გააფერადე. ზუსტად, თუნდაც 0.0001%.','Go for a walk to see how much of your city and country you’ve painted — exactly, even 0.0001%.')}</Copy></View>
   :<>
    <View style={{gap:2}}>
     <Copy muted size={12}>{city?city.name:country?.name}</Copy>
     <View style={{flexDirection:'row',alignItems:'baseline',gap:6}}><Copy bold size={34} style={{lineHeight:44,letterSpacing:-1,color:c.primary200,fontVariant:['tabular-nums']}}>{formatPercent((city||country)?.percent||0)}%</Copy></View>
     <Copy muted size={12}>{city?tx('ქალაქის ფართობიდან გაფერადებულია','of the city is painted'):tx('ქვეყნის ფართობიდან','of the country')}</Copy>
    </View>
    <View style={{flexDirection:'row',borderTopWidth:1,borderColor:c.bg200,paddingTop:12}}>
     {[country&&city?{v:`${formatPercent(country.percent)}%`,l:country.name}:null,{v:formatArea(data!.paintedKm2,lang),l:tx('გაფერადებული','Painted')},{v:`${formatPercent(data!.world.percent)}%`,l:tx('მსოფლიოს','Of the world')}].filter(Boolean).map(s=><View key={s!.l} style={{flex:1,gap:2}}><Copy bold size={14} numberOfLines={1} style={{fontVariant:['tabular-nums']}}>{s!.v}</Copy><Copy muted size={11} numberOfLines={1}>{s!.l}</Copy></View>)}
    </View>
    {data!.cities.length>1?<View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>{data!.cities.slice(0,6).map(a=>{const on=a.id===city?.id;return <Pressable key={a.id} accessibilityRole="button" accessibilityState={{selected:on}} onPress={()=>setPick(a.id)} style={{paddingHorizontal:12,minHeight:34,justifyContent:'center',borderRadius:12,backgroundColor:on?c.accent100:c.bg200}}><Copy bold size={12} style={{color:on?c.primary100:c.text200}}>{a.name} · {formatPercent(a.percent)}%</Copy></Pressable>;})}</View>:null}
    {data!.pending?<Copy muted size={11}>{tx('ზოგი ადგილი ჯერ ითვლება — რამდენიმე წამში განახლდება.','Some places are still being counted — this updates in a few seconds.')}</Copy>:null}
    <Action label={tx('პროგრესის გაზიარება','Share my progress')} icon={Share2} onPress={()=>setOpen(true)}/>
   </>}
  </Card>
  {has?<ShareSheet visible={open} onClose={()=>setOpen(false)} city={city} country={country} paintedKm2={data!.paintedKm2} totalKm={totalKm} lang={lang}/>:null}
 </Section>;
}

function ShareSheet({visible,onClose,...card}:{visible:boolean;onClose:()=>void;city:TerritoryArea|null;country:TerritoryArea|null;paintedKm2:number;totalKm:number;lang:'ka'|'en'}){
 const c=useThemeColors(),{width,height}=useWindowDimensions();
 const svg=useRef<Svg>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const w=Math.min(width-48,(height-260)*W/H,380),h=w*H/W;
 const share=()=>{
  if(busy)return;setError('');
  if(Platform.OS==='web'){setError(tx('სურათის გაზიარება აპიდან შეგიძლია.','You can share the picture from the app.'));return;}
  setBusy(true);
  (svg.current as unknown as {toDataURL:(cb:(b64:string)=>void,o?:{width:number;height:number})=>void}).toDataURL(async b64=>{
   try{
    const uri=`${FileSystem.cacheDirectory}medirun-progress-${Date.now()}.png`;
    await FileSystem.writeAsStringAsync(uri,b64,{encoding:FileSystem.EncodingType.Base64});
    if(!(await Sharing.isAvailableAsync()))throw new Error('unavailable');
    await Sharing.shareAsync(uri,{mimeType:'image/png',UTI:'public.png',dialogTitle:tx('MEDIRUN პროგრესის გაზიარება','Share MEDIRUN progress')});
   }catch{setError(tx('გაზიარება ვერ მოხერხდა. სცადე თავიდან.','Couldn’t share. Please try again.'));}
   finally{setBusy(false);}
  },{width:W,height:H});
 };
 return <Modal visible={visible} {...APP_MODAL_PROPS} onRequestClose={onClose}>
  <View style={{flex:1,alignItems:'center',justifyContent:'center',padding:24}}>
   <Pressable accessibilityRole="button" accessibilityLabel={tx('დახურვა','Close')} onPress={onClose} style={{position:'absolute',inset:0,backgroundColor:APP_MODAL_OVERLAY}}/>
   <View style={{width:w+24,backgroundColor:c.surface,borderRadius:26,padding:12,gap:12}}>
    <View style={{borderRadius:18,overflow:'hidden'}}><Svg ref={svg} width={w} height={h} viewBox={`0 0 ${W} ${H}`}><ShareCard {...card}/></Svg></View>
    {error?<Copy size={12} style={{color:c.danger,textAlign:'center'}}>{error}</Copy>:null}
    <View style={{flexDirection:'row',gap:10}}>
     <View style={{flex:1}}><Action secondary label={tx('დახურვა','Close')} icon={X} onPress={onClose}/></View>
     <View style={{flex:1.4}}><Action label={tx('გაზიარება','Share')} icon={Share2} busy={busy} onPress={share}/></View>
    </View>
   </View>
  </View>
 </Modal>;
}
