import test from 'node:test';
import assert from 'node:assert/strict';
import {allowedApi,parseBridgeMessage,trustedGameUrl} from '../../mobile/src/components/medipulsi/bridgePolicy.ts';
test('native bridge only permits first-party game navigation and game API operations',()=>{
 const base='https://medicard.ge/medipulsi/?native=1';
 assert.equal(trustedGameUrl(base,base),true);
 for(const url of ['https://evil.example/medipulsi/','https://medicard.ge/admin','https://medicard.ge/medipulsi/other','https://medicard.ge.evil.example/medipulsi/','javascript:alert(1)'])assert.equal(trustedGameUrl(url,base),false);
 assert.equal(allowedApi('/bootstrap','GET'),true);assert.equal(allowedApi('/sessions','POST'),true);assert.equal(allowedApi('/sessions/a-123/batches','POST'),true);
 for(const path of ['/../admin','/admin','/bootstrap?token=x','//evil.example','/api/auth/me','/sessions/../../account'])assert.equal(allowedApi(path,'GET'),false);
 assert.equal(allowedApi('/settings','GET'),false);assert.equal(allowedApi('/bootstrap','POST'),false);
});
test('native bridge rejects malformed, unbounded, or unrelated messages',()=>{
 assert.equal(parseBridgeMessage('not json'),null);assert.equal(parseBridgeMessage('x'.repeat(100001)),null);assert.equal(parseBridgeMessage(JSON.stringify({id:'x',channel:'other',action:'api'})),null);
 assert.ok(parseBridgeMessage(JSON.stringify({id:'x',channel:'medipulsi',action:'api',payload:{path:'/bootstrap',method:'GET'}})));
});
