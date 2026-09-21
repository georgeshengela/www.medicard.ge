import test from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import { assistantJson } from './assistantModel.js';
import { resolveAssistantSubject } from './assistantSubject.js';
import { extractChatContent } from './aiEngine.js';
import { literalAssistantAction } from './assistantFlow.js';
import { loadAssistantContext } from './assistantContext.js';
const schema = z.object({ reply: z.string(), action: z.null(), draft: z.null() }).strict();
const complete = { reply: 'რომელ დღეს დავგეგმოთ?', action: null, draft: null };
test('truncated model output retries once and keeps the original user facts', async () => {
  const calls=[];
  const result=await assistantJson([{role:'user',content:'ლუნა უნდა ჩავწერო აცრაზე'}],schema,{ask:async args=>{calls.push(args);return calls.length===1?{content:'{"reply":"რომელ',finishReason:'length'}:{content:JSON.stringify(complete),finishReason:'stop'};}});
  assert.deepEqual(result,complete);assert.equal(calls.length,2);assert.equal(calls[1].messages[0].content,calls[0].messages[0].content);assert.ok(calls[1].maxTokens>calls[0].maxTokens);
});
test('malformed JSON and schema failures cannot execute or become partial guessed actions', async()=>{
 for(const content of ['not json','{"reply":"hi"}','{"reply":"hi","action":{"tool":"x"},"draft":null}']){
  let calls=0;await assert.rejects(assistantJson([],schema,{ask:async()=>{calls++;return{content};}}),e=>e.code==='ASSISTANT_RESPONSE_FAILED'&&!e.message.includes('მოკლედ'));assert.equal(calls,2);
 }
});
test('complete fenced JSON works without a second call; provider failures are not hidden',async()=>{
 assert.deepEqual(await assistantJson([],schema,{ask:async()=>({content:'```json\n'+JSON.stringify(complete)+'\n```'})}),complete);
 let calls=0;await assert.rejects(assistantJson([],schema,{ask:async()=>{calls++;throw Object.assign(new Error('quota'),{status:429});}}),/quota/);assert.equal(calls,1);
});
test('empty provider content retries, but a slow provider is bounded without replaying any write',async()=>{
 let emptyCalls=0;
 assert.deepEqual(await assistantJson([],schema,{ask:async()=>{if(++emptyCalls===1)throw Object.assign(new Error('empty'),{code:'AI_EMPTY_RESPONSE'});return{content:JSON.stringify(complete)};}}),complete);
 let slowCalls=0;
 await assert.rejects(assistantJson([],schema,{timeoutMs:15,ask:({signal})=>new Promise((resolve,reject)=>{
  slowCalls++;const timer=setTimeout(resolve,100);signal.addEventListener('abort',()=>{clearTimeout(timer);reject(new Error('aborted'));},{once:true});
 })}),error=>error.status===504&&error.code==='ASSISTANT_RESPONSE_TIMEOUT');
 assert.equal(slowCalls,1);
});
test('hidden reasoning is never treated as a visible response',()=>{
 assert.equal(extractChatContent({choices:[{message:{content:null,reasoning:'private'}}]}),'');
});
const pets=[{id:'luna',name:'ლუნა'},{id:'rex',name:'რექსი'}];
test('owned names and Georgian suffixes route without a tab or human context',()=>{
 for(const text of ['მედი ლუნა უნდა ჩავწერო აცრაზე','მედილუნა უნდა ჩავწერო აცრაზე','ლუნას წონა 8 კგ არის','რექსის მოვლის გეგმა გახსენი']){
  const r=resolveAssistantSubject({text},pets);assert.equal(r.scope,'pet');assert.equal(r.petId,text.includes('რექს')?'rex':'luna');
 }
 assert.equal(resolveAssistantSubject({text:'კატას უნდა ჩავუტარო აცრა'},pets).scope,'pet');
});
test('personal request leaves pet scope; corrections and short answers retain the right subject',()=>{
 const draft={tool:'pet_care_plan',args:{petId:'luna',kind:'VACCINATION'}};
 assert.equal(resolveAssistantSubject({text:'ხვალ',draft},pets).petId,'luna');
 assert.equal(resolveAssistantSubject({text:'არა რექსისთვის',draft},pets).draft.args.petId,'rex');
 assert.deepEqual(resolveAssistantSubject({text:'მე დავლიე 250 მლ წყალი',draft},pets).draft,null);
 assert.equal(resolveAssistantSubject({text:'მე უნდა ჩავეწერო აცრაზე',draft},pets).scope,'human');
 assert.equal(resolveAssistantSubject({text:'ლუნასთვის არა, ჩემთვის მინდა',draft},pets).scope,'human');
});
test('duplicate names clarify; unknown or archived identity is never selected',()=>{
 assert.equal(resolveAssistantSubject({text:'ლუნა უნდა ავცრა'},[...pets,{id:'other-luna',name:'ლუნა'}]).ambiguous,true);
 assert.equal(resolveAssistantSubject({text:'მაქსი უნდა ჩავწერო აცრაზე'},pets).petId,null);
 assert.equal(resolveAssistantSubject({text:'ლუნატიკა'},pets).scope,'human');
 assert.equal(resolveAssistantSubject({text:'მისი წონა ჩაწერე',history:[{role:'user',content:'ლუნას აცრა'}]},pets).petId,'luna');
});
test('explicit name choice rejects a foreign identity and accepts the owned duplicate',()=>{
 assert.throws(()=>resolveAssistantSubject({text:'ლუნა',subjectId:'foreign'},pets));
 assert.equal(resolveAssistantSubject({text:'ლუნა',subjectId:'luna'},pets).petId,'luna');
});
test('personal water statement with Medi prefix uses the exact literal path after leaving a pet task',()=>{
 for(const text of ['მედი, მე დღეს დავლიე 250 მლ წყალი','მე დღეს დავლიე 250 მლ წყალი']) {
  const subject=resolveAssistantSubject({text,draft:{tool:'pet_care_plan',args:{petId:'luna'}}},pets);
  assert.deepEqual(literalAssistantAction({...subject,text}),{tool:'hydration_add',args:{amountMl:250}});
 }
 assert.equal(literalAssistantAction({scope:'human',text:'მედი, მე დღეს არ დავლიე 250 მლ წყალი'}),null);
});
test('selected pet context query contains both owner and pet identity',async()=>{
 let where;
 const db={pet:{findMany:async args=>{where=args.where;return[];}}};
 await loadAssistantContext({id:'owner'},['profile','cycle'],'pet',db,'luna');
 assert.deepEqual(where,{userId:'owner',archivedAt:null,id:'luna'});
});
