import {Router} from 'express';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import rateLimit from 'express-rate-limit';
import {prisma} from '../lib/prisma.js';
import {env} from '../config/env.js';
import {requireAdmin} from '../middleware/adminAuth.js';
import {requireAdminCapability} from '../lib/adminCapabilities.js';
import {RATE_LIMIT_VALIDATE} from '../lib/rateLimitKey.js';
import {asyncHandler} from '../middleware/error.js';
import {id,missionWrite,giftWrite,configWrite,reviewWrite,claimWrite,fail} from '../lib/medipulsi/schema.js';
import * as D from '../lib/medipulsi/dropsAdmin.js';
import {resetCampaign} from '../lib/medipulsi/campaignStore.js';
import {medirunInsights} from '../lib/medipulsi/insights.js';
import {resolveMapLocation} from '../lib/medipulsi/mapLink.js';
export const adminMedipulsiRouter=Router();
const r=adminMedipulsiRouter,view=requireAdminCapability('MEDIPULSI_VIEW'),manage=requireAdminCapability('MEDIPULSI_MANAGE'),review=requireAdminCapability('MEDIPULSI_REVIEW');
r.use(requireAdmin,(req,res,next)=>{res.set('Cache-Control','no-store');next();});
const write=rateLimit({windowMs:60000,limit:60,standardHeaders:true,legacyHeaders:false,validate:RATE_LIMIT_VALIDATE});
const audit=(tx,req,action,entityId,details)=>tx.medipulsiAudit.create({data:{id:randomUUID(),actorId:req.admin.id,action,entityId,details}});
const pagination=q=>({take:50,skip:z.coerce.number().int().min(0).max(100000).default(0).parse(q.offset)});
r.get('/map',view,asyncHandler(async(req,res)=>res.json({token:env.MAPBOX_PUBLIC_TOKEN})));
r.get('/overview',view,asyncHandler(async(req,res)=>{
 const [players,sessions,active,claims,pending,missions,gifts,totals,config]=await Promise.all([
  prisma.medipulsiPlayer.count(),prisma.medipulsiSession.count(),prisma.medipulsiSession.count({where:{phase:'ACTIVE',updatedAt:{gte:new Date(Date.now()-120000)}}}),prisma.medipulsiClaim.count(),prisma.medipulsiClaim.count({where:{status:'PENDING'}}),prisma.medipulsiMission.count({where:{published:true,archived:false}}),prisma.medipulsiGift.count({where:{published:true,archived:false,endsAt:{gt:new Date()}}}),prisma.medipulsiSession.aggregate({_sum:{meters:true,seconds:true,steps:true},where:{excluded:false}}),prisma.medipulsiConfig.findUnique({where:{id:'main'}})
 ]);res.json({players,sessions,active,claims,pending,missions,gifts,totals:totals._sum,config});
}));
r.get('/missions',view,asyncHandler(async(req,res)=>res.json({rows:await prisma.medipulsiMission.findMany({orderBy:{id:'asc'}})})));
r.put('/missions/:id',manage,write,asyncHandler(async(req,res)=>{
 const key=id.parse(req.params.id),input=missionWrite.parse(req.body);if(input.data.id!==key)fail(400,'მისიის კოდი არ ემთხვევა.');
 const result=await prisma.$transaction(async tx=>{
  const old=await tx.medipulsiMission.findUnique({where:{id:key}});
  if(old){const updated=await tx.medipulsiMission.updateMany({where:{id:key,revision:input.revision},data:{...input,revision:{increment:1}}});if(!updated.count)fail(409,'მისია შეიცვალა. განაახლე გვერდი.');}
  else{if(input.revision!==0)fail(409,'განაახლე გვერდი.');await tx.medipulsiMission.create({data:{id:key,...input}});}
  await audit(tx,req,'MISSION_SAVE',key,{before:old,after:input});return tx.medipulsiMission.findUnique({where:{id:key}});
 });res.json(result);
}));
r.get('/gifts',view,asyncHandler(async(req,res)=>res.json({rows:await prisma.medipulsiGift.findMany({orderBy:{updatedAt:'desc'},...pagination(req.query)}),total:await prisma.medipulsiGift.count()})));
r.put('/gifts/:id',manage,write,asyncHandler(async(req,res)=>{
 const key=id.parse(req.params.id),input=giftWrite.parse(req.body),data={...input,startsAt:new Date(input.startsAt),endsAt:new Date(input.endsAt)};
 const result=await prisma.$transaction(async tx=>{
  await tx.$queryRaw`SELECT "id" FROM "MedipulsiGift" WHERE "id"=${key} FOR UPDATE`;
  const old=await tx.medipulsiGift.findUnique({where:{id:key}});
  if(old){if(data.stock<old.allocated)fail(400,'მარაგი უკვე დაჯავშნილ რაოდენობაზე ნაკლები ვერ იქნება.');const u=await tx.medipulsiGift.updateMany({where:{id:key,revision:input.revision},data:{...data,revision:{increment:1}}});if(!u.count)fail(409,'საჩუქარი შეიცვალა. განაახლე გვერდი.');}
  else{if(input.revision!==0)fail(409,'განაახლე გვერდი.');await tx.medipulsiGift.create({data:{id:key,...data}});}
  await audit(tx,req,'GIFT_SAVE',key,{before:old,after:input});return tx.medipulsiGift.findUnique({where:{id:key}});
 });res.json(result);
}));
r.get('/sessions',view,asyncHandler(async(req,res)=>{
 const phase=z.enum(['ACTIVE','PAUSED','FINISHED']).optional().parse(req.query.phase||undefined),where={...(phase?{phase}:{}),...(req.query.userId?{userId:id.parse(req.query.userId)}:{})};
 res.json({rows:await prisma.medipulsiSession.findMany({where,include:{user:{select:{id:true,fullName:true}}},orderBy:{startedAt:'desc'},...pagination(req.query)}),total:await prisma.medipulsiSession.count({where})});
}));
r.patch('/sessions/:id/review',review,write,asyncHandler(async(req,res)=>{
 const key=id.parse(req.params.id),input=reviewWrite.parse(req.body);
 res.json(await prisma.$transaction(async tx=>{const old=await tx.medipulsiSession.findUnique({where:{id:key}});if(!old)fail(404,'სესია ვერ მოიძებნა.');const row=await tx.medipulsiSession.update({where:{id:key},data:{excluded:input.excluded,reviewNote:input.reason}});await audit(tx,req,'SESSION_REVIEW',key,{excluded:input.excluded,reason:input.reason,previous:old.excluded});return row;}));
}));
r.get('/claims',view,asyncHandler(async(req,res)=>{
 const status=z.enum(['PENDING','APPROVED','FULFILLED','REJECTED']).optional().parse(req.query.status||undefined),where=status?{status}:{};
 res.json({rows:await prisma.medipulsiClaim.findMany({where,include:{user:{select:{id:true,fullName:true}}},orderBy:{createdAt:'desc'},...pagination(req.query)}),total:await prisma.medipulsiClaim.count({where})});
}));
r.patch('/claims/:id',review,write,asyncHandler(async(req,res)=>{
 const key=id.parse(req.params.id),input=claimWrite.parse(req.body);
 res.json(await prisma.$transaction(async tx=>{
  await tx.$queryRaw`SELECT "id" FROM "MedipulsiClaim" WHERE "id"=${key} FOR UPDATE`;
  const old=await tx.medipulsiClaim.findUnique({where:{id:key}});if(!old)fail(404,'ჯილდო ვერ მოიძებნა.');
  const transitions={PENDING:['APPROVED','REJECTED'],APPROVED:['FULFILLED','REJECTED'],FULFILLED:[],REJECTED:[]};
  if(!transitions[old.status]?.includes(input.status))fail(409,'სტატუსის ეს ცვლილება დაუშვებელია.');
  const row=await tx.medipulsiClaim.update({where:{id:key},data:{status:input.status,note:input.reason}});await audit(tx,req,'CLAIM_REVIEW',key,{from:old.status,to:input.status,reason:input.reason});return row;
 }));
}));
r.get('/config',view,asyncHandler(async(req,res)=>res.json(await prisma.medipulsiConfig.findUnique({where:{id:'main'}}))));
r.put('/config',manage,write,asyncHandler(async(req,res)=>{
 const input=configWrite.parse(req.body);res.json(await prisma.$transaction(async tx=>{
  const old=await tx.medipulsiConfig.findUnique({where:{id:'main'}}),u=await tx.medipulsiConfig.updateMany({where:{id:'main',revision:input.revision},data:{data:input.data,revision:{increment:1}}});if(!u.count)fail(409,'პარამეტრები შეიცვალა. განაახლე გვერდი.');await audit(tx,req,'CONFIG_SAVE','main',{before:old?.data,after:input.data});return tx.medipulsiConfig.findUnique({where:{id:'main'}});
 }));
}));
// scope=game: the game's own changes only — box changes have their own log in #/medirun-boxes.
r.get('/audit',view,asyncHandler(async(req,res)=>{
 const where=req.query.scope==='game'?{AND:[{NOT:{action:{startsWith:'DROP_'}}},{NOT:{AND:[{action:'GIFT_SAVE'},{actorId:'medirun-autopilot'}]}}]}:{};
 res.json({rows:await prisma.medipulsiAudit.findMany({where,orderBy:{createdAt:'desc'},...pagination(req.query)}),total:await prisma.medipulsiAudit.count({where})});
}));
// Players, comebacks, trends, countries and cities, Tbilisi levels, most active, coins and prizes (cached 10 min).
r.get('/insights',view,asyncHandler(async(req,res)=>res.json(await medirunInsights({force:req.query.fresh==='1'}))));

