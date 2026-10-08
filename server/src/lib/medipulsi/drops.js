// „ყუთები ახლა“ on the MEDIRUN hub (owner 2026-10-04): how many gift boxes are out in the city this minute,
// in which districts, how many were opened today, and when the next ones appear — so a player knows whether
// going out now is worth it. Aggregates only: never a box's coordinate, another player or the grand-prize spot —
// a district carries only a ~1 km grid point for „≈ N კმ შენგან“.
// The Saturday rain is not named before it starts (its park is revealed by riddle stories at 15:00 / 15:30).
import {prisma} from '../prisma.js';
import {CAMPAIGN,tbilisiDate,planDay,autopilotEnabled} from './autopilot.js';
import {getCampaign,economyOf} from './campaignStore.js';
import {normalizeDecay} from './giftRules.js';
import {ensureCityTable,cityRulesOf,homeCityId} from './cities.js';
import {timezoneFor,zonedTime,localDate} from './citySpotsMath.js';
import {tileOf} from './territoryMath.js';
import {giftRules,ensureGiftRuleTable} from './giftRules.js';
import {config} from './service.js';
import {STARTER_PREFIX} from './starter.js';
import {liveWalkers} from './social.js';
import {geometryBbox} from './territoryMath.js';

const HOUR=3600_000;
/** 0.01° ≈ 1.1 km north–south, ~0.8 km east–west in Tbilisi. */
const gridOf=v=>Math.round(v*100)/100;
/** The grand prize has its own card and its spot is a secret; it never shows up in the box counts. */
export const isGrandGift=(gift,rule,campaign=CAMPAIGN)=>rule?.meta?.kind==='grand'||gift.id===campaign.grand?.id;

function coinRange(rules){
 const coins=rules.map(r=>Number(r?.coins)||0).filter(n=>n>0);
 return coins.length?{min:Math.min(...coins),max:Math.max(...coins)}:null;
}
/** Wave label the app turns into words: saturday rain, lantern, evening (lit paths) or a regular wave. */
function waveKind(rules){
 const kinds=new Set(rules.map(r=>r?.meta?.kind).filter(Boolean));
 if(kinds.has('saturday'))return 'saturday';
 if(kinds.has('lantern'))return 'lantern';
 if(kinds.has('ev'))return 'evening';
 return 'regular';
}

/** The fixed weekly rhythm from the campaign config, in the reader's language. */
export function scheduleOf(campaign=CAMPAIGN,lang='ka'){
 const t=(ka,en)=>lang==='en'?en:ka;
 const times=day=>day.waves.map(w=>w.time).join(lang==='en'?' and ':' და ');
 const range=day=>{const c=day.coins.map(o=>o.amount);return {min:Math.min(...c),max:Math.max(...c)};};
 const sat=campaign.saturday,satCoins=sat.coins.map(o=>o.amount);
 return [
  {id:'weekday',label:t('ორშაბათი–პარასკევი','Monday–Friday'),times:times(campaign.days.weekday),coins:range(campaign.days.weekday)},
  {id:'weekend',label:t('შაბათი–კვირა','Saturday–Sunday'),times:times(campaign.days.weekend),coins:range(campaign.days.weekend)},
  {id:'saturday',label:t('შაბათი · ქოინების წვიმა','Saturday · coin rain'),times:sat.time,coins:{min:Math.min(...satCoins),max:Math.max(...satCoins)}},
 ];
}

/** The city a box belongs to: its rule's cityId; the hand-made campaign boxes (no cityId) are Tbilisi. */
export const giftCity=(rule,campaign=CAMPAIGN)=>rule?.meta?.cityId||campaign.area.id;

