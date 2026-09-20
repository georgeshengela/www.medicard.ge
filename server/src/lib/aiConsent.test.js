import test from 'node:test';
import assert from 'node:assert/strict';
import { AI_CONSENT_VERSION, readAiConsent, recordAiConsent, withAiAccount, currentAiAccount } from './aiConsent.js';
import { consentedAiFetch } from './consentedAiFetch.js';

test('missing, declined, revoked and outdated decisions never authorize AI', async () => {
  for (const row of [null, {version: AI_CONSENT_VERSION, decision:'declined'}, {version:AI_CONSENT_VERSION, decision:'revoked'}, {version:'old',decision:'accepted'}]) {
    const status = await readAiConsent('A', { $queryRaw: async () => row ? [row] : [] });
    assert.equal(status.accepted, false);
  }
  assert.equal((await readAiConsent('A', {$queryRaw:async()=>[{version:AI_CONSENT_VERSION,decision:'accepted'}]})).accepted, true);
  await assert.rejects(() => readAiConsent(null), {code:'AI_CONSENT_REQUIRED'});
});
test('old consent cannot be saved under a changed disclosure', async () => {
  await assert.rejects(() => recordAiConsent('A', {version:'old',decision:'accepted'}, {$transaction:()=>assert.fail('must not write')}), {code:'AI_CONSENT_VERSION_CHANGED'});
});
test('concurrent async request contexts preserve each account', async () => {
  const accounts = await Promise.all(['A','B'].map(id => withAiAccount(id, async () => { await new Promise(r=>setTimeout(r,5)); return currentAiAccount(); })));
  assert.deepEqual(accounts,['A','B']); assert.equal(currentAiAccount(),null);
});
test('every provider attempt rechecks consent, and revoked retry sends no data', async () => {
  let accepted=true, sends=0, checks=0;
  const guarded=consentedAiFetch('openrouter',{account:()=> 'A',check:async id=>{checks++;assert.equal(id,'A');if(!accepted)throw Object.assign(Error('revoked'),{code:'AI_CONSENT_REQUIRED'});},transport:async(input,init)=>{
    sends++;const body=JSON.parse(init.body);assert.equal(body.provider.allow_fallbacks,false);assert.equal(body.provider.zdr,true);assert.equal(body.provider.data_collection,'deny');assert.deepEqual(body.provider.only,['google-vertex/global']);assert.equal(init.redirect,'error');return new Response('{}');
  }});
  const payload={method:'POST',body:JSON.stringify({model:'google/gemini-3.8-flash',messages:[{role:'user',content:'Synthetic'}],provider:{allow_fallbacks:true}})};
  await guarded('https://openrouter.ai/api/v1/chat/completions',payload); accepted=false;
  await assert.rejects(()=>guarded('https://openrouter.ai/api/v1/chat/completions',payload),{code:'AI_CONSENT_REQUIRED'});
  assert.equal(checks,2); assert.equal(sends,1);
});
test('unknown model, direct providers and redirected destinations cannot transmit', async () => {
  const opts={check:async()=>{},account:()=> 'A',transport:()=>assert.fail('No outbound request permitted')};
  for(const url of ['https://api.openai.com/v1/chat/completions','https://openrouter.ai.evil.test/api/v1/chat/completions','http://openrouter.ai/api/v1/chat/completions']) await assert.rejects(()=>consentedAiFetch('openrouter',opts)(url),{code:'AI_PROVIDER_NOT_APPROVED'});
  await assert.rejects(()=>consentedAiFetch('openrouter',opts)('https://openrouter.ai/api/v1/chat/completions',{body:JSON.stringify({model:'undisclosed/provider'})}),{code:'AI_PROVIDER_NOT_APPROVED'});
  await assert.rejects(()=>consentedAiFetch('anthropic',opts)('https://api.anthropic.com/v1/messages'),{code:'AI_PROVIDER_NOT_APPROVED'});
});
test('EvidenceMD also checks consent before transport', async () => {
  const guarded=consentedAiFetch('evidencemd',{account:()=>null,check:async()=>{throw Object.assign(Error('no account'),{code:'AI_CONSENT_REQUIRED'});},transport:()=>assert.fail('must not send')});
  await assert.rejects(()=>guarded('https://evidencemd.ai/api/v1/chat/completions',{method:'POST',body:'{}'}),{code:'AI_CONSENT_REQUIRED'});
});
