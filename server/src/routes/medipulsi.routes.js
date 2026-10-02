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
medipulsiRouter.post('/sessions/:id/batches',write,asyncHandler(async(req,res)=>res.json(await game.batch(req.user.id,id.parse(req.params.id),batchSchema.parse(req.body)))));
medipulsiRouter.post('/sessions/:id/:action',write,asyncHandler(async(req,res)=>res.json(localizeSnapshot(await game.control(req.user.id,id.parse(req.params.id),z.enum(['pause','resume','finish']).parse(req.params.action)),req.lang))));
const lookups=rateLimit({windowMs:60000,limit:20,standardHeaders:true,legacyHeaders:false,validate:RATE_LIMIT_VALIDATE,keyGenerator:apiTrafficKey});
// Painted share of each city / country the person walked in (aggregates only, never the route).
medipulsiRouter.get('/territory',lookups,asyncHandler(async(req,res)=>res.json(await territory(req.user.id,req.lang))));
medipulsiRouter.get('/nearby',asyncHandler(async(req,res)=>res.json(await game.nearby(req.user.id,Date.now(),req.lang))));
// „გაანათე თბილისი“: how much of Tbilisi the person has lit and whether the grand prize is visible to them.
medipulsiRouter.get('/grand',lookups,asyncHandler(async(req,res)=>res.json(await grandStatus(req.user.id,req.lang))));
medipulsiRouter.post('/gifts/:id/claim',write,asyncHandler(async(req,res)=>res.json(await game.claim(req.user.id,id.parse(req.params.id)))));
medipulsiRouter.get('/leaderboard',asyncHandler(async(req,res)=>res.json(await game.leaderboard(z.enum(['week','season']).default('week').parse(req.query.period)))));
