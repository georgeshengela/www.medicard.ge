import OpenAI from 'openai';
import { env } from '../config/env.js';
import { SYSTEM_PROMPTS, DISCLAIMER_KA } from './prompts.js';

/**
 * EvidenceMD exposes an OpenAI-compatible /chat/completions endpoint, so we drive it
 * with the official OpenAI SDK pointed at their base URL. All clinical reasoning —
 * differential diagnosis, lab interpretation, guideline matching, citations — goes here.
 */
const client = new OpenAI({
  // EvidenceMD authenticates via the x-api-key header, not the Authorization bearer,
  // but the OpenAI SDK insists on an apiKey being present.
  apiKey: env.EVIDENCEMD_API_KEY,
  baseURL: env.EVIDENCEMD_BASE_URL,
  timeout: 180_000,
  maxRetries: 2,
  defaultHeaders: {
    'x-api-key': env.EVIDENCEMD_API_KEY,
    'Accept-Language': 'ka-GE',
    'X-Client': 'medicard-ge',
  },
});

export class AiEngineError extends Error {
  constructor(message, { status = 502, cause } = {}) {
    super(message);
    this.name = 'AiEngineError';
    this.status = status;
    this.cause = cause;
  }
}

/**
 * @param {object} opts
 * @param {keyof typeof SYSTEM_PROMPTS} opts.mode
 * @param {{role: 'user'|'assistant', content: string}[]} opts.messages
 * @param {string} [opts.context] Extra clinical context prepended as a system message.
 * @param {number} [opts.temperature]
 */
function extractEvidenceDelta(chunk) {
  const raw = chunk?.choices?.[0]?.delta?.content;
  if (typeof raw === 'string') return raw;
  if (Array.isArray(raw)) {
    return raw.map((part) => (typeof part === 'string' ? part : part?.text || '')).join('');
  }
  return '';
}

export async function askEvidenceMd({
  mode = 'DOCTOR',
  messages,
  context,
  temperature = 0.2,
  maxTokens = 2400,
  skipDisclaimer = false,
  onDelta,
  signal,
}) {
  const systemPrompt = SYSTEM_PROMPTS[mode] ?? SYSTEM_PROMPTS.DOCTOR;

  const payload = [
    { role: 'system', content: systemPrompt },
    ...(context?.trim() ? [{ role: 'system', content: `დამატებითი კლინიკური კონტექსტი:\n${context.trim()}` }] : []),
    ...messages.map((m) => ({ role: m.role, content: m.content })),
  ];

  const extra = signal ? { signal } : undefined;

  try {
    if (typeof onDelta === 'function') {
      let streamed = false;
      try {
        const stream = await client.chat.completions.create(
          {
            model: env.EVIDENCEMD_MODEL,
            messages: payload,
            temperature,
            max_tokens: maxTokens,
            stream: true,
          },
          extra,
        );
        let answer = '';
        let usage = null;
        let modelOut = env.EVIDENCEMD_MODEL;
        for await (const chunk of stream) {
          if (signal?.aborted) {
            throw new AiEngineError('მოთხოვნა გაუქმდა.', { status: 499 });
          }
          if (chunk?.model) modelOut = chunk.model;
          if (chunk?.usage) usage = chunk.usage;
          const piece = extractEvidenceDelta(chunk);
          if (!piece) continue;
          streamed = true;
          answer += piece;
          onDelta(piece);
        }
        const trimmed = answer.trim();
        if (!trimmed) throw new AiEngineError('EvidenceMD-მა ცარიელი პასუხი დააბრუნა.');
        const content = skipDisclaimer ? trimmed : ensureDisclaimer(trimmed);
        if (content.length > trimmed.length) onDelta(content.slice(trimmed.length));
        return { content, model: modelOut, usage };
      } catch (error) {
        if (error instanceof AiEngineError || signal?.aborted || streamed) throw error;
        console.warn('[medicard] EvidenceMD stream failed, retrying without stream', error?.message ?? error);
      }
    }

    const completion = await client.chat.completions.create(
      {
        model: env.EVIDENCEMD_MODEL,
        messages: payload,
        temperature,
        max_tokens: maxTokens,
      },
      extra,
    );

    const answer = completion.choices?.[0]?.message?.content?.trim();
    if (!answer) {
      throw new AiEngineError('EvidenceMD-მა ცარიელი პასუხი დააბრუნა.');
    }

    const content = skipDisclaimer ? answer : ensureDisclaimer(answer);
    if (typeof onDelta === 'function') onDelta(content);

    return {
      content,
      model: completion.model ?? env.EVIDENCEMD_MODEL,
      usage: completion.usage ?? null,
    };
  } catch (error) {
    if (error instanceof AiEngineError) throw error;

    const status = error?.status ?? 502;
    if (status === 401 || status === 403) {
      throw new AiEngineError('EvidenceMD-ის ავტორიზაცია ვერ მოხერხდა. შეამოწმეთ API გასაღები.', {
        status: 502,
        cause: error,
      });
    }
    if (status === 402) {
      // The upstream account is out of credits — an operator problem, not a user error.
      console.error('[medicard] EvidenceMD credits exhausted:', error?.error?.message ?? error?.message);
      throw new AiEngineError(
        'სამედიცინო ანალიზის სერვისი დროებით მიუწვდომელია. ვმუშაობთ აღდგენაზე — გთხოვთ, სცადოთ მოგვიანებით.',
        { status: 503, cause: error },
      );
    }
    if (status === 429) {
      throw new AiEngineError('EvidenceMD დროებით გადატვირთულია. გთხოვთ, სცადოთ ერთი წუთის შემდეგ.', {
        status: 503,
        cause: error,
      });
    }
    throw new AiEngineError('სამედიცინო ანალიზის სერვისთან დაკავშირება ვერ მოხერხდა.', {
      status: 502,
      cause: error,
    });
  }
}

/** The disclaimer is a product requirement, so we enforce it rather than trusting the model. */
export function ensureDisclaimer(text) {
  return text.includes('არ არის საბოლოო დიაგნოზი') ? text : `${text}\n\n---\n⚠️ ${DISCLAIMER_KA}`;
}
