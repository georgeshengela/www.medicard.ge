// Admin „MEDIRUN ყუთები“ (#/medirun-boxes, owner 2026-10-04): everything about the „გაანათე თბილისი“ boxes in one
// place — today's boxes live, the weekly rules, single days switched off or changed, spots taken out, manual drops,
// per-box actions and the numbers. Rules live in campaignStore.js; boxes are MedipulsiGift rows + MedipulsiGiftRule.
// The autopilot only ever adds boxes that do not exist yet, so rule changes reach boxes not created so far;
// „ხელახლა აწყობა“ replaces a day's boxes that have not started and that nobody opened.
import {randomUUID} from 'node:crypto';
import {prisma} from '../prisma.js';
import {planDay,applyDay,loadSpots,tbilisiDate,dateAdd,dayOf,autopilotEnabled} from './autopilot.js';
import {campaignRecord,getCampaign,saveCampaign,parseCampaign,clearCampaignCache} from './campaignStore.js';
import {giftRules,upsertGiftRule,ensureGiftRuleTable,clearGiftRuleCache} from './giftRules.js';
import {isFeatureEnabled,setFeatureFlag} from '../featureFlags.js';
import {listCities,citySpots,addCity,setCityEnabled,requeueCity,harvestCity,planCityDay,cityDates,ensureCityTable,cityRulesOf,boxesPerWave} from './cities.js';
import {CITY_HELPERS,dayKind} from './autopilot.js';
import {localDate} from './citySpotsMath.js';

const HOUR=3600_000,DAY=24*HOUR,OFFSET='+04:00';
const bad=(status,message,code='DROPS_ERROR')=>{throw Object.assign(new Error(message),{status,code});};
const dayStart=date=>new Date(`${date}T00:00:00${OFFSET}`);
const audit=(db,adminId,action,entityId,details={})=>db.medipulsiAudit.create({data:{id:randomUUID(),actorId:adminId||'admin',action,entityId,details}});
const isGrand=(g,campaign)=>g.id===campaign.grand.id;

/** One box as the admin sees it, with its live state in words-ready codes. */
export function boxRow(g,rule,now=Date.now()){
 const status=g.archived?'canceled':!g.published?'hidden':+g.startsAt>now?'planned':+g.endsAt<=now?'ended':g.allocated>=g.stock?'empty':'live';
 return {id:g.id,title:g.title,startsAt:g.startsAt,endsAt:g.endsAt,stock:g.stock,allocated:g.allocated,status,revision:g.revision,
  coins:rule?.coins||0,kind:rule?.meta?.kind||(g.rewardKind==='PHYSICAL'?'prize':'admin'),cityId:rule?.meta?.cityId||null,city:rule?.meta?.city||null,district:rule?.meta?.district||null,place:rule?.meta?.place||null,spot:rule?.meta?.spot||null,
  minPercent:rule?.minPercent||null,latitude:g.latitude,longitude:g.longitude,pulseRadius:g.pulseRadius,revealRadius:g.revealRadius,rewardKind:g.rewardKind};
}

async function freshRules(db){clearGiftRuleCache();return giftRules(db);}

/** Every box of one Tbilisi date: the autopilot's (glow-<date>-…) and any admin gift that starts that day. */
export async function dayBoxes(date,{db=prisma,now=Date.now()}={}){
 const from=dayStart(date),to=new Date(+from+DAY);
 const [gifts,rules]=await Promise.all([
  db.medipulsiGift.findMany({where:{OR:[{id:{startsWith:`glow-${date}-`}},{startsAt:{gte:from,lt:to}}]},orderBy:[{startsAt:'asc'},{id:'asc'}]}),
  freshRules(db),
 ]);
 return gifts.map(g=>boxRow(g,rules.get(g.id),now));
}

