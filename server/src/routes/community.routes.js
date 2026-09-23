import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/adminAuth.js';
import { requireAdminCapability } from '../lib/adminCapabilities.js';
import { asyncHandler as wrap } from '../middleware/error.js';
import { COMMUNITY_RULES_VERSION, id, postInput, commentInput, eligible, publicContent, cleanImage, fail } from '../lib/community.js';
export const communityRouter=Router(), adminCommunityRouter=Router();
const r=communityRouter, a=adminCommunityRouter;
const write=rateLimit({windowMs:60000,limit:35,keyGenerator:req=>req.user.id,standardHeaders:true,legacyHeaders:false});
const parseCursor=value=>{ if(value===undefined)return null; const parts=z.string().max(90).parse(value).split('~'); return {date:new Date(z.iso.datetime().parse(parts[0])),id:id.parse(parts[1])}; };
const cursor=row=>row.createdAt.toISOString()+'~'+row.id;
const privateCache=(_req,res,next)=>{res.set('Cache-Control','private, no-store');next();};
const blocked=(viewer,author)=>Prisma.sql`NOT EXISTS (SELECT 1 FROM "CommunityBlock" b WHERE (b."userId"=${viewer} AND b."blockedId"=${author}) OR (b."blockedId"=${viewer} AND b."userId"=${author}))`;
async function member(userId,db=prisma) { return (await db.$queryRaw`SELECT * FROM "CommunityMember" WHERE "userId"=${userId}`)[0]; }
async function visiblePost(postId,userId,db=prisma,lock=false){
 const rows=await db.$queryRaw(Prisma.sql`SELECT p.*,m.alias FROM "CommunityPost" p JOIN "CommunityMember" m ON m."userId"=p."authorId" JOIN "User" u ON u.id=p."authorId"
 WHERE p.id=${postId} AND (p.status='PUBLISHED' OR p."authorId"=${userId}) AND NOT m.banned AND u.status='ACTIVE' AND u.gender='FEMALE'
 AND ${blocked(userId,Prisma.sql`p."authorId"`)} ${lock?Prisma.sql`FOR UPDATE OF p`:Prisma.empty}`);
 if(!rows[0])fail(404,'პოსტი აღარ არის ხელმისაწვდომი.');return rows[0];
}
async function notify(db,userId,actorId,postId,kind,eventKey,commentId=null){
 if(userId===actorId)return;
 await db.$executeRaw`INSERT INTO "CommunityNotification" (id,"userId","actorId","postId",kind,"eventKey","commentId") VALUES (${randomUUID()},${userId},${actorId},${postId},${kind},${eventKey},${commentId}) ON CONFLICT ("eventKey") DO NOTHING`;
}
r.use(requireAuth,privateCache,wrap(async(req,_res,next)=>{
 if(!eligible(req.user))fail(403,'ეს სივრცე ქალებისთვისაა. გადაამოწმე ანგარიშის პროფილი.');
 req.community=await member(req.user.id);
 if(req.community?.banned)fail(403,'სივრცეზე წვდომა შეჩერებულია. მოგვწერე support@medicard.ge.');next();
}));
r.get('/membership',wrap(async(req,res)=>res.json({member:req.community?{alias:req.community.alias,pushEnabled:req.community.pushEnabled}:null,rulesVersion:COMMUNITY_RULES_VERSION})));
r.post('/membership',write,wrap(async(req,res)=>{
 const input=z.object({alias:z.string().trim().min(2).max(40),rulesVersion:z.literal(COMMUNITY_RULES_VERSION)}).strict().parse(req.body);
 await prisma.$executeRaw`INSERT INTO "CommunityMember" ("userId",alias,"rulesVersion") VALUES (${req.user.id},${input.alias},${input.rulesVersion}) ON CONFLICT ("userId") DO UPDATE SET alias=EXCLUDED.alias,"rulesVersion"=EXCLUDED."rulesVersion"`;
 res.json({ok:true});
}));
r.use((req,res,next)=>req.community?next():res.status(403).json({error:'სივრცეში შესასვლელად გაეცანი წესებს.'}));
r.patch('/preferences',write,wrap(async(req,res)=>{const {pushEnabled}=z.object({pushEnabled:z.boolean()}).strict().parse(req.body);await prisma.$executeRaw`UPDATE "CommunityMember" SET "pushEnabled"=${pushEnabled} WHERE "userId"=${req.user.id}`;res.json({ok:true});}));
r.get('/posts',wrap(async(req,res)=>{
 const topic=z.enum(['all','everyday','cycle','pregnancy','wellbeing']).default('all').parse(req.query.topic);
 const before=parseCursor(req.query.before), mine=req.query.mine==='true';
 const rows=await prisma.$queryRaw(Prisma.sql`SELECT p.id,p.revision,p.body,p.topic,p.anonymous,p."authorId",p.status,p."createdAt",m.alias,(p.image IS NOT NULL) AS "hasImage",
 (SELECT count(*)::int FROM "CommunityReaction" v WHERE v."postId"=p.id AND v.value=1) AS likes,
 (SELECT count(*)::int FROM "CommunityReaction" v WHERE v."postId"=p.id AND v.value=-1) AS dislikes,
 (SELECT count(*)::int FROM "CommunityComment" c JOIN "CommunityMember" cm ON cm."userId"=c."authorId" WHERE c."postId"=p.id AND c.status='PUBLISHED' AND NOT cm.banned AND ${blocked(req.user.id,Prisma.sql`c."authorId"`)}) AS comments,
 (SELECT value FROM "CommunityReaction" v WHERE v."postId"=p.id AND v."userId"=${req.user.id}) AS reaction
 FROM "CommunityPost" p JOIN "CommunityMember" m ON m."userId"=p."authorId" JOIN "User" u ON u.id=p."authorId"
 WHERE (p.status='PUBLISHED' OR p."authorId"=${req.user.id}) AND NOT m.banned AND u.status='ACTIVE' AND u.gender='FEMALE'
 AND ${blocked(req.user.id,Prisma.sql`p."authorId"`)}
 ${topic==='all'?Prisma.empty:Prisma.sql`AND p.topic=${topic}`}
 ${mine?Prisma.sql`AND p."authorId"=${req.user.id}`:Prisma.empty}
 ${before?Prisma.sql`AND (p."createdAt",p.id) < (${before.date},${before.id})`:Prisma.empty}
 ORDER BY p."createdAt" DESC,p.id DESC LIMIT 21`);
 res.json({posts:rows.slice(0,20).map(p=>publicContent(p,req.user.id)),next:rows.length>20?cursor(rows[19]):null});
}));
r.post('/posts',write,wrap(async(req,res)=>{
 const input=postInput.parse(req.body), image=await cleanImage(input.image), postId=randomUUID();
 const rows=await prisma.$queryRaw`INSERT INTO "CommunityPost" (id,"authorId",body,topic,anonymous,image,"requestId") VALUES (${postId},${req.user.id},${input.body},${input.topic},${input.anonymous},${image},${input.requestId}) ON CONFLICT ("authorId","requestId") DO UPDATE SET "requestId"=EXCLUDED."requestId" RETURNING id`;
 res.status(201).json({id:rows[0].id,status:'PENDING'});
}));
r.get('/posts/:id',wrap(async(req,res)=>{
 const p=await visiblePost(id.parse(req.params.id),req.user.id);
 const [counts]=await prisma.$queryRaw(Prisma.sql`SELECT
 (SELECT count(*)::int FROM "CommunityReaction" WHERE "postId"=${p.id} AND value=1) likes,
 (SELECT count(*)::int FROM "CommunityReaction" WHERE "postId"=${p.id} AND value=-1) dislikes,
 (SELECT value FROM "CommunityReaction" WHERE "postId"=${p.id} AND "userId"=${req.user.id}) reaction,
 (SELECT count(*)::int FROM "CommunityComment" c JOIN "CommunityMember" m ON m."userId"=c."authorId" WHERE c."postId"=${p.id} AND c.status='PUBLISHED' AND NOT m.banned AND ${blocked(req.user.id,Prisma.sql`c."authorId"`)}) comments`);
 res.json(publicContent({...p,...counts,hasImage:!!p.image},req.user.id));
}));
r.get('/posts/:id/image',wrap(async(req,res)=>{const p=await visiblePost(id.parse(req.params.id),req.user.id);if(!p.image)fail(404,'ფოტო ვერ მოიძებნა.');res.type('image/jpeg').send(Buffer.from(p.image));}));
r.get('/posts/:id/photo',wrap(async(req,res)=>{const p=await visiblePost(id.parse(req.params.id),req.user.id);if(!p.image)fail(404,'ფოტო ვერ მოიძებნა.');res.json({uri:'data:image/jpeg;base64,'+Buffer.from(p.image).toString('base64')});}));
r.delete('/posts/:id',write,wrap(async(req,res)=>{const n=await prisma.$executeRaw`DELETE FROM "CommunityPost" WHERE id=${id.parse(req.params.id)} AND "authorId"=${req.user.id}`;if(!n)fail(404,'პოსტი ვერ მოიძებნა.');res.json({ok:true});}));
r.patch('/posts/:id',write,wrap(async(req,res)=>{
 const postId=id.parse(req.params.id),input=z.object({body:z.string().trim().min(1).max(3000),topic:z.enum(['everyday','cycle','pregnancy','wellbeing']),image:z.string().max(1500000).nullable()}).strict().parse(req.body);
 const image=await cleanImage(input.image);
 // Anonymity is immutable: an edit must never reveal an earlier anonymous author.
 const n=await prisma.$executeRaw`UPDATE "CommunityPost" SET revision=revision+1,body=${input.body},topic=${input.topic},image=${image},status='PENDING',"updatedAt"=NOW() WHERE id=${postId} AND "authorId"=${req.user.id}`;
 if(!n)fail(404,'პოსტი ვერ მოიძებნა.');res.json({ok:true,status:'PENDING'});
}));
r.put('/posts/:id/reaction',write,wrap(async(req,res)=>{
 const postId=id.parse(req.params.id),{value}=z.object({value:z.union([z.literal(-1),z.literal(0),z.literal(1)])}).strict().parse(req.body);
 await prisma.$transaction(async db=>{const p=await visiblePost(postId,req.user.id,db,true);if(p.status!=='PUBLISHED')fail(409,'პოსტი ჯერ მოწმდება.');
 if(value===0)await db.$executeRaw`DELETE FROM "CommunityReaction" WHERE "postId"=${postId} AND "userId"=${req.user.id}`;
 else {await db.$executeRaw`INSERT INTO "CommunityReaction" ("postId","userId",value) VALUES (${postId},${req.user.id},${value}) ON CONFLICT ("postId","userId") DO UPDATE SET value=EXCLUDED.value`;
 await notify(db,p.authorId,req.user.id,postId,value===1?'like':'dislike',`${postId}:${req.user.id}:reaction:${value}`);}});
 res.json({ok:true});
}));
r.get('/posts/:id/comments',wrap(async(req,res)=>{
 const postId=id.parse(req.params.id);await visiblePost(postId,req.user.id);
 const before=parseCursor(req.query.before);
 const rows=await prisma.$queryRaw(Prisma.sql`SELECT c.id,c.body,c.anonymous,c."authorId",c.status,c."createdAt",m.alias FROM "CommunityComment" c JOIN "CommunityMember" m ON m."userId"=c."authorId" JOIN "User" u ON u.id=c."authorId"
 WHERE c."postId"=${postId} AND (c.status='PUBLISHED' OR c."authorId"=${req.user.id}) AND NOT m.banned AND u.status='ACTIVE' AND u.gender='FEMALE' AND ${blocked(req.user.id,Prisma.sql`c."authorId"`)} ${before?Prisma.sql`AND (c."createdAt",c.id)<(${before.date},${before.id})`:Prisma.empty} ORDER BY c."createdAt" DESC,c.id DESC LIMIT 31`);
 res.json({comments:rows.slice(0,30).map(c=>publicContent(c,req.user.id)),next:rows.length>30?cursor(rows[29]):null});
}));
r.post('/posts/:id/comments',write,wrap(async(req,res)=>{
 const postId=id.parse(req.params.id),input=commentInput.parse(req.body);
 const p=await visiblePost(postId,req.user.id);if(p.status!=='PUBLISHED')fail(409,'პოსტი ჯერ მოწმდება.');
 // Anonymous authors cannot accidentally identify themselves through a named reply.
 const anonymous=input.anonymous || (p.authorId===req.user.id && p.anonymous);
 const rows=await prisma.$queryRaw`INSERT INTO "CommunityComment" (id,"postId","authorId",body,anonymous,"requestId") VALUES (${randomUUID()},${postId},${req.user.id},${input.body},${anonymous},${input.requestId}) ON CONFLICT ("authorId","requestId") DO UPDATE SET "requestId"=EXCLUDED."requestId" RETURNING id`;
 res.status(201).json({id:rows[0].id,status:'PENDING'});
}));
r.delete('/comments/:id',write,wrap(async(req,res)=>{const n=await prisma.$executeRaw`DELETE FROM "CommunityComment" WHERE id=${id.parse(req.params.id)} AND "authorId"=${req.user.id}`;if(!n)fail(404,'კომენტარი ვერ მოიძებნა.');res.json({ok:true});}));
async function target(req){
 const kind=z.enum(['posts','comments']).parse(req.params.kind), targetId=id.parse(req.params.id);
 if(kind==='posts')return {row:await visiblePost(targetId,req.user.id),kind};
 const rows=await prisma.$queryRaw`SELECT * FROM "CommunityComment" WHERE id=${targetId} AND status='PUBLISHED'`;
 if(!rows[0])fail(404,'ჩანაწერი ვერ მოიძებნა.');await visiblePost(rows[0].postId,req.user.id);
 if(!(await prisma.$queryRaw(Prisma.sql`SELECT 1 WHERE ${blocked(req.user.id,rows[0].authorId)}`)).length)fail(404,'ჩანაწერი ვერ მოიძებნა.');return {row:rows[0],kind};
}
r.post('/:kind/:id/report',write,wrap(async(req,res)=>{
 const {row,kind}=await target(req),{reason}=z.object({reason:z.enum(['harassment','privacy','misinformation','spam','other'])}).strict().parse(req.body);
 await prisma.$executeRaw`INSERT INTO "CommunityReport" (id,"userId","postId","commentId",reason) VALUES (${randomUUID()},${req.user.id},${kind==='posts'?row.id:null},${kind==='comments'?row.id:null},${reason}) ON CONFLICT DO NOTHING`;res.json({ok:true});
}));
r.post('/:kind/:id/block',write,wrap(async(req,res)=>{const {row}=await target(req);if(row.authorId===req.user.id)fail(400,'საკუთარ თავს ვერ დაბლოკავ.');await prisma.$executeRaw`INSERT INTO "CommunityBlock" (id,"userId","blockedId") VALUES (${randomUUID()},${req.user.id},${row.authorId}) ON CONFLICT DO NOTHING`;res.json({ok:true});}));
r.get('/blocks',wrap(async(req,res)=>res.json(await prisma.$queryRaw`SELECT id,"createdAt" FROM "CommunityBlock" WHERE "userId"=${req.user.id} ORDER BY "createdAt" DESC`)));
r.delete('/blocks/:id',write,wrap(async(req,res)=>{await prisma.$executeRaw`DELETE FROM "CommunityBlock" WHERE id=${id.parse(req.params.id)} AND "userId"=${req.user.id}`;res.json({ok:true});}));
r.get('/notifications',wrap(async(req,res)=>{
 const rows=await prisma.$queryRaw(Prisma.sql`SELECT n.id,n."postId",n.kind,n."readAt",n."createdAt" FROM "CommunityNotification" n JOIN "CommunityPost" p ON p.id=n."postId"
 WHERE n."userId"=${req.user.id} AND p.status='PUBLISHED' AND (n."commentId" IS NULL OR EXISTS(SELECT 1 FROM "CommunityComment" nc WHERE nc.id=n."commentId" AND nc.status='PUBLISHED')) AND (n."actorId" IS NULL OR ${blocked(req.user.id,Prisma.sql`n."actorId"`)}) ORDER BY n."createdAt" DESC LIMIT 100`);res.json(rows);
}));
r.put('/notifications/:id/read',wrap(async(req,res)=>{await prisma.$executeRaw`UPDATE "CommunityNotification" SET "readAt"=NOW() WHERE id=${id.parse(req.params.id)} AND "userId"=${req.user.id}`;res.json({ok:true});}));

