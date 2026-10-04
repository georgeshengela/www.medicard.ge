import {createHash,randomUUID,randomBytes} from 'node:crypto';
import {prisma} from '../prisma.js';
import {env} from '../../config/env.js';
import {createJourney,acceptFix,parkProgress} from './core/journey.js';
import {pauseJourney,resetSession} from './core/session.js';
import {emptyBook,advanceMission} from './core/missions.js';
import {distance} from './core/engine.js';
import {fail} from './schema.js';
import {giftRules,percentsFor,isUnlocked,localizeGift,creditGiftCoins,payoutFor,decayOf} from './giftRules.js';
import {getCampaign,economyOf} from './campaignStore.js';
import {periodBounds,boxesBoard,metersBoard,myNumbers,rankAmong,weekWinners,weekStart,tbilisiMidnight} from './economy.js';

export const DEFAULTS={enabled:true,giftsEnabled:true,leaderboardEnabled:true,message:''};
export async function config(db=prisma){const row=await db.medipulsiConfig.findUnique({where:{id:'main'}});return {...DEFAULTS,...row?.data};}
async function enabled(db){if(!(await config(db)).enabled)fail(503,'MEDIRUN დროებით შეჩერებულია.','GAME_PAUSED');}
function initial(){return {journey:createJourney('gps'),book:emptyBook(),lastSampleTime:null};}
export async function playerLock(tx,userId,lang='ka'){
 await tx.medipulsiPlayer.upsert({where:{userId},create:{userId,state:initial(),handle:(lang==='en'?'Explorer ':'მკვლევარი ')+randomBytes(3).toString('hex')},update:{}});
 await tx.$queryRaw`SELECT "userId" FROM "MedipulsiPlayer" WHERE "userId"=${userId} FOR UPDATE`;
 return tx.medipulsiPlayer.findUnique({where:{userId}});
}
const transaction=fn=>prisma.$transaction(fn,{maxWait:10000,timeout:20000});
export async function catalog(db=prisma){return (await db.medipulsiMission.findMany({where:{published:true,archived:false},orderBy:{id:'asc'}})).map(r=>r.data);}
export async function snapshot(userId,db=prisma){
 const p=await db.medipulsiPlayer.findUnique({where:{userId}});
 if(!p)return null;
 const [session,history,claims,missions,cfg,sum]=await Promise.all([
  p.activeSessionId?db.medipulsiSession.findUnique({where:{id:p.activeSessionId}}):null,
  db.medipulsiSession.findMany({where:{userId,phase:'FINISHED'},orderBy:{startedAt:'desc'},take:50}),
  db.medipulsiClaim.findMany({where:{userId},orderBy:{createdAt:'desc'},take:100}),catalog(db),config(db),
  // `history` is the latest 50 walks; lifetime numbers come from every finished walk.
  db.medipulsiSession.aggregate({where:{userId,phase:'FINISHED'},_count:{_all:true},_sum:{meters:true,newMeters:true}})
 ]);
 const totals={walks:sum._count._all,meters:sum._sum.meters||0,newMeters:sum._sum.newMeters||0};
 return {userId,state:p.state,settings:p.settings,handle:p.handle,leaderboardOptIn:p.leaderboardOptIn,revision:p.revision,session,history,totals,claims,missions,config:cfg,mapboxToken:env.MAPBOX_PUBLIC_TOKEN};
}
export async function bootstrap(userId,lang='ka'){await transaction(tx=>playerLock(tx,userId,lang));return snapshot(userId);}
export async function settings(userId,input){return transaction(async tx=>{const p=await playerLock(tx,userId);const {handle,leaderboardOptIn,...preferences}=input;await tx.medipulsiPlayer.update({where:{userId},data:{settings:{...p.settings,...preferences},...(handle!==undefined?{handle}:{}),...(leaderboardOptIn!==undefined?{leaderboardOptIn}:{}),revision:{increment:1}}});return snapshot(userId,tx);});}
export async function selectMission(userId,missionId){return transaction(async tx=>{
 const p=await playerLock(tx,userId);if(missionId&&!await tx.medipulsiMission.findFirst({where:{id:missionId,published:true,archived:false}}))fail(404,'მისია მიუწვდომელია.');
 const state={...p.state,book:{...p.state.book,selected:missionId}};
 await tx.medipulsiPlayer.update({where:{userId},data:{state,revision:{increment:1}}});return snapshot(userId,tx);
});}
export async function start(userId,sessionId){return transaction(async tx=>{
 await enabled(tx);const p=await playerLock(tx,userId);
 const old=await tx.medipulsiSession.findUnique({where:{id:sessionId}});
 if(old){if(old.userId!==userId)fail(404,'სესია ვერ მოიძებნა.');if(old.phase==='FINISHED')fail(409,'ეს სესია დასრულებულია.');return snapshot(userId,tx);}
 if(p.activeSessionId)fail(409,'გააგრძელე ან დაასრულე არსებული სესია.','ACTIVE_SESSION');
 const state={...p.state,journey:{...resetSession(p.state.journey),rejected:0},lastSampleTime:null};
 await tx.medipulsiSession.create({data:{id:sessionId,userId}});
 await tx.medipulsiPlayer.update({where:{userId},data:{state,activeSessionId:sessionId,revision:{increment:1}}});return snapshot(userId,tx);
});}
async function owned(tx,userId,sessionId){const s=await tx.medipulsiSession.findUnique({where:{id:sessionId}});if(!s||s.userId!==userId)fail(404,'სესია ვერ მოიძებნა.');return s;}
export async function control(userId,sessionId,action){return transaction(async tx=>{
 const p=await playerLock(tx,userId),s=await owned(tx,userId,sessionId);
 if(s.phase==='FINISHED'){if(action==='finish')return snapshot(userId,tx);fail(409,'სესია დასრულებულია.');}
 if(p.activeSessionId!==s.id)fail(409,'სესია აღარ არის აქტიური.');
 if(action==='resume')await enabled(tx);
 const finish=action==='finish',state={...p.state,journey:finish?resetSession(p.state.journey):pauseJourney(p.state.journey),lastSampleTime:null};
 await tx.medipulsiSession.update({where:{id:sessionId},data:{phase:finish?'FINISHED':action==='pause'?'PAUSED':'ACTIVE',...(finish?{endedAt:new Date()}:{} )}});
 await tx.medipulsiPlayer.update({where:{userId},data:{state,...(finish?{activeSessionId:null}:{}),revision:{increment:1}}});return snapshot(userId,tx);
});}
export async function batch(userId,sessionId,input,now=Date.now()){return transaction(async tx=>{
 const p=await playerLock(tx,userId),s=await owned(tx,userId,sessionId);
 const digest=createHash('sha256').update(JSON.stringify(input)).digest('hex');
 const old=await tx.medipulsiBatch.findUnique({where:{sessionId_id:{sessionId,id:input.id}}});
 if(old){if(old.digest!==digest)fail(409,'გამეორებული პაკეტის მონაცემები განსხვავდება.','BATCH_CONFLICT');return {duplicate:true,seq:s.seq};}
 await enabled(tx);
 if(p.activeSessionId!==s.id||s.phase!=='ACTIVE')fail(409,'სესია პაუზაზეა ან დასრულებულია.','SESSION_PAUSED');
 if(input.seq!==s.seq+1)fail(409,'პაკეტების რიგი არ ემთხვევა.','SEQUENCE_CONFLICT');
 let state=structuredClone(p.state),accepted=0;
 const m=state.book.selected?await tx.medipulsiMission.findFirst({where:{id:state.book.selected,published:true,archived:false}}):null;
 for(const fix of input.fixes){
  // Offline GPS is accepted for 24 hours, in order, never before this session.
  if(fix.timestamp>now+5000||fix.timestamp<now-86400000||fix.timestamp<+s.startedAt-5000||fix.mocked||(state.lastSampleTime!==null&&fix.timestamp<=state.lastSampleTime)){state.journey.rejected++;continue;}
  const before=state.journey;
  let after=acceptFix(before,fix,.72,fix.timestamp);
  const dt=state.lastSampleTime===null?0:(fix.timestamp-state.lastSampleTime)/1000;
  after.seconds=before.seconds+(dt>0&&dt<=15?dt:0);
  if(after.meters>before.meters){accepted++;state.book=advanceMission(state.book,before,after,fix.timestamp,m?.data||null);}
  state.lastSampleTime=fix.timestamp;state.journey=after;
 }
 const j=state.journey;
 await tx.medipulsiBatch.create({data:{id:input.id,sessionId,seq:input.seq,digest,accepted}});
 await tx.medipulsiSession.update({where:{id:sessionId},data:{seq:input.seq,meters:j.meters,seconds:j.seconds,movingSeconds:j.movingSeconds,maxSpeed:j.maxSpeed,rejected:j.rejected,steps:j.steps,newMeters:Math.max(0,parkProgress(j).unique-j.sessionStartCoverage)}});
 await tx.medipulsiPlayer.update({where:{userId},data:{state,revision:{increment:1}}});return {seq:input.seq,accepted};
});}
const noSignal={signal:false,revealed:false,quality:false,period:2200,distance:0,gift:null};
function fresh(j,now){return j?.lastFix&&now-j.lastFix<15000&&now-j.lastFix>=-5000&&j.accuracy<=25&&['tracking','off-path','stationary'].includes(j.status);}
function inRange(j,g){return distance(j.position,[g.longitude,g.latitude])+j.accuracy<=g.revealRadius;}
export async function nearby(userId,now=Date.now(),lang='ka'){
 if(!(await config()).giftsEnabled)return noSignal;
 const p=await prisma.medipulsiPlayer.findUnique({where:{userId}}),j=p?.state?.journey;
 if(!p?.activeSessionId||!fresh(j,now))return noSignal;
 const claimed=await prisma.medipulsiClaim.findMany({where:{userId},select:{giftId:true}});
 const gifts=await prisma.medipulsiGift.findMany({where:{published:true,archived:false,startsAt:{lte:new Date(now)},endsAt:{gt:new Date(now)},id:{notIn:claimed.map(c=>c.giftId)},latitude:{gte:j.position[1]-.01,lte:j.position[1]+.01}}});
 // Campaign rules: a gated box (grand prize, lantern boxes) does not exist for a player below its lit-city threshold.
 const rules=await giftRules(),open=gifts.filter(g=>g.allocated<g.stock),gated=open.map(g=>rules.get(g.id)).filter(r=>r?.minPercent);
 const percents=gated.length?await percentsFor(userId,gated):new Map();
 const closest=open.filter(g=>isUnlocked(rules.get(g.id),id=>percents.get(id))).map(g=>({g,d:distance(j.position,[g.longitude,g.latitude])})).filter(x=>x.d<=x.g.pulseRadius).sort((a,b)=>a.d-b.d)[0];
 if(!closest)return {...noSignal,quality:true};
 const {g,d}=closest,revealed=inRange(j,g),rule=rules.get(g.id)||null;
 // Economy 2: what THIS opening pays (first finder gets the full coins, later ones a falling share).
 const coins=payoutFor(rule,g.allocated),money=rule?.coins>0?{coins,base:rule.coins,rank:g.allocated+1,opened:g.allocated,stock:g.stock,decay:decayOf(rule)}:{};
 const gift=revealed?localizeGift({id:g.id,title:g.title,description:g.description,rewardKind:g.rewardKind,position:[g.longitude,g.latitude]},rule,lang):null;
 return {signal:true,revealed,quality:true,period:Math.round((2200-1500*(1-d/g.pulseRadius))/100)*100,distance:revealed?Math.round(d):0,gift:gift?{...gift,...money,...(coins>0?{title:`${coins} Medi Coins`}:{})}:null};
}
export async function claim(userId,giftId,now=Date.now()){
 const rule=(await giftRules()).get(giftId)||null,percents=rule?.minPercent?await percentsFor(userId,[rule],{maxAgeMs:0}):new Map();
 return transaction(async tx=>{
 await enabled(tx);if(!(await config(tx)).giftsEnabled)fail(409,'საჩუქრები დროებით შეჩერებულია.');
 const p=await playerLock(tx,userId);
 const previous=await tx.medipulsiClaim.findUnique({where:{userId_giftId:{userId,giftId}}});if(previous)return previous;
 if(!p.activeSessionId||!fresh(p.state.journey,now))fail(409,'საჭიროა ახალი და ზუსტი GPS სიგნალი.','FRESH_GPS_REQUIRED');
 const s=await owned(tx,userId,p.activeSessionId);if(s.excluded)fail(409,'სესიის შემოწმება მიმდინარეობს.');
 await tx.$queryRaw`SELECT "id" FROM "MedipulsiGift" WHERE "id"=${giftId} FOR UPDATE`;
 const g=await tx.medipulsiGift.findUnique({where:{id:giftId}});
 if(!g||!g.published||g.archived||+g.startsAt>now||+g.endsAt<=now||!inRange(p.state.journey,g))fail(409,'საჩუქარი ამ მდებარეობაზე მიუწვდომელია.');
 if(!isUnlocked(rule,id=>percents.get(id)))fail(409,'ეს საჩუქარი ჯერ შენთვის დახურულია.','GIFT_LOCKED');
 if(g.allocated>=g.stock)fail(409,'საჩუქრის მარაგი ამოიწურა.','OUT_OF_STOCK');
 // Economy 2: the opening's place in the ladder is `allocated` under the row lock — first finder = rank 1.
 const rank=g.allocated+1,coins=payoutFor(rule,g.allocated);
 const claimed=await tx.medipulsiClaim.create({data:{id:randomUUID(),userId,giftId,sessionId:s.id,code:randomBytes(10).toString('hex').toUpperCase(),status:g.rewardKind==='DIGITAL'?'APPROVED':'PENDING',reward:{title:coins>0?`${coins} Medi Coins`:g.title,description:g.description,kind:g.rewardKind,coins,rank,base:rule?.coins||0,evidence:{fixAt:p.state.journey.lastFix,accuracy:p.state.journey.accuracy,distance:distance(p.state.journey.position,[g.longitude,g.latitude]),sessionMeters:s.meters,rejectedFixes:s.rejected}}}});
 await tx.medipulsiGift.update({where:{id:giftId},data:{allocated:{increment:1}}});
 await creditGiftCoins(tx,{userId,claimId:claimed.id,giftId,rule,amount:coins,rank,now:new Date(now)});
 return claimed;
});}
/**
 * Two boards (economy 2): `boxes` — coins from box openings, boxes, first finds; `meters` — verified distance.
 * `week` = this Tbilisi calendar week (the Monday prizes use the same window), `season` = the campaign.
 * No coordinates, names, email, or health records are exposed in rankings; `me` is the reader's own place even
 * when they are not on the list (a reason to join).
 */
