// MEDIRUN economy 2 (owner 2026-10-04, „ჩემი ხარჯებით გავწვდე საჩუქრების გაცემას“): the money side of the
// „გაანათე თბილისი“ boxes, in one place.
//  • Season budget — every Medi Coin the game pays (box openings, weekly prizes) counts against
//    `economy.budget.seasonCoins`. At `warnAt` percents the owner gets one Telegram notice each; at 100 % the
//    autopilot stops placing new boxes (the ones already out still pay) until the owner raises the budget in admin.
//  • Weekly prizes — every Monday the previous Tbilisi week's leaderboard top players (box hunters by coins,
//    walkers by metres; opt-in only) get fixed coins. Skill, never a draw. Idempotent per week and board.
//  • Leaderboards — `week` = this Tbilisi calendar week (Monday 00:00 → now), `season` = the campaign.
// Pure helpers first (tested), database work below. No coordinates, names or health data leave here.
import {randomUUID} from 'node:crypto';
import {prisma} from '../prisma.js';
import {economyOf} from './campaignStore.js';
import {COIN_SOURCE,syncQuestCache} from './giftRules.js';

const DAY=86400_000,TB='+04:00';
export const tbilisiMidnight=ymd=>new Date(`${ymd}T00:00:00${TB}`);
const ymdOf=ms=>new Date(ms+4*3600_000).toISOString().slice(0,10);
const addDays=(ymd,n)=>new Date(Date.parse(`${ymd}T00:00:00Z`)+n*DAY).toISOString().slice(0,10);
/** The Monday (Tbilisi) that starts the week `now` falls in. */
export function weekStart(now=Date.now()){
 const today=ymdOf(now),dow=new Date(`${today}T00:00:00Z`).getUTCDay();
 return addDays(today,-((dow+6)%7));
}

/* ───────── budget (pure) ───────── */
/** Where the season stands: paid so far, share of the budget, days left, what the pace projects to. */
export function budgetState(campaign,paid,now=Date.now()){
 const e=economyOf(campaign),total=Math.max(0,Number(e.budget.seasonCoins)||0);
 const start=+tbilisiMidnight(campaign.start),end=+tbilisiMidnight(campaign.end)+DAY;
 const daysTotal=Math.max(1,Math.round((end-start)/DAY));
 const daysGone=Math.max(0,Math.min(daysTotal,Math.ceil((now-start)/DAY)));
 const daysLeft=Math.max(0,daysTotal-daysGone);
 const percent=total?Math.min(999,paid/total*100):0;
 const projected=daysGone?Math.round(paid/daysGone*daysTotal):0;
 return {seasonCoins:total,paid,left:Math.max(0,total-paid),percent:Math.round(percent*10)/10,stopped:total>0&&paid>=total,daysTotal,daysGone,daysLeft,projected,perDayLeft:daysLeft?Math.round(Math.max(0,total-paid)/daysLeft):0,warnAt:e.budget.warnAt||[]};
}

/* ───────── budget (database) ───────── */
/** Every Medi Coin MEDIRUN paid inside the campaign dates (openings and weekly prizes). */
export async function seasonPaid(campaign,{db=prisma}={}){
 const r=await db.rewardLedger.aggregate({_sum:{amount:true},where:{sourceType:COIN_SOURCE,currency:'COIN',createdAt:{gte:tbilisiMidnight(campaign.start),lt:new Date(+tbilisiMidnight(campaign.end)+DAY)}}}).catch(()=>({_sum:{amount:0}}));
 return Math.max(0,r._sum.amount||0);
}
async function markOnce(db,action,entityId,details){
 const has=await db.medipulsiAudit.findFirst({where:{action,entityId},select:{id:true}});
 if(has)return false;
 await db.medipulsiAudit.create({data:{id:randomUUID(),actorId:'medirun-autopilot',action,entityId,details}});
 return true;
}
async function tellOwner(text){
 try{const {notifyOwner}=await import('../director/service.js');await notifyOwner(text);}catch(error){console.warn('[medirun-economy] owner notice failed',error?.message);}
}
/**
 * The budget gate the autopilot runs before placing boxes: warns the owner once per threshold, says „stopped“
 * once per day while the budget is used up. Returns the state either way.
 */
