/**
 * Admin #/ai „გამოყენება“ (Medi) — who uses Medi and how.
 *
 * The #/ai page already shows Medi's quality (errors, latency, eval scans, the request log). This page is about
 * the people: AI consent → first message → a clinical answer → consilium / symptom check → an action saved through
 * Medi → back on another day, one card per person, the period trend, what the chats are about (topic counts only).
 *
 * Sources: ChatSession (one Medi thread = mode ASSISTANT; DOCTOR / CONSILIUM sessions that a thread links to are the
 * same answers again, so only unlinked ones count as separate consultations), AiInteraction (DOCTOR, CONSILIUM,
 * SYMPTOM_CHECKER, MEDICATION — the durable log, kept when a conversation is deleted), AssistantOperation (actions
 * Medi saved after the person's tap), AiFeedback, UserAiConsent + AiConsentEvent. Voice turns are stored as plain
 * text (the transcript), so voice use cannot be told apart on the server.
 *
 * Privacy: the response carries the person's name and contact (as on the user page) and counts — never message text,
 * answers, symptoms or what was saved. Question text is read on the server only to count keyword topics; answers
 * only to count the 112 opener; symptom checks only for their urgency level.
 */
import { prisma } from './prisma.js';
import { addDaysYmd, rateSafe, tbilisiMidnight, tbilisiYmd } from './adminAnalyticsRange.js';
import {
  activityTracker, bump, daySeries, flagState, loadPeople, loadTeamUserIds, median, missingTable, ms, personSummary,
  usageWindow, USAGE_PERIODS, zeroes,
} from './adminUsageKit.js';
import { CURRENT_AI_CONSENT_VERSION } from './aiConsent.js';
import { listFeatureFlags } from './featureFlags.js';

/** The page lists at most this many people (newest activity first); every count still covers all of them. */
export const MEDI_USAGE_LIST_MAX = 400;
/** Topics are read from at most this many recent health questions; safety flags from this many recent answers. */
export const MEDI_TOPIC_SAMPLE = 2000;
export const MEDI_SAFETY_SAMPLE = 2000;

/** AiInteraction modes that belong to Medi itself. */
export const MEDI_AI_MODES = Object.freeze(['DOCTOR', 'CONSILIUM', 'SYMPTOM_CHECKER', 'MEDICATION']);
/** AI used inside other modules (their own usage pages) → page key. */
export const OTHER_AI_MODULES = Object.freeze({
  CYCLE_WELLNESS: 'cycle',
  LAB: 'lab', LAB_ALIGN: 'lab', IMAGING: 'lab', SKIN: 'lab', SKINCARE: 'lab',
  WEIGHT_ADVICE: 'food',
  VET: 'vet',
});
const CHAT_MODES = ['ASSISTANT', 'DOCTOR', 'CONSILIUM'];

/** Actions Medi saved (AssistantOperation.tool) → group shown on the page. */
const ACTION_GROUPS = [
  ['hydration', /^hydration_/],
  ['medication', /^(medication_|dose_record$)/],
  ['cycle', /^(period_record|cycle_record|cycle_settings|pregnancy_record)$/],
  ['nutrition', /^(nutrition_|weight_goal$)/],
  ['metrics', /^(metric_record|steps_goal)$/],
  ['visits', /^visit_/],
  ['profile', /^profile_update$/],
  ['pets', /^pet_/],
];
export const MEDI_ACTION_GROUPS = Object.freeze([...ACTION_GROUPS.map(([key]) => key), 'other']);
export const actionGroup = (tool) => ACTION_GROUPS.find(([, re]) => re.test(String(tool || '')))?.[0] || 'other';

