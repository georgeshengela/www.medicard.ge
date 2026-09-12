import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_AI_ENGINE,
  OPENROUTER_MODELS,
  extractStreamDelta,
  normalizeAiEngine,
  openRouterFallbackModels,
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

test('Gemini failures fall back to Ling, never skip Gemini first', () => {
  assert.deepEqual(openRouterFallbackModels(OPENROUTER_MODELS.gemini_flash), [
    'google/gemini-3.8-flash',
    'inclusionai/ling-3.0-flash-sante:free',
  ]);
  assert.deepEqual(openRouterFallbackModels(OPENROUTER_MODELS.ling_free), [
    'inclusionai/ling-3.0-flash-sante:free',
    'google/gemini-3.8-flash',
  ]);
});

test('OpenRouter helper tries Ling after Gemini fails', async () => {
  const tried = [];
  const result = await withOpenRouterModelFallback(OPENROUTER_MODELS.gemini_flash, async (model) => {
    tried.push(model);
    if (model === OPENROUTER_MODELS.gemini_flash) throw new Error('gemini down');
    return model;
  });
  assert.deepEqual(tried, [
    'google/gemini-3.8-flash',
    'inclusionai/ling-3.0-flash-sante:free',
  ]);
  assert.equal(result, OPENROUTER_MODELS.ling_free);
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
