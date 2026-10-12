/**
 * Admin #/family (MEDIFAMILY) — how parents use the module, in numbers only.
 *
 * Children's data is the most sensitive data in the app, so this page is stricter than #/pets: no child
 * names, no birth dates (age bands only), no parent contacts, no diagnoses, allergy names, notes, chat text
 * or measurements — only counts, rates and distributions. Team accounts (exact @medicard.ge) are left out
 * unless `includeTeam`. The one public-health number the owner asked for: how many children are on time
 * with the Georgian calendar, and which vaccines are most often late.
 */
import { prisma } from '../prisma.js';
import { addDaysYmd, createdAtToTbilisiYmd, enumerateYmds, rateSafe, tbilisiYmd } from '../adminAnalyticsRange.js';
import { loadTeamUserIds, missingTable, USAGE_PERIODS, flagState } from '../adminUsageKit.js';
import { listFeatureFlags } from '../featureFlags.js';
import { ageInfo, vaccineView } from './view.js';
import { GE_CALENDAR_SOURCE, GE_DOSES, GE_STAGES, GE_VACCINES } from './vaccinesGe.js';

export const FAMILY_ADMIN_PERIODS = USAGE_PERIODS;
const AGE_BANDS = ['newborn', 'infant_0_6', 'infant_6_12', 'toddler', 'preschool', 'school', 'teen'];
const LOG_KINDS = ['FEED', 'TEMP', 'SYMPTOM', 'MED', 'DIAPER', 'NOTE'];
const LEVELS = ['EMERGENCY_NOW', 'SEE_DOCTOR_TODAY', 'SEE_DOCTOR_24H', 'ROUTINE', 'HOME_CARE', 'INFO'];

export async function loadFamilyAdminRaw(db = prisma) {
  const [teamUserIds, members, doses, measurements, logs, health, foods, milestones, sessions, questions, answers, ai, flags] = await Promise.all([
    loadTeamUserIds(db),
    db.$queryRaw`SELECT id, "ownerId", "birthDate", sex, "gestationWeeks", "feedingMode", "createdAt", "archivedAt" FROM "FamilyMember"`,
    db.$queryRaw`SELECT "memberId", code, dose, status, "givenOn", "createdAt" FROM "FamilyVaccineDose"`,
    db.$queryRaw`SELECT "memberId", "createdAt" FROM "FamilyMeasurement"`,
    db.$queryRaw`SELECT "memberId", kind, "createdAt" FROM "FamilyLog"`,
    db.$queryRaw`SELECT "memberId", kind, "createdAt" FROM "FamilyHealthItem"`,
    db.$queryRaw`SELECT "memberId", "foodKey", status FROM "FamilyFoodIntro"`,
    db.$queryRaw`SELECT "memberId", status FROM "FamilyMilestone"`,
    db.$queryRaw`SELECT "memberId", "userId", "createdAt" FROM "FamilyChatSession"`,
    db.$queryRaw`SELECT "memberId", "userId", "createdAt" FROM "FamilyChatMessage" WHERE role = 'user'`,
    db.$queryRaw`SELECT "memberId", status, triage, "createdAt" FROM "FamilyChatMessage" WHERE role = 'assistant'`,
    db.aiInteraction.findMany({ where: { mode: 'PEDIATRIC' }, select: { userId: true, status: true, latencyMs: true, createdAt: true } }),
    listFeatureFlags(db).catch(() => []),
  ]);
  return { teamUserIds, members, doses, measurements, logs, health, foods, milestones, sessions, questions, answers, ai, flags };
}

