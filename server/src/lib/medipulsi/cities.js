// MEDIRUN boxes in every city with a player (owner 2026-10-04: „ყველა ქალაქში უნდა იყოს, სადაც 1 მომხმარებელი
// მაინც დაფიქსირდება … ნებისმიერი ქალაქი უნდა მუშაობდეს“). Tbilisi keeps its hand-made campaign (curated spots,
// Saturday rain, lanterns, the grand prize); every other city gets the „სხვა ქალაქები“ rules of the campaign:
//  1. detect — a person's home place (UserLocation, the same city the app shows) → the OSM city of that ~2 km tile
//     (territory.js resolves and caches it) → a "MedirunCity" row with its player count and time zone;
//  2. harvest — once per city, Overpass → citySpotsMath.harvestSpots (same safety rules as Tbilisi) → stored spots;
//  3. plan — planCityDay(): the city's waves at LOCAL time, boxes per wave scaled by players, the same coin tables.
// Box ids stay glow-<local date>-<cityId>-<wave>-NN, so the admin day tools, /drops and claims work unchanged.
import {prisma} from '../prisma.js';
import {tileOf} from './territoryMath.js';
import {resolveTilePlace} from './territory.js';
import {harvestSpots,overpassQuery,timezoneFor,zonedTime,localDate} from './citySpotsMath.js';
import {geometryBbox} from './territoryMath.js';

const UA='Medicard.GE/1.0 (MEDIRUN city spots; contact@medicard.ge)';
const OVERPASS=['https://overpass-api.de/api/interpreter','https://overpass.kumi.systems/api/interpreter','https://maps.mail.ru/osm/tools/overpass/api/interpreter'];
const DAY=86400_000;

