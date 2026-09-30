import test from 'node:test';
import assert from 'node:assert/strict';
import { readTranscript, shouldTreatTranscriptAsEmpty, transcribeAssistantAudio } from './assistantAudio.js';
import { OPENROUTER_MODELS } from './aiEngine.js';

test('model-empty transcription is not a dropped connection', () => {
  assert.equal(shouldTreatTranscriptAsEmpty({ code: 'ASSISTANT_RESPONSE_FAILED' }), true);
  assert.equal(shouldTreatTranscriptAsEmpty({ code: 'AI_EMPTY_RESPONSE' }), true);
});

test('transport and quota failures stay visible', () => {
  assert.equal(shouldTreatTranscriptAsEmpty({ code: 'AI_ENGINE_ERROR', status: 502 }), false);
  assert.equal(shouldTreatTranscriptAsEmpty({ status: 503, code: 'ASSISTANT_SPEECH_UNAVAILABLE' }), false);
  assert.equal(shouldTreatTranscriptAsEmpty({ status: 429 }), false);
});

test('transcript envelopes, raw speech and silence are accepted', () => {
  assert.deepEqual(readTranscript('{"text":"დავლიე 250 მლ წყალი"}'), { ok: true, text: 'დავლიე 250 მლ წყალი' });
  assert.deepEqual(readTranscript('```json\n{"transcript":"კი"}\n```'), { ok: true, text: 'კი' });
  assert.deepEqual(readTranscript('{"text":""}'), { ok: true, text: '' });
  assert.deepEqual(readTranscript('დავლიე 250 მლ წყალი'), { ok: true, text: 'დავლიე 250 მლ წყალი' });
  assert.deepEqual(readTranscript('I could not hear any speech.'), { ok: true, text: '' });
});

test('malformed JSON is not treated as spoken words', () => {
  assert.deepEqual(readTranscript('{"reply":"დავლიე"}'), { ok: false, text: '' });
  assert.deepEqual(readTranscript('{"text":'), { ok: false, text: '' });
});

test('transcription recovers JSON parked in Gemini reasoning', async () => {
  const calls = [];
  const result = await transcribeAssistantAudio({
    data: 'dGVzdA==',
    format: 'm4a',
    ask: async (args) => {
      calls.push(args);
      return { content: '', reasoning: '{"text":"დავლიე 250 მლ წყალი"}' };
    },
  });
  assert.equal(result.text, 'დავლიე 250 მლ წყალი');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].model, OPENROUTER_MODELS.gemini_flash);
  assert.equal(calls[0].responseFormat, undefined);
  assert.equal(calls[0].reasoningExclude, false);
  assert.equal(calls[0].reasoningEffort, 'minimal');
  assert.equal(calls[0].maxTokens, 8000);
});

test('unreadable first envelope retries once then stays empty, quota still throws', async () => {
  const calls = [];
  assert.deepEqual(
    await transcribeAssistantAudio({
      data: 'dGVzdA==',
      format: 'm4a',
      ask: async () => {
        calls.push(1);
        return { content: '{"reply":"nope"}' };
      },
    }),
    { text: '' },
  );
  assert.equal(calls.length, 2);
  await assert.rejects(
    transcribeAssistantAudio({
      data: 'dGVzdA==',
      format: 'm4a',
      ask: async () => {
        throw Object.assign(new Error('quota'), { status: 429 });
      },
    }),
    /quota/,
  );
});

const stall = signal => new Promise((_, reject) => signal.addEventListener('abort', () => reject(new Error('aborted'))));

test('a stalled transcription is sent once more, then answers', async () => {
  let calls = 0;
  const result = await transcribeAssistantAudio({
    data: 'dGVzdA==', format: 'm4a', timeoutMs: [20, 200],
    ask: async ({ signal, messages }) => {
      calls++;
      if (calls === 1) return stall(signal);
      assert.equal(messages.length, 2); // a stall is not an unreadable envelope
      return { content: '{"text":"კი"}' };
    },
  });
  assert.deepEqual(result, { text: 'კი' });
  assert.equal(calls, 2);
});

test('two stalled transcriptions end with an honest timeout', async () => {
  await assert.rejects(
    transcribeAssistantAudio({ data: 'dGVzdA==', format: 'm4a', timeoutMs: [20, 20], ask: async ({ signal }) => stall(signal) }),
    err => err.code === 'ASSISTANT_RESPONSE_TIMEOUT' && err.status === 504 && !/შენარჩუნებულია/.test(err.message),
  );
});

test('a stalled planner call is retried once before failing', async () => {
  const { assistantJson } = await import('./assistantModel.js');
  const { z } = await import('zod');
  const schema = z.object({ reply: z.string() });
  let calls = 0;
  const ok = await assistantJson([{ role: 'user', content: 'x' }], schema, {
    timeoutMs: [20, 200],
    ask: async ({ signal }) => (++calls === 1 ? stall(signal) : { content: '{"reply":"გამარჯობა"}', finishReason: 'stop' }),
  });
  assert.deepEqual(ok, { reply: 'გამარჯობა' });
  assert.equal(calls, 2);
  await assert.rejects(
    assistantJson([{ role: 'user', content: 'x' }], schema, { timeoutMs: [20, 20], ask: async ({ signal }) => stall(signal) }),
    err => err.code === 'ASSISTANT_RESPONSE_TIMEOUT',
  );
});
