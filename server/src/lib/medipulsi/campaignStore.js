// The „გაანათე თბილისი“ box rules, editable from admin (owner 2026-10-04: „ყუთების დაყრის ლოგიკის მოდული …
// სრული მენეჯმენტი“). The repo file server/src/data/medirun-campaign.json is the default; an admin save writes
// the whole campaign into "MedirunCampaign" (raw SQL, created lazily like "MedipulsiGiftRule") and that row wins.
// „ნაგულისხმევზე დაბრუნება“ deletes the row. Every reader (autopilot, /drops, /grand) goes through getCampaign().
// Changes apply to boxes that do not exist yet: the autopilot never edits a box it already created.
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {prisma} from '../prisma.js';

export const FILE_CAMPAIGN=JSON.parse(readFileSync(new URL('../../data/medirun-campaign.json',import.meta.url),'utf8'));

const ymd=z.string().regex(/^\d{4}-\d{2}-\d{2}$/,'თარიღი YYYY-MM-DD ფორმატით');
const hhmm=z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/,'დრო HH:MM ფორმატით');
const int=(min,max)=>z.number().int().min(min).max(max);
const words=(max=300)=>z.object({ka:z.string().trim().min(1).max(max),en:z.string().trim().min(1).max(max)});
const coins=z.array(z.object({amount:int(1,10000),weight:z.number().min(0).max(1000)})).min(1).max(12)
 .refine(list=>list.some(o=>o.weight>0),'ქოინების ცხრილში ერთ ვარიანტს მაინც უნდა ჰქონდეს წილი');
// Box ids are glow-<date>-<wave id>-NN; „sat“, „lan“ and „x“ belong to the Saturday rain, lanterns and manual drops.
const wave=z.object({id:z.string().regex(/^[a-z0-9]{1,8}$/).refine(v=>!['sat','lan','x'].includes(v),'ტალღის ეს კოდი დაკავებულია'),time:hhmm,hours:z.number().min(.5).max(16),rotation:int(0,30),focus:int(0,30),litOnly:z.boolean().optional()});
const radii=v=>v.pulseRadius>v.revealRadius;
const dayFields={note:z.string().max(300).optional(),waves:z.array(wave).max(8).refine(list=>new Set(list.map(w=>w.id)).size===list.length,'ტალღების კოდები არ უნდა მეორდებოდეს'),coins,stock:z.tuple([int(1,1000),int(1,1000)]).refine(([lo,hi])=>lo<=hi,'მარაგის „დან“ „მდე“-ზე დიდი ვერ იქნება'),pulseRadius:int(40,500),revealRadius:int(10,50),minDepthM:int(0,500)};
const day=z.object(dayFields).refine(radii,'პულსის რადიუსი გახსნის რადიუსზე დიდი უნდა იყოს');
const dayPatch=z.object(dayFields).partial();
const lantern=z.object({from:ymd,points:int(0,10),stock:int(1,1000),coins:int(1,10000),minPercent:z.number().min(.01).max(100)});
const saturday=z.object({time:hhmm,hours:z.number().min(.5).max(12),points:int(1,30),stock:int(1,1000),radiusM:int(100,3000),pulseRadius:int(40,500),revealRadius:int(10,50),coins,lantern:lantern.nullable().optional(),dates:z.record(ymd,z.string().min(1).max(40))}).refine(radii,'შაბათის პულსის რადიუსი გახსნის რადიუსზე დიდი უნდა იყოს');
const week=z.object({from:ymd,to:ymd,theme:z.string().trim().min(1).max(40),anchors:z.array(z.tuple([z.number().min(44.5).max(45.2),z.number().min(41.5).max(41.95),int(50,5000)])).max(10).optional(),districts:z.array(z.string().min(1).max(40)).max(10).optional(),kinds:z.array(z.string().min(1).max(30)).max(10).optional()}).refine(w=>w.from<=w.to,'კვირის დასაწყისი დასასრულზე გვიან ვერ იქნება');
const level=z.object({id:z.string().regex(/^[a-z0-9-]{1,20}$/),percent:z.number().min(.001).max(100),name:words(60),unlocks:words(300)});
const grand=z.object({id:z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/),dropAt:z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?\+04:00$/,'დიდი საჩუქრის დრო თბილისის დროით'),hours:z.number().min(.5).max(24),minPercent:z.number().min(0).max(100),prize:words(80),detail:words(80),pulseRadius:int(40,500),revealRadius:int(10,50),spot:z.string().max(80).nullable()}).refine(radii,'დიდი საჩუქრის პულსის რადიუსი გახსნის რადიუსზე დიდი უნდა იყოს');
const simpleWave=z.object({id:z.string().regex(/^[a-z0-9]{1,8}$/).refine(v=>!['sat','lan','x'].includes(v),'ტალღის ეს კოდი დაკავებულია'),time:hhmm,hours:z.number().min(.5).max(16)});
const cities=z.object({enabled:z.boolean(),minPlayers:int(1,10000),waves:z.array(simpleWave).max(6).refine(list=>new Set(list.map(w=>w.id)).size===list.length,'ტალღების კოდები არ უნდა მეორდებოდეს'),boxesPerWave:z.object({base:int(0,30),perPlayers:int(1,100000),max:int(0,30)}),weekendExtra:int(0,10),coins,weekendCoins:coins.optional(),stock:z.tuple([int(1,1000),int(1,1000)]).refine(([lo,hi])=>lo<=hi,'მარაგის „დან“ „მდე“-ზე დიდი ვერ იქნება'),pulseRadius:int(40,500),revealRadius:int(10,50),overrides:z.record(z.string().regex(/^[a-z]\d+$/),z.object({off:z.boolean().optional(),boxesPerWave:int(0,30).optional(),note:z.string().max(300).optional()})).optional()}).refine(radii,'ქალაქების პულსის რადიუსი გახსნის რადიუსზე დიდი უნდა იყოს');
const override=z.object({off:z.boolean().optional(),as:z.enum(['weekday','weekend']).optional(),day:dayPatch.optional(),note:z.string().max(300).optional()});
// Economy 2 (owner 2026-10-04): the first-finder ladder, the season coin budget and the Monday leaderboard prizes.
const prizeList=z.array(int(0,10000)).max(10);
const economy=z.object({
 note:z.string().max(600).optional(),
 version:int(1,99).default(2),
 decay:z.array(int(1,100)).min(1).max(12).refine(d=>d.every((v,i)=>!i||v<=d[i-1]),'კიბე უნდა იკლებდეს: ყოველი შემდეგი გახსნა წინაზე მეტს ვერ იღებს'),
 budget:z.object({seasonCoins:int(0,10_000_000),warnAt:z.array(z.number().min(1).max(100)).max(5).default([50,80])}),
 weeklyPrizes:z.object({boxes:prizeList.default([]),meters:prizeList.default([])}),
});
export const FILE_ECONOMY=Object.freeze(structuredClone(FILE_CAMPAIGN.economy));
/** The campaign's economy with the file's values for anything a saved row lacks. */
export const economyOf=campaign=>({...FILE_ECONOMY,...(campaign?.economy||{}),budget:{...FILE_ECONOMY.budget,...(campaign?.economy?.budget||{})},weeklyPrizes:{...FILE_ECONOMY.weeklyPrizes,...(campaign?.economy?.weeklyPrizes||{})}});

