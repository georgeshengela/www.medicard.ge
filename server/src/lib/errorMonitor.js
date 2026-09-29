/**
 * Self-hosted error monitoring (2026-09-29, instead of Sentry).
 *
 * Two inputs, one table ("ErrorEvent", prisma/20260929-errors.sql):
 *  - the app reports crashes / JS errors / render errors to POST /api/app/client-error;
 *  - the server records every unhandled 500 (middleware/error.js) and fatal process errors (server.js).
 * Everything is scrubbed before it is stored: message ≤ 300, stack ≤ 15 frames reduced to
 * `function (file:line)`, emails / phone-like digit runs / tokens / ids removed, routes templated.
 * No request bodies, query strings, health data or raw user ids — a user is a 16-hex sha256 hash.
 *
 * Cheap and bounded per instance: the same fingerprint writes at most one row per 10 s — repeats in
 * between are folded into the next row's "count" (a repeat with no later row is dropped) — and at most
 * 500 rows per minute are written in total (the rest are dropped). Alerts go to Director Telegram:
 * a fingerprint not seen in the previous 7 days (≤ 1 per fingerprint per 6 h, ≤ 10 per hour overall)
 * and a spike (> 50 events in 10 min for one fingerprint, ≤ 1 per fingerprint per 2 h). Throttles are
 * in memory per instance, so with several instances a notice can rarely go out twice.
 * Rows older than 30 days are purged daily under the `error-events-purge` lease. Admin page: #/errors.
 */
