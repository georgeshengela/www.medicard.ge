/**
 * Admin live feed (owner 2026-10-11: „ვიღაცამ დაამატა ცხოველი, ვიღაცამ დაამატა წამალი … რეალ თაიმში“): what happens in
 * the app, module by module, for the header bell's „აქტივობა“ sheet. One source per kind of row; every source reads
 * only ids, the person, a time and a small enum — never health values, names of medicines, meal titles, chat or
 * letter text. MEDICYCLE stays anonymous (no person, hashed row id), as on its usage page.
 *
 * The feed is read straight from the module tables (no extra writes in the module routes, works with raw-SQL tables
 * and with several server instances). Realtime: `createFeedPoller` runs while an admin is connected
 * (adminRealtime.js) and emits only rows it has not sent yet.
 */
import { createHash } from 'node:crypto';
import { prisma } from './prisma.js';
import { isTeamEmail, ownerContact } from './adminUsageKit.js';
import { onlyImportedTemperature } from './cycleTemperature.js';

export const FEED_LIMIT_MAX = 100;
const SPECIES = { dog: 'ძაღლი', cat: 'კატა', bird: 'ფრინველი', rabbit: 'კურდღელი', rodent: 'მღრღნელი', fish: 'თევზი', reptile: 'ქვეწარმავალი', horse: 'ცხენი', other: 'სხვა' };
const MEAL_SOURCES = { photo: 'ფოტოთი', text: 'აღწერით', voice: 'ხმით', search: 'ძებნით', saved: 'შენახულიდან', manual: 'ხელით', barcode: 'შტრიხკოდით', label: 'ეტიკეტით', plan: 'რაციონიდან' };
const RECORDS = {
  LAB: ['lab', 'ატვირთა ანალიზი'],
  XRAY: ['lab', 'წააკითხა გამოსახულება'],
  CT_MRI: ['lab', 'წააკითხა გამოსახულება'],
  SKIN: ['lab', 'შეამოწმა კანის ფოტო'],
  SKINCARE: ['lab', 'შეადგენინა კანის მოვლა'],
  SYMPTOM: ['medi', 'შეამოწმა სიმპტომები'],
};
/** Medi's saved actions (AssistantOperation.tool) → module + words. Cycle ones stay anonymous. */
const ACTIONS = [
  [/^hydration_/, 'health', 'Medi-თ ჩაწერა წყალი'],
  [/^(medication_|dose_record$)/, 'pills', 'Medi-თ ჩაწერა წამალი'],
  [/^(period_record|cycle_record|cycle_settings|pregnancy_record)$/, 'cycle', 'Medi-თ ჩაიწერა ციკლი'],
  [/^(nutrition_|weight_goal$)/, 'food', 'Medi-თ ჩაწერა კვება'],
  [/^(metric_record|steps_goal)$/, 'health', 'Medi-თ ჩაწერა მაჩვენებელი'],
  [/^visit_/, 'health', 'Medi-თ დაამატა ვიზიტი'],
  [/^pet_/, 'pets', 'Medi-თ ჩაწერა ცხოველზე'],
];
const km = (meters) => `${(Number(meters || 0) / 1000).toLocaleString('ka-GE', { maximumFractionDigits: 1 })} კმ`;
const shortHash = (value) => createHash('sha1').update(String(value)).digest('hex').slice(0, 12);

/**
 * Sources: `sql(cond)` selects rows with an `at` column (the condition on `col` is filled in), `event(row)` maps one
 * row. `attention` marks rows somebody in the team should act on (a letter, a report, a prize to hand over…).
 */