export async function budgetGate(campaign,{db=prisma,now=Date.now()}={}){
 const paid=await seasonPaid(campaign,{db});
 const s=budgetState(campaign,paid,now);
 if(!s.seasonCoins)return s;
 try{
  if(s.stopped){
   if(await markOnce(db,'DROP_BUDGET_STOP',`${campaign.id}:${ymdOf(now)}`,{paid,seasonCoins:s.seasonCoins}))
    await tellOwner(`🧯 MEDIRUN: სეზონის ბიუჯეტი ამოიწურა — ${paid.toLocaleString('ka-GE')} / ${s.seasonCoins.toLocaleString('ka-GE')} ქოინი. ავტოპილოტი ახალ ყუთს აღარ დებს; გასულები ჩვეულებრივ იხსნება. გაზარდე ბიუჯეტი ადმინში: MEDIRUN ყუთები → წესები → ეკონომიკა.`);
  }else for(const t of [...s.warnAt].sort((a,b)=>b-a)){
   if(s.percent>=t){
    if(await markOnce(db,'DROP_BUDGET_WARN',`${campaign.id}:${t}`,{paid,seasonCoins:s.seasonCoins,percent:s.percent,daysLeft:s.daysLeft}))
     await tellOwner(`⚠️ MEDIRUN: სეზონის ბიუჯეტის ${t}% გაცემულია — ${paid.toLocaleString('ka-GE')} / ${s.seasonCoins.toLocaleString('ka-GE')} ქოინი, დარჩა ${s.daysLeft} დღე (≈ ${s.perDayLeft} ქოინი/დღე). ამ ტემპით სეზონის ბოლომდე ≈ ${s.projected.toLocaleString('ka-GE')}. წესები: ადმინი → MEDIRUN ყუთები → ეკონომიკა.`);
    break;
   }
  }
 }catch(error){console.warn('[medirun-economy] budget notice failed',error?.message);}
 return s;
}

/* ───────── leaderboards ───────── */
/** `since`/`until` for a period: this Tbilisi week, or the season (the campaign while it runs, else 90 days). */
export function periodBounds(period,campaign,now=Date.now()){
 if(period==='week')return {since:tbilisiMidnight(weekStart(now)),until:null,label:'week'};
 const start=+tbilisiMidnight(campaign.start),end=+tbilisiMidnight(campaign.end)+DAY;
 if(now>=start&&now<end)return {since:new Date(start),until:null,label:'season'};
 return {since:new Date(now-90*DAY),until:null,label:'season'};
}

