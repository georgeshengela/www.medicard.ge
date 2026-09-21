import test from 'node:test';
import assert from 'node:assert/strict';
process.env.DATABASE_URL ||= 'postgresql://unused@127.0.0.1:1/unused';
process.env.JWT_SECRET ||= 'assistant-unit-tests-only-secret';
process.env.EVIDENCEMD_API_KEY ||= 'disabled-unit-test';
const { ASSISTANT_FEATURES, ASSISTANT_GROUPS, assistantFeatures, literalAssistantNavigation } = await import('./assistantKnowledge.js');
const { publicAssistantCatalog, validateAssistantAction } = await import('./assistantCatalog.js');
const { executeAssistantPlan, assertAssistantActionContext } = await import('./assistantExecution.js');
const { loadAssistantContext } = await import('./assistantContext.js');
const owner='b902294d-67b1-4077-a0d8-c5383c7b18db', id='35aa9131-b3ae-4635-8a2c-0b1ec3b22e77';

test('registry covers app entry workflows without exposing wizard completion or retired screens',()=>{
  assert.ok(ASSISTANT_FEATURES.length >= 55);
  assert.equal(new Set(ASSISTANT_FEATURES.map(f=>f.id)).size,ASSISTANT_FEATURES.length);
  for(const f of ASSISTANT_FEATURES){
    assert.ok(ASSISTANT_GROUPS.some(g=>g.id===f.group));
    assert.ok(f.label && f.description);
    assert.ok(!/completed|analyzing|results|tbilisi-moves|medi-companion|run\/active/.test(f.route));
  }
  for(const id of ['cycle_journal','cycle_trends','pregnancy_timeline','lab_history','quest_wallet','permissions','medication_interactions','week','weather'])assert.ok(assistantFeatures('human').some(f=>f.id===id));
});
test('pet navigation schema and validator both exclude human health pages',()=>{
  const open=publicAssistantCatalog('pet').find(t=>t.name==='open');
  assert.ok(!open.parameters.properties.destination.enum.includes('cycle'));
  assert.throws(()=>validateAssistantAction({tool:'open',args:{destination:'cycle'}},'pet'));
  assert.equal(validateAssistantAction({tool:'open',args:{destination:'pets'}},'pet').args.destination,'pets');
});
test('literal navigation is exact, scoped and does not swallow negation or draft corrections',()=>{
  assert.deepEqual(literalAssistantNavigation({scope:'human',text:'გახსენი წამლების თავსებადობა'}),{tool:'open',args:{destination:'medication_interactions'}});
  for(const text of ['არ გახსენი წამლების თავსებადობა','გახსენი წამლების თავსებადობა და წამალი დაამატე','გახსენი წამლების თავსებადობა?'])assert.equal(literalAssistantNavigation({scope:'human',text}),null);
  assert.equal(literalAssistantNavigation({scope:'pet',text:'გახსენი ციკლის მართვა'}),null);
  assert.equal(literalAssistantNavigation({scope:'human',text:'გახსენი ჰიდრატაცია',draft:{tool:'hydration_add'}}),null);
});
test('owned record handoffs do not write and reject inaccessible IDs',async()=>{
  for(const [tool,key,table,route] of [['record_open','recordId','medicalRecord',`/record/${id}`],['medication_open','medicationId','medicationSchedule',`/medications/${id}`],['visit_open','visitId','doctorVisit',`/visits/editor?id=${id}`]]){
    const plan={id:'operation',scope:'human',tool,args:{[key]:id}};
    let allowed=false;
    const db={[table]:{findFirst:async q=>{assert.deepEqual(q.where,{id,userId:owner});return allowed?{id}:null;}}};
    await assert.rejects(executeAssistantPlan(plan,{userId:owner},db,()=>{throw Error('must not write');}),e=>e.status===404);
    allowed=true;
    assert.equal((await executeAssistantPlan(plan,{userId:owner},db,()=>{throw Error('must not write');})).native.route,route);
  }
});
test('ownership is rechecked for updates and dose recording',async()=>{
  for(const tool of ['medication_update','medication_stop','visit_update','visit_cancel','dose_record']){
    const table=tool.startsWith('visit')?'doctorVisit':'medicationSchedule';
    await assert.rejects(assertAssistantActionContext(owner,{tool,args:tool==='dose_record'?{medicationId:id}:{id}},{[table]:{findFirst:async()=>null}}),e=>e.status===404);
  }
});
test('protected cycle handoffs go through unlock entry; unlocked deep links remain precise',async()=>{
  let locked=true;
  const db={cycleProfile:{findUnique:async q=>{assert.equal(q.where.userId,owner);return {privacyEnabled:locked};}}};
  const plan={id:'operation',tool:'open',args:{destination:'cycle_trends'}};
  assert.equal((await executeAssistantPlan(plan,{userId:owner},db)).native.route,'/cycle');
  locked=false;assert.equal((await executeAssistantPlan(plan,{userId:owner},db)).native.route,'/cycle/trends');
});
test('activity context uses canonical MEDIRUN totals without GPS locations',async()=>{
  const db={healthProfile:{findUnique:async()=>({extraAnswers:{appState:{runHistory:[{meters:99999}]}}})},medipulsiSession:{findMany:async q=>{
    assert.equal(q.where.userId,owner);assert.equal(q.take,10);return [{id,meters:1200,seconds:900,steps:1600,phase:'FINISHED',latitude:50,longitude:5}];
  }}};
  const result=await loadAssistantContext({id:owner},['activity'],'human',db);
  assert.equal(result.activity.sessions[0].meters,1200);assert.equal(result.activity.sessions[0].latitude,undefined);
});
test('medication context keeps explicit course dates without arbitrary config values',async()=>{
  const db={medicationSchedule:{findMany:async()=>[{id,medName:'fixture',config:{startDate:'2026-09-21',endDate:'2026-10-04',hidden:'never send'}}]}};
  const result=await loadAssistantContext({id:owner},['medications'],'human',db);
  assert.deepEqual(result.medications[0].course,{startDate:'2026-09-21',endDate:'2026-10-04'});
});

test('pet context adds owned care and products without mixing human health',async()=>{
  const owned={findMany:async q=>{assert.equal(q.where.userId,owner);assert.equal(q.where.petId,id);return [];}};
  const db={pet:{findMany:async()=>[{id,name:'Synthetic Rex'}]},petWeightLog:owned,petAllergy:owned,petCondition:owned,petCareSchedule:owned,petProduct:owned};
  const result=await loadAssistantContext({id:owner},['profile','cycle'],'pet',db);
  assert.deepEqual(result.pets[0].carePlans,[]);assert.deepEqual(result.pets[0].products,[]);assert.equal(result.profile,undefined);
});
