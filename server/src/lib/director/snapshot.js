/**
 * What the Director can see: aggregate counts only. No names, emails, phones, free text or health
 * values ever leave through here — the brain runs on an external service (Claude Code cloud).
 * Every section is independent: a missing table or a failing query yields { error } for that
 * section, never a failed snapshot.
 */
import { prisma } from '../prisma.js';
import { listFeatureFlags } from '../featureFlags.js';
import { loadFunnelReport } from '../funnel.js';
import { loadAppActivityRows } from '../appActivity.js';
import { getRetentionAnalytics } from '../adminAnalytics.js';
import { getProviderBalances } from '../providerBalances.js';

const n = (v) => Number(v ?? 0);

async function section(fn) {
  try {
    return await fn();
  } catch (error) {
    return { error: String(error?.message || error).slice(0, 160) };
  }
}

async function users(db) {
  const [r] = await db.$queryRaw`SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE "createdAt" >= NOW() - INTERVAL '1 day')::int AS "new1d",
      COUNT(*) FILTER (WHERE "createdAt" >= NOW() - INTERVAL '7 days')::int AS "new7d",
      COUNT(*) FILTER (WHERE "createdAt" >= NOW() - INTERVAL '30 days')::int AS "new30d",
      COUNT(*) FILTER (WHERE "createdAt" >= NOW() - INTERVAL '14 days' AND "createdAt" < NOW() - INTERVAL '7 days')::int AS "newPrev7d",
      COUNT(*) FILTER (WHERE status = 'BLOCKED')::int AS blocked
    FROM "User"`;
  return r;
}

async function activity(db) {
  const [r] = await db.$queryRaw`SELECT
      COUNT(DISTINCT "userId") FILTER (WHERE "date" >= CURRENT_DATE - 0)::int AS dau,
      COUNT(DISTINCT "userId") FILTER (WHERE "date" >= CURRENT_DATE - 6)::int AS wau,
      COUNT(DISTINCT "userId") FILTER (WHERE "date" >= CURRENT_DATE - 29)::int AS mau,
      COUNT(DISTINCT "userId") FILTER (WHERE "date" BETWEEN CURRENT_DATE - 13 AND CURRENT_DATE - 7)::int AS "wauPrev"
    FROM "AppActivity" WHERE "date" >= CURRENT_DATE - 29`;
  const platforms = await db.$queryRaw`SELECT COALESCE(platform, 'unknown') AS platform, COUNT(DISTINCT "userId")::int AS users
    FROM "AppActivity" WHERE "date" >= CURRENT_DATE - 6 GROUP BY 1 ORDER BY 2 DESC`;
  return { ...r, platforms7d: platforms };
}

async function ai(db) {
  const [r] = await db.$queryRaw`SELECT
      COUNT(*) FILTER (WHERE "createdAt" >= NOW() - INTERVAL '1 day')::int AS "calls1d",
      COUNT(*) FILTER (WHERE "createdAt" >= NOW() - INTERVAL '7 days')::int AS "calls7d",
      COUNT(*) FILTER (WHERE "createdAt" >= NOW() - INTERVAL '1 day' AND status = 'ERROR')::int AS "errors1d"
    FROM "AiInteraction" WHERE "createdAt" >= NOW() - INTERVAL '7 days'`;
  return r;
}

async function email(db) {
  const rows = await db.$queryRaw`SELECT status, COUNT(*)::int AS n FROM "EmailLog"
    WHERE "createdAt" >= NOW() - INTERVAL '7 days' GROUP BY status`;
  return { last7dByStatus: Object.fromEntries(rows.map((r) => [r.status, n(r.n)])) };
}

async function support(db) {
  const rows = await db.$queryRaw`SELECT status, COUNT(*)::int AS n, COUNT(*) FILTER (WHERE unread)::int AS unread
    FROM "SupportThread" GROUP BY status`;
  return Object.fromEntries(rows.map((r) => [r.status, { threads: n(r.n), unread: n(r.unread) }]));
}

/** Funnel for the last 7 days, trimmed to totals (the report itself holds only counts and enums). */
async function funnel(db) {
  const report = await loadFunnelReport({ days: 7 }, {
    db,
    loadActivity: (from, to) => loadAppActivityRows(from, to),
    loadRetention: () => getRetentionAnalytics({ range: '90d' }),
  });
  return {
    days: 7,
    steps: (report.steps || []).map((s) => ({ key: s.key, count: s.count })),
    retention: report.retention || null,
  };
}

async function balances() {
  const b = await getProviderBalances();
  // Balances only; drop any raw provider payloads.
  return JSON.parse(JSON.stringify(b, (k, v) => (k === 'raw' ? undefined : v)));
}

async function features(db) {
  const list = await listFeatureFlags(db);
  return list.map((f) => ({ key: f.key, enabled: f.enabled }));
}

export async function buildDirectorSnapshot({ db = prisma, now = new Date() } = {}) {
  const [u, act, a, em, sup, fun, bal, feat] = await Promise.all([
    section(() => users(db)),
    section(() => activity(db)),
    section(() => ai(db)),
    section(() => email(db)),
    section(() => support(db)),
    section(() => funnel(db)),
    section(() => balances()),
    section(() => features(db)),
  ]);
  return { generatedAt: now.toISOString(), users: u, activity: act, ai: a, email: em, support: sup, funnel: fun, providerBalances: bal, features: feat };
}
