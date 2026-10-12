/**
 * Support inbox numbers for admin #/support — GET /api/admin/support/stats?days=7|30|90.
 * Counts and times only, never message text. buildSupportStats is pure (tests in ../support.test.js);
 * loadSupportStats reads the rows. Days are Tbilisi calendar days (UTC+4, no DST).
 */
import { prisma } from '../prisma.js';

const DAY = 86400000;
const TBILISI = 4 * 3600000;
export const SUPPORT_STATS_DAYS = Object.freeze([7, 30, 90]);
/** Topics the Director's triage gives each inbound mail (supportAgent.js TRIAGE_SYSTEM). */
export const SUPPORT_TOPICS = Object.freeze(['help', 'account', 'data_request', 'medical', 'billing', 'complaint', 'business', 'spam', 'other']);

export const tbilisiDay = (at) => new Date(new Date(at).getTime() + TBILISI).toISOString().slice(0, 10);
/** UTC instant of 00:00 Tbilisi on the first of `days` calendar days ending today. */
export const statsSince = (days, now = new Date()) => new Date(Date.parse(`${tbilisiDay(now.getTime() - (days - 1) * DAY)}T00:00:00Z`) - TBILISI);

const median = (list) => {
  if (!list.length) return null;
  const s = [...list].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

/**
 * messages:  [{ threadId, direction: 'inbound'|'outbound', createdAt, authorAdminId }] in the period
 * started:   ids of threads created in the period (first-reply time is measured on these)
 * open:      [{ status, lastInboundAt, createdAt }] for every thread that is not closed
 * triage:    [{ status, category }] Director triage rows of the period
 * drafts:    pending Director reply drafts
 */
export function buildSupportStats({ days, now = new Date(), messages = [], started = [], open = [], triage = [], drafts = 0 }) {
  const keys = Array.from({ length: days }, (_, i) => tbilisiDay(now.getTime() - (days - 1 - i) * DAY));
  const byDay = new Map(keys.map((day) => [day, { day, inbound: 0, replies: 0 }]));
  let inbound = 0;
  let repliesTeam = 0;
  let repliesDirector = 0;
  const perThread = new Map();
  for (const m of messages) {
    const row = byDay.get(tbilisiDay(m.createdAt));
    if (m.direction === 'inbound') {
      if (row) { row.inbound += 1; inbound += 1; }
    } else if (m.direction === 'outbound') {
      if (row) {
        row.replies += 1;
        if (m.authorAdminId) repliesTeam += 1; else repliesDirector += 1;
      }
    } else continue;
    const list = perThread.get(m.threadId) || [];
    list.push({ direction: m.direction, at: new Date(m.createdAt).getTime() });
    perThread.set(m.threadId, list);
  }

  // First reply: threads that began with someone writing to us in the period, until our first answer.
  const waits = [];
  let unanswered = 0;
  for (const id of started) {
    const list = (perThread.get(id) || []).sort((a, b) => a.at - b.at);
    if (!list.length || list[0].direction !== 'inbound') continue; // letters we started
    const reply = list.find((x) => x.direction === 'outbound');
    if (reply) waits.push((reply.at - list[0].at) / 3600000);
    else unanswered += 1;
  }

  const todo = open.filter((t) => t.status === 'new' || t.status === 'open');
  const oldest = todo.map((t) => new Date(t.lastInboundAt || t.createdAt).getTime()).filter(Number.isFinite);

  const outcome = { answered: 0, escalated: 0, deferred: 0, spam: 0, human: 0 };
  const topics = Object.fromEntries(SUPPORT_TOPICS.map((k) => [k, 0]));
  for (const r of triage) {
    if (r.status in outcome) outcome[r.status] += 1;
    if (r.category) topics[SUPPORT_TOPICS.includes(r.category) ? r.category : 'other'] += 1;
  }

  const firstReply = median(waits);
  return {
    days,
    inbound,
    replies: repliesTeam + repliesDirector,
    repliesTeam,
    repliesDirector,
    threads: started.length,
    firstReplyMedianH: firstReply == null ? null : Math.round(firstReply * 10) / 10,
    firstReplyCount: waits.length,
    unanswered,
    byDay: keys.map((k) => byDay.get(k)),
    now: {
      todo: todo.length,
      waiting: open.filter((t) => t.status === 'waiting').length,
      oldestTodoAt: oldest.length ? new Date(Math.min(...oldest)).toISOString() : null,
      drafts,
    },
    director: outcome,
    topics: Object.entries(topics).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]).map(([key, count]) => ({ key, count })),
  };
}

/** Pending Director reply drafts per support thread, newest first ({} when the Director was never set up). */
export async function pendingDrafts(db = prisma) {
  try {
    const rows = await db.$queryRaw`SELECT "id", "title", "body", "payload", "createdAt" FROM "DirectorProposal"
      WHERE "status" = 'pending' AND "payload"->>'action' = 'support_reply' ORDER BY "createdAt" DESC LIMIT 200`;
    const out = {};
    for (const r of rows) {
      const threadId = r.payload?.threadId;
      if (threadId && !out[threadId]) out[threadId] = r;
    }
    return out;
  } catch {
    return {};
  }
}

/** Latest Director triage per thread: topic and what the Director did ({} before the first triage). */
export async function threadTriage(threadIds, db = prisma) {
  if (!threadIds.length) return {};
  try {
    const rows = await db.$queryRaw`SELECT DISTINCT ON ("threadId") "threadId", "status", "category"
      FROM "DirectorSupportTriage" WHERE "threadId" = ANY(${threadIds}) ORDER BY "threadId", "createdAt" DESC`;
    return Object.fromEntries(rows.map((r) => [r.threadId, { status: r.status, category: r.category }]));
  } catch {
    return {};
  }
}

export async function loadSupportStats(days, { db = prisma, now = new Date() } = {}) {
  const since = statsSince(days, now);
  const [messages, started, open, triage, drafts] = await Promise.all([
    db.supportMessage.findMany({
      where: { createdAt: { gte: since }, direction: { in: ['inbound', 'outbound'] } },
      select: { threadId: true, direction: true, createdAt: true, authorAdminId: true },
      orderBy: { createdAt: 'asc' },
      take: 20000,
    }),
    db.supportThread.findMany({ where: { createdAt: { gte: since } }, select: { id: true }, take: 5000 }),
    db.supportThread.findMany({ where: { status: { not: 'closed' } }, select: { status: true, lastInboundAt: true, createdAt: true }, take: 5000 }),
    db.$queryRaw`SELECT "status", "category" FROM "DirectorSupportTriage" WHERE "createdAt" >= ${since}`.catch(() => []),
    pendingDrafts(db),
  ]);
  return buildSupportStats({ days, now, messages, started: started.map((t) => t.id), open, triage, drafts: Object.keys(drafts).length });
}
