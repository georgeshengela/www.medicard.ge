import OpenAI from 'openai';
import { env } from '../config/env.js';
import { DISCLAIMER_KA, SYSTEM_PROMPTS } from './prompts.js';
import { askEvidenceMd } from './evidencemd.js';

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

function parseJsonLoose(raw) {
  if (!raw) return null;
  const text = String(raw)
    .replace(/^```json?\s*/i, '')
    .replace(/```\s*$/, '')
    .trim();
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

function slugify(value, fallback) {
  const slug = String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return slug || fallback;
}

function normalizeCondition(item, index) {
  const likelihood = Math.max(4, Math.min(96, Number(item?.likelihood) || 40 - index * 8));
  const severityLevel = Math.max(1, Math.min(5, Number(item?.severityLevel) || 2));
  const risk = ['high', 'medium', 'low'].includes(item?.risk) ? item.risk : likelihood >= 70 ? 'high' : likelihood >= 40 ? 'medium' : 'low';
  return {
    id: slugify(item?.id || item?.nameEn || item?.nameKa, `condition-${index + 1}`),
    nameKa: String(item?.nameKa || item?.nameEn || 'შესაძლო მდგომარეობა').slice(0, 80),
    nameEn: String(item?.nameEn || '').slice(0, 80),
    likelihood,
    risk,
    needsTreatment: Boolean(item?.needsTreatment) || risk === 'high',
    overviewKa: String(item?.overviewKa || '').slice(0, 1200),
    severityKa: String(item?.severityKa || (severityLevel >= 4 ? 'მძიმე' : severityLevel >= 3 ? 'საშუალო' : 'მსუბუქი')),
    severityLevel,
    symptomsKa: Array.isArray(item?.symptomsKa) ? item.symptomsKa.map(String).slice(0, 12) : [],
    causesKa: Array.isArray(item?.causesKa) ? item.causesKa.map(String).slice(0, 8) : [],
    treatmentsKa: Array.isArray(item?.treatmentsKa) ? item.treatmentsKa.map(String).slice(0, 8) : [],
    whenToSeeDoctorKa: String(item?.whenToSeeDoctorKa || 'თუ სიმპტომები გაუარესდება ან გაგრძელდება, მიმართეთ ექიმს.').slice(0, 400),
    selfCareKa: Array.isArray(item?.selfCareKa) ? item.selfCareKa.map(String).slice(0, 8) : [],
  };
}

function fallbackResult({ symptoms, bodyPartKa, notes }) {
  const joined = symptoms.join(', ');
  return {
    urgency: 'routine',
    urgencyKa: 'საჭიროა ექიმის შეფასება — ეს არ არის დიაგნოზი',
    summaryKa: joined
      ? `თქვენ აღწერეთ: ${joined}. ქვემოთ არის წინასწარი შესაძლო მიმართულებები, რომლებიც ექიმთან უნდა გადაამოწმოთ.`
      : 'სიმპტომების მიხედვით შევადგინეთ წინასწარი სია — დაადასტურეთ ექიმთან.',
    findingScore: Math.min(88, 42 + symptoms.length * 8 + (bodyPartKa ? 10 : 0) + (notes ? 6 : 0)),
    conditions: [
      {
        id: 'viral-illness',
        nameKa: 'ვირუსული ინფექცია',
        nameEn: 'Viral illness',
        likelihood: 58,
        risk: 'medium',
        needsTreatment: false,
        overviewKa: 'ბევრი ჩივილი იწყება ვირუსული ინფექციით. ეს მხოლოდ ერთ-ერთი შესაძლო მიმართულებაა და საჭიროებს ექიმის შეფასებას.',
        severityKa: 'მსუბუქი',
        severityLevel: 2,
        symptomsKa: symptoms.slice(0, 6),
        causesKa: ['ვირუსი', 'დაღლილობა', 'გაუწყლოება'],
        treatmentsKa: ['დასვენება', 'სითხის მიღება', 'სიმპტომური მოვლა ექიმის რჩევით'],
        whenToSeeDoctorKa: 'მიმართეთ ექიმს, თუ ცხელება 3 დღეზე მეტხანს გაგრძელდება, ან გამოჩნდება სუნთქვის გაძნელება.',
        selfCareKa: ['დაისვენეთ', 'დალიეთ საკმარისი წყალი'],
      },
    ],
    redFlagsKa: [],
    nextStepsKa: ['დააკვირდით სიმპტომებს 24–48 საათი', 'თუ გაუარესდება — მიმართეთ ექიმს ან 112-ს'],
    engine: 'fallback',
  };
}

function normalizeResult(parsed, input) {
  const base = fallbackResult(input);
  if (!parsed || typeof parsed !== 'object') return base;

  const conditions = Array.isArray(parsed.conditions)
    ? parsed.conditions.map(normalizeCondition).filter((c) => c.nameKa)
    : base.conditions;

  const urgency = ['emergency', 'urgent', 'routine'].includes(parsed.urgency) ? parsed.urgency : base.urgency;

  return {
    urgency,
    urgencyKa: String(parsed.urgencyKa || base.urgencyKa).slice(0, 160),
    summaryKa: String(parsed.summaryKa || base.summaryKa).slice(0, 600),
    findingScore: Math.max(8, Math.min(98, Number(parsed.findingScore) || base.findingScore)),
    conditions: conditions.slice(0, 6),
    redFlagsKa: Array.isArray(parsed.redFlagsKa) ? parsed.redFlagsKa.map(String).slice(0, 8) : [],
    nextStepsKa: Array.isArray(parsed.nextStepsKa) ? parsed.nextStepsKa.map(String).slice(0, 8) : base.nextStepsKa,
    engine: parsed.engine || 'openrouter',
  };
}

export function buildSymptomPrompt({
  firstName,
  gender,
  age,
  symptoms,
  bodyPartKa,
  organKa,
  durationKa,
  painLevel,
  notes,
  mode,
}) {
  return [
    `პაციენტი: ${firstName || 'მომხმარებელი'}`,
    gender ? `სქესი: ${gender}` : null,
    age != null ? `ასაკი: ${age}` : null,
    `შემოწმების რეჟიმი: ${mode === 'organ' ? 'ორგანოები' : mode === 'muscle' ? 'სხეულის რუკა' : 'ხელით აღწერა'}`,
    `სიმპტომები: ${symptoms.join(', ') || 'არ არის მითითებული'}`,
    bodyPartKa ? `სხეულის არე: ${bodyPartKa}` : null,
    organKa ? `ორგანო: ${organKa}` : null,
    durationKa ? `ხანგრძლივობა: ${durationKa}` : null,
    painLevel != null ? `ტკივილის დონე (1–5): ${painLevel}` : null,
    notes ? `დამატებით: ${notes}` : null,
  ]
    .filter(Boolean)
    .join('\n');
}

export async function runSymptomCheck({ prompt, patientContext, symptoms = [], bodyPartKa = null, notes = null }) {
  const inputHints = {
    symptoms,
    bodyPartKa,
    notes,
  };

  if (openrouter) {
    try {
      const completion = await openrouter.chat.completions.create({
        model: env.OPENROUTER_MODEL,
        temperature: 0.25,
        max_tokens: 3600,
        messages: [
          { role: 'system', content: SYSTEM_PROMPTS.SYMPTOM_CHECKER },
          ...(patientContext ? [{ role: 'system', content: `დამატებითი კლინიკური კონტექსტი:\n${patientContext}` }] : []),
          { role: 'user', content: prompt },
        ],
      });
      const parsed = parseJsonLoose(completion.choices?.[0]?.message?.content);
      if (parsed) {
        return {
          ...normalizeResult(parsed, inputHints),
          engine: 'openrouter',
          model: completion.model ?? env.OPENROUTER_MODEL,
          usage: completion.usage ?? null,
        };
      }
    } catch (error) {
      console.error('[medicard] symptom checker openrouter failed:', error?.message ?? error);
    }
  }

  try {
    const evidence = await askEvidenceMd({
      mode: 'SYMPTOM_CHECKER',
      context: patientContext,
      messages: [{ role: 'user', content: `${prompt}\n\nდააბრუნე მხოლოდ JSON.` }],
      temperature: 0.2,
      maxTokens: 2400,
      skipDisclaimer: true,
    });
    const parsed = parseJsonLoose(evidence.content);
    return {
      ...normalizeResult(parsed, inputHints),
      engine: 'evidencemd',
      model: evidence.model,
      usage: evidence.usage,
    };
  } catch (error) {
    console.error('[medicard] symptom checker evidencemd failed:', error?.message ?? error);
    return {
      ...fallbackResult(inputHints),
      model: null,
      usage: null,
    };
  }
}

export function formatSymptomRecordKa(result, input) {
  const lines = [
    '## სიმპტომების შემოწმება',
    '',
    `**სიმპტომები:** ${(input.symptoms || []).join(', ') || '—'}`,
    input.bodyPartKa ? `**სხეულის არე:** ${input.bodyPartKa}` : null,
    input.organKa ? `**ორგანო:** ${input.organKa}` : null,
    input.durationKa ? `**ხანგრძლივობა:** ${input.durationKa}` : null,
    input.painLevel != null ? `**ტკივილი:** ${input.painLevel}/5` : null,
    '',
    `**შეფასება:** ${result.urgencyKa}`,
    result.summaryKa,
    '',
    '### შესაძლო მდგომარეობები',
    ...(Array.isArray(result.conditions) ? result.conditions.map((c, i) => `${i + 1}. **${c.nameKa}** (${c.likelihood}%) — ${c.overviewKa || ''}`) : []),
    result.redFlagsKa?.length ? `\n### ყურადღება\n${result.redFlagsKa.map((x) => `- ${x}`).join('\n')}` : null,
    result.nextStepsKa?.length ? `\n### შემდეგი ნაბიჯები\n${result.nextStepsKa.map((x) => `- ${x}`).join('\n')}` : null,
    '',
    DISCLAIMER_KA,
  ].filter((line) => line != null);
  return lines.join('\n');
}
