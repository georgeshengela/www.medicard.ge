import { DISCLAIMER_KA } from './prompts.js';
import { askAi } from './aiEngine.js';

import { parseSymptomResult, SYMPTOM_RESPONSE_FORMAT } from './symptomResult.js';

export function buildSymptomPrompt({
  firstName,
  gender,
  age,
  symptoms,
  primarySymptom,
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
    primarySymptom ? `მთავარი სიმპტომი: ${primarySymptom}` : null,
    bodyPartKa ? `სხეულის არე: ${bodyPartKa}` : null,
    organKa ? `ორგანო: ${organKa}` : null,
    durationKa ? `ხანგრძლივობა: ${durationKa}` : null,
    painLevel != null ? `ტკივილის დონე (1–5): ${painLevel}` : null,
    notes ? `დამატებით: ${notes}` : null,
  ]
    .filter(Boolean)
    .join('\n');
}

export async function runSymptomCheck({
  user,
  prompt,
  patientContext,
  symptoms = [],
  bodyPartKa = null,
  notes = null,
}) {
  const evidence = await askAi({
    user, mode: 'SYMPTOM_CHECKER', context: patientContext,
    messages: [{ role: 'user', content: `${prompt}\n\nდააბრუნე მხოლოდ JSON.` }],
    // Georgian structured results contain more text than a chat reply. Reserve enough
    // output for the full object, including safety instructions at the end.
    temperature: 0.2, maxTokens: 8000, skipDisclaimer: true,
    responseFormat: SYMPTOM_RESPONSE_FORMAT,
  });
  return { ...parseSymptomResult(evidence.content, evidence.finishReason), engine: evidence.engine, model: evidence.model, usage: evidence.usage };
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