/** Per-day numbers between two dates (inclusive): boxes, capacity, openings, players, coins. */
export async function dayNumbers(from,to,{db=prisma}={}){
 const since=dayStart(from),until=new Date(+dayStart(to)+DAY);
 const [boxes,claims,coins]=await Promise.all([
  db.$queryRaw`SELECT to_char(("startsAt" AT TIME ZONE 'Asia/Tbilisi'),'YYYY-MM-DD') AS d, count(*)::int AS boxes, coalesce(sum("stock"),0)::int AS capacity, coalesce(sum("allocated"),0)::int AS taken FROM "MedipulsiGift" WHERE "archived"=false AND "startsAt">=${since} AND "startsAt"<${until} GROUP BY 1`,
  db.$queryRaw`SELECT to_char(("createdAt" AT TIME ZONE 'Asia/Tbilisi'),'YYYY-MM-DD') AS d, count(*)::int AS opened, count(DISTINCT "userId")::int AS players FROM "MedipulsiClaim" WHERE "createdAt">=${since} AND "createdAt"<${until} GROUP BY 1`,
  db.$queryRaw`SELECT to_char(("createdAt" AT TIME ZONE 'Asia/Tbilisi'),'YYYY-MM-DD') AS d, coalesce(sum("amount"),0)::int AS coins FROM "RewardLedger" WHERE "sourceType"='MEDIRUN' AND "currency"='COIN' AND "createdAt">=${since} AND "createdAt"<${until} GROUP BY 1`,
 ]);
 const by=(rows,key)=>new Map(rows.map(r=>[r.d,r[key]]));
 const b=new Map(boxes.map(r=>[r.d,r])),o=by(claims,'opened'),p=by(claims,'players'),c=by(coins,'coins');
 const out=[];
 for(let d=from;d<=to;d=dateAdd(d,1))out.push({date:d,boxes:b.get(d)?.boxes||0,capacity:b.get(d)?.capacity||0,opened:o.get(d)||0,players:p.get(d)||0,coins:c.get(d)||0});
 return out;
}

/** Where boxes were opened in the last `days` days, by district (from the rule's spot data). */
async function districtOpenings(days,{db,now}){
 const since=new Date(now-days*DAY);
 await ensureGiftRuleTable(db);
 return db.$queryRaw`SELECT coalesce(r."meta"->>'district','სხვა') AS district, count(*)::int AS opened FROM "MedipulsiClaim" c LEFT JOIN "MedipulsiGiftRule" r ON r."giftId"=c."giftId" WHERE c."createdAt">=${since} GROUP BY 1 ORDER BY 2 DESC LIMIT 12`;
}

export async function autopilotState(db=prisma){
 return {enabled:await autopilotEnabled(db).catch(()=>false),flag:await isFeatureEnabled('medirunAutopilot',db).catch(()=>false),medirun:await isFeatureEnabled('medirun',db).catch(()=>false),envOff:String(process.env.MEDIRUN_AUTOPILOT||'').toLowerCase()==='off'};
}

/** The page's first screen: rules source, autopilot, today and tomorrow, live numbers, the last 14 days. */
export async function dropsOverview({db=prisma,now=Date.now()}={}){
 const today=tbilisiDate(now),tomorrow=dateAdd(today,1);
 const [record,autopilot,boxesToday,boxesTomorrow,last14,districts]=await Promise.all([
  campaignRecord(db),autopilotState(db),dayBoxes(today,{db,now}),dayBoxes(tomorrow,{db,now}),dayNumbers(dateAdd(today,-13),today,{db}),districtOpenings(30,{db,now}),
 ]);
 const campaign=record.campaign,visible=boxesToday.filter(b=>b.kind!=='grand');
 const live=visible.filter(b=>b.status==='live');
 const upcoming=[...boxesToday,...boxesTomorrow].filter(b=>b.status==='planned'&&b.kind!=='grand').sort((a,b)=>+new Date(a.startsAt)-+new Date(b.startsAt));
 const next=upcoming[0]?upcoming.filter(b=>+new Date(b.startsAt)===+new Date(upcoming[0].startsAt)):[];
 const t=last14.at(-1)||{opened:0,coins:0,players:0};
 const spots=loadSpots().spots,excluded=new Set(campaign.excludedSpots||[]);
 return {
  today,tomorrow,
  rules:{source:record.source,revision:record.revision,updatedAt:record.updatedAt,updatedBy:record.updatedBy,invalid:record.invalid||null},
  campaign,autopilot,
  status:today<campaign.start?'upcoming':today>campaign.end?'ended':'live',
  dayToday:dayOf(campaign,today),dayTomorrow:dayOf(campaign,tomorrow),
  live:{boxes:live.length,openingsLeft:live.reduce((s,b)=>s+Math.max(0,b.stock-b.allocated),0),openedToday:t.opened,playersToday:t.players,coinsToday:t.coins},
  next:next.length?{startsAt:next[0].startsAt,boxes:next.length,coins:{min:Math.min(...next.map(b=>b.coins)),max:Math.max(...next.map(b=>b.coins))}}:null,
  boxes:{[today]:boxesToday,[tomorrow]:boxesTomorrow},
  last14,districts,
  spots:{total:spots.length,excluded:spots.filter(s=>excluded.has(s.id)).length},
 };
}

