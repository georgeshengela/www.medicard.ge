const {test}=require('node:test'),assert=require('node:assert/strict');
const loadTs=require('./helpers/loadTs.cjs')();
const {cycleDatePickable,needsCycleOnboarding}=loadTs('src/lib/cycleExperience.ts');
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
