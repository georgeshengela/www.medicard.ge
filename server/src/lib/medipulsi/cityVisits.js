// „ჩემი ქალაქები“ (owner 2026-10-05): every city a player was seen in during a MEDIRUN session is remembered with
// the first and the last day, and the lit ones carry their share. The city comes from the shared ~2 km tile cache
// (one OpenStreetMap lookup per tile for the whole user base) — never stored per fix, never a route.
import {prisma} from '../prisma.js';
import {countryNameKa,countryNameEn} from '../geoPlace.js';
import {tileOf} from './territoryMath.js';
import {territory,resolveTilePlace} from './territory.js';
import {homeCityId} from './cities.js';

let ready=false;
async function ensureTable(db){
 if(ready)return;
 await db.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "MedirunCityVisit" ("userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE, "cityId" TEXT NOT NULL, "firstAt" TIMESTAMPTZ NOT NULL DEFAULT now(), "lastAt" TIMESTAMPTZ NOT NULL DEFAULT now(), PRIMARY KEY ("userId","cityId"))`);
 ready=true;
}

// One look per player every 10 minutes is plenty: a city does not change between two GPS batches.
const seen=new Map();
const valid=p=>Array.isArray(p)&&Number.isFinite(p[0])&&Number.isFinite(p[1])&&Math.abs(p[0])<=180&&Math.abs(p[1])<=90;
/** Remembers the city of `position` for this player (fire and forget; never throws, never blocks a request). */
export async function recordVisit(userId,position,{db=prisma,now=Date.now()}={}){
 try{
  if(!userId||!valid(position))return null;
  const tile=tileOf(position),key=`${userId}:${tile}`,last=seen.get(key);
  if(last&&now-last<10*60_000)return null;
  seen.set(key,now);if(seen.size>50_000)seen.delete(seen.keys().next().value);
  const place=await resolveTilePlace(tile);
  if(!place?.cityId)return null;
  await ensureTable(db);
  await db.$executeRaw`INSERT INTO "MedirunCityVisit" ("userId","cityId","firstAt","lastAt") VALUES (${userId},${place.cityId},${new Date(now)},${new Date(now)}) ON CONFLICT ("userId","cityId") DO UPDATE SET "lastAt"=GREATEST("MedirunCityVisit"."lastAt",EXCLUDED."lastAt")`;
  return place.cityId;
 }catch(error){
  console.warn('[medirun] city visit skipped',error?.message);
  return null;
 }
}

/**
 * The page: lit cities (share, km², the small dot map of lit squares) with their first / last visit, then the
 * cities the player was in without lighting anything yet. The home city (location sharing on) counts as visited.
 */
export async function myCities(userId,{db=prisma,lang='ka'}={}){
 await ensureTable(db);
 const home=await db.$queryRaw`SELECT "lat","lng","cityKa" FROM "UserLocation" WHERE "userId"=${userId} AND "enabled"=true AND "lat" IS NOT NULL`.then(r=>r[0]||null).catch(()=>null);
 if(home){
  const id=await homeCityId(home,{db}).catch(()=>null);
  if(id)await db.$executeRaw`INSERT INTO "MedirunCityVisit" ("userId","cityId") VALUES (${userId},${id}) ON CONFLICT ("userId","cityId") DO NOTHING`.catch(()=>{});
 }
 const [t,visits]=await Promise.all([
  territory(userId,lang),
  db.$queryRaw`SELECT v."cityId", v."firstAt", v."lastAt", a."nameKa", a."nameEn", a."countryCode" FROM "MedirunCityVisit" v LEFT JOIN "MedipulsiArea" a ON a."id"=v."cityId" WHERE v."userId"=${userId} ORDER BY v."lastAt" DESC`.catch(()=>[]),
 ]);
 const byId=new Map(visits.map(v=>[v.cityId,v]));
 const country=code=>code?(lang==='en'?countryNameEn(code,code):countryNameKa(code,code)):null;
 const lit=t.cities.map(c=>{const v=byId.get(c.id);return {id:c.id,name:c.name,countryCode:c.countryCode,country:country(c.countryCode),percent:c.percent,paintedKm2:c.paintedKm2,areaKm2:c.areaKm2,map:c.map||null,firstAt:v?.firstAt||null,lastAt:v?.lastAt||null};});
 const litIds=new Set(lit.map(c=>c.id));
 const visited=visits.filter(v=>!litIds.has(v.cityId)&&(v.nameKa||v.nameEn)).map(v=>({id:v.cityId,name:(lang==='en'?v.nameEn||v.nameKa:v.nameKa||v.nameEn)||'',countryCode:v.countryCode||null,country:country(v.countryCode),firstAt:v.firstAt,lastAt:v.lastAt}));
 const countries=new Set([...lit,...visited].map(c=>c.countryCode).filter(Boolean));
 return {summary:{lit:lit.length,visited:visited.length,countries:countries.size,paintedKm2:t.paintedKm2},lit,visited,pending:t.pending};
}
