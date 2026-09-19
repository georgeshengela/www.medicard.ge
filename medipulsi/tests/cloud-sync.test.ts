import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {randomUUID} from 'node:crypto';

// Exercise the real client queue with a simulated network, isolated from browser
// globals and from every real account/database.
function client(){
 const stored=new Map<string,string>(),events:any[]=[],requests:any[]=[];
 const snapshot={userId:'test-account',state:{journey:{},book:{}},missions:[],settings:{},claims:[],history:[],session:null as any};
 let failure=0;
 const storage={getItem:(key:string)=>stored.get(key)??null,setItem:(key:string,value:string)=>stored.set(key,value),removeItem:(key:string)=>stored.delete(key)};
 const module={exports:{} as any};
 const code=ts.transpileModule(fs.readFileSync(new URL('../src/cloud.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(code,{module,exports:module.exports,require:(id:string)=>id==='./missions'?{MISSIONS:[]}:{native:false,embedded:false},sessionStorage:storage,localStorage:storage,crypto:{randomUUID},AbortSignal,URL,Date,JSON,CustomEvent:class{type:string;detail:any;constructor(type:string,options:any){this.type=type;this.detail=options.detail;}},window:{dispatchEvent:(e:any)=>events.push(e),addEventListener:()=>{},setInterval:()=>0},fetch:async(url:string,options:any)=>{
  const body=options.body&&JSON.parse(options.body);requests.push({url,body});
  if(url.endsWith('/batches')){if(failure===-1)throw new Error('offline');return {ok:!failure,status:failure||200,json:async()=>failure?{error:'sequence conflict'}:{seq:body.seq}};}
  if(url.endsWith('/sessions'))snapshot.session={id:body.id,seq:0,phase:'ACTIVE'};
  if(url.endsWith('/pause'))snapshot.session.phase='PAUSED';
  return {ok:true,status:200,json:async()=>structuredClone(snapshot)};
 }});
 return {api:module.exports,stored,events,requests,fail:(status:number)=>{failure=status;}};
}
const fix=()=>({position:[5.5797,50.6326],accuracy:5,speed:1,timestamp:Date.now()});

test('offline retry preserves the exact ordered batch and only removes it after success',async()=>{
 const c=client();await c.api.init();await c.api.begin();c.fail(-1);
 for(let i=0;i<5;i++)c.api.recordFix(fix());
 await assert.rejects(c.api.flush(),/offline/);
 const before=JSON.parse(c.stored.get(c.api.storageKey('outbox'))!);assert.equal(before.queue.length,1);assert.equal(before.queue[0].body.fixes.length,5);
 c.fail(0);await c.api.flush();const after=JSON.parse(c.stored.get(c.api.storageKey('outbox'))!);assert.equal(after.queue.length,0);
 const sent=c.requests.filter(r=>r.url.endsWith('/batches'));assert.deepEqual(sent[0].body,sent[1].body);
});

test('a competing session conflict is quarantined locally instead of retrying forever or double-crediting',async()=>{
 const c=client();await c.api.init();await c.api.begin();c.fail(409);
 for(let i=0;i<5;i++)c.api.recordFix(fix());await c.api.flush();
 const archive=[...c.stored.entries()].find(([key])=>key.includes('sync-conflict-'));assert.ok(archive);assert.equal(JSON.parse(archive[1]).queue[0].body.fixes.length,5);
 assert.equal(JSON.parse(c.stored.get(c.api.storageKey('outbox'))!).queue.length,0);
 assert.ok(c.events.some(e=>e.type==='medipulsi:conflict'));
 const count=c.requests.length;await c.api.flush();assert.equal(c.requests.length,count);
});
