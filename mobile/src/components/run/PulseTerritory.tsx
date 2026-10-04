import React,{useMemo,useRef,useState} from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Switch } from '@/components/ui/AppSwitch';
import Svg,{Circle,Defs,G,Line,LinearGradient,Path,RadialGradient,Rect,Stop,Text as SvgText,TSpan} from 'react-native-svg';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import {ChevronRight,Map as MapIcon,Share2,X} from 'lucide-react-native';
import {Modal,APP_MODAL_PROPS,APP_MODAL_OVERLAY} from '@/components/ui/appModal';
import {useThemeColors} from '@/theme/colors';
import {useAccountQuery} from '@/hooks/useAccountQuery';
import {FRESH} from '@/lib/queryClient';
import {pulseApi} from '@/lib/medipulsi/client';
import {formatArea,formatPercent,type Territory,type TerritoryArea,type TerritoryMap} from '@/lib/medipulsi/territory';
import {appLang,tx} from '@/i18n/locale';
import {Action,Card,Copy,Section,Sheet,BOLD,SEMIBOLD,REGULAR} from './PulseUi';
import {Bone} from '@/components/ui/Skeleton';

const W=1080,H=1350,TEAL='#2DD4BF',MINT='#99F6E4';

/** Deterministic little city: a walk along its streets lights the blocks beside it. Unique per place, never the person's real route. */
function cityArt(seed:string,share:number){
 let h=2166136261;for(const ch of seed)h=Math.imul(h^ch.charCodeAt(0),16777619)>>>0;
 const rnd=()=>{h=Math.imul(h^(h>>>15),2246822507)>>>0;h=Math.imul(h^(h>>>13),3266489909)>>>0;return ((h^=h>>>16)>>>0)/4294967296;};
 const cols=9,rows=6,cw=96,ch=64,gap=22,x0=(W-cols*cw-(cols-1)*gap)/2,y0=250;
 const at=(i:number,j:number):[number,number]=>[x0-gap/2+i*(cw+gap),y0-gap/2+j*(ch+gap)];
 // Street intersections (i,j): mostly forward, sometimes a turn, edge to edge.
 let i=0,j=1+Math.floor(rnd()*(rows-1));const path:[number,number][]=[[i,j]],lit=new Set<string>();
 const light=(x:number,y:number)=>{if(x>=0&&x<cols&&y>=0&&y<rows)lit.add(`${x}:${y}`);};
 while(i<cols&&path.length<40){
  const turn=rnd()<.42,dj=j<=1?1:j>=rows-1?-1:rnd()<.5?-1:1;
  if(turn&&i>0){light(i-1,Math.min(j,j+dj));light(i,Math.min(j,j+dj));j+=dj;}else{light(i,j-1);light(i,j);i++;}
  path.push([i,j]);
 }
 // A bigger share lights a few more blocks, so a growing city looks fuller.
 const extra=Math.min(10,Math.floor(Math.log10(1+share*1e4)*2));
 for(let k=0;k<extra;k++){const [pi,pj]=path[Math.floor(rnd()*path.length)];light(Math.min(cols-1,pi),pj-(rnd()<.5?1:0));}
 const blocks=[];for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){const on=lit.has(`${x}:${y}`);blocks.push({x:x0+x*(cw+gap),y:y0+y*(ch+gap),w:cw,h:on?ch:ch*(.78+rnd()*.22),on});}
 return {blocks,pts:path.map(([a,b])=>at(a,b)),ch};
}

const MAP_BOX={x:90,y:212,w:900,h:566};
/** The real city outline as a quiet dot grid; painted squares glow. Built once per city as a few long paths. */
function mapArt(map:TerritoryMap){
 const s=Math.min(MAP_BOX.w/map.cols,MAP_BOX.h/map.rows),ox=MAP_BOX.x+(MAP_BOX.w-map.cols*s)/2,oy=MAP_BOX.y+(MAP_BOX.h-map.rows*s)/2;
 const f=(n:number)=>n.toFixed(1),dot=s*.13,sq=s*.78,halo=s*1.7;
 let dots='',glow='',n=0,sx=0,sy=0;const lit:string[]=Array(8).fill('');
 map.grid.forEach((row,y)=>{for(let x=0;x<row.length;x++){const v=row.charCodeAt(x)-48;if(v<=0)continue;const cx=ox+(x+.5)*s,cy=oy+(y+.5)*s;
  if(v===1){dots+=`M${f(cx-dot)} ${f(cy)}a${f(dot)} ${f(dot)} 0 1 0 ${f(dot*2)} 0a${f(dot)} ${f(dot)} 0 1 0 ${f(-dot*2)} 0`;continue;}
  n++;sx+=cx;sy+=cy;
  glow+=`M${f(cx-halo)} ${f(cy)}a${f(halo)} ${f(halo)} 0 1 0 ${f(halo*2)} 0a${f(halo)} ${f(halo)} 0 1 0 ${f(-halo*2)} 0`;
  lit[Math.min(7,v-2)]+=`M${f(cx-sq/2)} ${f(cy-sq/2)}h${f(sq)}v${f(sq)}h${f(-sq)}z`;
 }});
 const outline=map.outline.map(r=>r.map(([x,y],i)=>`${i?'L':'M'}${f(ox+x*s)} ${f(oy+y*s)}`).join('')+'Z').join('');
 // A small painted spot on a big city gets rings, so it reads at a glance.
 return {dots,glow,lit,outline,spot:n&&n<=12?{x:sx/n,y:sy/n}:null};
}

