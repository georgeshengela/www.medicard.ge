/**
 * MEDIHOROSCOPE content model. Writes the same texts for everyone (12 signs, the reading library) —
 * it never receives a person's data, birth details or anything from their account, so it sits
 * outside the per-person AI-consent path on purpose (like the admin Director). Provider routing
 * denies training/retention.
 */
import OpenAI from 'openai';

/** Models the admin can pick for the author, the Georgian editor and the English author. */
export const HOROSCOPE_MODELS = {
  'anthropic/claude-opus-5.5': 'Claude Opus 5.5',
  'anthropic/claude-sonnet-5.5': 'Claude Sonnet 5.5',
  'openai/gpt-5.5': 'GPT-5.5',
  'google/gemini-3.1-pro-preview': 'Gemini 3.1 Pro',
  'google/gemini-3.8-flash': 'Gemini 3.8 Flash',
};

export const DEFAULT_MODELS = Object.freeze({
  writer: 'anthropic/claude-sonnet-5.5',
  editor: 'anthropic/claude-sonnet-5.5',
  english: 'anthropic/claude-sonnet-5.5',
});

export const llmConfigured = () => Boolean(process.env.OPENROUTER_API_KEY);

let client = null;
function getClient() {
  if (!client) {
    client = new OpenAI({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
      timeout: 120_000,
      maxRetries: 2,
      defaultHeaders: { 'HTTP-Referer': 'https://medicard.ge', 'X-Title': 'Medicard.GE MEDIHOROSCOPE' },
    });
  }
  return client;
}

/** Pulls the first JSON object out of a model answer (tolerates code fences and preambles). */
export function parseJsonAnswer(text) {
  const raw = String(text || '').replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  try { return JSON.parse(raw); } catch { /* fall through */ }
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start >= 0 && end > start) return JSON.parse(raw.slice(start, end + 1));
  throw new Error('Model answer had no JSON object');
}

/** One JSON completion; `model` must be one of HOROSCOPE_MODELS (admin setting). */
export async function askJson({ system, user, model: wanted, maxTokens = 3000, temperature = 0.8 }) {
  if (!llmConfigured()) throw Object.assign(new Error('OPENROUTER_API_KEY is not set'), { code: 'HOROSCOPE_AI_OFF' });
  const model = HOROSCOPE_MODELS[wanted] ? wanted : DEFAULT_MODELS.writer;
  const res = await getClient().chat.completions.create({
    model,
    temperature,
    // Thinking tokens count against max_tokens (see reasoningBudget.js) — leave them headroom.
    max_tokens: maxTokens + 4000,
    response_format: { type: 'json_object' },
    provider: { data_collection: 'deny' },
    reasoning: { effort: 'low', exclude: true },
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
  });
  const choice = res.choices?.[0];
  if (choice?.finish_reason === 'length') throw Object.assign(new Error('Model answer was cut at max_tokens'), { code: 'HOROSCOPE_AI_LENGTH' });
  return { data: parseJsonAnswer(choice?.message?.content || ''), model, usage: res.usage || null };
}