/** Health-question topics — keyword buckets (Georgian + English). One question may hit several; none = „other“. */
const TOPICS = [
  ['pain', /ტკივ|ტკენ|სტკივ|pain|ache|hurt/i],
  ['heart', /წნევ|გულის ცემ|გულის რიტმ|გულისცემ|გულ-სისხლ|გულმკერდ|პულს|ქოლესტერ|ჰიპერტენზ|blood pressure|heart|pulse|cholesterol|hypertens|chest/i],
  ['digestion', /კუჭ|ნაწლავ|ფაღარათ|დიარე|ღებინ|გულისრევ|გული მერევ|ყაბზ|განავალ|მუცელ|ბუასილ|ბოყინ|stomach|gut\b|diarr|vomit|nause|constipat|bowel|bloat|reflux|heartburn|abdom/i],
  ['respiratory', /სიცხ|ტემპერატურ|ხველ|სურდო|გაციებ|გრიპ|ყელ|ცხვირ|ვირუს|ანგინ|ბრონქ|ფილტვ|fever|temperature|cough|cold\b|flu\b|throat|virus|covid|bronch|lung/i],
  ['skin', /კანი|კანზე|კანის|კანს|გამონაყარ|ქავილ|ქავის|აკნე|მუწუკ|ხალი|ხალის|ეგზემ|ფსორიაზ|თმის ცვენ|skin|rash|itch|acne|mole\b|eczema|psoria/i],
  ['mind', /ძილ|უძილ|მეძინ|სტრეს|შფოთ|ნერვ|დეპრეს|პანიკ|განწყობ|დაღლილ|ფსიქ|sleep|insomn|stress|anxi|depress|panic|mood|tired|fatigue|mental/i],
  ['medication', /წამალ|წამლ|ტაბლეტ|ანტიბიოტიკ|დოზ|მედიკამენტ|ვიტამინ|კაფსულ|სიროფ|medic|pill|tablet|antibiotic|dose|vitamin|drug|ibuprofen|paracetamol/i],
  ['labs', /ანალიზ|ჰემოგლობინ|გლუკოზ|შაქარ|ფერიტინ|ჰორმონ|ქოლესტერინ|\btsh\b|lab\b|test result|blood test|glucose|hemoglobin|ferritin|hormone/i],
  ['women', /ციკლ|მენსტრუაც|მენსტრუალ|ორსულ|ოვულაც|საშვილოსნო|საკვერცხ|მენოპაუზ|სარძევე|ძუძუ|კონტრაცეპ|გინეკოლოგ|ვაგინ|menstru|period\b|pregnan|ovulat|uter|ovar|menopaus|breast|contracept|gyn/i],
  ['child', /ბავშვ|შვილ|ჩვილ|ახალშობილ|child|kid\b|kids\b|baby|infant|toddler/i],
  ['weight', /წონ|კალორ|დიეტ|კვებ|საკვებ|ჭამ|ცილ|ნახშირწყ|შიმშილ|weight|calor|diet|food|eat\b|eating|protein|carb|fasting/i],
  // Asked like a question but really a request to the app (log water, remind me) — answered by the clinical model.
  ['app', /ჩამიწერ|ჩაწერ|დამიმატ|შემახსენ|შეხსენებ|ჭიქა|წყალი|წყლის|ნაბიჯ|\blog\b|remind|glass of water|steps/i],
];
export const MEDI_TOPIC_KEYS = Object.freeze([...TOPICS.map(([key]) => key), 'other']);

export function mediTopics(text) {
  const body = String(text || '');
  const hits = TOPICS.filter(([, re]) => re.test(body)).map(([key]) => key);
  return hits.length ? hits : ['other'];
}

const URGENCY = ['emergency', 'urgent', 'routine'];

/**
 * What the code itself flags in an answer (the raw text never leaves the server):
 * DOCTOR / CONSILIUM — the safety rule makes a life-threatening case open with „⚠️ სასწრაფოდ დაუკავშირდით 112-ს“
 * (`emergency`); `mentions112` = 112 named anywhere (usually „if it gets worse“). SYMPTOM_CHECKER — its urgency level.
 */
export function answerSafety(mode, text) {
  const body = String(text || '');
  if (mode === 'SYMPTOM_CHECKER') {
    let urgency = null;
    try {
      const parsed = JSON.parse(body);
      const u = (parsed?.result ?? parsed)?.urgency;
      urgency = URGENCY.includes(u) ? u : null;
    } catch { /* unreadable result: no level */ }
    return { emergency: urgency === 'emergency', mentions112: false, urgency };
  }
  const head = body.trimStart().slice(0, 200);
  const emergency = /^⚠/.test(head) || /სასწრაფოდ დაუკავშირდ|დაუყოვნებლივ დაუკავშირდ|დარეკე 112|დარეკეთ 112|call 112|call emergency/i.test(head);
  return { emergency, mentions112: /(^|\D)112(\D|$)/.test(body), urgency: null };
}

