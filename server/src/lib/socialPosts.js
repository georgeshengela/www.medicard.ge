/**
 * Social-media campaign log (2026-10-01). Tables "SocialPost" / "SocialPostEvent"
 * (prisma/20261001-social.sql, install-social.mjs in db:install) — raw SQL, not in schema.prisma.
 *
 * The operator records every post/story it schedules in Metricool through
 * `node server/scripts/social-log.mjs upsert|status <file.json>`; admin #/social reads it
 * (routes/social.routes.js). A post is keyed by its stable plan `slot` (e.g. 'd01-feed'); every
 * create / change / status move appends one "SocialPostEvent" row, so the history is exact.
 * Marketing copy and public https media URLs only — never user or health data.
 */
import { randomUUID } from 'node:crypto';

export const SOCIAL_NETWORKS = Object.freeze(['facebook', 'instagram', 'linkedin']);
export const SOCIAL_KINDS = Object.freeze(['POST', 'STORY', 'REEL', 'CAROUSEL']);
export const SOCIAL_STATUSES = Object.freeze(['PLANNED', 'SCHEDULED', 'PUBLISHED', 'FAILED', 'CANCELED']);
export const SOCIAL_EVENT_TYPES = Object.freeze(['CREATED', 'SCHEDULED', 'UPDATED', 'PUBLISHED', 'FAILED', 'CANCELED', 'SYNCED']);
export const CAMPAIGN_DAYS = 28;

const LIMITS = Object.freeze({ slot: 64, campaign: 64, pillar: 60, title: 140, text: 5000, notes: 2000, id: 120, url: 1000, media: 20, detail: 500 });

async function defaultDb() {
  return (await import('./prisma.js')).prisma;
}

/* ─────────────── Validation ─────────────── */

function fail(message) {
  const error = new Error(message);
  error.status = 400;
  throw error;
}

function str(value, field, max, { required = false, nullable = true } = {}) {
  if (value === undefined) {
    if (required) fail(`${field} is required`);
    return undefined;
  }
  if (value === null || value === '') {
    if (required || !nullable) fail(`${field} is required`);
    return null;
  }
  if (typeof value !== 'string') fail(`${field} must be a string`);
  const out = value.trim();
  if (!out && (required || !nullable)) fail(`${field} is required`);
  if (out.length > max) fail(`${field} is longer than ${max} characters`);
  return out || null;
}

function httpsUrl(value, field) {
  const out = str(value, field, LIMITS.url);
  if (out == null) return out;
  let url;
  try { url = new URL(out); } catch { fail(`${field} is not a URL`); }
  if (url.protocol !== 'https:') fail(`${field} must be an https URL`);
  return url.toString();
}

function date(value, field, { required = false } = {}) {
  if (value === undefined) {
    if (required) fail(`${field} is required`);
    return undefined;
  }
  if (value === null || value === '') {
    if (required) fail(`${field} is required`);
    return null;
  }
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) fail(`${field} is not a valid date`);
  // A bare local time would be read in the server's zone; require an explicit offset or Z.
  if (typeof value === 'string' && /T\d{2}:\d{2}/.test(value) && !/(Z|[+-]\d{2}:?\d{2})$/i.test(value.trim())) {
    fail(`${field} needs a time zone offset (e.g. +04:00)`);
  }
  return d;
}

export function normalizeSlot(value) {
  const slot = str(value, 'slot', LIMITS.slot, { required: true });
  if (!/^[a-z0-9][a-z0-9._-]*$/i.test(slot)) fail('slot may contain only letters, digits, . _ -');
  return slot;
}

function list(value, field, allowed, { max, url = false } = {}) {
  if (value === undefined) return undefined;
  if (value === null) return [];
  if (!Array.isArray(value)) fail(`${field} must be an array`);
  const out = [];
  for (const item of value) {
    let v = url ? httpsUrl(item, field) : str(item, field, 40, { required: true }).toLowerCase();
    if (v == null) continue;
    if (allowed && !allowed.includes(v)) fail(`${field}: unknown value "${item}"`);
    if (!out.includes(v)) out.push(v);
  }
  if (max && out.length > max) fail(`${field}: at most ${max} items`);
  return out;
}