let ready=false;
export async function ensureCityTable(db=prisma){
 if(ready)return;
 await db.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "MedirunCity" ("cityId" TEXT PRIMARY KEY, "nameKa" TEXT, "nameEn" TEXT, "countryCode" TEXT, "timezone" TEXT NOT NULL, "players" INTEGER NOT NULL DEFAULT 0, "source" TEXT NOT NULL DEFAULT 'auto', "enabled" BOOLEAN NOT NULL DEFAULT true, "status" TEXT NOT NULL DEFAULT 'pending', "spots" JSONB, "spotCount" INTEGER NOT NULL DEFAULT 0, "error" TEXT, "harvestedAt" TIMESTAMPTZ, "attempts" INTEGER NOT NULL DEFAULT 0, "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(), "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now())`);
 ready=true;
}

/* ───────── 1. detect ───────── */
const km=(a,b)=>{const r=Math.PI/180,x=(b[0]-a[0])*r*Math.cos((a[1]+b[1])/2*r),y=(b[1]-a[1])*r;return Math.hypot(x,y)*6371;};
/**
 * The city of a home place: the known city named like the place the app shows (UserLocation.cityKa — „ლიეჟი“),
 * the nearest one within 40 km; else the OSM city of the home's ~2 km tile (that can be a district such as
 * Rocourt, which is why the name comes first). `resolve` = may ask Nominatim for an unknown tile.
 */
export async function homeCityId(home,{db=prisma,resolve=false}={}){
 const at=[Number(home.lng),Number(home.lat)];
 if(home.cityKa){
  const rows=await db.$queryRaw`SELECT "id","geometry" FROM "MedipulsiArea" WHERE "kind"='city' AND ("nameKa"=${home.cityKa} OR "nameEn"=${home.cityKa})`.catch(()=>[]);
  const best=rows.map(r=>{const b=geometryBbox(r.geometry);return {id:r.id,d:km(at,[(b[0]+b[2])/2,(b[1]+b[3])/2])};}).filter(r=>r.d<=40).sort((a,b)=>a.d-b.d)[0];
  if(best)return best.id;
 }
 const tile=tileOf(at);
 const [row]=await db.$queryRaw`SELECT "cityId" FROM "MedipulsiPlaceTile" WHERE "tile"=${tile}`.catch(()=>[]);
 if(row)return row.cityId||null;
 if(!resolve)return null;
 return (await resolveTilePlace(tile))?.cityId||null;
}

/**
 * Cities where people live (home place in UserLocation, location sharing on). Resolves at most `budget`
 * unknown tiles per call (Nominatim etiquette); the rest arrive on the next tick.
 */
export async function detectCities({db=prisma,campaign,budget=4}={}){
 await ensureCityTable(db);
 const homes=await db.$queryRaw`SELECT "lat","lng","cityKa" FROM "UserLocation" WHERE "enabled"=true AND "lat" IS NOT NULL AND "lng" IS NOT NULL`.catch(()=>[]);
 const players=new Map();
 let left=budget;
 for(const h of homes){
  let id=null;
  try{id=await homeCityId(h,{db,resolve:left>0});}catch{/* next tick */}
  if(id===null&&left>0)left--;
  if(id)players.set(id,(players.get(id)||0)+1);
 }
 const ids=[...players.keys()];
 const areas=ids.length?await db.$queryRaw`SELECT "id","countryCode","nameKa","nameEn","geometry" FROM "MedipulsiArea" WHERE "id" = ANY(${ids}) AND "kind"='city'`:[];
 for(const a of areas){
  if(a.id===campaign?.area?.id)continue;
  const b=geometryBbox(a.geometry),tz=timezoneFor(a.countryCode,(b[0]+b[2])/2);
  await db.$executeRaw`INSERT INTO "MedirunCity" ("cityId","nameKa","nameEn","countryCode","timezone","players") VALUES (${a.id},${a.nameKa},${a.nameEn},${a.countryCode},${tz},${players.get(a.id)})
   ON CONFLICT ("cityId") DO UPDATE SET "players"=EXCLUDED."players","nameKa"=EXCLUDED."nameKa","nameEn"=EXCLUDED."nameEn","updatedAt"=now()`;
 }
 // Cities nobody lives in any more keep their spots but count 0 players (manual ones stay as the admin set them).
 if(ids.length)await db.$executeRaw`UPDATE "MedirunCity" SET "players"=0 WHERE "source"='auto' AND NOT ("cityId" = ANY(${ids})) AND "players"<>0`;
 else await db.$executeRaw`UPDATE "MedirunCity" SET "players"=0 WHERE "source"='auto' AND "players"<>0`;
 return {homes:homes.length,cities:areas.length};
}

/** Admin: add any known city by hand (even before someone lives there). */
export async function addCity(cityId,{db=prisma}={}){
 await ensureCityTable(db);
 const [a]=await db.$queryRaw`SELECT "id","countryCode","nameKa","nameEn","geometry" FROM "MedipulsiArea" WHERE "id"=${cityId} AND "kind"='city'`;
 if(!a)throw Object.assign(new Error('ქალაქი ვერ მოიძებნა.'),{status:404});
 const b=geometryBbox(a.geometry),tz=timezoneFor(a.countryCode,(b[0]+b[2])/2);
 await db.$executeRaw`INSERT INTO "MedirunCity" ("cityId","nameKa","nameEn","countryCode","timezone","source") VALUES (${a.id},${a.nameKa},${a.nameEn},${a.countryCode},${tz},'manual')
  ON CONFLICT ("cityId") DO UPDATE SET "enabled"=true,"updatedAt"=now()`;
 return a.id;
}

/* ───────── 2. harvest ───────── */
async function overpass(query){
 let last;
 for(const url of OVERPASS){
  try{
   const res=await fetch(url,{method:'POST',body:new URLSearchParams({data:query}),headers:{'User-Agent':UA,Accept:'application/json'},signal:AbortSignal.timeout(180_000)});
   if(!res.ok)throw new Error(`overpass ${res.status}`);
   const json=await res.json();
   if(/error/i.test(json.remark||''))throw new Error(json.remark);
   return json.elements||[];
  }catch(error){last=error;}
 }
 throw last||new Error('overpass unavailable');
}

/** Fetches and stores one city's spots; never throws (the row records the error and retries later). */
export async function harvestCity(cityId,{db=prisma,fetchElements=overpass}={}){
 await ensureCityTable(db);
 const [a]=await db.$queryRaw`SELECT "id","geometry" FROM "MedipulsiArea" WHERE "id"=${cityId}`;
 if(!a?.geometry){await db.$executeRaw`UPDATE "MedirunCity" SET "status"='failed',"error"='ქალაქის საზღვარი არ არის',"attempts"="attempts"+1,"updatedAt"=now() WHERE "cityId"=${cityId}`;return {status:'failed'};}
 const b=geometryBbox(a.geometry);
 try{
  const elements=await fetchElements(overpassQuery([b[1],b[0],b[3],b[2]]));
  const spots=harvestSpots(elements,{cityId,geometry:a.geometry,center:[(b[0]+b[2])/2,(b[1]+b[3])/2]});
  const status=spots.length?'ready':'empty';
  await db.$executeRaw`UPDATE "MedirunCity" SET "status"=${status},"spots"=${JSON.stringify(spots)}::jsonb,"spotCount"=${spots.length},"error"=NULL,"harvestedAt"=now(),"attempts"="attempts"+1,"updatedAt"=now() WHERE "cityId"=${cityId}`;
  return {status,spots:spots.length};
 }catch(error){
  await db.$executeRaw`UPDATE "MedirunCity" SET "status"='failed',"error"=${String(error?.message||error).slice(0,300)},"attempts"="attempts"+1,"updatedAt"=now() WHERE "cityId"=${cityId}`;
  return {status:'failed',error:error?.message};
 }
}

/** The next city that needs spots: new ones first, failed ones again after 6 h (at most 6 tries). */
export async function nextHarvest(db=prisma){
 await ensureCityTable(db);
 const [row]=await db.$queryRaw`SELECT "cityId" FROM "MedirunCity" WHERE "enabled"=true AND ("status"='pending' OR ("status"='failed' AND "attempts"<6 AND "updatedAt"<now()-interval '6 hours')) ORDER BY "players" DESC,"createdAt" ASC LIMIT 1`;
 return row?.cityId||null;
}

export async function listCities({db=prisma}={}){
 await ensureCityTable(db);
 return db.$queryRaw`SELECT "cityId","nameKa","nameEn","countryCode","timezone","players","source","enabled","status","spotCount","error","harvestedAt","attempts","createdAt" FROM "MedirunCity" ORDER BY "players" DESC,"nameEn" ASC`;
}
export async function citySpots(cityId,{db=prisma}={}){
 await ensureCityTable(db);
 const [row]=await db.$queryRaw`SELECT "spots" FROM "MedirunCity" WHERE "cityId"=${cityId}`;
 return Array.isArray(row?.spots)?row.spots:[];
}
export async function setCityEnabled(cityId,enabled,{db=prisma}={}){
 await ensureCityTable(db);
 const n=await db.$executeRaw`UPDATE "MedirunCity" SET "enabled"=${enabled},"updatedAt"=now() WHERE "cityId"=${cityId}`;
 if(!n)throw Object.assign(new Error('ქალაქი ვერ მოიძებნა.'),{status:404});
}
export async function requeueCity(cityId,{db=prisma}={}){
 await ensureCityTable(db);
 await db.$executeRaw`UPDATE "MedirunCity" SET "status"='pending',"attempts"=0,"error"=NULL,"updatedAt"=now() WHERE "cityId"=${cityId}`;
}

/* ───────── 3. plan (pure) ───────── */
export const DEFAULT_CITY_RULES=Object.freeze({
 enabled:true,minPlayers:1,
 waves:[{id:'am',time:'09:00',hours:4.5},{id:'md',time:'13:00',hours:4},{id:'ev',time:'18:00',hours:3.5}],
 boxesPerWave:{base:2,perPlayers:5,max:6},weekendExtra:1,
 coins:[{amount:20,weight:50},{amount:30,weight:30},{amount:50,weight:15},{amount:80,weight:5}],
 weekendCoins:[{amount:30,weight:50},{amount:50,weight:30},{amount:80,weight:15},{amount:120,weight:5}],
 stock:[3,5],pulseRadius:250,revealRadius:20,overrides:{},
});
export const cityRulesOf=campaign=>({...DEFAULT_CITY_RULES,...(campaign?.cities||{})});

/** Boxes in one wave: base + 1 per `perPlayers` players (+ weekend extra), capped; an override wins. */
export function boxesPerWave(rules,city,weekend){
 const o=rules.overrides?.[city.cityId];
 if(Number.isFinite(o?.boxesPerWave))return o.boxesPerWave;
 const b=rules.boxesPerWave;
 return Math.max(0,Math.min(b.max,b.base+Math.floor((city.players||0)/Math.max(1,b.perPlayers))+(weekend?rules.weekendExtra||0:0)));
}

/**
 * Every box of one LOCAL date in one city. `helpers` = {rng, rotationOrder, coinGift, dayKind, daysBetween}
 * from autopilot.js (passed in so this file has no import cycle). Pure: no clock, no database.
 */
export function planCityDay(city,date,{campaign,spots,helpers}){
 const rules=cityRulesOf(campaign),o=rules.overrides?.[city.cityId];
 if(!rules.enabled||o?.off||city.enabled===false||!spots?.length)return [];
 if((city.players||0)<rules.minPlayers&&city.source!=='manual')return [];
 if(date<campaign.start||date>campaign.end)return [];
 const {rng,rotationOrder,coinGift,dayKind,daysBetween}=helpers;
 const weekend=dayKind(date)==='weekend',per=boxesPerWave(rules,city,weekend);
 if(!per)return [];
 const order=rotationOrder(spots,`${campaign.id}:${city.cityId}`),r=rng(`${campaign.id}:${city.cityId}:${date}`);
 const coins=weekend&&rules.weekendCoins?.length?rules.weekendCoins:rules.coins;
 let cursor=Math.max(0,daysBetween(campaign.start,date))*rules.waves.length*Math.max(1,rules.boxesPerWave.max);
 const out=[],taken=new Set();
 for(const wave of rules.waves){
  const start=zonedTime(date,wave.time,city.timezone),end=new Date(+start+wave.hours*3600_000);
  let n=0;
  for(let k=0;k<order.length&&n<per;k++){
   const spot=order[(cursor+k)%order.length];
   if(taken.has(spot.id))continue;
   taken.add(spot.id);n++;
   const [lo,hi]=rules.stock;
   const pick=Number(r()),stock=lo+Math.floor(r()*(hi-lo+1));
   const amount=(()=>{const total=coins.reduce((s,c)=>s+c.weight,0);let x=pick*total;for(const c of coins){x-=c.weight;if(x<0)return c.amount;}return coins.at(-1).amount;})();
   const p=coinGift(campaign,{id:`glow-${date}-${city.cityId}-${wave.id}-${String(n).padStart(2,'0')}`,spot,start,end,coins:amount,stock,pulseRadius:rules.pulseRadius,revealRadius:rules.revealRadius,kind:wave.id});
   p.rule.meta={...p.rule.meta,cityId:city.cityId,city:city.nameKa||city.nameEn||null,cityEn:city.nameEn||city.nameKa||null};
   out.push(p);
  }
  cursor+=per;
 }
 return out;
}

/** A city's local „today“ and „tomorrow“. */
export function cityDates(city,now=Date.now()){const today=localDate(now,city.timezone);return [today,localDate(now+DAY,city.timezone)].filter((d,i,a)=>a.indexOf(d)===i);}
