import test from 'node:test';
import assert from 'node:assert/strict';
import {allowedApi} from './bridgePolicy.ts';

// Every path the hub and the run screen call must be on the allow-list — a missing one surfaces in the app as
// „მოთხოვნა დაუშვებელია“ (the 2026-10-04 wallet / leaderboard-board outage).
test('MEDIRUN API allow-list covers every read the app makes',()=>{
 for(const p of ['/bootstrap','/nearby','/territory','/grand','/drops','/wallet','/leaderboard','/leaderboard?period=week','/leaderboard?period=season&board=boxes','/leaderboard?period=week&board=meters'])assert.ok(allowedApi(p,'GET'),p);
 for(const p of ['/wallet?x=1','/leaderboard?board=boxes','/admin','/leaderboard?period=year'])assert.equal(allowedApi(p,'GET'),false,p);
 assert.ok(allowedApi('/gifts/glow-2026-10-05-am-01/claim','POST'));
 assert.equal(allowedApi('/wallet','POST'),false);
});

test('crews, the city meter and the weekly card are allowed; nothing else around them',()=>{
 for(const p of ['/crew','/city','/cities','/wrapped'])assert.ok(allowedApi(p,'GET'),p);
 for(const p of ['/crew','/crew/join','/crew/leave','/crew/members/3f2c1a9e-1b2c-4d5e-8f90-123456789abc/remove'])assert.ok(allowedApi(p,'POST'),p);
 assert.ok(allowedApi('/crew','PATCH'));
 for(const p of ['/crew/delete','/crew/members/x/promote','/crew?code=AB'])assert.equal(allowedApi(p,'POST'),false,p);
 assert.equal(allowedApi('/crew/join','GET'),false);
});
