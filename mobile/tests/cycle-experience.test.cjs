const {test}=require('node:test'),assert=require('node:assert/strict');
const loadTs=require('./helpers/loadTs.cjs')();
const {cycleDatePickable,needsCycleOnboarding,needsCycleSetupTail,cycleSetupTailKey}=loadTs('src/lib/cycleExperience.ts');
test('cycle onboarding validates real civil dates and prevents future days',()=>{
 const now=new Date(2026,8,20);
 assert.equal(cycleDatePickable('2026-09-20',now),true);
 assert.equal(cycleDatePickable('2026-09-21',now),false);
 assert.equal(cycleDatePickable('2026-02-31',now),false);
 assert.equal(cycleDatePickable('2026-02-29',now),false);
 assert.equal(cycleDatePickable('2025-03-01',now),true);
 assert.equal(cycleDatePickable('2025-02-28',now),false);
});
test('pregnancy and lifecycle modes never demand a fabricated period date',()=>{
 for(const mode of ['PREGNANCY','POSTPARTUM','PERIMENOPAUSE'])assert.equal(needsCycleOnboarding(mode,null),false);
 assert.equal(needsCycleOnboarding('TRACK_PERIOD',null),true);
 assert.equal(needsCycleOnboarding('TRY_TO_CONCEIVE','2026-09-01'),false);
 assert.equal(needsCycleOnboarding('TRACK_PERIOD','2026-09-01',true),true);
});
test('setup tail (brief §9 item 19): due once after the assessment saved the date, never again and never with real data',()=>{
 const fresh={profile:{mode:'TRACK_PERIOD',lastPeriodStart:'2026-09-08',contraceptionMethod:null},averages:{source:'default',cycleCount:0}};
 assert.equal(needsCycleSetupTail(fresh,false),true);
 assert.equal(needsCycleSetupTail(fresh,true),false);
 assert.equal(needsCycleSetupTail(null,false),false);
 // No date yet → the full onboarding (date step) handles it, not the tail.
 assert.equal(needsCycleSetupTail({...fresh,profile:{...fresh.profile,lastPeriodStart:null}},false),false);
 // She already answered contraception, set her own lengths, or has logged cycles → nothing to ask.
 assert.equal(needsCycleSetupTail({...fresh,profile:{...fresh.profile,contraceptionMethod:'NONE'}},false),false);
 assert.equal(needsCycleSetupTail({...fresh,averages:{source:'user',cycleCount:0}},false),false);
 assert.equal(needsCycleSetupTail({...fresh,averages:{source:'inferred',cycleCount:6}},false),false);
 assert.equal(needsCycleSetupTail({...fresh,averages:null},false),false);
 for(const mode of ['PREGNANCY','POSTPARTUM','PERIMENOPAUSE'])assert.equal(needsCycleSetupTail({...fresh,profile:{...fresh.profile,mode}},false),false);
 assert.equal(needsCycleSetupTail({...fresh,profile:{...fresh.profile,mode:'TRY_TO_CONCEIVE'}},false),true);
 assert.equal(cycleSetupTailKey('u1'),'cycle.setupTail.done:u1');
});
