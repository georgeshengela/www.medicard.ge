import { AI_LANGUAGE_HEADER, AI_ROUTE_HEADER, consentedAiFetch } from './consentedAiFetch.js';
import OpenAI from 'openai';
import { env } from '../config/env.js';
import { looksLikeBrokenDoctorReply } from './prompts.js';
import { askEvidenceMd, AiEngineError, ensureDisclaimer } from './evidencemd.js';
import { buildClinicalMessages } from './clinicalMessages.js';

export { buildClinicalMessages } from './clinicalMessages.js';

/** Known engines. Unknown / empty → Gemini Flash. */
export const DEFAULT_AI_ENGINE = 'gemini_flash';
export const AI_ENGINE_IDS = Object.freeze(['gemini_flash', 'ling_free', 'evidencemd']);

export const OPENROUTER_MODELS = Object.freeze({
  gemini_flash: 'google/gemini-3.8-flash',
  ling_free: 'inclusionai/ling-3.0-flash-sante:free',
});

const openrouter = env.OPENROUTER_API_KEY
  ? new OpenAI({
      apiKey: env.OPENROUTER_API_KEY,
      baseURL: env.OPENROUTER_BASE_URL,
      fetch: consentedAiFetch('openrouter'),
      timeout: 180_000,
      maxRetries: 2,
      defaultHeaders: {
        'HTTP-Referer': 'https://medicard.ge',
        'X-Title': 'Medicard.GE',
      },
    })
  : null;

export function normalizeAiEngine(raw) {
  const id = String(raw || '').trim();
  if (id === 'ling_free' || id === 'evidencemd') return id;
  return DEFAULT_AI_ENGINE;
}

/**
 * The server chooses the engine (2026-09-27): there is no user-facing model picker any more.
 * A stored `User.aiEngine` from older clients is ignored. Ops can override with AI_DEFAULT_ENGINE.
 * Every engine here is already a named recipient in the AI disclosure manifest.
 */
export function serverAiEngine() {
  return normalizeAiEngine(process.env.AI_DEFAULT_ENGINE);
}

export function resolveAiEngine(_user) {
  const id = serverAiEngine();
  if (id === 'evidencemd') {
    return {
      id,
      provider: 'evidencemd',
      model: env.EVIDENCEMD_MODEL,
      openRouterModel: OPENROUTER_MODELS.gemini_flash,
    };
  }
  return {
    id,
    provider: 'openrouter',
    model: OPENROUTER_MODELS[id],
    openRouterModel: OPENROUTER_MODELS[id],
  };
}

/** Pixels / structured helpers always go through OpenRouter. EvidenceMD users still get Gemini. */
export function resolveOpenRouterModel(user) {
  return resolveAiEngine(user).openRouterModel;
}

export function openRouterFallbackModels(primary) {
  const gemini = OPENROUTER_MODELS.gemini_flash;
  const ling = OPENROUTER_MODELS.ling_free;
  // Ling mangles Georgian. Never use it as Gemini's safety net — EvidenceMD is askAi's last resort.
  if (primary === ling) return [ling, gemini];
  return [gemini];
}

/** Gemini 3 reasoning is mandatory; medium + 2400 tokens leaves room for a full Georgian reply. */
export function openRouterReasoningFor(model) {
  if (String(model || '').includes('gemini-3')) {
    return { effort: 'medium', exclude: true };
  }
  return undefined;
}

export function buildOpenRouterChatPayload({
  model,
  messages,
  temperature = 0.2,
  maxTokens = 2400,
  stream = false,
  responseFormat,
  reasoningEffort,
  reasoningExclude,
}) {
  const reasoning = openRouterReasoningFor(model);
  const next = reasoning ? { ...reasoning } : undefined;
  if (next && ['minimal', 'low', 'medium', 'high'].includes(reasoningEffort)) next.effort = reasoningEffort;
  if (next && reasoningExclude === false) next.exclude = false;
  return {
    model,
    messages,
    temperature,
    max_tokens: maxTokens,
    stream,
    ...(responseFormat ? { response_format: responseFormat } : {}),
    ...(next ? { reasoning: next } : {}),
  };
}

