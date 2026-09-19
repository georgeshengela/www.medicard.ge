import test from 'node:test';
import assert from 'node:assert/strict';
import {MISSIONS,emptyBook,advanceMission,loadBook,missionProgress,missionPercent,missionCircle} from '../src/missions.ts';
import {createJourney,acceptFix} from '../src/journey.ts';
import {pauseJourney,resetSession} from '../src/session.ts';
const m=MISSIONS.find(m=>m.id==='freedom')!;
function pair(){const now=Date.now();const before={...createJourney('gps'),position:[...m.center] as [number,number],accuracy:5,lastFix:now-4000,status:'tracking'};const after={...before,position:[m.center[0],m.center[1]+4/111195] as [number,number],meters:4,movingSeconds:4,lastFix:now};return {before,after,book:{...emptyBook(),selected:m.id}};}
test('catalogue uses unique IDs, bounded city coordinates and practical goals',()=>{assert.equal(new Set(MISSIONS.map(m=>m.id)).size,MISSIONS.length);assert.ok(MISSIONS.length>=24);for(const m of MISSIONS){assert.ok(m.center[0]>44.7&&m.center[0]<44.9&&m.center[1]>41.68&&m.center[1]<41.8);assert.ok(m.radius>=100&&m.radius<=1000);assert.ok(m.meters>=100&&m.seconds===60);assert.match(m.source,/^https:\/\//);}});
test('selecting or looking at a mission does not complete it',()=>{const {before,book}=pair();assert.equal(advanceMission(book,before,before),book);assert.equal(missionPercent(book,m),0);assert.equal(advanceMission(emptyBook(),before,before).selected,null);});
test('accepted walking counts only the selected mission within its zone',()=>{const {before,after,book}=pair();const next=advanceMission(book,before,after);assert.equal(missionProgress(next,m).meters,4);assert.equal(Object.keys(next.progress).length,1);});
test('standing still, teleports, fast vehicles and poor accuracy never count',()=>{const {before,after,book}=pair();for(const invalid of [{...after,meters:0},{...after,meters:80},{...after,accuracy:40},{...after,status:'vehicle'},{...after,position:[45,42] as [number,number]},{...after,lastFix:Date.now()-20000},{...after,source:'demo' as const}])assert.equal(advanceMission(book,before,invalid),book);});
test('both endpoints and their GPS uncertainty circles must be inside the zone',()=>{const {before,after,book}=pair();const border={...before,position:[m.center[0],m.center[1]+148/111195] as [number,number]};assert.equal(advanceMission(book,border,{...after,position:border.position}),book);assert.equal(advanceMission(book,{...before,accuracy:35},after),book);});
test('distance alone does not earn a stamp; completion is awarded once',()=>{const {before,after,book}=pair();book.progress[m.id]={meters:m.meters,seconds:58,completedAt:null};const done=advanceMission(book,before,after);assert.ok(missionProgress(done,m).completedAt);assert.equal(missionPercent(done,m),100);assert.equal(advanceMission(done,before,after),done);});
test('mission progress persists across choosing another mission and reloading',()=>{const {before,after,book}=pair();const next=advanceMission(book,before,after);next.selected='lisi';const restored=loadBook(JSON.parse(JSON.stringify(next)));assert.equal(restored.selected,'lisi');assert.equal(missionProgress(restored,m).meters,4);});
test('malformed saved stamps cannot fabricate completion',()=>{const data={version:1,selected:'unknown',progress:{freedom:{meters:0,seconds:60,completedAt:new Date().toISOString()},lisi:{meters:NaN,seconds:-1,completedAt:'bad'}}};const b=loadBook(data);assert.equal(b.selected,null);assert.equal(b.progress.freedom.completedAt,null);assert.equal(b.progress.lisi.meters,0);assert.equal(b.progress.lisi.seconds,0);});
test('pause and resume never connect an unobserved GPS interval into a mission',()=>{const {before,after,book}=pair();const paused=pauseJourney(before,'background');assert.equal(advanceMission(book,paused,after),book);assert.equal(advanceMission(book,before,{...after,movingSeconds:20}),book);});
test('mission circle is a closed display polygon with finite coordinates',()=>{const ring=missionCircle(m).geometry.coordinates[0];assert.equal(ring.length,65);assert.ok(Math.abs(ring[0][0]-ring.at(-1)![0])<1e-9);assert.ok(ring.every(p=>p.every(Number.isFinite)));});
test('ending the exercise keeps mission and map progress separate',()=>{const {before,after,book}=pair();const progressed=advanceMission(book,before,after);const ended=resetSession(after);assert.equal(advanceMission(progressed,after,ended),progressed);});

test('real GPS pipeline completes Freedom Square without needing the Vake path network',t=>{
 let now=Date.now();t.mock.method(Date,'now',()=>now);
 let journey=createJourney('gps');let book:ReturnType<typeof emptyBook>={...emptyBook(),selected:m.id};
 for(let i=0;i<=32;i++){
  now+=3000;
  const next=acceptFix({...journey,seconds:journey.seconds+3},{position:[m.center[0],m.center[1]+i*4/111195],accuracy:5,timestamp:now,speed:4/3});
  book=advanceMission(book,journey,next);journey=next;
 }
 assert.equal(journey.status,'off-path');
 assert.ok(journey.meters>=120);
 assert.ok(missionProgress(book,m).completedAt);
 assert.equal(missionPercent(book,m),100);
 assert.equal(Object.keys(journey.covered).length,0);
});
