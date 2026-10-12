// MEDIFAMILY API (/api/family): a parent's children — calendar vaccines, growth, day log, foods, milestones,
// health items, the age guide and the reminder feed. Medi's chat lives in familyChat.routes.js.
// Every child is reached through FamilyAccess; nothing about a child ever goes into a URL beyond its id.
import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/error.js';
import { t } from '../lib/i18n.js';
import { daysBetween, dayStartMs, familyTimeZone, familyTodayYmd, isYmd, toYmd, CHILD_MAX_YEARS } from '../lib/family/age.js';
import { feedingGuide, foodList, isFoodKey, isMilestoneKey, milestoneCheckpoint, milestoneGuide, stageTips } from '../lib/family/guide.js';
import { EXTRA_VACCINES, GE_CALENDAR_SOURCE, GE_DOSES, GE_STAGES, RECORD_STATUSES, calendarDueOn, isCalendarDoseId, isExtraCode, vaccineNote } from '../lib/family/vaccinesGe.js';
import { FOOD_STATUSES } from '../lib/family/guideData.js';
import * as store from '../lib/family/store.js';
import { ageInfo, feedingToday, growthView, listItemView, overviewView, sickDayView, vaccineView } from '../lib/family/view.js';
import { buildReminderFeed } from '../lib/family/reminders.js';
import { familyChatRouter } from './familyChat.routes.js';

export const familyRouter = Router();
familyRouter.use(requireAuth);

const ID_RE = /^[0-9a-f-]{36}$/i;
const ymd = z.string().refine(isYmd);
const text = (max) => z.string().trim().max(max);
const optText = (max) => z.union([text(max), z.null()]).optional();

function fail(res, status, ka, en, code) {
  return res.status(status).json({ error: t(res.req, ka, en), code });
}

function schemaError(res, error) {
  if (store.isFamilySchemaMissing(error)) return res.status(503).json({ schemaReady: false, error: t(res.req, 'MEDIFAMILY ჯერ მზად არ არის.', 'MEDIFAMILY is not ready yet.') });
  throw error;
}

function badInput(res, error) {
  if (error instanceof z.ZodError) return fail(res, 400, 'შეამოწმე შეყვანილი მონაცემები.', 'Please check the details you entered.', 'INVALID_INPUT');
  throw error;
}

/** Wraps a handler: schema-missing → 503, zod → 400. */
const handle = (fn) => asyncHandler(async (req, res) => {
  try {
    await fn(req, res);
  } catch (error) {
    if (error instanceof z.ZodError) return badInput(res, error);
    return schemaError(res, error);
  }
});

async function memberOr404(req, res) {
  const memberId = String(req.params.memberId || '');
  if (!ID_RE.test(memberId)) { fail(res, 404, store.FAMILY_NOT_FOUND.error, store.FAMILY_NOT_FOUND.errorEn, 'FAMILY_NOT_FOUND'); return null; }
  const member = await store.findMember(req.user.id, memberId);
  if (!member) { fail(res, 404, store.FAMILY_NOT_FOUND.error, store.FAMILY_NOT_FOUND.errorEn, 'FAMILY_NOT_FOUND'); return null; }
  return member;
}

function clock(req) {
  const tz = familyTimeZone(req);
  const today = familyTodayYmd(req);
  return { tz, today, todayStartMs: dayStartMs(tz, today), nowMs: Date.now() };
}

// ── Children ─────────────────────────────────────────────────────────────────────────────────
const memberFields = {
  name: text(40).min(1),
  birthDate: ymd,
  sex: z.enum(['FEMALE', 'MALE']),
  gestationWeeks: z.union([z.number().int().min(22).max(44), z.null()]).optional(),
  birthWeightG: z.union([z.number().int().min(300).max(7000), z.null()]).optional(),
  birthLengthCm: z.union([z.number().min(25).max(65), z.null()]).optional(),
  bloodGroup: z.union([z.enum(['0+', '0-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-']), z.null()]).optional(),
  color: z.union([z.string().regex(/^[a-z]{2,16}$/), z.null()]).optional(),
  feedingMode: z.union([z.enum(['BREAST', 'FORMULA', 'MIXED']), z.null()]).optional(),
  notes: optText(500),
};
const createSchema = z.object({ ...memberFields, consent: z.literal(true), pastVaccines: z.enum(['ALL', 'NONE', 'MANUAL']).optional() });
const patchSchema = z.object(Object.fromEntries(Object.entries(memberFields).map(([k, v]) => [k, v.optional()])));

