import { z } from 'zod';

const text = (max) => z.string().trim().min(1).max(max);
const condition = z.object({
  id: z.string().optional(), nameKa: text(160), nameEn: z.string().default(''),
  likelihood: z.number().finite().min(0).max(100), risk: z.enum(['high', 'medium', 'low']),
  needsTreatment: z.boolean(), overviewKa: text(2400), severityKa: text(200),
  severityLevel: z.number().int().min(1).max(5),
  symptomsKa: z.array(text(600)).max(12), causesKa: z.array(text(600)).max(8),
  treatmentsKa: z.array(text(600)).max(8), whenToSeeDoctorKa: text(1200),
  selfCareKa: z.array(text(600)).max(8),
});
const schema = z.object({
  urgency: z.enum(['emergency', 'urgent', 'routine']), urgencyKa: text(400), summaryKa: text(1600),
  findingScore: z.number().finite().min(0).max(100), conditions: z.array(condition).max(6),
  redFlagsKa: z.array(text(600)).max(8), nextStepsKa: z.array(text(600)).min(1).max(8),
});

export const SYMPTOM_RESPONSE_FORMAT = {
  type: 'json_schema',
  json_schema: { name: 'medicard_symptom_result', strict: true, schema: z.toJSONSchema(schema) },
};

/** Never turn an unavailable or malformed medical analysis into a synthetic diagnosis. */
export function parseSymptomResult(raw, finishReason) {
  if (finishReason === 'length') {
    throw Object.assign(new Error('ანალიზის პასუხი ბოლომდე ვერ მიღებულა. გთხოვ, სცადო ხელახლა.'), { status: 502, statusCode: 502, code: 'AI_RESPONSE_TRUNCATED' });
  }
  try {
    const clean = String(raw || '').replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
    const start = clean.indexOf('{'), end = clean.lastIndexOf('}');
    const result = schema.parse(JSON.parse(start >= 0 && end > start ? clean.slice(start, end + 1) : clean));
    const ids = new Set();
    result.conditions = result.conditions.map((item, index) => {
      const base = String(item.id || item.nameEn).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `condition-${index + 1}`;
      let id = base; for (let suffix = 2; ids.has(id); suffix++) id = `${base}-${suffix}`;
      ids.add(id);
      return { ...item, id };
    });
    return result;
  } catch {
    throw Object.assign(new Error('ანალიზის პასუხი ვერ დამუშავდა. გთხოვ, სცადო ხელახლა.'), { status: 502, statusCode: 502, code: 'AI_INVALID_RESPONSE' });
  }
}
