import { z } from 'zod';
import { ASSISTANT_DESTINATIONS, assistantDestinationAllowed, assistantFeatures, assistantToolGroup } from './assistantKnowledge.js';
export { ASSISTANT_DESTINATIONS } from './assistantKnowledge.js';
import { medicationCourseEnd } from './assistantFlow.js';
import { ALLERGY_CATEGORIES, ALLERGY_STATUSES, CONDITION_BASES, CONDITION_STATUSES } from './petsHealth.js';
import { CARE_KINDS, CARE_ROUTES, CARE_SOURCES, RECURRENCE_BASES, RECURRENCE_KINDS, TIME_MODES } from './petsSchedule.js';
import { CYCLE_AI_SYMPTOM_ALLOWLIST, CYCLE_AI_MOOD_ALLOWLIST } from './cycleAiContext.js';

const text = (max = 300) => z.string().trim().min(1).max(max);
const id = z.string().uuid();
export const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const d = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === value;
}, 'თარიღი არასწორია');
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const list = z.array(text(120)).max(40);
const fields = shape => z.object(shape).strict();
const patch = shape => fields(shape).refine(v => Object.keys(v).length > 0);
const petId = { petId: id };
const petIdentity = {
  name: text(40), speciesId: text(40), breedId: text(80), customBreed: text(80).optional(),
  sex: z.enum(['MALE', 'FEMALE', 'UNKNOWN']), neutered: z.boolean().optional(),
  ageKind: z.enum(['EXACT', 'APPROXIMATE', 'UNKNOWN']), birthDate: dateKey.optional(),
  approxAgeYears: z.number().int().min(0).max(80).optional(), approxAgeMonths: z.number().int().min(0).max(11).optional(),
};
const profile = {
  heightCm: z.number().min(80).max(250).optional(), weightKg: z.number().min(20).max(300).optional(),
  bloodType: z.enum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'UNKNOWN']).optional(),
  chronicConditions: list.optional(), allergies: list.optional(), medications: list.optional(), familyHistory: list.optional(), healthGoals: list.optional(),
  activityLevel: z.enum(['SEDENTARY', 'LIGHT', 'MODERATE', 'ACTIVE', 'VERY_ACTIVE']).optional(),
  sleepHours: z.number().min(3).max(14).optional(), dietType: z.enum(['OMNIVORE', 'VEGETARIAN', 'VEGAN', 'KETO', 'OTHER']).optional(),
  smokingStatus: z.enum(['NEVER', 'FORMER', 'CURRENT']).optional(), alcoholUse: z.enum(['NEVER', 'OCCASIONAL', 'REGULAR']).optional(),
};
const catalog = {};
function add(name, label, domain, schema, endpoint, description = '', method = 'POST') {
  catalog[name] = { name, label, domain, schema, endpoint, description, method };
}
add('open', 'ფუნქციის გახსნა', 'navigation', fields({ destination: z.enum(Object.keys(ASSISTANT_DESTINATIONS)) }), null,
  'Open existing native workflows: camera/file analysis, GPS run, Quest, settings, cycle modes, reports. Never fabricate camera/GPS/HealthKit data or rewards.');
add('record_open', 'შენახული შედეგის გახსნა', 'human', fields({ recordId: id }), null, 'Open an existing owned medical record. Resolve ID from context; do not invent it.');
add('medication_open', 'წამლის დეტალების გახსნა', 'human', fields({ medicationId: id }), null, 'Open an existing medication for dose details, rescheduling a dose and intake actions.');
add('visit_open', 'ვიზიტის დეტალების გახსნა', 'human', fields({ visitId: id }), null, 'Open an existing visit editor, including reminders.');
add('consult', 'კონსულტაციის დაწყება', 'human', fields({ mode: z.enum(['DOCTOR', 'CONSILIUM']), message: text(4000) }), null,
  'Start the existing clinical consultation with the user’s exact complaint. For medical advice use this, do not diagnose in planner.');
add('pet_consult', 'Medi Vet-თან საუბარი', 'pet', fields({ ...petId, message: text(4000) }), null);
add('hydration_add', 'წყლის მიღების ჩაწერა', 'human', fields({ date: dateKey, amountMl: z.number().int().min(1).max(5000) }), '/api/health-metrics/sync',
  'One glass is ambiguous: ask millilitres. Record actual intake, never recommend large amounts.');
