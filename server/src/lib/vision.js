import { AI_LANGUAGE_HEADER, consentedAiFetch } from './consentedAiFetch.js';
import { assertVisionCompletion } from './visionCompletion.js';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { env } from '../config/env.js';
import { VISION_PROMPTS } from './prompts.js';
import { AiEngineError } from './evidencemd.js';
import { openRouterFallbackModels } from './aiEngine.js';
import { thinksByDefault } from './reasoningBudget.js';

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
      fetch: consentedAiFetch('openrouter'),
      timeout: 120_000,
      maxRetries: 1,
      defaultHeaders: {
        'HTTP-Referer': 'https://medicard.ge',
        'X-Title': 'Medicard.GE',
      },
    })
  : null;

const anthropic = env.ANTHROPIC_API_KEY
  ? new Anthropic({ fetch: consentedAiFetch('anthropic'), apiKey: env.ANTHROPIC_API_KEY, timeout: 120_000, maxRetries: 1 })
  : null;

const openai = env.OPENAI_API_KEY
  ? new OpenAI({ fetch: consentedAiFetch('openai'), apiKey: env.OPENAI_API_KEY, timeout: 120_000, maxRetries: 1 })
  : null;

/**
 * Visible room for one read. A full Georgian lab sheet (≈40 analytes + DOCUMENT META + labjson) is
 * ≈4 500 tokens; the old 2 000 (thinking included) cut every real sheet and pushed it to tesseract.
 * Thinking room is added on top in consentedAiFetch (reasoningBudget.js).
 */
export const VISION_MAX_TOKENS = 12000;
const VISION_MAX_TOKENS_MULTI = 24000;
/** Measured 2026-10-06 on a 39-row sheet: minimal = 39/39 in ~29 s, medium = 39/39 in ~46 s. */
export const VISION_EFFORTS = Object.freeze(['minimal', 'medium']);
/** Copying a printed table needs little thinking; reading an X-ray or a skin photo needs more. */
export function visionEffortsFor(kind) {
  return kind === 'LAB' ? VISION_EFFORTS : ['medium', 'high'];
}

export const SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

/**
 * A reader that never got to look at the photo: no credit (402), a bad key (401), the model gone (404),
 * a rate limit or timeout (408/429), an outage (5xx) or the network. A 400/403/413 (the provider refusing
 * this image), an empty or cut answer and a refusal are about the photo, not the service.
 */
const READER_DOWN_STATUSES = new Set([401, 402, 404, 408, 429]);
const READER_DOWN_CODES = new Set(['ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN', 'EPIPE', 'UND_ERR_CONNECT_TIMEOUT', 'UND_ERR_SOCKET']);
export function isVisionReaderDown(error) {
  const status = Number(error?.status);
  if (Number.isInteger(status) && status > 0) return READER_DOWN_STATUSES.has(status) || status >= 500;
  // The SDKs' network errors carry no status (and keep the plain `Error` name).
  if (error instanceof OpenAI.APIConnectionError || error instanceof Anthropic.APIConnectionError) return true;
  const names = [error?.name, error?.constructor?.name].map(String);
  if (names.some((name) => /^(APIConnectionError|APIConnectionTimeoutError|AbortError|TimeoutError)$/.test(name))) return true;
  return READER_DOWN_CODES.has(String(error?.code || error?.cause?.code || ''));
}

/**
 * The error once every reader failed (MEDISCAN F4, 2026-10-09). When none of them could answer at all,
 * the photo was never read: say so calmly (503, `readerDown`) and never ask for another photo. Otherwise
 * the readers saw it and could not read it — the old copy stays.
 */
export function visionFailedError(failures = [], cause = null) {
  const list = (failures ?? []).filter(Boolean);
  if (list.length && list.every(isVisionReaderDown)) {
    const error = new AiEngineError(
      'ანალიზი ახლა ვერ შესრულდა — სერვისი დროებით მიუწვდომელია. ფოტოს ხელახლა გადაღება არ გჭირდება: სცადე იგივე ფოტოთი ცოტა ხანში. ეს მცდელობა ლიმიტში არ ჩაგეთვლება.',
      {
        status: 503,
        messageEn: 'The analysis couldn’t run right now — the service is temporarily unavailable. No need to retake the photo: try again with the same photo in a little while. This try does not count toward your limit.',
        cause,
      },
    );
    error.readerDown = true;
    return error;
  }
  return new AiEngineError('გამოსახულების ანალიზი ვერ შესრულდა. სცადე სხვა ფოტო ან მოგვიანებით.', {
    status: 502,
    messageEn: 'The image analysis didn’t work. Try another photo or try again later.',
    cause,
  });
}

/**
 * @param {object} opts
 * @param {Buffer} opts.buffer Raw image bytes.
 * @param {string} opts.mimeType
 * @param {'LAB'|'IMAGING'|'SKIN'} opts.kind
 * @param {string} [opts.patientContext]
 * @returns {Promise<{notes: string, provider: string, model: string}>}
 */
