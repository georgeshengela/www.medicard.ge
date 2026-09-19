import test from 'node:test';
import assert from 'node:assert/strict';
import {ROUTE,SEGMENTS,TOTAL,GIFT_AT,EMPTY,distance,pointAt,lineTo,coverage,heartbeatDistance,heartbeatPeriod,loadProgress} from '../src/engine.ts';
test('route distance is measured in metres and endpoints clamp to the playable route',()=>{
 assert.ok(TOTAL>1000&&TOTAL<2000);assert.deepEqual(pointAt(-100),ROUTE[0]);assert.deepEqual(pointAt(TOTAL+500),ROUTE.at(-1));assert.ok(distance(pointAt(0),pointAt(10))>9.99);
});
test('partial traversal does not claim a whole segment',()=>{
 const length=SEGMENTS[0]/2;const line=lineTo(length);assert.equal(line.length,2);assert.ok(Math.abs(distance(line[0],line[1])-length)<.02);assert.notDeepEqual(line[1],ROUTE[1]);
});
test('completion threshold and actual road coverage stay distinct',()=>{
 assert.equal(coverage(TOTAL*.849).completed,false);assert.equal(coverage(TOTAL*.85).completed,true);assert.equal(coverage(TOTAL*.85).percent,85);assert.equal(coverage(TOTAL*2).percent,100);assert.equal(coverage(-10).percent,0);
});
test('remaining route distance gets closer to gift with bounded heartbeat intervals',()=>{
 assert.equal(heartbeatDistance(GIFT_AT),0);assert.equal(heartbeatPeriod(151),0);assert.ok(heartbeatPeriod(100)>heartbeatPeriod(60));assert.ok(heartbeatPeriod(60)>heartbeatPeriod(20));assert.ok(heartbeatPeriod(20)>heartbeatPeriod(5));
});
test('malformed or incompatible saved data cannot poison progress',()=>{
 assert.deepEqual(loadProgress('not json'),EMPTY);assert.deepEqual(loadProgress('{"version":2,"meters":999}'),EMPTY);assert.equal(loadProgress('{"version":1,"meters":-20,"seconds":-2}').meters,0);assert.equal(loadProgress('{"version":1,"meters":"300","claimed":"yes"}').claimed,false);assert.equal(loadProgress(JSON.stringify({...EMPTY,meters:TOTAL+100})).meters,TOTAL);
});
test('progress and reward survive serialization',()=>{
 const p={...EMPTY,meters:742,seconds:32,claimed:true};assert.deepEqual(loadProgress(JSON.stringify(p)),p);
});
