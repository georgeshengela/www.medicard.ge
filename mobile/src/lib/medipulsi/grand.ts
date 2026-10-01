// MEDIRUN „გაანათე თბილისი“ grand prize: GET /api/medipulsi/grand and the formatting its screens share.
import {appLang,dateLocale,type AppLang} from '../../i18n/locale.js';
import {formatArea} from './territory.ts';

export type GrandStatus='upcoming'|'live'|'ended';
export type GrandLevel={id:string;name:string;percent:number;reached:boolean;unlocks:string};
export type GrandPrize={
 campaign:{id:string;name:string;status:GrandStatus;dropAt:string;prize:string;prizeDetail:string;rulesUrl:string};
 requirement:{areaId:string;city:string;percent:number;areaKm2:number};
 me:{percent:number;paintedKm2:number;eligible:boolean;remainingPercent:number;remainingKm2:number;remainingStreetKm:number}|null;
 levels:GrandLevel[];
 next:{id:string;name:string;percent:number;remainingStreetKm:number}|null;
};

const TBILISI='Asia/Tbilisi';
/** Georgia keeps UTC+4 all year (no DST) — the fallback when Intl has no time-zone data. */
const TBILISI_OFFSET_MS=4*3600_000;
const DAY_MS=86_400_000;
const MONTHS_KA=['იანვარი','თებერვალი','მარტი','აპრილი','მაისი','ივნისი','ივლისი','აგვისტო','სექტემბერი','ოქტომბერი','ნოემბერი','დეკემბერი'];
const MONTHS_EN=['January','February','March','April','May','June','July','August','September','October','November','December'];

const pick=(lang:AppLang,ka:string,en:string)=>lang==='en'?en:ka;

/** Fixed decimals; Georgian writes a decimal comma (0,23). */
export function grandNumber(n:number,digits:number,lang:AppLang=appLang()):string{
 const s=(Number.isFinite(n)?n:0).toFixed(digits);
 return lang==='en'?s:s.replace('.',',');
}

/** Share of the city with two decimals. A real but tiny share never shows as 0,00 %. */
export function grandPercent(p:number,lang:AppLang=appLang()):string{
 if(!Number.isFinite(p)||p<=0)return '0%';
 if(p<0.005)return `<${grandNumber(0.01,2,lang)}%`;
 return `${grandNumber(p,2,lang)}%`;
}

/** Level thresholds without trailing zeros: 0,1% · 0,25% · 1%. */
export function levelPercent(p:number,lang:AppLang=appLang()):string{
 const s=String(Math.round((Number.isFinite(p)?p:0)*100)/100);
 return `${lang==='en'?s:s.replace('.',',')}%`;
}

/** km² with two decimals once it is a real area; m² while it is small. */
export function grandArea(km2:number,lang:AppLang=appLang()):string{
 if(!(km2>0))return pick(lang,'0 კმ²','0 km²');
 if(km2<0.1)return formatArea(km2,lang);
 return `${grandNumber(km2,2,lang)} ${pick(lang,'კმ²','km²')}`;
}