const SOURCES = [
  { key: 'signup', col: '"createdAt"', sql: (c) => `SELECT id, id AS "userId", "createdAt" AS at, email FROM "User" WHERE ${c}`,
    event: (r) => ({ module: 'account', text: 'დარეგისტრირდა', meta: /@phone\.medicard\.ge$/i.test(r.email) ? 'ტელეფონით' : /@apple\.medicard\.ge$|privaterelay\.appleid\.com$/i.test(r.email) ? 'Apple-ით' : 'ელფოსტით' }) },
  { key: 'pet', col: '"createdAt"', sql: (c) => `SELECT id, "userId", "createdAt" AS at, name, "speciesId" FROM "Pet" WHERE ${c}`,
    event: (r) => ({ module: 'pets', text: 'დაამატა ცხოველი', meta: [SPECIES[r.speciesId] || 'სხვა', r.name].filter(Boolean).join(' · ') }) },
  { key: 'petWeight', col: '"createdAt"', sql: (c) => `SELECT id, "userId", "createdAt" AS at FROM "PetWeightLog" WHERE ${c}`,
    event: () => ({ module: 'pets', text: 'აწონა ცხოველი' }) },
  { key: 'petPlan', col: '"createdAt"', sql: (c) => `SELECT id, "userId", "createdAt" AS at, "reminderEnabled" FROM "PetCareSchedule" WHERE ${c}`,
    event: (r) => ({ module: 'pets', text: 'შექმნა ცხოველის მოვლის გეგმა', meta: r.reminderEnabled ? 'შეხსენებით' : '' }) },
  { key: 'petCare', col: '"createdAt"', sql: (c) => `SELECT id, "userId", "createdAt" AS at FROM "PetCareEvent" WHERE status = 'RECORDED' AND ${c}`,
    event: () => ({ module: 'pets', text: 'მონიშნა ცხოველის მოვლა' }) },
  { key: 'vet', col: '"createdAt"', sql: (c) => `SELECT id, "userId", "createdAt" AS at FROM "PetChatMessage" WHERE role = 'user' AND ${c}`,
    event: () => ({ module: 'pets', text: 'ჰკითხა MEDIVET-ს' }) },
  { key: 'medication', col: '"createdAt"', sql: (c) => `SELECT id, "userId", "createdAt" AS at FROM "MedicationSchedule" WHERE ${c}`,
    event: () => ({ module: 'pills', text: 'დაამატა წამალი' }) },
  { key: 'dose', col: '"occurredAt"', sql: (c) => `SELECT id, "userId", "occurredAt" AS at, source FROM "MedicationDoseEvent" WHERE ${c}`,
    event: (r) => ({ module: 'pills', text: 'მონიშნა დოზა', meta: r.source === 'notification' ? 'შეხსენებიდან' : '' }) },
  { key: 'cycle', col: '"createdAt"', anonymous: true,
    sql: (c) => `SELECT id, "createdAt" AS at, flow, symptoms, moods, notes IS NOT NULL AND notes <> '' AS "hasNote", "sexualActivity", libido, bbt,
      "cervicalMucus", "ovulationTest", "pregnancyTest", "painEntries", "sleepQuality", "stressLevel", observations FROM "CycleLog" WHERE ${c}`,
    keep: (r) => !onlyImportedTemperature({ ...r, notes: r.hasNote ? '·' : null }),
    event: () => ({ module: 'cycle', text: 'ვიღაცამ ჩაწერა ციკლის დღე' }) },
  { key: 'meal', col: '"createdAt"', sql: (c) => `SELECT id, "userId", "createdAt" AS at, source FROM "NutritionMeal" WHERE ${c}`,
    event: (r) => ({ module: 'food', text: 'ჩაწერა კვება', meta: MEAL_SOURCES[r.source] || '' }) },
  { key: 'record', col: '"createdAt"', sql: (c) => `SELECT id, "userId", "createdAt" AS at, type FROM "MedicalRecord" WHERE type IN ('LAB','XRAY','CT_MRI','SKIN','SKINCARE','SYMPTOM') AND ${c}`,
    event: (r) => ({ module: RECORDS[r.type][0], text: RECORDS[r.type][1] }) },
  { key: 'medi', col: '"createdAt"', sql: (c) => `SELECT id, "userId", "createdAt" AS at, mode, status FROM "AiInteraction" WHERE mode IN ('DOCTOR','CONSILIUM') AND ${c}`,
    event: (r) => (r.status === 'ERROR'
      ? { module: 'medi', text: 'Medi-მ ვერ უპასუხა', attention: true }
      : { module: 'medi', text: r.mode === 'CONSILIUM' ? 'ჰკითხა Medi-ს კონსილიუმით' : 'ჰკითხა Medi-ს' }) },
  { key: 'mediAction', col: '"createdAt"', sql: (c) => `SELECT id, "userId", "createdAt" AS at, tool FROM "AssistantOperation" WHERE status = 'DONE' AND ${c}`,
    event: (r) => {
      const hit = ACTIONS.find(([re]) => re.test(String(r.tool || '')));
      // A cycle entry saved through Medi is already the anonymous cycle row: no second event.
      if (hit?.[1] === 'cycle') return null;
      return hit ? { module: hit[1], text: hit[2], viaMedi: true } : { module: 'medi', text: 'Medi-თ შეინახა ჩანაწერი' };
    } },
  { key: 'quest', col: '"completedAt"', sql: (c) => `SELECT id, "userId", "completedAt" AS at FROM "QuestCompletion" WHERE ${c}`,
    event: () => ({ module: 'quest', text: 'შეასრულა მისია' }) },
  { key: 'redeem', col: '"redeemedAt"', sql: (c) => `SELECT id, "userId", "redeemedAt" AS at, "coinCost" FROM "RewardRedemption" WHERE ${c}`,
    event: (r) => ({ module: 'quest', text: 'გაცვალა ჯილდო', meta: `${Number(r.coinCost || 0).toLocaleString('ka-GE')} Coins`, attention: true, href: '#/rewards' }) },
  { key: 'walk', col: '"endedAt"', sql: (c) => `SELECT id, "userId", "endedAt" AS at, meters FROM "MedipulsiSession" WHERE phase = 'FINISHED' AND excluded = false AND ${c}`,
    event: (r) => ({ module: 'run', text: 'დაასრულა გასეირნება', meta: km(r.meters) }) },
  { key: 'claim', col: '"createdAt"', sql: (c) => `SELECT id, "userId", "createdAt" AS at FROM "MedipulsiClaim" WHERE ${c}`,
    event: () => ({ module: 'run', text: 'მოითხოვა MEDIRUN-ის პრიზი', attention: true, href: '#/medipulsi' }) },
  { key: 'communityJoin', col: '"createdAt"', sql: (c) => `SELECT "userId" AS id, "userId", "createdAt" AS at FROM "CommunityMember" WHERE ${c}`,
    event: () => ({ module: 'community', text: 'შეუერთდა ქალების სივრცეს' }) },
  { key: 'communityPost', col: '"createdAt"', sql: (c) => `SELECT id, "authorId" AS "userId", "createdAt" AS at FROM "CommunityPost" WHERE ${c}`,
    event: () => ({ module: 'community', text: 'დაწერა პოსტი ქალების სივრცეში', href: '#/community' }) },
  { key: 'communityReport', col: '"createdAt"', sql: (c) => `SELECT id, "userId", "createdAt" AS at FROM "CommunityReport" WHERE ${c}`,
    event: () => ({ module: 'community', text: 'გაასაჩივრა ჩანაწერი', attention: true, href: '#/community' }) },
  { key: 'trainer', col: '"submittedAt"', sql: (c) => `SELECT "userId" AS id, "userId", "submittedAt" AS at FROM "TrainerProfile" WHERE ${c}`,
    event: () => ({ module: 'coach', text: 'გაგზავნა ტრენერის განაცხადი', attention: true, href: '#/trainers' }) },
  { key: 'trainerLink', col: '"createdAt"', sql: (c) => `SELECT id, "clientId" AS "userId", "createdAt" AS at FROM "TrainerLink" WHERE ${c}`,
    event: () => ({ module: 'coach', text: 'დაუკავშირდა ტრენერს' }) },
  { key: 'support', col: '"createdAt"', sql: (c) => `SELECT id, "userId", "createdAt" AS at, "counterpartName" FROM "SupportThread" WHERE ${c}`,
    event: (r) => ({ module: 'support', text: 'მოწერა მხარდაჭერას', attention: true, href: '#/support', who: r.userId ? null : r.counterpartName || 'უცნობი გამომგზავნი' }) },
  { key: 'referral', col: '"createdAt"', sql: (c) => `SELECT id, "inviterId" AS "userId", "createdAt" AS at FROM "Referral" WHERE ${c}`,
    event: () => ({ module: 'account', text: 'მოიწვია მეგობარი' }) },
];
export const FEED_SOURCES = Object.freeze(SOURCES.map((s) => s.key));