export const campaignSchema=z.object({
 id:z.literal(FILE_CAMPAIGN.id),
 name:words(80),
 start:ymd,end:ymd,
 utcOffset:z.literal('+04:00'),
 area:z.object({id:z.string(),ka:z.string(),en:z.string(),km2:z.number().positive()}),
 rulesUrl:z.string().url().refine(u=>u.startsWith('https://'),'წესების ბმული https-ით'),
 days:z.object({weekday:day,weekend:day}),
 saturday,
 weeks:z.array(week).max(30),
 levels:z.array(level).min(1).max(10),
 grand,
 dayOverrides:z.record(ymd,override).optional(),
 excludedSpots:z.array(z.string().min(1).max(80)).max(400).optional(),
 cities:cities.optional(),
 economy:economy.optional(),
}).refine(c=>c.start<=c.end,'კამპანიის დასაწყისი დასასრულზე გვიან ვერ იქნება');

/**
 * A saved campaign from before economy 2 gets the file's economy blocks (waves, coins, stock, Saturday, cities,
 * levels, economy) while everything the admin shaped by hand stays: name, dates, weeks, grand prize, day
 * overrides, excluded spots, Saturday parks, city overrides. Pure; null when nothing needs upgrading.
 */
export function upgradeCampaign(saved,file=FILE_CAMPAIGN){
 const have=Number(saved?.economy?.version)||1,want=Number(file.economy?.version)||1;
 if(have>=want)return null;
 return {
  ...saved,
  days:structuredClone(file.days),
  saturday:{...structuredClone(file.saturday),dates:saved.saturday?.dates||file.saturday.dates},
  cities:{...structuredClone(file.cities),overrides:saved.cities?.overrides||{}},
  levels:structuredClone(file.levels),
  economy:structuredClone(file.economy),
 };
}

/** Parses a draft; throws a 400 with the first problem in Georgian. */
export function parseCampaign(data){
 const r=campaignSchema.safeParse(data);
 if(r.success)return r.data;
 const first=r.error.issues[0];
 throw Object.assign(new Error(`${first?.message||'არასწორი მნიშვნელობა'}${first?.path?.length?` (${first.path.join(' › ')})`:''}`),{status:400,code:'CAMPAIGN_INVALID'});
}

