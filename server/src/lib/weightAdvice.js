import OpenAI from 'openai';
import { env } from '../config/env.js';
import { withOpenRouterModelFallback } from './aiEngine.js';
import { AiEngineError } from './evidencemd.js';

const openrouter = env.OPENROUTER_API_KEY
  ? new OpenAI({
      apiKey: env.OPENROUTER_API_KEY,
      baseURL: env.OPENROUTER_BASE_URL,
      timeout: 45_000,
      maxRetries: 1,
      defaultHeaders: {
        'HTTP-Referer': 'https://medicard.ge',
        'X-Title': 'Medicard.GE',
      },
    })
  : null;

function parseAdvice(raw) {
  const text = String(raw ?? '')
    .replace(/^```json?\s*/i, '')
    .replace(/```\s*$/, '')
    .trim();
  const parsed = JSON.parse(text);
  const blurb = String(parsed.blurb ?? '').trim().slice(0, 220);
  const tips = (Array.isArray(parsed.tips) ? parsed.tips : [])
    .map((row) => String(row ?? '').trim())
    .filter(Boolean)
    .slice(0, 3);
  if (!blurb || tips.length < 2) {
    throw new Error('incomplete');
  }
  return { blurb, tips };
}

export async function adviseWeight({ weightKg, heightCm, bmi, category, targetKg, patientContext, model }) {
  if (!openrouter) {
    throw new AiEngineError('Medi-ს სერვისი არ არის კონფიგურირებული.', { status: 503 });
  }

  const facts = [
    weightKg != null ? `მიმდინარე წონა: ${weightKg} კგ` : null,
    heightCm != null ? `სიმაღლე: ${heightCm} სმ` : null,
    bmi != null ? `BMI: ${bmi}` : null,
    category ? `BMI კატეგორია (WHO): ${category}` : null,
    targetKg != null ? `მომხმარებლის მიზანი: ${targetKg} კგ` : null,
  ]
    .filter(Boolean)
    .join('\n');

  try {
    return await withOpenRouterModelFallback(model || env.OPENROUTER_MODEL, async (candidate) => {
      const completion = await openrouter.chat.completions.create({
        model: candidate,
        temperature: 0.4,
        max_tokens: 500,
        messages: [
          {
            role: 'system',
            content: [
              'შენ ხარ Medicard.GE-ის ასისტენტი Medi. აძლევ მოკლე, პრაქტიკულ რჩევას წონის ყოველდღიური თვალყურისთვის.',
              'წესები:',
              '- უპასუხე მხოლოდ ქართულად.',
              '- არ დასვა დიაგნოზი, არ გამოიგონო რიცხვები, არ დანიშნო დიეტა კალორიების რიცხვით.',
              '- გამოიყენე მხოლოდ მომხმარებლის მოცემული ფაქტები.',
              '- ეს არ არის სამედიცინო დასკვნა.',
              '- დააბრუნე მხოლოდ JSON ობიექტი: blurb (ერთი წინადადება) და tips (ზუსტად 3 მოკლე წინადადება).',
              '- თითო tip მაქსიმუმ 90 სიმბოლო. blurb მაქსიმუმ 160 სიმბოლო.',
            ].join('\n'),
          },
          {
            role: 'user',
            content: [facts, patientContext ? `\nპაციენტის კონტექსტი:\n${patientContext}` : '']
              .filter(Boolean)
              .join('\n'),
          },
        ],
      });

      const content = completion.choices?.[0]?.message?.content ?? '';
      return {
        ...parseAdvice(content),
        model: completion.model ?? candidate,
        usage: completion.usage ?? null,
      };
    });
  } catch {
    throw new AiEngineError('Medi-მ რჩევა ვერ შეადგინა. სცადეთ ხელახლა.', { status: 502 });
  }
}
