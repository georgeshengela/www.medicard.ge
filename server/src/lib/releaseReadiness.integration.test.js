import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

// Never initialize a database client until the exact disposable database is verified.
const enabled = process.env.MEDICARD_RELEASE_TEST === '1';
if (enabled) {
  const url = new URL(process.env.DATABASE_URL || '');
  assert.equal(url.hostname, '127.0.0.1'); assert.equal(url.port, '55436'); assert.equal(url.pathname, '/medicard_release_audit');
}
test('release: real PostgreSQL consent, free access, location and account isolation', { skip: !enabled }, async t => {
  const { prisma } = await import('./prisma.js');
  const consent = await import('./aiConsent.js');
  const usage = await import('./usage.js');
  const { upsertUserLocation, getUserLocationSnapshot } = await import('./userLocation.js');
  const { deleteUserAccount } = await import('./deleteUser.js');
  const { consentedAiFetch } = await import('./consentedAiFetch.js');
  const { enforceAiQuota } = await import('../middleware/aiLimiter.js');
  const { EventEmitter } = await import('node:events');
  const { isFreeConsumerRelease } = await import('./consumerAccess.js');
  const marker=randomUUID();
  const pkg=await prisma.package.create({data:{code:`AUDIT-${marker}`,nameKa:'სატესტო',nameEn:'Test',descriptionKa:'Synthetic',features:{doctorChat:false},dailyAiLimit:1,monthlyAiLimit:1,priceGel:49}});
  const users=await Promise.all(['A','B'].map(letter=>prisma.user.create({data:{email:`release-${letter}-${marker}@medicard.test`,passwordHash:'not-a-login-hash',fullName:`Synthetic ${letter}`,packageId:pkg.id,packageExpiresAt:new Date('2020-01-01'),healthProfile:{create:{completedAt:new Date()}}}})));
  const [a,b]=users;
  const realFetch=globalThis.fetch;
  globalThis.fetch=async()=>{throw new Error('External network forbidden in release integration test');};
  t.after(async()=>{
    globalThis.fetch=realFetch;
    for(const user of users) { await prisma.$executeRaw`DELETE FROM "UserLocation" WHERE "userId"=${user.id}`; await prisma.user.deleteMany({where:{id:user.id}}); }
    await prisma.package.delete({where:{id:pkg.id}}); await prisma.$disconnect();
  });
  await t.test('malformed release configuration fails to free access',()=>{
    for(const config of [null,{}, {mode:'paid'}, {mode:'paid',storeBillingReady:true}, {mode:'paid',storeBillingReady:true,reviewApproved:'true'}]) assert.equal(isFreeConsumerRelease(config),true);
  });
  await t.test('old exhausted/expired paid plan is free without changing financial history',async()=>{
    const resetAt=new Date('2030-01-01');
    await prisma.periodUsage.create({data:{userId:a.id,periodKey:usage.ROLLING_DAILY_KEY,count:999,resetAt,notifyAt:resetAt}});
    const view=await usage.getUsage(a.id); assert.equal(view.unlimited,true); assert.equal(view.exceeded,false); assert.equal(view.resetAt,null);
    const held=await Promise.all(Array.from({length:6},()=>usage.reserveAiCredit(a.id)));
    assert.equal(held.filter(x=>x.ok).length,2); assert.ok(held.filter(x=>!x.ok).every(x=>x.reason==='AI_BUSY'));
    await usage.commitAiCredit(a.id); await usage.releaseAiCredit(a.id);
    const row=await prisma.periodUsage.findUnique({where:{userId_periodKey:{userId:a.id,periodKey:usage.ROLLING_DAILY_KEY}}});
    assert.equal(row.count,999);assert.equal(row.reserved,0);assert.equal(row.resetAt.toISOString(),resetAt.toISOString());
    const same=await prisma.user.findUnique({where:{id:a.id}});assert.equal(same.packageId,pkg.id);assert.equal(same.packageExpiresAt.toISOString(),a.packageExpiresAt.toISOString());
  });
  await t.test('close/finish racing completion settles one slot and retains another request',async()=>{
    usage.resetAiStartWindowForTests();
    const req={user:{id:a.id}}, res=new EventEmitter(); let advanced=false;
    await enforceAiQuota(req,res,error=>{if(error)throw error;advanced=true;});assert.equal(advanced,true);
    const other=await usage.reserveAiCredit(a.id);assert.equal(other.ok,true);
    let unblock;
    const delay=new Promise(resolve=>{unblock=resolve;});
    const completion=req.settleAiOperation(async()=>{await delay;return usage.commitAiCredit(a.id);});
    res.emit('close');res.emit('finish');unblock(); await completion;await req.releaseAiCredit();
    const row=await prisma.periodUsage.findUnique({where:{userId_periodKey:{userId:a.id,periodKey:usage.ROLLING_DAILY_KEY}}});assert.equal(row.reserved,1);
    await usage.releaseAiCredit(a.id);
  });
  await t.test('accept, revoke, version refresh and B account are authoritative at every send',async()=>{
    assert.equal((await consent.readAiConsent(a.id)).accepted,false);
    await assert.rejects(()=>consent.assertAiConsent(a.id),{code:'AI_CONSENT_REQUIRED'});
    await consent.recordAiConsent(a.id,{version:consent.AI_CONSENT_VERSION,decision:'accepted'});
    let sends=0;
    const guarded=consentedAiFetch('evidencemd',{transport:async()=>{sends++;return new Response('{}');}});
    await consent.withAiAccount(a.id,()=>guarded('https://evidencemd.ai/api/v1/chat/completions',{method:'POST',body:'{}'}));
    await consent.recordAiConsent(a.id,{version:consent.AI_CONSENT_VERSION,decision:'revoked'});
    await assert.rejects(()=>consent.withAiAccount(a.id,()=>guarded('https://evidencemd.ai/api/v1/chat/completions',{method:'POST',body:'{}'})),{code:'AI_CONSENT_REQUIRED'});
    await assert.rejects(()=>consent.assertAiConsent(b.id),{code:'AI_CONSENT_REQUIRED'});
    assert.equal(sends,1);
    await prisma.$executeRaw`UPDATE "UserAiConsent" SET "version"='old', "decision"='accepted' WHERE "userId"=${a.id}`;
    assert.equal((await consent.readAiConsent(a.id)).accepted,false);
    const events=await prisma.$queryRaw`SELECT "decision" FROM "AiConsentEvent" WHERE "userId"=${a.id} ORDER BY "createdAt"`;
    assert.deepEqual(events.map(e=>e.decision),['accepted','revoked']);
  });
  await t.test('fresh worldwide GPS works with foreign timezone; stale/malformed fixes preserve location',async()=>{
    const fresh=()=>Date.now();
    await upsertUserLocation(a.id,{source:'grant',enabled:true,lat:50.6326,lng:5.5797,fixAt:fresh(),timezone:'Asia/Tbilisi',place:{countryCode:'BE',countryKa:'ბელგია',cityKa:'ლიეჟი'}});
    const result=await upsertUserLocation(a.id,{source:'grant',enabled:true,lat:41.7151,lng:44.8271,fixAt:fresh(),timezone:'Europe/Brussels',place:{countryCode:'GE',countryKa:'საქართველო',cityKa:'თბილისი'}});
    assert.equal(result.location.cityKa,'თბილისი');assert.equal(result.profile.extraAnswers.location.cityKa,'თბილისი');
    await assert.rejects(()=>upsertUserLocation(a.id,{source:'grant',lat:50,lng:5,fixAt:Date.now()-3600000}),{code:'LOCATION_FIX_REQUIRED'});
    await assert.rejects(()=>upsertUserLocation(a.id,{source:'grant',lat:999,lng:5,fixAt:fresh()}),{code:'LOCATION_FIX_REQUIRED'});
    assert.equal((await getUserLocationSnapshot(a.id)).location.cityKa,'თბილისი');
    assert.equal((await getUserLocationSnapshot(b.id)).location.cityKa,null);
    const live=await upsertUserLocation(a.id,{source:'live',lat:1,lng:1,fixAt:fresh()});assert.equal(live.location.cityKa,'თბილისი');
  });
  await t.test('account deletion removes consent/medical logs and redacts orphaned phone messages',async()=>{
    const phone='+995500'+String(Date.now()).slice(-6);
    await prisma.user.update({where:{id:b.id},data:{phone}});
    await upsertUserLocation(b.id,{source:'grant',enabled:true,lat:50.6326,lng:5.5797,fixAt:Date.now(),place:{countryCode:'BE',countryKa:'ბელგია',cityKa:'ლიეჟი'}});
    await consent.recordAiConsent(b.id,{version:consent.AI_CONSENT_VERSION,decision:'accepted'});
    const sms=await prisma.smsLog.create({data:{destination:phone,content:'Synthetic private OTP',reference:'test',providerMsg:'private'}});
    await prisma.phoneVerification.create({data:{phone,codeHash:'synthetic',expiresAt:new Date()}});
    await prisma.pushEvent.create({data:{userId:b.id,source:'local',key:'test',title:'Synthetic',body:'Private'}});
    const interaction=await prisma.aiInteraction.create({data:{userId:b.id,mode:'DOCTOR',userPrompt:'Synthetic'}});
    const run=await prisma.aiEvalRun.create({data:{status:'DONE'}});
    await prisma.aiEvalResult.create({data:{runId:run.id,interactionId:interaction.id,mode:'DOCTOR',score:100,passed:true,rubric:{},notes:'Synthetic private'}});
    const result=await deleteUserAccount(b.id);assert.equal(result.ok,true);
    const locations=await prisma.$queryRaw`SELECT COUNT(*)::int AS count FROM "UserLocation" WHERE "userId"=${b.id}`;assert.equal(locations[0].count,0);
    await assert.rejects(() => prisma.$executeRaw`INSERT INTO "UserLocation" ("userId", "updatedAt") VALUES (${b.id}, NOW())`, error => error.code === 'P2010' && error.meta?.code === '23503');
    assert.equal(await prisma.phoneVerification.count({where:{phone}}),0);assert.equal(await prisma.pushEvent.count({where:{userId:b.id}}),0);assert.equal(await prisma.aiEvalResult.count({where:{runId:run.id}}),0);
    const row=await prisma.smsLog.findUnique({where:{id:sms.id}});assert.equal(row.destination,'[deleted]');assert.equal(row.content,'[redacted]');assert.equal(row.providerMsg,null);
    const count=await prisma.$queryRaw`SELECT COUNT(*)::int AS count FROM "UserAiConsent" WHERE "userId"=${b.id}`;assert.equal(count[0].count,0);
    await prisma.smsLog.delete({where:{id:sms.id}});await prisma.aiEvalRun.delete({where:{id:run.id}});
  });
});