function enumValue(value, field, allowed) {
  if (value === undefined) return undefined;
  const v = String(value ?? '').trim().toUpperCase();
  if (!allowed.includes(v)) fail(`${field} must be one of ${allowed.join(', ')}`);
  return v;
}

/**
 * Validates one upsert record. Every field except `slot` may be omitted (an existing post keeps its
 * value); `create: true` additionally requires the fields a new post needs.
 */
export function normalizePostInput(raw, { create = false } = {}) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) fail('post must be an object');
  const out = {
    slot: normalizeSlot(raw.slot),
    campaign: str(raw.campaign, 'campaign', LIMITS.campaign, { required: create, nullable: false }),
    networks: list(raw.networks, 'networks', SOCIAL_NETWORKS),
    kind: enumValue(raw.kind, 'kind', SOCIAL_KINDS),
    pillar: str(raw.pillar, 'pillar', LIMITS.pillar),
    title: str(raw.title, 'title', LIMITS.title, { required: create, nullable: false }),
    text: str(raw.text, 'text', LIMITS.text, { required: create, nullable: false }),
    textEn: str(raw.textEn, 'textEn', LIMITS.text),
    mediaUrls: list(raw.mediaUrls, 'mediaUrls', null, { max: LIMITS.media, url: true }),
    scheduledAt: date(raw.scheduledAt, 'scheduledAt', { required: create }),
    status: enumValue(raw.status, 'status', SOCIAL_STATUSES),
    metricoolId: str(raw.metricoolId == null ? raw.metricoolId : String(raw.metricoolId), 'metricoolId', LIMITS.id),
    externalUrl: httpsUrl(raw.externalUrl, 'externalUrl'),
    publishedAt: date(raw.publishedAt, 'publishedAt'),
    notes: str(raw.notes, 'notes', LIMITS.notes),
  };
  if (create) {
    if (!out.networks?.length) fail('networks is required');
    if (!out.kind) fail('kind is required');
  } else if (out.networks && !out.networks.length) {
    fail('networks cannot be empty');
  }
  return out;
}

/* ─────────────── Formatting / diff ─────────────── */

/** "2026-10-02 13:00" in Asia/Tbilisi — used in event details. */
export function tbilisiStamp(value) {
  if (!value) return '—';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Tbilisi', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }).formatToParts(d).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`;
}

/** Calendar date (YYYY-MM-DD) in Asia/Tbilisi. */
export function tbilisiDay(value) {
  return tbilisiStamp(value).slice(0, 10);
}

const CONTENT_FIELDS = ['campaign', 'networks', 'kind', 'pillar', 'title', 'text', 'textEn', 'mediaUrls', 'scheduledAt', 'notes', 'metricoolId', 'externalUrl', 'publishedAt'];
const LONG_FIELDS = new Set(['text', 'textEn', 'notes', 'title']);

function comparable(field, value) {
  if (value == null) return '';
  if (Array.isArray(value)) return value.join(',');
  if (value instanceof Date) return value.toISOString();
  if (field === 'scheduledAt' || field === 'publishedAt') return new Date(value).toISOString();
  return String(value);
}

function shown(field, value) {
  if (value == null || (Array.isArray(value) && !value.length) || value === '') return '—';
  if (field === 'scheduledAt' || field === 'publishedAt') return tbilisiStamp(value);
  if (field === 'mediaUrls') return `${value.length} ფაილი`;
  if (Array.isArray(value)) return value.join('+');
  return String(value);
}

