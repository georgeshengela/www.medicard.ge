import {test} from 'node:test';
import assert from 'node:assert/strict';
import {assertNoPrivacyFields} from './adminUserInvestigation.js';
import {collectModuleUsage} from './adminProductUsage.js';
test('usage selects only aggregate metadata and scopes both queries to the account and period',async()=>{
 const calls=[]; const db=new Proxy({}, {get:(_,model)=>({aggregate:async args=>{calls.push(args);return {_count:{_all:2},_min:{createdAt:new Date('2026-09-01'),startedAt:null,completedAt:null},_max:{createdAt:new Date('2026-09-24'),startedAt:null,completedAt:null}}}, count:async args=>{calls.push(args);return 1}})});
 const from=new Date('2026-09-20'),to=new Date('2026-09-25');
 const result=await collectModuleUsage(db,'account-a',from,to);
 assert.deepEqual(assertNoPrivacyFields({productUsage: result}),[]);
 assert.equal(Object.keys(result).length,15);assert.equal(result.assistant.periodCount,1);
 assert.ok(calls.every(c=>c.where.userId==='account-a'));
 assert.ok(calls.some(c=>c.where.status==='DONE'));
 assert.ok(calls.filter(c=>!c._count).every(c=>Object.values(c.where).some(v=>v?.gte===from&&v?.lt===to)));
 assert.ok(!JSON.stringify(calls).includes('messages'));
});
test('unavailable sources stay unknown rather than falsely unused',async()=>{
 const db=new Proxy({}, {get:()=>({aggregate:async()=>{throw {code:'P2021'}},count:async()=>0})});
 const result=await collectModuleUsage(db,'a',new Date(),new Date());
 assert.ok(Object.values(result).every(r=>r.available===false&&r.periodCount===null));
});

test('usage metadata does not collide with protected clinical field names',()=>{
 assert.deepEqual(assertNoPrivacyFields({productUsage:{step_tracking:{used:true,periodCount:2},symptom_review:{used:false}}}),[]);
 assert.ok(assertNoPrivacyFields({steps:100,symptoms:['private']}).length===2);
});
