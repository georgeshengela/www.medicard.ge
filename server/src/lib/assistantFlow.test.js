import test from 'node:test';
import assert from 'node:assert/strict';
import { literalAssistantAction, assistantContextSelection, assistantGuidance, medicationCourseEnd } from './assistantFlow.js';
import { validateAssistantAction, publicAssistantCatalog } from './assistantCatalog.js';
test('literal medication captures only name; never dose or timing', () => {
  for (const text of ['წამალი იბუპროფენი დამიმატე', 'დამიმატე წამალი იბუპროფენი.']) assert.deepEqual(literalAssistantAction({scope:'human',text}), {tool:'medication_add',args:{medName:'იბუპროფენი'}});
  for (const text of ['არ დამიმატე წამალი იბუპროფენი', 'შეიძლება იბუპროფენი?', 'წამალი არ დამიმატე', 'წამალი ეს დამიმატე', 'წამალი იბუპროფენი დავლიე', 'დამიმატე წამალი იბუპროფენი 200 მგ ორი კვირა', 'წამალი იბუპროფენი დამიმატე?']) assert.equal(literalAssistantAction({scope:'human',text}),null,text);
  assert.equal(literalAssistantAction({scope:'pet',text:'წამალი იბუპროფენი დამიმატე'}),null);
  assert.equal(literalAssistantAction({scope:'human',text:'წამალი იბუპროფენი დამიმატე',draft:{tool:'medication_add',args:{}}}),null);
});
test('literal hydration requires explicit date and quantity, not inferred glass size',()=>{
  assert.deepEqual(literalAssistantAction({scope:'human',text:'დღეს დავლიე 250 მლ წყალი'}),{tool:'hydration_add',args:{amountMl:250}});
  for(const text of ['დღეს დავლიე ერთი ჭიქა წყალი','გუშინ დავლიე 250 მლ წყალი','დღეს დავლიე 0 მლ წყალი','დღეს დავლიე 9999 მლ წყალი']) assert.equal(literalAssistantAction({scope:'human',text}),null);
});
test('routing is scoped, ambiguous record questions retain semantic classification',()=>{
  assert.deepEqual(assistantContextSelection({scope:'pet',text:'ჩემი წონა და ციკლი'}),['pets']);
  assert.deepEqual(assistantContextSelection({scope:'human',text:'200 მგ, 09:00',draft:{tool:'medication_add'}}),['medications']);
  assert.equal(assistantContextSelection({scope:'human',text:'მითხარი ჩემი ანალიზის შედეგი'}),null);
  assert.deepEqual(assistantContextSelection({scope:'human',text:'ჩემი ციკლი',draft:{tool:'medication_add'}}),['medications','cycle']);
});
test('guidance only asks missing related fields; duration asks start day',()=>{
  const parameters=publicAssistantCatalog('human').find(t=>t.name==='medication_add').parameters;
  assert.deepEqual(assistantGuidance({tool:'medication_add',args:{medName:'იბუპროფენი',courseDays:14}},parameters).fields,['dosage','frequency','startDate']);
  assert.deepEqual(assistantGuidance({tool:'medication_add',args:{medName:'იბუპროფენი',dosage:'200 მგ',frequency:['09:00'],courseDays:14,startDate:'2026-09-21'}},parameters).fields,[]);
});
test('course preserves explicit duration, uses inclusive end and rejects conflicting dates',()=>{
  const base={tool:'medication_add',args:{medName:'სატესტო',dosage:'200 მგ',frequency:['21:00','09:00','09:00'],courseDays:14}};
  assert.throws(()=>validateAssistantAction(base,'human'));
  const ready=validateAssistantAction({...base,args:{...base.args,startDate:'2026-09-21'}},'human');
  assert.equal(ready.args.endDate,'2026-10-04'); assert.deepEqual(ready.args.frequency,['09:00','21:00']);
  assert.throws(()=>validateAssistantAction({...base,args:{...base.args,startDate:'2026-09-21',endDate:'2026-10-05'}},'human'));
  assert.equal(medicationCourseEnd('2028-02-28',3),'2028-03-01');
  assert.equal(medicationCourseEnd('2026-12-31',1),'2026-12-31');
});