/** Changed content fields between the stored row and the next values (undefined = unchanged). */
export function diffPost(before, next) {
  const changes = [];
  for (const field of CONTENT_FIELDS) {
    if (next[field] === undefined) continue;
    if (comparable(field, before[field]) === comparable(field, next[field])) continue;
    changes.push(field);
  }
  return changes;
}

export function describeChanges(before, next, fields) {
  const text = fields.map((field) => (LONG_FIELDS.has(field)
    ? `${field} შეიცვალა`
    : `${field}: ${shown(field, before[field])} → ${shown(field, next[field])}`)).join('; ');
  return text.slice(0, LIMITS.detail);
}

function createdDetail(post) {
  return `${post.networks.join('+')} · ${post.kind} · ${tbilisiStamp(post.scheduledAt)} · ${post.status}`.slice(0, LIMITS.detail);
}

/** Event type for a status move; the same status again is a sync with Metricool. */
export function statusEventType(from, to) {
  if (from === to) return 'SYNCED';
  if (to === 'PLANNED') return 'UPDATED';
  return to;
}

/* ─────────────── Store (raw SQL) ─────────────── */

const POST_COLUMNS = 'id, campaign, slot, networks, kind, pillar, title, text, "textEn", "mediaUrls", "scheduledAt", status, "metricoolId", "externalUrl", "publishedAt", "lastSyncedAt", notes, "createdAt", "updatedAt"';

export function socialStore(db) {
  return {
    async findBySlot(slot) {
      const rows = await db.$queryRawUnsafe(`SELECT ${POST_COLUMNS} FROM "SocialPost" WHERE slot = $1 LIMIT 1`, slot);
      return rows[0] || null;
    },
    async insert(p) {
      await db.$executeRaw`INSERT INTO "SocialPost" (id, campaign, slot, networks, kind, pillar, title, text, "textEn", "mediaUrls", "scheduledAt", status, "metricoolId", "externalUrl", "publishedAt", notes, "createdAt", "updatedAt")
        VALUES (${p.id}, ${p.campaign}, ${p.slot}, ${p.networks}::text[], ${p.kind}, ${p.pillar}, ${p.title}, ${p.text}, ${p.textEn}, ${p.mediaUrls}::text[], ${p.scheduledAt}, ${p.status}, ${p.metricoolId}, ${p.externalUrl}, ${p.publishedAt}, ${p.notes}, NOW(), NOW())`;
    },
    async update(p) {
      await db.$executeRaw`UPDATE "SocialPost" SET campaign = ${p.campaign}, networks = ${p.networks}::text[], kind = ${p.kind}, pillar = ${p.pillar}, title = ${p.title}, text = ${p.text},
        "textEn" = ${p.textEn}, "mediaUrls" = ${p.mediaUrls}::text[], "scheduledAt" = ${p.scheduledAt}, status = ${p.status}, "metricoolId" = ${p.metricoolId},
        "externalUrl" = ${p.externalUrl}, "publishedAt" = ${p.publishedAt}, "lastSyncedAt" = ${p.lastSyncedAt}, notes = ${p.notes}, "updatedAt" = NOW()
        WHERE id = ${p.id}`;
    },
    async addEvent(postId, type, detail) {
      await db.$executeRaw`INSERT INTO "SocialPostEvent" (id, "postId", at, type, detail) VALUES (${randomUUID()}, ${postId}, NOW(), ${type}, ${detail ?? null})`;
    },
  };
}

async function resolveStore(opts) {
  if (opts?.store) return opts.store;
  return socialStore(opts?.db || await defaultDb());
}

/* ─────────────── Writes ─────────────── */

/**
 * Creates or updates a post by `slot`. New post → CREATED event; changed content → UPDATED event with
 * a short diff; a status change in the same record → its own status event. Unchanged → no event.
 * @returns {{ action: 'created'|'updated'|'unchanged', id: string, slot: string, changes: string[] }}
 */