/* ───────── „MEDIRUN ყუთები“ (#/medirun-boxes): rules, days, spots, boxes, numbers ───────── */
const ymdParam=z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const adminId=req=>req.admin?.id;
r.get('/drops',view,asyncHandler(async(req,res)=>res.json(await D.dropsOverview())));
r.get('/drops/day/:date',view,asyncHandler(async(req,res)=>res.json({date:req.params.date,boxes:await D.dayBoxes(ymdParam.parse(req.params.date))})));
r.get('/drops/calendar',view,asyncHandler(async(req,res)=>res.json({days:await D.campaignCalendar()})));
r.get('/drops/stats',view,asyncHandler(async(req,res)=>{
 const days=z.coerce.number().int().min(7).max(120).default(30).parse(req.query.days),to=req.query.to?ymdParam.parse(req.query.to):new Date(Date.now()+4*3600_000).toISOString().slice(0,10);
 const from=new Date(Date.parse(`${to}T00:00:00Z`)-(days-1)*86400_000).toISOString().slice(0,10);
 res.json({from,to,days:await D.dayNumbers(from,to)});
}));
r.get('/drops/spots',view,asyncHandler(async(req,res)=>res.json(await D.spotList())));
r.get('/drops/audit',view,asyncHandler(async(req,res)=>res.json(await D.dropsAudit({offset:pagination(req.query).skip}))));
r.post('/drops/preview',view,write,asyncHandler(async(req,res)=>{
 const input=z.object({draft:z.record(z.string(),z.unknown()).nullable().optional(),from:ymdParam,days:z.number().int().min(1).max(14).default(1)}).strict().parse(req.body);
 res.json({days:await D.previewDays({draft:input.draft||null,from:input.from,days:input.days})});
}));
r.put('/drops/rules',manage,write,asyncHandler(async(req,res)=>{
 const input=z.object({revision:z.number().int().min(0),data:z.record(z.string(),z.unknown())}).strict().parse(req.body);
 res.json(await D.saveRules(input.data,{revision:input.revision,adminId:adminId(req)}));
}));
r.delete('/drops/rules',manage,write,asyncHandler(async(req,res)=>{
 await resetCampaign();
 await prisma.medipulsiAudit.create({data:{id:randomUUID(),actorId:adminId(req),action:'DROP_RULES_RESET',entityId:'campaign',details:{}}});
 res.json(await D.dropsOverview());
}));
const dayPatch=z.object({waves:z.array(z.record(z.string(),z.unknown())).optional(),coins:z.array(z.record(z.string(),z.unknown())).optional(),stock:z.tuple([z.number(),z.number()]).optional(),pulseRadius:z.number().optional(),revealRadius:z.number().optional(),minDepthM:z.number().optional()}).strict();
r.put('/drops/days/:date',manage,write,asyncHandler(async(req,res)=>{
 const input=z.object({override:z.object({off:z.boolean().optional(),as:z.enum(['weekday','weekend']).optional(),day:dayPatch.optional(),note:z.string().trim().max(300).optional()}).strict().nullable()}).strict().parse(req.body);
 res.json(await D.setDayOverride(ymdParam.parse(req.params.date),input.override,{adminId:adminId(req)}));
}));
r.put('/drops/spots/:id',manage,write,asyncHandler(async(req,res)=>{
 const input=z.object({excluded:z.boolean()}).strict().parse(req.body);
 res.json(await D.setSpotExcluded(id.parse(req.params.id),input.excluded,{adminId:adminId(req)}));
}));
r.post('/drops/days/:date/apply',manage,write,asyncHandler(async(req,res)=>res.json(await D.applyDate(ymdParam.parse(req.params.date),{adminId:adminId(req)}))));
r.post('/drops/days/:date/regenerate',manage,write,asyncHandler(async(req,res)=>res.json(await D.regenerateDate(ymdParam.parse(req.params.date),{adminId:adminId(req)}))));
r.post('/drops/days/:date/cancel',manage,write,asyncHandler(async(req,res)=>res.json(await D.cancelDate(ymdParam.parse(req.params.date),{adminId:adminId(req)}))));
// „ლოკაცია“: a Google Maps link (short share links too) or coordinates → the exact point.
r.post('/drops/resolve-location',manage,write,asyncHandler(async(req,res)=>{
 const {link}=z.object({link:z.string().trim().min(3).max(2000)}).strict().parse(req.body);
 const found=await resolveMapLocation(link).catch(()=>null);
 if(!found)fail(422,'ბმულიდან ადგილი ვერ ამოვიღე. ჩასვი Google Maps-ის ბმული ან კოორდინატები (მაგ. 41.7098, 44.7509).');
 res.json(found);
}));
r.post('/drops/boxes',manage,write,asyncHandler(async(req,res)=>{
 const input=z.object({cityId:z.string().regex(/^[a-z]\d+$/).optional(),spotId:id.optional(),district:z.string().trim().min(1).max(80).optional(),latitude:z.number().min(-90).max(90).optional(),longitude:z.number().min(-180).max(180).optional(),place:z.string().trim().max(80).optional(),
  prize:z.object({title:z.string().trim().min(2).max(100),description:z.string().trim().max(1000).optional(),titleEn:z.string().trim().max(100).optional(),descriptionEn:z.string().trim().max(1000).optional()}).strict().nullable().optional(),
  coins:z.number().int().min(1).max(10000).nullable().optional(),stock:z.number().int().min(1).max(1000),startsAt:z.iso.datetime({offset:true}).nullable().optional(),hours:z.number().min(.25).max(24),
  pulseRadius:z.number().int().min(40).max(500),revealRadius:z.number().int().min(10).max(50),minPercent:z.number().min(.01).max(100).nullable().optional(),note:z.string().trim().max(300).optional()}).strict()
  .refine(v=>v.pulseRadius>v.revealRadius,'პულსის რადიუსი გახსნის რადიუსზე დიდი უნდა იყოს').parse(req.body);
 res.json(await D.manualDrop(input,{adminId:adminId(req)}));
}));
r.patch('/drops/boxes/:id',manage,write,asyncHandler(async(req,res)=>{
 const input=z.discriminatedUnion('action',[
  z.object({action:z.literal('end')}).strict(),z.object({action:z.literal('cancel')}).strict(),z.object({action:z.literal('restore')}).strict(),
  z.object({action:z.literal('stock'),stock:z.number().int().min(0).max(100000)}).strict(),
  z.object({action:z.literal('coins'),coins:z.number().int().min(1).max(10000)}).strict(),
  z.object({action:z.literal('time'),startsAt:z.iso.datetime({offset:true}),endsAt:z.iso.datetime({offset:true})}).strict(),
  z.object({action:z.literal('text'),title:z.string().trim().min(2).max(100),description:z.string().trim().max(1000).optional(),titleEn:z.string().trim().max(100).optional(),descriptionEn:z.string().trim().max(1000).optional()}).strict(),
  z.object({action:z.literal('place'),latitude:z.number().min(-90).max(90),longitude:z.number().min(-180).max(180)}).strict(),
 ]).parse(req.body);
 res.json(await D.boxAction(id.parse(req.params.id),input,{adminId:adminId(req)}));
}));
r.get('/drops/cities',view,asyncHandler(async(req,res)=>res.json(await D.citiesOverview())));
r.get('/drops/cities/:id/spots',view,asyncHandler(async(req,res)=>res.json({spots:await D.citySpotList(id.parse(req.params.id))})));
r.post('/drops/cities',manage,write,asyncHandler(async(req,res)=>res.json(await D.addCityByAdmin(z.object({cityId:z.string().regex(/^[a-z]\d+$/)}).strict().parse(req.body).cityId,{adminId:adminId(req)}))));
r.put('/drops/cities/:id',manage,write,asyncHandler(async(req,res)=>{
 const input=z.object({enabled:z.boolean().optional(),boxesPerWave:z.number().int().min(0).max(30).nullable().optional(),note:z.string().trim().max(300).optional()}).strict().parse(req.body);
 res.json(await D.setCityRules(z.string().regex(/^[a-z]\d+$/).parse(req.params.id),input,{adminId:adminId(req)}));
}));
r.post('/drops/cities/:id/harvest',manage,write,asyncHandler(async(req,res)=>res.status(202).json(await D.reharvestCity(z.string().regex(/^[a-z]\d+$/).parse(req.params.id),{adminId:adminId(req)}))));
r.post('/drops/cities/:id/apply',manage,write,asyncHandler(async(req,res)=>res.json(await D.applyCity(z.string().regex(/^[a-z]\d+$/).parse(req.params.id),{adminId:adminId(req)}))));
r.put('/drops/autopilot',manage,write,asyncHandler(async(req,res)=>{
 const input=z.object({enabled:z.boolean()}).strict().parse(req.body);
 res.json(await D.setAutopilot(input.enabled,{admin:req.admin}));
}));