const planRow=(p,existing,now)=>({id:p.gift.id,startsAt:p.gift.startsAt,endsAt:p.gift.endsAt,kind:p.rule.meta?.kind||'admin',coins:p.rule.coins,stock:p.gift.stock,district:p.rule.meta?.district||null,place:p.rule.meta?.place||null,spot:p.rule.meta?.spot||null,minPercent:p.rule.minPercent,latitude:p.gift.latitude,longitude:p.gift.longitude,exists:existing.has(p.gift.id),past:+p.gift.endsAt<=now});

/** What the rules (saved or a draft) would place on `days` dates from `from`, beside what already exists. */
export async function previewDays({draft=null,from,days=1,db=prisma,now=Date.now()}){
 const campaign=draft?parseCampaign(draft):await getCampaign(db,now);
 const dates=Array.from({length:Math.max(1,Math.min(14,days))},(_,i)=>dateAdd(from,i));
 const plans=dates.map(date=>({date,plan:planDay(date,{campaign})}));
 const ids=plans.flatMap(p=>p.plan.map(x=>x.gift.id));
 const existing=new Set(ids.length?(await db.medipulsiGift.findMany({where:{id:{in:ids}},select:{id:true}})).map(g=>g.id):[]);
 return plans.map(({date,plan})=>{const o=dayOf(campaign,date);return {date,kind:o.kind,off:o.off,note:o.override?.note||null,saturday:Boolean(campaign.saturday.dates?.[date]),boxes:plan.map(p=>planRow(p,existing,now)),coins:plan.reduce((s,p)=>s+p.rule.coins*p.gift.stock,0)};});
}

/** One line per campaign date: template, override, planned boxes and coins, what already exists. */
export async function campaignCalendar({db=prisma,now=Date.now()}={}){
 const campaign=await getCampaign(db,now);
 const rows=[];
 for(let d=campaign.start;d<=campaign.end;d=dateAdd(d,1)){
  const plan=planDay(d,{campaign}),o=dayOf(campaign,d),regular=plan.filter(p=>p.gift.id!==campaign.grand.id);
  rows.push({date:d,kind:o.kind,off:o.off,as:o.override?.as||null,custom:Boolean(o.override?.day),note:o.override?.note||null,saturday:Boolean(campaign.saturday.dates?.[d])&&!o.off,lantern:regular.some(p=>p.rule.meta?.kind==='lantern'),grand:plan.some(p=>p.gift.id===campaign.grand.id),
   boxes:regular.length,openings:regular.reduce((s,p)=>s+p.gift.stock,0),coins:regular.reduce((s,p)=>s+p.rule.coins*p.gift.stock,0),
   times:[...new Set(regular.map(p=>new Date(+p.gift.startsAt+4*HOUR).toISOString().slice(11,16)))]});
 }
 const counts=await db.$queryRaw`SELECT substring("id" from 6 for 10) AS d, count(*)::int AS n FROM "MedipulsiGift" WHERE "id" LIKE 'glow-%' AND "archived"=false GROUP BY 1`;
 const made=new Map(counts.map(r=>[r.d,r.n]));
 return rows.map(r=>({...r,created:made.get(r.date)||0,past:r.date<tbilisiDate(now)}));
}

/** All spots with district, park, depth, light, whether taken out, and how many campaign boxes used each. */
export async function spotList({db=prisma,now=Date.now()}={}){
 const campaign=await getCampaign(db,now),excluded=new Set(campaign.excludedSpots||[]);
 await ensureGiftRuleTable(db);
 const used=await db.$queryRaw`SELECT "meta"->>'spot' AS spot, count(*)::int AS n FROM "MedipulsiGiftRule" WHERE "campaign"=${campaign.id} GROUP BY 1`;
 const n=new Map(used.map(r=>[r.spot,r.n]));
 const {spots,golden}=loadSpots();
 return {
  spots:spots.map(s=>({id:s.id,place:s.place,district:s.district||null,kind:s.kind||null,lit:s.lit===true,depthM:s.depthM??null,areaM2:s.areaM2??null,latitude:s.lat,longitude:s.lng,excluded:excluded.has(s.id),used:n.get(s.id)||0})),
  golden:Object.entries(golden||{}).map(([key,g])=>({key,place:g.place,latitude:g.lat,longitude:g.lng})),
 };
}

