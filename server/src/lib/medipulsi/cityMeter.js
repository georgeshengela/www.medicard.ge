// „თბილისი ერთად“ (owner 2026-10-05): how much of Tbilisi all MEDIRUN players have lit together — the union of
// everyone's painted cells (the same 20 m grid and ~100 m strip as the personal share, so overlapping walks count
// once), the number of people who lit a part of it and the city-wide milestones. Shown in the app hub and on the
// public /medirun page. Aggregates only: never a route, a person or a coordinate.
// Computed at most every 10 minutes by one instance (job lease), stored in "MedirunCityStat"; readers get the
// stored row at once and trigger a refresh in the background when it is old.
import {randomUUID} from 'node:crypto';
import {prisma} from '../prisma.js';
import {withJobLease} from '../jobLease.js';
import {getCampaign} from './campaignStore.js';
import {paintedCells,cellCenter,insideGeometry,geometryBbox,CELL_KM2} from './territoryMath.js';

export const MILESTONES=Object.freeze([0.25,0.5,1,2,3,5,7.5,10,15,20,25,30,40,50,60,75,90,100]);
const STALE_MS=10*60_000,BATCH=200;

/** Pure: the milestone list for a percent — reached ones (with when, if known) and the next one. */
export function milestoneView(percent,reachedAt={}){
 const list=MILESTONES.map(m=>({percent:m,reached:percent+1e-9>=m,reachedAt:reachedAt[String(m)]||null}));
 const next=list.find(m=>!m.reached)||null;
 const last=[...list].reverse().find(m=>m.reached)||null;
 return {list,next:next&&{percent:next.percent,remaining:Math.max(0,Math.round((next.percent-percent)*1000)/1000)},last:last&&{percent:last.percent,reachedAt:last.reachedAt}};
}
/** Pure: adds journeys one by one (cells shared by two walkers count once) → percent, km², contributors. */
export function shareAccumulator(area){
 const total=Number(area?.areaKm2)||0,box=area?.box||geometryBbox(area?.geometry),cells=new Set();let people=0;
 return {
  add(journey){
   let mine=0;
   for(const key of paintedCells(journey)){
    if(cells.has(key)){mine++;continue;}
    const p=cellCenter(key);
    if(p[0]>=box[0]&&p[0]<=box[2]&&p[1]>=box[1]&&p[1]<=box[3]&&insideGeometry(p,area.geometry)){cells.add(key);mine++;}
   }
   if(mine)people++;
  },
  result(){const paintedKm2=cells.size*CELL_KM2;return {cells:cells.size,paintedKm2,percent:total>0?Math.min(100,paintedKm2/total*100):0,people};},
 };
}
export function unionShare(journeys,area){const acc=shareAccumulator(area);for(const j of journeys)acc.add(j);return acc.result();}

let ready=false;
async function ensureTable(db){
 if(ready)return;
 await db.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "MedirunCityStat" ("areaId" TEXT PRIMARY KEY, "data" JSONB NOT NULL, "computedAt" TIMESTAMPTZ NOT NULL DEFAULT now())`);
 ready=true;
}
async function tellOwner(text){try{const {notifyOwner}=await import('../director/service.js');await notifyOwner(text);}catch(error){console.warn('[medirun-city] owner notice failed',error?.message);}}

/** Recomputes the union for the campaign city and records newly reached milestones once. */
export async function computeCityMeter({db=prisma,now=Date.now()}={}){
 const campaign=await getCampaign(db,now),areaId=campaign.area.id;
 await ensureTable(db);
 const [row]=await db.$queryRaw`SELECT "id","areaKm2","geometry" FROM "MedipulsiArea" WHERE "id"=${areaId}`.catch(()=>[]);
 if(!row?.geometry)return null;
 const area={...row,areaKm2:Number(row.areaKm2)||campaign.area.km2,box:geometryBbox(row.geometry)};
 const acc=shareAccumulator(area);let cursor='';
 // Players in pages, only the two journey fields the paint needs.
 for(;;){
  const page=await db.$queryRaw`SELECT "userId", jsonb_build_object('trail',"state"->'journey'->'trail','covered',"state"->'journey'->'covered') AS journey FROM "MedipulsiPlayer" WHERE "userId">${cursor} ORDER BY "userId" ASC LIMIT ${BATCH}`;
  if(!page.length)break;
  for(const p of page)acc.add(p.journey);
  cursor=page[page.length-1].userId;
  if(page.length<BATCH)break;
 }
 const {paintedKm2,percent,people}=acc.result();
 const [old]=await db.$queryRaw`SELECT "data" FROM "MedirunCityStat" WHERE "areaId"=${areaId}`;
 const reachedAt={...(old?.data?.reachedAt||{})},fresh=[];
 for(const m of MILESTONES)if(percent+1e-9>=m&&!reachedAt[String(m)]){reachedAt[String(m)]=new Date(now).toISOString();fresh.push(m);}
 const data={areaId,nameKa:campaign.area.ka,nameEn:campaign.area.en,areaKm2:area.areaKm2,paintedKm2,percent,people,reachedAt,computedAt:new Date(now).toISOString()};
 await db.$executeRaw`INSERT INTO "MedirunCityStat" ("areaId","data","computedAt") VALUES (${areaId},${JSON.stringify(data)}::jsonb,now()) ON CONFLICT ("areaId") DO UPDATE SET "data"=EXCLUDED."data","computedAt"=now()`;
 // A first run on an existing city back-fills every milestone it already passed — tell the owner only about new ones.
 if(fresh.length&&old){
  for(const m of fresh)await db.medipulsiAudit.create({data:{id:randomUUID(),actorId:'medirun-city',action:'CITY_MILESTONE',entityId:`${areaId}:${m}`,details:{percent,people}}}).catch(()=>{});
  await tellOwner(`🎉 MEDIRUN: ${campaign.area.ka} ერთად ${fresh[fresh.length-1]}% გაანათა — ${people} ადამიანი, ${paintedKm2.toFixed(2)} კმ². აპის ჰაბში და medicard.ge/medirun-ზე ჩანს.`);
 }
 return data;
}

let refreshing=null;
function refreshSoon(db){
 if(refreshing)return refreshing;
 refreshing=withJobLease('medirun-city-meter',5*60_000,()=>computeCityMeter({db}))
  .catch(error=>{console.warn('[medirun-city] refresh failed',error?.message);return null;})
  .finally(()=>{refreshing=null;});
 return refreshing;
}
let memo={at:0,value:null};
/** The stored meter as the app / site show it; computes on the very first read, refreshes in the background after. */
export async function cityMeter({db=prisma,now=Date.now(),lang='ka'}={}){
 let data=memo.value&&now-memo.at<60_000?memo.value:null;
 if(!data){
  await ensureTable(db);
  const [row]=await db.$queryRaw`SELECT "data","computedAt" FROM "MedirunCityStat" WHERE "areaId"=${(await getCampaign(db,now)).area.id}`.catch(()=>[]);
  data=row?.data||null;
  if(!data){const r=await refreshSoon(db);data=r&&!r.skipped?r:null;}
  else if(now-Date.parse(data.computedAt)>STALE_MS)void refreshSoon(db);
  if(data)memo={at:now,value:data};
 }
 if(!data)return null;
 const percent=Math.round(data.percent*1000)/1000;
 return {city:lang==='en'?data.nameEn:data.nameKa,areaKm2:data.areaKm2,paintedKm2:Math.round(data.paintedKm2*100)/100,percent,people:data.people,computedAt:data.computedAt,milestones:milestoneView(data.percent,data.reachedAt)};
}