/** Pure: builds the page from raw rows (tests feed fixtures). */
export function buildFamilyOverview(raw, { days = 30, includeTeam = false, now = new Date() } = {}) {
  const today = tbilisiYmd(now);
  const from = addDaysYmd(today, -(days - 1));
  const dayKeys = enumerateYmds(from, today);
  const team = new Set(raw.teamUserIds || []);
  const members = raw.members.filter((m) => !m.archivedAt && (includeTeam || !team.has(m.ownerId)));
  const ids = new Set(members.map((m) => m.id));
  const mine = (rows) => rows.filter((r) => ids.has(r.memberId));
  const doses = mine(raw.doses);
  const measurements = mine(raw.measurements);
  const logs = mine(raw.logs);
  const questions = mine(raw.questions);
  const answers = mine(raw.answers);
  const inPeriod = (row) => { const d = createdAtToTbilisiYmd(row.createdAt); return d >= from && d <= today; };

  const parents = new Set(members.map((m) => m.ownerId));
  const byMember = (rows) => rows.reduce((map, r) => map.set(r.memberId, [...(map.get(r.memberId) || []), r]), new Map());
  const dosesBy = byMember(doses);

  // Ladder: added → vaccine marked → measured → day log → asked Medi.
  const has = (rows) => new Set(rows.map((r) => r.memberId));
  const withDose = has(doses);
  const withMeasure = has(measurements);
  const withLog = has(logs);
  const withMedi = has(questions);
  const ladder = [
    { key: 'added', count: members.length },
    { key: 'vaccines', count: members.filter((m) => withDose.has(m.id)).length },
    { key: 'growth', count: members.filter((m) => withMeasure.has(m.id)).length },
    { key: 'log', count: members.filter((m) => withLog.has(m.id)).length },
    { key: 'medi', count: members.filter((m) => withMedi.has(m.id)).length },
  ].map((step) => ({ ...step, rate: rateSafe(step.count, members.length) }));

  // Ages, sex, preterm — bands only.
  const ageBands = Object.fromEntries(AGE_BANDS.map((b) => [b, 0]));
  const sex = { FEMALE: 0, MALE: 0 };
  let preterm = 0;
  // Vaccine timeliness on the Georgian calendar, for children whose parent marked at least one dose (the
  // others may simply not have filled the card in).
  let tracked = 0;
  let upToDate = 0;
  const overdueBy = Object.fromEntries(GE_VACCINES.map((v) => [v.code, 0]));
  for (const m of members) {
    const age = ageInfo(m, today, 'ka');
    ageBands[age.stage] = (ageBands[age.stage] || 0) + 1;
    if (sex[m.sex] != null) sex[m.sex] += 1;
    if (age.preterm) preterm += 1;
    const rows = dosesBy.get(m.id) || [];
    if (!rows.length) continue;
    tracked += 1;
    const view = vaccineView(m, rows, today, 'ka');
    const overdue = view.items.filter((i) => i.status === 'overdue');
    if (!overdue.length) upToDate += 1;
    for (const item of overdue) overdueBy[item.code] += 1;
  }

  const logKinds = Object.fromEntries(LOG_KINDS.map((k) => [k, logs.filter((l) => l.kind === k && inPeriod(l)).length]));
  const levels = Object.fromEntries(LEVELS.map((l) => [l, answers.filter((a) => a.triage === l && inPeriod(a)).length]));
  const aiRows = (raw.ai || []).filter((r) => (includeTeam || !team.has(r.userId)) && inPeriod(r));
  const latencies = aiRows.map((r) => r.latencyMs).filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  const series = (rows) => dayKeys.map((day) => ({ day, count: rows.filter((r) => createdAtToTbilisiYmd(r.createdAt) === day).length }));
  const trend = { children: series(members), doses: series(doses), measurements: series(measurements), questions: series(questions) };
  const foods = mine(raw.foods);
  const allergenKeys = new Set(['peanut', 'egg', 'milk', 'wheat', 'treenut', 'sesame', 'fish', 'soy', 'shellfish']);

  return {
    installed: true,
    generatedAt: now.toISOString(),
    days,
    includeTeam,
    totals: {
      parents: parents.size,
      children: members.length,
      newChildren: members.filter(inPeriod).length,
      childrenPerParent: parents.size ? Math.round((members.length / parents.size) * 10) / 10 : 0,
      dosesMarked: doses.length,
      dosesInPeriod: doses.filter(inPeriod).length,
      measurements: measurements.length,
      measurementsInPeriod: measurements.filter(inPeriod).length,
      questionsInPeriod: questions.filter(inPeriod).length,
      askedParents: new Set(questions.filter(inPeriod).map((q) => q.userId)).size,
    },
    ladder,
    ageBands,
    sex,
    preterm,
    vaccines: {
      tracked,
      upToDate,
      upToDateRate: rateSafe(upToDate, tracked),
      overdueBy: GE_VACCINES.map((v) => ({ code: v.code, abbr: v.abbr.ka, count: overdueBy[v.code] })).filter((r) => r.count).sort((a, b) => b.count - a.count),
      extras: doses.filter((d) => String(d.code).startsWith('x:')).length,
    },
    logKinds,
    foods: { marks: foods.length, allergenMarks: foods.filter((f) => allergenKeys.has(f.foodKey) && f.status !== 'AVOID').length, reactions: foods.filter((f) => f.status === 'REACTION').length },
    milestones: { marks: mine(raw.milestones).length, notYet: mine(raw.milestones).filter((m) => m.status === 'NOT_YET').length },
    health: { items: mine(raw.health).length },
    medi: {
      questions: questions.filter(inPeriod).length,
      sessions: mine(raw.sessions).filter(inPeriod).length,
      levels,
      errors: aiRows.filter((r) => r.status === 'ERROR').length,
      answered: aiRows.filter((r) => r.status === 'OK').length,
      latencyP50: latencies.length ? latencies[Math.floor(latencies.length / 2)] : null,
    },
    trend,
    period: { days, from, to: today },
    calendar: {
      source: GE_CALENDAR_SOURCE,
      stages: GE_STAGES.map((s) => ({ key: s.key, label: s.label.ka, doses: GE_DOSES.filter((d) => d.stage === s.key && !d.conditional).map((d) => `${GE_VACCINES.find((v) => v.code === d.code).abbr.ka}${GE_DOSES.filter((x) => x.code === d.code && !x.conditional).length > 1 ? ` ${d.dose}` : ''}`) })),
    },
    flags: { family: flagState(raw.flags, 'family'), familyMedi: flagState(raw.flags, 'familyMedi') },
  };
}

export async function loadFamilyOverview({ days = 30, includeTeam = false, db = prisma, now = new Date() } = {}) {
  try {
    return buildFamilyOverview(await loadFamilyAdminRaw(db), { days, includeTeam, now });
  } catch (error) {
    if (missingTable(error)) return { installed: false, generatedAt: now.toISOString() };
    throw error;
  }
}