export async function withOpenRouterModelFallback(primary, run) {
  let lastError = null;
  for (const model of openRouterFallbackModels(primary)) {
    try {
      return await run(model);
    } catch (error) {
      lastError = error;
      console.warn('[medicard] openrouter model failed', model, error?.adminDetail || error?.message || error);
    }
  }
  throw lastError ?? new AiEngineError('სამედიცინო ანალიზის სერვისთან დაკავშირება ვერ მოხერხდა.', { status: 502, messageEn: 'We could not reach the medical analysis service.' });
}

export function publicAiEngineCatalog() {
  return [
    {
      id: 'gemini_flash',
      provider: 'openrouter',
      model: OPENROUTER_MODELS.gemini_flash,
      recommended: true,
    },
    {
      id: 'ling_free',
      provider: 'openrouter',
      model: OPENROUTER_MODELS.ling_free,
      recommended: false,
    },
    {
      id: 'evidencemd',
      provider: 'evidencemd',
      model: env.EVIDENCEMD_MODEL,
      recommended: false,
    },
  ];
}

function joinTextParts(raw) {
  if (typeof raw === 'string') return raw.trim();
  if (Array.isArray(raw)) {
    return raw
      .map((part) => (typeof part === 'string' ? part : part?.text || part?.content || ''))
      .join('')
      .trim();
  }
  return '';
}

export function extractChatContent(completion) {
  const msg = completion?.choices?.[0]?.message;
  if (!msg) return '';
  return joinTextParts(msg.content); // Hidden reasoning is never visible output or an action envelope.
}

export function extractChatReasoning(completion) {
  const msg = completion?.choices?.[0]?.message;
  if (!msg) return '';
  return joinTextParts(msg.reasoning ?? msg.reasoning_content);
}

export function extractStreamDelta(chunk) {
  const delta = chunk?.choices?.[0]?.delta;
  if (!delta) return '';
  const raw = delta.content;
  if (typeof raw === 'string') return raw;
  if (Array.isArray(raw)) {
    return raw
      .map((part) => (typeof part === 'string' ? part : part?.text || part?.content || ''))
      .join('');
  }
  return '';
}

function finishAnswer(answer, { skipDisclaimer, onDelta }) {
  const trimmed = String(answer ?? '').trim();
  if (!trimmed) {
    throw Object.assign(new AiEngineError('AI-მა ცარიელი პასუხი დააბრუნა.', { messageEn: 'The AI returned an empty answer.' }), { code: 'AI_EMPTY_RESPONSE' });
  }
  const content = skipDisclaimer ? trimmed : ensureDisclaimer(trimmed);
  if (onDelta && content.length > trimmed.length) {
    onDelta(content.slice(trimmed.length));
  }
  return content;
}

export function truncatedReplyError() {
  return Object.assign(
    new AiEngineError('AI-ის პასუხი ბოლომდე ვერ დაიწერა. სცადე თავიდან.', {
      status: 502,
      messageEn: 'The AI answer could not be completed. Please try again.',
    }),
    { code: 'AI_TRUNCATED' },
  );
}

/**
 * The provider's own reason in a few words (status · error name · host · message) for logs and admin.
 * The user-facing copy hides it; before 2026-10-14 the log hid it too, so a 142 s stall left no cause.
 */
export function upstreamDetail(error) {
  if (!error) return '';
  const inner = error.cause ?? error;
  const body = inner?.error && typeof inner.error === 'object' ? inner.error : null;
  const parts = [
    inner?.status ?? body?.code,
    inner?.name && !['Error', 'AiEngineError'].includes(inner.name) ? inner.name : null,
    body?.metadata?.provider_name,
    String(body?.message || inner?.message || '').replace(/\s+/g, ' ').trim().slice(0, 140),
  ].filter((part) => part != null && part !== '');
  return [...new Set(parts.map(String))].join(' · ');
}

