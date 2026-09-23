import test from 'node:test';
import assert from 'node:assert/strict';
import { dispatchCommunityPush } from './communityPush.js';
function fixture({allowed=true,attempts=1}={}){
 const updates=[];let reads=0;
 const db={$executeRaw:async(...args)=>{updates.push(args);return 1;},$queryRaw:async()=>++reads===1?[{id:'notification',postId:'post',userId:'recipient',actorId:'actor',kind:'comment',attempts}]:allowed?[{ok:1}]:[],pushToken:{findMany:async()=>[{token:'ExpoPushToken[test]'}]}};
 return {db,updates};
}
test('push uses generic content and a specific post route, never actor identity',async()=>{const {db,updates}=fixture();let calls=0;await dispatchCommunityPush({db,send:async(tokens,payload)=>{calls++;assert.equal(tokens.length,1);assert.equal(payload.data.route,'/community?post=post');assert.equal(JSON.stringify(payload).includes('actor'),false);return {sent:1};}});assert.equal(calls,1);assert.equal(updates[1][1],'SENT');});
test('opt-out, blocking and ineligible recipient suppress provider calls',async()=>{const {db,updates}=fixture({allowed:false});await dispatchCommunityPush({db,send:async()=>{throw Error('Must not call provider');}});assert.equal(updates[1][1],'SKIPPED');});
test('provider failure is persisted for retry and capped after five attempts',async()=>{for(const attempts of [1,5]){const {db,updates}=fixture({attempts});await dispatchCommunityPush({db,send:async()=>{throw Error('network failure');}});assert.equal(updates[1][1],attempts===5?'FAILED':'PENDING');}});
