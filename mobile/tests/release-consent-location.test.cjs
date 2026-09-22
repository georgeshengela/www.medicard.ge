const test=require('node:test'),assert=require('node:assert/strict'),loader=require('./helpers/loadTs.cjs');
const valid={enabled:true,countryCode:'BE',cityKa:'ლიეჟი',lat:50.6,lng:5.5};

test('strict iOS storage reports a native write failure while ordinary preferences keep their fallback', async()=>{
  let failing=true;
  const values=new Map([['medicard.sandbox.v1','1']]);
  const mod=loader({
    'react-native':{Platform:{OS:'ios'},Settings:{get:key=>values.get(key),set:entries=>{if(failing)throw new Error('write failed');for(const [k,v]of Object.entries(entries))values.set(k,v);}}},
    'expo-secure-store':{},'@/lib/protectedTokenChange.js':{},
  })('src/lib/storage.ts');
  await assert.rejects(()=>mod.setPreferenceStrict('history','private'),/write failed/);
  await mod.setPreference('appearance','dark');
  assert.equal(await mod.getPreference('appearance'),'dark');
  failing=false;
  await mod.setPreferenceStrict('history','saved');
  assert.equal(values.get('@medicard/pref/history'),'saved');
});
test('missing city is prompted again despite historical prompted flag; defer is per day',()=>{
  const {hasResolvedLocation,shouldCompleteLocation}=loader()('src/lib/locationCompletion.ts');
  const now=Date.now();
  assert.equal(hasResolvedLocation(valid),true);assert.equal(shouldCompleteLocation(valid,null,now),false);
  for(const loc of [null,{...valid,cityKa:''},{...valid,lat:999},{...valid,lat:NaN},{...valid,enabled:false},{prompted:true}])assert.equal(shouldCompleteLocation(loc,null,now),true);
  assert.equal(shouldCompleteLocation(null,now-60000,now),false);assert.equal(shouldCompleteLocation(null,now-86400001,now),true);assert.equal(shouldCompleteLocation(null,now+60000,now),true);
});
test('all medical upload and stream routes require consent; feedback/read routes do not',()=>{
  const {isAiSharingRequest}=loader({react:{},'@/lib/localAccount':{}})('src/lib/aiSharingConsent.ts');
  for(const path of ['/api/ai/query','/api/ai/symptom-check','/api/ai/extract-lab','/api/ai/analyze-image','/api/ai/consilium','/api/health-profile/onboarding-analysis','/api/cycle/insights','/api/pets/petA/chat/query','/api/assistant/plan','/api/assistant/transcribe','/api/assistant/speak'])assert.equal(isAiSharingRequest(path,'POST'),true,path);
  for(const path of ['/api/ai/feedback','/api/ai/feedback?x=1','/api/pets'])assert.equal(isAiSharingRequest(path,'POST'),false,path);
  assert.equal(isAiSharingRequest('/api/ai/query','GET'),false);
});
test('closing consent cancels every waiting request without recording acceptance', async()=>{
  const mod=loader({react:{useSyncExternalStore:(_,get)=>get()},'@/lib/localAccount':{localAccountId:()=> 'A'}})('src/lib/aiSharingConsent.ts');
  let writes=0;const status={version:'review-disclosure',accepted:false};
  const first=mod.requestAiSharingPrompt('A',status,async()=>{writes++;return {...status,accepted:true};});
  const second=mod.requestAiSharingPrompt('A',status,async()=>assert.fail('duplicate write'));
  mod.cancelAiSharingPrompt();
  assert.equal(await first,false);assert.equal(await second,false);assert.equal(writes,0);
});
test('changed disclosure is shown again after conflict; old acceptance is never reused',async()=>{
  const mod=loader({react:{useSyncExternalStore:(_,get)=>get()},'@/lib/localAccount':{localAccountId:()=> 'A'}})('src/lib/aiSharingConsent.ts');
  const versions=[];const updated={version:'new',accepted:false};
  const promise=mod.requestAiSharingPrompt('A',{version:'old',accepted:false},async(_,version)=>{versions.push(version);if(version==='old')throw Object.assign(Error('Changed'),{consentStatus:updated});return {...updated,accepted:true};});
  await mod.decideAiSharing(true);assert.equal(mod.useAiSharingPrompt().status.version,'new');assert.equal(mod.useAiSharingPrompt().busy,false);
  await mod.decideAiSharing(true);assert.equal(await promise,true);assert.equal(versions.join(','),'old,new');
});
test('revocation saves a revoke decision, and paid configuration cannot create account tiers',async()=>{
  const mod=loader({react:{useSyncExternalStore:(_,get)=>get()},'@/lib/localAccount':{localAccountId:()=> 'A'}})('src/lib/aiSharingConsent.ts');
  let decision;const promise=mod.requestAiSharingPrompt('A',{version:'v1',accepted:true},async d=>{decision=d;return {version:'v1',accepted:false};},true);
  await mod.decideAiSharing(false);assert.equal(await promise,false);assert.equal(decision,'revoked');
  const access=loader()('src/lib/consumerAccess.js');
  for(const config of [{mode:'paid',storeBillingReady:true,reviewApproved:true},{},null])assert.equal(access.isFreeConsumerRelease(config),true);
});
test('consent deduplicates requests, remains undecided until save, and fails closed on account change',async()=>{
  let owner='A',saveCount=0;
  const mod=loader({react:{useSyncExternalStore:(_,get)=>get()},'@/lib/localAccount':{localAccountId:()=>owner}})('src/lib/aiSharingConsent.ts');
  const status={version:'v1',accepted:false},save=async(decision)=>{saveCount++;return {...status,accepted:decision==='accepted'};};
  const first=mod.requestAiSharingPrompt('A',status,save);const duplicate=mod.requestAiSharingPrompt('A',status,save);assert.equal(first,duplicate);assert.equal(saveCount,0);
  await mod.decideAiSharing(false);assert.equal(await first,false);assert.equal(saveCount,1);
  const second=mod.requestAiSharingPrompt('A',status,save);owner='B';await mod.decideAiSharing(true);assert.equal(await second,false);assert.equal(saveCount,1);
  owner='A';const third=mod.requestAiSharingPrompt('A',status,save);await mod.decideAiSharing(true);assert.equal(await third,true);
});
test('consent save failure permits retry and never accepts optimistically',async()=>{
  let attempts=0;
  const mod=loader({react:{useSyncExternalStore:(_,get)=>get()},'@/lib/localAccount':{localAccountId:()=> 'A'}})('src/lib/aiSharingConsent.ts');
  const promise=mod.requestAiSharingPrompt('A',{version:'v1',accepted:false},async()=>{if(++attempts===1)throw Error('Offline');return {version:'v1',accepted:true};});
  await mod.decideAiSharing(true);assert.equal(mod.useAiSharingPrompt().busy,false);assert.ok(mod.useAiSharingPrompt().error);assert.equal(mod.useAiSharingPrompt().status.accepted,false);
  await mod.decideAiSharing(true);assert.equal(await promise,true);assert.equal(mod.useAiSharingPrompt(),null);
});
test('weather never relabels another city or exposes a late response across accounts',async()=>{
  let owner='A',resolveFetch;const disk=new Map();
  const mod=loader({'@/lib/localAccount':{localAccountId:()=>owner},'@/lib/storage':{getPreference:async k=>disk.get(k),setPreference:async(k,v)=>disk.set(k,v),deletePreference:async k=>disk.delete(k)},'./openMeteo.ts':{fetchOpenMeteoSnapshot:()=>new Promise(resolve=>{resolveFetch=resolve;})}})('src/lib/weather/cache.ts');
  const snapshot={location:{city:'ლიეჟი'},current:{temperature:18}},now=Date.now();
  await mod.writeWeatherCache({latitude:50.6,longitude:5.5,fetchedAt:now,snapshot});
  assert.equal((await mod.loadWeatherSnapshot({latitude:50.6,longitude:5.5,city:'ლიეჟი'})).fromCache,true);
  const pending=mod.loadWeatherSnapshot({latitude:41.7,longitude:44.8,city:'თბილისი'});await Promise.resolve();await Promise.resolve();
  owner='B';resolveFetch({location:{city:'თბილისი'}});await assert.rejects(()=>pending,/superseded/);assert.equal(mod.peekWeatherMemory(),null);assert.equal(await mod.readWeatherCache(),null);
  assert.equal(mod.isCacheFresh({fetchedAt:now+60000},now),false);
});
