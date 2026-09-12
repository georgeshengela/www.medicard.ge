import OpenAI from 'openai';
import { env } from '../config/env.js';
import { SYSTEM_PROMPTS } from './prompts.js';
import { askEvidenceMd, AiEngineError, ensureDisclaimer } from './evidencemd.js';

/** User-selectable engines. Unknown / empty → Gemini Flash. */
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

export function resolveAiEngine(user) {
  const id = normalizeAiEngine(user?.aiEngine);
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
  if (primary === ling) return [ling, gemini];
  return [gemini, ling];
}

export async function withOpenRouterModelFallback(primary, run) {
  let lastError = null;
  for (const model of openRouterFallbackModels(primary)) {
    try {
      return await run(model);
    } catch (error) {
      lastError = error;
      console.warn('[medicard] openrouter model failed', model, error?.message ?? error);
    }
  }
  throw lastError ?? new AiEngineError('სამედიცინო ანალიზის სერვისთან დაკავშირება ვერ მოხერხდა.', { status: 502 });
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

function extractChatContent(completion) {
  const msg = completion?.choices?.[0]?.message;
  if (!msg) return '';
  const raw = msg.content;
  if (typeof raw === 'string') return raw.trim();
  if (Array.isArray(raw)) {
    return raw
      .map((part) => (typeof part === 'string' ? part : part?.text || part?.content || ''))
      .join('')
      .trim();
  }
  return String(msg.reasoning || '').trim();
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
    throw new AiEngineError('AI-მა ცარიელი პასუხი დააბრუნა.');
  }
  const content = skipDisclaimer ? trimmed : ensureDisclaimer(trimmed);
  if (onDelta && content.length > trimmed.length) {
    onDelta(content.slice(trimmed.length));
  }
  return content;
}

function mapOpenRouterError(error) {
  if (error instanceof AiEngineError) throw error;
  const status = error?.status ?? 502;
  if (status === 401 || status === 403) {
    throw new AiEngineError('OpenRouter ავტორიზაცია ვერ მოხერხდა. შეამოწმეთ API გასაღები.', {
      status: 502,
      cause: error,
    });
  }
  if (status === 402) {
    throw new AiEngineError(
      'AI სერვისი დროებით მიუწვდომელია. ვმუშაობთ აღდგენაზე — გთხოვთ, სცადოთ მოგვიანებით.',
      { status: 503, cause: error },
    );
  }
  if (status === 429) {
    throw new AiEngineError('AI დროებით გადატვირთულია. გთხოვთ, სცადოთ ერთი წუთის შემდეგ.', {
      status: 503,
      cause: error,
    });
  }
  throw new AiEngineError('სამედიცინო ანალიზის სერვისთან დაკავშირება ვერ მოხერხდა.', {
    status: 502,
    cause: error,
  });
}

export function buildClinicalMessages({ mode = 'DOCTOR', messages, context }) {
  const systemPrompt = SYSTEM_PROMPTS[mode] ?? SYSTEM_PROMPTS.DOCTOR;
  return [
    { role: 'system', content: systemPrompt },
    ...(context?.trim()
      ? [{ role: 'system', content: `დამატებითი კლინიკური კონტექსტი:\n${context.trim()}` }]
      : []),
    ...messages.map((m) => ({ role: m.role, content: m.content })),
  ];
}

export async function askOpenRouterChat({
  model,
  mode = 'DOCTOR',
  messages,
  context,
  temperature = 0.2,
  maxTokens = 2400,
  skipDisclaimer = false,
  onDelta,
  signal,
}) {
  if (!openrouter) {
    throw new AiEngineError('OpenRouter არ არის კონფიგურირებული.', { status: 503 });
  }
  try {
    const stream = typeof onDelta === 'function';
    const extra = signal ? { signal } : undefined;
    const payload = {
      model,
      messages: buildClinicalMessages({ mode, messages, context }),
      temperature,
      max_tokens: maxTokens,
      stream,
    };
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
      const answer = extractChatContent(completion);
      return {
        content: finishAnswer(answer, { skipDisclaimer, onDelta }),
        model: completion.model ?? model,
        usage: completion.usage ?? null,
        engine: 'openrouter',
      };
    }

    let answer = '';
    let usage = null;
    let modelOut = model;
    for await (const chunk of completion) {
      if (signal?.aborted) {
        throw new AiEngineError('მოთხოვნა გაუქმდა.', { status: 499 });
      }
      if (chunk?.model) modelOut = chunk.model;
      if (chunk?.usage) usage = chunk.usage;
      const piece = extractStreamDelta(chunk);
      if (!piece) continue;
      answer += piece;
      onDelta(piece);
    }
    return {
      content: finishAnswer(answer, { skipDisclaimer, onDelta }),
      model: modelOut,
      usage,
      engine: 'openrouter',
    };
  } catch (error) {
    mapOpenRouterError(error);
  }
}

/**
 * One entry for chats, answers, cycle insights, and other clinical LLM turns.
 * Default Gemini Flash: OpenRouter Gemini → Ling free → EvidenceMD.
 */
export async function askAi({
  user,
  mode = 'DOCTOR',
  messages,
  context,
  temperature = 0.2,
  maxTokens = 2400,
  skipDisclaimer = false,
  onDelta,
  signal,
}) {
  const engine = resolveAiEngine(user);
  const opts = { mode, messages, context, temperature, maxTokens, skipDisclaimer, onDelta, signal };

  if (engine.id === 'evidencemd') {
    const result = await askEvidenceMd(opts);
    return { ...result, engine: 'evidencemd', engineId: engine.id };
  }

  if (!openrouter) {
    const result = await askEvidenceMd(opts);
    return { ...result, engine: 'evidencemd', engineId: engine.id, fallback: true };
  }

  let lastError = null;
  const models = openRouterFallbackModels(engine.model);
  for (const model of models) {
    let started = false;
    const wrappedDelta =
      typeof onDelta === 'function'
        ? (text) => {
            started = true;
            onDelta(text);
          }
        : undefined;
    try {
      const result = await askOpenRouterChat({ ...opts, model, onDelta: wrappedDelta });
      return { ...result, engine: 'openrouter', engineId: engine.id };
    } catch (error) {
      lastError = error;
      if (started || signal?.aborted) throw error;
      console.warn('[medicard] openrouter model failed', model, error?.message ?? error);
    }
  }

  try {
    const result = await askEvidenceMd(opts);
    return { ...result, engine: 'evidencemd', engineId: engine.id, fallback: true };
  } catch {
    if (lastError) throw lastError;
    throw new AiEngineError('სამედიცინო ანალიზის სერვისთან დაკავშირება ვერ მოხერხდა.', { status: 502 });
  }
}

export function hasOpenRouter() {
  return Boolean(openrouter);
}

export { openrouter as openRouterClient };