/* ───────── writes (every one audited) ───────── */

export async function saveRules(data,{revision,adminId,db=prisma}){
 const before=await campaignRecord(db);
 const campaign=await saveCampaign(data,{revision,adminId,db});
 await audit(db,adminId,'DROP_RULES_SAVE',campaign.id,{revision:revision+1,changed:changedKeys(before.campaign,campaign)});
 return campaignRecord(db);
}
function changedKeys(a,b){return Object.keys({...a,...b}).filter(k=>JSON.stringify(a?.[k])!==JSON.stringify(b?.[k]));}

/** Changes one part of the saved rules (a day override, the spot list) and saves the whole campaign. */
async function patchRules(mutate,{adminId,db,action,entityId,details}){
 const record=await campaignRecord(db);
 const next=structuredClone(record.campaign);
 mutate(next);
 await saveCampaign(next,{revision:record.revision,adminId,db});
 await audit(db,adminId,action,entityId,details);
 return campaignRecord(db);
}

export function setDayOverride(date,override,{adminId,db=prisma}){
 return patchRules(c=>{
  const map={...(c.dayOverrides||{})};
  if(override&&(override.off||override.as||override.day||override.note))map[date]=override;else delete map[date];
  c.dayOverrides=map;
 },{adminId,db,action:'DROP_DAY_RULE',entityId:date,details:{override}});
}

export function setSpotExcluded(spotId,excluded,{adminId,db=prisma}){
 const {spots,golden}=loadSpots();
 if(!spots.some(s=>s.id===spotId)&&!golden?.[spotId])bad(404,'ადგილი ვერ მოიძებნა.');
 return patchRules(c=>{
  const set=new Set(c.excludedSpots||[]);
  if(excluded)set.add(spotId);else set.delete(spotId);
  c.excludedSpots=[...set];
 },{adminId,db,action:excluded?'DROP_SPOT_EXCLUDE':'DROP_SPOT_RESTORE',entityId:spotId});
}

/** Creates the day's missing boxes now (ones whose time already passed are skipped). */
export async function applyDate(date,{adminId,db=prisma,now=Date.now()}){
 clearCampaignCache();
 const campaign=await getCampaign(db,now);
 const plan=planDay(date,{campaign}).filter(p=>+p.gift.endsAt>now);
 const r=await applyDay(date,{db,plan});
 await audit(db,adminId,'DROP_DAY_APPLY',date,{created:r.created,existing:r.existing});
 return r;
}

/** Deletes the day's boxes that have not started and that nobody opened, then places them again from the rules. */
export async function regenerateDate(date,{adminId,db=prisma,now=Date.now()}){
 clearCampaignCache();
 const campaign=await getCampaign(db,now);
 const candidates=await db.medipulsiGift.findMany({where:{id:{startsWith:`glow-${date}-`},startsAt:{gt:new Date(now)},allocated:0},select:{id:true}});
 // Tbilisi's boxes only: other cities' (glow-<date>-<cityId>-…) are rebuilt from the „ქალაქები“ tab.
 const ids=candidates.map(g=>g.id).filter(id=>id!==campaign.grand.id&&!id.startsWith(`glow-${date}-x-`)&&!/^glow-\d{4}-\d{2}-\d{2}-[a-z]\d+-/.test(id));
 const claimed=new Set(ids.length?(await db.medipulsiClaim.findMany({where:{giftId:{in:ids}},select:{giftId:true}})).map(c=>c.giftId):[]);
 const remove=ids.filter(id=>!claimed.has(id));
 if(remove.length){
  await ensureGiftRuleTable(db);
  await db.$transaction(async tx=>{
   await tx.$executeRaw`DELETE FROM "MedipulsiGiftRule" WHERE "giftId" = ANY(${remove})`;
   await tx.medipulsiGift.deleteMany({where:{id:{in:remove},allocated:0}});
  });
  clearGiftRuleCache();
 }
 const plan=planDay(date,{campaign}).filter(p=>+p.gift.endsAt>now);
 const r=await applyDay(date,{db,plan});
 await audit(db,adminId,'DROP_DAY_REBUILD',date,{removed:remove.length,created:r.created});
 return {removed:remove.length,created:r.created,total:r.total};
}