function mapOpenRouterError(error) {
  try {
    mapOpenRouterErrorCopy(error);
  } catch (mapped) {
    if (mapped !== error && !mapped.adminDetail) mapped.adminDetail = upstreamDetail(error);
    throw mapped;
  }
}

function mapOpenRouterErrorCopy(error) {
  if (error instanceof AiEngineError) throw error;
  const status = error?.status ?? 502;
  if (status === 401 || status === 403) {
    throw new AiEngineError('OpenRouter ავტორიზაცია ვერ მოხერხდა. შეამოწმეთ API გასაღები.', {
      status: 502,
      messageEn: 'The AI service is not available right now. Please try again later.',
      cause: error,
    });
  }
  if (status === 402) {
    throw new AiEngineError(
      'AI სერვისი დროებით მიუწვდომელია. ვმუშაობთ აღდგენაზე — სცადე მოგვიანებით.',
      { status: 503, cause: error, messageEn: 'The AI service is temporarily unavailable. We are working on it — please try again later.' },
    );
  }
  if (status === 429) {
    throw new AiEngineError('AI დროებით გადატვირთულია. სცადე ერთი წუთის შემდეგ.', {
      status: 503,
      messageEn: 'The AI is busy right now. Please try again in a minute.',
      cause: error,
    });
  }
  throw new AiEngineError('სამედიცინო ანალიზის სერვისთან დაკავშირება ვერ მოხერხდა.', {
    status: 502,
    cause: error,
    messageEn: 'We could not reach the medical analysis service.',
  });
}

export function setAskOpenRouterPreparedForTests(fn) {
  globalThis.__medicardAskOpenRouterPrepared = typeof fn === 'function' ? fn : null;
}

export function hasOpenRouter() {
  if (typeof globalThis.__medicardAskOpenRouterPrepared === 'function') return true;
  return Boolean(openrouter);
}


