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
import { communityChanged } from '../lib/communityRealtime.js';
import { COMMUNITY_RULES_VERSION, id, postInput, commentInput, eligible, publicContent, cleanImage, fail } from '../lib/community.js';
export const communityRouter=Router(), adminCommunityRouter=Router();
const r=communityRouter, a=adminCommunityRouter;
// Broadcast only an empty invalidation after a successful committed mutation.
const changes=(req,res,next)=>{if(!['GET','HEAD','OPTIONS'].includes(req.method))res.on('finish',()=>{if(res.statusCode<400)communityChanged();});next();};
r.use(changes);a.use(changes);
const write=rateLimit({windowMs:60000,limit:35,keyGenerator:req=>req.user.id,standardHeaders:true,legacyHeaders:false});
const parseCursor=value=>{ if(value===undefined)return null; const parts=z.string().max(90).parse(value).split('~'); return {date:new Date(z.iso.datetime().parse(parts[0])),id:id.parse(parts[1])}; };
const cursor=row=>row.createdAt.toISOString()+'~'+row.id;
const privateCache=(_req,res,next)=>{res.set('Cache-Control','private, no-store');next();};
const blocked=(viewer,author)=>Prisma.sql`NOT EXISTS (SELECT 1 FROM "CommunityBlock" b WHERE (b."userId"=${viewer} AND b."blockedId"=${author}) OR (b."blockedId"=${viewer} AND b."userId"=${author}))`;

const reactionStats=(postId,viewer)=>Prisma.sql`
 (SELECT COALESCE(jsonb_object_agg(x.emoji,x.total),'{}'::jsonb) FROM (SELECT COALESCE(v.emoji,CASE WHEN v.value=1 THEN 'like' ELSE 'dislike' END) emoji,count(*)::int total FROM "CommunityReaction" v WHERE v."postId"=${postId} GROUP BY 1) x) AS reactions,
 (SELECT COALESCE(v.emoji,CASE WHEN v.value=1 THEN 'like' ELSE 'dislike' END) FROM "CommunityReaction" v WHERE v."postId"=${postId} AND v."userId"=${viewer}) AS "myReaction"`;