add('hydration_goal', 'წყლის მიზანი', 'human', fields({ goalMl: z.number().int().min(500).max(6000) }), '/api/health-metrics/hydration/goal', '', 'PUT');
add('metric_record', 'მაჩვენებლის ჩაწერა', 'human', fields({ date: dateKey, values: patch({
  weightKg: z.number().min(20).max(300).optional(), heartRate: z.number().int().min(30).max(220).optional(),
  bloodPressureSystolic: z.number().int().min(70).max(250).optional(), bloodPressureDiastolic: z.number().int().min(40).max(150).optional(),
  sleepHours: z.number().min(0).max(24).optional(), nutritionKcal: z.number().int().min(0).max(20000).optional(),
}) }), '/api/health-metrics/sync', 'User-reported readings only. nutritionKcal is an ADDITION; sleepHours is the daily total.');
add('nutrition_goal', 'კვების მიზნის შერჩევა', 'human', fields({ targetKg:z.number().min(30).max(300).optional(), loseKg:z.number().positive().max(150).optional() }), null,
  'Open the native nutrition goal wizard with the stated desired weight OR amount to lose. Do not invent calorie targets or a deadline. Current weight, safety and preferences are confirmed there.');
add('nutrition_eat', 'რაციონის კვების აღრიცხვა', 'human', fields({plannedMealId:id}), a => `/api/nutrition/plan/${a.plannedMealId}/eat`,
  'Mark an owned planned meal actually eaten only when user explicitly says they ate it. Resolve plannedMealId from nutrition context. Does not record a vague meal or photo.');
add('weight_goal', 'წონის მიზნის დამატება', 'human', fields({ targetKg: z.number().min(20).max(300), startKg: z.number().min(20).max(300), deadlineYmd: dateKey }), null,
  'Ask for missing current weight/deadline. Use stored recent weight when available. User goal is not a medical recommendation; never invent a target, deadline or safe rate.');
add('steps_goal', 'ნაბიჯების მიზანი', 'human', fields({ targetSteps: z.number().int().min(500).max(100000), deadlineYmd: dateKey }), null);
add('profile_update', 'ჯანმრთელობის პროფილის განახლება', 'human', patch(profile), '/api/health-profile',
  'Array fields replace the existing array: preserve other entries when adding. Never write inferred diagnoses or prescribed medication.', 'PUT');
const med = { medName: text(120), dosage: text(80), frequency: z.array(time).min(1).max(8), notes: text(300).optional() };
add('medication_add', 'მედიკამენტის შეხსენება', 'human', fields({ ...med, startDate: dateKey.optional(), endDate: dateKey.optional(), courseDays: z.number().int().min(1).max(365).optional() }), '/api/medications', 'Record the exact user-provided medicine, dose, DAILY intake times and optional treatment course. No prescribing. Convert an explicitly stated two weeks to courseDays:14. A stated duration requires startDate: ask when to start unless stated. endDate is inclusive. Do not invent a course or time. Non-daily/as-needed schedules must open the native medication workflow instead.');
add('medication_update', 'მედიკამენტის განახლება', 'human', fields({ id, values: patch(Object.fromEntries(Object.entries(med).map(([k, v]) => [k, v.optional()]))) }), a => `/api/medications/${a.id}`, '', 'PATCH');
add('medication_stop', 'შეხსენების შეჩერება', 'human', fields({ id }), a => `/api/medications/${a.id}`, 'Stops app reminders, not advice to stop taking medication.', 'PATCH');
add('dose_record', 'მედიკამენტის მიღების აღრიცხვა', 'human', fields({ medicationId: id, date: dateKey, time, status: z.enum(['taken', 'skipped']) }), '/api/push/dose-events');
const visit = { doctorType: z.enum(['GP', 'DENTIST', 'CARDIO', 'GYN', 'NEURO', 'ORTHO', 'THERAPIST', 'OPHTHALMO', 'DERM', 'PED', 'OTHER']),
  doctorFirstName: text(80).optional(), doctorLastName: text(80).optional(), visitDate: dateKey, visitTime: time, address: text(300).optional(), notes: text(500).optional() };