export async function askOpenRouterPrepared({
  model,
  messages,
  temperature = 0.2,
  maxTokens = 2400,
  skipDisclaimer = false,
  onDelta,
  signal,
  responseFormat,
  reasoningEffort,
  reasoningExclude,
  languageDirective = true,
  route,
}) {
  if (typeof globalThis.__medicardAskOpenRouterPrepared === 'function') {
    return globalThis.__medicardAskOpenRouterPrepared({
      model,
      messages,
      temperature,
      maxTokens,
      skipDisclaimer,
      onDelta,
      signal,
      responseFormat,
      reasoningEffort,
      reasoningExclude,
      languageDirective,
      route,
    });
  }
  if (!openrouter) {
    throw new AiEngineError('OpenRouter არ არის კონფიგურირებული.', { status: 503, messageEn: 'The AI service is not set up yet.' });
  }
  try {
    const stream = typeof onDelta === 'function';
    // languageDirective:false = verbatim/data output (transcripts); the reply-language line is not added.
    // route:'priority' = the approved priority-tier host first (consentedAiFetch strips both headers).
    const headers = languageDirective === false || route
      ? { ...(languageDirective === false ? { [AI_LANGUAGE_HEADER]: 'off' } : {}), ...(route ? { [AI_ROUTE_HEADER]: route } : {}) }
      : undefined;
    const extra = signal || headers ? { ...(signal ? { signal } : {}), ...(headers ? { headers } : {}) } : undefined;
    const payload = buildOpenRouterChatPayload({
      model,
      messages,
      temperature,
      maxTokens,
      stream,
      responseFormat,
      reasoningEffort,
      reasoningExclude,
    });
    let completion;
    try {
      completion = await openrouter.chat.completions.create(
        stream ? { ...payload, stream_options: { include_usage: true } } : payload,
        extra,
      );
    } catch (error) {
      if (!stream) throw error;
      completion = await openrouter.chat.completions.create(payload, extra);
    }

    if (!stream) {
      // A reply cut at max_tokens is a fragment, never an answer: ask once more with twice the room,
      // then fail loudly so askAi falls back instead of showing the person half a sentence.
      if (completion.choices?.[0]?.finish_reason === 'length') {
        console.warn('[medicard] openrouter reply hit max_tokens, retrying with more room', model, maxTokens);
        completion = await openrouter.chat.completions.create({ ...payload, max_tokens: maxTokens * 2 }, extra);
        if (completion.choices?.[0]?.finish_reason === 'length') throw truncatedReplyError();
      }
      const answer = extractChatContent(completion);
      const reasoning = extractChatReasoning(completion);
      if (!answer && !reasoning) {
        throw Object.assign(new AiEngineError('AI-მა ცარიელი პასუხი დააბრუნა.', { messageEn: 'The AI returned an empty answer.' }), { code: 'AI_EMPTY_RESPONSE' });
      }
      return {
        content: answer ? finishAnswer(answer, { skipDisclaimer, onDelta }) : '',
        reasoning,
        model: completion.model ?? model,
        usage: completion.usage ?? null,
        engine: 'openrouter',
        finishReason: completion.choices?.[0]?.finish_reason ?? null,
      };
    }

    let answer = '';
    let usage = null;
    let modelOut = model;
    let finishReason = null;
    for await (const chunk of completion) {
      if (signal?.aborted) {
        throw new AiEngineError('მოთხოვნა გაუქმდა.', { status: 499, messageEn: 'The request was cancelled.' });
      }
      if (chunk?.model) modelOut = chunk.model;
      if (chunk?.usage) usage = chunk.usage;
      if (chunk?.choices?.[0]?.finish_reason) finishReason = chunk.choices[0].finish_reason;
      const piece = extractStreamDelta(chunk);
      if (!piece) continue;
      answer += piece;
      onDelta(piece);
    }
    if (finishReason === 'length') console.warn('[medicard] streamed openrouter reply hit max_tokens', modelOut, maxTokens);
    return {
      content: finishAnswer(answer, { skipDisclaimer, onDelta }),
      model: modelOut,
      usage,
      engine: 'openrouter',
      finishReason,
    };
  } catch (error) {
    mapOpenRouterError(error);
  }
}

export async function askOpenRouterChat({
  model,
  mode = 'DOCTOR',
  messages,
  context,
  trustedContext,
  temperature = 0.2,
  maxTokens = 2400,
  skipDisclaimer = false,
  onDelta,
  signal,
  responseFormat,
  reasoningEffort,
  route,
}) {
  return askOpenRouterPrepared({
    model,
    messages: buildClinicalMessages({ mode, messages, context, trustedContext }),
    temperature,
    maxTokens,
    skipDisclaimer,
    onDelta,
    signal,
    responseFormat,
    reasoningEffort,
    route,
  });
}

/**
 * How long a Medi answer may stay silent (2026-10-14: the Vertex standard queue wrote nothing for 142 s,
 * then failed, and the EvidenceMD safety net was out of credits). That week DOCTOR answers took p50 10.5 s,
 * p95 27 s in total, so a stream with no word after 20 s is stuck far more often than it is thinking.
 */
export const AI_ANSWER_TIMING = Object.freeze({
  hedgeAfterMs: 20_000, // streamed: no word yet → the priority queue is asked too, the first to write wins
  firstTextDeadlineMs: 60_000, // streamed: neither wrote → Gemini is given up, EvidenceMD answers
  streamIdleMs: 45_000, // streamed: words started, then silence → stopped (the app puts the question back)
  wholeAnswerHedgeMs: 45_000, // unstreamed: no answer yet → the priority queue too
  wholeAnswerDeadlineMs: 120_000,
  evidenceMdMs: 60_000, // the last resort gets its own bounded wait
});

