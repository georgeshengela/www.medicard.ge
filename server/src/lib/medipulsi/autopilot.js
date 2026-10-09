// MEDIRUN campaign autopilot: places the „გაანათე თბილისი“ gift boxes by itself.
// Plan = pure function of (campaign config, spot list, date): the same day always gives the same boxes, so the
// job, the CLI preview and a re-run after a crash never disagree. Owner rule: Monday–Friday few small boxes,
// weekends better ones, December the grand prize; boxes sit deep inside parks (harder to find, still on paths).
// Waves rotate through all ten districts without reusing a spot until the whole list has been visited (evening
// waves only on lit paths); each week adds a few boxes in its theme area. Saturdays 16:00 = one park gets a coin
// rain (and, from November, a few „lantern“ boxes only for players with 0.25% of Tbilisi lit).
// 31 December = the grand prize, visible only from 1% of Tbilisi.
// Spots: server/src/data/medirun-spots-tbilisi.json (OpenStreetMap footway nodes inside public parks/squares).
import {dispatchWaveAlerts} from './waveAlerts.js';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {prisma} from '../prisma.js';
import {isFeatureEnabled} from '../featureFlags.js';
import {acquireJobLease} from '../jobLease.js';
import {upsertGiftRule,giftRules,ensureGiftRuleTable,normalizeDecay,maxPayout} from './giftRules.js';
import {FILE_CAMPAIGN,getCampaign,economyOf} from './campaignStore.js';
import {budgetGate,payWeeklyPrizes} from './economy.js';
import {detectCities,nextHarvest,harvestCity,listCities,citySpots,planCityDay,cityDates} from './cities.js';

const DATA=new URL('../../data/',import.meta.url);
/** The repo default; the live rules come from getCampaign() (admin #/medirun-boxes can change them). */
export const CAMPAIGN=FILE_CAMPAIGN;
let SPOTS=null;
export function loadSpots(){
 if(SPOTS)return SPOTS;
 try{SPOTS=JSON.parse(readFileSync(new URL('medirun-spots-tbilisi.json',DATA),'utf8'));}catch{SPOTS={spots:[],golden:{}};}
 return SPOTS;
}
const DAY=86400_000;

