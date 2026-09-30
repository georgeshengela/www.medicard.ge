import { askOpenRouterPrepared, hasOpenRouter, OPENROUTER_MODELS } from './aiEngine.js';

const failure = () => Object.assign(new Error('პასუხის მიღება შეფერხდა. შენი ნათქვამი შენარჩუნებულია — სცადე ხელახლა.'), { status: 502, code: 'ASSISTANT_RESPONSE_FAILED', messageEn: 'The reply was delayed. What you said is kept — please try again.' });

/**
 * Read-only planning/transcription retries only. Never repair truncated facts or execute here.
 * A stalled provider call (usual answer 4–7 s) is abandoned early and sent once more — OpenRouter
 * routes the retry fresh — instead of making the person wait 25 s for an error.
 */
export async function assistantJson(messages, schema, { maxTokens = 3200, ask = askOpenRouterPrepared, timeoutMs = [14000, 20000] } = {}) {
  const budgets = Array.isArray(timeoutMs) ? timeoutMs : [timeoutMs, timeoutMs];
  let invalid = false;
  if (ask === askOpenRouterPrepared && !hasOpenRouter()) throw Object.assign(new Error('Medi-ს კავშირი ჯერ არ არის გამართული. შეგიძლია ტექსტით ან ხელით გააგრძელო.'), { status: 503, messageEn: 'Medi isn’t connected yet. You can continue by typing or by hand.' });
  for (let attempt = 0; attempt < 2; attempt++) {
    let response;
    const signal = AbortSignal.timeout(budgets[attempt] ?? budgets[budgets.length - 1]);
    try {
      response = await ask({ model: OPENROUTER_MODELS.gemini_flash,
        messages: invalid ? [...messages, { role: 'system', content: 'The previous response could not be validated. Return one complete JSON object matching the requested format. No markdown. Do not add or infer missing user facts.' }] : messages,
        temperature: 0.1, maxTokens: invalid ? Math.max(4800, maxTokens) : maxTokens,
        reasoningEffort: 'minimal', skipDisclaimer: true, responseFormat: { type: 'json_object' }, signal });
    } catch (error) {
      if (signal.aborted) {
        if (attempt) throw Object.assign(failure(), { status: 504, code: 'ASSISTANT_RESPONSE_TIMEOUT' });
        console.warn('[assistant-plan] provider stalled, retrying once');
        continue;
      }
      if (error.code !== 'AI_EMPTY_RESPONSE') throw error; // Do not retry auth, quota or transport failures.
      if (attempt) throw failure();
      invalid = true;
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
    invalid = true;
  }
  throw failure();
}
