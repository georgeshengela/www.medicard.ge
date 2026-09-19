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
r.get('/audit',view,asyncHandler(async(req,res)=>res.json({rows:await prisma.medipulsiAudit.findMany({orderBy:{createdAt:'desc'},...pagination(req.query)}),total:await prisma.medipulsiAudit.count()})));
