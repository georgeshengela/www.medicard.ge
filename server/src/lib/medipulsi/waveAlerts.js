// „ყუთი შენთან ახლოსაა“ (owner 2026-10-09, MEDIRUN stage 3): when a box wave starts, players who turned the alert on
// (HealthProfile.extraAnswers.medirunWaveAlerts === true — OFF by default, switched in the app) and whose home place
// (UserLocation, location sharing on) is within RADIUS_M of one of the wave's boxes get one push: at most MAX_PER_DAY
// per Tbilisi day, only 08:00–21:30 Tbilisi. The text names the place (park / district) and a rounded distance —
// never a box coordinate, never health data. Grand prize, starter and lantern (gated) boxes never alert.
// Admin switch: feature `medirunWaveAlerts` (child of `medirun`).
import {prisma} from '../prisma.js';
import {sendExpoPush} from '../push.js';
import {getUserLanguages} from '../i18n.js';
import {isFeatureEnabled} from '../featureFlags.js';
import {distance} from './core/engine.js';
import {giftRules} from './giftRules.js';
import {STARTER_PREFIX} from './starter.js';

export const RADIUS_M=1500,MAX_PER_DAY=2,WINDOW_MS=20*60_000;
const HOURS={from:8*60,to:21*60+30};

export function tbilisiClock(now){const t=new Date(now+4*3600_000);return {minutes:t.getUTCHours()*60+t.getUTCMinutes(),day:t.toISOString().slice(0,10)};}
export function inWindow(now){const {minutes}=tbilisiClock(now);return minutes>=HOURS.from&&minutes<HOURS.to;}
/** „≈ 800 მ“ / „≈ 1,2 კმ“ — a home is a few hundred metres off anyway, so never more precise than that. */
export function roundedKm(m,lang){
 if(m<1000){const v=Math.max(100,Math.round(m/100)*100);return lang==='en'?`≈ ${v} m`:`≈ ${v} მ`;}
 const v=Math.round(m/100)/10;return lang==='en'?`≈ ${v} km`:`≈ ${String(v).replace('.',',')} კმ`;
}
export function alertCopy({place,meters,boxes},lang){
 const far=roundedKm(meters,lang);
 return lang==='en'
  ?{title:'🎁 Boxes just dropped near you',body:`${boxes>1?`${boxes} boxes`:'A box'} ${far} from home — ${place}. Open MEDIRUN and be the first.`}
  :{title:'🎁 ყუთები შენთან ახლოს დაიყარა',body:`${boxes>1?`${boxes} ყუთი`:'ყუთი'} სახლიდან ${far}-ში — ${place}. გახსენი MEDIRUN და იპოვე პირველმა.`};
}
/**
 * Pure plan: which homes get which wave. `waves` = [{key, gifts:[{lng,lat,place}]}], `homes` = [{userId,lng,lat}],
 * `sentToday` = Map userId → count already sent today, `already` = Set of `${userId}:${key}`.
 */
export function planAlerts({waves,homes,sentToday,already,radiusM=RADIUS_M,maxPerDay=MAX_PER_DAY}){
 const out=[],count=new Map(sentToday);
 for(const wave of waves)for(const home of homes){
  if((count.get(home.userId)||0)>=maxPerDay||already.has(`${home.userId}:${wave.key}`))continue;
  let best=null,near=0;
  for(const g of wave.gifts){const d=distance([home.lng,home.lat],[g.lng,g.lat]);if(d<=radiusM){near++;if(!best||d<best.d)best={d,place:g.place};}}
  if(!best)continue;
  out.push({userId:home.userId,key:wave.key,meters:best.d,place:best.place,boxes:near});
  count.set(home.userId,(count.get(home.userId)||0)+1);
 }
 return out;
}

let ready=false;
async function ensureTable(db){
 if(ready)return;
 await db.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "MedirunWaveAlert" ("userId" TEXT NOT NULL, "waveKey" TEXT NOT NULL, "day" TEXT NOT NULL, "sentAt" TIMESTAMPTZ NOT NULL DEFAULT now(), PRIMARY KEY ("userId","waveKey"))`);
 await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "MedirunWaveAlert_day_idx" ON "MedirunWaveAlert" ("day")`);
 ready=true;
}