export async function leaderboard(period='week',board='meters',userId=null,now=Date.now()){
 if(!(await config()).leaderboardEnabled)return {rows:[],board,period,me:null,prizes:null,lastWeek:[]};
 const campaign=await getCampaign(prisma,now),{since}=periodBounds(period,campaign,now);
 const rowsFull=board==='boxes'?await boxesBoard({since,db:prisma}):await metersBoard({since,db:prisma});
 const rows=rowsFull.map(({userId:_u,...r})=>r);
 let me=null;
 if(userId){
  const mine=await myNumbers(userId,{since,db:prisma}).catch(()=>null);
  if(mine){const listed=rowsFull.findIndex(r=>r.userId===userId);me={...mine,rank:listed>=0?listed+1:rankAmong(rowsFull,mine,board),listed:listed>=0};}
 }
 // Monday prizes while the campaign runs: what the week's top places get, and who got last week's.
 const e=economyOf(campaign),live=now>=+tbilisiMidnight(campaign.start)&&now<+tbilisiMidnight(campaign.end)+86400_000;
 const list=(board==='boxes'?e.weeklyPrizes.boxes:e.weeklyPrizes.meters)||[];
 const monday=weekStart(now),nextMonday=new Date(+tbilisiMidnight(monday)+7*86400_000);
 const prizes=live&&list.some(n=>n>0)?{coins:list.filter(n=>n>0),endsAt:nextMonday.toISOString()}:null;
 const prevMonday=new Date(Date.parse(`${monday}T00:00:00Z`)-7*86400_000).toISOString().slice(0,10);
 const lastWeek=live?await weekWinners(prevMonday,{db:prisma}).then(w=>w.filter(x=>x.board===board)).catch(()=>[]):[];
 return {rows,board,period,me,prizes,lastWeek};
}
