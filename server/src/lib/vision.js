import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { env } from '../config/env.js';
import { VISION_PROMPTS } from './prompts.js';
import { AiEngineError } from './evidencemd.js';

/**
 * Vision pre-processing layer.
 *
 * Order: OpenRouter (preferred) → Anthropic → OpenAI direct.
 * These models only turn pixels into structured English notes; EvidenceMD does
 * the clinical reasoning in Georgian afterwards.
 */

const openrouter = env.OPENROUTER_API_KEY
  ? new OpenAI({
      apiKey: env.OPENROUTER_API_KEY,
      baseURL: env.OPENROUTER_BASE_URL,
      timeout: 120_000,
      maxRetries: 1,
      defaultHeaders: {
        'HTTP-Referer': 'https://medicard.ge',
        'X-Title': 'Medicard.GE',
      },
    })
  : null;

const anthropic = env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, timeout: 120_000, maxRetries: 1 })
  : null;

const openai = env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: env.OPENAI_API_KEY, timeout: 120_000, maxRetries: 1 })
  : null;

export const SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

/**
 * @param {object} opts
 * @param {Buffer} opts.buffer Raw image bytes.
 * @param {string} opts.mimeType
 * @param {'LAB'|'IMAGING'|'SKIN'} opts.kind
 * @param {string} [opts.patientContext]
 * @returns {Promise<{notes: string, provider: string, model: string}>}
 */
export async function describeImage({ buffer, mimeType, kind, patientContext }) {
  if (!openrouter && !anthropic && !openai) {
    throw new AiEngineError(
      'გამოსახულების ანალიზის სერვისი არ არის კონფიგურირებული. დაამატეთ OPENROUTER_API_KEY.',
      { status: 503 },
    );
  }

  const instruction = VISION_PROMPTS[kind] ?? VISION_PROMPTS.IMAGING;
  const prompt = patientContext?.trim()
    ? `${instruction}\n\nPatient-supplied context (may be in Georgian, translate internally):\n${patientContext.trim()}`
    : instruction;

  const base64 = buffer.toString('base64');
  const errors = [];

  if (openrouter) {
    try {
      return await describeWithOpenAiCompatible({
        client: openrouter,
        model: env.OPENROUTER_MODEL,
        provider: 'openrouter',
        base64,
        mimeType,
        prompt,
      });
    } catch (error) {
      errors.push(`openrouter: ${error?.message ?? error}`);
    }
  }

  if (anthropic) {
    try {
      return await describeWithClaude({ base64, mimeType, prompt });
    } catch (error) {
      errors.push(`claude: ${error?.message ?? error}`);
    }
  }

  if (openai) {
    try {
      return await describeWithOpenAiCompatible({
        client: openai,
        model: env.OPENAI_MODEL,
        provider: 'openai',
        base64,
        mimeType,
        prompt,
      });
    } catch (error) {
      errors.push(`openai: ${error?.message ?? error}`);
    }
  }

  throw new AiEngineError('გამოსახულების ანალიზი ვერ შესრულდა. სცადეთ სხვა ფოტო ან მოგვიანებით.', {
    status: 502,
    cause: new Error(errors.join(' | ')),
  });
}

async function describeWithClaude({ base64, mimeType, prompt }) {
  const response = await anthropic.messages.create({
    model: env.ANTHROPIC_MODEL,
    max_tokens: 2000,
    temperature: 0,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mimeType, data: base64 } },
          { type: 'text', text: prompt },
        ],
      },
    ],
  });

  const notes = response.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('\n')
    .trim();

  if (!notes) throw new Error('empty response');
  return { notes, provider: 'anthropic', model: response.model ?? env.ANTHROPIC_MODEL };
}

async function describeWithOpenAiCompatible({ client, model, provider, base64, mimeType, prompt }) {
  const response = await client.chat.completions.create({
    model,
    max_tokens: 2000,
    temperature: 0,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          {
            type: 'image_url',
            image_url: { url: `data:${mimeType};base64,${base64}`, detail: 'high' },
          },
        ],
      },
    ],
  });

  const notes = response.choices?.[0]?.message?.content?.trim();
  if (!notes) throw new Error('empty response');
  return { notes, provider, model: response.model ?? model };
}
