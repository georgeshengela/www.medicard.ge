import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSymptomResult, SYMPTOM_RESPONSE_FORMAT } from './symptomResult.js';
import { buildOpenRouterChatPayload } from './aiEngine.js';

const valid = () => ({ urgency: 'urgent', urgencyKa: 'საჭიროა შეფასება', summaryKa: 'საცდელი შეჯამება', findingScore: 50,
  conditions: [{ id: 'one', nameKa: 'საცდელი მდგომარეობა', nameEn: 'Test', likelihood: 0, risk: 'low', needsTreatment: false,
    overviewKa: 'საცდელი აღწერა', severityKa: 'მსუბუქი', severityLevel: 1, symptomsKa: [], causesKa: [], treatmentsKa: [], whenToSeeDoctorKa: 'საცდელი მითითება', selfCareKa: [] }],
  redFlagsKa: [], nextStepsKa: ['საცდელი ნაბიჯი'] });
test('valid analysis preserves actual severity, zero likelihood and treatment flag', () => {
  const result = parseSymptomResult(JSON.stringify(valid()));
  assert.equal(result.urgency, 'urgent'); assert.equal(result.conditions[0].likelihood, 0); assert.equal(result.conditions[0].risk, 'low'); assert.equal(result.conditions[0].needsTreatment, false);
});
test('fenced JSON is accepted, unique IDs prevent opening the wrong condition', () => {
  const result = valid(); result.conditions.push({ ...result.conditions[0], nameKa: 'მეორე' });
  const parsed = parseSymptomResult('```json\n' + JSON.stringify(result) + '\n```');
  assert.notEqual(parsed.conditions[0].id, parsed.conditions[1].id);
});
test('missing provider response, prose, malformed JSON, and empty objects never yield an invented diagnosis', () => {
  for (const response of [null, '', 'provider unavailable', '{"summaryKa":', '{}', '[]']) assert.throws(() => parseSymptomResult(response), { code: 'AI_INVALID_RESPONSE', status: 502 });
});
test('missing urgency, invalid risk, non-finite score and incomplete conditions are rejected', () => {
  const cases = [r => delete r.urgency, r => r.conditions[0].risk = 'unknown', r => r.findingScore = null, r => delete r.conditions[0].overviewKa];
  for (const change of cases) { const result = valid(); change(result); assert.throws(() => parseSymptomResult(JSON.stringify(result)), { code: 'AI_INVALID_RESPONSE' }); }
});
test('valid emergency without a named condition retains red flags and urgency', () => {
  const result = valid(); result.urgency = 'emergency'; result.conditions = []; result.redFlagsKa = ['საცდელი გადაუდებელი ნიშანი'];
  const parsed = parseSymptomResult(JSON.stringify(result)); assert.equal(parsed.urgency, 'emergency'); assert.equal(parsed.conditions.length, 0); assert.equal(parsed.redFlagsKa.length, 1);
});

test('token-truncated analysis is rejected even if an inner object happens to parse', () => {
  assert.throws(() => parseSymptomResult(JSON.stringify(valid()), 'length'), { code: 'AI_RESPONSE_TRUNCATED' });
});
test('structured response schema is forwarded to the provider without changing normal chat', () => {
  const payload = buildOpenRouterChatPayload({model:'google/gemini-3.8-flash',messages:[],maxTokens:8000,responseFormat:SYMPTOM_RESPONSE_FORMAT});
  assert.equal(payload.max_tokens,8000);
  assert.equal(payload.response_format.json_schema.strict,true);
  assert.ok(payload.response_format.json_schema.schema.required.includes('nextStepsKa'));
  assert.equal(buildOpenRouterChatPayload({model:'google/gemini-3.8-flash',messages:[]}).response_format,undefined);
});