/** Weekday / weekend rows for a city on the „სხვა ქალაქები“ rules (times are the city's local time). */
export function cityScheduleOf(rules,lang='ka'){
 const t=(ka,en)=>lang==='en'?en:ka,times=rules.waves.map(w=>w.time).join(lang==='en'?' and ':' და ');
 const range=c=>{const a=(c||[]).map(o=>o.amount);return a.length?{min:Math.min(...a),max:Math.max(...a)}:null;};
 return [
  {id:'weekday',label:t('ორშაბათი–პარასკევი','Monday–Friday'),times,coins:range(rules.coins)},
  {id:'weekend',label:t('შაბათი–კვირა','Saturday–Sunday'),times,coins:range(rules.weekendCoins?.length?rules.weekendCoins:rules.coins)},
 ];
}

/**
 * Pure view for one city: `gifts` are published, not archived rows from now on (every city), `rules` the gift
 * rules map; only the reader's city counts. `claimsToday` / `coinsToday` are that city's (its local day),
 * `mine` the reader's own today. `city` = {id, name, pending}; none = Tbilisi.
 */
export function dropsView({gifts,rules,now=Date.now(),claimsToday=0,coinsToday=0,mine={opened:0,coins:0},planned=[],lang='ka',campaign=CAMPAIGN,enabled=true,city=null,schedule=null,live=null}){
 const start=new Date(`${campaign.start}T00:00:00${campaign.utcOffset}`).getTime(),end=new Date(`${campaign.end}T23:59:59${campaign.utcOffset}`).getTime();
 const status=now<start?'upcoming':now>end?'ended':'live';
 const cityId=city?.id||campaign.area.id,home=cityId===campaign.area.id;
 const visible=gifts.filter(g=>!isGrandGift(g,rules.get(g.id),campaign)&&giftCity(rules.get(g.id),campaign)===cityId);
 const active=visible.filter(g=>+new Date(g.startsAt)<=now&&+new Date(g.endsAt)>now&&g.allocated<g.stock);
 const districts=new Map();
 for(const g of active){
  const d=rules.get(g.id)?.meta?.district||(lang==='en'?'Other places':'სხვა ადგილები'),row=districts.get(d)||{boxes:0,lng:0,lat:0,fixes:0,from:Infinity,to:0};
  row.boxes+=1;row.from=Math.min(row.from,+new Date(g.startsAt));row.to=Math.max(row.to,+new Date(g.endsAt));if(Number.isFinite(g.longitude)&&Number.isFinite(g.latitude)){row.lng+=g.longitude;row.lat+=g.latitude;row.fixes+=1;}
  districts.set(d,row);
 }
 const activeRules=active.map(g=>rules.get(g.id));
 // Next wave: the earliest start still ahead (boxes sharing it form one wave); for Tbilisi the plan fills in
 // when the autopilot has not written tomorrow's boxes yet.
 const ahead=visible.filter(g=>+new Date(g.startsAt)>now);
 let next=null;
 if(ahead.length){
  const at=Math.min(...ahead.map(g=>+new Date(g.startsAt))),wave=ahead.filter(g=>+new Date(g.startsAt)===at),r=wave.map(g=>rules.get(g.id));
  next={startsAt:new Date(at).toISOString(),boxes:wave.length,coins:coinRange(r),kind:waveKind(r)};
 }else if(home){
  const wave=planned.filter(p=>!isGrandGift(p.gift,p.rule,campaign)&&+p.gift.startsAt>now).sort((a,b)=>a.gift.startsAt-b.gift.startsAt);
  if(wave.length){const at=+wave[0].gift.startsAt,same=wave.filter(p=>+p.gift.startsAt===at);next={startsAt:new Date(at).toISOString(),boxes:same.length,coins:coinRange(same.map(p=>p.rule)),kind:waveKind(same.map(p=>p.rule))};}
 }
 const lockedNow=active.filter(g=>rules.get(g.id)?.minPercent).length;
 return {
  enabled,
  campaign:{id:campaign.id,name:lang==='en'?campaign.name.en:campaign.name.ka,status,start:campaign.start,end:campaign.end,rulesUrl:campaign.rulesUrl},
  city:{id:cityId,name:city?.name||(lang==='en'?campaign.area.en:campaign.area.ka),campaignCity:home,pending:Boolean(city?.pending)},
  now:{
   boxes:active.length,
   openingsLeft:active.reduce((s,g)=>s+Math.max(0,g.stock-g.allocated),0),
   endsAt:active.length?new Date(Math.max(...active.map(g=>+new Date(g.endsAt)))).toISOString():null,
   coins:coinRange(activeRules),
   lanternBoxes:lockedNow,
   // „რამდენი კმ-ია ჩემგან“ (owner 2026-10-08): the middle of the district's boxes on a 0.01° grid (~1 km) — enough
   // to say which way and how far, never where a box is (the pulse finds it inside 250–350 m).
   districts:[...districts].map(([name,r])=>({name,boxes:r.boxes,near:r.fixes?[gridOf(r.lng/r.fixes),gridOf(r.lat/r.fixes)]:null,
    // „გაქრება 1:42:05-ში“: when the last box there ends (a box can also run out of openings sooner).
    startsAt:new Date(r.from).toISOString(),endsAt:new Date(r.to).toISOString()})).sort((a,b)=>b.boxes-a.boxes||a.name.localeCompare(b.name)),
  },
  today:{opened:claimsToday,coins:coinsToday},
  me:{opened:mine.opened,coins:mine.coins},
  next,
  schedule:schedule||scheduleOf(campaign,lang),
  // Economy 2: the first-finder ladder, so the app can say „პირველს სრული, მეორეს 60 %…“.
  economy:{decay:normalizeDecay(economyOf(campaign).decay)||[100]},
  // „ახლა N ადამიანი დადის“ (owner 2026-10-05): numbers only, null below three people.
  live:live||{walkers:null,rain:null},
 };
}

