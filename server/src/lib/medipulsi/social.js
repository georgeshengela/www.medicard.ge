// MEDIRUN social layer (owner 2026-10-05: „გაანათე მეგობართან ერთად“, crews, „ახლა N ადამიანი დადის“).
//  • Crew — a small group (friends, a running club, an office; ≤ 30) joined by a 6-character code or link.
//    Members see each other's MEDIRUN nickname and this week's metres; nothing else (never a position).
//  • Together — two crew members walking with fresh, precise GPS within TOGETHER_M of each other light the city
//    „together“: both see who walks with them, the metres count as together-metres and each full together-km pays a
//    few Medi Coins (campaign economy `together`, daily cap, season budget). Nobody ever gets a coordinate: the
//    server only says WHO is next to you, and only to a crew member who is next to you too.
//  • Live — how many people walk in Tbilisi right now and how many are near the Saturday coin rain (numbers only,
//    hidden below MIN_LIVE so a tiny count can never point at one person).
// Tables are raw SQL created lazily (like MedipulsiGiftRule); every one cascades with the account.
import {randomInt,randomUUID} from 'node:crypto';
import {prisma} from '../prisma.js';
import {distance} from './core/engine.js';
import {economyOf} from './campaignStore.js';
import {COIN_SOURCE,syncQuestCache} from './giftRules.js';
import {budgetState,seasonPaid,weekStart,tbilisiMidnight} from './economy.js';
import {fail} from './schema.js';

export const CREW_MAX=30,TOGETHER_M=40,FRESH_MS=20_000,MIN_LIVE=3,CODE_ALPHABET='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const TOGETHER_DEFAULTS=Object.freeze({enabled:true,coinsPerKm:10,dailyCap:30});
const TB_OFFSET=4*3600_000;
const ymdOf=ms=>new Date(ms+TB_OFFSET).toISOString().slice(0,10);

/* ───────── pure helpers (tested) ───────── */
/** Crew names: 2–24 visible characters, one space between words, no links, handles or e-mail. */
export function cleanCrewName(raw){
 const name=String(raw??'').replace(/[\x00-\x1f\x7f\u200b-\u200f\u2028-\u202e\u2066-\u2069]/g,'').replace(/\s+/g,' ').trim();
 if(name.length<2||name.length>24)return null;
 if(/https?:|www\.|\.(com|ge|net|org|io|ru)\b|@|t\.me\//i.test(name))return null;
 return name;
}
export const normalizeCode=raw=>String(raw??'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,12);
export const validCode=code=>/^[A-Z0-9]{6}$/.test(code)&&[...code].every(c=>CODE_ALPHABET.includes(c));
export function newCode(){let s='';for(let i=0;i<6;i++)s+=CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];return s;}
export function togetherOf(campaign){
 const t={...TOGETHER_DEFAULTS,...(economyOf(campaign).together||{})};
 return {enabled:Boolean(t.enabled),coinsPerKm:Math.max(0,Math.min(500,Math.round(Number(t.coinsPerKm)||0))),dailyCap:Math.max(0,Math.min(5000,Math.round(Number(t.dailyCap)||0)))};
}
/** A player's last known spot counts only while it is fresh and precise. */
export function freshSpot(journey,now){
 const p=journey?.position;
 if(!Array.isArray(p)||!Number.isFinite(p[0])||!Number.isFinite(p[1]))return null;
 const at=Number(journey.lastFix);
 if(!Number.isFinite(at)||now-at>FRESH_MS||at-now>5000)return null;
 if(!(Number(journey.accuracy)<=30))return null;
 return p;
}
/** Crew members within TOGETHER_M of `me` (both fresh). `others` = [{handle, journey, settings}]. */
export function companionsNear(me,others,now){
 return others.filter(o=>o.settings?.together!==false).map(o=>({handle:o.handle,spot:freshSpot(o.journey,now)})).filter(o=>o.spot&&distance(me,o.spot)<=TOGETHER_M).map(o=>o.handle);
}
/**
 * Metres to add for one together tick: the distance walked since the previous together tick, only when that tick
 * was recent (≤ 30 s, same Tbilisi day) and never faster than a run (4.5 m/s) — a GPS jump or a gap adds nothing.
 */
export function togetherDelta(prev,spot,now){
 if(!prev?.lastAt||!Number.isFinite(prev.lng)||!Number.isFinite(prev.lat))return 0;
 const dt=(now-prev.lastAt)/1000;
 if(!(dt>0&&dt<=30)||ymdOf(prev.lastAt)!==ymdOf(now))return 0;
 const d=distance([prev.lng,prev.lat],spot);
 return d<=dt*4.5?d:0;
}
/** Full kilometres to pay after `meters` together today, given how many were paid and the coin rules. */
export function kmToPay(meters,paidKm,rules){
 if(!rules.enabled||!rules.coinsPerKm)return [];
 const capKm=rules.dailyCap>0?Math.floor(rules.dailyCap/rules.coinsPerKm):Infinity;
 const upTo=Math.min(Math.floor(meters/1000),capKm),out=[];
 for(let k=paidKm+1;k<=upTo;k++)out.push(k);
 return out;
}

/* ───────── tables ───────── */
let ready=false;
export async function ensureSocialTables(db=prisma){
 if(ready)return;
 await db.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "MedirunCrew" ("id" TEXT PRIMARY KEY, "name" TEXT NOT NULL, "code" TEXT NOT NULL UNIQUE, "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(), "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now())`);
 await db.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "MedirunCrewMember" ("memberId" TEXT PRIMARY KEY, "crewId" TEXT NOT NULL REFERENCES "MedirunCrew"("id") ON DELETE CASCADE, "userId" TEXT NOT NULL UNIQUE REFERENCES "User"("id") ON DELETE CASCADE, "role" TEXT NOT NULL DEFAULT 'MEMBER', "joinedAt" TIMESTAMPTZ NOT NULL DEFAULT now())`);
 await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "MedirunCrewMember_crewId_idx" ON "MedirunCrewMember"("crewId")`);
 await db.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "MedirunTogether" ("userId" TEXT PRIMARY KEY REFERENCES "User"("id") ON DELETE CASCADE, "lastAt" TIMESTAMPTZ, "lng" DOUBLE PRECISION, "lat" DOUBLE PRECISION, "day" TEXT, "meters" DOUBLE PRECISION NOT NULL DEFAULT 0, "paidKm" INTEGER NOT NULL DEFAULT 0, "week" TEXT, "weekMeters" DOUBLE PRECISION NOT NULL DEFAULT 0, "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now())`);
 ready=true;
}
const tx=fn=>prisma.$transaction(fn,{maxWait:10000,timeout:20000});

