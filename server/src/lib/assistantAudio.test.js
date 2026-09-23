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
