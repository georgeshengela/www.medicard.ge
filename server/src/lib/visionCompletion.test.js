import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertVisionCompletion } from './visionCompletion.js';

test('incomplete OCR, filtered content and refusals never pass as finished image analysis', () => {
  for (const finish_reason of ['length', 'content_filter', 'tool_calls']) {
    assert.throws(() => assertVisionCompletion({ choices: [{ finish_reason, message: { content: 'partial values' } }] }, 'openrouter'));
  }
  for (const stop_reason of ['max_tokens', 'tool_use', 'pause_turn', 'refusal']) {
    assert.throws(() => assertVisionCompletion({ stop_reason, content: [{ type: 'text', text: 'partial' }] }, 'anthropic'));
  }
  assert.throws(() => assertVisionCompletion({ choices: [{ finish_reason: 'stop', message: { refusal: 'declined' } }] }, 'openai'));
  assert.doesNotThrow(() => assertVisionCompletion({ choices: [{ finish_reason: 'stop', message: { content: 'complete notes' } }] }, 'openrouter'));
  assert.doesNotThrow(() => assertVisionCompletion({ stop_reason: 'end_turn' }, 'anthropic'));
});