const validAt = (value, fallback) => {
  const t = ms(value);
  return Number.isFinite(t) && t > 0 ? new Date(t) : fallback ? new Date(ms(fallback)) : null;
};

function consentState(row) {
  if (!row) return 'none';
  if (row.version !== CURRENT_AI_CONSENT_VERSION) return 'old';
  if (row.decision === 'accepted') return 'accepted';
  if (row.decision === 'revoked') return 'revoked';
  return 'declined';
}

/**
 * Pure: raw rows (all accounts) → the page payload. `raw` comes from loadMediUsageRaw (or a test fixture).
 * @param {object} raw
 * @param {{ days?: number, includeTeam?: boolean, now?: Date }} opts
 */
export function buildMediUsage(raw, { days = 30, includeTeam = false, now = new Date() } = {}) {
  const win = usageWindow(days, now);
  const teamIds = new Set(raw.teamUserIds || []);
  const keep = (row) => includeTeam || !teamIds.has(row.userId);
  const people = new Map((raw.people || []).map((u) => [u.id, u]));

  // ── conversations and turns ──────────────────────────────────────────────
  const sessions = (raw.sessions || []).filter((s) => keep(s) && CHAT_MODES.includes(s.mode));
  const sessionById = new Map(sessions.map((s) => [s.id, s]));
  const turnsBySession = new Map();
  for (const t of raw.turns || []) {
    const s = sessionById.get(t.sessionId);
    if (!s) continue;
    if (!turnsBySession.has(s.id)) turnsBySession.set(s.id, []);
    turnsBySession.get(s.id).push(t);
  }
  // A thread's clinical answer also lives in its own DOCTOR / CONSILIUM session: those are not separate chats.
  // (Only thread turns carry `linkedSessionId`; the linked session belongs to the same person.)
  const linked = new Set((raw.turns || []).map((t) => t.linked).filter(Boolean));

  const person = new Map();
  const P = (userId) => {
    if (!person.has(userId)) {
      person.set(userId, {
        userId, threads: 0, consultations: 0, messages: 0, health: 0, requests: 0, clinical: 0, consilium: 0, symptoms: 0,
        medication: 0, failed: 0, actions: 0, feedback: 0, firstAt: 0, lastAt: 0, lastMessageAt: 0,
      });
    }
    return person.get(userId);
  };
  const track = activityTracker();
  const act = (userId, at) => {
    const t = ms(at);
    if (!userId || !t) return;
    const p = P(userId);
    p.firstAt = p.firstAt ? Math.min(p.firstAt, t) : t;
    p.lastAt = Math.max(p.lastAt, t);
    track.act(userId, new Date(t));
  };

  const messages = []; // { userId, at, health }
  const conv = { threads: 0, threadsAnswered: 0, threadsDeep: 0, consultations: 0, consilium: 0, empty: 0 };
  for (const s of sessions) {
    const isThread = s.mode === 'ASSISTANT';
    if (!isThread && linked.has(s.id)) continue;
    const turns = (turnsBySession.get(s.id) || []).slice().sort((a, b) => a.ord - b.ord);
    const userTurns = turns.filter((t) => t.role === 'user');
    if (!userTurns.length) { conv.empty += 1; continue; }
    const p = P(s.userId);
    if (isThread) {
      conv.threads += 1;
      p.threads += 1;
      if (turns.some((t) => t.kind === 'answer' || t.kind === 'deep')) conv.threadsAnswered += 1;
      if (turns.some((t) => t.kind === 'deep')) conv.threadsDeep += 1;
    } else {
      conv[s.mode === 'CONSILIUM' ? 'consilium' : 'consultations'] += 1;
      p.consultations += 1;
    }
    turns.forEach((t, i) => {
      if (t.role !== 'user') return;
      const at = validAt(t.at, s.createdAt);
      // In a thread a health question is the turn the clinical model answered right after it; the rest are requests
      // to the planner (log, add, open, how-to). A standalone consultation is all health questions.
      const next = turns[i + 1];
      const health = !isThread || Boolean(next && next.role === 'assistant' && (next.kind === 'answer' || next.kind === 'deep'));
      messages.push({ userId: s.userId, at, health });
      p.messages += 1;
      if (health) p.health += 1; else p.requests += 1;
      p.lastMessageAt = Math.max(p.lastMessageAt, ms(at));
      act(s.userId, at);
    });
  }

  // ── AI answers (durable log) ─────────────────────────────────────────────
  const aiRows = (raw.ai || []).filter((r) => keep(r) && MEDI_AI_MODES.includes(r.mode));
  const answers = { DOCTOR: 0, CONSILIUM: 0, SYMPTOM_CHECKER: 0, MEDICATION: 0 };
  const failedByMode = { DOCTOR: 0, CONSILIUM: 0, SYMPTOM_CHECKER: 0, MEDICATION: 0 };
  const answerUsers = { DOCTOR: new Set(), CONSILIUM: new Set(), SYMPTOM_CHECKER: new Set(), MEDICATION: new Set() };
  for (const r of aiRows) {
    const p = P(r.userId);
    act(r.userId, r.createdAt);
    if (r.status === 'OK') {
      answers[r.mode] += 1;
      answerUsers[r.mode].add(r.userId);
      if (r.mode === 'DOCTOR') p.clinical += 1;
      else if (r.mode === 'CONSILIUM') p.consilium += 1;
      else if (r.mode === 'SYMPTOM_CHECKER') p.symptoms += 1;
      else p.medication += 1;
    } else {
      failedByMode[r.mode] += 1;
      p.failed += 1;
    }
  }
  const ok = aiRows.filter((r) => r.status === 'OK');
  const clinicalRows = ok.filter((r) => r.mode === 'DOCTOR' || r.mode === 'CONSILIUM');

  // ── actions saved through Medi ───────────────────────────────────────────
  const ops = (raw.operations || []).filter(keep);
  const actionGroups = zeroes(MEDI_ACTION_GROUPS);
  const actionStatus = { DONE: 0, REJECTED: 0, UNCERTAIN: 0, RUNNING: 0 };
  const actionUsers = new Set();
  for (const o of ops) {
    bump(actionStatus, actionStatus[o.status] == null ? 'UNCERTAIN' : o.status);
    act(o.userId, o.createdAt);
    if (o.status !== 'DONE') continue;
    P(o.userId).actions += 1;
    actionUsers.add(o.userId);
    bump(actionGroups, actionGroup(o.tool));
  }

  // ── feedback ──────────────────────────────────────────────────────────────
  const feedback = (raw.feedback || []).filter((f) => keep(f) && MEDI_AI_MODES.includes(f.mode));
  for (const f of feedback) if (person.has(f.userId)) P(f.userId).feedback += 1;

  // ── people ────────────────────────────────────────────────────────────────
  const users = [...person.values()].filter((p) => p.firstAt);
  const userIds = new Set(users.map((p) => p.userId));
  const count = (fn) => users.filter(fn).length;
  const dayCount = (p) => track.days(p.userId);

  // ── consent ───────────────────────────────────────────────────────────────
  const accounts = Math.max(0, (raw.accountsTotal || 0) - (includeTeam ? 0 : teamIds.size));
  const consentRows = (raw.consents || []).filter(keep);
  const consentBy = new Map(consentRows.map((c) => [c.userId, c]));
  const consent = { accepted: 0, declined: 0, revoked: 0, old: 0, none: 0 };
  for (const c of consentRows) bump(consent, consentState(c));
  consent.none = Math.max(0, accounts - consentRows.length);
  const consentEvents = (raw.consentEvents || []).filter(keep).slice().sort((a, b) => ms(a.createdAt) - ms(b.createdAt));
  const eventsBy = new Map();
  for (const e of consentEvents) {
    if (!eventsBy.has(e.userId)) eventsBy.set(e.userId, []);
    eventsBy.get(e.userId).push(e.decision);
  }
  let declinedThenAccepted = 0;
  let declinedTwice = 0;
  for (const list of eventsBy.values()) {
    const firstDecline = list.indexOf('declined');
    if (firstDecline >= 0 && list.slice(firstDecline + 1).includes('accepted')) declinedThenAccepted += 1;
    if (list.filter((d) => d === 'declined').length > 1) declinedTwice += 1;
  }
  const consentAccepted = consentRows.filter((c) => consentState(c) === 'accepted');
  const acceptedIds = new Set(consentAccepted.map((c) => c.userId));
  const consentOf = (userId) => consentState(consentBy.get(userId));

  const ladder = [
    { key: 'consent', count: acceptedIds.size },
    { key: 'used', count: users.length },
    { key: 'answered', count: count((p) => p.clinical + p.consilium > 0) },
    { key: 'deep', count: count((p) => p.consilium > 0 || p.symptoms > 0) },
    { key: 'saved', count: count((p) => p.actions > 0) },
    { key: 'returned', count: count((p) => dayCount(p) >= 2) },
  ].map((step, _i, all) => ({ ...step, rate: rateSafe(step.count, all[0].count) }));

  // ── how much each person writes ─────────────────────────────────────────
  const perPerson = { none: 0, one: 0, few: 0, some: 0, many: 0 };
  for (const p of users) {
    const n = p.messages;
    bump(perPerson, n === 0 ? 'none' : n === 1 ? 'one' : n <= 3 ? 'few' : n <= 9 ? 'some' : 'many');
  }
  const writers = users.filter((p) => p.messages > 0).map((p) => p.messages);
  const dayCounts = users.map(dayCount);

  // ── first use after sign-up ───────────────────────────────────────────────
  const firstUse = { sameDay: 0, week: 0, later: 0 };
  const hoursToFirst = [];
  for (const p of users) {
    const u = people.get(p.userId);
    if (!u?.createdAt) continue;
    const hours = Math.max(0, (p.firstAt - ms(u.createdAt)) / 3_600_000);
    hoursToFirst.push(hours);
    if (hours < 24) firstUse.sameDay += 1;
    else if (hours < 24 * 7) firstUse.week += 1;
    else firstUse.later += 1;
  }

  // ── topics and safety (counts only) ──────────────────────────────────────
  const topicSample = (raw.questionTexts || []).filter(keep);
  const topics = zeroes(MEDI_TOPIC_KEYS);
  for (const q of topicSample) for (const t of mediTopics(q.content)) bump(topics, t);
  const safetyRows = (raw.safety || []).filter(keep);
  const safety = {
    sample: safetyRows.filter((r) => r.mode === 'DOCTOR' || r.mode === 'CONSILIUM').length,
    emergency: safetyRows.filter((r) => r.mode !== 'SYMPTOM_CHECKER' && r.emergency).length,
    mentions112: safetyRows.filter((r) => r.mode !== 'SYMPTOM_CHECKER' && r.mentions112).length,
    symptomChecks: safetyRows.filter((r) => r.mode === 'SYMPTOM_CHECKER').length,
    urgency: zeroes(URGENCY),
  };
  for (const r of safetyRows) if (r.mode === 'SYMPTOM_CHECKER' && r.urgency) bump(safety.urgency, r.urgency);

  // ── other modules' AI (their own pages) ───────────────────────────────────
  const others = { cycle: { count: 0, users: new Set() }, lab: { count: 0, users: new Set() }, food: { count: 0, users: new Set() }, vet: { count: 0, users: new Set() } };
  for (const r of (raw.otherAi || []).filter(keep)) {
    const key = OTHER_AI_MODULES[r.mode];
    if (!key) continue;
    others[key].count += r.count || 0;
    others[key].users.add(r.userId);
  }

  // ── period ────────────────────────────────────────────────────────────────
  const inP = (at) => win.inPeriod(at);
  const periodMessages = messages.filter((m) => inP(m.at));
  const periodClinical = clinicalRows.filter((r) => inP(r.createdAt));
  const signups = (raw.signups || []).filter((u) => (includeTeam || !teamIds.has(u.id)) && inP(u.createdAt));
  const signupsUsed = signups.filter((u) => userIds.has(u.id));

  // ── people list ───────────────────────────────────────────────────────────
  const items = users
    .map((p) => {
      const u = people.get(p.userId) || { id: p.userId };
      return {
        id: p.userId,
        person: personSummary(u, { teamIds }),
        consent: consentOf(p.userId),
        usage: {
          conversations: p.threads + p.consultations,
          messages: p.messages,
          health: p.health,
          requests: p.requests,
          clinical: p.clinical,
          consilium: p.consilium,
          symptoms: p.symptoms,
          medication: p.medication,
          actions: p.actions,
          feedback: p.feedback,
          failed: p.failed,
        },
        days: dayCount(p),
        firstAt: new Date(p.firstAt).toISOString(),
        lastAt: new Date(p.lastAt).toISOString(),
        lastMessageAt: p.lastMessageAt ? new Date(p.lastMessageAt).toISOString() : null,
      };
    })
    .sort((a, b) => ms(b.lastAt) - ms(a.lastAt));

  const teamOnly = (rows) => (rows || []).filter((r) => teamIds.has(r.userId));
  const teamSessions = teamOnly(raw.sessions);
  return {
    installed: true,
    generatedAt: now.toISOString(),
    includeTeam,
    team: {
      accounts: teamIds.size,
      users: new Set([...teamSessions, ...teamOnly(raw.ai).filter((r) => MEDI_AI_MODES.includes(r.mode))].map((r) => r.userId)).size,
      conversations: teamSessions.filter((s) => CHAT_MODES.includes(s.mode) && (s.mode === 'ASSISTANT' || !linked.has(s.id))).length,
      answers: teamOnly(raw.ai).filter((r) => MEDI_AI_MODES.includes(r.mode)).length,
    },
    flags: {
      medi: flagState(raw.flags, 'medi'),
      mediDoctor: flagState(raw.flags, 'mediDoctor'),
      mediDeep: flagState(raw.flags, 'mediDeep'),
      symptoms: flagState(raw.flags, 'symptoms'),
      voice: flagState(raw.flags, 'voice'),
    },
    totals: {
      accounts,
      users: users.length,
      userRate: rateSafe(users.length, accounts),
      conversations: conv.threads + conv.consultations + conv.consilium,
      messages: messages.length,
      healthQuestions: messages.filter((m) => m.health).length,
      requests: messages.filter((m) => !m.health).length,
      clinical: answers.DOCTOR,
      consilium: answers.CONSILIUM,
      symptomChecks: answers.SYMPTOM_CHECKER,
      medicationReviews: answers.MEDICATION,
      clinicalUsers: new Set(clinicalRows.map((r) => r.userId)).size,
      failed: Object.values(failedByMode).reduce((a, b) => a + b, 0),
      oneDay: count((p) => dayCount(p) <= 1),
      returned: count((p) => dayCount(p) >= 2),
      actions: actionStatus.DONE,
      actionUsers: actionUsers.size,
      lastAt: users.length ? new Date(Math.max(...users.map((p) => p.lastAt))).toISOString() : null,
    },
    ladder,
    consent: {
      ...consent,
      version: CURRENT_AI_CONSENT_VERSION,
      acceptedRate: rateSafe(consent.accepted, accounts),
      declinedThenAccepted,
      declinedTwice,
      acceptedNotUsed: [...acceptedIds].filter((id) => !userIds.has(id)).length,
      usersWithoutConsent: users.filter((p) => consentOf(p.userId) !== 'accepted').length,
    },
    usage: {
      conversations: conv,
      perPerson,
      medianMessages: median(writers),
      medianDays: median(dayCounts),
      maxDays: dayCounts.length ? Math.max(...dayCounts) : 0,
      firstUse: { ...firstUse, medianHours: median(hoursToFirst) },
      answers,
      answerUsers: Object.fromEntries(Object.entries(answerUsers).map(([k, set]) => [k, set.size])),
      failed: failedByMode,
      actions: { status: actionStatus, groups: actionGroups, users: actionUsers.size },
    },
    feedback: {
      up: feedback.filter((f) => f.rating > 0).length,
      down: feedback.filter((f) => f.rating < 0).length,
      withComment: feedback.filter((f) => f.hasComment).length,
      users: new Set(feedback.map((f) => f.userId)).size,
      byMode: Object.fromEntries(MEDI_AI_MODES.map((m) => [m, {
        up: feedback.filter((f) => f.mode === m && f.rating > 0).length,
        down: feedback.filter((f) => f.mode === m && f.rating < 0).length,
      }])),
    },
    topics: MEDI_TOPIC_KEYS.map((key) => ({ key, count: topics[key] })).filter((t) => t.count > 0).sort((a, b) => b.count - a.count),
    topicSample: topicSample.length,
    safety,
    voice: { traceable: false },
    otherModules: Object.fromEntries(Object.entries(others).map(([k, v]) => [k, { count: v.count, users: v.users.size }])),
    period: {
      days: win.days,
      from: win.from,
      to: win.to,
      activeUsers: track.activeIn(win.from, win.to),
      newUsers: users.filter((p) => inP(new Date(p.firstAt))).length,
      messages: periodMessages.length,
      messageUsers: new Set(periodMessages.map((m) => m.userId)).size,
      healthQuestions: periodMessages.filter((m) => m.health).length,
      clinical: periodClinical.length,
      clinicalUsers: new Set(periodClinical.map((r) => r.userId)).size,
      consilium: periodClinical.filter((r) => r.mode === 'CONSILIUM').length,
      symptomChecks: ok.filter((r) => r.mode === 'SYMPTOM_CHECKER' && inP(r.createdAt)).length,
      actions: ops.filter((o) => o.status === 'DONE' && inP(o.createdAt)).length,
      signups: signups.length,
      signupsUsed: signupsUsed.length,
      signupRate: rateSafe(signupsUsed.length, signups.length),
      trend: {
        active: track.activeByDay(win.dayKeys),
        messages: daySeries(win.dayKeys, messages, (m) => m.at),
        answers: daySeries(win.dayKeys, clinicalRows),
      },
    },
    items: items.slice(0, MEDI_USAGE_LIST_MAX),
    itemsTotal: items.length,
  };
}

