import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_AI_ENGINE,
  OPENROUTER_MODELS,
  buildOpenRouterChatPayload,
  extractStreamDelta,
  extractChatReasoning,
  normalizeAiEngine,
  openRouterFallbackModels,
  openRouterReasoningFor,
  publicAiEngineCatalog,
  resolveAiEngine,
  serverAiEngine,
  resolveOpenRouterModel,
  hasOpenRouter,
  withOpenRouterModelFallback,
  askAi,
  setAskOpenRouterPreparedForTests as setAskOpenRouterPrepared,
  upstreamDetail,
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

test('server chooses the engine; a stored per-user choice is ignored', () => {
  const saved = process.env.AI_DEFAULT_ENGINE;
  try {
    delete process.env.AI_DEFAULT_ENGINE;
    for (const aiEngine of ['evidencemd', 'ling_free', 'gemini_flash', undefined]) {
      assert.equal(resolveAiEngine({ aiEngine }).id, 'gemini_flash');
    }
    assert.equal(serverAiEngine(), 'gemini_flash');
    process.env.AI_DEFAULT_ENGINE = 'evidencemd';
    const resolved = resolveAiEngine({ aiEngine: 'ling_free' });
    assert.equal(resolved.provider, 'evidencemd');
    assert.equal(resolveOpenRouterModel({}), OPENROUTER_MODELS.gemini_flash);
    process.env.AI_DEFAULT_ENGINE = 'gpt-4o';
    assert.equal(serverAiEngine(), 'gemini_flash');
  } finally {
    if (saved === undefined) delete process.env.AI_DEFAULT_ENGINE;
    else process.env.AI_DEFAULT_ENGINE = saved;
  }
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

test('hasOpenRouter is a boolean and does not imply EvidenceMD', () => {
  assert.equal(typeof hasOpenRouter(), 'boolean');
});

test('assistant may request low effort without changing clinical defaults', () => {
  const model='google/gemini-3.8-flash';
  assert.deepEqual(buildOpenRouterChatPayload({model,messages:[],reasoningEffort:'low'}).reasoning,{effort:'low',exclude:true});
  assert.deepEqual(buildOpenRouterChatPayload({model,messages:[]}).reasoning,{effort:'medium',exclude:true});
});

test('transcription may keep Gemini 3 reasoning so a parked transcript is recoverable', () => {
  const model = OPENROUTER_MODELS.gemini_flash;
  assert.deepEqual(
    buildOpenRouterChatPayload({ model, messages: [], reasoningEffort: 'minimal', reasoningExclude: false }).reasoning,
    { effort: 'minimal', exclude: false },
  );
  assert.equal(
    extractChatReasoning({ choices: [{ message: { content: null, reasoning: '{"text":"დავლიე 250 მლ"}' } }] }),
    '{"text":"დავლიე 250 მლ"}',
  );
  assert.equal(extractChatReasoning({ choices: [{ message: { content: 'ხილული' } }] }), '');
});

// 2026-10-14: the Vertex standard queue wrote nothing for 142 s, then failed; EvidenceMD was out of credits.
const FAST = { hedgeAfterMs: 30, firstTextDeadlineMs: 300, streamIdleMs: 120, wholeAnswerHedgeMs: 30, wholeAnswerDeadlineMs: 300, evidenceMdMs: 50 };
const GEMINI = 'google/gemini-3.8-flash';
const hang = (signal) =>
  new Promise((_, reject) => signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })), { once: true }));
async function withProvider(fake, run) {
  setAskOpenRouterPrepared(fake);
  try {
    return await run();
  } finally {
    setAskOpenRouterPrepared(null);
  }
}
const ask = (extra) => askAi({ user: {}, mode: 'DOCTOR', messages: [{ role: 'user', content: 'სინთეზური კითხვა' }], timing: FAST, ...extra });

test('a silent standard queue is raced with the priority queue; the first to write wins', async () => {
  const calls = [];
  const seen = [];
  const result = await withProvider(async ({ route, onDelta, signal }) => {
    calls.push({ route, signal });
    if (!route) return hang(signal);
    onDelta('პასუხი');
    return { content: 'პასუხი', model: GEMINI, engine: 'openrouter' };
  }, () => ask({ onDelta: (text) => seen.push(text) }));
  assert.equal(result.route, 'priority');
  assert.equal(result.engine, 'openrouter');
  assert.deepEqual(seen, ['პასუხი']);
  assert.deepEqual(calls.map((c) => c.route), [undefined, 'priority']);
  assert.equal(calls[0].signal.aborted, true, 'the stalled standard request is cancelled');
});

