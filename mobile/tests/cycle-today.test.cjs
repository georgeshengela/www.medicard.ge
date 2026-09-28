const {test}=require('node:test'),assert=require('node:assert/strict');
const load=require('./helpers/loadTs.cjs')();
const {cycleToday}=load('src/lib/cycleCanonical.ts');
// 2026-09-29 audit: a cached (offline) bundle must not freeze "today" on the day it was fetched.
test('cycle today never lags the device',()=>{
 assert.equal(cycleToday({meta:{today:'2026-09-28'}},'2026-09-29'),'2026-09-29');
 assert.equal(cycleToday({meta:{today:'2026-09-29'}},'2026-09-29'),'2026-09-29');
 assert.equal(cycleToday({meta:{today:'2026-09-30'}},'2026-09-29'),'2026-09-30');
 assert.equal(cycleToday(null,'2026-09-29'),'2026-09-29');
});
