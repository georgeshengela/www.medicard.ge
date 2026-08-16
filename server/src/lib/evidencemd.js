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
export async function askEvidenceMd({ mode = 'DOCTOR', messages, context, temperature = 0.2 }) {
  const systemPrompt = SYSTEM_PROMPTS[mode] ?? SYSTEM_PROMPTS.DOCTOR;

  const payload = [
    { role: 'system', content: systemPrompt },
    ...(context?.trim() ? [{ role: 'system', content: `დამატებითი კლინიკური კონტექსტი:\n${context.trim()}` }] : []),
    ...messages.map((m) => ({ role: m.role, content: m.content })),
  ];

  try {
    const completion = await client.chat.completions.create({
      model: env.EVIDENCEMD_MODEL,
      messages: payload,
      temperature,
      max_tokens: 2400,
    });

    const answer = completion.choices?.[0]?.message?.content?.trim();
    if (!answer) {
      throw new AiEngineError('EvidenceMD-მა ცარიელი პასუხი დააბრუნა.');
    }

    return {
      content: ensureDisclaimer(answer),
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
function ensureDisclaimer(text) {
  return text.includes('არ არის საბოლოო დიაგნოზი') ? text : `${text}\n\n---\n⚠️ ${DISCLAIMER_KA}`;
}