const missing = (error) => /does not exist|42P01|42703/.test(String(error?.message || error?.meta?.message || ''));

/**
 * Pure: rows from the sources + people → events, newest first. `rows` = [{ source, row }].
 * @returns {{ id, at, module, text, meta, user: {id,name,contact,team}|null, who, href, attention }[]}
 */
export function shapeFeed(rows, people, { teamIds = new Set() } = {}) {
  const byId = new Map((people || []).map((u) => [u.id, u]));
  const out = [];
  for (const { source, row } of rows) {
    const def = SOURCES.find((s) => s.key === source);
    if (!def || !row?.at) continue;
    if (def.keep && !def.keep(row)) continue;
    const ev = def.event(row);
    if (!ev) continue;
    const anonymous = Boolean(def.anonymous);
    const u = anonymous ? null : byId.get(row.userId);
    out.push({
      // Cycle rows are not traceable back to a person: the row id is hashed, the person never sent.
      id: `${source}:${anonymous ? shortHash(row.id) : row.id}`,
      at: new Date(row.at).toISOString(),
      module: ev.module,
      text: ev.text,
      meta: ev.meta || '',
      user: u ? { id: u.id, name: u.fullName || '', contact: ownerContact(u), team: teamIds.has(u.id) || isTeamEmail(u.email) } : null,
      who: anonymous ? null : ev.who || null,
      href: ev.href || (u ? `#/users/${encodeURIComponent(u.id)}` : ev.module === 'cycle' ? '#/cycle' : ''),
      attention: Boolean(ev.attention),
      viaMedi: Boolean(ev.viaMedi),
    });
  }
  // Saved through Medi and also a row of its module (a medicine, a meal…): one event, marked „Medi-თ“.
  const shown = out.filter((e) => {
    if (!e.viaMedi || !e.user) return true;
    const twin = out.find((o) => !o.viaMedi && o.module === e.module && o.user?.id === e.user.id && Math.abs(new Date(o.at) - new Date(e.at)) <= 120_000);
    if (!twin) return true;
    if (!twin.meta.includes('Medi-თ')) twin.meta = [twin.meta, 'Medi-თ'].filter(Boolean).join(' · ');
    return false;
  });
  return shown
    .map(({ viaMedi, ...e }) => e)
    .sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : a.id < b.id ? 1 : -1));
}