function birthDateProblem(req, birthDate) {
  const today = familyTodayYmd(req);
  if (birthDate > today) return t(req, 'დაბადების თარიღი მომავალში ვერ იქნება.', 'The birth date can’t be in the future.');
  if (daysBetween(birthDate, today) >= CHILD_MAX_YEARS * 365.25) return t(req, 'MEDIFAMILY 18 წლამდე ბავშვებისთვისაა.', 'MEDIFAMILY is for children under 18.');
  return null;
}

/** Calendar doses whose date has passed (for „all vaccines so far are done“). */
function pastCalendarDoses(birthDate, today) {
  return GE_DOSES.filter((d) => !d.conditional && calendarDueOn(birthDate, d.due) <= today).map((d) => ({ code: d.code, dose: d.dose }));
}

familyRouter.get('/', handle(async (req, res) => {
  const { today } = clock(req);
  const members = await store.listMembers(req.user.id);
  const out = [];
  for (const member of members) out.push(listItemView({ member, doses: await store.listDoses(member.id), todayYmd: today, lang: req.lang }));
  res.json({ schemaReady: true, members: out, maxChildren: store.MAX_CHILDREN, consentVersion: store.FAMILY_CONSENT_VERSION });
}));

familyRouter.post('/members', handle(async (req, res) => {
  const input = createSchema.parse(req.body || {});
  const problem = birthDateProblem(req, input.birthDate);
  if (problem) return res.status(400).json({ error: problem, code: 'INVALID_BIRTH_DATE' });
  if ((await store.countMembers(req.user.id)) >= store.MAX_CHILDREN) return fail(res, 409, 'მაქსიმუმ 12 ბავშვის დამატება შეიძლება.', 'You can add up to 12 children.', 'FAMILY_LIMIT');
  const member = await store.createMember(req.user.id, input);
  if (input.pastVaccines === 'ALL') await store.markDosesGiven(member.id, req.user.id, pastCalendarDoses(input.birthDate, familyTodayYmd(req)));
  res.status(201).json({ member: store.publicMember(member) });
}));

familyRouter.get('/members/:memberId', handle(async (req, res) => {
  const member = await memberOr404(req, res);
  if (!member) return;
  res.json({ member: store.publicMember(member), age: ageInfo(member, familyTodayYmd(req), req.lang) });
}));

familyRouter.patch('/members/:memberId', handle(async (req, res) => {
  const member = await memberOr404(req, res);
  if (!member) return;
  const patch = patchSchema.parse(req.body || {});
  if (patch.birthDate) {
    const problem = birthDateProblem(req, patch.birthDate);
    if (problem) return res.status(400).json({ error: problem, code: 'INVALID_BIRTH_DATE' });
  }
  const row = await store.updateMember(member.id, patch);
  res.json({ member: store.publicMember({ ...row, role: member.role }) });
}));

familyRouter.delete('/members/:memberId', handle(async (req, res) => {
  const member = await memberOr404(req, res);
  if (!member) return;
  if (member.role !== 'OWNER') return fail(res, 403, 'ბავშვის პროფილის წაშლა მხოლოდ მის შემქმნელს შეუძლია.', 'Only the parent who added the child can delete the profile.', 'FAMILY_OWNER_ONLY');
  await store.deleteMember(member.id);
  res.json({ ok: true });
}));

familyRouter.get('/members/:memberId/overview', handle(async (req, res) => {
  const member = await memberOr404(req, res);
  if (!member) return;
  const { today, todayStartMs, nowMs } = clock(req);
  const [doses, measurements, logs, health, foods, milestones] = await Promise.all([
    store.listDoses(member.id), store.listMeasurements(member.id), store.listLogs(member.id, { from: new Date(nowMs - 7 * 86400000) }),
    store.listHealthItems(member.id), store.listFoods(member.id), store.listMilestones(member.id),
  ]);
  res.json(overviewView({ member, doses, measurements, logs, health, foods, milestones, todayYmd: today, todayStartMs, nowMs, lang: req.lang }));
}));