/* ───────── crews ───────── */
const crewCache=new Map();   // userId → {at, crewId|null}
function forgetCrew(...userIds){for(const id of userIds)crewCache.delete(id);}
async function crewIdOf(userId,db=prisma){
 const hit=crewCache.get(userId);if(hit&&Date.now()-hit.at<60_000)return hit.crewId;
 await ensureSocialTables(db);
 const [row]=await db.$queryRaw`SELECT "crewId" FROM "MedirunCrewMember" WHERE "userId"=${userId}`;
 const crewId=row?.crewId||null;crewCache.set(userId,{at:Date.now(),crewId});
 if(crewCache.size>20_000)crewCache.delete(crewCache.keys().next().value);
 return crewId;
}

/** What the app shows: the crew, its members (nickname, role, this week's metres) and the invite link. */
export async function crewView(userId,{db=prisma,now=Date.now(),lang='ka'}={}){
 await ensureSocialTables(db);
 const [mine]=await db.$queryRaw`SELECT m."crewId", m."role", c."name", c."code", c."createdAt" FROM "MedirunCrewMember" m JOIN "MedirunCrew" c ON c."id"=m."crewId" WHERE m."userId"=${userId}`;
 if(!mine)return {crew:null,max:CREW_MAX};
 const monday=weekStart(now),since=tbilisiMidnight(monday);
 const members=await db.$queryRaw`SELECT m."memberId", m."userId", m."role", m."joinedAt", coalesce(p."handle",'') AS handle,
   coalesce((SELECT sum(s."meters") FROM "MedipulsiSession" s WHERE s."userId"=m."userId" AND s."excluded"=false AND s."startedAt">=${since}),0)::float8 AS "weekMeters",
   coalesce((SELECT CASE WHEN t."week"=${monday} THEN t."weekMeters" ELSE 0 END FROM "MedirunTogether" t WHERE t."userId"=m."userId"),0)::float8 AS "togetherMeters"
  FROM "MedirunCrewMember" m LEFT JOIN "MedipulsiPlayer" p ON p."userId"=m."userId" WHERE m."crewId"=${mine.crewId} ORDER BY "weekMeters" DESC, m."joinedAt" ASC`;
 const rows=members.map(m=>({memberId:m.memberId,handle:m.handle||(lang==='en'?'Explorer':'მკვლევარი'),role:m.role==='OWNER'?'owner':'member',me:m.userId===userId,weekMeters:Math.round(m.weekMeters),togetherMeters:Math.round(m.togetherMeters)}));
 return {
  crew:{name:mine.name,code:mine.code,role:mine.role==='OWNER'?'owner':'member',link:`https://medicard.ge/crew/${mine.code}`,createdAt:mine.createdAt,
   week:{start:monday,meters:rows.reduce((s,r)=>s+r.weekMeters,0),togetherMeters:rows.reduce((s,r)=>s+r.togetherMeters,0)},
   members:rows},
  max:CREW_MAX,
 };
}

