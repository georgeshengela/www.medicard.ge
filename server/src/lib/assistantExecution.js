import { createHash, randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { prisma } from './prisma.js';
import { ASSISTANT_CATALOG, ASSISTANT_DESTINATIONS, assistantEndpoint, validateAssistantAction } from './assistantCatalog.js';
import { saveAppState } from './appState.js';

export function assistantError(message, status = 400, code = 'ASSISTANT_ACTION_INVALID') { return Object.assign(new Error(message), { status, code }); }
export function signAssistantPlan(userId, action, scope, today) {
  const validated = validateAssistantAction(action, scope);
  return { id: randomUUID(), scope, today, ...validated };
}
export function sealAssistantPlan(userId, plan) {
  return jwt.sign(plan, env.JWT_SECRET, { subject: userId, audience: 'medi-assistant-action', issuer: 'medicard', expiresIn: '15m', algorithm: 'HS256' });
}
export function verifyAssistantPlan(userId, token) {
  try {
    const p = jwt.verify(token, env.JWT_SECRET, { audience: 'medi-assistant-action', issuer: 'medicard', algorithms: ['HS256'], subject: userId });
    return { id: p.id, today: p.today, scope: p.scope, ...validateAssistantAction({ tool: p.tool, args: p.args }, p.scope) };
  } catch { throw assistantError('მოქმედების ვადა ამოიწურა. თავიდან გადაამოწმე შევსებული ინფორმაცია.', 409, 'ASSISTANT_PLAN_EXPIRED'); }
}
export function operationBody(plan) {
  const a = plan.args;
  if (plan.tool === 'hydration_add') return { hydrationEvents: [{ clientEventId: `medi:${plan.id}`, date: a.date, deltaMl: a.amountMl }] };
  if (plan.tool === 'metric_record') return { daily: [{ date: a.date, ...a.values }] };
  if (plan.tool === 'dose_record') return { events: [{ ...a, source: 'app', occurredAt: new Date().toISOString() }] };
  if (plan.tool === 'medication_stop' || plan.tool === 'visit_cancel') return { active: false };
  if (plan.tool === 'medication_add') {
    const { startDate, endDate, courseDays, ...med } = a;
    return { ...med, frequency: a.frequency.join(','), ...((startDate || endDate) ? { config: { frequencyKind: 'daily', ...(startDate ? { startDate } : {}), ...(endDate ? { endDate } : {}) } } : {}) };
  }
  if (plan.tool === 'medication_update') return { ...a.values, ...(a.values.frequency ? { frequency: a.values.frequency.join(',') } : {}) };
  if (plan.tool === 'visit_add') return { ...a, reminderConfig: { enabled: false, offsetsMinutes: [], repeatCount: 1 } };
  if (a.values) return a.values;
  const { petId, ...body } = a;
  return petId ? { ...body, clientRequestId: `medi:${plan.id}` } : body;
}
export function nativeAction(plan) {
  if (plan.tool === 'record_open') return { route: `/record/${plan.args.recordId}` };
  if (plan.tool === 'medication_open') return { route: `/medications/${plan.args.medicationId}` };
  if (plan.tool === 'visit_open') return { route: `/visits/editor?id=${plan.args.visitId}` };
  if (plan.tool === 'open') return { route: ASSISTANT_DESTINATIONS[plan.args.destination] };
  if (plan.tool === 'consult') return { route: `/chat/${plan.args.mode === 'CONSILIUM' ? 'consilium' : 'doctor'}`, message: plan.args.message, mode: plan.args.mode };
  if (plan.tool === 'pet_consult') return { route: `/pets/${plan.args.petId}/chat`, message: plan.args.message, petId: plan.args.petId };
  if (plan.tool === 'pet_open') return { route: `/pets/${plan.args.petId}${plan.args.destination === 'profile' ? '' : `/${plan.args.destination}`}` };
  return null;
}
export async function assertAssistantActionContext(userId, plan, db = prisma) {
  const a = plan.args;
  // Check ownership before preview AND execution; a signed ID is not an authorization grant.
  const reference = plan.tool === 'record_open' ? ['medicalRecord', a.recordId]
    : plan.tool.startsWith('medication_') && a.id ? ['medicationSchedule', a.id]
    : a.medicationId ? ['medicationSchedule', a.medicationId]
    : plan.tool.startsWith('visit_') && a.id ? ['doctorVisit', a.id]
    : a.visitId ? ['doctorVisit', a.visitId] : null;
  if (reference && !await db[reference[0]].findFirst({ where: { id: reference[1], userId }, select: { id: true } })) throw assistantError('ჩანაწერი ვერ მოიძებნა.', 404);
  if (a.petId && !await db.pet.findFirst({ where: { id: a.petId, userId, archivedAt: null }, select: { id: true } })) throw assistantError('ცხოველი ვერ მოიძებნა.', 404);
  if (['cycle_record', 'period_record', 'pregnancy_record', 'cycle_settings'].includes(plan.tool)) {
    const p = await db.cycleProfile.findUnique({ where: { userId } });
    if (p?.privacyEnabled) throw assistantError('ციკლი დაცულია. ჩანაწერი ციკლის გვერდიდან დაამატე.', 403, 'CYCLE_LOCKED');
    if (plan.tool === 'pregnancy_record' && p?.mode !== 'PREGNANCY') throw assistantError('ჯერ ორსულობის რეჟიმი შეამოწმე ციკლის გვერდზე.');
  }
  if (a.deadlineYmd && a.deadlineYmd <= plan.today) throw assistantError('მიზნის ვადა დღევანდელ დღეზე გვიან უნდა იყოს.');
  if (a.date && a.date > plan.today) throw assistantError('შესრულებულ მოქმედებას მომავალ თარიღზე ვერ ჩაწერ.');
}
/** The destination is from source code, never from the model, Host header or a URL supplied by the client. */
export async function dispatchAssistantOperation(plan, { userId, authorization, timezone, fetchImpl = fetch }) {
  if (plan.tool === 'weight_goal' || plan.tool === 'steps_goal') {
    const common = { id: plan.id, startedYmd: plan.today, deadlineYmd: plan.args.deadlineYmd, updatedAt: new Date().toISOString(),
      reminderEnabled: false, reminderDays: [], reminderHour: 9, reminderMinute: 0 };
    if (plan.tool === 'weight_goal') {
      const { startKg, targetKg } = plan.args;
      const weeks = (Date.parse(plan.args.deadlineYmd) - Date.parse(plan.today)) / 604800000;
      const rate = Math.abs(targetKg - startKg) / weeks;
      await saveAppState(userId, { weightGoal: { ...common, startKg, targetKg, paceKgPerWeek: rate, pace: rate <= 0.25 ? 'slow' : rate <= 0.5 ? 'moderate' : 'fast' } });
    } else await saveAppState(userId, { stepsGoal: { ...common, targetSteps: plan.args.targetSteps } });
    return;
  }
  const path = assistantEndpoint(plan);
  if (!path || !path.startsWith('/api/') || path.includes('..')) throw assistantError('მოქმედება მიუწვდომელია.');
  const response = await fetchImpl(`http://127.0.0.1:${env.PORT}${path}`, {
    method: ASSISTANT_CATALOG[plan.tool].method, redirect: 'error', signal: AbortSignal.timeout(45000),
    headers: { Authorization: authorization, 'Content-Type': 'application/json', 'X-Client-Timezone': timezone || 'UTC' },
    body: JSON.stringify(operationBody(plan)),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw assistantError(typeof body.error === 'string' ? body.error : 'ჩანაწერი ვერ შეინახა.', response.status, response.status >= 500 ? 'ASSISTANT_UNCERTAIN' : 'ASSISTANT_REJECTED');
  }
  await response.arrayBuffer();
}
/** Reserve before dispatch. A crash or lost response is never retried as a new mutation. */
export async function executeAssistantPlan(plan, options, db = prisma, dispatch = dispatchAssistantOperation) {
  const { userId } = options;
  await assertAssistantActionContext(userId, plan, db);
  const native = nativeAction(plan);
  // Deep links must not bypass the cycle entry screen's local unlock gate.
  if (native?.route.startsWith('/cycle/')) {
    const cycle = await db.cycleProfile.findUnique({ where: { userId }, select: { privacyEnabled: true } });
    if (cycle?.privacyEnabled) native.route = '/cycle';
  }
  if (native) return { status: 'navigate', native, operationId: plan.id };
  const hash = createHash('sha256').update(JSON.stringify({ tool: plan.tool, args: plan.args })).digest('hex');
  let inserted;
  try {
    inserted = await db.$executeRaw`INSERT INTO "AssistantOperation" ("id", "userId", "tool", "payloadHash", "status") VALUES (${plan.id}::uuid, ${userId}, ${plan.tool}, ${hash}, 'RUNNING') ON CONFLICT ("id") DO NOTHING`;
  } catch { throw assistantError('ასისტენტის შენახვის სერვისი ჯერ მზად არ არის. სხვა ფუნქციები ჩვეულებრივ მუშაობს.', 503, 'ASSISTANT_STORAGE_UNAVAILABLE'); }
  if (!inserted) {
    const [existing] = await db.$queryRaw`SELECT "status", "payloadHash" FROM "AssistantOperation" WHERE "id" = ${plan.id}::uuid AND "userId" = ${userId}`;
    if (!existing || existing.payloadHash !== hash) throw assistantError('მოქმედების იდენტიფიკატორი არ ემთხვევა.', 409);
    if (existing.status === 'DONE') return { status: 'saved', replayed: true, operationId: plan.id };
    throw assistantError('ამ მოთხოვნის შედეგი გადასამოწმებელია. გახსენი შესაბამისი ჩანაწერები, სანამ თავიდან დაამატებ.', 409, 'ASSISTANT_UNCERTAIN');
  }
  try {
    await dispatch(plan, options);
  } catch (error) {
    const state = error.code === 'ASSISTANT_REJECTED' ? 'REJECTED' : 'UNCERTAIN';
    await db.$executeRaw`UPDATE "AssistantOperation" SET "status" = ${state}, "updatedAt" = NOW() WHERE "id" = ${plan.id}::uuid AND "userId" = ${userId}`;
    if (state === 'UNCERTAIN') throw assistantError('კავშირი შენახვის დროს შეფერხდა. შედეგი ჩანაწერებში შეამოწმე; მოთხოვნა ავტომატურად აღარ განმეორდება.', 409, 'ASSISTANT_UNCERTAIN');
    throw error;
  }
  await db.$executeRaw`UPDATE "AssistantOperation" SET "status" = 'DONE', "updatedAt" = NOW() WHERE "id" = ${plan.id}::uuid AND "userId" = ${userId}`;
  return { status: 'saved', operationId: plan.id };
}