let ready=false,upgrading=false;
async function ensureTable(db){
 if(ready)return;
 await db.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "MedirunCampaign" ("id" TEXT PRIMARY KEY, "data" JSONB NOT NULL, "revision" INTEGER NOT NULL DEFAULT 1, "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(), "updatedBy" TEXT)`);
 ready=true;
}

// Read on every /drops, /grand and autopilot tick: keep the parsed campaign for 30 s per instance.
let cache={at:0,value:null};
export function clearCampaignCache(){cache={at:0,value:null};}

/** The saved row (or null) with its revision; a broken row falls back to the file and says so. */
export async function campaignRecord(db=prisma){
 try{
  await ensureTable(db);
  const rows=await db.$queryRaw`SELECT "data","revision","updatedAt","updatedBy" FROM "MedirunCampaign" WHERE "id"=${FILE_CAMPAIGN.id}`;
  if(!rows[0])return {campaign:FILE_CAMPAIGN,source:'file',revision:0,updatedAt:null,updatedBy:null};
  try{
   let campaign=parseCampaign(rows[0].data),revision=rows[0].revision;
   // Economy 2 rolled out after the admin saved rules: adopt the new economy once, keep the admin's own choices.
   const upgraded=upgradeCampaign(campaign);
   if(upgraded){
    campaign=parseCampaign(upgraded);
    if(!upgrading){
     upgrading=true;
     try{
      await db.$executeRaw`UPDATE "MedirunCampaign" SET "data"=${JSON.stringify(campaign)}::jsonb,"revision"="revision"+1,"updatedAt"=now(),"updatedBy"='economy-upgrade' WHERE "id"=${FILE_CAMPAIGN.id} AND "revision"=${revision}`;
      await db.medipulsiAudit.create({data:{id:randomUUID(),actorId:'medirun-autopilot',action:'DROP_RULES_UPGRADE',entityId:campaign.id,details:{from:Number(rows[0].data?.economy?.version)||1,to:campaign.economy.version}}}).catch(()=>{});
      revision+=1;
      console.log(`[medirun] campaign rules upgraded to economy ${campaign.economy.version}`);
     }catch(error){console.warn('[medirun] economy upgrade not saved',error?.message);}
    }
   }
   return {campaign,source:'admin',revision,updatedAt:rows[0].updatedAt,updatedBy:rows[0].updatedBy};
  }
  catch(error){console.warn('[medirun] saved campaign is invalid, using the file',error?.message);return {campaign:FILE_CAMPAIGN,source:'file',revision:rows[0].revision,updatedAt:rows[0].updatedAt,updatedBy:rows[0].updatedBy,invalid:error.message};}
 }catch(error){
  console.warn('[medirun] campaign table unavailable',error?.message);
  return {campaign:FILE_CAMPAIGN,source:'file',revision:0,updatedAt:null,updatedBy:null};
 }
}

export async function getCampaign(db=prisma,now=Date.now()){
 if(cache.value&&now-cache.at<30_000)return cache.value;
 const {campaign}=await campaignRecord(db);
 cache={at:now,value:campaign};
 return campaign;
}

/** Optimistic save: `revision` is what the editor loaded (0 = still the file). */
export async function saveCampaign(data,{revision,adminId,db=prisma}){
 const campaign=parseCampaign(data);
 await ensureTable(db);
 const rows=await db.$queryRaw`SELECT "revision" FROM "MedirunCampaign" WHERE "id"=${FILE_CAMPAIGN.id}`;
 const current=rows[0]?.revision??0;
 if(current!==revision)throw Object.assign(new Error('წესები სხვამ შეცვალა. განაახლე გვერდი და თავიდან შეიტანე.'),{status:409,code:'CAMPAIGN_CHANGED'});
 await db.$executeRaw`INSERT INTO "MedirunCampaign" ("id","data","revision","updatedAt","updatedBy") VALUES (${FILE_CAMPAIGN.id},${JSON.stringify(campaign)}::jsonb,${current+1},now(),${adminId||null})
  ON CONFLICT ("id") DO UPDATE SET "data"=EXCLUDED."data","revision"=EXCLUDED."revision","updatedAt"=now(),"updatedBy"=EXCLUDED."updatedBy"`;
 clearCampaignCache();
 return campaign;
}

export async function resetCampaign({db=prisma}={}){
 await ensureTable(db);
 await db.$executeRaw`DELETE FROM "MedirunCampaign" WHERE "id"=${FILE_CAMPAIGN.id}`;
 clearCampaignCache();
 return FILE_CAMPAIGN;
}