async function member(userId,db=prisma) { return (await db.$queryRaw`SELECT * FROM "CommunityMember" WHERE "userId"=${userId}`)[0]; }
async function visiblePost(postId,userId,db=prisma,lock=false){
 const rows=await db.$queryRaw(Prisma.sql`SELECT p.*,m.alias FROM "CommunityPost" p JOIN "CommunityMember" m ON m."userId"=p."authorId" JOIN "User" u ON u.id=p."authorId"
 WHERE p.id=${postId} AND (p.status='PUBLISHED' OR p."authorId"=${userId}) AND NOT m.banned AND u.status='ACTIVE' AND u.gender='FEMALE'
 AND ${blocked(userId,Prisma.sql`p."authorId"`)} ${lock?Prisma.sql`FOR UPDATE OF p`:Prisma.empty}`);
 if(!rows[0])fail(404,'პოსტი აღარ არის ხელმისაწვდომი.');return rows[0];
}
async function notify(db,userId,actorId,postId,kind,eventKey,commentId=null,eventType=null){
 if(userId===actorId)return;
 await db.$executeRaw`INSERT INTO "CommunityNotification" (id,"userId","actorId","postId",kind,"eventKey","commentId","eventType") VALUES (${randomUUID()},${userId},${actorId},${postId},${kind},${eventKey},${commentId},${eventType}) ON CONFLICT ("eventKey") DO NOTHING`;
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
 const before=parseCursor(req.query.before), mine=req.query.mine==='true',limit=z.coerce.number().int().min(1).max(100).default(20).parse(req.query.limit);
 const rows=await prisma.$queryRaw(Prisma.sql`SELECT p.id,p.revision,p.body,p.topic,p.anonymous,p."authorId",p.status,p."createdAt",m.alias,(p.image IS NOT NULL) AS "hasImage",
 (SELECT count(*)::int FROM "CommunityReaction" v WHERE v."postId"=p.id AND v.value=1) AS likes,
 (SELECT count(*)::int FROM "CommunityReaction" v WHERE v."postId"=p.id AND v.value=-1) AS dislikes,
 (SELECT count(*)::int FROM "CommunityComment" c JOIN "CommunityMember" cm ON cm."userId"=c."authorId" WHERE c."postId"=p.id AND c.status='PUBLISHED' AND NOT cm.banned AND ${blocked(req.user.id,Prisma.sql`c."authorId"`)}) AS comments,
 (SELECT value FROM "CommunityReaction" v WHERE v."postId"=p.id AND v."userId"=${req.user.id}) AS reaction, ${reactionStats(Prisma.sql`p.id`,req.user.id)}
 FROM "CommunityPost" p JOIN "CommunityMember" m ON m."userId"=p."authorId" JOIN "User" u ON u.id=p."authorId"
 WHERE (p.status='PUBLISHED' OR p."authorId"=${req.user.id}) AND NOT m.banned AND u.status='ACTIVE' AND u.gender='FEMALE'
 AND ${blocked(req.user.id,Prisma.sql`p."authorId"`)}
 ${topic==='all'?Prisma.empty:Prisma.sql`AND p.topic=${topic}`}
 ${mine?Prisma.sql`AND p."authorId"=${req.user.id}`:Prisma.empty}
 ${before?Prisma.sql`AND (p."createdAt",p.id) < (${before.date},${before.id})`:Prisma.empty}
 ORDER BY p."createdAt" DESC,p.id DESC LIMIT ${limit+1}`);
 res.json({posts:rows.slice(0,limit).map(p=>publicContent(p,req.user.id)),next:rows.length>limit?cursor(rows[limit-1]):null});
}));
r.post('/posts',write,wrap(async(req,res)=>{
 const input=postInput.parse(req.body), image=await cleanImage(input.image), postId=randomUUID();
 const rows=await prisma.$queryRaw`INSERT INTO "CommunityPost" (id,"authorId",body,topic,anonymous,image,"requestId",status) VALUES (${postId},${req.user.id},${input.body},${input.topic},${input.anonymous},${image},${input.requestId},'PUBLISHED') ON CONFLICT ("authorId","requestId") DO UPDATE SET "requestId"=EXCLUDED."requestId" RETURNING id,status`;
 res.status(201).json({id:rows[0].id,status:rows[0].status});
}));
r.get('/posts/:id',wrap(async(req,res)=>{
 const p=await visiblePost(id.parse(req.params.id),req.user.id);
 const [counts]=await prisma.$queryRaw(Prisma.sql`SELECT
 (SELECT count(*)::int FROM "CommunityReaction" WHERE "postId"=${p.id} AND value=1) likes,
 (SELECT count(*)::int FROM "CommunityReaction" WHERE "postId"=${p.id} AND value=-1) dislikes,
 (SELECT value FROM "CommunityReaction" WHERE "postId"=${p.id} AND "userId"=${req.user.id}) reaction,
 (SELECT count(*)::int FROM "CommunityComment" c JOIN "CommunityMember" m ON m."userId"=c."authorId" WHERE c."postId"=${p.id} AND c.status='PUBLISHED' AND NOT m.banned AND ${blocked(req.user.id,Prisma.sql`c."authorId"`)}) comments, ${reactionStats(p.id,req.user.id)}`);
 res.json(publicContent({...p,...counts,hasImage:!!p.image},req.user.id));
}));
r.get('/posts/:id/image',wrap(async(req,res)=>{const p=await visiblePost(id.parse(req.params.id),req.user.id);if(!p.image)fail(404,'ფოტო ვერ მოიძებნა.');res.type('image/jpeg').send(Buffer.from(p.image));}));
r.get('/posts/:id/photo',wrap(async(req,res)=>{const p=await visiblePost(id.parse(req.params.id),req.user.id);if(!p.image)fail(404,'ფოტო ვერ მოიძებნა.');res.json({uri:'data:image/jpeg;base64,'+Buffer.from(p.image).toString('base64')});}));
r.delete('/posts/:id',write,wrap(async(req,res)=>{const n=await prisma.$executeRaw`DELETE FROM "CommunityPost" WHERE id=${id.parse(req.params.id)} AND "authorId"=${req.user.id}`;if(!n)fail(404,'პოსტი ვერ მოიძებნა.');res.json({ok:true});}));
r.patch('/posts/:id',write,wrap(async(req,res)=>{
 const postId=id.parse(req.params.id),input=z.object({body:z.string().trim().min(1).max(3000),topic:z.enum(['everyday','cycle','pregnancy','wellbeing']),image:z.string().max(1500000).nullable()}).strict().parse(req.body);
 const image=await cleanImage(input.image);
 // Anonymity is immutable: an edit must never reveal an earlier anonymous author.
 const rows=await prisma.$queryRaw`UPDATE "CommunityPost" SET revision=revision+1,body=${input.body},topic=${input.topic},image=${image},status=CASE WHEN status='HIDDEN' THEN 'HIDDEN' ELSE 'PUBLISHED' END,"updatedAt"=NOW() WHERE id=${postId} AND "authorId"=${req.user.id} RETURNING status`;
 if(!rows.length)fail(404,'პოსტი ვერ მოიძებნა.');res.json({ok:true,status:rows[0].status});
}));
r.put('/posts/:id/reaction',write,wrap(async(req,res)=>{
 const postId=id.parse(req.params.id);
 const input=z.union([z.object({emoji:z.enum(['like','love','care','haha','wow','sad','angry','dislike']).nullable()}).strict(),z.object({value:z.union([z.literal(-1),z.literal(0),z.literal(1)])}).strict()]).parse(req.body);
 const emoji='emoji' in input?input.emoji:input.value===0?null:input.value===1?'like':'dislike';
 await prisma.$transaction(async db=>{const p=await visiblePost(postId,req.user.id,db,true);if(p.status!=='PUBLISHED')fail(409,'პოსტი არ არის გამოქვეყნებული.');
 if(!emoji)await db.$executeRaw`DELETE FROM "CommunityReaction" WHERE "postId"=${postId} AND "userId"=${req.user.id}`;
 else {await db.$executeRaw`INSERT INTO "CommunityReaction" ("postId","userId",value,emoji) VALUES (${postId},${req.user.id},${emoji==='dislike'?-1:1},${emoji}) ON CONFLICT ("postId","userId") DO UPDATE SET value=EXCLUDED.value,emoji=EXCLUDED.emoji`;
 await notify(db,p.authorId,req.user.id,postId,emoji==='dislike'?'dislike':'like',`${postId}:${req.user.id}:reaction:${emoji}`);}});
 res.json({ok:true});
}));
r.get('/posts/:id/comments',wrap(async(req,res)=>{
 const postId=id.parse(req.params.id);await visiblePost(postId,req.user.id);
 const before=parseCursor(req.query.before),limit=z.coerce.number().int().min(1).max(100).default(30).parse(req.query.limit);
 const rows=await prisma.$queryRaw(Prisma.sql`SELECT c.id,c.revision,c.body,c.anonymous,c."authorId",c.status,c."createdAt",c."parentId",m.alias,
 (SELECT count(*)::int FROM "CommunityCommentLike" l WHERE l."commentId"=c.id) AS likes,
 EXISTS(SELECT 1 FROM "CommunityCommentLike" l WHERE l."commentId"=c.id AND l."userId"=${req.user.id}) AS liked,
 (SELECT CASE WHEN pc.anonymous THEN 'ანონიმური წევრი' ELSE pm.alias END FROM "CommunityComment" pc JOIN "CommunityMember" pm ON pm."userId"=pc."authorId" JOIN "User" pu ON pu.id=pc."authorId" WHERE pc.id=c."parentId" AND pc.status='PUBLISHED' AND NOT pm.banned AND pu.status='ACTIVE' AND pu.gender='FEMALE' AND ${blocked(req.user.id,Prisma.sql`pc."authorId"`)}) AS "replyTo"
 FROM "CommunityComment" c JOIN "CommunityMember" m ON m."userId"=c."authorId" JOIN "User" u ON u.id=c."authorId"
 WHERE c."postId"=${postId} AND (c.status='PUBLISHED' OR c."authorId"=${req.user.id}) AND NOT m.banned AND u.status='ACTIVE' AND u.gender='FEMALE' AND ${blocked(req.user.id,Prisma.sql`c."authorId"`)} ${before?Prisma.sql`AND (c."createdAt",c.id)<(${before.date},${before.id})`:Prisma.empty} ORDER BY c."createdAt" DESC,c.id DESC LIMIT ${limit+1}`);
 res.json({comments:rows.slice(0,limit).map(c=>publicContent(c,req.user.id)),next:rows.length>limit?cursor(rows[limit-1]):null});
}));
r.post('/posts/:id/comments',write,wrap(async(req,res)=>{
 const postId=id.parse(req.params.id),input=commentInput.parse(req.body);
 const result=await prisma.$transaction(async db=>{
  const p=await visiblePost(postId,req.user.id,db,true);if(p.status!=='PUBLISHED')fail(409,'პოსტი არ არის გამოქვეყნებული.');
  // Replies by an anonymous post's author must not accidentally identify her.
  const anonymous=input.anonymous || (p.authorId===req.user.id && p.anonymous);
  let parent=null;
  if(input.parentId){
   [parent]=await db.$queryRaw(Prisma.sql`SELECT c.* FROM "CommunityComment" c JOIN "CommunityMember" m ON m."userId"=c."authorId" JOIN "User" u ON u.id=c."authorId" WHERE c.id=${input.parentId} AND c."postId"=${postId} AND c.status='PUBLISHED' AND NOT m.banned AND u.status='ACTIVE' AND u.gender='FEMALE' AND ${blocked(req.user.id,Prisma.sql`c."authorId"`)} FOR UPDATE OF c`);
   if(!parent)fail(404,'კომენტარი აღარ არის ხელმისაწვდომი.');
  }
  const rows=await db.$queryRaw`INSERT INTO "CommunityComment" (id,"postId","authorId",body,anonymous,"requestId",status,"parentId") VALUES (${randomUUID()},${postId},${req.user.id},${input.body},${anonymous},${input.requestId},'PUBLISHED',${input.parentId||null}) ON CONFLICT ("authorId","requestId") DO UPDATE SET "requestId"=EXCLUDED."requestId" RETURNING id,status,"postId","parentId"`;
  const row=rows[0];
  if(row.postId!==postId||row.parentId!==(input.parentId||null))fail(409,'განაახლე კომენტარი და სცადე თავიდან.');
  if(row.status==='PUBLISHED'){
   await notify(db,p.authorId,req.user.id,postId,'comment',`${row.id}:comment`,row.id);
   if(parent&&parent.authorId!==p.authorId)await notify(db,parent.authorId,req.user.id,postId,'comment',`${row.id}:reply`,row.id,'reply');
  }
  return row;
 });
 res.status(201).json({id:result.id,status:result.status});
}));
r.put('/comments/:id/like',write,wrap(async(req,res)=>{
 const commentId=id.parse(req.params.id),{liked}=z.object({liked:z.boolean()}).strict().parse(req.body);
 await prisma.$transaction(async db=>{
  const [row]=await db.$queryRaw`SELECT * FROM "CommunityComment" WHERE id=${commentId}`;if(!row)fail(404,'კომენტარი აღარ არის ხელმისაწვდომი.');
  const post=await visiblePost(row.postId,req.user.id,db,true);if(post.status!=='PUBLISHED')fail(404,'პოსტი არ არის ხელმისაწვდომი.');
  const [allowed]=await db.$queryRaw(Prisma.sql`SELECT c.id FROM "CommunityComment" c JOIN "CommunityMember" m ON m."userId"=c."authorId" JOIN "User" u ON u.id=c."authorId" WHERE c.id=${commentId} AND c.status='PUBLISHED' AND NOT m.banned AND u.gender='FEMALE' AND u.status='ACTIVE' AND ${blocked(req.user.id,Prisma.sql`c."authorId"`)} FOR UPDATE OF c`);
  if(!allowed)fail(404,'კომენტარი აღარ არის ხელმისაწვდომი.');
  if(liked){await db.$executeRaw`INSERT INTO "CommunityCommentLike" ("commentId","userId") VALUES (${commentId},${req.user.id}) ON CONFLICT DO NOTHING`;await notify(db,row.authorId,req.user.id,row.postId,'like',`${commentId}:${req.user.id}:like`,commentId,'comment_like');}
  else await db.$executeRaw`DELETE FROM "CommunityCommentLike" WHERE "commentId"=${commentId} AND "userId"=${req.user.id}`;
 });res.json({ok:true});
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
 const rows=await prisma.$queryRaw(Prisma.sql`SELECT n.id,n."postId",COALESCE(n."eventType",n.kind) AS kind,n."commentId",n."readAt",n."createdAt" FROM "CommunityNotification" n JOIN "CommunityPost" p ON p.id=n."postId"
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
