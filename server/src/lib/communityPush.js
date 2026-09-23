import { prisma } from './prisma.js';
import { sendExpoPush } from './push.js';
import { notificationText } from './community.js';
let busy=false;
/** Durable outbox. Generic lock-screen text never includes names, photos or health content. */
export async function dispatchCommunityPush({db=prisma,send=sendExpoPush}={}){
 if(busy)return;busy=true;
 try {
  await db.$executeRaw`UPDATE "CommunityNotification" SET "pushState"='FAILED' WHERE "pushState"='SENDING' AND attempts>=5 AND "nextAttemptAt"<=NOW()`;
  const rows=await db.$queryRaw`UPDATE "CommunityNotification" SET "pushState"='SENDING',attempts=attempts+1,"nextAttemptAt"=NOW()+INTERVAL '5 minutes'
   WHERE id IN (SELECT id FROM "CommunityNotification" WHERE (("pushState"='PENDING' AND "nextAttemptAt"<=NOW()) OR ("pushState"='SENDING' AND "nextAttemptAt"<=NOW())) AND attempts<5 ORDER BY "createdAt" LIMIT 20 FOR UPDATE SKIP LOCKED) RETURNING *`;
  for(const row of rows){
   try {
    const [allowed]=await db.$queryRaw`SELECT 1 FROM "CommunityMember" m JOIN "User" u ON u.id=m."userId" JOIN "CommunityPost" p ON p.id=${row.postId}
     WHERE m."userId"=${row.userId} AND NOT m.banned AND m."pushEnabled" AND u.gender='FEMALE' AND u.status='ACTIVE' AND p.status='PUBLISHED'
     AND (${row.commentId||null}::text IS NULL OR EXISTS(SELECT 1 FROM "CommunityComment" c WHERE c.id=${row.commentId||null} AND c.status='PUBLISHED'))
     AND NOT EXISTS(SELECT 1 FROM "CommunityBlock" b WHERE (b."userId"=${row.userId} AND b."blockedId"=${row.actorId}) OR (b."blockedId"=${row.userId} AND b."userId"=${row.actorId}))`;
    const tokens=allowed?await db.pushToken.findMany({where:{userId:row.userId,active:true},select:{token:true}}):[];
    let state='SKIPPED';
    if(tokens.length){
     const result=await send(tokens.map(t=>t.token),{title:'MEDICARD • ქალების სივრცე',body:notificationText[row.eventType||row.kind],data:{route:`/community?post=${row.postId}`,notificationId:row.id}}, {fetchImpl:(url,options)=>fetch(url,{...options,signal:AbortSignal.timeout(15000)})});
     if(!result.sent)throw new Error('Push provider did not accept delivery');state='SENT';
    }
    await db.$executeRaw`UPDATE "CommunityNotification" SET "pushState"=${state} WHERE id=${row.id}`;
   }catch{
    await db.$executeRaw`UPDATE "CommunityNotification" SET "pushState"=${row.attempts>=5?'FAILED':'PENDING'},"nextAttemptAt"=NOW()+INTERVAL '2 minutes' WHERE id=${row.id}`;
   }
  }
 }finally{busy=false;}
}
export function startCommunityPush(){
 if(process.env.COMMUNITY_ENABLED==='false')return;
 const timer=setInterval(()=>void dispatchCommunityPush().catch(()=>console.warn('[community] outbox unavailable')),15000);timer.unref();
 return ()=>clearInterval(timer);
}