/** Takes every box of the date that has not ended off the map (archived; openings already paid stay). */
export async function cancelDate(date,{adminId,db=prisma,now=Date.now()}){
 const from=dayStart(date),to=new Date(+from+DAY);
 const r=await db.medipulsiGift.updateMany({where:{archived:false,endsAt:{gt:new Date(now)},OR:[{id:{startsWith:`glow-${date}-`}},{startsAt:{gte:from,lt:to}}],NOT:{id:(await getCampaign(db,now)).grand.id}},data:{archived:true,revision:{increment:1}}});
 await audit(db,adminId,'DROP_DAY_CANCEL',date,{archived:r.count});
 return {archived:r.count};
}

const coinsCopy=(coins,minPercent)=>({
 title:`${coins} Medi Coins`,
 description:minPercent?`ფარნის ყუთი: მხოლოდ მათთვის, ვისაც თბილისის ${String(minPercent).replace('.',',')}% აქვს განათებული. გახსენი და ${coins} Medi Coins ავტომატურად ჩაირიცხება შენს ანგარიშზე.`:`გახსენი ყუთი და ${coins} Medi Coins ავტომატურად ჩაირიცხება შენს ანგარიშზე. დააგროვე და გადაცვალე ჯილდოებზე.`,
 titleEn:`${coins} Medi Coins`,
 descriptionEn:minPercent?`Lantern box: only for players who have lit ${minPercent}% of Tbilisi. Open it and ${coins} Medi Coins land in your account.`:`Open the box and ${coins} Medi Coins land in your account automatically. Collect them and swap them for rewards.`,
});

/** A box the admin places by hand: a known spot (or a point in Tbilisi), coins, stock, start and length. */
export async function manualDrop(input,{adminId,db=prisma,now=Date.now()}){
 const campaign=await getCampaign(db,now),{spots,golden}=loadSpots();
 let spot=null;
 if(input.spotId){
  const s=spots.find(x=>x.id===input.spotId)||(golden?.[input.spotId]?{id:input.spotId,...golden[input.spotId]}:null);
  if(!s)bad(404,'ადგილი ვერ მოიძებნა.');
  spot=s;
 }else if(input.district){
  // „სადმე ამ უბანში“: a spot of that district the rules still allow, picked at random.
  const excluded=new Set(campaign.excludedSpots||[]),pool=spots.filter(s=>s.district===input.district&&!excluded.has(s.id));
  if(!pool.length)bad(404,'ამ უბანში თავისუფალი ადგილი არ არის.');
  spot=pool[Math.floor(Math.random()*pool.length)];
 }else if(Number.isFinite(input.latitude)&&Number.isFinite(input.longitude)){
  spot={id:'point',lat:input.latitude,lng:input.longitude,place:input.place||null,district:null};
 }else bad(400,'აირჩიე ადგილი, უბანი ან კოორდინატები.');
 const start=input.startsAt?new Date(input.startsAt):new Date(now),end=new Date(+start+input.hours*HOUR);
 if(+end<=now)bad(400,'ყუთის დრო უკვე გავიდა.');
 const t=new Date(+start+4*HOUR).toISOString(),date=t.slice(0,10);
 const id=`glow-${date}-x-${t.slice(11,13)}${t.slice(14,16)}-${randomUUID().slice(0,6)}`;
 const copy=coinsCopy(input.coins,input.minPercent||null);
 const gift={id,title:copy.title,description:copy.description,longitude:spot.lng,latitude:spot.lat,pulseRadius:input.pulseRadius,revealRadius:input.revealRadius,rewardKind:'DIGITAL',stock:input.stock,published:true,archived:false,startsAt:start,endsAt:end};
 const rule={giftId:id,campaign:campaign.id,coins:input.coins,minPercent:input.minPercent||null,areaId:input.minPercent?campaign.area.id:null,meta:{kind:'manual',spot:spot.id,place:spot.place||null,district:spot.district||null,titleEn:copy.titleEn,descriptionEn:copy.descriptionEn,note:input.note||null}};
 await ensureGiftRuleTable(db);
 await db.$transaction(async tx=>{
  await tx.medipulsiGift.create({data:gift});
  await upsertGiftRule(tx,rule);
  await audit(tx,adminId,'DROP_MANUAL',id,{coins:input.coins,stock:input.stock,startsAt:start,endsAt:end,spot:spot.id,place:spot.place||null,district:spot.district||null,minPercent:input.minPercent||null,note:input.note||null});
 });
 clearGiftRuleCache();
 return boxRow(await db.medipulsiGift.findUnique({where:{id}}),rule,now);
}

