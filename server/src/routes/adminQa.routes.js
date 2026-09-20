import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { prisma } from '../lib/prisma.js';
import { requireAdmin } from '../middleware/adminAuth.js';
import { requireAdminCapability } from '../lib/adminCapabilities.js';
import { asyncHandler } from '../middleware/error.js';
import { RATE_LIMIT_VALIDATE } from '../lib/rateLimitKey.js';
import { CYCLE_QA_CASES, qaRunCreate, qaRunUpdate, qaCheckCreate, qaCheckUpdate, qaEvidenceInput, decodeQaEvidence, qaSummary, qaFail } from '../lib/qaWorkspace.js';
export const adminQaRouter=Router();
const r=adminQaRouter, key=z.string().uuid();
const view=requireAdminCapability('QA_VIEW'), manage=requireAdminCapability('QA_MANAGE');
const write=rateLimit({windowMs:60000,limit:100,standardHeaders:true,legacyHeaders:false,validate:RATE_LIMIT_VALIDATE});
r.use(requireAdmin,(req,res,next)=>{res.set('Cache-Control','private, no-store');next();});
const evidenceSelect={id:true,caption:true,mimeType:true,sha256:true,createdAt:true};
async function editableRun(tx,id){
 const run=await tx.qaRun.findUnique({where:{id}});
 if(!run)qaFail(404,'ტესტი ვერ მოიძებნა.');
 if(run.status!=='OPEN')qaFail(409,'ცვლილებისთვის ჯერ გახსენით ტესტირება.');
 return run;
}
r.get('/catalog',view,asyncHandler(async(req,res)=>res.json({cycle:CYCLE_QA_CASES})));
r.get('/runs',view,asyncHandler(async(req,res)=>{
 const offset=z.coerce.number().int().min(0).max(100000).default(0).parse(req.query.offset);
 const module=z.string().max(40).optional().parse(req.query.module),where=module?{module}:{};
 const [rows,total]=await Promise.all([prisma.qaRun.findMany({where,orderBy:{createdAt:'desc'},skip:offset,take:30,include:{checks:{select:{status:true}}}}),prisma.qaRun.count({where})]);
 res.json({rows:rows.map(({checks,...run})=>({...run,summary:qaSummary(checks)})),total});
}));
r.post('/runs',manage,write,asyncHandler(async(req,res)=>{
 const {template,...data}=qaRunCreate.parse(req.body);
 const run=await prisma.qaRun.create({data:{...data,createdBy:req.admin.id,checks:{create:template==='cycle'?CYCLE_QA_CASES:[]}}});
 res.status(201).json(run);
}));
r.get('/runs/:id',view,asyncHandler(async(req,res)=>{
 const run=await prisma.qaRun.findUnique({where:{id:key.parse(req.params.id)},include:{checks:{orderBy:[{stage:'asc'},{caseKey:'asc'}],include:{evidence:{select:evidenceSelect,orderBy:{createdAt:'asc'}}}}}});
 if(!run)qaFail(404,'ტესტი ვერ მოიძებნა.');
 res.json({...run,summary:qaSummary(run.checks)});
}));
r.patch('/runs/:id',manage,write,asyncHandler(async(req,res)=>{
 const id=key.parse(req.params.id),input=qaRunUpdate.parse(req.body);
 res.json(await prisma.$transaction(async tx=>{
  // Shared run lock serializes completion with all check/evidence writes.
  await tx.$queryRaw`SELECT "id" FROM "QaRun" WHERE "id"=${id} FOR UPDATE`;
  const run=await tx.qaRun.findUnique({where:{id},include:{checks:{select:{status:true}}}});
  if(!run)qaFail(404,'ტესტი ვერ მოიძებნა.');
  if(input.status==='COMPLETE'&&!qaSummary(run.checks).canComplete)qaFail(409,'დასრულებამდე მოაგვარეთ ჩავარდნილი, დაბლოკილი და შეუმოწმებელი ეტაპები.');
  const out=await tx.qaRun.updateMany({where:{id,revision:input.revision},data:{status:input.status,notes:input.notes,revision:{increment:1}}});
  if(!out.count)qaFail(409,'ტესტი შეიცვალა. განაახლეთ გვერდი.');
  return tx.qaRun.findUnique({where:{id}});
 }));
}));
r.post('/runs/:id/checks',manage,write,asyncHandler(async(req,res)=>{
 const runId=key.parse(req.params.id),data=qaCheckCreate.parse(req.body);
 res.status(201).json(await prisma.$transaction(async tx=>{
  await tx.$queryRaw`SELECT "id" FROM "QaRun" WHERE "id"=${runId} FOR UPDATE`;
  await editableRun(tx,runId);
  return tx.qaCheck.create({data:{...data,runId,updatedBy:req.admin.id}});
 }));
}));
r.patch('/checks/:id',manage,write,asyncHandler(async(req,res)=>{
 const id=key.parse(req.params.id),input=qaCheckUpdate.parse(req.body);
 res.json(await prisma.$transaction(async tx=>{
  const check=await tx.qaCheck.findUnique({where:{id}});
  if(!check)qaFail(404,'ეტაპი ვერ მოიძებნა.');
  await tx.$queryRaw`SELECT "id" FROM "QaRun" WHERE "id"=${check.runId} FOR UPDATE`;
  await editableRun(tx,check.runId);
  const {revision,...data}=input;
  const result=await tx.qaCheck.updateMany({where:{id,revision},data:{...data,updatedBy:req.admin.id,revision:{increment:1}}});
  if(!result.count)qaFail(409,'ეტაპი შეიცვალა. განაახლეთ გვერდი, რომ სხვისი ცვლილება არ გადაწეროთ.');
  return tx.qaCheck.findUnique({where:{id}});
 }));
}));
r.post('/checks/:id/evidence',manage,write,asyncHandler(async(req,res)=>{
 const id=key.parse(req.params.id),data=decodeQaEvidence(qaEvidenceInput.parse(req.body));
 res.status(201).json(await prisma.$transaction(async tx=>{
  const check=await tx.qaCheck.findUnique({where:{id}});
  if(!check)qaFail(404,'ეტაპი ვერ მოიძებნა.');
  await tx.$queryRaw`SELECT "id" FROM "QaRun" WHERE "id"=${check.runId} FOR UPDATE`;
  await editableRun(tx,check.runId);
  if(await tx.qaEvidence.count({where:{checkId:id}})>=20)qaFail(409,'ერთ ეტაპს მაქსიმუმ 20 სქრინი შეიძლება ჰქონდეს.');
  return tx.qaEvidence.create({data:{...data,id:randomUUID(),checkId:id,createdBy:req.admin.id},select:evidenceSelect});
 }));
}));
r.get('/evidence/:id',view,asyncHandler(async(req,res)=>{
 const row=await prisma.qaEvidence.findUnique({where:{id:key.parse(req.params.id)}});
 if(!row)qaFail(404,'სქრინი ვერ მოიძებნა.');
 res.set({'Content-Type':row.mimeType,'X-Content-Type-Options':'nosniff','Content-Disposition':'inline; filename="qa-screenshot"'});
 res.send(Buffer.from(row.bytes));
}));