/**
 * Newest events across every source. `after` (exclusive) for the live poll, `before` (exclusive) for „მეტი“.
 * Read-only; a table that does not exist yet (fresh database) is skipped.
 */
export async function loadFeed({ after = null, before = null, limit = 60, db = prisma } = {}) {
  const take = Math.max(1, Math.min(FEED_LIMIT_MAX, Number(limit) || 60));
  /** The time condition on one source's column, with its positional parameters. */
  const timeWhere = (col) => {
    const parts = [`${col} IS NOT NULL`];
    const args = [];
    if (after) { args.push(new Date(after)); parts.push(`${col} > $${args.length}`); }
    if (before) { args.push(new Date(before)); parts.push(`${col} < $${args.length}`); }
    return { cond: parts.join(' AND '), args };
  };
  const results = await Promise.all(SOURCES.map(async (s) => {
    const { cond, args } = timeWhere(s.col);
    try {
      const rows = await db.$queryRawUnsafe(`${s.sql(cond)} ORDER BY ${s.col} DESC LIMIT ${take}`, ...args);
      return rows.map((row) => ({ source: s.key, row }));
    } catch (error) {
      if (missing(error)) return [];
      throw error;
    }
  }));
  const rows = results.flat().sort((a, b) => new Date(b.row.at) - new Date(a.row.at)).slice(0, take * 2);
  const ids = [...new Set(rows.map((r) => r.row.userId).filter(Boolean))];
  const people = ids.length
    ? await db.user.findMany({ where: { id: { in: ids } }, select: { id: true, fullName: true, email: true, phone: true } })
    : [];
  return shapeFeed(rows, people).slice(0, take);
}

/**
 * Live: call `poll()` every few seconds while an admin watches. The first poll only sets the cursor (no flood of
 * old rows); later polls look back OVERLAP_MS past the cursor (a slow transaction commits rows with an earlier
 * createdAt) and emit only events not sent before.
 */
export const OVERLAP_MS = 60_000;
export function createFeedPoller({ load = loadFeed, emit, now = () => Date.now() } = {}) {
  let cursor = null;
  let running = false;
  const sent = new Map();
  return {
    async poll() {
      if (running) return [];
      running = true;
      try {
        const t = now();
        if (cursor == null) {
          cursor = t;
          return [];
        }
        const events = await load({ after: new Date(cursor - OVERLAP_MS), limit: FEED_LIMIT_MAX });
        const fresh = events.filter((e) => !sent.has(e.id));
        for (const e of fresh) sent.set(e.id, t);
        for (const [id, at] of sent) if (t - at > OVERLAP_MS * 5) sent.delete(id);
        cursor = t;
        if (fresh.length) emit?.(fresh);
        return fresh;
      } finally {
        running = false;
      }
    },
    reset() {
      cursor = null;
      sent.clear();
    },
  };
}