/** end · cancel · restore · stock · coins · time — on one box. */
export async function boxAction(id,input,{adminId,db=prisma,now=Date.now()}){
 const g=await db.medipulsiGift.findUnique({where:{id}});
 if(!g)bad(404,'ყუთი ვერ მოიძებნა.');
 const rules=await freshRules(db),rule=rules.get(id)||null;
 const data={revision:{increment:1}};
 if(input.action==='end'){if(+g.startsAt>now)bad(400,'ყუთი ჯერ არ დაწყებულა — გააუქმე.');data.endsAt=new Date(now);}
 else if(input.action==='cancel')data.archived=true;
 else if(input.action==='restore'){data.archived=false;data.published=true;}
 else if(input.action==='stock'){if(input.stock<g.allocated)bad(400,`მარაგი უკვე გახსნილზე (${g.allocated}) ნაკლები ვერ იქნება.`);data.stock=input.stock;}
 else if(input.action==='coins'){
  if(g.rewardKind!=='DIGITAL')bad(400,'ფიზიკურ პრიზს ქოინები არ აქვს.');
  const copy=coinsCopy(input.coins,rule?.minPercent||null);
  await upsertGiftRule(db,{...(rule||{giftId:id,campaign:null,minPercent:null,areaId:null,meta:{kind:'admin'}}),coins:input.coins,meta:{...(rule?.meta||{kind:'admin'}),titleEn:copy.titleEn,descriptionEn:copy.descriptionEn}});
  Object.assign(data,{title:copy.title,description:copy.description});
 }
 else if(input.action==='time'){
  const start=new Date(input.startsAt),end=new Date(input.endsAt);
  if(!(+end>+start))bad(400,'დასასრული დაწყებაზე გვიან უნდა იყოს.');
  if(g.allocated>0&&+start!==+g.startsAt)bad(400,'უკვე გახსნილ ყუთს დაწყების დროს ვერ შეუცვლი.');
  Object.assign(data,{startsAt:start,endsAt:end});
 }
 else bad(400,'უცნობი მოქმედება.');
 const row=await db.medipulsiGift.update({where:{id},data});
 await audit(db,adminId,`DROP_BOX_${input.action.toUpperCase()}`,id,{...input,before:{stock:g.stock,startsAt:g.startsAt,endsAt:g.endsAt,archived:g.archived,coins:rule?.coins??null}});
 clearGiftRuleCache();
 return boxRow(row,(await giftRules(db)).get(id),now);
}