// ── Vaccines ─────────────────────────────────────────────────────────────────────────────────
familyRouter.get('/members/:memberId/vaccines', handle(async (req, res) => {
  const member = await memberOr404(req, res);
  if (!member) return;
  const { today } = clock(req);
  const view = vaccineView(member, await store.listDoses(member.id), today, req.lang);
  const pick = (pair) => pair[req.lang === 'en' ? 'en' : 'ka'];
  res.json({
    ...view,
    stages: GE_STAGES.map((s) => ({ key: s.key, label: pick(s.label) })),
    source: { text: pick(GE_CALENDAR_SOURCE), url: GE_CALENDAR_SOURCE.url, checkedOn: GE_CALENDAR_SOURCE.checkedOn },
    freeNote: vaccineNote('free', req.lang),
    extraCatalog: EXTRA_VACCINES.map((v) => ({ code: v.code, name: pick(v.name) })),
  });
}));

const doseSchema = z.object({
  status: z.enum(RECORD_STATUSES),
  givenOn: z.union([ymd, z.null()]).optional(),
  place: optText(120), lot: optText(60), reaction: optText(300), note: optText(300),
});

function dateProblem(req, member, on, label = 'date') {
  if (!on) return null;
  const birth = toYmd(member.birthDate);
  if (on < birth) return t(req, 'თარიღი დაბადებამდე ვერ იქნება.', 'The date can’t be before birth.');
  if (on > familyTodayYmd(req)) return t(req, 'თარიღი მომავალში ვერ იქნება.', `The ${label} can’t be in the future.`);
  return null;
}

familyRouter.put('/members/:memberId/vaccines/:doseId', handle(async (req, res) => {
  const member = await memberOr404(req, res);
  if (!member) return;
  const doseId = String(req.params.doseId);
  if (!isCalendarDoseId(doseId)) return fail(res, 404, 'ასეთი აცრა კალენდარში არ არის.', 'No such dose on the calendar.', 'DOSE_NOT_FOUND');
  const input = doseSchema.parse(req.body || {});
  if (input.status === 'GIVEN' && !input.givenOn) return fail(res, 400, 'მიუთითე აცრის თარიღი.', 'Add the date of the shot.', 'DATE_REQUIRED');
  const problem = dateProblem(req, member, input.givenOn);
  if (problem) return res.status(400).json({ error: problem, code: 'INVALID_DATE' });
  const [code, dose] = doseId.split('-');
  const row = await store.upsertDose(member.id, req.user.id, { code, dose: Number(dose), ...input, givenOn: input.status === 'GIVEN' ? input.givenOn : null });
  res.json({ dose: store.publicDose(row) });
}));

familyRouter.delete('/members/:memberId/vaccines/:doseId', handle(async (req, res) => {
  const member = await memberOr404(req, res);
  if (!member) return;
  const doseId = String(req.params.doseId);
  if (!isCalendarDoseId(doseId)) return fail(res, 404, 'ასეთი აცრა კალენდარში არ არის.', 'No such dose on the calendar.', 'DOSE_NOT_FOUND');
  const [code, dose] = doseId.split('-');
  await store.deleteDose(member.id, code, Number(dose));
  res.json({ ok: true });
}));

familyRouter.post('/members/:memberId/vaccines/past', handle(async (req, res) => {
  const member = await memberOr404(req, res);
  if (!member) return;
  const added = await store.markDosesGiven(member.id, req.user.id, pastCalendarDoses(toYmd(member.birthDate), familyTodayYmd(req)));
  res.json({ ok: true, added });
}));

const extraSchema = z.object({
  code: z.string().refine(isExtraCode),
  givenOn: ymd,
  nextOn: z.union([ymd, z.null()]).optional(),
  place: optText(120), lot: optText(60), reaction: optText(300), note: optText(120),
});

familyRouter.post('/members/:memberId/vaccines/extra', handle(async (req, res) => {
  const member = await memberOr404(req, res);
  if (!member) return;
  const input = extraSchema.parse(req.body || {});
  const problem = dateProblem(req, member, input.givenOn);
  if (problem) return res.status(400).json({ error: problem, code: 'INVALID_DATE' });
  if (input.nextOn && input.nextOn <= input.givenOn) return fail(res, 400, 'შემდეგი დოზის თარიღი ამ აცრის შემდეგ უნდა იყოს.', 'The next dose must come after this one.', 'INVALID_NEXT');
  const code = `x:${input.code}`;
  const dose = await store.nextExtraDoseNumber(member.id, code);
  const row = await store.upsertDose(member.id, req.user.id, { ...input, code, dose, status: 'GIVEN' });
  res.status(201).json({ dose: store.publicDose(row) });
}));

