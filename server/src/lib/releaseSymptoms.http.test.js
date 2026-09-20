import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
const enabled=process.env.MEDICARD_RELEASE_TEST==='1';
if(enabled){const u=new URL(process.env.DATABASE_URL||'');assert.equal(u.hostname,'127.0.0.1');assert.equal(u.port,'55436');assert.equal(u.pathname,'/medicard_release_audit');}
test('HTTP symptom flow, consent and location on disposable PostgreSQL', {skip:!enabled}, async t=>{
  const {default:express}=await import('express');
  const {prisma}=await import('./prisma.js');
  const {signToken}=await import('../middleware/auth.js');
  const {aiRouter}=await import('../routes/ai.routes.js');
  const {aiConsentRouter}=await import('../routes/ai-consent.routes.js');
  const {locationRouter}=await import('../routes/location.routes.js');
  const {errorHandler}=await import('../middleware/error.js');
  const {ROLLING_DAILY_KEY}=await import('./usage.js');
  const app=express();app.use(express.json());app.use('/api/ai',aiRouter);app.use('/api/ai-consent',aiConsentRouter);app.use('/api/location',locationRouter);app.use(errorHandler);
  const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});const origin=`http://127.0.0.1:${server.address().port}`;
  const users=await Promise.all(['A','B'].map(letter=>prisma.user.create({data:{email:`http-${letter}-${randomUUID()}@medicard.test`,passwordHash:'not-login',fullName:`PRIVATE_ACCOUNT_NAME_${letter}`,aiEngine:'evidencemd',gender:'FEMALE',birthDate:new Date('1990-01-01'),healthProfile:{create:{chronicConditions:['SYNTHETIC_PRIVATE_PROFILE_MARKER'],completedAt:new Date()}}}})));
  const [a,b]=users,tokens=users.map(signToken),nativeFetch=globalThis.fetch;let malformed=false;const sends=[];
  const valid={urgency:'urgent',urgencyKa:'საცდელი შეფასება',summaryKa:'საცდელი შეჯამება',findingScore:50,conditions:[{id:'one',nameKa:'საცდელი მდგომარეობა',nameEn:'Synthetic',likelihood:0,risk:'low',needsTreatment:false,overviewKa:'საცდელი აღწერა',severityKa:'მსუბუქი',severityLevel:1,symptomsKa:[],causesKa:[],treatmentsKa:[],whenToSeeDoctorKa:'საცდელი მითითება',selfCareKa:[]}],redFlagsKa:[],nextStepsKa:['საცდელი ნაბიჯი']};
  globalThis.fetch=async(input,init)=>{
    const url=new URL(typeof input==='string'?input:input.url);
    if(url.origin===origin)return nativeFetch(input,init);
    assert.equal(url.origin,'https://evidencemd.ai');assert.equal(url.pathname,'/api/v1/chat/completions');sends.push(JSON.parse(init.body));
    return new Response(JSON.stringify({id:'synthetic',object:'chat.completion',created:Math.floor(Date.now()/1000),model:'synthetic',choices:[{index:0,finish_reason:'stop',message:{role:'assistant',content:malformed?'provider returned malformed data':JSON.stringify(valid)}}],usage:{prompt_tokens:1,completion_tokens:1,total_tokens:2}}),{status:200,headers:{'content-type':'application/json'}});
  };
  t.after(async()=>{globalThis.fetch=nativeFetch;await new Promise(resolve=>server.close(resolve));for(const user of users){await prisma.$executeRaw`DELETE FROM "UserLocation" WHERE "userId"=${user.id}`;await prisma.user.deleteMany({where:{id:user.id}});}await prisma.$disconnect();});
  const call=async(path,body,who=0,method=body?'POST':'GET')=>{const res=await fetch(origin+path,{method,headers:{...(who===null?{}:{Authorization:'Bearer '+tokens[who]}),'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});return {status:res.status,body:await res.json()};};
  await t.test('anonymous/declined requests cannot reach AI or access saved records',async()=>{
    assert.equal((await call('/api/ai/symptom-check',{symptoms:['საცდელი']},null)).status,401);
    assert.equal((await call('/api/ai/symptom-check',{symptoms:['საცდელი']})).body.code,'AI_CONSENT_REQUIRED');assert.equal(sends.length,0);
    const status=await call('/api/ai-consent');
    assert.equal((await call('/api/ai-consent',{version:status.body.version,decision:'declined'},0,'PUT')).body.accepted,false);
    assert.equal((await call('/api/ai/symptom-check',{symptoms:['საცდელი']})).status,403);
    assert.equal((await call('/api/ai-consent',{version:status.body.version,decision:'accepted',userId:b.id},0,'PUT')).status,400);
    assert.equal((await call('/api/ai-consent',{version:status.body.version,decision:'accepted'},0,'PUT')).body.accepted,true);
  });
  let recordId;
  await t.test('symptom submit persists the real result, primary symptom and anatomy; B cannot read A',async()=>{
    const res=await call('/api/ai/symptom-check',{symptoms:['საცდელი ტკივილი','საცდელი გულისრევა'],primarySymptom:'საცდელი გულისრევა',method:'anatomy',mode:'muscle',bodyPartId:'abs',bodyPartKa:'მუცელი',durationKa:'ერთი დღე',painLevel:2,includeHealthProfile:false});
    assert.equal(res.status,201,JSON.stringify(res.body));recordId=res.body.recordId;assert.equal(res.body.result.conditions[0].likelihood,0);assert.equal(res.body.usage.unlimited,true);
    const outbound=JSON.stringify(sends.at(-1));assert.ok(outbound.includes('მთავარი სიმპტომი: საცდელი გულისრევა'));assert.ok(!outbound.includes('PRIVATE_ACCOUNT_NAME'));assert.ok(!outbound.includes('SYNTHETIC_PRIVATE_PROFILE_MARKER'));
    const history=await call('/api/ai/symptom-result/'+recordId);assert.equal(history.status,200);assert.equal(history.body.input.bodyPartId,'abs');assert.equal(history.body.input.primarySymptom,'საცდელი გულისრევა');
    assert.equal((await call('/api/ai/symptom-result/'+recordId,undefined,1)).status,404);
  });
  await t.test('profile is included only by explicit preference, without account name',async()=>{
    const res=await call('/api/ai/symptom-check',{symptoms:['საცდელი'],includeHealthProfile:true});assert.equal(res.status,201,JSON.stringify(res.body));
    const outbound=JSON.stringify(sends.at(-1));assert.ok(outbound.includes('SYNTHETIC_PRIVATE_PROFILE_MARKER'));assert.ok(!outbound.includes('PRIVATE_ACCOUNT_NAME'));
  });
  await t.test('empty symptoms and malformed provider results do not create an invented medical result',async()=>{
    const before=await prisma.medicalRecord.count({where:{userId:a.id}}),sent=sends.length;
    assert.equal((await call('/api/ai/symptom-check',{symptoms:[]})).status,400);assert.equal(sends.length,sent);
    malformed=true;const res=await call('/api/ai/symptom-check',{symptoms:['საცდელი']});assert.equal(res.status,502);assert.equal(res.body.code,'AI_INVALID_RESPONSE');assert.equal(await prisma.medicalRecord.count({where:{userId:a.id}}),before);
    const usage=await prisma.periodUsage.findUnique({where:{userId_periodKey:{userId:a.id,periodKey:ROLLING_DAILY_KEY}}});assert.equal(usage.reserved,0);malformed=false;
  });
  await t.test('revoke blocks next attempt while historical results remain readable',async()=>{
    const state=await call('/api/ai-consent');await call('/api/ai-consent',{version:state.body.version,decision:'revoked'},0,'PUT');const sent=sends.length;
    assert.equal((await call('/api/ai/symptom-check',{symptoms:['საცდელი']})).status,403);assert.equal(sends.length,sent);assert.equal((await call('/api/ai/symptom-result/'+recordId)).status,200);
  });
  await t.test('fresh city persists through HTTP, invalid coordinates and stale GPS leave it intact',async()=>{
    const good={source:'grant',enabled:true,lat:50.6326,lng:5.5797,fixAt:Date.now(),timeZone:'Asia/Tbilisi',place:{countryCode:'BE',countryKa:'ბელგია',cityKa:'ლიეჟი'}};
    const res=await call('/api/location',good);assert.equal(res.status,200);assert.equal(res.body.profile.extraAnswers.location.cityKa,'ლიეჟი');
    assert.equal((await call('/api/location',{...good,lat:999})).status,400);assert.equal((await call('/api/location',{...good,fixAt:1})).status,400);assert.equal((await call('/api/location')).body.location.cityKa,'ლიეჟი');
  });
});