function stalledError(started) {
  return Object.assign(
    started
      ? new AiEngineError('Medi-ს პასუხი შუაში შეწყდა. სცადე თავიდან.', { status: 504, messageEn: 'Medi’s answer stopped partway. Please try again.' })
      : new AiEngineError('Medi-მ დროულად ვერ უპასუხა. სცადე თავიდან.', { status: 504, messageEn: 'Medi did not answer in time. Please try again.' }),
    { code: 'AI_STALLED' },
  );
}

/**
 * One OpenRouter answer that cannot hang. The standard Vertex queue is asked first; when it has written
 * nothing after `hedgeAfterMs` — or fails before writing — the same request also goes to the priority queue
 * (the same disclosed Google Vertex host, ~1.8× the price, only on these rare turns). The first attempt to
 * write a word (unstreamed: to return a usable answer) wins and the other is cancelled. A failure after words
 * were shown is final (`aiStarted`): she already read them, so nothing else is swapped in.
 */
function askOpenRouterRaced({ opts, model, onDelta, signal, timing, usable }) {
  const streamed = typeof onDelta === 'function';
  const began = Date.now();
  return new Promise((resolve, reject) => {
    const attempts = [];
    const timers = new Set();
    let winner = null;
    let settled = false;
    let lastError = null;
    let idle = null;
    const later = (ms, fn) => {
      const id = setTimeout(fn, ms);
      timers.add(id);
      return id;
    };
    const settle = (finish) => {
      if (settled) return;
      settled = true;
      for (const id of timers) clearTimeout(id);
      for (const a of attempts) if (a !== winner) a.ctrl.abort();
      finish();
    };
    const fail = (error) => settle(() => reject(error));
    const routeName = (a) => a.route || 'standard';

    const failed = (a) => {
      a.failed = true;
      if (signal?.aborted) return fail(lastError);
      start('priority'); // failed before writing: no reason to wait for the hedge timer
      if (attempts.every((x) => x.failed)) fail(lastError);
    };

    const start = (route) => {
      if (settled || signal?.aborted || attempts.some((a) => a.route === route)) return;
      const a = { route, ctrl: new AbortController(), wrote: false, failed: false, stalled: false, at: Date.now() };
      attempts.push(a);
      if (route) console.warn('[medicard] ai hedge → priority', { model, afterMs: a.at - began });
      const relay = streamed
        ? (text) => {
            if (!winner && !settled) {
              winner = a;
              for (const other of attempts) if (other !== a) other.ctrl.abort();
            }
            if (winner !== a) return;
            a.wrote = true;
            if (idle) clearTimeout(idle);
            idle = later(timing.streamIdleMs, () => {
              a.stalled = true;
              a.ctrl.abort();
            });
            onDelta(text);
          }
        : undefined;
      const attemptSignal = signal ? AbortSignal.any([signal, a.ctrl.signal]) : a.ctrl.signal;
      askOpenRouterChat({ ...opts, model, route, onDelta: relay, signal: attemptSignal }).then(
        (result) => {
          if (settled || (winner && winner !== a)) return;
          if (!a.wrote && !usable(result)) {
            console.warn('[medicard] discarding broken Georgian reply from', model, routeName(a));
            lastError = new AiEngineError('AI-მ გაუგებარი ქართული დააბრუნა.', { status: 502, messageEn: 'The AI returned an unclear answer. Please try again.' });
            return failed(a);
          }
          winner = a;
          if (attempts.length > 1) console.warn('[medicard] ai answered after hedge', { model, route: routeName(a), ms: Date.now() - began });
          settle(() => resolve({ ...result, route: routeName(a) }));
        },
        (error) => {
          if (settled || (winner && winner !== a)) return;
          const detail = error?.adminDetail || upstreamDetail(error);
          console.warn('[medicard] openrouter attempt failed', { model, route: routeName(a), ms: Date.now() - a.at, wrote: a.wrote, stalled: a.stalled, detail });
          if (a.wrote) {
            const final = a.stalled ? stalledError(true) : error;
            return fail(Object.assign(final, { aiStarted: true, adminDetail: final.adminDetail || `${routeName(a)}: ${a.stalled ? `silent ${timing.streamIdleMs / 1000} s mid-answer` : detail}` }));
          }
          lastError = Object.assign(error, { adminDetail: `${routeName(a)}: ${detail}` });
          failed(a);
        },
      );
    };

    later(streamed ? timing.hedgeAfterMs : timing.wholeAnswerHedgeMs, () => {
      if (!winner) start('priority');
    });
    later(streamed ? timing.firstTextDeadlineMs : timing.wholeAnswerDeadlineMs, () => {
      if (winner || settled) return;
      const waited = Math.round((Date.now() - began) / 1000);
      console.warn('[medicard] ai no answer in time', { model, routes: attempts.map(routeName), waitedS: waited });
      for (const a of attempts) a.ctrl.abort();
      fail(Object.assign(stalledError(false), { adminDetail: `${attempts.map(routeName).join(' + ')}: no answer in ${waited} s${lastError ? `; ${lastError.adminDetail || upstreamDetail(lastError)}` : ''}` }));
    });
    start(undefined);
  });
}