familyRouter.delete('/members/:memberId/vaccines/extra/:recordId', handle(async (req, res) => {
  const member = await memberOr404(req, res);
  if (!member) return;
  if (!ID_RE.test(String(req.params.recordId))) return fail(res, 404, 'ჩანაწერი ვერ მოიძებნა.', 'Record not found.', 'NOT_FOUND');
  await store.deleteDoseById(member.id, String(req.params.recordId));
  res.json({ ok: true });
}));

// ── Growth ───────────────────────────────────────────────────────────────────────────────────
const measurementSchema = z.object({
  measuredOn: ymd,
  weightKg: z.union([z.number().min(0.3).max(200), z.null()]).optional(),
  heightCm: z.union([z.number().min(20).max(230), z.null()]).optional(),
  headCm: z.union([z.number().min(20).max(70), z.null()]).optional(),
  position: z.union([z.enum(['LYING', 'STANDING']), z.null()]).optional(),
  note: optText(200),
}).refine((m) => m.weightKg || m.heightCm || m.headCm);

familyRouter.get('/members/:memberId/growth', handle(async (req, res) => {
  const member = await memberOr404(req, res);
  if (!member) return;
  const { today } = clock(req);
  res.json({ age: ageInfo(member, today, req.lang), ...growthView(member, await store.listMeasurements(member.id), today, req.lang) });
}));

familyRouter.post('/members/:memberId/measurements', handle(async (req, res) => {
  const member = await memberOr404(req, res);
  if (!member) return;
  const input = measurementSchema.parse(req.body || {});
  const problem = dateProblem(req, member, input.measuredOn);
  if (problem) return res.status(400).json({ error: problem, code: 'INVALID_DATE' });
  const row = await store.createMeasurement(member.id, req.user.id, input);
  res.status(201).json({ measurement: store.publicMeasurement(row) });
}));

familyRouter.patch('/members/:memberId/measurements/:measurementId', handle(async (req, res) => {
  const member = await memberOr404(req, res);
  if (!member) return;
  const input = measurementSchema.parse(req.body || {});
  const problem = dateProblem(req, member, input.measuredOn);
  if (problem) return res.status(400).json({ error: problem, code: 'INVALID_DATE' });
  const row = await store.updateMeasurement(member.id, String(req.params.measurementId), input);
  if (!row) return fail(res, 404, 'გაზომვა ვერ მოიძებნა.', 'Measurement not found.', 'NOT_FOUND');
  res.json({ measurement: store.publicMeasurement(row) });
}));

familyRouter.delete('/members/:memberId/measurements/:measurementId', handle(async (req, res) => {
  const member = await memberOr404(req, res);
  if (!member) return;
  await store.deleteMeasurement(member.id, String(req.params.measurementId));
  res.json({ ok: true });
}));

// ── Day log ──────────────────────────────────────────────────────────────────────────────────
const LOG_DATA = {
  FEED: z.object({
    type: z.enum(['BREAST', 'BOTTLE', 'SOLID']),
    side: z.enum(['L', 'R', 'BOTH']).optional(),
    minutes: z.number().int().min(0).max(180).optional(),
    ml: z.number().int().min(0).max(600).optional(),
    milk: z.enum(['BREASTMILK', 'FORMULA']).optional(),
    food: text(80).optional(),
    note: text(200).optional(),
  }),
  TEMP: z.object({ c: z.number().min(34).max(43), site: z.enum(['ARMPIT', 'EAR', 'FOREHEAD', 'RECTAL', 'ORAL']).optional() }),
  SYMPTOM: z.object({ ids: z.array(z.string().regex(/^[a-z_]{2,32}$/)).max(12), labels: z.array(text(60)).max(12).optional(), note: text(300).optional() }),
  MED: z.object({ name: text(80).min(1), amount: text(40).optional(), note: text(200).optional() }),
  DIAPER: z.object({ wet: z.boolean().optional(), dirty: z.boolean().optional() }),
  NOTE: z.object({ text: text(500).min(1) }),
};
const logSchema = z.object({
  kind: z.enum(Object.keys(LOG_DATA)),
  at: z.string().datetime({ offset: true }).or(z.string().datetime()),
  endAt: z.union([z.string().datetime({ offset: true }), z.string().datetime(), z.null()]).optional(),
  data: z.record(z.string(), z.unknown()),
  clientRequestId: z.string().regex(/^[\w-]{6,64}$/).optional(),
});

