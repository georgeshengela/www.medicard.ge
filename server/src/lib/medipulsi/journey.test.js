// MEDIRUN walking engine on the server (audit 2026-10-13): a player standing still at a box keeps a live position,
// and a new walk never inherits the last one's vehicle state. Imported from social.test.js (the npm test script is at
// the Windows command-line limit).
import test from 'node:test';
import assert from 'node:assert/strict';
import {acceptFix,createJourney,lastSeen} from './core/journey.js';
import {pauseJourney,resetSession} from './core/session.js';
import {fresh,isStaleSession,STALE_SESSION_MS} from './service.js';

const T0=Date.parse('2026-10-13T10:00:00+04:00');
const BOX=[44.7930,41.6970];
const east=(p,m)=>[p[0]+m/(111320*Math.cos(p[1]*Math.PI/180)),p[1]];
const fix=(position,timestamp,accuracy=5,speed=null)=>({position,timestamp,accuracy,speed});
/** Walk `meters` east to the box in 3 m steps every 2 s, ending at T0. */
function walkTo(meters=60){
 let j={...createJourney('gps'),status:'waiting'};
 const steps=Math.round(meters/3);
 for(let i=0;i<=steps;i++){const at=T0-(steps-i)*2000;j=acceptFix(j,fix(east(BOX,-(steps-i)*3),at),.72,at);}
 return j;
}

test('standing still at a box: accurate still fixes keep the position fresh (claim/nearby)',()=>{
 let j=walkTo();
 assert.ok(j.meters>40);
 assert.equal(j.lastFix,T0);
 // 14 s of standing still, a fix every second (GPS jitter under a metre).
 for(let s=1;s<=14;s++){const at=T0+s*1000;j=acceptFix(j,fix(east(BOX,(s%2)*.4),at),.72,at);}
 assert.equal(j.status,'stationary');
 // The anchor stays where the last step ended, so slow drift can still add up…
 assert.equal(j.lastFix,T0);
 // …but the server sees the phone is live: a batch arriving 3 s later finds a 3 s old fix, not a 17 s old anchor.
 assert.equal(j.seenAt,T0+14000);
 assert.equal(lastSeen(j),T0+14000);
 assert.equal(fresh(j,T0+17000),true);
 // Without any fix for 15 s it is stale again.
 assert.equal(fresh(j,T0+14000+15000),false);
});

test('freshness still needs precision and a running session',()=>{
 let j=walkTo();
 j=acceptFix(j,fix(BOX,T0+1000),.72,T0+1000);
 assert.equal(fresh(j,T0+2000),true);
 // An imprecise fix (indoors) is not fresh, even right after a good one.
 const blurred=acceptFix(j,fix(BOX,T0+2000,60),.72,T0+2000);
 assert.equal(blurred.status,'inaccurate');
 assert.equal(fresh(blurred,T0+2500),false);
 // A pause forgets the live position.
 const paused=pauseJourney(j,'manual',T0+2000);
 assert.equal(paused.seenAt,null);
 assert.equal(fresh(paused,T0+2500),false);
 // States saved before `seenAt` existed still work from `lastFix`.
 const legacy={...j};delete legacy.seenAt;
 assert.equal(lastSeen(legacy),j.lastFix);
 assert.equal(fresh(legacy,j.lastFix+5000),true);
 assert.equal(fresh(null,T0),false);
});

test('a new walk never inherits the last walk’s vehicle',()=>{
 let j=walkTo();
 // A drive: 20 m/s for several seconds confirms a vehicle.
 for(let s=1;s<=6;s++){const at=T0+s*1000;j=acceptFix(j,fix(east(BOX,s*20),at,5,20),.72,at);}
 assert.ok(j.vehicle);
 assert.equal(j.status,'vehicle');
 const next=resetSession(j);
 assert.equal(next.vehicle,null);
 assert.equal(next.surge,0);
 assert.equal(next.meters,0);
 // The next walk counts from its first steps instead of waiting out 15 s of "calm" first.
 let k=next;const start=T0+600_000,from=east(BOX,500);
 for(let i=0;i<=10;i++){const at=start+i*2000;k=acceptFix(k,fix(east(from,i*3),at),.72,at);}
 assert.equal(k.vehicle??null,null);
 assert.ok(k.meters>=25,`counted ${k.meters} m`);
});

test('an open session nobody touched for 36 h is abandoned; a live or finished one is not',()=>{
 const now=T0;
 const open=(ago,phase='ACTIVE')=>({phase,startedAt:new Date(now-ago-3600_000),updatedAt:new Date(now-ago)});
 assert.equal(isStaleSession(open(37*3600_000),now),true);
 assert.equal(isStaleSession(open(37*3600_000,'PAUSED'),now),true);
 assert.equal(isStaleSession(open(35*3600_000),now),false);
 assert.equal(isStaleSession(open(2*3600_000),now),false);
 assert.equal(isStaleSession(open(100*3600_000,'FINISHED'),now),false);
 assert.equal(isStaleSession(null,now),false);
 // Without an updatedAt the start counts.
 assert.equal(isStaleSession({phase:'ACTIVE',startedAt:new Date(now-40*3600_000)},now),true);
 assert.equal(STALE_SESSION_MS>24*3600_000,true,'longer than the 24 h offline upload window');
});
