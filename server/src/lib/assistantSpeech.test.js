import test from 'node:test';
import assert from 'node:assert/strict';
process.env.DATABASE_URL ||= 'postgresql://unused@127.0.0.1:1/unused';
process.env.JWT_SECRET ||= 'assistant-speech-unit-test-secret';
process.env.EVIDENCEMD_API_KEY ||= 'disabled-unit-test';
const { hasAssistantSpeech, escapeSpeechXml, synthesizeAssistantSpeech } = await import('./assistantSpeech.js');
const config = { AZURE_SPEECH_KEY: 'test-only-key', AZURE_SPEECH_REGION: 'westeurope', AZURE_SPEECH_VOICE: 'ka-GE-EkaNeural' };
const audio = Buffer.alloc(200); audio.write('ID3');
test('unconfigured voice is honestly unavailable, without sending text', async () => {
  assert.equal(hasAssistantSpeech({ AZURE_SPEECH_KEY: '', AZURE_SPEECH_REGION: '' }), false);
  await assert.rejects(synthesizeAssistantSpeech('test', 'გამარჯობა', { config: {}, transport: () => { throw Error('must not call'); } }), e => e.code === 'ASSISTANT_SPEECH_UNAVAILABLE');
});
test('consent, fixed Azure host, Georgian voice, no redirect and XML escaping', async () => {
  const calls = [];
  const result = await synthesizeAssistantSpeech('test-owner', 'გამარჯობა <audio src="https://bad.test"/> &', {
    config, check: async id => { assert.equal(id, 'test-owner'); calls.push('consent'); },
    transport: async (url, init) => {
      assert.deepEqual(calls, ['consent']); assert.equal(url, 'https://westeurope.tts.speech.microsoft.com/cognitiveservices/v1');
      assert.equal(init.redirect, 'error'); assert.match(init.body, /ka-GE-EkaNeural/);
      assert.ok(!init.body.includes('<audio')); assert.match(init.body, /&lt;audio/); assert.match(init.body, /&amp;/);
      return new Response(audio, { headers: { 'content-type': 'audio/mpeg' } });
    },
  });
  assert.equal(result.format, 'mp3'); assert.equal(result.synthetic, true); assert.equal(Buffer.from(result.data, 'base64').length, 200);
  assert.equal(escapeSpeechXml("<>&\"'"), '&lt;&gt;&amp;&quot;&apos;');
});
test('revoked consent prevents transmission', async () => {
  await assert.rejects(synthesizeAssistantSpeech('owner', 'გამარჯობა', { config,
    check: async () => { throw Error('revoked'); }, transport: () => { throw Error('must not send'); } }), /revoked/);
});
test('invalid host/voice configuration and oversized text are rejected', async () => {
  for (const bad of [{ ...config, AZURE_SPEECH_REGION: 'evil.test/path' }, { ...config, AZURE_SPEECH_VOICE: 'en-US-Unknown' }]) {
    await assert.rejects(synthesizeAssistantSpeech('owner', 'hello', { config: bad }), e => e.code === 'ASSISTANT_SPEECH_UNAVAILABLE');
  }
  await assert.rejects(synthesizeAssistantSpeech('owner', 'a'.repeat(2001), { config }), e => e.status === 400);
});
test('provider errors and invalid audio never leak raw responses or play JSON', async () => {
  for (const response of [new Response('secret provider detail', { status: 401 }), new Response('{}', { headers: { 'content-type': 'audio/mpeg' } }), new Response(audio, { headers: { 'content-type': 'application/json' } })]) {
    await assert.rejects(synthesizeAssistantSpeech('owner', 'hello', { config, check: async () => {}, transport: async () => response }), e => !e.message.includes('secret') && e.status === 502);
  }
});

test('interrupted and oversized audio streams become safe retryable errors', async () => {
  for (const body of [new ReadableStream({ start(controller) { controller.error(new Error('secret transport details')); } }), Buffer.alloc(1500001)]) {
    await assert.rejects(synthesizeAssistantSpeech('owner', 'hello', { config, check: async () => {}, transport: async () => new Response(body, { headers: { 'content-type': 'audio/mpeg' } }) }), e => e.status === 502 && e.code === 'ASSISTANT_SPEECH_FAILED' && !e.message.includes('secret'));
  }
});
