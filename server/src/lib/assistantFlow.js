/** Fast paths only handle literal, unambiguous commands; everything else uses the planner. */
export function literalAssistantAction({ scope, text, draft }) {
  if (scope !== 'human' || draft) return null;
  const value = text.trim().replace(/^(?:მედი|Medi)[,\s]+/iu, '').replace(/^მე\s+/u, '').replace(/[.!]+$/u, '').trim().replace(/\s+/gu, ' ');
  const match = value.match(/^(?:წამალი|მედიკამენტი) ([\p{L}-]{2,60}) დამიმატე$/u)
    || value.match(/^დამიმატე (?:წამალი|მედიკამენტი) ([\p{L}-]{2,60})$/u);
  if (match && !/^(არ|არა|სხვა|ეს|ის|რამე|რომელი|არაფერი|ყველა|უსახელო)$/u.test(match[1])) {
    return { tool: 'medication_add', args: { medName: match[1] } };
  }
  const water = value.match(/^დღეს დავლიე (\d{1,4}) (?:მლ|მილილიტრი) წყალი$/u);
  if (water && Number(water[1]) > 0 && Number(water[1]) <= 5000) return { tool: 'hydration_add', args: { amountMl: Number(water[1]) } };
  return null;
}

const TOOL_DOMAINS = {
  nutrition_goal: ['nutrition'], nutrition_eat: ['nutrition'],
  hydration_add: ['metrics'], hydration_goal: ['metrics'], metric_record: ['metrics'],
  weight_goal: ['profile', 'metrics', 'goals'], steps_goal: ['goals', 'metrics'], profile_update: ['profile'],
  medication_add: ['medications'], medication_update: ['medications'], medication_stop: ['medications'], dose_record: ['medications'],
  record_open: ['records'], medication_open: ['medications'], visit_open: ['visits'],
  visit_add: ['visits'], visit_update: ['visits'], visit_cancel: ['visits'],
  period_record: ['cycle'], cycle_record: ['cycle'], pregnancy_record: ['cycle'], cycle_settings: ['cycle'],
};
/** No model is needed to classify a continuing task or clearly named domain. */
export function assistantContextSelection({ scope, text, draft }) {
  if (scope === 'pet') return ['pets'];
  // Questions spanning old records need semantic selection, not a guessed narrow context.
  if (/ანალიზ|დიაგნოზ|შედეგ|ისტორია|ადრე|წინათ|ყველაფერი|ყველა მონაცემ/u.test(text)) return null;
  if (!draft && /აპში რით|რას აკეთებ|რას აკეთებს მედი|შენი შესაძლებლობ/u.test(text)) return [];
  const domains = new Set(TOOL_DOMAINS[draft?.tool] || []);
  const rules = [
    [/წამალ|მედიკამენტ|დოზა|იბუპროფენ/u, ['medications']],
    [/კვებ|კალორი|რაციო|დიეტ|ცილა|სადილ|საუზმ|ვახშ|დავიკლ|დაკლებ|დაკლო|წახემს/u, ['nutrition']],
    [/წყალ|ჰიდრატაცი/u, ['metrics']], [/წონა|კილო|კგ/u, ['profile', 'metrics', 'goals']],
    [/ნაბიჯ|სირბილ|გასეირნ/u, ['metrics', 'goals', 'activity']],
    [/ვიზიტ|ჩაწერილი ექიმ/u, ['visits']], [/ციკლ|მენსტრუ|ორსულ|პერიოდ/u, ['cycle']],
    [/ალერგი|ქრონიკ|პროფილ/u, ['profile']],
    [/მედირან|medirun|medi run|აღმოჩენ/u, ['activity']],
  ];
  for (const [pattern, values] of rules) if (pattern.test(text)) values.forEach(value => domains.add(value));
  return domains.size ? [...domains] : null;
}

export function medicationCourseEnd(startDate, days) {
  const date = new Date(`${startDate}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days - 1); // The first treatment day counts as day one.
  return date.toISOString().slice(0, 10);
}

export function assistantGuidance(draft, parameters) {
  if (!draft || !parameters) return null;
  const empty = key => draft.args[key] == null || draft.args[key] === '' || (Array.isArray(draft.args[key]) && !draft.args[key].length);
  const fields = (parameters.required || []).filter(empty);
  if (draft.tool === 'medication_add') {
    if ((draft.args.courseDays || draft.args.endDate) && empty('startDate')) fields.push('startDate');
    const labels = { medName: 'წამლის სახელი', dosage: 'დოზა', frequency: 'მიღების დროები', startDate: 'დაწყების დღე' };
    return { fields, question: fields.length ? `მითხარი ${fields.map(key => labels[key] || key).join(' და ')}.` : 'ყველაფერი მზადაა. გადავამოწმოთ და შევინახოთ?' };
  }
  return { fields, question: null };
}
