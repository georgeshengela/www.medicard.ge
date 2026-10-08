import {Router} from 'express';
import {z} from 'zod';
import rateLimit from 'express-rate-limit';
import {requireAuth} from '../middleware/auth.js';
import {asyncHandler} from '../middleware/error.js';
import {RATE_LIMIT_VALIDATE,apiTrafficKey} from '../lib/rateLimitKey.js';
import {env} from '../config/env.js';
import * as game from '../lib/medipulsi/service.js';
import {id,batchSchema,settingsSchema,fail} from '../lib/medipulsi/schema.js';
import { t, getUserLanguage } from '../lib/i18n.js';
import {localizeSnapshot} from '../lib/medipulsi/missionsEn.js';
import {territory} from '../lib/medipulsi/territory.js';
import {grandStatus} from '../lib/medipulsi/grand.js';
import {dropsStatus,parseAt} from '../lib/medipulsi/drops.js';
import {crewView,createCrew,joinCrew,leaveCrew,renameCrew,removeMember} from '../lib/medipulsi/social.js';
import {cityMeter} from '../lib/medipulsi/cityMeter.js';
import {wrappedView} from '../lib/medipulsi/wrapped.js';
import {recordVisit,myCities} from '../lib/medipulsi/cityVisits.js';
export const medipulsiRouter=Router();
// The app's MEDIRUN client (pulseApi) sends no X-Medicard-Lang: fall back to the account's stored language.
medipulsiRouter.use(requireAuth,asyncHandler(async(req,_res,next)=>{if(!req.langExplicit)req.lang=await getUserLanguage(req.user.id).catch(()=>'ka');next();}));
medipulsiRouter.use((req,res,next)=>{res.set('Cache-Control','no-store');if(req.user.status!=='ACTIVE')return res.status(403).json({error: t(req, 'საჭიროა აქტიური ანგარიში.', 'An active account is required.')});next();});
// Every MEDIRUN route is signed-in: limit per session, not per IP (a carrier NAT puts many runners behind one IP).
const write=rateLimit({windowMs:60000,limit:180,standardHeaders:true,legacyHeaders:false,validate:RATE_LIMIT_VALIDATE,keyGenerator:apiTrafficKey});
medipulsiRouter.get('/bootstrap',asyncHandler(async(req,res)=>res.json({...localizeSnapshot(await game.bootstrap(req.user.id,req.lang),req.lang),mapboxToken:env.MAPBOX_PUBLIC_TOKEN||process.env.MAPBOX_PUBLIC_TOKEN||''})));
medipulsiRouter.patch('/settings',write,asyncHandler(async(req,res)=>res.json(localizeSnapshot(await game.settings(req.user.id,settingsSchema.parse(req.body)),req.lang))));
medipulsiRouter.put('/mission',write,asyncHandler(async(req,res)=>res.json(localizeSnapshot(await game.selectMission(req.user.id,z.object({id:id.nullable()}).strict().parse(req.body).id),req.lang))));
medipulsiRouter.post('/sessions',write,asyncHandler(async(req,res)=>res.json(localizeSnapshot(await game.start(req.user.id,z.object({id:z.uuid()}).strict().parse(req.body).id),req.lang))));
medipulsiRouter.post('/sessions/:id/batches',write,asyncHandler(async(req,res)=>{
 const input=batchSchema.parse(req.body),out=await game.batch(req.user.id,id.parse(req.params.id),input);
 // „ჩემი ქალაქები“: the city of the latest fix is remembered (tile cache, at most once per 10 min per tile).
 if(out?.accepted)void recordVisit(req.user.id,input.fixes[input.fixes.length-1]?.position);
 res.json(out);
}));
medipulsiRouter.post('/sessions/:id/:action',write,asyncHandler(async(req,res)=>res.json(localizeSnapshot(await game.control(req.user.id,id.parse(req.params.id),z.enum(['pause','resume','finish']).parse(req.params.action)),req.lang))));
const lookups=rateLimit({windowMs:60000,limit:20,standardHeaders:true,legacyHeaders:false,validate:RATE_LIMIT_VALIDATE,keyGenerator:apiTrafficKey});
// Painted share of each city / country the person walked in (aggregates only, never the route).
medipulsiRouter.get('/territory',lookups,asyncHandler(async(req,res)=>res.json(await territory(req.user.id,req.lang))));
medipulsiRouter.get('/nearby',asyncHandler(async(req,res)=>res.json(await game.nearby(req.user.id,Date.now(),req.lang))));
// „გაანათე თბილისი“: how much of Tbilisi the person has lit and whether the grand prize is visible to them.
medipulsiRouter.get('/grand',lookups,asyncHandler(async(req,res)=>res.json(await grandStatus(req.user.id,req.lang))));
// „ყუთები ახლა“: boxes out in the city this minute (per district), today's openings and the next wave. Aggregates only.
medipulsiRouter.get('/drops',lookups,asyncHandler(async(req,res)=>res.json(await dropsStatus(req.user.id,{lang:req.lang,at:parseAt(req.get('x-medirun-at'))}))));
medipulsiRouter.post('/gifts/:id/claim',write,asyncHandler(async(req,res)=>res.json(await game.claim(req.user.id,id.parse(req.params.id)))));
// Medi Coins on the MEDIRUN page: balance, this season's box earnings and the last movements (park, rank, date).
medipulsiRouter.get('/wallet',lookups,asyncHandler(async(req,res)=>res.json(await game.wallet(req.user.id,req.lang))));
medipulsiRouter.get('/leaderboard',asyncHandler(async(req,res)=>res.json(await game.leaderboard(z.enum(['week','season']).default('week').parse(req.query.period),z.enum(['meters','boxes']).default('meters').parse(req.query.board),req.user.id))));
// Crews (owner 2026-10-05): a small group joined by code; members see nicknames and this week's metres only.
const crewName=z.object({name:z.string().max(80)}).strict(),crewCode=z.object({code:z.string().max(20)}).strict();
medipulsiRouter.get('/crew',lookups,asyncHandler(async(req,res)=>res.json(await crewView(req.user.id,{lang:req.lang}))));
medipulsiRouter.post('/crew',write,asyncHandler(async(req,res)=>{await game.bootstrap(req.user.id,req.lang);res.json(await createCrew(req.user.id,crewName.parse(req.body).name,{lang:req.lang}));}));
medipulsiRouter.patch('/crew',write,asyncHandler(async(req,res)=>res.json(await renameCrew(req.user.id,crewName.parse(req.body).name,{lang:req.lang}))));
medipulsiRouter.post('/crew/join',write,asyncHandler(async(req,res)=>{await game.bootstrap(req.user.id,req.lang);res.json(await joinCrew(req.user.id,crewCode.parse(req.body).code,{lang:req.lang}));}));
medipulsiRouter.post('/crew/leave',write,asyncHandler(async(req,res)=>res.json(await leaveCrew(req.user.id,{lang:req.lang}))));
medipulsiRouter.post('/crew/members/:id/remove',write,asyncHandler(async(req,res)=>res.json(await removeMember(req.user.id,id.parse(req.params.id),{lang:req.lang}))));
// „თბილისი ერთად“: how much of the campaign city everyone has lit together (aggregates only).
medipulsiRouter.get('/city',lookups,asyncHandler(async(req,res)=>res.json({meter:await cityMeter({lang:req.lang})})));
// Last week in one card (Monday–Wednesday in the app): the reader's own numbers, ranks and prizes.
// „ჩემი ქალაქები“: lit cities with their share and dot map, then the cities visited without lighting anything yet.
medipulsiRouter.get('/cities',lookups,asyncHandler(async(req,res)=>res.json(await myCities(req.user.id,{lang:req.lang}))));
medipulsiRouter.get('/wrapped',lookups,asyncHandler(async(req,res)=>res.json(await wrappedView(req.user.id))));

// Public: the same city meter for the /medirun page (no account, no personal data).
export const medirunPublicRouter=Router();
const publicLimit=rateLimit({windowMs:60000,limit:60,standardHeaders:true,legacyHeaders:false,validate:RATE_LIMIT_VALIDATE});
medirunPublicRouter.get('/city',publicLimit,asyncHandler(async(req,res)=>{
 res.set('Cache-Control','public, max-age=60');
 res.json({meter:await cityMeter({lang:req.query.lang==='en'?'en':'ka'})});
}));