test('a standard failure before any word goes to the priority queue at once, not after the hedge wait', async () => {
  const calls = [];
  const began = Date.now();
  const result = await withProvider(async ({ route, onDelta }) => {
    calls.push(route);
    if (!route) throw Object.assign(new Error('Provider returned error'), { status: 502 });
    onDelta('კარგი');
    return { content: 'კარგი', model: GEMINI };
  }, () => ask({ onDelta: () => {}, timing: { ...FAST, hedgeAfterMs: 10_000 } }));
  assert.equal(result.route, 'priority');
  assert.deepEqual(calls, [undefined, 'priority']);
  assert.ok(Date.now() - began < 2_000);
});

test('a standard answer that writes first keeps the priority queue untouched', async () => {
  const calls = [];
  const result = await withProvider(async ({ route, onDelta }) => {
    calls.push(route);
    onDelta('სწრაფი');
    return { content: 'სწრაფი', model: GEMINI };
  }, () => ask({ onDelta: () => {} }));
  assert.equal(result.route, 'standard');
  assert.deepEqual(calls, [undefined]);
});

test('when neither queue writes in time the person gets a clear timeout, with the cause for admin', async () => {
  const calls = [];
  await withProvider(async ({ route, signal }) => {
    calls.push(route);
    return hang(signal);
  }, () => assert.rejects(() => ask({ onDelta: () => {} }), (error) => {
    assert.equal(error.code, 'AI_STALLED');
    assert.match(error.message, /დროულად ვერ უპასუხა/);
    assert.match(error.adminDetail, /standard \+ priority: no answer in \d+ s/);
    assert.match(error.adminDetail, /EvidenceMD/);
    return true;
  }));
  assert.deepEqual(calls, [undefined, 'priority']);
});

test('silence after the first words stops the answer instead of hanging, and nothing is swapped in', async () => {
  const calls = [];
  const seen = [];
  await withProvider(async ({ route, onDelta, signal }) => {
    calls.push(route);
    onDelta('დასაწყისი');
    return hang(signal);
  }, () => assert.rejects(() => ask({ onDelta: (text) => seen.push(text) }), (error) => {
    assert.equal(error.code, 'AI_STALLED');
    assert.equal(error.aiStarted, true);
    assert.match(error.message, /შუაში შეწყდა/);
    return true;
  }));
  assert.deepEqual(calls, [undefined], 'no second queue once words were shown');
  assert.deepEqual(seen, ['დასაწყისი']);
});

test('an unstreamed answer is raced too, and a broken Georgian reply counts as a failure', async () => {
  const calls = [];
  const result = await withProvider(async ({ route }) => {
    calls.push(route);
    if (!route) return { content: 'პასუხი გაქვს', model: GEMINI };
    return { content: 'ნორმალური ქართული პასუხი.', model: GEMINI };
  }, () => ask({}));
  assert.equal(result.route, 'priority');
  assert.deepEqual(calls, [undefined, 'priority']);
});

test('a person who leaves before the hedge starts no second request', async () => {
  const calls = [];
  const controller = new AbortController();
  setTimeout(() => controller.abort(), 10);
  await withProvider(async ({ route, signal }) => {
    calls.push(route);
    return hang(signal);
  }, () => assert.rejects(() => ask({ onDelta: () => {}, signal: controller.signal })));
  await new Promise((resolve) => setTimeout(resolve, 60));
  assert.deepEqual(calls, [undefined]);
});

test('upstream detail keeps the provider reason short and readable', () => {
  const apiError = Object.assign(new Error('502 Provider returned error'), {
    status: 502,
    name: 'InternalServerError',
    error: { message: 'Provider returned error', metadata: { provider_name: 'Google' } },
  });
  assert.equal(upstreamDetail(apiError), '502 · InternalServerError · Google · Provider returned error');
  assert.equal(upstreamDetail({ cause: apiError }), '502 · InternalServerError · Google · Provider returned error');
  assert.equal(upstreamDetail(null), '');
});
