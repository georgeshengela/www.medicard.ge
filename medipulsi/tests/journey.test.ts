import test from 'node:test';
import assert from 'node:assert/strict';
import {distance} from '../src/engine.ts';
import {createJourney,advanceDemo,acceptFix,mergeIntervals,coveredLength,proximity,parkProgress,loadJourney,validConfig,DEFAULT_CONFIG,PLAYABLE,EDGE,NODES,GIFTS,START,shortestPath,planTo,interpolate,PARK_SHARE,PARK_AREA,DISTRICT_AREA,PARK_METERS} from '../src/journey.ts';

test('OSM park network is connected and every demo transition follows its geometry',()=>{
 let s=createJourney();const c={...DEFAULT_CONFIG,rate:25,scenario:'explore' as const};
 for(let i=0;i<2500;i++){const n=advanceDemo(s,1/60,c);assert.ok(distance(s.position,n.position)<=c.speed/3.6*c.rate/60+.001);assert.ok(n.cursor&&EDGE.get(n.cursor.edge)?.playable);s=n;}
 assert.ok(s.meters>1000);assert.ok(parkProgress(s).unique<=s.meters+.001);assert.ok(s.steps>0);
});
test('speed, simulated time and estimated steps are consistent at 30/60/120 fps',()=>{
 for(const hz of [30,60,120]){let s=createJourney();const c={...DEFAULT_CONFIG,rate:5};for(let i=0;i<hz*10;i++)s=advanceDemo(s,1/hz,c);assert.ok(Math.abs(s.seconds-50)<.001);assert.ok(Math.abs(s.meters-c.speed/3.6*50)<.001);assert.ok(Math.abs(s.steps-s.meters/c.stride)<.001);}
});
test('standing still advances time without awarding steps, distance or coverage',()=>{const s=advanceDemo(createJourney(),.1,{...DEFAULT_CONFIG,scenario:'still'});assert.equal(s.seconds,1);assert.equal(s.meters,0);assert.equal(s.steps,0);assert.equal(coveredLength(s.covered),0);assert.equal(s.speed,0);});
test('returning over the same portion counts exercise but not fresh coverage',()=>{
 const e=PLAYABLE.find(e=>e.length>25)!;let s={...createJourney(),position:NODES[e.a],cursor:{edge:e.id,from:e.a,offset:0}};
 const c={...DEFAULT_CONFIG,rate:1,speed:3.6};for(let i=0;i<100;i++)s=advanceDemo(s,.1,c) as typeof s;
 const first=coveredLength(s.covered);assert.ok(Math.abs(first-10)<.001);
 s={...s,cursor:{edge:e.id,from:e.b,offset:e.length-10}};for(let i=0;i<95;i++)s=advanceDemo(s,.1,c) as typeof s;
 assert.ok(s.meters>19);assert.ok(Math.abs(coveredLength(s.covered)-first)<.001);
});
test('coverage merges overlaps and reverse intervals without double counting',()=>{let x=mergeIntervals([[.1,.4]],[.3,.6]);x=mergeIntervals(x,[.5,.2]);assert.deepEqual(x,[[.1,.6]]);assert.deepEqual(mergeIntervals(x,[.8,.9]),[[.1,.6],[.8,.9]]);});
test('gift has no marker before reveal range; signal uses physical proximity',()=>{
 const g=NODES[GIFTS[0]],s=createJourney();s.position=[g[0],g[1]+80/111195];let p=proximity(s,DEFAULT_CONFIG);assert.equal(p.signal,true);assert.equal(p.revealed,false);
 s.position=[g[0],g[1]+10/111195];p=proximity(s,DEFAULT_CONFIG);assert.equal(p.revealed,true);
 s.claimed=true;assert.equal(proximity(s,DEFAULT_CONFIG).signal,false);assert.equal(proximity(s,DEFAULT_CONFIG).revealed,false);
});
test('uncertain or stale GPS cannot reveal a gift even at its coordinates',()=>{
 const s={...createJourney('gps'),position:NODES[GIFTS[0]],lastFix:Date.now(),accuracy:40};assert.equal(proximity(s,DEFAULT_CONFIG).revealed,false);
 s.accuracy=6;s.lastFix=Date.now()-16000;assert.equal(proximity(s,DEFAULT_CONFIG).revealed,false);
 s.lastFix=Date.now();s.position=[s.position[0],s.position[1]+14/111195];assert.equal(proximity(s,DEFAULT_CONFIG).revealed,false,'accuracy circle must fit inside reveal radius');
});
test('bad simulated GPS moves its test pin but earns no distance, steps or coverage',()=>{const s=advanceDemo(createJourney(),.1,{...DEFAULT_CONFIG,accuracy:40});assert.ok(s.seconds>0);assert.equal(s.meters,0);assert.equal(s.steps,0);assert.equal(coveredLength(s.covered),0);assert.equal(s.status,'inaccurate');});
test('initial GPS fix and resumed gap never draw a teleport line',()=>{
 const now=Date.now(),e=PLAYABLE.find(e=>e.length>30)!;let s=acceptFix(createJourney('gps'),{position:NODES[e.a],accuracy:5,timestamp:now-14000,speed:0});assert.equal(s.meters,0);
 s=acceptFix(s,{position:NODES[e.b],accuracy:5,timestamp:now+2000,speed:1});assert.equal(s.meters,0);assert.equal(coveredLength(s.covered),0);
});
test('cached, invalid and out-of-order location fixes never move the player',()=>{
 const fresh=createJourney('gps'),now=Date.now();
 for(const fix of [{position:NODES[START],accuracy:5,timestamp:now-30000,speed:0},{position:[181,41] as [number,number],accuracy:5,timestamp:now,speed:0}]){const s=acceptFix(fresh,fix);assert.equal(s.status,'invalid');assert.equal(s.meters,0);assert.equal(s.lastFix,null);assert.deepEqual(s.position,fresh.position);}
 const current=acceptFix(fresh,{position:NODES[START],accuracy:5,timestamp:now,speed:0});assert.equal(acceptFix(current,{position:NODES[GIFTS[0]],accuracy:5,timestamp:now-1000,speed:1}).status,'invalid');
});
test('valid movement counts but inaccurate fixes, jitter and vehicle jumps do not',()=>{
 const e=PLAYABLE.find(e=>e.length>40)!,now=Date.now();let s=acceptFix(createJourney('gps'),{position:interpolate(NODES[e.a],NODES[e.b],.15),accuracy:5,timestamp:now-10000,speed:0});
 const wrong=acceptFix(s,{position:NODES[e.b],accuracy:40,timestamp:now-8000,speed:1});assert.equal(wrong.meters,0);assert.equal(wrong.status,'inaccurate');
 const still=acceptFix(s,{position:s.lastRaw!,accuracy:5,timestamp:now-8000,speed:0});assert.equal(still.meters,0);
 s=acceptFix(s,{position:interpolate(NODES[e.a],NODES[e.b],.3),accuracy:5,timestamp:now-5000,speed:1.4});assert.ok(s.meters>2);assert.ok(s.steps>0);
 const jumped=acceptFix(s,{position:[s.position[0]+.03,s.position[1]],accuracy:5,timestamp:now,speed:20});assert.equal(jumped.meters,s.meters);assert.deepEqual(jumped.covered,s.covered);assert.equal(jumped.status,'vehicle');
});
test('route choices connect through actual graph edges without direct cross-park lines',()=>{
 const path=shortestPath(START,GIFTS[0]);assert.ok(path&&path.edges.length>3);let node=START;for(const id of path!.edges){const e=EDGE.get(id)!;assert.ok(e.a===node||e.b===node);node=e.a===node?e.b:e.a;}assert.equal(node,GIFTS[0]);assert.deepEqual(planTo(createJourney(),GIFTS[0]).queue,path!.edges);
});
test('park completion and parent area share are different measures',()=>{
 const s=createJourney();for(const e of PLAYABLE)s.covered[e.id]=[[0,1]];const p=parkProgress(s);assert.equal(p.complete,true);assert.ok(Math.abs(p.unique-PARK_METERS)<.001);assert.ok(PARK_SHARE>0&&PARK_SHARE<100);assert.equal(PARK_SHARE,PARK_AREA/DISTRICT_AREA*100);
});
test('saved coverage and gifts restore, invalid intervals and cross-mode progress do not',()=>{
 const s=createJourney();s.covered[PLAYABLE[0].id]=[[.2,.5]];s.claimed=true;const restored=loadJourney(JSON.stringify(s),'demo');assert.deepEqual(restored.covered,s.covered);assert.equal(restored.claimed,true);assert.equal(loadJourney(JSON.stringify(s),'gps').claimed,false);
 assert.equal(loadJourney('{broken','demo').meters,0);s.covered[PLAYABLE[0].id]=[[-1,2]];assert.equal(coveredLength(loadJourney(JSON.stringify(s),'demo').covered),0);
});
test('demo settings constrain speed, accuracy, range and acceleration',()=>{const c=validConfig({speed:900,rate:100,accuracy:900,revealRadius:500,pulseRadius:1});assert.equal(c.speed,14);assert.equal(c.rate,10);assert.equal(c.accuracy,6);assert.ok(c.revealRadius<c.pulseRadius);});
test('reloading retains the session coverage baseline and rejects an impossible baseline',()=>{const s=createJourney();s.covered[PLAYABLE[0].id]=[[0,1]];s.sessionStartCoverage=PLAYABLE[0].length/2;const restored=loadJourney(JSON.stringify(s),'demo');assert.equal(restored.sessionStartCoverage,s.sessionStartCoverage);s.sessionStartCoverage=1e9;assert.equal(loadJourney(JSON.stringify(s),'demo').sessionStartCoverage,PLAYABLE[0].length);});
