import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_AI_ENGINE,
  OPENROUTER_MODELS,
  buildOpenRouterChatPayload,
  extractStreamDelta,
  normalizeAiEngine,
  openRouterFallbackModels,
  openRouterReasoningFor,
  publicAiEngineCatalog,
  resolveAiEngine,
  resolveOpenRouterModel,
  withOpenRouterModelFallback,
} from './aiEngine.js';

test('unknown or empty engine always becomes Gemini Flash', () => {
  assert.equal(normalizeAiEngine(null), 'gemini_flash');
  assert.equal(normalizeAiEngine(''), DEFAULT_AI_ENGINE);
  assert.equal(normalizeAiEngine('gpt-4o'), 'gemini_flash');
  assert.equal(normalizeAiEngine('gemini_flash'), 'gemini_flash');
  assert.equal(normalizeAiEngine('ling_free'), 'ling_free');
  assert.equal(normalizeAiEngine('evidencemd'), 'evidencemd');
});

test('default user gets OpenRouter Gemini, not EvidenceMD', () => {
  const resolved = resolveAiEngine({});
  assert.equal(resolved.id, 'gemini_flash');
  assert.equal(resolved.provider, 'openrouter');
  assert.equal(resolved.model, OPENROUTER_MODELS.gemini_flash);
  assert.equal(resolved.openRouterModel, 'google/gemini-3.8-flash');
});

test('EvidenceMD remains the clinical high-risk path', () => {
  const resolved = resolveAiEngine({ aiEngine: 'evidencemd' });
  assert.equal(resolved.provider, 'evidencemd');
  assert.equal(resolveOpenRouterModel({ aiEngine: 'evidencemd' }), OPENROUTER_MODELS.gemini_flash);
});

test('Gemini failures do not fall back to Ling', () => {
  assert.deepEqual(openRouterFallbackModels(OPENROUTER_MODELS.gemini_flash), [
    'google/gemini-3.8-flash',
  ]);
  assert.deepEqual(openRouterFallbackModels(OPENROUTER_MODELS.ling_free), [
    'inclusionai/ling-3.0-flash-sante:free',
    'google/gemini-3.8-flash',
  ]);
});

test('OpenRouter helper has no Ling after Gemini', async () => {
  const tried = [];
  await assert.rejects(
    () =>
      withOpenRouterModelFallback(OPENROUTER_MODELS.gemini_flash, async (model) => {
        tried.push(model);
        throw new Error('gemini down');
      }),
    /gemini down/,
  );
  assert.deepEqual(tried, ['google/gemini-3.8-flash']);
});

test('Gemini 3 chat uses medium reasoning inside a 2400-token budget', () => {
  assert.deepEqual(openRouterReasoningFor(OPENROUTER_MODELS.gemini_flash), {
    effort: 'medium',
    exclude: true,
  });
  assert.equal(openRouterReasoningFor(OPENROUTER_MODELS.ling_free), undefined);
  const payload = buildOpenRouterChatPayload({
    model: OPENROUTER_MODELS.gemini_flash,
    messages: [{ role: 'user', content: 'hi' }],
    maxTokens: 2400,
  });
  assert.equal(payload.max_tokens, 2400);
  assert.deepEqual(payload.reasoning, { effort: 'medium', exclude: true });
});

test('catalog is allowlisted and starts with the default', () => {
  const catalog = publicAiEngineCatalog();
  assert.equal(catalog[0].id, 'gemini_flash');
  assert.equal(catalog[0].recommended, true);
  assert.deepEqual(
    catalog.map((row) => row.id),
    ['gemini_flash', 'ling_free', 'evidencemd'],
  );
});

test('stream deltas only expose visible content, never hidden reasoning', () => {
  assert.equal(extractStreamDelta({ choices: [{ delta: { content: 'გა' } }] }), 'გა');
  assert.equal(extractStreamDelta({ choices: [{ delta: { content: '' } }] }), '');
  assert.equal(extractStreamDelta({ choices: [{ delta: { reasoning: 'think' } }] }), '');
  assert.equal(
    extractStreamDelta({ choices: [{ delta: { content: [{ type: 'text', text: 'ok' }] } }] }),
    'ok',
  );
});
