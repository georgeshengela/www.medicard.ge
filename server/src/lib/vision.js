import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { env } from '../config/env.js';
import { VISION_PROMPTS } from './prompts.js';
import { AiEngineError } from './evidencemd.js';

/**
 * Vision pre-processing layer.
 *
 * Order: OpenRouter (preferred) → Anthropic → OpenAI direct.
 * These models only turn pixels into structured English notes. Lab sheets stay
 * extract-only until the user asks Medi; EvidenceMD then writes the Georgian
 * clinical note for imaging, skin, and optional lab explain.
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
export async function describeImages({ images, kind, patientContext }) {
  const list = (images ?? []).filter((row) => row?.buffer?.length);
  if (!list.length) {
    throw new AiEngineError('ფოტო არ არის ატვირთული.', { status: 400 });
  }
  if (list.length === 1) {
    return describeImage({ buffer: list[0].buffer, mimeType: list[0].mimeType, kind, patientContext });
  }

  const instruction = VISION_PROMPTS[kind] ?? VISION_PROMPTS.IMAGING;
  const prompt = [
    instruction,
    `These are ${list.length} pages of the SAME laboratory report from one visit. Extract every analyte from every page into one listing. Do not invent values.`,
    patientContext?.trim()
      ? `Patient-supplied context (may be in Georgian, translate internally):\n${patientContext.trim()}`
      : '',
  ]
    .filter(Boolean)
    .join('\n\n');

  const errors = [];
  if (openrouter) {
    try {
      return await describeWithOpenAiCompatible({
        client: openrouter,
        model: env.OPENROUTER_MODEL,
        provider: 'openrouter',
        images: list,
        prompt,
        maxTokens: 4000,
      });
    } catch (error) {
      errors.push(`openrouter-multi: ${error?.message ?? error}`);
    }
  }

  const parts = [];
  for (const [index, image] of list.entries()) {
    const one = await describeImage({ buffer: image.buffer, mimeType: image.mimeType, kind, patientContext });
    parts.push(`--- PAGE ${index + 1} ---\n${one.notes}`);
  }
  return {
    notes: parts.join('\n\n'),
    provider: 'openrouter-pages',
    model: env.OPENROUTER_MODEL,
    cause: errors.join(' | '),
  };
}

export async function structureLabText(text) {
  const source = String(text ?? '').trim();
  if (!source || source.length < 24) return null;
  if (!openrouter) return null;
  return describeWithOpenAiCompatible({
    client: openrouter,
    model: env.OPENROUTER_MODEL,
    provider: 'openrouter',
    prompt: [
      VISION_PROMPTS.LAB,
      'This is already-extracted text from a laboratory PDF. Structure every analyte. Do not invent values.',
      source.slice(0, 12000),
    ].join('\n\n'),
    maxTokens: 4000,
  });
}

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
        detail: kind === 'LAB' ? 'auto' : 'high',
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
        detail: kind === 'LAB' ? 'auto' : 'high',
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

async function describeWithOpenAiCompatible({
  client,
  model,
  provider,
  base64,
  mimeType,
  images,
  prompt,
  maxTokens = 2000,
  detail = 'high',
}) {
  const imageParts = images?.length
    ? images.map((image) => ({
        type: 'image_url',
        image_url: {
          url: `data:${image.mimeType};base64,${image.buffer.toString('base64')}`,
          detail: 'high',
        },
      }))
    : base64
      ? [
          {
            type: 'image_url',
            image_url: { url: `data:${mimeType};base64,${base64}`, detail: detail ?? 'high' },
          },
        ]
      : [];

  const response = await client.chat.completions.create({
    model,
    max_tokens: maxTokens,
    temperature: 0,
    messages: [
      {
        role: 'user',
        content: [{ type: 'text', text: prompt }, ...imageParts],
      },
    ],
  });

  const notes = response.choices?.[0]?.message?.content?.trim();
  if (!notes) throw new Error('empty response');
  return { notes, provider, model: response.model ?? model };
}