// Every box from now on, the same for everyone: one read per 20 s per instance.
let cache={at:0,value:null};
async function upcomingGifts(now,db){
 if(cache.value&&now-cache.at<20_000)return cache.value;
 const value=await db.medipulsiGift.findMany({where:{published:true,archived:false,endsAt:{gt:new Date(now)},startsAt:{lte:new Date(now+3*24*HOUR)},NOT:{id:{startsWith:STARTER_PREFIX}}},select:{id:true,stock:true,allocated:true,startsAt:true,endsAt:true,rewardKind:true,latitude:true,longitude:true},take:2000});
 cache={at:now,value};
 return value;
}

/**
 * When the player last walked: the latest fix, else the pause (a pause or a finish clears `lastFix`), else the
 * row's last update — so a walk in another city keeps that city for 24 h after it ends (owner 2026-10-08, Liège).
 */
export function lastWalkAt(player){
 const j=player?.state?.journey;
 if(!Array.isArray(j?.position))return 0;
 return Number(j.lastFix)||Date.parse(j.pausedAt||'')||Date.parse(j.completedAt||'')||(player?.updatedAt?+new Date(player.updatedAt):0)||0;
}

/**
 * The reader's city: where they walked in the last 24 h, else their home place (the city the app shows),
 * else Tbilisi. Only cached tile lookups — never a geocoding call on this path.
 */