add('visit_add', 'ვიზიტის ჩანაწერი', 'human', fields(visit), '/api/visits', 'Personal calendar entry only, not an actual clinic booking. Reminders configured in native visit screen.');
add('visit_update', 'ვიზიტის განახლება', 'human', fields({ id, values: patch(Object.fromEntries(Object.entries(visit).map(([k, v]) => [k, v.optional()]))) }), a => `/api/visits/${a.id}`, '', 'PATCH');
add('visit_cancel', 'ვიზიტის ჩანაწერის გაუქმება', 'human', fields({ id }), a => `/api/visits/${a.id}`, 'Deactivates personal entry; does not cancel with a clinic.', 'PATCH');
add('period_record', 'პერიოდის აღრიცხვა', 'human', fields({ action: z.enum(['start', 'end']), date: dateKey, flow: z.enum(['light', 'medium', 'heavy']).optional() }), '/api/cycle/period', '', 'PUT');
add('cycle_record', 'ციკლის მოკლე აღრიცხვა', 'human', fields({ date: dateKey, values: patch({
  flow: z.enum(['none', 'spotting', 'light', 'medium', 'heavy']).optional(), symptoms: z.array(z.enum(CYCLE_AI_SYMPTOM_ALLOWLIST)).max(40).optional(), moods: z.array(z.enum(CYCLE_AI_MOOD_ALLOWLIST)).max(20).optional(),
  notes: text(2000).optional(), bbt: z.number().min(34).max(42).optional(),
  ovulationTest: z.enum(['positive', 'negative', 'unclear']).optional(), pregnancyTest: z.enum(['positive', 'negative', 'unclear']).optional(),
  sleepQuality: z.enum(['poor', 'okay', 'good']).optional(), stressLevel: z.enum(['low', 'medium', 'high']).optional(), energy: z.enum(['very_low', 'low', 'normal', 'high', 'very_high']).optional(),
}) }), a => `/api/cycle/logs/${a.date}`, 'Use observation registry keys from context; preserve existing symptoms/moods when adding. Private cycle lock must be respected.', 'PUT');
add('pregnancy_record', 'ორსულობის ჩანაწერი', 'human', fields({ date: dateKey, values: patch({
  weightKg: z.number().min(30).max(200).optional(), kickCount: z.number().int().min(0).max(500).optional(),
  symptoms: list.optional(), notes: text(500).optional(),
}) }), a => `/api/cycle/pregnancy/${a.date}`, 'kickCount is the daily total. Do not infer pregnancy; require existing pregnancy mode.', 'PUT');
add('pet_add', 'ცხოველის დამატება', 'pet', fields(petIdentity), '/api/pets', 'Ask name/species/breed/sex/age. UNKNOWN is allowed only if user says unknown or chooses to skip. Collect missing required details together; the UI already supports speech and manual completion.');
add('pet_update', 'ცხოველის პროფილის განახლება', 'pet', fields({ ...petId, values: patch(Object.fromEntries(Object.entries(petIdentity).map(([k, v]) => [k, v.optional()]))) }), a => `/api/pets/${a.petId}`, '', 'PATCH');
add('pet_weight', 'ცხოველის წონის ჩაწერა', 'pet', fields({ ...petId, recordedOn: dateKey, inputValue: z.number().positive().max(5000), inputUnit: z.enum(['kg', 'g', 'lb']), note: text(280).optional() }), a => `/api/pets/${a.petId}/weight`);
add('pet_allergy', 'ცხოველის ალერგიის ჩაწერა', 'pet', fields({ ...petId, name: text(80), category: z.enum(ALLERGY_CATEGORIES), reportedStatus: z.enum(ALLERGY_STATUSES), reaction: text(200).optional(), notedOn: dateKey.optional(), notes: text(500).optional() }), a => `/api/pets/${a.petId}/allergies`);
add('pet_condition', 'ცხოველის ჯანმრთელობის ჩანაწერი', 'pet', fields({ ...petId, name: text(80), status: z.enum(CONDITION_STATUSES), reportedBasis: z.enum(CONDITION_BASES), onsetOn: dateKey.optional(), notes: text(500).optional() }), a => `/api/pets/${a.petId}/conditions`);
add('pet_product', 'ცხოველის მოვლის პროდუქტი', 'pet', fields({ ...petId, kind: z.enum(CARE_KINDS), name: text(80), formulation: text(80).optional(), batchId: text(80).optional(), expiresOn: dateKey.optional(), notes: text(500).optional() }), a => `/api/pets/${a.petId}/products`);
add('pet_care_plan', 'ცხოველის მოვლის გეგმა', 'pet', fields({ ...petId, kind: z.enum(CARE_KINDS), title: text(100), productId: id.optional(),
  dose: text(80).optional(), doseUnit: text(40).optional(), route: z.enum(CARE_ROUTES).optional(), startOn: dateKey, dueTime: time.optional(),
  recurrenceKind: z.enum(RECURRENCE_KINDS), intervalCount: z.number().int().min(1).max(365).optional(), recurrenceBasis: z.enum(RECURRENCE_BASES), source: z.enum(CARE_SOURCES),
  sourceNote: text(300).optional(), courseEndsOn: dateKey.optional(), timeMode: z.enum(TIME_MODES), timezone: text(80).optional(),
}), a => `/api/pets/${a.petId}/schedules`, 'Only record owner-provided/veterinarian-provided plan; never invent medicine or dosing.');
add('pet_care_record', 'ცხოველის მოვლის აღრიცხვა', 'pet', fields({ ...petId, kind: z.enum(CARE_KINDS), title: text(100), productId: id.optional(),
  dose: text(80).optional(), doseUnit: text(40).optional(), route: z.enum(CARE_ROUTES).optional(), administeredOn: dateKey, administeredTime: time.optional(), notes: text(500).optional(),
}), a => `/api/pets/${a.petId}/events`);
add('pet_open', 'ცხოველის გვერდის გახსნა', 'pet', fields({ ...petId, destination: z.enum(['profile', 'edit', 'weight', 'allergies', 'conditions', 'care', 'care/plan', 'care/record', 'care/products', 'care/history']) }), null);
add('cycle_settings', 'ციკლის რეჟიმის განახლება', 'human', patch({
  mode: z.enum(['TRACK_PERIOD', 'TRY_TO_CONCEIVE', 'PREGNANCY', 'PERIMENOPAUSE', 'POSTPARTUM']).optional(),
  avgCycleLength: z.number().int().min(21).max(45).optional(), avgPeriodLength: z.number().int().min(2).max(10).optional(),
  lastPeriodStart: dateKey.optional(), isIrregular: z.boolean().optional(), dueDate: dateKey.optional(),
  pregnancyReferenceDate: dateKey.optional(), pregnancyReferenceType: z.enum(['LMP', 'USER_SELECTED']).optional(), pregnancyConfirm: z.literal(true).optional(),
  postpartumReferenceDate: dateKey.optional(), postpartumConfirm: z.literal(true).optional(),
}), '/api/cycle/profile', 'Mode changes require explicit user request and dates; never infer pregnancy from symptoms. Show confirmation fields and dates.', 'PUT');
export const ASSISTANT_CATALOG = Object.freeze(catalog);
export function publicAssistantCatalog(scope) {
  return Object.values(catalog).filter(t => scope === 'auto' || t.domain === scope || t.domain === 'navigation').map(({ name, label, description, schema, domain }) => ({
    domain,
    name, label, description, group: assistantToolGroup(name), kind: name === 'nutrition_goal' || name === 'weight_goal' || name === 'open' || name === 'consult' || name.endsWith('_open') || name === 'pet_consult' ? 'handoff' : 'write',
    parameters: name === 'open' ? { ...z.toJSONSchema(schema, { unrepresentable: 'any' }), properties: { destination: { type: 'string', enum: assistantFeatures(scope).map(f => f.id) } } } : z.toJSONSchema(schema, { unrepresentable: 'any' }),
  }));
}
export function validateAssistantAction(action, scope) {
  const outer = fields({ tool: text(60), args: z.record(z.string(), z.unknown()) }).parse(action);
  const tool = catalog[outer.tool];
  if (!tool || (tool.domain !== scope && tool.domain !== 'navigation')) throw Object.assign(new Error('მოქმედება ამ საუბარში მიუწვდომელია.'), { status: 400 });
  const args = tool.schema.parse(outer.args);
  if (outer.tool === 'open' && !assistantDestinationAllowed(args.destination, scope)) throw Object.assign(new Error('ამ რეჟიმში გვერდი მიუწვდომელია.'), { status: 400 });
  if (outer.tool === 'medication_add') {
    if ((args.courseDays || args.endDate) && !args.startDate) throw new z.ZodError([{ code: 'custom', path: ['startDate'], message: 'აირჩიე კურსის დაწყების დღე' }]);
    if (args.endDate && args.endDate < args.startDate) throw new z.ZodError([{ code: 'custom', path: ['endDate'], message: 'დასრულება დაწყებაზე ადრე ვერ იქნება' }]);
    if (args.courseDays) {
      const endDate = medicationCourseEnd(args.startDate, args.courseDays);
      if (args.endDate && args.endDate !== endDate) throw new z.ZodError([{ code: 'custom', path: ['endDate'], message: 'კურსის ხანგრძლივობა და დასრულების დღე ერთმანეთს არ ემთხვევა' }]);
      args.endDate = endDate;
    }
    args.frequency = [...new Set(args.frequency)].sort();
  }
  return { tool: outer.tool, args };
}
export function assistantEndpoint(action) {
  const tool = catalog[action.tool];
  return typeof tool.endpoint === 'function' ? tool.endpoint(action.args) : tool.endpoint;
}