export async function createCrew(userId,rawName,{lang='ka'}={}){
 const name=cleanCrewName(rawName);
 if(!name)fail(400,'გუნდის სახელი 2–24 სიმბოლო უნდა იყოს, ბმულების გარეშე.','CREW_NAME_INVALID');
 await ensureSocialTables();
 await tx(async t=>{
  if((await t.$queryRaw`SELECT 1 FROM "MedirunCrewMember" WHERE "userId"=${userId}`).length)fail(409,'ჯერ დატოვე შენი ახლანდელი გუნდი.','ALREADY_IN_CREW');
  let code='';
  for(let i=0;i<8&&!code;i++){const c=newCode();if(!(await t.$queryRaw`SELECT 1 FROM "MedirunCrew" WHERE "code"=${c}`).length)code=c;}
  if(!code)fail(503,'კოდი ვერ შეიქმნა. სცადე თავიდან.','CREW_CODE_BUSY');
  const id=randomUUID();
  await t.$executeRaw`INSERT INTO "MedirunCrew" ("id","name","code") VALUES (${id},${name},${code})`;
  await t.$executeRaw`INSERT INTO "MedirunCrewMember" ("memberId","crewId","userId","role") VALUES (${randomUUID()},${id},${userId},'OWNER')`;
 });
 forgetCrew(userId);
 return crewView(userId,{lang});
}

export async function joinCrew(userId,rawCode,{lang='ka'}={}){
 const code=normalizeCode(rawCode);
 if(!validCode(code))fail(400,'კოდი 6 სიმბოლოსგან შედგება.','CREW_CODE_INVALID');
 await ensureSocialTables();
 await tx(async t=>{
  const [crew]=await t.$queryRaw`SELECT "id" FROM "MedirunCrew" WHERE "code"=${code} FOR UPDATE`;
  if(!crew)fail(404,'ასეთი გუნდი ვერ მოიძებნა. შეამოწმე კოდი.','CREW_NOT_FOUND');
  const [mine]=await t.$queryRaw`SELECT "crewId" FROM "MedirunCrewMember" WHERE "userId"=${userId}`;
  if(mine?.crewId===crew.id)return;
  if(mine)fail(409,'ჯერ დატოვე შენი ახლანდელი გუნდი.','ALREADY_IN_CREW');
  const [{n}]=await t.$queryRaw`SELECT count(*)::int AS n FROM "MedirunCrewMember" WHERE "crewId"=${crew.id}`;
  if(n>=CREW_MAX)fail(409,`გუნდი სავსეა (${CREW_MAX} წევრი).`,'CREW_FULL');
  await t.$executeRaw`INSERT INTO "MedirunCrewMember" ("memberId","crewId","userId","role") VALUES (${randomUUID()},${crew.id},${userId},'MEMBER')`;
 });
 forgetCrew(userId);
 return crewView(userId,{lang});
}

/** Leaving: the oldest member takes over an owner's crew; the last one out deletes it. */
export async function leaveCrew(userId,{lang='ka'}={}){
 await ensureSocialTables();
 let others=[];
 await tx(async t=>{
  const [mine]=await t.$queryRaw`SELECT "crewId","role" FROM "MedirunCrewMember" WHERE "userId"=${userId}`;
  if(!mine)return;
  await t.$queryRaw`SELECT "id" FROM "MedirunCrew" WHERE "id"=${mine.crewId} FOR UPDATE`;
  await t.$executeRaw`DELETE FROM "MedirunCrewMember" WHERE "userId"=${userId}`;
  const rest=await t.$queryRaw`SELECT "memberId","userId","role" FROM "MedirunCrewMember" WHERE "crewId"=${mine.crewId} ORDER BY "joinedAt" ASC`;
  others=rest.map(r=>r.userId);
  if(!rest.length)await t.$executeRaw`DELETE FROM "MedirunCrew" WHERE "id"=${mine.crewId}`;
  else if(!rest.some(r=>r.role==='OWNER'))await t.$executeRaw`UPDATE "MedirunCrewMember" SET "role"='OWNER' WHERE "memberId"=${rest[0].memberId}`;
 });
 forgetCrew(userId,...others);
 return crewView(userId,{lang});
}