/* ───────── other cities ───────── */
/** Cities with boxes, their players, spots and today's boxes, plus known cities not added yet. */
export async function citiesOverview({db=prisma,now=Date.now()}={}){
 const campaign=await getCampaign(db,now),rules=cityRulesOf(campaign),list=await listCities({db});
 const ids=list.map(c=>c.cityId);
 const live=ids.length?await db.$queryRaw`SELECT split_part("id",'-',5) AS city, count(*) FILTER (WHERE "startsAt"<=now() AND "endsAt">now() AND "allocated"<"stock")::int AS live, count(*) FILTER (WHERE "startsAt">now())::int AS planned, coalesce(sum("allocated"),0)::int AS opened FROM "MedipulsiGift" WHERE "archived"=false AND "endsAt">now()-interval '1 day' AND "id" ~ '^glow-[0-9]{4}-[0-9]{2}-[0-9]{2}-[a-z][0-9]+-' GROUP BY 1`:[];
 const byCity=new Map(live.map(r=>[r.city,r]));
 const known=await db.$queryRaw`SELECT "id","countryCode","nameKa","nameEn","areaKm2" FROM "MedipulsiArea" WHERE "kind"='city' AND "id"<>${campaign.area.id} ORDER BY "nameEn" ASC LIMIT 500`.catch(()=>[]);
 return {
  rules,
  cities:list.map(c=>{const o=rules.overrides?.[c.cityId]||{},b=byCity.get(c.cityId)||{};return {...c,localDate:localDate(now,c.timezone),localTime:new Intl.DateTimeFormat('en-GB',{timeZone:c.timezone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(now)),boxesPerWave:boxesPerWave(rules,c,dayKind(localDate(now,c.timezone))==='weekend'),override:o.boxesPerWave??null,note:o.note||null,live:b.live||0,planned:b.planned||0,opened:b.opened||0};}),
  known:known.filter(a=>!ids.includes(a.id)),
 };
}
export async function addCityByAdmin(cityId,{adminId,db=prisma}){
 await addCity(cityId,{db});
 await audit(db,adminId,'DROP_CITY_ADD',cityId);
 return citiesOverview({db});
}
/** On/off, a fixed number of boxes per wave (null = by players) and a note for one city. */
export async function setCityRules(cityId,input,{adminId,db=prisma}){
 await ensureCityTable(db);
 if(input.enabled!=null)await setCityEnabled(cityId,input.enabled,{db});
 if('boxesPerWave' in input||'note' in input){
  await patchRules(c=>{
   const rules={...cityRulesOf(c)},o={...(rules.overrides?.[cityId]||{})};
   if('boxesPerWave' in input){if(input.boxesPerWave==null)delete o.boxesPerWave;else o.boxesPerWave=input.boxesPerWave;}
   if('note' in input){if(input.note)o.note=input.note;else delete o.note;}
   rules.overrides={...(rules.overrides||{})};
   if(Object.keys(o).length)rules.overrides[cityId]=o;else delete rules.overrides[cityId];
   c.cities=rules;
  },{adminId,db,action:'DROP_CITY_RULE',entityId:cityId,details:input});
 }else await audit(db,adminId,'DROP_CITY_RULE',cityId,input);
 return citiesOverview({db});
}
/** Looks the city's spots up again on OpenStreetMap (runs in the background; the list shows the state). */
export async function reharvestCity(cityId,{adminId,db=prisma}){
 await requeueCity(cityId,{db});
 await audit(db,adminId,'DROP_CITY_HARVEST',cityId);
 void harvestCity(cityId,{db}).catch(()=>{});
 return {queued:true};
}
/** Places the city's missing boxes for its local today and tomorrow now. */
export async function applyCity(cityId,{adminId,db=prisma,now=Date.now()}){
 clearCampaignCache();
 const campaign=await getCampaign(db,now),city=(await listCities({db})).find(c=>c.cityId===cityId);
 if(!city)bad(404,'ქალაქი ვერ მოიძებნა.');
 if(city.status!=='ready')bad(409,'ამ ქალაქის ადგილები ჯერ არ არის მზად.');
 const spots=await citySpots(cityId,{db});
 let created=0,total=0;
 for(const date of cityDates(city,now)){const r=await applyDay(date,{db,plan:planCityDay(city,date,{campaign,spots,helpers:CITY_HELPERS}).filter(p=>+p.gift.endsAt>now)});created+=r.created||0;total+=r.total||0;}
 await audit(db,adminId,'DROP_CITY_APPLY',cityId,{created});
 return {created,total};
}
export async function citySpotList(cityId,{db=prisma}={}){return citySpots(cityId,{db});}

export async function setAutopilot(enabled,{admin,db=prisma}){
 await setFeatureFlag('medirunAutopilot',{enabled,message:null},{admin,db});
 await audit(db,admin?.id,enabled?'DROP_AUTOPILOT_ON':'DROP_AUTOPILOT_OFF','medirunAutopilot');
 return autopilotState(db);
}

export async function dropsAudit({db=prisma,offset=0}={}){
 const where={OR:[{action:{startsWith:'DROP_'}},{AND:[{action:'GIFT_SAVE'},{actorId:{not:'medirun-autopilot'}}]}]};
 const [rows,total]=await Promise.all([db.medipulsiAudit.findMany({where,orderBy:{createdAt:'desc'},take:50,skip:offset}),db.medipulsiAudit.count({where})]);
 return {rows,total};
}