function parseLog(body) {
  const input = logSchema.parse(body || {});
  return { ...input, data: LOG_DATA[input.kind].parse(input.data) };
}

function atProblem(req, at) {
  const ms = Date.parse(at);
  if (!Number.isFinite(ms) || ms > Date.now() + 10 * 60000) return t(req, 'დრო მომავალში ვერ იქნება.', 'The time can’t be in the future.');
  return null;
}

familyRouter.get('/members/:memberId/logs', handle(async (req, res) => {
  const member = await memberOr404(req, res);
  if (!member) return;
  const { todayStartMs, nowMs } = clock(req);
  const days = Math.min(Math.max(Number(req.query.days) || 7, 1), 90);
  const kinds = typeof req.query.kinds === 'string' ? req.query.kinds.split(',').filter((k) => LOG_DATA[k]) : null;
  const logs = await store.listLogs(member.id, { from: new Date(nowMs - days * 86400000), kinds });
  res.json({ logs: logs.map(store.publicLog), sick: sickDayView(logs, nowMs), feedingToday: feedingToday(logs, todayStartMs) });
}));

familyRouter.post('/members/:memberId/logs', handle(async (req, res) => {
  const member = await memberOr404(req, res);
  if (!member) return;
  const input = parseLog(req.body);
  const problem = atProblem(req, input.at);
  if (problem) return res.status(400).json({ error: problem, code: 'INVALID_TIME' });
  if (Date.parse(input.at) < Date.parse(`${toYmd(member.birthDate)}T00:00:00Z`) - 86400000) return fail(res, 400, 'დრო დაბადებამდე ვერ იქნება.', 'The time can’t be before birth.', 'INVALID_TIME');
  const row = await store.createLog(member.id, req.user.id, input);
  res.status(201).json({ log: store.publicLog(row) });
}));

familyRouter.patch('/members/:memberId/logs/:logId', handle(async (req, res) => {
  const member = await memberOr404(req, res);
  if (!member) return;
  const input = parseLog(req.body);
  const problem = atProblem(req, input.at);
  if (problem) return res.status(400).json({ error: problem, code: 'INVALID_TIME' });
  const row = await store.updateLog(member.id, String(req.params.logId), input);
  if (!row) return fail(res, 404, 'ჩანაწერი ვერ მოიძებნა.', 'Entry not found.', 'NOT_FOUND');
  res.json({ log: store.publicLog(row) });
}));

familyRouter.delete('/members/:memberId/logs/:logId', handle(async (req, res) => {
  const member = await memberOr404(req, res);
  if (!member) return;
  await store.deleteLog(member.id, String(req.params.logId));
  res.json({ ok: true });
}));

// ── Health items ─────────────────────────────────────────────────────────────────────────────
const healthSchema = z.object({
  kind: z.enum(['ALLERGY', 'CONDITION', 'MEDICATION']),
  name: text(80).min(1),
  detail: optText(200),
  severity: z.union([z.enum(['MILD', 'MODERATE', 'SEVERE']), z.null()]).optional(),
  active: z.boolean().optional(),
});

familyRouter.get('/members/:memberId/health', handle(async (req, res) => {
  const member = await memberOr404(req, res);
  if (!member) return;
  res.json({ items: (await store.listHealthItems(member.id)).map(store.publicHealthItem) });
}));

familyRouter.post('/members/:memberId/health', handle(async (req, res) => {
  const member = await memberOr404(req, res);
  if (!member) return;
  const row = await store.createHealthItem(member.id, req.user.id, healthSchema.parse(req.body || {}));
  res.status(201).json({ item: store.publicHealthItem(row) });
}));

familyRouter.patch('/members/:memberId/health/:itemId', handle(async (req, res) => {
  const member = await memberOr404(req, res);
  if (!member) return;
  const row = await store.updateHealthItem(member.id, String(req.params.itemId), healthSchema.partial().parse(req.body || {}));
  if (!row) return fail(res, 404, 'ჩანაწერი ვერ მოიძებნა.', 'Entry not found.', 'NOT_FOUND');
  res.json({ item: store.publicHealthItem(row) });
}));

familyRouter.delete('/members/:memberId/health/:itemId', handle(async (req, res) => {
  const member = await memberOr404(req, res);
  if (!member) return;
  await store.deleteHealthItem(member.id, String(req.params.itemId));
  res.json({ ok: true });
}));