/**
 * Default Gemini Flash: OpenRouter Gemini (standard queue, raced with the priority queue when it stalls)
 * → EvidenceMD. Ling only if the user picked it.
 */
export async function askAi({
  user,
  mode = 'DOCTOR',
  messages,
  context,
  trustedContext,
  temperature = 0.2,
  maxTokens = 2400,
  skipDisclaimer = false,
  onDelta,
  signal,
  responseFormat,
  reasoningEffort,
  timing = AI_ANSWER_TIMING,
}) {
  const engine = resolveAiEngine(user);
  const opts = { mode, messages, context, trustedContext, temperature, maxTokens, skipDisclaimer, onDelta, signal, responseFormat, reasoningEffort };

  if (engine.id === 'evidencemd') {
    const result = await askEvidenceMd(opts);
    return { ...result, engine: 'evidencemd', engineId: engine.id };
  }

  if (!hasOpenRouter()) {
    const result = await askEvidenceMd(opts);
    return { ...result, engine: 'evidencemd', engineId: engine.id, fallback: true };
  }

  let lastError = null;
  const usable = (result) => mode !== 'DOCTOR' || !looksLikeBrokenDoctorReply(result.content);
  for (const model of openRouterFallbackModels(engine.model)) {
    try {
      const result = await askOpenRouterRaced({ opts, model, onDelta, signal, timing, usable });
      return { ...result, engine: 'openrouter', engineId: engine.id };
    } catch (error) {
      lastError = error;
      if (error?.aiStarted || signal?.aborted) throw error;
    }
  }

  const budget = AbortSignal.timeout(timing.evidenceMdMs);
  try {
    const result = await askEvidenceMd({ ...opts, signal: signal ? AbortSignal.any([signal, budget]) : budget });
    return { ...result, engine: 'evidencemd', engineId: engine.id, fallback: true };
  } catch (error) {
    console.warn('[medicard] EvidenceMD fallback failed', upstreamDetail(error));
    const evidence = `EvidenceMD: ${budget.aborted ? `no answer in ${timing.evidenceMdMs / 1000} s` : upstreamDetail(error.cause ?? error)}`;
    if (lastError) throw Object.assign(lastError, { adminDetail: [lastError.adminDetail, evidence].filter(Boolean).join('; ') });
    throw Object.assign(new AiEngineError('სამედიცინო ანალიზის სერვისთან დაკავშირება ვერ მოხერხდა.', { status: 502, messageEn: 'We could not reach the medical analysis service.' }), { adminDetail: evidence });
  }
}

export { openrouter as openRouterClient };