/** Box hunters: coins from openings, boxes opened, first finds. Opt-in players only; `withIds` keeps userId. */
export async function boxesBoard({since,until=null,limit=100,db=prisma}){
 const rows=until
  ?await db.$queryRaw`SELECT p."userId", p."handle", count(*)::int AS boxes, coalesce(sum((c."reward"->>'coins')::int),0)::int AS coins, count(*) FILTER (WHERE (c."reward"->>'rank')::int=1)::int AS firsts FROM "MedipulsiClaim" c JOIN "MedipulsiPlayer" p ON p."userId"=c."userId" JOIN "User" u ON u."id"=p."userId" WHERE p."leaderboardOptIn"=true AND u."status"='ACTIVE' AND c."status" IN ('APPROVED','FULFILLED') AND c."createdAt">=${since} AND c."createdAt"<${until} GROUP BY p."userId",p."handle" HAVING coalesce(sum((c."reward"->>'coins')::int),0)>0 ORDER BY coins DESC, boxes DESC, firsts DESC, min(c."createdAt") ASC LIMIT ${limit}`
  :await db.$queryRaw`SELECT p."userId", p."handle", count(*)::int AS boxes, coalesce(sum((c."reward"->>'coins')::int),0)::int AS coins, count(*) FILTER (WHERE (c."reward"->>'rank')::int=1)::int AS firsts FROM "MedipulsiClaim" c JOIN "MedipulsiPlayer" p ON p."userId"=c."userId" JOIN "User" u ON u."id"=p."userId" WHERE p."leaderboardOptIn"=true AND u."status"='ACTIVE' AND c."status" IN ('APPROVED','FULFILLED') AND c."createdAt">=${since} GROUP BY p."userId",p."handle" HAVING coalesce(sum((c."reward"->>'coins')::int),0)>0 ORDER BY coins DESC, boxes DESC, firsts DESC, min(c."createdAt") ASC LIMIT ${limit}`;
 return rows;
}
/** Walkers: verified metres from finished sessions. */
export async function metersBoard({since,until=null,limit=100,db=prisma}){
 const rows=until
  ?await db.$queryRaw`SELECT p."userId", p."handle", SUM(s."newMeters")::float8 AS "newMeters", SUM(s."meters")::float8 AS "meters", count(*)::int AS walks FROM "MedipulsiSession" s JOIN "MedipulsiPlayer" p ON p."userId"=s."userId" JOIN "User" u ON u."id"=p."userId" WHERE p."leaderboardOptIn"=true AND u."status"='ACTIVE' AND s."excluded"=false AND s."phase"='FINISHED' AND s."startedAt">=${since} AND s."startedAt"<${until} GROUP BY p."userId",p."handle" HAVING SUM(s."meters")>0 ORDER BY SUM(s."meters") DESC, MIN(s."endedAt") ASC LIMIT ${limit}`
  :await db.$queryRaw`SELECT p."userId", p."handle", SUM(s."newMeters")::float8 AS "newMeters", SUM(s."meters")::float8 AS "meters", count(*)::int AS walks FROM "MedipulsiSession" s JOIN "MedipulsiPlayer" p ON p."userId"=s."userId" JOIN "User" u ON u."id"=p."userId" WHERE p."leaderboardOptIn"=true AND u."status"='ACTIVE' AND s."excluded"=false AND s."phase"='FINISHED' AND s."startedAt">=${since} GROUP BY p."userId",p."handle" HAVING SUM(s."meters")>0 ORDER BY SUM(s."meters") DESC, MIN(s."endedAt") ASC LIMIT ${limit}`;
 return rows;
}
/** The reader's own numbers for the period (any player, opted in or not). */
export async function myNumbers(userId,{since,db=prisma}){
 const [b,m]=await Promise.all([
  db.$queryRaw`SELECT count(*)::int AS boxes, coalesce(sum((c."reward"->>'coins')::int),0)::int AS coins, count(*) FILTER (WHERE (c."reward"->>'rank')::int=1)::int AS firsts FROM "MedipulsiClaim" c WHERE c."userId"=${userId} AND c."status" IN ('APPROVED','FULFILLED') AND c."createdAt">=${since}`,
  db.$queryRaw`SELECT coalesce(SUM(s."meters"),0)::float8 AS meters, coalesce(SUM(s."newMeters"),0)::float8 AS "newMeters", count(*)::int AS walks FROM "MedipulsiSession" s WHERE s."userId"=${userId} AND s."excluded"=false AND s."phase"='FINISHED' AND s."startedAt">=${since}`,
 ]);
 return {boxes:b[0]?.boxes||0,coins:b[0]?.coins||0,firsts:b[0]?.firsts||0,meters:m[0]?.meters||0,newMeters:m[0]?.newMeters||0,walks:m[0]?.walks||0};
}
/** 1 + how many listed players stand above these numbers (so a player outside the top 100 still sees a place). */
export function rankAmong(rows,mine,board){
 if(board==='boxes'){if(!(mine.coins>0))return null;return 1+rows.filter(r=>r.coins>mine.coins||(r.coins===mine.coins&&r.boxes>mine.boxes)).length;}
 if(!(mine.meters>0))return null;return 1+rows.filter(r=>r.meters>mine.meters).length;
}