const MEDI_CHAT_MODES_SQL = CHAT_MODES;

/** Every row the page needs, for all accounts (the builder drops team accounts). Read-only. */
export async function loadMediUsageRaw(db = prisma, { now = new Date() } = {}) {
  const since = tbilisiMidnight(addDaysYmd(tbilisiYmd(now), -(Math.max(...USAGE_PERIODS) - 1)));
  const [teamUserIds, accountsTotal, sessions, turns, questionTexts, ai, safetyRaw, operations, feedback, consents, consentEvents, otherAi, signups, flags] = await Promise.all([
    loadTeamUserIds(db),
    db.user.count(),
    db.chatSession.findMany({ where: { mode: { in: CHAT_MODES } }, select: { id: true, userId: true, mode: true, createdAt: true } }),
    // Turn metadata only — role, kind, link, time. The text stays in the database.
    db.$queryRaw`
      SELECT s.id AS "sessionId", s."userId" AS "userId", e.ord::int AS ord, e.m->>'role' AS role, e.m->>'kind' AS kind,
             e.m->>'linkedSessionId' AS linked, e.m->>'timestamp' AS at
      FROM "ChatSession" s
      CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(s.messages::jsonb) = 'array' THEN s.messages::jsonb ELSE '[]'::jsonb END) WITH ORDINALITY AS e(m, ord)
      WHERE s.mode = ANY(${MEDI_CHAT_MODES_SQL})`,
    // Recent health questions, for topic counts only: thread turns the clinical model answered next, and turns of
    // consultations no thread links to (a linked consultation repeats the thread's question).
    db.$queryRaw`
      WITH t AS (
        SELECT s.id AS sid, s."userId" AS "userId", s.mode, e.ord, e.m->>'role' AS role, e.m->>'content' AS content,
               e.m->>'timestamp' AS at, lead(e.m->>'kind') OVER (PARTITION BY s.id ORDER BY e.ord) AS next_kind
        FROM "ChatSession" s
        CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(s.messages::jsonb) = 'array' THEN s.messages::jsonb ELSE '[]'::jsonb END) WITH ORDINALITY AS e(m, ord)
        WHERE s.mode = ANY(${MEDI_CHAT_MODES_SQL})
      ), linked AS (
        SELECT DISTINCT e.m->>'linkedSessionId' AS id
        FROM "ChatSession" s
        CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(s.messages::jsonb) = 'array' THEN s.messages::jsonb ELSE '[]'::jsonb END) AS e(m)
        WHERE s.mode = 'ASSISTANT' AND e.m->>'linkedSessionId' IS NOT NULL
      )
      SELECT "userId", content FROM t
      WHERE role = 'user' AND (
        (mode = 'ASSISTANT' AND next_kind IN ('answer', 'deep'))
        OR (mode <> 'ASSISTANT' AND sid NOT IN (SELECT id FROM linked WHERE id IS NOT NULL))
      )
      ORDER BY at DESC NULLS LAST
      LIMIT ${MEDI_TOPIC_SAMPLE}`,
    db.aiInteraction.findMany({ where: { mode: { in: [...MEDI_AI_MODES] } }, select: { userId: true, mode: true, status: true, createdAt: true } }),
    db.aiInteraction.findMany({
      where: { mode: { in: ['DOCTOR', 'CONSILIUM', 'SYMPTOM_CHECKER'] }, status: 'OK' },
      orderBy: { createdAt: 'desc' },
      take: MEDI_SAFETY_SAMPLE,
      select: { userId: true, mode: true, assistantReply: true },
    }),
    db.assistantOperation.findMany({ select: { userId: true, tool: true, status: true, createdAt: true } }),
    db.aiFeedback.findMany({ where: { interaction: { mode: { in: [...MEDI_AI_MODES] } } }, select: { userId: true, rating: true, comment: true, interaction: { select: { mode: true } } } }),
    db.userAiConsent.findMany({ select: { userId: true, version: true, decision: true, updatedAt: true } }),
    db.aiConsentEvent.findMany({ select: { userId: true, decision: true, createdAt: true } }),
    db.aiInteraction.groupBy({ by: ['userId', 'mode'], where: { mode: { in: Object.keys(OTHER_AI_MODULES) } }, _count: { _all: true } }),
    db.user.findMany({ where: { createdAt: { gte: since } }, select: { id: true, createdAt: true } }),
    listFeatureFlags(db).catch(() => []),
  ]);
  const ids = new Set([
    ...turns.filter((t) => t.role === 'user').map((t) => t.userId),
    ...ai.map((r) => r.userId),
    ...operations.map((o) => o.userId),
  ]);
  const { people } = await loadPeople([...ids], db);
  return {
    teamUserIds,
    accountsTotal,
    sessions,
    turns: turns.map((t) => ({ sessionId: t.sessionId, userId: t.userId, ord: Number(t.ord), role: t.role, kind: t.kind || null, linked: t.linked || null, at: t.at || null })),
    questionTexts,
    ai,
    // The answers are reduced to flags here; their text is never kept in the payload.
    safety: safetyRaw.map((r) => ({ userId: r.userId, mode: r.mode, ...answerSafety(r.mode, r.assistantReply) })),
    operations,
    feedback: feedback.map((f) => ({ userId: f.userId, rating: f.rating, mode: f.interaction?.mode || null, hasComment: Boolean(f.comment) })),
    consents,
    consentEvents,
    otherAi: otherAi.map((r) => ({ userId: r.userId, mode: r.mode, count: r._count?._all || 0 })),
    signups,
    people,
    flags,
  };
}

export async function loadMediUsage({ days = 30, includeTeam = false, db = prisma, now = new Date() } = {}) {
  try {
    const raw = await loadMediUsageRaw(db, { now });
    return buildMediUsage(raw, { days, includeTeam, now });
  } catch (error) {
    if (missingTable(error)) return { installed: false, generatedAt: now.toISOString() };
    throw error;
  }
}