/** „5.58,50.63“ from the app's X-Medirun-At header (the phone's position on a ~1 km grid), else null. */
export function parseAt(raw){
 const m=/^(-?\d{1,3}(?:\.\d{1,6})?),(-?\d{1,2}(?:\.\d{1,6})?)$/.exec(String(raw||'').trim());
 if(!m)return null;
 const at=[Number(m[1]),Number(m[2])];
 return Math.abs(at[0])<=180&&Math.abs(at[1])<=90?at:null;
}
/** The smallest city box (MEDIRUN cities + Tbilisi's campaign area) holding the point. Pure. */
export function pickCityAt(at,boxes){
 const area=b=>(b[2]-b[0])*(b[3]-b[1]);
 return boxes.filter(x=>at[0]>=x.box[0]&&at[0]<=x.box[2]&&at[1]>=x.box[1]&&at[1]<=x.box[3]).sort((a,b)=>area(a.box)-area(b.box))[0]||null;
}
let cityBoxes={at:0,list:null};
async function cityBboxes(db,campaign){
 if(cityBoxes.list&&Date.now()-cityBoxes.at<10*60_000)return cityBoxes.list;
 await ensureCityTable(db);
 const rows=await db.$queryRaw`SELECT c."cityId",c."nameKa",c."nameEn",c."timezone",c."status",c."enabled",a."geometry" FROM "MedirunCity" c JOIN "MedipulsiArea" a ON a."id"=c."cityId"`.catch(()=>[]);
 const list=rows.map(row=>({row,box:row.geometry?geometryBbox(row.geometry):null})).filter(x=>x.box&&x.box.every(Number.isFinite));
 const tb=await campaignBbox(db,campaign);
 if(tb)list.push({tbilisi:true,box:tb});
 cityBoxes={at:Date.now(),list};
 return list;
}

async function readerCity(userId,{db,campaign,now,lang,at=null}){
 const tbilisi={id:campaign.area.id,timezone:'Asia/Tbilisi'};
 const [player,home]=await Promise.all([
  db.medipulsiPlayer.findUnique({where:{userId},select:{state:true,updatedAt:true}}).catch(()=>null),
  db.$queryRaw`SELECT "lat","lng","cityKa" FROM "UserLocation" WHERE "userId"=${userId} AND "enabled"=true AND "lat" IS NOT NULL`.then(r=>r[0]||null).catch(()=>null),
 ]);
 await ensureCityTable(db);
 const cityRow=async id=>(await db.$queryRaw`SELECT "cityId","nameKa","nameEn","timezone","status","enabled" FROM "MedirunCity" WHERE "cityId"=${id}`)[0]||null;
 const asView=c=>({id:c.cityId,name:(lang==='en'?c.nameEn:c.nameKa)||c.nameEn||c.nameKa,timezone:c.timezone,pending:c.status!=='ready'||!c.enabled});
 // 0. Where the phone is right now (owner 2026-10-08: in Liège the hub must show Liège, whatever home says).
 if(at){
  const hit=pickCityAt(at,await cityBboxes(db,campaign).catch(()=>[]));
  if(hit?.tbilisi)return tbilisi;
  if(hit?.row)return asView(hit.row);
 }
 // 1. Walking somewhere in the last 24 h: Tbilisi or a city that already has boxes.
 const j=player?.state?.journey,walkedAt=lastWalkAt(player);
 if(Array.isArray(j?.position)&&walkedAt&&now-walkedAt<24*HOUR){
  const [row]=await db.$queryRaw`SELECT "cityId" FROM "MedipulsiPlaceTile" WHERE "tile"=${tileOf(j.position)}`.catch(()=>[]);
  if(row?.cityId===campaign.area.id)return tbilisi;
  const c=row?.cityId?await cityRow(row.cityId):null;
  if(c)return asView(c);
 }
 // 2. Home: the city the app shows (UserLocation), named first, else its tile.
 if(home){
  const id=await homeCityId(home,{db}).catch(()=>null);
  if(id===campaign.area.id)return tbilisi;
  if(id){
   const c=await cityRow(id);
   if(c)return asView(c);
   const [a]=await db.$queryRaw`SELECT "nameKa","nameEn","countryCode" FROM "MedipulsiArea" WHERE "id"=${id}`;
   if(a)return {id,name:(lang==='en'?a.nameEn:a.nameKa)||a.nameEn||a.nameKa,timezone:timezoneFor(a.countryCode,home.lng),pending:true};
  }
 }
 return tbilisi;
}