import { createHash, randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { prisma } from './prisma.js';
import { acquireJobLease } from './jobLease.js';
import { routeTemplate } from './loopGuard.js';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

export const LIMITS = Object.freeze({
  messageChars: 300,
  stackChars: 2000,
  stackFrames: 15,
  eventsPerReport: 10,
  dedupMs: 10_000,
  rowsPerMinute: 500,
  newWindowMs: 7 * 24 * HOUR,
  newRepeatMs: 6 * HOUR,
  newPerHour: 10,
  spikeWindowMs: 10 * MINUTE,
  spikeThreshold: 50,
  spikeRepeatMs: 2 * HOUR,
  retentionDays: 30,
});

export const KINDS = Object.freeze(['crash', 'error', 'unhandled_rejection', 'render']);
const PLATFORMS = new Set(['ios', 'android', 'web']);

// ---------- scrubbing (pure, tested) ----------

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const JWT = /\beyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}/g;
const UUID = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;
const CUID = /\bc[a-z0-9]{20,32}\b/g;
const LONG_TOKEN = /[A-Za-z0-9+/_=-]{32,}/g;
const DIGIT_RUN = /\+?\d[\d\s().-]{5,}\d/g;
const URL_QUERY = /(\b(?:https?|file|exp|medicard):\/\/[^\s?#'"]*)[?#][^\s'"]*/gi;
const ABS_PATH = /(?<![:/\w.])(?:[A-Za-z]:)?(?:[\\/][^\s\\/:'"()]+){2,}[\\/]([^\s\\/:'"()]+)/g;

/** Removes personal data and secrets from free text. */
export function scrubText(value, max = LIMITS.messageChars, { paths = true } = {}) {
  let text = String(value ?? '');
  if (text.length > max * 4) text = text.slice(0, max * 4);
  text = text
    .replace(URL_QUERY, '$1')
    .replace(EMAIL, '[email]')
    .replace(JWT, '[token]')
    .replace(UUID, ':id')
    .replace(CUID, ':id')
    .replace(LONG_TOKEN, (m) => (/\d/.test(m) && /[A-Za-z]/.test(m) ? '[token]' : m))
    .replace(ABS_PATH, (m, base) => (paths ? base : m))
    .replace(DIGIT_RUN, (m) => ((m.match(/\d/g) || []).length >= 7 ? '[num]' : m))
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/** `/a/b/c.js?x#y` or `C:\a\b.js` or `address at /data/…/index.android.bundle` → basename. */
function basename(file) {
  const bare = String(file || '').replace(/^address at\s+/, '').split(/[?#]/)[0];
  const parts = bare.split(/[\\/]/).filter(Boolean);
  return parts.at(-1) || bare || '?';
}

const V8_FRAME = /^\s*at\s+(?:(.+?)\s+\((.+?)\)|(.+?))\s*$/;
const AT_FRAME = /^\s*([^@\s]*)@(.+?)\s*$/;

function splitLocation(loc) {
  const m = /^(.*?)(?::(\d+))?(?::(\d+))?$/.exec(String(loc || '').trim());
  return { file: m?.[1] || '', line: m?.[2] || '' };
}

/** Parses V8 (`at fn (file:1:2)`), JSC/Hermes (`fn@file:1:2`) frames. */
export function parseFrames(stack) {
  const frames = [];
  for (const raw of String(stack || '').split('\n')) {
    if (frames.length >= 60) break;
    let fn = '';
    let loc = '';
    const v8 = V8_FRAME.exec(raw);
    if (v8) {
      fn = v8[1] || '';
      loc = v8[2] || v8[3] || '';
      const jsc = !v8[1] && /^([^@\s]*)@(.+)$/.exec(loc);
      if (jsc) [, fn, loc] = jsc;
    } else {
      const at = AT_FRAME.exec(raw);
      if (!at || !/:\d+(?::\d+)?$|\[native code\]/.test(at[2])) continue;
      fn = at[1] || '';
      loc = at[2] || '';
    }
    const { file, line } = splitLocation(loc);
    if (!file) continue;
    const vendor = /node_modules|^node:|^internal[\\/]|\[native code\]|^native$|<anonymous>|^index \d+$/.test(file);
    fn = fn.replace(/^async\s+/, '').replace(/\s+\[as .+\]$/, '').slice(0, 80) || '<anon>';
    frames.push({ fn: scrubText(fn, 80), file: basename(file), line, vendor });
  }
  return frames;
}

/** At most 15 frames as `function (file:line)`, ≤ 2000 chars. */
export function scrubStack(stack) {
  const frames = parseFrames(stack).slice(0, LIMITS.stackFrames);
  if (!frames.length) return null;
  const text = frames.map((f) => `${f.fn} (${f.file}${f.line ? `:${f.line}` : ''})`).join('\n');
  return text.length > LIMITS.stackChars ? text.slice(0, LIMITS.stackChars) : text;
}

/**
 * The first frame from our own code, without line numbers (they move with every build), so the
 * same bug keeps one fingerprint across releases.
 */
export function firstAppFrame(stack) {
  const frames = parseFrames(stack);
  const own = frames.find((f) => !f.vendor) || frames[0];
  return own ? `${own.fn}@${own.file}` : '';
}

/** Message shape for grouping: digits → #, ids and tokens already stripped. */
export function normalizeMessage(message) {
  return scrubText(message).replace(/\d+/g, '#').toLowerCase();
}

export function fingerprintOf({ source, kind, name, message, stack }) {
  const key = [source, kind, String(name || ''), normalizeMessage(message), firstAppFrame(stack)].join('|');
  return createHash('sha1').update(key).digest('hex').slice(0, 16);
}

export function userHashOf(userId) {
  const id = String(userId || '');
  return id ? createHash('sha256').update(id).digest('hex').slice(0, 16) : null;
}

export function cleanPlatform(value) {
  const p = String(value || '').toLowerCase().trim();
  return PLATFORMS.has(p) ? p : null;
}

export function cleanVersion(value) {
  const v = String(value || '').replace(/[^0-9.]/g, '').slice(0, 20);
  return v || null;
}

function cleanRoute(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const [method, ...rest] = raw.split(' ');
  if (rest.length && /^[A-Z]{3,7}$/.test(method)) return `${method} ${scrubText(routeTemplate(rest.join(' ')), 160, { paths: false })}`;
  return scrubText(routeTemplate(raw), 160, { paths: false }) || null;
}

function cleanName(value) {
  return scrubText(value, 80).replace(/[^\w .:$-]/g, '').trim() || 'Error';
}

/**
 * Turns one raw event into a stored row (fingerprint computed from the raw stack, stored stack scrubbed).
 * `at` is trusted only within [now − 7 d, now + 5 min]; otherwise the receive time is used.
 */
export function buildEvent(raw, { source, platform = null, appVersion = null, userId = null, now = Date.now() } = {}) {
  const kind = KINDS.includes(raw?.kind) ? raw.kind : 'error';
  const name = cleanName(raw?.name);
  const message = scrubText(raw?.message);
  const stack = typeof raw?.stack === 'string' ? raw.stack.slice(0, 20_000) : '';
  const at = Date.parse(raw?.at || '');
  const createdAt = Number.isFinite(at) && at >= now - LIMITS.newWindowMs && at <= now + 5 * MINUTE ? at : now;
  return {
    source,
    kind,
    name,
    message,
    stackTop: scrubStack(stack),
    route: cleanRoute(raw?.route),
    platform: cleanPlatform(platform),
    appVersion: cleanVersion(appVersion),
    fatal: Boolean(raw?.fatal) || kind === 'crash',
    userHash: userHashOf(userId),
    createdAt: new Date(createdAt),
    fingerprint: fingerprintOf({ source, kind, name, message: raw?.message, stack }),
  };
}

/**
 * Validates the app's POST /api/app/client-error body. Returns the events (≤ 10; extra ones are
 * ignored) or null when the body is malformed.
 */
export function parseClientErrorReport(body) {
  const events = body?.events;
  if (!Array.isArray(events) || events.length === 0) return null;
  const out = [];
  for (const e of events.slice(0, LIMITS.eventsPerReport)) {
    if (!e || typeof e !== 'object' || Array.isArray(e)) return null;
    if (!KINDS.includes(e.kind)) return null;
    if (typeof e.name !== 'string' || typeof e.message !== 'string') return null;
    if (e.stack != null && typeof e.stack !== 'string') return null;
    if (e.route != null && typeof e.route !== 'string') return null;
    if (e.at != null && typeof e.at !== 'string') return null;
    out.push({ kind: e.kind, name: e.name, message: e.message, stack: e.stack ?? undefined, route: e.route ?? undefined, fatal: e.fatal === true, at: e.at ?? undefined });
  }
  return out;
}

/** User id from a valid user Bearer token (signature only — no database read), else null. */
export function tokenUserId(req, secret) {
  const header = String(req.headers?.authorization || '');
  if (!header.startsWith('Bearer ') || !secret) return null;
  try {
    const payload = jwt.verify(header.slice(7).trim(), secret);
    if (payload?.role === 'admin') return null;
    return typeof payload?.sub === 'string' && payload.sub ? payload.sub : null;
  } catch {
    return null;
  }
}

// ---------- alert copy + throttles (pure, tested) ----------

const SOURCE_KA = { app: 'აპი', server: 'სერვერი' };

export function newErrorText(e) {
  const lines = [`🐞 ახალი შეცდომა (${SOURCE_KA[e.source] || e.source}${e.fatal ? ', ავარია' : ''})`];
  lines.push(`${e.name}: ${e.message || '—'}`);
  if (e.route) lines.push(`მისამართი: ${e.route}`);
  if (e.source === 'app') lines.push(`აპი: ${e.platform || '?'} ${e.appVersion || '?'}`);
  lines.push('', 'დეტალები: ადმინი → შეცდომები (#/errors)');
  return lines.join('\n');
}

export function spikeText(e, count) {
  const lines = [`📈 შეცდომების ტალღა: ${count} შემთხვევა 10 წუთში (${SOURCE_KA[e.source] || e.source})`];
  lines.push(`${e.name}: ${e.message || '—'}`);
  if (e.route) lines.push(`მისამართი: ${e.route}`);
  if (e.source === 'app') lines.push(`აპი: ${e.platform || '?'} ${e.appVersion || '?'}`);
  lines.push('', 'დეტალები: ადმინი → შეცდომები (#/errors)');
  return lines.join('\n');
}

/** In-memory alert throttles: new fingerprint ≤ 1 / 6 h each and ≤ 10 / h overall; spike ≤ 1 / 2 h each. */
export function createAlertThrottle({ now = Date.now } = {}) {
  const lastNew = new Map();
  const lastSpike = new Map();
  let recentNew = [];
  const trim = (map, ttl) => {
    if (map.size < 5000) return;
    const t = now();
    for (const [k, v] of map) if (t - v >= ttl) map.delete(k);
  };
  return {
    allowNew(fp) {
      const t = now();
      if (t - (lastNew.get(fp) ?? -Infinity) < LIMITS.newRepeatMs) return false;
      recentNew = recentNew.filter((x) => t - x < HOUR);
      if (recentNew.length >= LIMITS.newPerHour) return false;
      recentNew.push(t);
      lastNew.set(fp, t);
      trim(lastNew, LIMITS.newRepeatMs);
      return true;
    },
    allowSpike(fp) {
      const t = now();
      if (t - (lastSpike.get(fp) ?? -Infinity) < LIMITS.spikeRepeatMs) return false;
      lastSpike.set(fp, t);
      trim(lastSpike, LIMITS.spikeRepeatMs);
      return true;
    },
  };
}

// ---------- recorder (bounded, fire-and-forget) ----------

const isMissingTable = (error) => /ErrorEvent|42P01|does not exist/.test(String(error?.message || error?.meta?.message || ''));

/** Postgres-backed store; tests inject a fake with the same three methods. */
export function prismaErrorStore(db = prisma) {
  return {
    async insert(row) {
      await db.$executeRaw`INSERT INTO "ErrorEvent" (id, "createdAt", source, kind, fingerprint, name, message, "stackTop", route, platform, "appVersion", fatal, "userHash", count)
        VALUES (${randomUUID()}, ${row.createdAt}, ${row.source}, ${row.kind}, ${row.fingerprint}, ${row.name}, ${row.message}, ${row.stackTop}, ${row.route}, ${row.platform}, ${row.appVersion}, ${row.fatal}, ${row.userHash}, ${row.count})`;
    },
    async seenSince(fingerprint, since) {
      const rows = await db.$queryRaw`SELECT 1 AS hit FROM "ErrorEvent" WHERE fingerprint = ${fingerprint} AND "createdAt" >= ${since} LIMIT 1`;
      return rows.length > 0;
    },
    async countSince(fingerprint, since) {
      const [row] = await db.$queryRaw`SELECT COALESCE(SUM(count), 0)::int AS n FROM "ErrorEvent" WHERE fingerprint = ${fingerprint} AND "createdAt" >= ${since}`;
      return Number(row?.n) || 0;
    },
  };
}

const defaultNotify = async (text) => {
  const { notifyOwner } = await import('./director/service.js');
  return notifyOwner(text, { direction: 'system' });
};

/**
 * `record(event)` never throws and never awaits the database for the caller; it returns a promise
 * that settles when the row (and any alert) is done, for tests and the fatal-exit flush.
 */
export function createErrorRecorder({ store, notify = defaultNotify, now = Date.now, enabled = () => true } = {}) {
  const st = store || prismaErrorStore();
  const throttle = createAlertThrottle({ now });
  const lastRow = new Map(); // fingerprint → { at, pending }
  const knownFresh = new Map(); // fingerprint → time we last confirmed it is not new
  const lastSpikeCheck = new Map();
  let minute = 0;
  let rowsThisMinute = 0;
  let droppedThisMinute = 0;
  let pausedUntil = 0;
  const inflight = new Set();
  const stats = { written: 0, folded: 0, dropped: 0, alerts: 0 };

  function admit(fp) {
    const t = now();
    const prev = lastRow.get(fp);
    if (prev && t - prev.at < LIMITS.dedupMs) {
      prev.pending += 1;
      stats.folded += 1;
      return 0;
    }
    const m = Math.floor(t / MINUTE);
    if (m !== minute) {
      if (droppedThisMinute) console.warn(`[errors] cap reached: ${droppedThisMinute} events dropped in one minute`);
      minute = m;
      rowsThisMinute = 0;
      droppedThisMinute = 0;
    }
    if (rowsThisMinute >= LIMITS.rowsPerMinute) {
      droppedThisMinute += 1;
      stats.dropped += 1;
      return 0;
    }
    rowsThisMinute += 1;
    const count = 1 + (prev?.pending || 0);
    lastRow.set(fp, { at: t, pending: 0 });
    if (lastRow.size > 5000) {
      for (const [k, v] of lastRow) if (t - v.at >= LIMITS.dedupMs && !v.pending) lastRow.delete(k);
    }
    return count;
  }

  async function persist(row) {
    const t = now();
    let isNew = false;
    if (t - (knownFresh.get(row.fingerprint) ?? -Infinity) > HOUR) {
      isNew = !(await st.seenSince(row.fingerprint, new Date(t - LIMITS.newWindowMs)));
      knownFresh.set(row.fingerprint, t);
      if (knownFresh.size > 5000) knownFresh.clear();
    }
    await st.insert(row);
    stats.written += 1;
    if (isNew && throttle.allowNew(row.fingerprint)) await send(newErrorText(row));
    if (t - (lastSpikeCheck.get(row.fingerprint) ?? -Infinity) >= MINUTE) {
      lastSpikeCheck.set(row.fingerprint, t);
      if (lastSpikeCheck.size > 5000) lastSpikeCheck.clear();
      const n = await st.countSince(row.fingerprint, new Date(t - LIMITS.spikeWindowMs));
      if (n > LIMITS.spikeThreshold && throttle.allowSpike(row.fingerprint)) await send(spikeText(row, n));
    }
  }

  async function send(text) {
    stats.alerts += 1;
    try {
      await notify(text);
    } catch (error) {
      console.warn('[errors] owner notice failed:', error?.message || error);
    }
  }

  function record(event) {
    try {
      if (!event || !enabled() || now() < pausedUntil) return Promise.resolve(false);
      const count = admit(event.fingerprint);
      if (!count) return Promise.resolve(false);
      const job = persist({ ...event, count })
        .then(() => true)
        .catch((error) => {
          if (isMissingTable(error)) {
            pausedUntil = now() + 10 * MINUTE;
            console.warn('[errors] ErrorEvent table missing — run npm run db:install; recording paused 10 min');
          } else {
            console.warn('[errors] record failed:', error?.message || error);
          }
          return false;
        })
        .finally(() => inflight.delete(job));
      inflight.add(job);
      return job;
    } catch (error) {
      console.warn('[errors] record skipped:', error?.message || error);
      return Promise.resolve(false);
    }
  }

  /** Waits up to `ms` for rows in flight (used before a fatal exit). */
  async function flush(ms = 2000) {
    if (!inflight.size) return;
    await Promise.race([Promise.allSettled([...inflight]), new Promise((r) => setTimeout(r, ms))]);
  }

  return { record, flush, stats };
}

/** Production only (local servers point at the main database); ERROR_MONITOR=off disables, =on forces. */
export function errorMonitorEnabled(envName = process.env.NODE_ENV, flag = process.env.ERROR_MONITOR) {
  if (flag === 'off') return false;
  if (flag === 'on') return true;
  return envName === 'production';
}

export const errorRecorder = createErrorRecorder({ enabled: () => errorMonitorEnabled() });

/** Records an unhandled 500 from the Express error handler. Never throws, never delays the response. */
export function recordServerError(error, req) {
  try {
    const method = String(req?.method || '').toUpperCase();
    const path = req?.originalUrl || req?.url || '';
    const event = buildEvent({
      kind: 'error',
      name: error?.name || error?.constructor?.name || 'Error',
      message: error?.message ?? String(error ?? ''),
      stack: error?.stack,
      route: path ? `${method} ${routeTemplate(path)}` : undefined,
      fatal: false,
    }, { source: 'server', userId: req?.user?.id || null });
    void errorRecorder.record(event);
  } catch {
    /* monitoring must never break error handling */
  }
}

/** Records a fatal process error (uncaughtException / unhandledRejection). */
export function recordFatalError(error, origin) {
  try {
    const err = error instanceof Error ? error : new Error(String(error));
    const event = buildEvent({
      kind: origin === 'unhandledRejection' ? 'unhandled_rejection' : 'crash',
      name: err.name || 'Error',
      message: err.message,
      stack: err.stack,
      fatal: true,
    }, { source: 'server' });
    void errorRecorder.record(event);
  } catch {
    /* ignore */
  }
  return errorRecorder.flush(2000);
}

// ---------- admin reads ----------

export async function errorGroups({ hours = 24, source = 'all', db = prisma } = {}) {
  const since = new Date(Date.now() - hours * HOUR);
  const rows = await db.$queryRaw`
    WITH w AS (
      SELECT * FROM "ErrorEvent" WHERE "createdAt" >= ${since} AND (${source}::text = 'all' OR source = ${source}::text)
    ), agg AS (
      SELECT fingerprint, SUM(count)::int AS count, COUNT(DISTINCT "userHash")::int AS users,
        array_remove(array_agg(DISTINCT platform), NULL) AS platforms, BOOL_OR(fatal) AS fatal, MAX("createdAt") AS "lastSeen"
      FROM w GROUP BY fingerprint
    ), latest AS (
      SELECT DISTINCT ON (fingerprint) fingerprint, source, kind, name, message, "stackTop", route FROM w ORDER BY fingerprint, "createdAt" DESC
    ), firsts AS (
      SELECT fingerprint, MIN("createdAt") AS "firstSeen" FROM "ErrorEvent" WHERE fingerprint IN (SELECT fingerprint FROM agg) GROUP BY fingerprint
    )
    SELECT agg.*, latest.source, latest.kind, latest.name, latest.message, latest."stackTop" AS "sampleStack", latest.route AS "sampleRoute", firsts."firstSeen"
    FROM agg JOIN latest USING (fingerprint) JOIN firsts USING (fingerprint)
    ORDER BY agg.count DESC, agg."lastSeen" DESC LIMIT 200`;
  const versions = await db.$queryRaw`
    SELECT fingerprint, "appVersion" AS version, SUM(count)::int AS n FROM "ErrorEvent"
    WHERE "createdAt" >= ${since} AND "appVersion" IS NOT NULL AND (${source}::text = 'all' OR source = ${source}::text)
    GROUP BY fingerprint, "appVersion"`;
  const byFp = new Map();
  for (const v of versions) {
    if (!byFp.has(v.fingerprint)) byFp.set(v.fingerprint, []);
    byFp.get(v.fingerprint).push({ version: v.version, count: Number(v.n) });
  }
  const groups = rows.map((r) => ({
    fingerprint: r.fingerprint,
    source: r.source,
    kind: r.kind,
    name: r.name,
    message: r.message,
    count: Number(r.count),
    users: Number(r.users),
    platforms: r.platforms || [],
    versions: (byFp.get(r.fingerprint) || []).sort((a, b) => b.count - a.count).slice(0, 3),
    fatal: Boolean(r.fatal),
    firstSeen: r.firstSeen,
    lastSeen: r.lastSeen,
    sampleStack: r.sampleStack,
    sampleRoute: r.sampleRoute,
  }));
  const [totals] = await db.$queryRaw`
    SELECT COALESCE(SUM(count), 0)::int AS events, COUNT(DISTINCT fingerprint)::int AS "groups", COUNT(DISTINCT "userHash")::int AS "users",
      COALESCE(SUM(count) FILTER (WHERE fatal), 0)::int AS fatal
    FROM "ErrorEvent" WHERE "createdAt" >= ${since} AND (${source}::text = 'all' OR source = ${source}::text)`;
  const newGroups = groups.filter((g) => new Date(g.firstSeen).getTime() >= since.getTime()).length;
  return { hours, source, totals: { events: Number(totals?.events) || 0, groups: Number(totals?.groups) || 0, users: Number(totals?.users) || 0, fatal: Number(totals?.fatal) || 0, newGroups }, groups };
}

export async function errorGroupDetail(fingerprint, { hours = 24, db = prisma } = {}) {
  const since = new Date(Date.now() - hours * HOUR);
  const events = await db.$queryRaw`
    SELECT id, "createdAt", source, kind, name, message, "stackTop", route, platform, "appVersion", fatal, "userHash", count
    FROM "ErrorEvent" WHERE fingerprint = ${fingerprint} ORDER BY "createdAt" DESC LIMIT 50`;
  const hourly = await db.$queryRaw`
    SELECT date_trunc('hour', "createdAt") AS hour, SUM(count)::int AS n FROM "ErrorEvent"
    WHERE fingerprint = ${fingerprint} AND "createdAt" >= ${since} GROUP BY 1 ORDER BY 1`;
  const counts = new Map(hourly.map((h) => [new Date(h.hour).getTime(), Number(h.n)]));
  const start = Math.floor(since.getTime() / HOUR) * HOUR;
  const series = [];
  for (let t = start; t <= Date.now(); t += HOUR) series.push({ hour: new Date(t).toISOString(), count: counts.get(t) || 0 });
  return { fingerprint, hours, events: events.map((e) => ({ ...e, count: Number(e.count) })), hourly: series };
}

// ---------- retention ----------

export const PURGE_LEASE = 'error-events-purge';
let purgeTimer = null;
let purgedAt = 0;

export async function purgeOldErrors(db = prisma) {
  return db.$executeRaw`DELETE FROM "ErrorEvent" WHERE "createdAt" < NOW() - (${LIMITS.retentionDays}::int * INTERVAL '1 day')`;
}

async function purgeTick(db) {
  try {
    if (!(await acquireJobLease(PURGE_LEASE, 2 * HOUR, { db }))) return;
    if (Date.now() - purgedAt < 24 * HOUR) return;
    purgedAt = Date.now();
    const n = await purgeOldErrors(db);
    if (n) console.log(`[errors] purged ${n} rows older than ${LIMITS.retentionDays} days`);
  } catch (error) {
    if (!isMissingTable(error)) console.warn('[errors] purge failed:', error?.message || error);
  }
}

export function startErrorPurge({ db = prisma } = {}) {
  if (purgeTimer) return;
  setTimeout(() => void purgeTick(db), 5 * MINUTE).unref?.();
  purgeTimer = setInterval(() => void purgeTick(db), HOUR);
  purgeTimer.unref?.();
}

export function stopErrorPurge() {
  if (purgeTimer) clearInterval(purgeTimer);
  purgeTimer = null;
}