export async function renameCrew(userId,rawName,{lang='ka'}={}){
 const name=cleanCrewName(rawName);
 if(!name)fail(400,'გუნდის სახელი 2–24 სიმბოლო უნდა იყოს, ბმულების გარეშე.','CREW_NAME_INVALID');
 await ensureSocialTables();
 const [mine]=await prisma.$queryRaw`SELECT "crewId","role" FROM "MedirunCrewMember" WHERE "userId"=${userId}`;
 if(!mine)fail(404,'გუნდში არ ხარ.','CREW_NONE');
 if(mine.role!=='OWNER')fail(403,'სახელს გუნდის შემქმნელი ცვლის.','CREW_OWNER_ONLY');
 await prisma.$executeRaw`UPDATE "MedirunCrew" SET "name"=${name},"updatedAt"=now() WHERE "id"=${mine.crewId}`;
 return crewView(userId,{lang});
}

export async function removeMember(userId,memberId,{lang='ka'}={}){
 await ensureSocialTables();
 let removed=null;
 await tx(async t=>{
  const [mine]=await t.$queryRaw`SELECT "crewId","role" FROM "MedirunCrewMember" WHERE "userId"=${userId}`;
  if(!mine)fail(404,'გუნდში არ ხარ.','CREW_NONE');
  if(mine.role!=='OWNER')fail(403,'წევრს გუნდის შემქმნელი ასახლებს.','CREW_OWNER_ONLY');
  const [target]=await t.$queryRaw`SELECT "userId" FROM "MedirunCrewMember" WHERE "memberId"=${memberId} AND "crewId"=${mine.crewId}`;
  if(!target)fail(404,'ეს წევრი გუნდში აღარ არის.','CREW_MEMBER_GONE');
  if(target.userId===userId)fail(409,'საკუთარი თავის გასასვლელად „გუნდის დატოვება“ გამოიყენე.','CREW_SELF');
  await t.$executeRaw`DELETE FROM "MedirunCrewMember" WHERE "memberId"=${memberId}`;
  removed=target.userId;
 });
 if(removed)forgetCrew(removed);
 return crewView(userId,{lang});
}

/* ───────── together ───────── */
/**
 * One nearby() tick for a walking player with a fresh fix. Returns null (no crew / nobody near / switched off) or
 * {with:[nicknames], meters (today, together), coins (paid this tick)}. Never throws.
 */
export async function togetherTick(userId,{spot,settings,campaign,now=Date.now(),db=prisma}){
 try{
  const rules=togetherOf(campaign);
  if(!rules.enabled||settings?.together===false)return null;
  const crewId=await crewIdOf(userId,db);
  if(!crewId)return null;
  const others=await db.$queryRaw`SELECT p."handle", p."settings", p."state"->'journey'->'position' AS position, (p."state"->'journey'->>'lastFix')::float8 AS "lastFix", (p."state"->'journey'->>'accuracy')::float8 AS accuracy
   FROM "MedirunCrewMember" m JOIN "MedipulsiPlayer" p ON p."userId"=m."userId" WHERE m."crewId"=${crewId} AND m."userId"<>${userId} AND p."activeSessionId" IS NOT NULL`;
  const near=companionsNear(spot,others.map(o=>({handle:o.handle,settings:o.settings,journey:{position:o.position,lastFix:o.lastFix,accuracy:o.accuracy}})),now);
  await ensureSocialTables(db);
  if(!near.length){
   // A gap breaks the chain: the next together tick starts counting from where it happens.
   await db.$executeRaw`UPDATE "MedirunTogether" SET "lastAt"=NULL WHERE "userId"=${userId} AND "lastAt" IS NOT NULL`;
   return null;
  }
  const day=ymdOf(now),week=weekStart(now);
  return await db.$transaction(async t=>{
   await t.$executeRaw`INSERT INTO "MedirunTogether" ("userId") VALUES (${userId}) ON CONFLICT ("userId") DO NOTHING`;
   const [row]=await t.$queryRaw`SELECT "lastAt","lng","lat","day","meters","paidKm","week","weekMeters" FROM "MedirunTogether" WHERE "userId"=${userId} FOR UPDATE`;
   const prev={lastAt:row.lastAt==null?null:+new Date(row.lastAt),lng:row.lng,lat:row.lat};
   const delta=togetherDelta(prev,spot,now);
   const meters=(row.day===day?row.meters:0)+delta,paidKm=row.day===day?row.paidKm:0,weekMeters=(row.week===week?row.weekMeters:0)+delta;
   let coins=0,paid=paidKm;
   const due=kmToPay(meters,paidKm,rules);
   if(due.length){
    const budget=budgetState(campaign,await seasonPaid(campaign,{db:t}),now);
    if(!budget.stopped){
     for(const k of due){
      const sourceId=`together:${day}:${k}`;
      const has=await t.rewardLedger.findUnique({where:{userId_currency_sourceType_sourceId:{userId,currency:'COIN',sourceType:COIN_SOURCE,sourceId}}});
      if(!has){await t.rewardLedger.create({data:{id:randomUUID(),userId,currency:'COIN',amount:rules.coinsPerKm,transactionType:'EARN',sourceType:COIN_SOURCE,sourceId,createdAt:new Date(now),metadata:{kind:'together',km:k,day,campaign:campaign.id}}});coins+=rules.coinsPerKm;}
      paid=k;
     }
     if(coins)await syncQuestCache(t,userId);
    }
   }
   await t.$executeRaw`UPDATE "MedirunTogether" SET "lastAt"=${new Date(now)},"lng"=${spot[0]},"lat"=${spot[1]},"day"=${day},"meters"=${meters},"paidKm"=${paid},"week"=${week},"weekMeters"=${weekMeters},"updatedAt"=now() WHERE "userId"=${userId}`;
   const capKm=rules.dailyCap>0&&rules.coinsPerKm?Math.floor(rules.dailyCap/rules.coinsPerKm):Infinity;
   return {with:near.slice(0,5),count:near.length,meters:Math.round(meters),coins,coinsPerKm:rules.coinsPerKm,nextKmIn:rules.coinsPerKm&&paid<capKm?Math.max(0,Math.round((paid+1)*1000-meters)):null};
  },{maxWait:5000,timeout:10000});
 }catch(error){
  console.warn('[medirun] together tick skipped',error?.message);
  return null;
 }
}