// ── Feeding and foods ────────────────────────────────────────────────────────────────────────
familyRouter.get('/members/:memberId/feeding', handle(async (req, res) => {
  const member = await memberOr404(req, res);
  if (!member) return;
  const { today, todayStartMs, nowMs } = clock(req);
  const age = ageInfo(member, today, req.lang);
  const [logs, foods] = await Promise.all([store.listLogs(member.id, { from: new Date(nowMs - 3 * 86400000), kinds: ['FEED', 'DIAPER'] }), store.listFoods(member.id)]);
  res.json({
    age,
    guide: feedingGuide(age.stage, req.lang),
    mode: member.feedingMode || null,
    today: feedingToday(logs, todayStartMs),
    recent: logs.slice(0, 30).map(store.publicLog),
    foods: age.correctedDays >= 120 ? foodList(foods, req.lang) : [],
    showFoods: age.correctedDays >= 120 && age.days < 6 * 365,
    showLog: age.days < 730,
  });
}));

const foodSchema = z.object({ status: z.enum(FOOD_STATUSES), firstOn: z.union([ymd, z.null()]).optional(), note: optText(200) });

familyRouter.put('/members/:memberId/foods/:foodKey', handle(async (req, res) => {
  const member = await memberOr404(req, res);
  if (!member) return;
  if (!isFoodKey(String(req.params.foodKey))) return fail(res, 404, 'ასეთი საკვები სიაში არ არის.', 'No such food on the list.', 'NOT_FOUND');
  const input = foodSchema.parse(req.body || {});
  const problem = dateProblem(req, member, input.firstOn);
  if (problem) return res.status(400).json({ error: problem, code: 'INVALID_DATE' });
  await store.upsertFood(member.id, String(req.params.foodKey), { ...input, firstOn: input.firstOn ?? familyTodayYmd(req) });
  res.json({ foods: foodList(await store.listFoods(member.id), req.lang) });
}));

familyRouter.delete('/members/:memberId/foods/:foodKey', handle(async (req, res) => {
  const member = await memberOr404(req, res);
  if (!member) return;
  await store.deleteFood(member.id, String(req.params.foodKey));
  res.json({ foods: foodList(await store.listFoods(member.id), req.lang) });
}));

// ── Age guide and milestones ─────────────────────────────────────────────────────────────────
familyRouter.get('/members/:memberId/guide', handle(async (req, res) => {
  const member = await memberOr404(req, res);
  if (!member) return;
  const { today } = clock(req);
  const age = ageInfo(member, today, req.lang);
  const marks = await store.listMilestones(member.id);
  const checkpoint = typeof req.query.checkpoint === 'string' ? milestoneCheckpoint(req.query.checkpoint, marks, req.lang) : null;
  res.json({ age, milestones: milestoneGuide(age.correctedDays, marks, req.lang), checkpoint, tips: stageTips(age.stage, req.lang), feeding: feedingGuide(age.stage, req.lang) });
}));

familyRouter.put('/members/:memberId/milestones/:key', handle(async (req, res) => {
  const member = await memberOr404(req, res);
  if (!member) return;
  if (!isMilestoneKey(String(req.params.key))) return fail(res, 404, 'ასეთი ეტაპი არ არსებობს.', 'No such milestone.', 'NOT_FOUND');
  const { status } = z.object({ status: z.enum(['YES', 'NOT_YET']) }).parse(req.body || {});
  await store.upsertMilestone(member.id, String(req.params.key), status, familyTodayYmd(req));
  res.json({ ok: true });
}));

familyRouter.delete('/members/:memberId/milestones/:key', handle(async (req, res) => {
  const member = await memberOr404(req, res);
  if (!member) return;
  await store.deleteMilestone(member.id, String(req.params.key));
  res.json({ ok: true });
}));

// ── Reminder feed (the phone schedules local notifications from it) ─────────────────────────
familyRouter.get('/reminders/feed', handle(async (req, res) => {
  const { today } = clock(req);
  const members = await store.listMembers(req.user.id);
  const rows = [];
  for (const member of members) rows.push({ member, doses: await store.listDoses(member.id) });
  res.json({ today, items: buildReminderFeed(rows, today, req.lang) });
}));

familyRouter.use('/members/:memberId', familyChatRouter);