// Moderation does not expose anonymous identities by default. Every mutation is audited transactionally.
a.use(requireAdmin,privateCache,requireAdminCapability('COMMUNITY_VIEW'));
const manage=requireAdminCapability('COMMUNITY_MANAGE');
a.get('/overview',wrap(async(_req,res)=>{
 const counts=await prisma.$queryRaw`SELECT (SELECT count(*)::int FROM "CommunityMember") members,(SELECT count(*)::int FROM "CommunityPost" WHERE status='PENDING') pending,(SELECT count(*)::int FROM "CommunityReport" WHERE NOT resolved) reports,(SELECT count(*)::int FROM "CommunityNotification" WHERE "pushState"='FAILED') "failedPushes"`;
 res.json(counts[0]);
}));
a.get('/members',wrap(async(req,res)=>{
 const offset=z.coerce.number().int().min(0).max(100000).default(0).parse(req.query.offset);
 res.json(await prisma.$queryRaw`SELECT "userId" AS id,alias,banned,"pushEnabled","createdAt" FROM "CommunityMember" ORDER BY "createdAt" DESC LIMIT 100 OFFSET ${offset}`);
}));
a.post('/members/:id/moderate',manage,wrap(async(req,res)=>{
 const memberId=id.parse(req.params.id),{action,reason}=z.object({action:z.enum(['ban','unban']),reason:z.string().trim().min(3).max(500)}).strict().parse(req.body);
 await prisma.$transaction(async db=>{const count=await db.$executeRaw`UPDATE "CommunityMember" SET banned=${action==='ban'} WHERE "userId"=${memberId}`;if(!count)fail(404,'წევრი ვერ მოიძებნა.');await audit(db,req,action,memberId,reason);});res.json({ok:true});
}));
a.get('/content',wrap(async(req,res)=>{
 const status=z.enum(['PENDING','PUBLISHED','HIDDEN']).default('PENDING').parse(req.query.status);
 const offset=z.coerce.number().int().min(0).max(100000).default(0).parse(req.query.offset);
 const rows=await prisma.$queryRaw`SELECT p.id,p.revision,p.body,p.anonymous,p.status,p."createdAt",(p.image IS NOT NULL) AS "hasImage",'posts' AS kind,m.alias,m.banned FROM "CommunityPost" p JOIN "CommunityMember" m ON m."userId"=p."authorId" WHERE p.status=${status}
 UNION ALL SELECT c.id,c.revision,c.body,c.anonymous,c.status,c."createdAt",FALSE AS "hasImage",'comments' AS kind,m.alias,m.banned FROM "CommunityComment" c JOIN "CommunityMember" m ON m."userId"=c."authorId" WHERE c.status=${status} ORDER BY "createdAt" ASC LIMIT 100 OFFSET ${offset}`;
 res.json(rows.map(({alias,...p})=>({...p,author:p.anonymous?'ანონიმური წევრი':alias})));
}));
a.get('/posts/:id/image',wrap(async(req,res)=>{const rows=await prisma.$queryRaw`SELECT image FROM "CommunityPost" WHERE id=${id.parse(req.params.id)}`;if(!rows[0]?.image)fail(404,'ფოტო ვერ მოიძებნა.');res.type('image/jpeg').send(Buffer.from(rows[0].image));}));
a.get('/reports',wrap(async(_req,res)=>res.json(await prisma.$queryRaw`SELECT r.id,r."postId",r."commentId",r.reason,r.resolved,r."createdAt",COALESCE(p.body,c.body) AS body,COALESCE(p.revision,c.revision) AS revision FROM "CommunityReport" r LEFT JOIN "CommunityPost" p ON p.id=r."postId" LEFT JOIN "CommunityComment" c ON c.id=r."commentId" WHERE NOT resolved ORDER BY r."createdAt" LIMIT 100`)));
a.post('/reports/:id/resolve',manage,wrap(async(req,res)=>{await prisma.$transaction(async db=>{await db.$executeRaw`UPDATE "CommunityReport" SET resolved=TRUE WHERE id=${id.parse(req.params.id)}`;await audit(db,req,'resolve',req.params.id,'Reviewed report');});res.json({ok:true});}));
async function audit(db,req,action,targetId,reason){await db.$executeRaw`INSERT INTO "CommunityAudit" (id,"adminId",action,"targetId",reason) VALUES (${randomUUID()},${req.admin.id},${action},${targetId},${reason})`;}
a.post('/:kind/:id/moderate',manage,wrap(async(req,res)=>{
 const kind=z.enum(['posts','comments']).parse(req.params.kind),targetId=id.parse(req.params.id),{action,reason,revision}=z.object({revision:z.number().int().min(0).optional(),action:z.enum(['approve','hide','ban','unban','delete']),reason:z.string().trim().min(3).max(500)}).strict().parse(req.body);
 const table=kind==='posts'?Prisma.sql`"CommunityPost"`:Prisma.sql`"CommunityComment"`;
 await prisma.$transaction(async db=>{
 const rows=await db.$queryRaw(Prisma.sql`SELECT * FROM ${table} WHERE id=${targetId} FOR UPDATE`),row=rows[0];if(!row)fail(404,'ჩანაწერი ვერ მოიძებნა.');
 if(['approve','hide','delete'].includes(action)&&revision!==row.revision)fail(409,'ჩანაწერი შეიცვალა. განაახლეთ სია და თავიდან შეამოწმეთ.');
 if(action==='ban'||action==='unban')await db.$executeRaw`UPDATE "CommunityMember" SET banned=${action==='ban'} WHERE "userId"=${row.authorId}`;
 else if(action==='delete'){await db.$executeRaw(Prisma.sql`DELETE FROM ${table} WHERE id=${targetId}`);}
 else {
 const status=action==='approve'?'PUBLISHED':'HIDDEN';await db.$executeRaw(Prisma.sql`UPDATE ${table} SET status=${status} WHERE id=${targetId}`);
 if(action==='approve'&&row.status!=='PUBLISHED'){
  const postId=kind==='posts'?targetId:row.postId;
  await notify(db,row.authorId,null,postId,'approved',`${kind}:${targetId}:approved`,kind==='comments'?targetId:null);
  if(kind==='comments'){const [p]=await db.$queryRaw`SELECT "authorId" FROM "CommunityPost" WHERE id=${postId}`;await notify(db,p.authorId,row.authorId,postId,'comment',`${targetId}:comment`,targetId);}
 }}await audit(db,req,action,targetId,reason);
 });res.json({ok:true});
}));
a.get('/audit',wrap(async(_req,res)=>res.json(await prisma.$queryRaw`SELECT * FROM "CommunityAudit" ORDER BY "createdAt" DESC LIMIT 100`)));
