import { askOpenRouterPrepared, hasOpenRouter, OPENROUTER_MODELS } from './aiEngine.js';

const failure = () => Object.assign(new Error('პასუხის მიღება შეფერხდა. შენი ნათქვამი შენარჩუნებულია — სცადე ხელახლა.'), { status: 502, code: 'ASSISTANT_RESPONSE_FAILED' });

/** Read-only planning/transcription retries only. Never repair truncated facts or execute here. */
export async function assistantJson(messages, schema, { maxTokens = 3200, ask = askOpenRouterPrepared, timeoutMs = 25000 } = {}) {
  if (ask === askOpenRouterPrepared && !hasOpenRouter()) throw Object.assign(new Error('Medi-ს კავშირი ჯერ არ არის გამართული. შეგიძლია ტექსტით ან ხელით გააგრძელო.'), { status: 503 });
  for (let attempt = 0; attempt < 2; attempt++) {
    let response;
    const signal = AbortSignal.timeout(timeoutMs);
    try {
      response = await ask({ model: OPENROUTER_MODELS.gemini_flash,
        messages: attempt ? [...messages, { role: 'system', content: 'The previous response could not be validated. Return one complete JSON object matching the requested format. No markdown. Do not add or infer missing user facts.' }] : messages,
        temperature: 0.1, maxTokens: attempt ? Math.max(4800, maxTokens) : maxTokens,
        reasoningEffort: 'minimal', skipDisclaimer: true, responseFormat: { type: 'json_object' }, signal });
    } catch (error) {
      if (signal.aborted) throw Object.assign(failure(), { status: 504, code: 'ASSISTANT_RESPONSE_TIMEOUT' });
      if (error.code !== 'AI_EMPTY_RESPONSE') throw error; // Do not retry auth, quota or transport failures.
      if (attempt) throw failure();
      continue;
    }
    if (response.finishReason === 'content_filter') throw failure();
    if (response.finishReason !== 'length' && response.finishReason !== 'error') {
      try {
        const text = String(response.content || '').trim().replace(/^```(?:json)?\s*([\s\S]*?)\s*```$/i, '$1');
        const parsed = schema.safeParse(JSON.parse(text));
        if (parsed.success) return parsed.data;
      } catch { /* A malformed envelope is not a misunderstood user request. Retry once. */ }
    }
  }
  throw failure();
}