export async function upsertSocialPost(data, opts = {}) {
  const store = await resolveStore(opts);
  const slot = normalizeSlot(data?.slot);
  const existing = await store.findBySlot(slot);
  const input = normalizePostInput(data, { create: !existing });

  if (!existing) {
    const post = {
      id: randomUUID(),
      slot,
      campaign: input.campaign,
      networks: input.networks,
      kind: input.kind,
      pillar: input.pillar ?? null,
      title: input.title,
      text: input.text,
      textEn: input.textEn ?? null,
      mediaUrls: input.mediaUrls ?? [],
      scheduledAt: input.scheduledAt,
      status: input.status || 'PLANNED',
      metricoolId: input.metricoolId ?? null,
      externalUrl: input.externalUrl ?? null,
      publishedAt: input.publishedAt ?? null,
      notes: input.notes ?? null,
    };
    await store.insert(post);
    await store.addEvent(post.id, 'CREATED', createdDetail(post));
    return { action: 'created', id: post.id, slot, changes: [] };
  }

  const changes = diffPost(existing, input);
  const statusChanged = input.status !== undefined && input.status !== existing.status;
  if (!changes.length && !statusChanged) return { action: 'unchanged', id: existing.id, slot, changes: [] };

  const merged = { ...existing };
  for (const field of CONTENT_FIELDS) if (input[field] !== undefined) merged[field] = input[field];
  if (statusChanged) merged.status = input.status;
  await store.update(merged);
  if (changes.length) await store.addEvent(existing.id, 'UPDATED', describeChanges(existing, input, changes));
  if (statusChanged) await store.addEvent(existing.id, statusEventType(existing.status, input.status), `${existing.status} → ${input.status}`);
  return { action: 'updated', id: existing.id, slot, changes: statusChanged ? [...changes, 'status'] : changes };
}

/**
 * Records a status from Metricool (SCHEDULED / PUBLISHED / FAILED / CANCELED, or PLANNED to pull a
 * post back). Always stamps lastSyncedAt. Same status again = SYNCED event (e.g. a new external link).
 */
export async function setSocialPostStatus(slot, status, extra = {}, opts = {}) {
  const store = await resolveStore(opts);
  const key = normalizeSlot(slot);
  const to = enumValue(status, 'status', SOCIAL_STATUSES);
  const existing = await store.findBySlot(key);
  if (!existing) {
    const error = new Error(`unknown slot "${key}"`);
    error.status = 404;
    throw error;
  }
  const metricoolId = str(extra.metricoolId == null ? extra.metricoolId : String(extra.metricoolId), 'metricoolId', LIMITS.id);
  const externalUrl = httpsUrl(extra.externalUrl, 'externalUrl');
  let publishedAt = date(extra.publishedAt, 'publishedAt');
  if (to === 'PUBLISHED' && publishedAt === undefined && !existing.publishedAt) publishedAt = opts.now ? new Date(opts.now) : new Date();
  const detailIn = str(extra.detail, 'detail', LIMITS.detail);

  const next = { ...existing, status: to, lastSyncedAt: opts.now ? new Date(opts.now) : new Date() };
  const notes = [];
  if (metricoolId !== undefined && metricoolId !== existing.metricoolId) { next.metricoolId = metricoolId; notes.push(`Metricool ${metricoolId || '—'}`); }
  if (externalUrl !== undefined && externalUrl !== existing.externalUrl) { next.externalUrl = externalUrl; notes.push(externalUrl ? 'ბმული დაემატა' : 'ბმული მოიხსნა'); }
  if (publishedAt !== undefined && comparable('publishedAt', publishedAt) !== comparable('publishedAt', existing.publishedAt)) { next.publishedAt = publishedAt; notes.push(`გამოქვეყნდა ${tbilisiStamp(publishedAt)}`); }

  await store.update(next);
  const type = statusEventType(existing.status, to);
  const auto = [existing.status !== to ? `${existing.status} → ${to}` : null, ...notes].filter(Boolean).join('; ');
  const detail = [detailIn, auto].filter(Boolean).join(' · ').slice(0, LIMITS.detail) || null;
  await store.addEvent(existing.id, type, detail);
  return { id: existing.id, slot: key, type, status: to };
}

