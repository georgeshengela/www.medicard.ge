/**
 * Quick OpenRouter auth + vision-model reachability check (no image upload).
 */
import 'dotenv/config';
import OpenAI from 'openai';

const key = process.env.OPENROUTER_API_KEY;
const model = process.env.OPENROUTER_MODEL || 'openai/gpt-4o';

if (!key) {
  console.error('OPENROUTER_API_KEY missing');
  process.exit(1);
}

const client = new OpenAI({
  apiKey: key,
  baseURL: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
  defaultHeaders: {
    'HTTP-Referer': 'https://medicard.ge',
    'X-Title': 'Medicard.GE',
  },
});

const response = await client.chat.completions.create({
  model,
  max_tokens: 40,
  messages: [{ role: 'user', content: 'Reply with exactly: OK' }],
});

console.log(JSON.stringify({
  ok: true,
  model: response.model ?? model,
  reply: response.choices?.[0]?.message?.content?.trim(),
}, null, 2));