export async function describeImages({ images, kind, patientContext, model }) {
  const list = (images ?? []).filter((row) => row?.buffer?.length);
  if (!list.length) {
    throw new AiEngineError('ფოტო არ არის ატვირთული.', { status: 400, messageEn: 'No photo was uploaded.' });
  }
  if (list.length === 1) {
    return describeImage({
      buffer: list[0].buffer,
      mimeType: list[0].mimeType,
      kind,
      patientContext,
      model,
    });
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
    for (const openRouterModel of openRouterFallbackModels(model || env.OPENROUTER_MODEL)) {
      try {
        return await describeWithOpenAiCompatible({
          client: openrouter,
          model: openRouterModel,
          provider: 'openrouter',
          images: list,
          prompt,
          maxTokens: VISION_MAX_TOKENS_MULTI,
          reasoningEffort: visionEffortsFor(kind)[0],
        });
      } catch (error) {
        errors.push(`openrouter-multi:${openRouterModel}: ${error?.message ?? error}`);
      }
    }
  }

  const parts = [];
  for (const [index, image] of list.entries()) {
    const one = await describeImage({
      buffer: image.buffer,
      mimeType: image.mimeType,
      kind,
      patientContext,
      model,
    });
    parts.push(`--- PAGE ${index + 1} ---\n${one.notes}`);
  }
  return {
    notes: parts.join('\n\n'),
    provider: 'openrouter-pages',
    model: env.OPENROUTER_MODEL,
    cause: errors.join(' | '),
  };
}

export async function structureLabText(text, { model } = {}) {
  const source = String(text ?? '').trim();
  if (!source || source.length < 24) return null;
  if (!openrouter) return null;
  let lastError = null;
  for (const openRouterModel of openRouterFallbackModels(model || env.OPENROUTER_MODEL)) {
    try {
      return await describeWithOpenAiCompatible({
        client: openrouter,
        model: openRouterModel,
        provider: 'openrouter',
        prompt: [
          VISION_PROMPTS.LAB,
          'This is already-extracted text from a laboratory PDF. Structure every analyte. Do not invent values.',
          source.slice(0, 12000),
        ].join('\n\n'),
        maxTokens: VISION_MAX_TOKENS,
        reasoningEffort: 'minimal',
      });
    } catch (error) {
      lastError = error;
    }
  }
  if (lastError) throw lastError;
  return null;
}

export async function describeImage({ buffer, mimeType, kind, patientContext, model, efforts = visionEffortsFor(kind) }) {
  if (!openrouter && !anthropic && !openai) {
    throw new AiEngineError(
      'გამოსახულების ანალიზის სერვისი არ არის კონფიგურირებული. დაამატეთ OPENROUTER_API_KEY.',
      { status: 503, messageEn: 'The image analysis service is not available right now.' },
    );
  }

  const instruction = VISION_PROMPTS[kind] ?? VISION_PROMPTS.IMAGING;
  const prompt = patientContext?.trim()
    ? `${instruction}\n\nPatient-supplied context (may be in Georgian, translate internally):\n${patientContext.trim()}`
    : instruction;

  const base64 = buffer.toString('base64');
  const errors = [];
  const failures = [];

  if (openrouter) {
    // Fast pass first; a cut or empty read gets one deeper pass before anything else is tried.
    for (const openRouterModel of openRouterFallbackModels(model || env.OPENROUTER_MODEL)) {
      for (const effort of efforts) {
        try {
          return await describeWithOpenAiCompatible({
            client: openrouter,
            model: openRouterModel,
            provider: 'openrouter',
            base64,
            mimeType,
            prompt,
            detail: 'high',
            maxTokens: VISION_MAX_TOKENS,
            reasoningEffort: effort,
          });
        } catch (error) {
          failures.push(error);
          errors.push(`openrouter:${openRouterModel}:${effort}: ${error?.message ?? error}`);
          console.warn('[medicard] vision pass failed', openRouterModel, effort, error?.message ?? error);
        }
      }
    }
  }

  if (anthropic) {
    try {
      return await describeWithClaude({ base64, mimeType, prompt });
    } catch (error) {
      failures.push(error);
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
      failures.push(error);
      errors.push(`openai: ${error?.message ?? error}`);
    }
  }

  throw visionFailedError(failures, new Error(errors.join(' | ')));
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

  assertVisionCompletion(response, 'anthropic');
  const notes = response.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('\n')
    .trim();

  if (!notes) throw new Error('empty response');
  return { notes, provider: 'anthropic', model: response.model ?? env.ANTHROPIC_MODEL };
}

/** A scanned PDF goes as a file part (Gemini reads its pages); everything else as an image. */
export function mediaPart(mimeType, base64, detail = 'high') {
  if (mimeType === 'application/pdf') {
    return { type: 'file', file: { filename: 'lab.pdf', file_data: `data:application/pdf;base64,${base64}` } };
  }
  return { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}`, detail } };
}

async function describeWithOpenAiCompatible({
  client,
  model,
  provider,
  base64,
  mimeType,
  images,
  prompt,
  maxTokens = VISION_MAX_TOKENS,
  detail = 'high',
  reasoningEffort,
}) {
  const imageParts = images?.length
    ? images.map((image) => mediaPart(image.mimeType, image.buffer.toString('base64'), 'high'))
    : base64
      ? [mediaPart(mimeType, base64, detail ?? 'high')]
      : [];

  // Vision output is extraction notes (lab names stay Georgian for parsing), not the reader's answer:
  // no reply-language directive here; the clinical write-up that follows is in the reader's language.
  const response = await client.chat.completions.create({
    model,
    max_tokens: maxTokens,
    temperature: 0,
    ...(reasoningEffort && thinksByDefault(model) ? { reasoning: { effort: reasoningEffort, exclude: true } } : {}),
    messages: [
      {
        role: 'user',
        content: [{ type: 'text', text: prompt }, ...imageParts],
      },
    ],
  }, { headers: { [AI_LANGUAGE_HEADER]: 'off' } });

  assertVisionCompletion(response, provider);
  const notes = response.choices?.[0]?.message?.content?.trim();
  if (!notes) throw new Error('empty response');
  return { notes, provider, model: response.model ?? model };
}