/* ───────── live counts ───────── */
let liveCache={at:0,key:'',value:null};
/**
 * How many people walk right now (active session, fix in the last 2 minutes) inside `bbox` = [w,s,e,n], and how
 * many of them are within `rain.radiusM` of the Saturday rain centre while it runs. Numbers below MIN_LIVE → null.
 */
export async function liveWalkers({bbox,rain=null,db=prisma,now=Date.now()}){
 const key=JSON.stringify([bbox,rain]);
 if(liveCache.value&&liveCache.key===key&&now-liveCache.at<30_000)return liveCache.value;
 const rows=await db.$queryRaw`SELECT p."state"->'journey'->'position' AS position, (p."state"->'journey'->>'lastFix')::float8 AS "lastFix" FROM "MedipulsiPlayer" p WHERE p."activeSessionId" IS NOT NULL`.catch(()=>[]);
 const spots=rows.filter(r=>Array.isArray(r.position)&&Number.isFinite(r.lastFix)&&now-r.lastFix<=120_000).map(r=>r.position);
 const inside=bbox?spots.filter(([x,y])=>x>=bbox[0]&&x<=bbox[2]&&y>=bbox[1]&&y<=bbox[3]):spots;
 const nearRain=rain?inside.filter(p=>distance(p,rain.center)<=rain.radiusM).length:0;
 const value={walkers:inside.length>=MIN_LIVE?inside.length:null,rain:rain&&nearRain>=MIN_LIVE?nearRain:null};
 liveCache={at:now,key,value};
 return value;
}

/* ───────── admin ───────── */
export async function adminCrews({db=prisma}={}){
 await ensureSocialTables(db);
 return db.$queryRaw`SELECT c."id", c."name", c."code", c."createdAt", count(m."userId")::int AS members FROM "MedirunCrew" c LEFT JOIN "MedirunCrewMember" m ON m."crewId"=c."id" GROUP BY c."id" ORDER BY c."createdAt" DESC LIMIT 500`;
}
export async function adminDeleteCrew(id,adminId,{db=prisma}={}){
 await ensureSocialTables(db);
 const [crew]=await db.$queryRaw`SELECT "id","name","code" FROM "MedirunCrew" WHERE "id"=${id}`;
 if(!crew)fail(404,'გუნდი ვერ მოიძებნა.','CREW_NOT_FOUND');
 const members=(await db.$queryRaw`SELECT "userId" FROM "MedirunCrewMember" WHERE "crewId"=${id}`).map(r=>r.userId);
 await db.$executeRaw`DELETE FROM "MedirunCrew" WHERE "id"=${id}`;
 forgetCrew(...members);
 await db.medipulsiAudit.create({data:{id:randomUUID(),actorId:adminId||'admin',action:'CREW_DELETE',entityId:id,details:{name:crew.name,code:crew.code,members:members.length}}}).catch(()=>{});
 return {deleted:true};
}
