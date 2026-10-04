// „ყუთები ახლა“ on the MEDIRUN hub (owner 2026-10-04): how many gift boxes are out in the city this minute,
// in which districts, how many were opened today, and when the next ones appear — so a player knows whether
// going out now is worth it. Aggregates only: never a coordinate, a park, another player or the grand-prize spot.
// The Saturday rain is not named before it starts (its park is revealed by riddle stories at 15:00 / 15:30).
import {prisma} from '../prisma.js';
import {CAMPAIGN,tbilisiDate,planDay,autopilotEnabled} from './autopilot.js';
import {giftRules} from './giftRules.js';
import {config} from './service.js';

const HOUR=3600_000;
/** The grand prize has its own card and its spot is a secret; it never shows up in the box counts. */
export const isGrandGift=(gift,rule)=>rule?.meta?.kind==='grand'||gift.id===CAMPAIGN.grand?.id;

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

/**
 * Pure view: `gifts` are published, not archived rows from today on (Tbilisi), `rules` the gift rules map.
 * `claimsToday` / `coinsToday` are city-wide, `mine` the reader's own today.
 */
export function dropsView({gifts,rules,now=Date.now(),claimsToday=0,coinsToday=0,mine={opened:0,coins:0},planned=[],lang='ka',campaign=CAMPAIGN,enabled=true}){
 const start=new Date(`${campaign.start}T00:00:00${campaign.utcOffset}`).getTime(),end=new Date(`${campaign.end}T23:59:59${campaign.utcOffset}`).getTime();
 const status=now<start?'upcoming':now>end?'ended':'live';
 const visible=gifts.filter(g=>!isGrandGift(g,rules.get(g.id)));
 const active=visible.filter(g=>+new Date(g.startsAt)<=now&&+new Date(g.endsAt)>now&&g.allocated<g.stock);
 const districts=new Map();
 for(const g of active){const d=rules.get(g.id)?.meta?.district||(lang==='en'?'Other places':'სხვა ადგილები');districts.set(d,(districts.get(d)||0)+1);}
 const activeRules=active.map(g=>rules.get(g.id));
 // Next wave: the earliest start still ahead (boxes sharing it form one wave); the plan fills in when the
 // autopilot has not written tomorrow's boxes yet.
 const ahead=visible.filter(g=>+new Date(g.startsAt)>now);
 let next=null;
 if(ahead.length){
  const at=Math.min(...ahead.map(g=>+new Date(g.startsAt))),wave=ahead.filter(g=>+new Date(g.startsAt)===at),r=wave.map(g=>rules.get(g.id));
  next={startsAt:new Date(at).toISOString(),boxes:wave.length,coins:coinRange(r),kind:waveKind(r)};
 }else{
  const wave=planned.filter(p=>!isGrandGift(p.gift,p.rule)&&+p.gift.startsAt>now).sort((a,b)=>a.gift.startsAt-b.gift.startsAt);
  if(wave.length){const at=+wave[0].gift.startsAt,same=wave.filter(p=>+p.gift.startsAt===at);next={startsAt:new Date(at).toISOString(),boxes:same.length,coins:coinRange(same.map(p=>p.rule)),kind:waveKind(same.map(p=>p.rule))};}
 }
 const lockedNow=active.filter(g=>rules.get(g.id)?.minPercent).length;
 return {
  enabled,
  campaign:{id:campaign.id,name:lang==='en'?campaign.name.en:campaign.name.ka,status,start:campaign.start,end:campaign.end,rulesUrl:campaign.rulesUrl},
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
  schedule:scheduleOf(campaign,lang),
 };
}

// The city-wide part is the same for everyone: one read per 20 s per instance, however many players look.
let cache={at:0,key:'',value:null};
async function cityPart(now,db){
 const date=tbilisiDate(now),dayStart=new Date(`${date}T00:00:00${CAMPAIGN.utcOffset}`);
 if(cache.value&&cache.key===date&&now-cache.at<20_000)return cache.value;
 const [gifts,claimsToday,coins]=await Promise.all([
  db.medipulsiGift.findMany({where:{published:true,archived:false,endsAt:{gt:new Date(now)},startsAt:{lte:new Date(now+3*24*HOUR)}},select:{id:true,stock:true,allocated:true,startsAt:true,endsAt:true,rewardKind:true},take:500}),
  db.medipulsiClaim.count({where:{createdAt:{gte:dayStart}}}),
  db.rewardLedger.aggregate({_sum:{amount:true},where:{sourceType:'MEDIRUN',currency:'COIN',createdAt:{gte:dayStart}}}).catch(()=>({_sum:{amount:0}})),
 ]);
 const value={date,dayStart,gifts,claimsToday,coinsToday:coins._sum.amount||0};
 cache={at:now,key:date,value};
 return value;
}

export async function dropsStatus(userId,{now=Date.now(),lang='ka',db=prisma}={}){
 const cfg=await config(db);
 const enabled=Boolean(cfg.enabled&&cfg.giftsEnabled);
 const city=await cityPart(now,db);
 const [rules,opened,coins]=await Promise.all([
  giftRules(db,now),
  db.medipulsiClaim.count({where:{userId,createdAt:{gte:city.dayStart}}}),
  db.rewardLedger.aggregate({_sum:{amount:true},where:{userId,sourceType:'MEDIRUN',currency:'COIN',createdAt:{gte:city.dayStart}}}).catch(()=>({_sum:{amount:0}})),
 ]);
 const planned=city.gifts.some(g=>+g.startsAt>now)||!enabled||!(await autopilotEnabled(db).catch(()=>false))?[]:[city.date,...[1,2].map(d=>tbilisiDate(now+d*24*HOUR))].flatMap(d=>planDay(d));
 const view=dropsView({gifts:enabled?city.gifts:[],rules,now,claimsToday:city.claimsToday,coinsToday:city.coinsToday,mine:{opened,coins:coins._sum.amount||0},planned,lang,enabled});
 return view;
}