/* ───────── weekly prizes ───────── */
export const PRIZE_SOURCE_PREFIX='week:';
/** Who got what for the week starting `monday` (handles only), from the ledger. */
export async function weekWinners(monday,{db=prisma}={}){
 const rows=await db.$queryRaw`SELECT l."sourceId", l."amount", p."handle" FROM "RewardLedger" l JOIN "MedipulsiPlayer" p ON p."userId"=l."userId" WHERE l."sourceType"=${COIN_SOURCE} AND l."currency"='COIN' AND l."sourceId" LIKE ${`${PRIZE_SOURCE_PREFIX}${monday}:%`} ORDER BY l."sourceId" ASC, l."amount" DESC`.catch(()=>[]);
 return rows.map(r=>{const [,,board,rank]=String(r.sourceId).split(':');return {board,rank:Number(rank)||0,handle:r.handle,coins:r.amount};}).sort((a,b)=>a.board.localeCompare(b.board)||a.rank-b.rank);
}
/**
 * Pays last week's prizes once (Monday 00:10 Tbilisi or later). Boards are the previous Tbilisi calendar week;
 * only players with a result get a place; prize i goes to rank i+1. A week outside the campaign pays nothing.
 */
export async function payWeeklyPrizes(campaign,{db=prisma,now=Date.now(),force=false}={}){
 const e=economyOf(campaign),monday=weekStart(now),prev=addDays(monday,-7);
 if(!force&&now<+tbilisiMidnight(monday)+10*60_000)return {skipped:'early',week:prev};
 if(prev<addDays(campaign.start,-6)||prev>campaign.end)return {skipped:'outside',week:prev};
 const prizes={boxes:(e.weeklyPrizes.boxes||[]).filter(n=>n>0),meters:(e.weeklyPrizes.meters||[]).filter(n=>n>0)};
 if(!prizes.boxes.length&&!prizes.meters.length)return {skipped:'none',week:prev};
 const has=await db.medipulsiAudit.findFirst({where:{action:'DROP_WEEK_PRIZES',entityId:prev},select:{id:true}});
 if(has)return {skipped:'paid',week:prev};
 const since=tbilisiMidnight(prev),until=tbilisiMidnight(monday);
 const [boxes,meters]=await Promise.all([boxesBoard({since,until,limit:prizes.boxes.length,db}),metersBoard({since,until,limit:prizes.meters.length,db})]);
 const paid=[];
 for(const [board,rows,list] of [['boxes',boxes,prizes.boxes],['meters',meters,prizes.meters]]){
  rows.forEach((row,i)=>{if(list[i]>0)paid.push({board,rank:i+1,userId:row.userId,handle:row.handle,coins:list[i],result:board==='boxes'?row.coins:Math.round(row.meters)});});
 }
 await db.$transaction(async tx=>{
  for(const p of paid){
   await tx.rewardLedger.upsert({where:{userId_currency_sourceType_sourceId:{userId:p.userId,currency:'COIN',sourceType:COIN_SOURCE,sourceId:`${PRIZE_SOURCE_PREFIX}${prev}:${p.board}:${p.rank}`}},update:{},create:{id:randomUUID(),userId:p.userId,currency:'COIN',amount:p.coins,transactionType:'EARN',sourceType:COIN_SOURCE,sourceId:`${PRIZE_SOURCE_PREFIX}${prev}:${p.board}:${p.rank}`,createdAt:new Date(now),metadata:{campaign:campaign.id,week:prev,board:p.board,rank:p.rank}}});
   await syncQuestCache(tx,p.userId);
  }
  await tx.medipulsiAudit.create({data:{id:randomUUID(),actorId:'medirun-autopilot',action:'DROP_WEEK_PRIZES',entityId:prev,details:{winners:paid.map(({board,rank,handle,coins,result})=>({board,rank,handle,coins,result})),total:paid.reduce((s,p)=>s+p.coins,0)}}});
 });
 if(paid.length)await tellOwner(`🏅 MEDIRUN: ${prev}-ის კვირის პრიზები ჩაირიცხა — ${paid.map(p=>`${p.board==='boxes'?'ყუთები':'მანძილი'} #${p.rank} ${p.handle} +${p.coins}`).join(', ')} (სულ ${paid.reduce((s,p)=>s+p.coins,0)} ქოინი).`);
 return {week:prev,paid};
}

/* ───────── the player's MEDIRUN wallet (owner 2026-10-04: balance + history on the MEDIRUN page) ───────── */
const ROW_LIMIT=40;
/** Pure: ledger rows (joined with the claim's box) → what the app lists. Never a coordinate. */
export function walletRows(rows,lang='ka'){
 const en=lang==='en';
 return rows.map(r=>{
  const m=r.metadata&&typeof r.metadata==='object'?r.metadata:{},meta=r.ruleMeta&&typeof r.ruleMeta==='object'?r.ruleMeta:{};
  const prize=String(r.sourceId||'').startsWith(PRIZE_SOURCE_PREFIX);
  const place=en?(meta.placeEn||meta.place||null):(meta.place||null),city=en?(meta.cityEn||meta.city||null):(meta.city||null);
  return {id:r.id,amount:r.amount,createdAt:r.createdAt,kind:prize?'prize':meta.kind==='grand'?'grand':'box',
   rank:Number(m.rank)||null,base:Number(m.base)||null,place,district:meta.district||null,city,
   board:prize?(m.board||null):null,week:prize?(m.week||null):null,giftKind:meta.kind||null};
 });
}
export async function walletView(userId,{db=prisma,campaign,now=Date.now(),lang='ka'}={}){
 // „ამ სეზონზე“: the campaign window — before it starts (test boxes, manual drops) everything so far counts.
 const start=tbilisiMidnight(campaign.start),since=now<+start?new Date(0):start,until=new Date(+tbilisiMidnight(campaign.end)+DAY);
 const [profile,ledger,season,claims]=await Promise.all([
  db.userQuestProfile.findUnique({where:{userId},select:{cachedCoinBalance:true}}).catch(()=>null),
  db.$queryRaw`SELECT l."id", l."amount", l."createdAt", l."sourceId", l."metadata", r."meta" AS "ruleMeta" FROM "RewardLedger" l LEFT JOIN "MedipulsiClaim" c ON l."sourceId" LIKE 'claim:%' AND c."id"=substring(l."sourceId" from 7) LEFT JOIN "MedipulsiGiftRule" r ON r."giftId"=c."giftId" WHERE l."userId"=${userId} AND l."sourceType"=${COIN_SOURCE} AND l."currency"='COIN' ORDER BY l."createdAt" DESC LIMIT ${ROW_LIMIT}`.catch(()=>[]),
  db.rewardLedger.aggregate({_sum:{amount:true},where:{userId,sourceType:COIN_SOURCE,currency:'COIN',createdAt:{gte:since,lt:until}}}).catch(()=>({_sum:{amount:0}})),
  db.$queryRaw`SELECT count(*)::int AS boxes, count(*) FILTER (WHERE ("reward"->>'rank')::int=1)::int AS firsts FROM "MedipulsiClaim" WHERE "userId"=${userId} AND "status" IN ('APPROVED','FULFILLED') AND "createdAt">=${since} AND "createdAt"<${until}`.catch(()=>[{boxes:0,firsts:0}]),
 ]);
 let balance=profile?.cachedCoinBalance;
 if(!Number.isFinite(balance)){const all=await db.rewardLedger.aggregate({_sum:{amount:true},where:{userId,currency:'COIN'}}).catch(()=>({_sum:{amount:0}}));balance=all._sum.amount||0;}
 return {balance:Math.max(0,balance||0),season:{earned:Math.max(0,season._sum.amount||0),boxes:claims[0]?.boxes||0,firsts:claims[0]?.firsts||0,start:campaign.start,end:campaign.end},rows:walletRows(ledger,lang),now:new Date(now).toISOString()};
}
/** The balance after a claim, for the app's live coin counter. */
export async function coinBalance(tx,userId){
 const p=await tx.userQuestProfile.findUnique({where:{userId},select:{cachedCoinBalance:true}}).catch(()=>null);
 return Number.isFinite(p?.cachedCoinBalance)?p.cachedCoinBalance:null;
}