/* ─────────────── Reads ─────────────── */

function toIso(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function serializePost(row) {
  if (!row) return null;
  return {
    id: row.id,
    campaign: row.campaign,
    slot: row.slot,
    networks: row.networks || [],
    kind: row.kind,
    pillar: row.pillar ?? null,
    title: row.title,
    text: row.text,
    textEn: row.textEn ?? null,
    mediaUrls: row.mediaUrls || [],
    scheduledAt: toIso(row.scheduledAt),
    status: row.status,
    metricoolId: row.metricoolId ?? null,
    externalUrl: row.externalUrl ?? null,
    publishedAt: toIso(row.publishedAt),
    lastSyncedAt: toIso(row.lastSyncedAt),
    notes: row.notes ?? null,
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
  };
}

function serializeEvent(row) {
  return {
    id: row.id,
    postId: row.postId,
    at: toIso(row.at),
    type: row.type,
    detail: row.detail ?? null,
    ...(row.slot !== undefined ? { slot: row.slot, title: row.title, networks: row.networks || [], kind: row.kind } : {}),
  };
}

/**
 * Upcoming posts first (soonest first), then past posts (newest first).
 * Filters: from/to (scheduledAt range), status, network, campaign.
 */
export async function listSocialPosts({ from = null, to = null, status = null, network = null, campaign = null, limit = 1000, db } = {}) {
  const q = db || await defaultDb();
  const rows = await q.$queryRaw`
    SELECT id, campaign, slot, networks, kind, pillar, title, text, "textEn", "mediaUrls", "scheduledAt", status, "metricoolId", "externalUrl", "publishedAt", "lastSyncedAt", notes, "createdAt", "updatedAt"
    FROM "SocialPost"
    WHERE (${from}::timestamptz IS NULL OR "scheduledAt" >= ${from}::timestamptz)
      AND (${to}::timestamptz IS NULL OR "scheduledAt" < ${to}::timestamptz)
      AND (${status}::text IS NULL OR status = ${status}::text)
      AND (${network}::text IS NULL OR ${network}::text = ANY(networks))
      AND (${campaign}::text IS NULL OR campaign = ${campaign}::text)
    ORDER BY ("scheduledAt" < NOW()) ASC,
      CASE WHEN "scheduledAt" >= NOW() THEN "scheduledAt" END ASC,
      "scheduledAt" DESC
    LIMIT ${Math.min(Math.max(Number(limit) || 1000, 1), 2000)}`;
  return rows.map(serializePost);
}

export async function getSocialPost(id, { db } = {}) {
  const q = db || await defaultDb();
  const rows = await q.$queryRaw`
    SELECT id, campaign, slot, networks, kind, pillar, title, text, "textEn", "mediaUrls", "scheduledAt", status, "metricoolId", "externalUrl", "publishedAt", "lastSyncedAt", notes, "createdAt", "updatedAt"
    FROM "SocialPost" WHERE id = ${id} LIMIT 1`;
  if (!rows[0]) return null;
  const events = await q.$queryRaw`SELECT id, "postId", at, type, detail FROM "SocialPostEvent" WHERE "postId" = ${id} ORDER BY at DESC, id DESC`;
  return { post: serializePost(rows[0]), events: events.map(serializeEvent) };
}

/** Newest events first across all posts, with the post's title for the history feed. */
export async function listSocialEvents({ limit = 300, db } = {}) {
  const q = db || await defaultDb();
  const rows = await q.$queryRaw`
    SELECT e.id, e."postId", e.at, e.type, e.detail, p.slot, p.title, p.networks, p.kind
    FROM "SocialPostEvent" e JOIN "SocialPost" p ON p.id = e."postId"
    ORDER BY e.at DESC, e.id DESC
    LIMIT ${Math.min(Math.max(Number(limit) || 300, 1), 1000)}`;
  return rows.map(serializeEvent);
}

/** Campaign day 1..length counted in Tbilisi calendar days from the first post; 0 before it starts. */
export function campaignDay(firstAt, now = Date.now(), length = CAMPAIGN_DAYS) {
  if (!firstAt) return 0;
  const start = Date.parse(`${tbilisiDay(firstAt)}T00:00:00Z`);
  const today = Date.parse(`${tbilisiDay(new Date(now))}T00:00:00Z`);
  const day = Math.floor((today - start) / 86_400_000) + 1;
  if (day < 1) return 0;
  return Math.min(day, length);
}

export function buildSocialSummary({ byStatus = [], byNetwork = [], byPillar = [], campaigns = [], next = null, lastPublished = null, now = Date.now() } = {}) {
  const status = Object.fromEntries(SOCIAL_STATUSES.map((s) => [s, 0]));
  for (const row of byStatus) status[row.status] = Number(row.n) || 0;
  const network = Object.fromEntries(SOCIAL_NETWORKS.map((n) => [n, 0]));
  for (const row of byNetwork) network[row.network] = Number(row.n) || 0;
  const pillar = byPillar.map((row) => ({ pillar: row.pillar || null, n: Number(row.n) || 0 }));
  const list = campaigns.map((c) => ({ campaign: c.campaign, posts: Number(c.n) || 0, firstAt: toIso(c.firstAt), lastAt: toIso(c.lastAt) }));
  const current = list[0] || null;
  return {
    total: Object.values(status).reduce((a, b) => a + b, 0),
    status,
    planned: status.PLANNED + status.SCHEDULED,
    published: status.PUBLISHED,
    network,
    pillar,
    campaigns: list,
    campaign: current ? { ...current, length: CAMPAIGN_DAYS, day: campaignDay(current.firstAt, now) } : null,
    next: next ? serializePost(next) : null,
    lastPublished: lastPublished ? serializePost(lastPublished) : null,
  };
}

export async function socialSummary({ db, now = Date.now() } = {}) {
  const q = db || await defaultDb();
  const byStatus = await q.$queryRaw`SELECT status, COUNT(*)::int AS n FROM "SocialPost" GROUP BY status`;
  const byNetwork = await q.$queryRaw`SELECT net AS network, COUNT(*)::int AS n FROM "SocialPost", unnest(networks) AS net WHERE status <> 'CANCELED' GROUP BY net`;
  const byPillar = await q.$queryRaw`SELECT pillar, COUNT(*)::int AS n FROM "SocialPost" WHERE status <> 'CANCELED' GROUP BY pillar ORDER BY n DESC`;
  // Most recently started campaign first — that is the one the page counts days for.
  const campaigns = await q.$queryRaw`SELECT campaign, COUNT(*)::int AS n, MIN("scheduledAt") AS "firstAt", MAX("scheduledAt") AS "lastAt" FROM "SocialPost" WHERE status <> 'CANCELED' GROUP BY campaign ORDER BY MIN("scheduledAt") DESC`;
  const [next] = await q.$queryRawUnsafe(`SELECT ${POST_COLUMNS} FROM "SocialPost" WHERE status IN ('PLANNED', 'SCHEDULED') AND "scheduledAt" >= NOW() ORDER BY "scheduledAt" ASC LIMIT 1`);
  const [lastPublished] = await q.$queryRawUnsafe(`SELECT ${POST_COLUMNS} FROM "SocialPost" WHERE status = 'PUBLISHED' ORDER BY COALESCE("publishedAt", "scheduledAt") DESC LIMIT 1`);
  return buildSocialSummary({ byStatus, byNetwork, byPillar, campaigns, next, lastPublished, now });
}
