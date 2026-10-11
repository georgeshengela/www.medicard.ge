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
/** Where a MEDISLEEP night's times came from — how the app was used, never the times themselves. */
const NIGHT_SOURCES = { mode: 'ძილის რეჟიმით', manual: 'ხელით', health: 'Health-იდან, დილის შეფასებით' };
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
/** Where a row opens in the admin: the exact card, row or conversation (v4/focus.js reads `focus`, `pane`, `tab`…). */
const link = (tab, params = {}) => {
  const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v != null && v !== '')).toString();
  return `#/${tab}${q ? `?${q}` : ''}`;
};
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
    event: (r) => ({ module: 'pets', text: 'დაამატა ცხოველი', meta: [SPECIES[r.speciesId] || 'სხვა', r.name].filter(Boolean).join(' · '), href: link('pets', { focus: r.id }) }) },
  { key: 'petWeight', col: '"createdAt"', sql: (c) => `SELECT id, "userId", "petId", "createdAt" AS at FROM "PetWeightLog" WHERE ${c}`,
    event: (r) => ({ module: 'pets', text: 'აწონა ცხოველი', href: link('pets', { focus: r.petId }) }) },
  { key: 'petPlan', col: '"createdAt"', sql: (c) => `SELECT id, "userId", "petId", "createdAt" AS at, "reminderEnabled" FROM "PetCareSchedule" WHERE ${c}`,
    event: (r) => ({ module: 'pets', text: 'შექმნა ცხოველის მოვლის გეგმა', meta: r.reminderEnabled ? 'შეხსენებით' : '', href: link('pets', { focus: r.petId }) }) },
  { key: 'petCare', col: '"createdAt"', sql: (c) => `SELECT id, "userId", "petId", "createdAt" AS at FROM "PetCareEvent" WHERE status = 'RECORDED' AND ${c}`,
    event: (r) => ({ module: 'pets', text: 'მონიშნა ცხოველის მოვლა', href: link('pets', { focus: r.petId }) }) },
  { key: 'vet', col: '"createdAt"', sql: (c) => `SELECT id, "userId", "petId", "createdAt" AS at FROM "PetChatMessage" WHERE role = 'user' AND ${c}`,
    event: (r) => ({ module: 'pets', text: 'ჰკითხა MEDIVET-ს', href: link('pets', { focus: r.petId }) }) },
  { key: 'medication', col: '"createdAt"', sql: (c) => `SELECT id, "userId", "createdAt" AS at FROM "MedicationSchedule" WHERE ${c}`,
    event: (r) => ({ module: 'pills', text: 'დაამატა წამალი', href: link('pills', { focus: r.userId }) }) },
  { key: 'dose', col: '"occurredAt"', sql: (c) => `SELECT id, "userId", "occurredAt" AS at, source FROM "MedicationDoseEvent" WHERE ${c}`,
    event: (r) => ({ module: 'pills', text: 'მონიშნა დოზა', meta: r.source === 'notification' ? 'შეხსენებიდან' : '', href: link('pills', { focus: r.userId }) }) },
  { key: 'cycle', col: '"createdAt"', anonymous: true,
    sql: (c) => `SELECT id, "createdAt" AS at, flow, symptoms, moods, notes IS NOT NULL AND notes <> '' AS "hasNote", "sexualActivity", libido, bbt,
      "cervicalMucus", "ovulationTest", "pregnancyTest", "painEntries", "sleepQuality", "stressLevel", observations FROM "CycleLog" WHERE ${c}`,
    keep: (r) => !onlyImportedTemperature({ ...r, notes: r.hasNote ? '·' : null }),
    event: () => ({ module: 'cycle', text: 'ვიღაცამ ჩაწერა ციკლის დღე' }) },
  { key: 'meal', col: '"createdAt"', sql: (c) => `SELECT id, "userId", "createdAt" AS at, source FROM "NutritionMeal" WHERE ${c}`,
    event: (r) => ({ module: 'food', text: 'ჩაწერა კვება', meta: MEAL_SOURCES[r.source] || '', href: link('nutrition', { pane: 'usage', focus: r.userId }) }) },
  // MEDISLEEP: that a night was saved — never its times, length, rating or factors. A night that only arrived from
  // Apple Health / Health Connect (no morning check-in) is an import, not something she did: a first sync brings weeks.
  { key: 'sleepNight', col: '"createdAt"', sql: (c) => `SELECT id, "userId", "createdAt" AS at, "timesSource" FROM "SleepNight"
      WHERE ("timesSource" <> 'health' OR "checkedInAt" IS NOT NULL) AND ${c}`,
    event: (r) => ({ module: 'sleep', text: 'ჩაწერა ძილის ღამე', meta: NIGHT_SOURCES[r.timesSource] || '', href: link('sleep', { pane: 'usage', focus: r.userId }) }) },
  { key: 'sleepPlay', col: '"createdAt"', sql: (c) => `SELECT id, "userId", "createdAt" AS at, "sleepMode", cardinality("soundIds") AS layers FROM "SleepPlay" WHERE ${c}`,
    event: (r) => ({
      module: 'sleep',
      text: 'ჩართო ძილის ხმა',
      meta: [r.sleepMode ? 'ძილის რეჟიმში' : '', Number(r.layers) > 1 ? `${Number(r.layers)} ხმა ერთად` : ''].filter(Boolean).join(' · '),
      href: link('sleep', { pane: 'usage', focus: r.userId }),
    }) },
  { key: 'record', col: '"createdAt"', sql: (c) => `SELECT id, "userId", "createdAt" AS at, type FROM "MedicalRecord" WHERE type IN ('LAB','XRAY','CT_MRI','SKIN','SKINCARE','SYMPTOM') AND ${c}`,
    event: (r) => ({
      module: RECORDS[r.type][0],
      text: RECORDS[r.type][1],
      href: RECORDS[r.type][0] === 'lab' ? link('lab', { focus: r.userId }) : link('ai', { pane: 'usage', focus: r.userId }),
    }) },
  { key: 'medi', col: '"createdAt"', sql: (c) => `SELECT id, "userId", "createdAt" AS at, mode, status FROM "AiInteraction" WHERE mode IN ('DOCTOR','CONSILIUM') AND ${c}`,
    // Opens that very question and answer (Medi's log drawer).
    event: (r) => (r.status === 'ERROR'
      ? { module: 'medi', text: 'Medi-მ ვერ უპასუხა', attention: true, href: link('ai', { pane: 'quality', focus: r.id }) }
      : { module: 'medi', text: r.mode === 'CONSILIUM' ? 'ჰკითხა Medi-ს კონსილიუმით' : 'ჰკითხა Medi-ს', href: link('ai', { pane: 'quality', focus: r.id }) }) },
  { key: 'mediAction', col: '"createdAt"', sql: (c) => `SELECT id, "userId", "createdAt" AS at, tool FROM "AssistantOperation" WHERE status = 'DONE' AND ${c}`,
    event: (r) => {
      const hit = ACTIONS.find(([re]) => re.test(String(r.tool || '')));
      // A cycle entry saved through Medi is already the anonymous cycle row: no second event.
      if (hit?.[1] === 'cycle') return null;
      const where = { pills: link('pills', { focus: r.userId }), food: link('nutrition', { pane: 'usage', focus: r.userId }), pets: link('pets') }[hit?.[1]];
      return hit
        ? { module: hit[1], text: hit[2], viaMedi: true, href: where || link('ai', { pane: 'usage', focus: r.userId }) }
        : { module: 'medi', text: 'Medi-თ შეინახა ჩანაწერი', href: link('ai', { pane: 'usage', focus: r.userId }) };
    } },
  { key: 'quest', col: '"completedAt"', sql: (c) => `SELECT id, "userId", "completedAt" AS at FROM "QuestCompletion" WHERE ${c}`,
    event: (r) => ({ module: 'quest', text: 'შეასრულა მისია', href: link('quests', { pane: 'usage', focus: r.userId }) }) },
  { key: 'redeem', col: '"redeemedAt"', sql: (c) => `SELECT id, "userId", "redeemedAt" AS at, "coinCost" FROM "RewardRedemption" WHERE ${c}`,
    event: (r) => ({ module: 'quest', text: 'გაცვალა ჯილდო მაღაზიაში', meta: `${Number(r.coinCost || 0).toLocaleString('ka-GE')} Coins · გადასაცემია`, attention: true, href: link('rewards', { tab: 'redemptions', focus: r.id }) }) },
  { key: 'walk', col: '"endedAt"', sql: (c) => `SELECT id, "userId", "endedAt" AS at, meters FROM "MedipulsiSession" WHERE phase = 'FINISHED' AND excluded = false AND ${c}`,
    event: (r) => ({ module: 'run', text: 'დაასრულა გასეირნება', meta: km(r.meters), href: link('medipulsi', { tab: 'sessions', focus: r.id }) }) },
  // A box opening. Coin boxes are paid on the spot (APPROVED) — nothing to do; a physical prize waits for the team.
  { key: 'claim', col: '"createdAt"', sql: (c) => `SELECT id, "userId", "createdAt" AS at, status, reward->>'kind' AS kind, reward->>'coins' AS coins,
      reward->>'starter' AS starter, reward->>'place' AS place, reward->>'title' AS title FROM "MedipulsiClaim" WHERE ${c}`,
    event: (r) => (r.kind === 'PHYSICAL'
      ? { module: 'run', text: 'მოიგო MEDIRUN-ის პრიზი', meta: [r.title, 'შესამოწმებელი და გადასაცემია'].filter(Boolean).join(' · '), attention: true, href: link('medipulsi', { tab: 'claims', focus: r.id }) }
      : { module: 'run', text: 'გახსნა MEDIRUN-ის ყუთი', meta: [r.starter === 'true' ? 'სასტარტო ყუთი' : r.place, Number(r.coins) ? `${Number(r.coins).toLocaleString('ka-GE')} Medi Coins` : ''].filter(Boolean).join(' · '), href: link('medipulsi', { tab: 'claims', focus: r.id }) }) },
  { key: 'communityJoin', col: '"createdAt"', sql: (c) => `SELECT "userId" AS id, "userId", "createdAt" AS at FROM "CommunityMember" WHERE ${c}`,
    event: () => ({ module: 'community', text: 'შეუერთდა ქალების სივრცეს', href: link('community', { section: 'members' }) }) },
  { key: 'communityPost', col: '"createdAt"', sql: (c) => `SELECT id, "authorId" AS "userId", "createdAt" AS at FROM "CommunityPost" WHERE ${c}`,
    event: (r) => ({ module: 'community', text: 'დაწერა პოსტი ქალების სივრცეში', href: link('community', { section: 'PUBLISHED', focus: r.id }) }) },
  { key: 'communityReport', col: '"createdAt"', sql: (c) => `SELECT id, "userId", "createdAt" AS at FROM "CommunityReport" WHERE ${c}`,
    event: (r) => ({ module: 'community', text: 'გაასაჩივრა ჩანაწერი', attention: true, href: link('community', { section: 'reports', focus: r.id }) }) },
  { key: 'trainer', col: '"submittedAt"', sql: (c) => `SELECT "userId" AS id, "userId", "submittedAt" AS at FROM "TrainerProfile" WHERE ${c}`,
    event: (r) => ({ module: 'coach', text: 'გაგზავნა ტრენერის განაცხადი', attention: true, href: link('trainers', { pane: 'manage', status: 'PENDING', focus: r.userId }) }) },
  { key: 'trainerLink', col: '"createdAt"', sql: (c) => `SELECT id, "clientId" AS "userId", "trainerId", "createdAt" AS at FROM "TrainerLink" WHERE ${c}`,
    event: (r) => ({ module: 'coach', text: 'დაუკავშირდა ტრენერს', href: link('trainers', { pane: 'usage', focus: r.trainerId }) }) },
  { key: 'support', col: '"createdAt"', sql: (c) => `SELECT id, "userId", "createdAt" AS at, "counterpartName" FROM "SupportThread" WHERE ${c}`,
    event: (r) => ({ module: 'support', text: 'მოწერა მხარდაჭერას', attention: true, href: link('support', { tab: 'inbox', thread: r.id }), who: r.userId ? null : r.counterpartName || 'უცნობი გამომგზავნი' }) },
  { key: 'referral', col: '"createdAt"', sql: (c) => `SELECT id, "inviterId" AS "userId", "createdAt" AS at FROM "Referral" WHERE ${c}`,
    event: () => ({ module: 'account', text: 'მოიწვია მეგობარი', href: link('rewards', { tab: 'referrals' }) }) },
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
