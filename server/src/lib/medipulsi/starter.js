// Starter box (owner 2026-10-05: „როცა თამაშს დაიწყებს, ავტომატურად ყუთი ამოუგდე, რომ გახსნას და აზარტში ჩავარდეს“).
// A player who has never opened a box gets one personal box on their first walk: after a few dozen metres (or
// seconds) with a precise GPS fix it appears right where they stand, so the pulse, the reveal and the coins all
// happen in the first minute. One per account, ever — until it is opened it moves with the player's next walk.
// The box is personal: nearby() and claim() hide it from everyone else, the box counts, admin maps and the
// Director never list it (its spot is the player's own position), and it never ranks on the leaderboards.
import {createHash} from 'node:crypto';
import {prisma} from '../prisma.js';
import {upsertGiftRule} from './giftRules.js';
import {economyOf} from './campaignStore.js';
import {budgetState,seasonPaid} from './economy.js';

export const STARTER_PREFIX='starter-';
export const STARTER_DEFAULTS=Object.freeze({enabled:true,coins:50,afterMeters:60,afterSeconds:45,hours:2});
const PULSE_M=120,REVEAL_M=45;

/** Gift id of one account's starter box (a hash, so the id never carries the account id). */
export const starterGiftId=userId=>STARTER_PREFIX+createHash('sha256').update(`medirun-starter:${userId}`).digest('hex').slice(0,20);
export const isStarterId=id=>typeof id==='string'&&id.startsWith(STARTER_PREFIX);
/** The campaign's starter settings with safe defaults (a saved campaign from before this feature has none). */
export function starterOf(campaign){
 const s={...STARTER_DEFAULTS,...(economyOf(campaign).starter||{})};
 return {enabled:Boolean(s.enabled),coins:Math.max(0,Math.min(1000,Math.round(Number(s.coins)||0))),afterMeters:Math.max(0,Math.min(1000,Number(s.afterMeters)||0)),afterSeconds:Math.max(0,Math.min(600,Number(s.afterSeconds)||0)),hours:Math.max(.5,Math.min(12,Number(s.hours)||2))};
}
/** Pure: has this session walked far or long enough for the box to drop? */
export function starterDue(settings,session){
 const meters=Number(session?.meters)||0,seconds=Number(session?.seconds)||0;
 return meters>=settings.afterMeters||seconds>=settings.afterSeconds;
}
/** Pure: what the app shows before the box drops — metres still to walk (null when it is time). */
export function starterProgress(settings,session){
 if(starterDue(settings,session))return null;
 return {meters:Math.max(0,Math.ceil(settings.afterMeters-(Number(session?.meters)||0)))};
}

// Accounts that already opened a box (or whose starter is spent) never need another look; kept per instance.
const done=new Set();
const DONE_MAX=50_000;
function remember(userId){done.add(userId);if(done.size>DONE_MAX)done.delete(done.values().next().value);}

/**
 * Called from nearby() while the player walks with a fresh, precise fix. Returns
 *   null                      — not eligible (already opened boxes, starter off, budget used up);
 *   {pending:{meters}}        — eligible, the box drops after a little more walking;
 *   {placed:true}             — the box is out now (created, or moved to this walk).
 * Never throws: a failure only means no starter box this time.
 */
export async function ensureStarterBox(userId,{journey,session,campaign,now=Date.now(),db=prisma}){
 if(done.has(userId))return null;
 try{
  const settings=starterOf(campaign);
  if(!settings.enabled||!settings.coins)return null;
  const id=starterGiftId(userId);
  const [claims,gift]=await Promise.all([db.medipulsiClaim.count({where:{userId}}),db.medipulsiGift.findUnique({where:{id}})]);
  if(claims>0||gift?.allocated>0){remember(userId);return null;}
  if(gift&&gift.published&&!gift.archived&&+gift.endsAt>now&&+gift.startsAt<=now)return {placed:true};
  const progress=starterProgress(settings,session);
  if(progress)return {pending:progress};
  // The season budget is the owner's hard cap: no new coins once it is used up.
  const budget=budgetState(campaign,await seasonPaid(campaign,{db}),now);
  if(budget.stopped)return null;
  const [lng,lat]=journey.position,startsAt=new Date(now-5000),endsAt=new Date(now+settings.hours*3600_000);
  const data={title:'სასტარტო ყუთი',description:'შენი პირველი MEDIRUN ყუთი',longitude:lng,latitude:lat,pulseRadius:PULSE_M,revealRadius:REVEAL_M,rewardKind:'DIGITAL',stock:1,published:true,archived:false,startsAt,endsAt};
  // Rule first: a box without its owner rule must never be visible to anyone else.
  await upsertGiftRule(db,{giftId:id,campaign:campaign.id,coins:settings.coins,minPercent:null,areaId:null,meta:{kind:'starter',ownerId:userId,place:'სასტარტო ყუთი',placeEn:'Starter box',titleEn:'Starter box',descriptionEn:'Your first MEDIRUN box'}});
  if(gift)await db.medipulsiGift.update({where:{id},data:{longitude:lng,latitude:lat,startsAt,endsAt,published:true,archived:false,revision:{increment:1}}});
  else await db.medipulsiGift.create({data:{id,...data}}).catch(error=>{if(error?.code!=='P2002')throw error;});
  return {placed:true};
 }catch(error){
  console.warn('[medirun] starter box skipped',error?.message);
  return null;
 }
}
/** A starter box belongs to one account: everyone else never sees or opens it. Decided by the id alone, so a
 * rule cache that has not caught up yet on another instance can never show it to the wrong person. */
export const visibleTo=(giftId,userId)=>!isStarterId(giftId)||giftId===starterGiftId(userId);