/** Openings and coins of one city since its local midnight (a reader's own: every city). */
async function counts({db,cityId,campaign,since,userId=null}){
 try{
  await ensureGiftRuleTable(db);
  const rows=userId
   ?await db.$queryRaw`SELECT count(*)::int AS n, coalesce(sum((c."reward"->>'coins')::int),0)::int AS coins FROM "MedipulsiClaim" c WHERE c."userId"=${userId} AND c."createdAt">=${since}`
   :await db.$queryRaw`SELECT count(*)::int AS n, coalesce(sum((c."reward"->>'coins')::int),0)::int AS coins FROM "MedipulsiClaim" c LEFT JOIN "MedipulsiGiftRule" r ON r."giftId"=c."giftId" WHERE c."createdAt">=${since} AND coalesce(r."meta"->>'cityId',${campaign.area.id})=${cityId}`;
  return {n:rows[0]?.n||0,coins:rows[0]?.coins||0};
 }catch{return {n:0,coins:0};}
}

export async function dropsStatus(userId,{now=Date.now(),lang='ka',db=prisma,at=null}={}){
 const [cfg,campaign]=await Promise.all([config(db),getCampaign(db,now)]);
 const enabled=Boolean(cfg.enabled&&cfg.giftsEnabled);
 const [gifts,city,rules]=await Promise.all([upcomingGifts(now,db),readerCity(userId,{db,campaign,now,lang,at}),giftRules(db,now)]);
 const since=zonedTime(localDate(now,city.timezone),'00:00',city.timezone);
 const [today,mine]=await Promise.all([counts({db,cityId:city.id,campaign,since}),counts({db,cityId:city.id,campaign,since,userId})]);
 const home=city.id===campaign.area.id;
 const planned=!home||gifts.some(g=>+g.startsAt>now&&giftCity(rules.get(g.id),campaign)===city.id)||!enabled||!(await autopilotEnabled(db).catch(()=>false))?[]:[tbilisiDate(now),...[1,2].map(d=>tbilisiDate(now+d*24*HOUR))].flatMap(d=>planDay(d,{campaign}));
 const live=home?await liveNow({db,campaign,gifts,rules,now}).catch(()=>null):null;
 return dropsView({gifts:enabled?gifts:[],rules,now,claimsToday:today.n,coinsToday:today.coins,mine:{opened:mine.n,coins:mine.coins},planned,lang,enabled,campaign,
  city:home?null:city,schedule:home?null:cityScheduleOf(cityRulesOf(campaign),lang),live});
}

let areaBox={at:0,id:null,box:null};
async function campaignBbox(db,campaign){
 if(areaBox.id===campaign.area.id&&Date.now()-areaBox.at<6*HOUR)return areaBox.box;
 const [a]=await db.$queryRaw`SELECT "geometry" FROM "MedipulsiArea" WHERE "id"=${campaign.area.id}`.catch(()=>[]);
 const box=a?.geometry?geometryBbox(a.geometry):null;
 areaBox={at:Date.now(),id:campaign.area.id,box:box&&box.every(Number.isFinite)?box:null};
 return areaBox.box;
}
/** Walkers in the campaign city right now, and near the Saturday rain while it is out (its boxes' centre). */
async function liveNow({db,campaign,gifts,rules,now}){
 const bbox=await campaignBbox(db,campaign);
 if(!bbox)return null;
 const rain=gifts.filter(g=>rules.get(g.id)?.meta?.kind==='saturday'&&+new Date(g.startsAt)<=now&&+new Date(g.endsAt)>now&&g.allocated<g.stock&&Number.isFinite(g.longitude));
 const centre=rain.length?[rain.reduce((s,g)=>s+g.longitude,0)/rain.length,rain.reduce((s,g)=>s+g.latitude,0)/rain.length]:null;
 return liveWalkers({bbox,rain:centre?{center:centre,radiusM:Math.max(300,Number(campaign.saturday?.radiusM)||800)}:null,db,now});
}
