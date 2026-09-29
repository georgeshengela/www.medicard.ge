import { DISCLAIMER_KA, DISCLAIMER_EN } from './prompts.js';
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
  lang = 'ka',
}) {
  // English users: the *Ka keys stay (the app reads them) but hold English text.
  const englishHint = lang === 'en'
    ? '\n\nThe person reads English: write the value of every text field, including nameKa, summaryKa, urgencyKa, overviewKa and every other *Ka field, in English. Keep the JSON keys unchanged.'
    : '';
  const evidence = await askAi({
    user, mode: 'SYMPTOM_CHECKER', context: patientContext,
    messages: [{ role: 'user', content: `${prompt}\n\nდააბრუნე მხოლოდ JSON.${englishHint}` }],
    // Georgian structured results contain more text than a chat reply. Reserve enough
    // output for the full object, including safety instructions at the end.
    temperature: 0.2, maxTokens: 8000, skipDisclaimer: true,
    responseFormat: SYMPTOM_RESPONSE_FORMAT,
  });
  return { ...parseSymptomResult(evidence.content, evidence.finishReason), engine: evidence.engine, model: evidence.model, usage: evidence.usage };
}

export function formatSymptomRecordKa(result, input, lang = 'ka') {
  if (lang === 'en') return formatSymptomRecordEn(result, input);
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

/** Same record for English readers (the AI already wrote the *Ka fields in English for them). */
function formatSymptomRecordEn(result, input) {
  const lines = [
    '## Symptom check',
    '',
    `**Symptoms:** ${(input.symptoms || []).join(', ') || '—'}`,
    input.bodyPartKa ? `**Body area:** ${input.bodyPartKa}` : null,
    input.organKa ? `**Organ:** ${input.organKa}` : null,
    input.durationKa ? `**Duration:** ${input.durationKa}` : null,
    input.painLevel != null ? `**Pain:** ${input.painLevel}/5` : null,
    '',
    `**Assessment:** ${result.urgencyKa}`,
    result.summaryKa,
    '',
    '### Possible conditions',
    ...(Array.isArray(result.conditions) ? result.conditions.map((c, i) => `${i + 1}. **${c.nameKa}** (${c.likelihood}%) — ${c.overviewKa || ''}`) : []),
    result.redFlagsKa?.length ? `\n### Watch out for\n${result.redFlagsKa.map((x) => `- ${x}`).join('\n')}` : null,
    result.nextStepsKa?.length ? `\n### Next steps\n${result.nextStepsKa.map((x) => `- ${x}`).join('\n')}` : null,
    '',
    DISCLAIMER_EN,
  ].filter((line) => line != null);
  return lines.join('\n');
}
