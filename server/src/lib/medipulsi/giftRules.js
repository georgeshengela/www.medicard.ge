// Extra rules for MEDIRUN gifts, kept beside "MedipulsiGift" so the gift table and the admin editor stay unchanged.
// A rule can (a) pay Medi Coins the moment the box is opened and (b) hide the box from players who have not lit
// enough of a city yet (the grand prize needs 1% of Tbilisi). Table "MedipulsiGiftRule" is created lazily, like
// the territory tables; a missing table means "no rules" (plain admin gifts behave exactly as before).
import {randomUUID} from 'node:crypto';
import {prisma} from '../prisma.js';
import {getLevelForXp} from '../questLevels.js';
import {paintedCells,cellCenter,insideGeometry,geometryBbox,CELL_KM2} from './territoryMath.js';

export const COIN_SOURCE='MEDIRUN';
let ready=false;
export async function ensureGiftRuleTable(db=prisma){
 if(ready)return;
 await db.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "MedipulsiGiftRule" ("giftId" TEXT PRIMARY KEY, "campaign" TEXT, "coins" INTEGER NOT NULL DEFAULT 0, "minPercent" DOUBLE PRECISION, "areaId" TEXT, "meta" JSONB, "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now())`);
 ready=true;
}

/** Plain row → rule; unknown or broken values never unlock anything by accident. */
export function normalizeRule(row){
 if(!row)return null;
 const coins=Math.max(0,Math.min(10000,Math.round(Number(row.coins)||0)));
 const min=Number(row.minPercent);
 return {giftId:row.giftId,campaign:row.campaign||null,coins,minPercent:Number.isFinite(min)&&min>0?min:null,areaId:row.areaId||null,meta:row.meta&&typeof row.meta==='object'?row.meta:{}};
}
/** A gated gift needs the player's lit share of its area to reach the threshold. */
export function isUnlocked(rule,percentOf){
 if(!rule?.minPercent)return true;
 if(!rule.areaId)return false;
 const p=Number(percentOf(rule.areaId));
 return Number.isFinite(p)&&p+1e-9>=rule.minPercent;
}
/** English text for English requests when the rule carries it; the gift row stays Georgian. */
export function localizeGift(gift,rule,lang){
 if(lang!=='en'||!rule?.meta)return gift;
 return {...gift,title:rule.meta.titleEn||gift.title,description:rule.meta.descriptionEn||gift.description};
}

// Rules change rarely and nearby() runs every few seconds per active player: keep them in memory for a minute.
let cache={at:0,map:new Map()};
export function clearGiftRuleCache(){cache={at:0,map:new Map()};}
export async function giftRules(db=prisma,now=Date.now()){
 if(now-cache.at<60_000)return cache.map;
 try{
  await ensureGiftRuleTable(db);
  const rows=await db.$queryRaw`SELECT "giftId","campaign","coins","minPercent","areaId","meta" FROM "MedipulsiGiftRule"`;
  cache={at:now,map:new Map(rows.map(r=>[r.giftId,normalizeRule(r)]))};
 }catch(error){
  console.warn('[medirun] gift rules unavailable',error?.message);
  cache={at:now,map:cache.map};
 }
 return cache.map;
}
export async function upsertGiftRule(db,rule){
 await ensureGiftRuleTable(db);
 const r=normalizeRule(rule);
 await db.$executeRaw`INSERT INTO "MedipulsiGiftRule" ("giftId","campaign","coins","minPercent","areaId","meta") VALUES (${r.giftId},${r.campaign},${r.coins},${r.minPercent},${r.areaId},${JSON.stringify(r.meta)}::jsonb)
  ON CONFLICT ("giftId") DO UPDATE SET "campaign"=EXCLUDED."campaign","coins"=EXCLUDED."coins","minPercent"=EXCLUDED."minPercent","areaId"=EXCLUDED."areaId","meta"=EXCLUDED."meta"`;
 cache.at=0;
}

/* ───────── lit share of one city, the same math as the territory card ───────── */
const areaCache=new Map();
async function areaGeometry(db,areaId){
 const hit=areaCache.get(areaId);if(hit&&Date.now()-hit.at<6*3600_000)return hit.area;
 const rows=await db.$queryRaw`SELECT "id","nameKa","nameEn","areaKm2","geometry" FROM "MedipulsiArea" WHERE "id"=${areaId}`.catch(()=>[]);
 const area=rows[0]?.geometry?{...rows[0],box:geometryBbox(rows[0].geometry)}:null;
 areaCache.set(areaId,{at:Date.now(),area});
 return area;
}
/** Painted km² and percent of the area from a journey; pure, so the eligibility page and the gate agree. */
export function shareOfArea(journey,area,fallbackKm2=null){
 const total=Number(area?.areaKm2)||Number(fallbackKm2)||0;
 if(!area?.geometry||!(total>0))return {paintedKm2:0,percent:0};
 const [x0,y0,x1,y1]=area.box||geometryBbox(area.geometry);let n=0;
 for(const key of paintedCells(journey)){const p=cellCenter(key);if(p[0]>=x0&&p[0]<=x1&&p[1]>=y0&&p[1]<=y1&&insideGeometry(p,area.geometry))n++;}
 const paintedKm2=n*CELL_KM2;
 return {paintedKm2,percent:Math.min(100,paintedKm2/total*100)};
}
const shareCache=new Map();
export async function cityShare(userId,areaId,{db=prisma,fallbackKm2=null,maxAgeMs=5*60_000}={}){
 const key=`${userId}:${areaId}`,hit=shareCache.get(key);
 if(hit&&Date.now()-hit.at<maxAgeMs)return hit.value;
 const [player,area]=await Promise.all([db.medipulsiPlayer.findUnique({where:{userId},select:{state:true}}),areaGeometry(db,areaId)]);
 const value=shareOfArea(player?.state?.journey,area,fallbackKm2);
 shareCache.set(key,{at:Date.now(),value});
 if(shareCache.size>5000)shareCache.delete(shareCache.keys().next().value);
 return value;
}
/** Percent per area for the gated rules among `gifts` (one computation per area). */
export async function percentsFor(userId,rules,options){
 const areas=[...new Set(rules.filter(r=>r?.minPercent&&r.areaId).map(r=>r.areaId))],out=new Map();
 for(const id of areas)out.set(id,(await cityShare(userId,id,options)).percent);
 return out;
}

/* ───────── coins on claim ───────── */
async function syncQuestCache(tx,userId){
 const rows=await tx.rewardLedger.groupBy({by:['currency'],where:{userId},_sum:{amount:true}});
 const sum=c=>rows.find(r=>r.currency===c)?._sum.amount??0;
 const xp=sum('XP'),coins=sum('COIN');
 await tx.userQuestProfile.upsert({where:{userId},update:{cachedCoinBalance:coins,totalXp:xp,currentLevel:getLevelForXp(xp).level},create:{userId,cachedCoinBalance:coins,totalXp:xp,currentLevel:getLevelForXp(xp).level}});
}
/** Pays the gift's coins once per claim (unique ledger key), inside the claim transaction. */
export async function creditGiftCoins(tx,{userId,claimId,giftId,rule,now=new Date()}){
 if(!(rule?.coins>0))return 0;
 const existing=await tx.rewardLedger.findUnique({where:{userId_currency_sourceType_sourceId:{userId,currency:'COIN',sourceType:COIN_SOURCE,sourceId:`claim:${claimId}`}}});
 if(existing)return 0;
 await tx.rewardLedger.create({data:{id:randomUUID(),userId,currency:'COIN',amount:rule.coins,transactionType:'EARN',sourceType:COIN_SOURCE,sourceId:`claim:${claimId}`,createdAt:now,metadata:{giftId,campaign:rule.campaign}}});
 await syncQuestCache(tx,userId);
 return rule.coins;
}
