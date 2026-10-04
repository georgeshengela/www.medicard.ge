// „ყუთები ახლა“ on the MEDIRUN hub (owner 2026-10-04): how many gift boxes are out in the city this minute,
// in which districts, how many were opened today, and when the next ones appear — so a player knows whether
// going out now is worth it. Aggregates only: never a coordinate, a park, another player or the grand-prize spot.
// The Saturday rain is not named before it starts (its park is revealed by riddle stories at 15:00 / 15:30).
import {prisma} from '../prisma.js';
import {CAMPAIGN,tbilisiDate,planDay,autopilotEnabled} from './autopilot.js';
import {getCampaign} from './campaignStore.js';
import {ensureCityTable,cityRulesOf} from './cities.js';
import {timezoneFor,zonedTime,localDate} from './citySpotsMath.js';
import {tileOf} from './territoryMath.js';
import {giftRules,ensureGiftRuleTable} from './giftRules.js';
import {config} from './service.js';

const HOUR=3600_000;
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
export function dropsView({gifts,rules,now=Date.now(),claimsToday=0,coinsToday=0,mine={opened:0,coins:0},planned=[],lang='ka',campaign=CAMPAIGN,enabled=true,city=null,schedule=null}){
 const start=new Date(`${campaign.start}T00:00:00${campaign.utcOffset}`).getTime(),end=new Date(`${campaign.end}T23:59:59${campaign.utcOffset}`).getTime();
 const status=now<start?'upcoming':now>end?'ended':'live';
 const cityId=city?.id||campaign.area.id,home=cityId===campaign.area.id;
 const visible=gifts.filter(g=>!isGrandGift(g,rules.get(g.id),campaign)&&giftCity(rules.get(g.id),campaign)===cityId);
 const active=visible.filter(g=>+new Date(g.startsAt)<=now&&+new Date(g.endsAt)>now&&g.allocated<g.stock);
 const districts=new Map();
 for(const g of active){const d=rules.get(g.id)?.meta?.district||(lang==='en'?'Other places':'სხვა ადგილები');districts.set(d,(districts.get(d)||0)+1);}
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
   districts:[...districts].map(([name,boxes])=>({name,boxes})).sort((a,b)=>b.boxes-a.boxes||a.name.localeCompare(b.name)),
  },
  today:{opened:claimsToday,coins:coinsToday},
  me:{opened:mine.opened,coins:mine.coins},
  next,
  schedule:schedule||scheduleOf(campaign,lang),
 };
}

// Every box from now on, the same for everyone: one read per 20 s per instance.
let cache={at:0,value:null};
async function upcomingGifts(now,db){
 if(cache.value&&now-cache.at<20_000)return cache.value;
 const value=await db.medipulsiGift.findMany({where:{published:true,archived:false,endsAt:{gt:new Date(now)},startsAt:{lte:new Date(now+3*24*HOUR)}},select:{id:true,stock:true,allocated:true,startsAt:true,endsAt:true,rewardKind:true},take:2000});
 cache={at:now,value};
 return value;
}

/**
 * The reader's city: where they walked in the last 24 h, else their home place (the city the app shows),
 * else Tbilisi. Only cached tile lookups — never a geocoding call on this path.
 */
async function readerCity(userId,{db,campaign,now,lang}){
 const tbilisi={id:campaign.area.id,timezone:'Asia/Tbilisi'};
 const [player,home]=await Promise.all([
  db.medipulsiPlayer.findUnique({where:{userId},select:{state:true}}).catch(()=>null),
  db.$queryRaw`SELECT "lat","lng" FROM "UserLocation" WHERE "userId"=${userId} AND "enabled"=true AND "lat" IS NOT NULL`.then(r=>r[0]||null).catch(()=>null),
 ]);
 const j=player?.state?.journey,points=[];
 if(Array.isArray(j?.position)&&j.lastFix&&now-j.lastFix<24*HOUR)points.push(j.position);
 if(home)points.push([home.lng,home.lat]);
 for(const pt of points){
  const [row]=await db.$queryRaw`SELECT "cityId" FROM "MedipulsiPlaceTile" WHERE "tile"=${tileOf(pt)}`.catch(()=>[]);
  if(!row?.cityId)continue;
  if(row.cityId===campaign.area.id)return tbilisi;
  await ensureCityTable(db);
  const [c]=await db.$queryRaw`SELECT "cityId","nameKa","nameEn","timezone","status","enabled" FROM "MedirunCity" WHERE "cityId"=${row.cityId}`;
  if(c)return {id:c.cityId,name:(lang==='en'?c.nameEn:c.nameKa)||c.nameEn||c.nameKa,timezone:c.timezone,pending:c.status!=='ready'||!c.enabled};
  const [a]=await db.$queryRaw`SELECT "nameKa","nameEn","countryCode","geometry" FROM "MedipulsiArea" WHERE "id"=${row.cityId}`;
  if(a)return {id:row.cityId,name:(lang==='en'?a.nameEn:a.nameKa)||a.nameEn||a.nameKa,timezone:timezoneFor(a.countryCode,pt[0]),pending:true};
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

export async function dropsStatus(userId,{now=Date.now(),lang='ka',db=prisma}={}){
 const [cfg,campaign]=await Promise.all([config(db),getCampaign(db,now)]);
 const enabled=Boolean(cfg.enabled&&cfg.giftsEnabled);
 const [gifts,city,rules]=await Promise.all([upcomingGifts(now,db),readerCity(userId,{db,campaign,now,lang}),giftRules(db,now)]);
 const since=zonedTime(localDate(now,city.timezone),'00:00',city.timezone);
 const [today,mine]=await Promise.all([counts({db,cityId:city.id,campaign,since}),counts({db,cityId:city.id,campaign,since,userId})]);
 const home=city.id===campaign.area.id;
 const planned=!home||gifts.some(g=>+g.startsAt>now&&giftCity(rules.get(g.id),campaign)===city.id)||!enabled||!(await autopilotEnabled(db).catch(()=>false))?[]:[tbilisiDate(now),...[1,2].map(d=>tbilisiDate(now+d*24*HOUR))].flatMap(d=>planDay(d,{campaign}));
 return dropsView({gifts:enabled?gifts:[],rules,now,claimsToday:today.n,coinsToday:today.coins,mine:{opened:mine.n,coins:mine.coins},planned,lang,enabled,campaign,
  city:home?null:city,schedule:home?null:cityScheduleOf(cityRulesOf(campaign),lang)});
}