/* ───────── deterministic helpers ───────── */
export function hashSeed(text){let h=2166136261;for(const ch of String(text))h=Math.imul(h^ch.charCodeAt(0),16777619)>>>0;return h>>>0;}
export function rng(seed){let s=hashSeed(seed)||1;return ()=>{s=Math.imul(s^(s>>>15),2246822507)>>>0;s=Math.imul(s^(s>>>13),3266489909)>>>0;return ((s^=s>>>16)>>>0)/4294967296;};}
function shuffle(list,seed){const r=rng(seed),a=[...list];for(let i=a.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function weighted(options,r){const total=options.reduce((s,o)=>s+o.weight,0);let x=r()*total;for(const o of options){x-=o.weight;if(x<0)return o.amount;}return options.at(-1).amount;}
export const dateAdd=(date,days)=>new Date(Date.parse(`${date}T00:00:00Z`)+days*DAY).toISOString().slice(0,10);
export const daysBetween=(a,b)=>Math.round((Date.parse(`${b}T00:00:00Z`)-Date.parse(`${a}T00:00:00Z`))/DAY);
export const tbilisiDate=(now=Date.now())=>new Date(now+4*3600_000).toISOString().slice(0,10);
const stamp=(date,time,offset)=>new Date(`${date}T${time}:00${offset}`);
function metersBetween(a,b){const k=111_320,dx=(b[0]-a[0])*k*Math.cos((a[1]+b[1])/2*Math.PI/180),dy=(b[1]-a[1])*k;return Math.hypot(dx,dy);}
const at=s=>[s.lng,s.lat];

/** One long cycle through every spot: districts take turns, so any ~10 consecutive picks cover the whole city. */
export function rotationOrder(spots,seed){
 const byDistrict=new Map();
 for(const s of shuffle(spots,seed)){const d=s.district||'?';if(!byDistrict.has(d))byDistrict.set(d,[]);byDistrict.get(d).push(s);}
 const queues=shuffle([...byDistrict.values()],seed+':d'),out=[];
 while(queues.some(q=>q.length))for(const q of queues)if(q.length)out.push(q.shift());
 return out;
}
const pick=(order,from,count)=>order.length?Array.from({length:Math.min(count,order.length)},(_,i)=>order[(from+i)%order.length]):[];

function weekOf(campaign,date){return campaign.weeks.find(w=>date>=w.from&&date<=w.to)||null;}
function inFocus(week,spot){
 if(!week)return false;
 if(week.districts)return week.districts.includes(spot.district);
 if(week.kinds)return week.kinds.includes(spot.kind);
 if(week.anchors)return week.anchors.some(([lng,lat,r])=>metersBetween([lng,lat],at(spot))<=r);
 return false;
}

/** The box copy for a coin box: the first-finder ladder is part of the promise, so the text says it. */
export function coinCopy(coins,{minPercent=null,decay=null}={}){
 const lantern=Boolean(minPercent),steps=normalizeDecay(decay),ladder=steps&&steps.length>1&&steps[0]>steps.at(-1);
 const pct=String(minPercent).replace('.',',');
 return {
  title:`${coins} Medi Coins`,
  description:lantern
   ?`ფარნის ყუთი: მხოლოდ მათთვის, ვისაც თბილისის ${pct}% აქვს განათებული. პირველ გამხსნელს ${coins} Medi Coins${ladder?', შემდეგებს — ნაკლები':''}. ქოინები მაშინვე ჩაირიცხება.`
   :ladder?`პირველ გამხსნელს ${coins} Medi Coins, მეორეს ${steps[1]}%, შემდეგებს კიდევ ნაკლები. გახსენი და ქოინები მაშინვე ჩაირიცხება — დააგროვე და გადაცვალე ჯილდოებზე.`
   :`გახსენი ყუთი და ${coins} Medi Coins ავტომატურად ჩაირიცხება შენს ანგარიშზე. დააგროვე და გადაცვალე ჯილდოებზე.`,
  titleEn:`${coins} Medi Coins`,
  descriptionEn:lantern
   ?`Lantern box: only for players who have lit ${minPercent}% of Tbilisi. ${coins} Medi Coins for the first to open it${ladder?', less for the next ones':''}. The coins land at once.`
   :ladder?`${coins} Medi Coins for the first to open it, ${steps[1]}% for the second, less for the next ones. Open it and the coins land at once — collect them and swap them for rewards.`
   :`Open the box and ${coins} Medi Coins land in your account automatically. Collect them and swap them for rewards.`,
 };
}
export function coinGift(campaign,{id,spot,start,end,coins,stock,pulseRadius,revealRadius,kind,minPercent=null}){
 const decay=normalizeDecay(economyOf(campaign).decay)||null,copy=coinCopy(coins,{minPercent,decay});
 return {
  gift:{id,title:copy.title,description:copy.description,
   longitude:spot.lng,latitude:spot.lat,pulseRadius,revealRadius,rewardKind:'DIGITAL',stock,published:true,archived:false,startsAt:start,endsAt:end},
  rule:{giftId:id,campaign:campaign.id,coins,minPercent,areaId:minPercent?campaign.area.id:null,meta:{kind,spot:spot.id||null,place:spot.place||null,district:spot.district||null,
   ...(decay?{decay}:{}),titleEn:copy.titleEn,descriptionEn:copy.descriptionEn}},
 };
}

export const CITY_HELPERS={get rng(){return rng;},get rotationOrder(){return rotationOrder;},get coinGift(){return coinGift;},get dayKind(){return dayKind;},get daysBetween(){return daysBetween;}};
export const dayKind=date=>{const d=new Date(`${date}T00:00:00Z`).getUTCDay();return d===0||d===6?'weekend':'weekday';};
/**
 * The rules of one date: the weekday/weekend template, or the admin's override for that date
 * (`off` = no boxes that day, `as` = use the other template, `day` = its own waves / coins / stock).
 */
export function dayOf(campaign,date){
 const ov=campaign.dayOverrides?.[date]||null,kind=ov?.as||dayKind(date),base=campaign.days[kind];
 return {kind,off:Boolean(ov?.off),override:ov,day:ov?.day?{...base,...ov.day}:base};
}
const perDay=(day,lit)=>day.waves.filter(w=>Boolean(w.litOnly)===lit).reduce((s,w)=>s+w.rotation,0);
/** Rotation picks used by all campaign days before `date` (weekdays use fewer), so no spot repeats until the list ends. */
function usedBefore(campaign,date,lit){let n=0;for(let d=campaign.start;d<date;d=dateAdd(d,1)){const o=dayOf(campaign,d);if(!o.off)n+=perDay(o.day,lit);}return n;}

/** The grand prize spot: the configured golden key, else a fixed random path in a big named park (≥ 5 ha, not a forest). */
export function pickGrandSpot(campaign,spots,golden){
 const g=campaign.grand;if(g.spot&&golden?.[g.spot])return {id:g.spot,...golden[g.spot]};
 // Named, busy parks only (unnamed ridge or forest parks are too remote for a crowd). Set the real, secret spot
 // close to the day with `medirun-drops.mjs grand --spot …` — the plan below is public code.
 const big=spots.filter(s=>(s.areaM2||0)>=50_000&&s.place&&s.place!=='პარკი'&&!/ტყე|დენდრო/.test(s.place)&&!(Number(s.depthM)<20));
 return shuffle(big.length?big:spots,`${campaign.id}:grand`)[0]||null;
}

/** Every box of one Tbilisi date. Pure: no clock, no database. */
export function planDay(date,{campaign=CAMPAIGN,spots=loadSpots().spots,golden=loadSpots().golden}={}){
 // Spots the admin took out (a closed park, a bad path) never get a box.
 const excluded=new Set(campaign.excludedSpots||[]);
 if(excluded.size)spots=spots.filter(s=>!excluded.has(s.id));
 if(!spots?.length||date<campaign.start||date>campaign.end)return [];
 const {day,off}=dayOf(campaign,date);
 const out=[],seed=`${campaign.id}`,r=rng(`${seed}:${date}`),week=weekOf(campaign,date);
 // "Harder" places: only spots deep enough inside their park (when the list knows the depth).
 const g=campaign.grand,grandDay=Boolean(g&&date===g.dropAt.slice(0,10)),grandSpot=grandDay?pickGrandSpot(campaign,spots,golden):null;
 // On the grand-prize day no small box sits within 500 m of it, so the pulse never leads a hunter astray.
 const usable=grandSpot?spots.filter(s=>metersBetween(at(s),at(grandSpot))>500):spots;
 const deep=usable.filter(s=>!(Number(s.depthM)<(day.minDepthM||0))),pool=deep.length>=30?deep:usable;
 // Evening boxes: lit paths only, never forest parks (dark in November and December).
 const lit=pool.filter(s=>(s.lit===true||s.kind==='square'||s.kind==='pedestrian')&&!/ტყე|დენდრო/.test(s.place||''));
 const rotAll=rotationOrder(pool,seed),rotLit=rotationOrder(lit.length>=20?lit:pool,seed+':lit');
 const focusOrder=shuffle(pool.filter(s=>inFocus(week,s)),`${seed}:${week?.from}`);
 let usedAll=usedBefore(campaign,date,false),usedLit=usedBefore(campaign,date,true),usedFocus=0;
 if(week)for(let d=week.from;d<date;d=dateAdd(d,1)){const o=dayOf(campaign,d);if(!o.off)usedFocus+=o.day.waves.reduce((s,w)=>s+w.focus,0);}
 const taken=new Set();
 for(const wave of off?[]:day.waves){
  const start=stamp(date,wave.time,campaign.utcOffset),end=new Date(start.getTime()+wave.hours*3600_000);
  const rot=wave.litOnly?pick(rotLit,usedLit,wave.rotation):pick(rotAll,usedAll,wave.rotation);
  if(wave.litOnly)usedLit+=wave.rotation;else usedAll+=wave.rotation;
  const focusPool=wave.litOnly?focusOrder.filter(s=>lit.includes(s)):focusOrder;
  const foc=pick(focusPool,usedFocus,wave.focus);usedFocus+=wave.focus;
  let n=0;
  for(const spot of [...rot,...foc]){
   if(taken.has(spot.id))continue;taken.add(spot.id);n++;
   const [lo,hi]=day.stock;
   out.push(coinGift(campaign,{id:`glow-${date}-${wave.id}-${String(n).padStart(2,'0')}`,spot,start,end,coins:weighted(day.coins,r),stock:lo+Math.floor(r()*(hi-lo+1)),pulseRadius:day.pulseRadius,revealRadius:day.revealRadius,kind:wave.id}));
  }
 }
 const sat=campaign.saturday,anchorKey=off?null:sat.dates?.[date];
 if(anchorKey&&golden?.[anchorKey]){
  const anchor=at(golden[anchorKey]),start=stamp(date,sat.time,campaign.utcOffset),end=new Date(start.getTime()+sat.hours*3600_000);
  const near=spots.filter(s=>metersBetween(anchor,at(s))<=sat.radiusM).sort((a,b)=>metersBetween(anchor,at(a))-metersBetween(anchor,at(b)));
  const points=near.length?near.slice(0,sat.points):[{id:`golden-${anchorKey}`,...golden[anchorKey]}];
  // Fewer paths near the park → bigger stock per point, so the rain is the same size.
  const stock=Math.ceil(sat.points*sat.stock/points.length);
  points.forEach((spot,i)=>out.push(coinGift(campaign,{id:`glow-${date}-sat-${String(i+1).padStart(2,'0')}`,spot,start,end,coins:weighted(sat.coins,r),stock,pulseRadius:sat.pulseRadius,revealRadius:sat.revealRadius,kind:'saturday'})));
  if(sat.lantern&&date>=sat.lantern.from){
   const far=shuffle(near.slice(sat.points),`${seed}:${date}:lantern`).slice(0,sat.lantern.points);
   far.forEach((spot,i)=>out.push(coinGift(campaign,{id:`glow-${date}-lan-${String(i+1).padStart(2,'0')}`,spot,start,end,coins:sat.lantern.coins,stock:sat.lantern.stock,pulseRadius:sat.pulseRadius,revealRadius:sat.revealRadius,kind:'lantern',minPercent:sat.lantern.minPercent})));
  }
 }
 if(grandDay){
  const spot=grandSpot;
  if(spot){
   const start=new Date(g.dropAt),end=new Date(start.getTime()+g.hours*3600_000);
   out.push({gift:{id:g.id,title:`${g.prize.ka} · ${g.detail.ka}`,description:`31 დეკემბრის დიდი საჩუქარი. ჩანს მხოლოდ მათთვის, ვისაც თბილისის ${String(g.minPercent).replace('.',',')}% აქვს განათებული. ვინც პირველი გახსნის, ის იგებს.`,longitude:spot.lng,latitude:spot.lat,pulseRadius:g.pulseRadius,revealRadius:g.revealRadius,rewardKind:'PHYSICAL',stock:1,published:true,archived:false,startsAt:start,endsAt:end},
    rule:{giftId:g.id,campaign:campaign.id,coins:0,minPercent:g.minPercent,areaId:campaign.area.id,meta:{kind:'grand',spot:spot.id||null,place:spot.place||null,district:spot.district||null,titleEn:`${g.prize.en} · ${g.detail.en}`,descriptionEn:`The 31 December grand prize. Visible only to players who have lit ${g.minPercent}% of Tbilisi. The first to open it wins.`}}});
  }
 }
 return out;
}

/* ───────── database ───────── */
/** Creates the day's boxes that do not exist yet. Existing ids are never touched, so admin edits survive. */
export async function applyDay(date,{db=prisma,plan=planDay(date),dryRun=false}={}){
 if(!plan.length)return {date,created:0,existing:0,total:0};
 const ids=plan.map(p=>p.gift.id);
 const have=new Set((await db.medipulsiGift.findMany({where:{id:{in:ids}},select:{id:true}})).map(g=>g.id));
 const missing=plan.filter(p=>!have.has(p.gift.id));
 if(!dryRun&&missing.length)await ensureGiftRuleTable(db);
 // Gift + its rule in one transaction: a box that promises coins never exists without the rule that pays them.
 if(!dryRun)for(const {gift,rule} of missing){
  await db.$transaction(async tx=>{
   await tx.medipulsiGift.create({data:gift});
   await upsertGiftRule(tx,rule);
   await tx.medipulsiAudit.create({data:{id:randomUUID(),actorId:'medirun-autopilot',action:'GIFT_SAVE',entityId:gift.id,details:{autopilot:true,campaign:rule.campaign,kind:rule.meta.kind,coins:rule.coins,minPercent:rule.minPercent}}});
  });
 }
 return {date,created:dryRun?0:missing.length,missing:missing.length,existing:have.size,total:plan.length};
}

export async function autopilotEnabled(db=prisma){
 if(String(process.env.MEDIRUN_AUTOPILOT||'').toLowerCase()==='off')return false;
 return (await isFeatureEnabled('medirun',db))&&(await isFeatureEnabled('medirunAutopilot',db));
}
/** Today and tomorrow (Tbilisi) inside the campaign; boxes are created ahead and appear at their start time. */
export async function runAutopilot({db=prisma,now=Date.now(),force=false}={}){
 const campaign=await getCampaign(db,now);
 // Monday: last week's leaderboard prizes — promised in the app, so they go out even while box placement is
 // paused, and before the budget gate is checked. Only the MEDIRUN module switch stops them.
 let prizes=null;
 if(force||await isFeatureEnabled('medirun',db).catch(()=>false)){try{prizes=await payWeeklyPrizes(campaign,{db,now});}catch(error){console.warn('[medirun-autopilot] weekly prizes failed',error?.message);}}
 if(!force&&!(await autopilotEnabled(db)))return {skipped:'paused',prizes};
 // Economy 2: when the season's coins are spent, no new boxes until the owner raises the budget.
 const budget=await budgetGate(campaign,{db,now});
 if(budget.stopped)return {skipped:'budget',budget,prizes};
 const today=tbilisiDate(now),dates=[today,dateAdd(today,1)].filter(d=>d>=campaign.start&&d<=campaign.end);
 const results=[];for(const date of dates)results.push(await applyDay(date,{db,plan:planDay(date,{campaign})}));
 // Every other city with a player: detect, harvest one city's spots per tick, then place its local today / tomorrow.
 try{
  await detectCities({db,campaign});
  const pending=await nextHarvest(db);
  if(pending)results.push({city:pending,harvest:await harvestCity(pending,{db})});
  for(const city of (await listCities({db})).filter(c=>c.enabled&&c.status==='ready')){
   const spots=await citySpots(city.cityId,{db});
   for(const date of cityDates(city,now))results.push({city:city.cityId,...await applyDay(date,{db,plan:planCityDay(city,date,{campaign,spots,helpers:CITY_HELPERS})})});
  }
 }catch(error){console.warn('[medirun-autopilot] cities failed',error?.message);}
 return {results,budget,prizes};
}

let timer=null;
export function startMedirunAutopilot({intervalMs=10*60_000}={}){
 if(timer||process.env.NODE_ENV==='test')return timer;
 const tick=async()=>{
  try{
   if(!(await acquireJobLease('medirun-autopilot',intervalMs+5*60_000)))return;
   const out=await runAutopilot();
   const made=(out.results||[]).reduce((s,r)=>s+(r.created||0),0);
   if(made)console.log(`[medirun-autopilot] placed ${made} boxes`,(out.results||[]).map(r=>`${r.date}:${r.created}/${r.total}`).join(' '));
   // Stage 3 (owner 2026-10-09): „ყუთი შენთან ახლოსაა“ for waves that just started — same lease, one sender.
   const alerts=await dispatchWaveAlerts();
   if(alerts.sent)console.log(`[medirun-autopilot] wave alerts sent ${alerts.sent}`);
  }catch(error){console.warn('[medirun-autopilot] run failed',error?.message);}
 };
 timer=setInterval(tick,intervalMs);timer.unref?.();
 setTimeout(tick,30_000).unref?.();
 return timer;
}

/** Live numbers of one date for the CLI / admin: boxes, openings, coins paid. */
export async function dayStatus(date,{db=prisma}={}){
 const prefix=`glow-${date}-`;
 const gifts=await db.medipulsiGift.findMany({where:{id:{startsWith:prefix}},select:{id:true,title:true,stock:true,allocated:true,startsAt:true,endsAt:true,archived:true,latitude:true,longitude:true}});
 const rules=await giftRules(db,0);
 const coins=await db.rewardLedger.aggregate({_sum:{amount:true},_count:true,where:{sourceType:'MEDIRUN',metadata:{path:['giftId'],string_starts_with:prefix}}}).catch(()=>({_sum:{amount:null},_count:0}));
 return {date,boxes:gifts.length,openings:gifts.reduce((s,g)=>s+g.allocated,0),capacity:gifts.reduce((s,g)=>s+g.stock,0),maxCoins:gifts.reduce((s,g)=>s+maxPayout(rules.get(g.id),g.stock),0),coinsPaid:coins._sum.amount||0,gifts:gifts.map(g=>({...g,rule:rules.get(g.id)||null}))};
}