/** One pass: waves that started in the last WINDOW_MS → opted-in homes nearby → pushes. Never throws. */
export async function dispatchWaveAlerts({db=prisma,now=Date.now(),send=sendExpoPush}={}){
 try{
  if(!inWindow(now))return {sent:0,skipped:'hours'};
  if(!(await isFeatureEnabled('medirun',db))||!(await isFeatureEnabled('medirunWaveAlerts',db)))return {sent:0,skipped:'paused'};
  const started=await db.medipulsiGift.findMany({where:{published:true,archived:false,id:{startsWith:'glow-'},NOT:{id:{startsWith:STARTER_PREFIX}},startsAt:{gt:new Date(now-WINDOW_MS),lte:new Date(now)},endsAt:{gt:new Date(now)}},select:{id:true,longitude:true,latitude:true,stock:true,allocated:true}});
  if(!started.length)return {sent:0};
  const rules=await giftRules(db,now);
  // A wave = boxes of one city that start together; its key is the id up to the box number (glow-<date>[-city]-<wave>).
  const waves=new Map();
  for(const g of started){
   const r=rules.get(g.id);
   if(!r||r.minPercent||r.meta?.kind==='grand'||g.allocated>=g.stock||!Number.isFinite(g.longitude))continue;
   const key=g.id.replace(/-\d+$/,'');
   if(!waves.has(key))waves.set(key,{key,gifts:[]});
   waves.get(key).gifts.push({lng:g.longitude,lat:g.latitude,place:r.meta?.place||r.meta?.district||'MEDIRUN'});
  }
  if(!waves.size)return {sent:0};
  const homes=await db.$queryRaw`SELECT l."userId", l."lng", l."lat" FROM "UserLocation" l JOIN "HealthProfile" h ON h."userId"=l."userId"
   WHERE l."enabled"=true AND l."lat" IS NOT NULL AND l."lng" IS NOT NULL AND h."extraAnswers"->>'medirunWaveAlerts'='true'`;
  if(!homes.length)return {sent:0};
  await ensureTable(db);
  const {day}=tbilisiClock(now);
  const rows=await db.$queryRaw`SELECT "userId","waveKey","day" FROM "MedirunWaveAlert" WHERE "day"=${day} OR "sentAt">now()-interval '2 days'`;
  const sentToday=new Map(),already=new Set();
  for(const r of rows){already.add(`${r.userId}:${r.waveKey}`);if(r.day===day)sentToday.set(r.userId,(sentToday.get(r.userId)||0)+1);}
  const plan=planAlerts({waves:[...waves.values()],homes:homes.map(h=>({userId:String(h.userId),lng:Number(h.lng),lat:Number(h.lat)})),sentToday,already});
  if(!plan.length)return {sent:0};
  const langs=await getUserLanguages(plan.map(p=>p.userId)).catch(()=>new Map());
  let sent=0;
  for(const p of plan){
   // Claim first: a second instance or a retry never pushes the same wave twice.
   const claimed=await db.$executeRaw`INSERT INTO "MedirunWaveAlert" ("userId","waveKey","day") VALUES (${p.userId},${p.key},${day}) ON CONFLICT DO NOTHING`;
   if(!claimed)continue;
   const tokens=(await db.pushToken.findMany({where:{userId:p.userId,active:true},select:{token:true}})).map(t=>t.token);
   if(!tokens.length)continue;
   try{await send(tokens,{...alertCopy(p,langs.get(p.userId)==='en'?'en':'ka'),data:{type:'medirun_wave',route:'/run'}});sent++;}catch{/* the claim stays: never retry into a later, staler push */}
  }
  return {sent};
 }catch(error){console.warn('[medirun-wave-alerts]',error?.message);return {sent:0,error:true};}
}
