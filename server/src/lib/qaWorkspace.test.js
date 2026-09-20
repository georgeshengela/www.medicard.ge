import {test} from 'node:test';
import assert from 'node:assert/strict';
import {qaSummary,qaCheckUpdate,qaRunCreate,decodeQaEvidence,qaEvidenceInput,CYCLE_QA_CASES} from './qaWorkspace.js';
test('QA pending, failed and blocked checks cannot be reported as complete',()=>{
 for(const status of ['PENDING','FAIL','BLOCKED'])assert.equal(qaSummary([{status}]).canComplete,false);
 assert.equal(qaSummary([]).canComplete,false);
 assert.equal(qaSummary([{status:'PASS'},{status:'SKIPPED'}]).canComplete,true);
 assert.equal(qaSummary([{status:'PASS'},{status:'FAIL'},{status:'PENDING'}]).passRate,50);
});
test('QA results require an actual explanation and a concurrency revision',()=>{
 assert.equal(qaCheckUpdate.safeParse({revision:0,status:'FAIL',actual:'',method:'HTTP'}).success,false);
 assert.equal(qaCheckUpdate.safeParse({revision:0,status:'PASS',actual:'Saved and reloaded',method:'HTTP'}).success,true);
 assert.equal(qaCheckUpdate.safeParse({status:'PASS',actual:'Done',method:'DEVICE'}).success,false);
});
test('QA screenshot rejects forged SVG, malformed base64, wrong signatures and large payloads',()=>{
 assert.equal(qaEvidenceInput.safeParse({caption:'x',mimeType:'image/svg+xml',base64:'aaaa'}).success,false);
 assert.throws(()=>decodeQaEvidence({caption:'x',mimeType:'image/png',base64:Buffer.from('<html>not an image</html>').toString('base64')}));
 assert.throws(()=>decodeQaEvidence({caption:'x',mimeType:'image/png',base64:Buffer.alloc(1024*1024+1).toString('base64')}));
});
test('QA catalog has unique cases and keeps device verification explicit',()=>{
 assert.equal(new Set(CYCLE_QA_CASES.map(c=>c.caseKey)).size,CYCLE_QA_CASES.length);
 for(const c of CYCLE_QA_CASES){assert.ok(c.steps);assert.ok(c.expected);}
 assert.ok(CYCLE_QA_CASES.some(c=>c.caseKey==='keyboard'));
 assert.equal(qaRunCreate.safeParse({title:'x',module:'cycle',version:'1',device:'web',environment:'local',extra:'no'}).success,false);
});
