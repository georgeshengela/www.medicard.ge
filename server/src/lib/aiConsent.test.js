import test from 'node:test';
import assert from 'node:assert/strict';
import { AI_CONSENT_VERSION, readAiConsent, recordAiConsent, withAiAccount, currentAiAccount } from './aiConsent.js';
import { approvedProviderRouting, consentedAiFetch } from './consentedAiFetch.js';
import { aiConsentBodySchema } from '../routes/ai-consent.routes.js';

test('consent version is an explicit epoch, not a hash of UI copy', () => {
  assert.match(AI_CONSENT_VERSION, /^\d{4}-\d{2}-\d{2}\.\d+$/);
});
test('the PUT body accepts the current epoch version and rejects foreign fields', () => {
  for (const decision of ['accepted', 'declined', 'revoked']) {
    assert.deepEqual(aiConsentBodySchema.parse({ version: AI_CONSENT_VERSION, decision }), { version: AI_CONSENT_VERSION, decision });
  }
  assert.equal(aiConsentBodySchema.safeParse({ version: AI_CONSENT_VERSION, decision: 'accepted', userId: 'B' }).success, false);
  assert.equal(aiConsentBodySchema.safeParse({ version: '', decision: 'accepted' }).success, false);
  assert.equal(aiConsentBodySchema.safeParse({ version: AI_CONSENT_VERSION, decision: 'maybe' }).success, false);
});
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
    sends++;const body=JSON.parse(init.body);assert.equal(body.provider.allow_fallbacks,false);assert.equal(body.provider.zdr,true);assert.equal(body.provider.data_collection,'deny');assert.deepEqual(body.provider.only,['google-vertex/global','google-vertex/global/priority']);assert.deepEqual(body.provider.order,['google-vertex/global','google-vertex/global/priority']);assert.equal(init.redirect,'error');return new Response('{}');
  }});
  const payload={method:'POST',body:JSON.stringify({model:'google/gemini-3.8-flash',messages:[{role:'user',content:'Synthetic'}],provider:{allow_fallbacks:true}})};
  await guarded('https://openrouter.ai/api/v1/chat/completions',payload); accepted=false;
  await assert.rejects(()=>guarded('https://openrouter.ai/api/v1/chat/completions',payload),{code:'AI_CONSENT_REQUIRED'});
  assert.equal(checks,2); assert.equal(sends,1);
});
test('a priority request puts the disclosed priority host first and never leaks the route header', async () => {
  let sent=null;
  const guarded=consentedAiFetch('openrouter',{account:()=> 'A',check:async()=>{},transport:async(_input,init)=>{sent=init;return new Response('{}');}});
  await guarded('https://openrouter.ai/api/v1/chat/completions',{method:'POST',headers:{'x-medicard-ai-route':'priority'},body:JSON.stringify({model:'google/gemini-3.8-flash',messages:[{role:'user',content:'Synthetic'}]})});
  const body=JSON.parse(sent.body);
  assert.deepEqual(body.provider.only,['google-vertex/global','google-vertex/global/priority']);
  assert.deepEqual(body.provider.order,['google-vertex/global/priority','google-vertex/global']);
  assert.equal(body.provider.allow_fallbacks,false); assert.equal(body.provider.zdr,true); assert.equal(body.provider.data_collection,'deny');
  assert.equal(sent.headers.get('x-medicard-ai-route'),null);
  // A model without a priority host keeps its single disclosed host.
  assert.deepEqual(approvedProviderRouting('inclusionai/ling-3.0-flash-sante:free','priority').order,['novita']);
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
test('English readers get the response-language directive as the last system instruction; Georgian and opt-out do not', async () => {
  const bodies = [];
  const guarded = (language) => consentedAiFetch('openrouter', { account: () => 'A', check: async () => {}, language, transport: async (_url, init) => { bodies.push({ body: JSON.parse(init.body), headers: init.headers }); return new Response('{}'); } });
  const payload = { model: 'google/gemini-3.8-flash', messages: [{ role: 'system', content: 'static' }, { role: 'system', content: 'clock' }, { role: 'user', content: 'hi' }] };
  const url = 'https://openrouter.ai/api/v1/chat/completions';
  await guarded(async () => 'en')(url, { method: 'POST', body: JSON.stringify(payload) });
  await guarded(async () => 'ka')(url, { method: 'POST', body: JSON.stringify(payload) });
  await guarded(async () => 'en')(url, { method: 'POST', body: JSON.stringify(payload), headers: { 'x-medicard-ai-language': 'off' } });
  const [en, ka, off] = bodies;
  assert.equal(en.body.messages.length, 4);
  assert.equal(en.body.messages[2].role, 'system');
  assert.match(en.body.messages[2].content, /RESPONSE LANGUAGE: English/);
  assert.equal(en.body.messages[0].content, 'static');
  assert.deepEqual(ka.body.messages, payload.messages);
  assert.deepEqual(off.body.messages, payload.messages);
  assert.equal(off.headers.get('x-medicard-ai-language'), null);
});
test('the AI context carries the reading language', async () => {
  const { currentAiLanguage, setAiLanguage } = await import('./aiConsent.js');
  assert.equal(await withAiAccount('A', async () => currentAiLanguage(), 'en'), 'en');
  assert.equal(await withAiAccount('A', async () => { setAiLanguage('en'); return currentAiLanguage(); }), 'en');
  assert.equal(await withAiAccount('A', async () => currentAiLanguage()), 'ka');
  assert.equal(currentAiLanguage(), 'ka');
});
test('an AI call after a multer upload still sees the account and language (MEDISCAN „Connection error.“, 2026-10-12)', async () => {
  const { default: express } = await import('express');
  const { default: multer } = await import('multer');
  const { currentAiLanguage, rebindAiAccount } = await import('./aiConsent.js');
  const upload = multer({ storage: multer.memoryStorage() });
  const app = express();
  // What requireAuth does: the rest of the chain runs inside the account's AI context.
  app.use((req, _res, next) => { req.user = { id: 'A' }; req.lang = 'en'; withAiAccount('A', () => next(), 'en'); });
  const seen = (req, res) => res.json({ account: currentAiAccount(), lang: currentAiLanguage() });
  app.post('/lost', upload.single('file'), seen);
  app.post('/kept', upload.single('file'), rebindAiAccount, seen);
  const server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  try {
    const post = async (path) => {
      const body = new FormData();
      body.append('file', new Blob([Buffer.alloc(64 * 1024, 1)], { type: 'image/jpeg' }), 'lab.jpg');
      return (await fetch(`http://127.0.0.1:${server.address().port}${path}`, { method: 'POST', body })).json();
    };
    // Documents why the middleware exists: multer resumes the chain outside the context.
    assert.deepEqual(await post('/lost'), { account: null, lang: 'ka' });
    assert.deepEqual(await post('/kept'), { account: 'A', lang: 'en' });
  } finally {
    server.close();
  }
});