/** Tbilisi wall clock for an instant. */
function tbilisiParts(at:Date){
 try{
  const parts=new Intl.DateTimeFormat('en-GB',{timeZone:TBILISI,year:'numeric',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(at);
  const get=(type:string)=>Number(parts.find(p=>p.type===type)?.value);
  const v={year:get('year'),month:get('month')-1,day:get('day'),hour:get('hour')%24,minute:get('minute')};
  if(Object.values(v).every(Number.isFinite))return v;
 }catch{/* no time-zone data on this runtime */}
 const t=new Date(at.getTime()+TBILISI_OFFSET_MS);
 return {year:t.getUTCFullYear(),month:t.getUTCMonth(),day:t.getUTCDate(),hour:t.getUTCHours(),minute:t.getUTCMinutes()};
}

/** „31 დეკემბერი, 12:00“ / "31 December, 12:00" — always Tbilisi time. */
export function dropLabel(iso:string,lang:AppLang=appLang(),locale:string=dateLocale()):string{
 const at=new Date(iso);
 if(!Number.isFinite(at.getTime()))return '';
 const p=tbilisiParts(at);
 let month=(lang==='en'?MONTHS_EN:MONTHS_KA)[p.month]||'';
 try{
  // The runtime's own month name when it really is in the app language (some Intl builds lack ka-GE).
  const m=new Intl.DateTimeFormat(locale,{month:'long',timeZone:TBILISI}).format(at);
  if(lang==='en'?/^[A-Za-z]+$/.test(m):/^[ა-ჿ]+$/.test(m))month=m;
 }catch{/* keep the built-in name */}
 const time=`${String(p.hour).padStart(2,'0')}:${String(p.minute).padStart(2,'0')}`;
 return `${p.day} ${month}, ${time}`;
}

/** Day + month only, for the hub card title. */
export function dropDay(iso:string,lang:AppLang=appLang(),locale:string=dateLocale()):string{
 return dropLabel(iso,lang,locale).split(',')[0]||'';
}

export type Countdown={kind:'days'|'today'|'live'|'ended';days:number;label:string};

/** Calendar days to the drop in Tbilisi: „დარჩა 91 დღე“ → „დღესაა“ → „დასრულდა“. */
export function grandCountdown(iso:string,status:GrandStatus,now:number=Date.now(),lang:AppLang=appLang()):Countdown{
 if(status==='ended')return {kind:'ended',days:0,label:pick(lang,'დასრულდა','Ended')};
 if(status==='live')return {kind:'live',days:0,label:pick(lang,'საჩუქარი ახლა ქალაქშია','The box is out now')};
 const at=new Date(iso);
 if(!Number.isFinite(at.getTime()))return {kind:'days',days:0,label:''};
 const a=tbilisiParts(new Date(now)),b=tbilisiParts(at);
 const days=Math.round((Date.UTC(b.year,b.month,b.day)-Date.UTC(a.year,a.month,a.day))/DAY_MS);
 if(days<=0)return {kind:'today',days:0,label:pick(lang,'დღესაა','Today')};
 return {kind:'days',days,label:pick(lang,`დარჩა ${days} დღე`,`${days} ${days===1?'day':'days'} left`)};
}

/** Genitive for the city name in Georgian copy: თბილისი → თბილისის. English keeps the name. */
export function cityOf(city:string,lang:AppLang=appLang()):string{
 const name=city.trim();
 if(lang==='en'||!name)return name;
 return /[ია]$/.test(name)?`${name.slice(0,-1)}ის`:`${name}-ის`;
}

/** What is still missing, in the unit a walker can act on. */
export function streetsLeftLabel(km:number,lang:AppLang=appLang()):string{
 const n=Math.ceil(Math.max(0,Number.isFinite(km)?km:0));
 if(n<1)return pick(lang,'დაგრჩა სულ ცოტა ახალი ქუჩა','Just a few new streets to go');
 return pick(lang,`დაგრჩა ≈ ${n} კმ ახალი ქუჩა`,`≈ ${n} km of new streets to go`);
}

/** A walk paints a ~100 m wide strip: 1 km of new street ≈ 0.1 km² (same rule as the server). */
export const KM2_PER_STREET_KM=0.1;
/** The whole goal as street length, for the how-to copy (1% of Tbilisi ≈ 50 km). */
export function goalStreetKm(req:GrandPrize['requirement']|null|undefined):number{
 if(!req||!(req.areaKm2>0)||!(req.percent>0))return 0;
 return Math.round(req.areaKm2*req.percent/100/KM2_PER_STREET_KM);
}

/** Ring / bar fill toward the goal, 0..1. */
export function grandProgress(data:Pick<GrandPrize,'me'|'requirement'>|null|undefined):number{
 const goal=data?.requirement.percent||0,mine=data?.me?.percent||0;
 if(!(goal>0)||!(mine>0))return 0;
 return data?.me?.eligible?1:Math.max(0,Math.min(1,mine/goal));
}

/** Only https rules pages open from the app. */
export function safeRulesUrl(url:unknown):string|null{
 if(typeof url!=='string')return null;
 try{const u=new URL(url);return u.protocol==='https:'?u.toString():null;}catch{return null;}
}