function ShareCard({city,country,paintedKm2,totalKm,lang,showMap=true}:{city:TerritoryArea|null;country:TerritoryArea|null;paintedKm2:number;totalKm:number;lang:'ka'|'en';showMap?:boolean}){
 const main=city||country;
 const percent=`${formatPercent(main?.percent||0)}%`;
 const art=useMemo(()=>cityArt(main?.id||'medirun',main?.percent||0),[main?.id,main?.percent]);
 const real=useMemo(()=>showMap&&city?.map?mapArt(city.map):null,[showMap,city?.map]);
 const t=(ka:string,en:string)=>lang==='en'?en:ka;
 const name=main?.name||'';
 const stats=[
  country&&city?{label:country.name,value:`${formatPercent(country.percent)}%`}:null,
  {label:t('გაფერადებული','Painted'),value:formatArea(main?.paintedKm2??paintedKm2,lang)},
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
  {real?<G>
   <Path d={real.outline} fill="#0B1F22" fillOpacity=".85" stroke={MINT} strokeOpacity=".38" strokeWidth="3" strokeLinejoin="round" fillRule="evenodd"/>
   <Path d={real.dots} fill="#FFFFFF" fillOpacity=".16"/>
   <Path d={real.glow} fill={TEAL} fillOpacity=".16"/>
   {real.lit.map((d,i)=>d?<Path key={i} d={d} fill={i>=5?MINT:TEAL} fillOpacity={.62+i*.05}/>:null)}
   {real.spot?<G><Circle cx={real.spot.x} cy={real.spot.y} r="38" fill="none" stroke={MINT} strokeOpacity=".6" strokeWidth="3"/><Circle cx={real.spot.x} cy={real.spot.y} r="66" fill="none" stroke={MINT} strokeOpacity=".25" strokeWidth="2"/></G>:null}
  </G>:<G>
   {art.blocks.map((b,i)=><Rect key={i} x={b.x} y={b.y+(art.ch-b.h)} width={b.w} height={b.h} rx="14" fill={b.on?TEAL:'#1F2937'} fillOpacity={b.on?.9:.75}/>)}
   {art.pts.slice(1).map((p,i)=><Line key={'g'+i} x1={art.pts[i][0]} y1={art.pts[i][1]} x2={p[0]} y2={p[1]} stroke={TEAL} strokeWidth="26" strokeLinecap="round" strokeOpacity=".22"/>)}
   {art.pts.slice(1).map((p,i)=><Line key={i} x1={art.pts[i][0]} y1={art.pts[i][1]} x2={p[0]} y2={p[1]} stroke={MINT} strokeWidth="9" strokeLinecap="round"/>)}
   <Circle cx={art.pts.at(-1)![0]} cy={art.pts.at(-1)![1]} r="16" fill="#FFFFFF"/><Circle cx={art.pts.at(-1)![0]} cy={art.pts.at(-1)![1]} r="30" fill={MINT} fillOpacity=".25"/>
  </G>}
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

/** A football pitch (105 × 68 m) — the size people picture when an area is named. */
const PITCH_KM2=0.00714;

/** „84 ჰექტარი · ≈118 საფეხბურთო მოედანი“ — the painted area in words a person can picture. */
function areaWords(km2:number,pitchesToo=true):string{
 const pitches=Math.round(km2/PITCH_KM2),ha=km2*100;
 const size=ha>=1?tx(`${ha>=10?Math.round(ha):ha.toFixed(1)} ჰექტარი`,`${ha>=10?Math.round(ha):ha.toFixed(1)} hectares`):tx(`${Math.max(100,Math.round(km2*1e6/100)*100)} მ²`,`${Math.max(100,Math.round(km2*1e6/100)*100)} m²`);
 return pitchesToo&&pitches>=1?tx(`${size} · ≈${pitches} საფეხბურთო მოედანი`,`${size} · ≈${pitches} football ${pitches===1?'pitch':'pitches'}`):size;
}

/** The city outline with the painted streets glowing — the same drawing the share picture uses, small. */
function MiniMap({area,size}:{area:TerritoryArea;size:number}){
 const art=useMemo(()=>area.map?mapArt(area.map):null,[area.map]);
 return <View style={{width:size,height:size,borderRadius:18,backgroundColor:'#0B1F22',overflow:'hidden',alignItems:'center',justifyContent:'center'}} accessible={false} importantForAccessibility="no-hide-descendants">
  {art?<Svg width={size} height={size} viewBox={`${MAP_BOX.x-20} ${MAP_BOX.y-20} ${MAP_BOX.w+40} ${MAP_BOX.h+40}`} preserveAspectRatio="xMidYMid meet">
   <Path d={art.outline} fill="#10292D" stroke={MINT} strokeOpacity=".45" strokeWidth="8" strokeLinejoin="round" fillRule="evenodd"/>
   <Path d={art.glow} fill={TEAL} fillOpacity=".22"/>
   {art.lit.map((d,i)=>d?<Path key={i} d={d} fill={i>=5?MINT:TEAL} fillOpacity={.75+i*.03}/>:null)}
   {art.spot?<Circle cx={art.spot.x} cy={art.spot.y} r="70" fill="none" stroke={MINT} strokeOpacity=".7" strokeWidth="8"/>:null}
  </Svg>:<MapIcon size={Math.round(size*.36)} color={MINT}/>}
 </View>;
}

/**
 * „ჩემი ქალაქი“ (owner 2026-10-04 redesign): one compact card however many cities there are — the
 * most-painted city with its little map, its share in big type, the area in words (hectares and
 * football pitches instead of 840 000 m²), this week's new streets, one line on how painting works,
 * and the other cities folded into one row that opens the full list. World and country shares, which
 * stay near zero for a long time, live in that list only. Share is a link in the heading.
 */
export function PulseTerritory({totalKm,walks,weekNewKm=0}:{totalKm:number;walks:number;weekNewKm?:number}){
 const c=useThemeColors(),lang=appLang()==='en'?'en':'ka';
 const query=useAccountQuery<Territory>({key:['medirun','territory',walks],fetch:()=>pulseApi<Territory>('/territory'),staleTime:FRESH.SHORT,refetchInterval:q=>q.state.data?.pending?15_000:false});
 const data=query.data;
 const [open,setOpen]=useState(false),[list,setList]=useState(false),[pick,setPick]=useState<string|null>(null);
 const cities=useMemo(()=>[...(data?.cities||[])].sort((a,b)=>b.paintedKm2-a.paintedKm2),[data?.cities]);
 const city=cities.find(a=>a.id===pick)||cities[0]||null;
 const country=data?.countries.find(a=>a.countryCode===city?.countryCode)||data?.countries[0]||null;
 const main=city||country;
 const has=Boolean(data&&data.paintedKm2>0&&main);
 const others=cities.filter(a=>a.id!==city?.id);
 const howTo=tx('ყოველი ახალი ქუჩა რუკაზე ~100 მ სიგანის ზოლად ფერადდება.','Every new street paints a ~100 m wide band on the map.');

 return <Section title={tx('ჩემი ქალაქი','My city')} link={has?tx('გაზიარება','Share'):undefined} onLink={has?()=>setOpen(true):undefined}>
  <Card style={{gap:14}}>
   {!data?(query.isError
    ?<View style={{gap:8}}><Copy bold size={15}>{tx('ქალაქი ვერ ჩაიტვირთა','Couldn’t load your city')}</Copy><Action secondary label={tx('ხელახლა ცდა','Try again')} onPress={()=>void query.refetch()}/></View>
    :<View style={{flexDirection:'row',gap:14,alignItems:'center'}}><Bone width={92} height={92} radius={18}/><View style={{flex:1,gap:8}}><Bone width={90} height={12}/><Bone width={120} height={30}/><Bone height={12}/></View></View>)
   :!has?<View style={{flexDirection:'row',gap:14,alignItems:'center'}}>
     <View style={{width:72,height:72,borderRadius:18,backgroundColor:'#0B1F22',alignItems:'center',justifyContent:'center'}}><MapIcon size={28} color={MINT}/></View>
     <View style={{flex:1,gap:4}}><Copy bold size={15}>{tx('ქალაქი შენს ფერს ელოდება','The city is waiting for your colour')}</Copy><Copy muted size={12}>{tx('გაისეირნე — აქ ნახავ, ქალაქის რა ნაწილი გაანათე. ',"Go for a walk to see how much of your city you’ve lit. ")}{howTo}</Copy></View>
    </View>
   :<>
    <View style={{flexDirection:'row',gap:14,alignItems:'center'}}>
     <MiniMap area={main!} size={92}/>
     <View style={{flex:1,minWidth:0,gap:1}}>
      <Copy muted size={12} numberOfLines={1}>{main!.name}</Copy>
      <Copy bold size={30} style={{lineHeight:38,letterSpacing:-.8,color:c.primary200,fontVariant:['tabular-nums']}}>{formatPercent(main!.percent)}%</Copy>
      <Copy muted size={12} numberOfLines={1}>{city?tx('ქალაქიდან გაანათე','of the city lit'):tx('ქვეყნიდან გაანათე','of the country lit')}</Copy>
     </View>
    </View>
    <View style={{gap:4,borderTopWidth:1,borderColor:c.bg200,paddingTop:12}}>
     <Copy bold size={13} numberOfLines={1}>{areaWords(main!.paintedKm2)}</Copy>
     {weekNewKm>0?<Copy muted size={12}>{tx(`ბოლო 7 დღეში ${weekNewKm.toFixed(1)} კმ ახალი ქუჩა`,`${weekNewKm.toFixed(1)} km of new streets in the last 7 days`)}</Copy>:null}
     <Copy muted size={11}>{howTo}</Copy>
     {data!.pending?<Copy muted size={11}>{tx('ზოგი ადგილი ჯერ ითვლება — რამდენიმე წამში განახლდება.','Some places are still being counted — this updates in a few seconds.')}</Copy>:null}
    </View>
    {others.length?<Pressable accessibilityRole="button" accessibilityLabel={tx(`ყველა ქალაქი, ${cities.length}`,`All cities, ${cities.length}`)} onPress={()=>setList(true)} style={{flexDirection:'row',alignItems:'center',gap:10,minHeight:44,borderTopWidth:1,borderColor:c.bg200,paddingTop:10}}>
     <Copy size={12} numberOfLines={1} style={{flex:1,color:c.text200}}><Copy bold size={12}>{tx(`კიდევ ${others.length} ქალაქი: `,`${others.length} more ${others.length===1?'city':'cities'}: `)}</Copy>{others.slice(0,3).map(a=>`${a.name} ${formatPercent(a.percent)}%`).join(' · ')}</Copy>
     <ChevronRight size={16} color={c.text300}/>
    </Pressable>:null}
   </>}
  </Card>
  {has?<ShareSheet visible={open} onClose={()=>setOpen(false)} cities={cities.slice(0,6)} onPick={setPick} city={city} country={country} paintedKm2={data!.paintedKm2} totalKm={totalKm} lang={lang}/>:null}
  {has?<Sheet title={tx('ჩემი ქალაქები','My cities')} visible={list} onClose={()=>setList(false)}>
   <Card style={{paddingVertical:4,gap:0}}>{cities.map((a,i)=><Pressable key={a.id} accessibilityRole="button" accessibilityState={{selected:a.id===city?.id}} onPress={()=>{setPick(a.id);setList(false);}} style={{flexDirection:'row',alignItems:'center',gap:12,minHeight:60,paddingVertical:10,borderTopWidth:i?1:0,borderColor:c.bg200}}>
    <MiniMap area={a} size={44}/>
    <View style={{flex:1,minWidth:0}}><Copy bold size={14} numberOfLines={1}>{a.name}</Copy><Copy muted size={11} numberOfLines={1}>{areaWords(a.paintedKm2,false)}</Copy></View>
    <Copy bold size={15} style={{color:c.primary200,fontVariant:['tabular-nums']}}>{formatPercent(a.percent)}%</Copy>
   </Pressable>)}</Card>
   {(data?.countries||[]).length?<Section title={tx('ქვეყნები და მსოფლიო','Countries and the world')}>
    <Card style={{paddingVertical:4,gap:0}}>
     {data!.countries.map((a,i)=><View key={a.id} style={{flexDirection:'row',alignItems:'center',minHeight:48,borderTopWidth:i?1:0,borderColor:c.bg200}}><Copy size={13} style={{flex:1}}>{a.name}</Copy><Copy bold size={13} style={{fontVariant:['tabular-nums']}}>{formatPercent(a.percent)}%</Copy></View>)}
     <View style={{flexDirection:'row',alignItems:'center',minHeight:48,borderTopWidth:1,borderColor:c.bg200}}><Copy size={13} style={{flex:1}}>{tx('მსოფლიო','The world')}</Copy><Copy bold size={13} style={{fontVariant:['tabular-nums']}}>{formatPercent(data!.world.percent)}%</Copy></View>
    </Card>
   </Section>:null}
   <Copy muted size={11}>{tx(`სულ გაანათე: ${areaWords(data!.paintedKm2)}. `,`In total you lit ${areaWords(data!.paintedKm2)}. `)}{howTo}</Copy>
  </Sheet>:null}
 </Section>;
}

function ShareSheet({visible,onClose,cities,onPick,...card}:{visible:boolean;onClose:()=>void;cities:TerritoryArea[];onPick:(id:string)=>void;city:TerritoryArea|null;country:TerritoryArea|null;paintedKm2:number;totalKm:number;lang:'ka'|'en'}){
 const c=useThemeColors(),{width,height}=useWindowDimensions();
 const svg=useRef<Svg>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[showMap,setShowMap]=useState(true);
 const sheet=Math.min(width-32,420),hasMap=Boolean(card.city?.map);
 const w=Math.max(200,Math.min(sheet-32,(height-(cities.length>1?400:350))*W/H)),h=w*H/W;
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
  <View style={{flex:1,alignItems:'center',justifyContent:'center',padding:16}}>
   <Pressable accessibilityRole="button" accessibilityLabel={tx('დახურვა','Close')} onPress={onClose} style={[StyleSheet.absoluteFill,{backgroundColor:APP_MODAL_OVERLAY}]}/>
   <View style={{width:sheet,backgroundColor:c.surface,borderRadius:28,paddingVertical:16,gap:14}}>
    <View style={{flexDirection:'row',alignItems:'center',gap:12,paddingHorizontal:18}}>
     <View style={{flex:1}}><Copy bold size={17}>{tx('გააზიარე შენი პროგრესი','Share your progress')}</Copy><Copy muted size={11}>{tx('Instagram-ის და Facebook-ის ზომა','Sized for Instagram and Facebook')}</Copy></View>
     <Pressable accessibilityRole="button" accessibilityLabel={tx('დახურვა','Close')} onPress={onClose} hitSlop={8} style={{width:36,height:36,borderRadius:18,backgroundColor:c.bg200,alignItems:'center',justifyContent:'center'}}><X size={18} color={c.text200}/></Pressable>
    </View>
    <View style={{alignItems:'center'}}><View style={{width:w,height:h,borderRadius:20,overflow:'hidden',backgroundColor:'#030712'}}>
     <Svg ref={svg} width={w} height={h} viewBox={`0 0 ${W} ${H}`}><ShareCard {...card} showMap={showMap}/></Svg>
    </View></View>
    {cities.length>1?<ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:8,paddingHorizontal:18}}>{cities.map(a=>{const on=a.id===card.city?.id;return <Pressable key={a.id} accessibilityRole="button" accessibilityState={{selected:on}} onPress={()=>onPick(a.id)} style={{paddingHorizontal:12,minHeight:34,justifyContent:'center',borderRadius:12,backgroundColor:on?c.accent100:c.bg200}}><Copy bold size={12} style={{color:on?c.primary100:c.text200}}>{a.name} · {formatPercent(a.percent)}%</Copy></Pressable>;})}</ScrollView>:null}
    {hasMap?<View style={{flexDirection:'row',alignItems:'center',gap:12,marginHorizontal:18,paddingHorizontal:12,paddingVertical:10,borderRadius:16,backgroundColor:c.bg200}}>
     <MapIcon size={18} color={c.primary200}/>
     <View style={{flex:1}}><Copy bold size={13}>{tx('რუკა სურათზე','Map on the picture')}</Copy><Copy muted size={11}>{tx('ჩანს უბნები, სადაც გაისეირნე — ზუსტი გზა არა','Shows the areas you walked, not your exact route')}</Copy></View>
     <Switch value={showMap} onValueChange={setShowMap} trackColor={{true:c.primary200,false:c.bg300}} thumbColor="#FFFFFF" accessibilityLabel={tx('რუკა სურათზე','Map on the picture')}/>
    </View>:null}
    {error?<Copy size={12} style={{color:c.danger,textAlign:'center',paddingHorizontal:18}}>{error}</Copy>:null}
    <View style={{paddingHorizontal:18}}><Action label={tx('გაზიარება','Share')} icon={Share2} busy={busy} onPress={share}/></View>
   </View>
  </View>
 </Modal>;
}
