// „შენი კვირა MEDIRUN-ში“ (owner 2026-10-05): every Monday the app shows last week's walk in one card — metres, new
// streets, boxes and coins, the place on both boards and any Monday prize — with a video to share. Shown Monday to
// Wednesday (Tbilisi). The reader's own numbers only; nobody else's.
import {prisma} from '../prisma.js';
import {COIN_SOURCE} from './giftRules.js';
import {weekStart,tbilisiMidnight,boxesBoard,metersBoard,rankAmong,PRIZE_SOURCE_PREFIX} from './economy.js';

const DAY=86400_000;
const addDays=(ymd,n)=>new Date(Date.parse(`${ymd}T00:00:00Z`)+n*DAY).toISOString().slice(0,10);

/** Pure: the week the card is about and until when it is shown. */
export function wrappedWindow(now=Date.now()){
 const monday=weekStart(now),prev=addDays(monday,-7);
 return {start:prev,end:addDays(prev,6),since:tbilisiMidnight(prev),until:tbilisiMidnight(monday),showUntil:new Date(+tbilisiMidnight(monday)+3*DAY).toISOString()};
}

export async function wrappedView(userId,{db=prisma,now=Date.now()}={}){
 const w=wrappedWindow(now);
 const [b,m,prizes,boxes,meters]=await Promise.all([
  db.$queryRaw`SELECT count(*)::int AS boxes, coalesce(sum((c."reward"->>'coins')::int),0)::int AS coins, count(*) FILTER (WHERE (c."reward"->>'rank')::int=1)::int AS firsts FROM "MedipulsiClaim" c WHERE c."userId"=${userId} AND c."status" IN ('APPROVED','FULFILLED') AND coalesce(c."reward"->>'starter','false')<>'true' AND c."createdAt">=${w.since} AND c."createdAt"<${w.until}`,
  db.$queryRaw`SELECT coalesce(SUM(s."meters"),0)::float8 AS meters, coalesce(SUM(s."newMeters"),0)::float8 AS "newMeters", coalesce(SUM(s."movingSeconds"),0)::float8 AS seconds, count(*)::int AS walks FROM "MedipulsiSession" s WHERE s."userId"=${userId} AND s."excluded"=false AND s."phase"='FINISHED' AND s."startedAt">=${w.since} AND s."startedAt"<${w.until}`,
  db.$queryRaw`SELECT "sourceId","amount" FROM "RewardLedger" WHERE "userId"=${userId} AND "sourceType"=${COIN_SOURCE} AND "currency"='COIN' AND "sourceId" LIKE ${`${PRIZE_SOURCE_PREFIX}${w.start}:%`}`.catch(()=>[]),
  boxesBoard({since:w.since,until:w.until,limit:1000,db}).catch(()=>[]),
  metersBoard({since:w.since,until:w.until,limit:1000,db}).catch(()=>[]),
 ]);
 const mine={boxes:b[0]?.boxes||0,coins:b[0]?.coins||0,firsts:b[0]?.firsts||0,meters:m[0]?.meters||0,newMeters:m[0]?.newMeters||0,seconds:m[0]?.seconds||0,walks:m[0]?.walks||0};
 const place=(rows,board)=>{const i=rows.findIndex(r=>r.userId===userId);return i>=0?i+1:rankAmong(rows,mine,board);};
 return {
  week:{start:w.start,end:w.end},showUntil:w.showUntil,
  meters:Math.round(mine.meters),newMeters:Math.round(mine.newMeters),minutes:Math.round(mine.seconds/60),walks:mine.walks,
  boxes:mine.boxes,coins:mine.coins,firsts:mine.firsts,
  rank:{meters:mine.meters>0?place(meters,'meters'):null,boxes:mine.coins>0?place(boxes,'boxes'):null},
  prizes:prizes.map(p=>{const [,,board,rank]=String(p.sourceId).split(':');return {board,rank:Number(rank)||0,coins:p.amount};}),
 };
}
