import test from 'node:test';
import assert from 'node:assert/strict';
import {appendTrail,loadTrail,trailFeatures} from '../src/trail.ts';
import {createJourney,acceptFix,loadJourney,coverageFeatures,advanceDemo,DEFAULT_CONFIG,coveredLength} from '../src/journey.ts';
import {pauseJourney,resetSession} from '../src/session.ts';
import type {Coordinate} from '../src/engine.ts';

const origin:Coordinate=[44.8005,41.6934];
const point=(m:number):Coordinate=>[origin[0],origin[1]+m/111195];
const fix=(m:number,timestamp:number,accuracy=5)=>({position:point(m),timestamp,accuracy,speed:1});

test('accepted movement outside Vake leaves a permanent trace without claiming park coverage',()=>{
 const now=Date.now();let s=acceptFix(createJourney('gps'),fix(0,now-9000));
 s=acceptFix(s,fix(5,now-4000));s=acceptFix(s,fix(9,now));
 assert.ok(s.meters>8);assert.equal(s.trail?.length,1);assert.equal(s.trail?.[0].length,3);
 assert.equal(coverageFeatures(s).features.length,0);assert.equal(trailFeatures(s.trail).features.length,1);
 const restored=loadJourney(JSON.stringify(resetSession(s)),'gps');
 assert.equal(restored.meters,0);assert.deepEqual(restored.trail,s.trail);
 assert.deepEqual(trailFeatures(restored.trail),trailFeatures(s.trail));
});

test('pause and a long GPS gap never paint the unobserved link',t=>{
 let now=Date.now();t.mock.method(Date,'now',()=>now);
 let s=acceptFix(createJourney('gps'),fix(0,now-5000));s=acceptFix(s,fix(5,now));
 const saved=s.trail;s=pauseJourney(s);now+=5000;
 s=acceptFix(s,fix(50,now));assert.deepEqual(s.trail,saved);
 now+=5000;s=acceptFix(s,fix(55,now));assert.equal(s.trail?.length,2);
 const beforeGap=s.trail;now+=20000;s=acceptFix(s,fix(100,now));assert.deepEqual(s.trail,beforeGap);
 now+=5000;s=acceptFix(s,fix(105,now));assert.equal(s.trail?.length,3);
});

test('bad GPS, stationary fixes and vehicles leave no new painted line',()=>{
 const now=Date.now();const s=acceptFix(createJourney('gps'),fix(0,now-5000));
 for(const f of [fix(0,now),fix(5,now,40),fix(100,now),fix(5,now-30000)])assert.deepEqual(acceptFix(s,f).trail,[]);
 const bad=acceptFix(s,fix(3,now-2000,40));assert.deepEqual(acceptFix(bad,fix(5,now)).trail,[]);
});

test('trace chunks retain earlier paths and never join separated walks',()=>{
 let trail=appendTrail([],point(0),point(4));
 for(let i=2;i<260;i++)trail=appendTrail(trail,point((i-1)*4),point(i*4));
 assert.equal(trail.length,3);assert.ok(trail.every(line=>line.length<=128));
 const prior=JSON.stringify(trail),next=appendTrail(trail,point(2000),point(2004));
 assert.equal(next.length,4);assert.equal(JSON.stringify(trail),prior);
 assert.deepEqual(loadTrail(JSON.parse(JSON.stringify(next))),next);
});

test('legacy saves still restore and malformed traces do not create fake connections',()=>{
 const s=createJourney('gps');delete s.trail;assert.deepEqual(loadJourney(JSON.stringify(s),'gps').trail,[]);
 assert.deepEqual(loadTrail([null,[point(0)],[point(0),[NaN,42]],[point(0),point(200)],[[181,0],[181,1]]]),[]);
 assert.deepEqual(loadJourney(JSON.stringify({...s,trail:[[point(0),point(4)]]}),'demo').trail,[]);
});

test('demo coverage survives finishing, reloading and walking again',()=>{
 let s=createJourney();for(let i=0;i<500;i++)s=advanceDemo(s,.1,{...DEFAULT_CONFIG,rate:10});
 const painted=coverageFeatures(s),unique=coveredLength(s.covered);
 s=loadJourney(JSON.stringify(resetSession(s)),'demo');assert.deepEqual(coverageFeatures(s),painted);
 for(let i=0;i<200;i++)s=advanceDemo(s,.1,{...DEFAULT_CONFIG,rate:10});
 assert.ok(coveredLength(s.covered)>=unique);
 for(const [id,ranges] of Object.entries(loadJourney(JSON.stringify(resetSession(s)),'demo').covered))assert.deepEqual(ranges,s.covered[id]);
});
