/**
 * Home news cards („სიახლეები“). The admin writes a card — title, short text, optional picture,
 * longer details and one button — schedules it and aims it at an audience; the app shows live
 * cards on Home above the nutrition section and opens the details on tap.
 *
 * Tables: prisma/20260928-announcements.sql (install-announcements in db:install; also created
 * lazily here, so a missing install never breaks Home — it only shows no cards).
 * Everything is raw SQL, like the other additive modules.
 */
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { z } from 'zod';
import { prisma } from './prisma.js';
import { isFeatureEnabled } from './featureFlags.js';

export const TONES = Object.freeze(['teal', 'violet', 'amber', 'rose', 'blue', 'green', 'sky']);
export const PLACEMENTS = Object.freeze(['home']);
export const STATUSES = Object.freeze(['DRAFT', 'PUBLISHED', 'ARCHIVED']);
export const IMAGE_TYPES = Object.freeze(['image/jpeg', 'image/png', 'image/webp']);
export const MAX_IMAGE_BYTES = 1_200_000;
export const MAX_LIVE = 5;

/**
 * First path segment an in-app button may open. Mirrors mobile/app — anything else could land on
 * a stock "unmatched route" screen. The app checks the same list before navigating.
 */
export const ROUTE_ROOTS = Object.freeze([
  '(tabs)', 'assistant', 'cycle', 'nutrition', 'pets', 'medipulsi', 'run', 'medi-quest', 'community',
  'pharmacy', 'trainer', 'visits', 'lab', 'symptoms', 'health-metrics', 'medications', 'record',
  'profile', 'explore', 'weather', 'week', 'module', 'news',
]);

const ROUTE_RE = /^\/[A-Za-z0-9()_\-/]*(\?[A-Za-z0-9_\-=&%.]*)?$/;

export function isAllowedRoute(target) {
  const value = String(target || '').trim();
  if (!ROUTE_RE.test(value) || value.includes('//') || value.length > 200) return false;
  const root = value.slice(1).split(/[/?]/)[0];
  return ROUTE_ROOTS.includes(root);
}

export function isAllowedUrl(target) {
  const value = String(target || '').trim();
  if (value.length > 500) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch {
    return false;
  }
}

const text = (max) => z.string().trim().max(max);
const optionalDate = z.union([z.string().datetime({ offset: true }), z.null()]).optional();

export const audienceSchema = z.object({
  gender: z.enum(['ALL', 'FEMALE', 'MALE']).default('ALL'),
  platforms: z.array(z.enum(['ios', 'android'])).max(2).default([]),
}).strict();

export const announcementInput = z.object({
  status: z.enum(['DRAFT', 'PUBLISHED']).default('DRAFT'),
  placement: z.enum(PLACEMENTS).default('home'),
  title: text(80).min(2, 'სათაური სავალდებულოა.'),
  body: text(220).default(''),
  details: text(4000).default(''),
  badge: text(24).default(''),
  tone: z.enum(TONES).default('teal'),
  imageId: z.string().uuid().nullable().optional(),
  imageUrl: z.string().trim().max(500).nullable().optional(),
  ctaLabel: text(32).default(''),
  ctaKind: z.enum(['none', 'route', 'url']).default('none'),
  ctaTarget: text(500).default(''),
  audience: audienceSchema.default({ gender: 'ALL', platforms: [] }),
  priority: z.number().int().min(0).max(1000).default(100),
  dismissible: z.boolean().default(true),
  startsAt: optionalDate,
  endsAt: optionalDate,
}).strict();

const httpError = (message, status = 400) => Object.assign(new Error(message), { status });

/** Cross-field rules zod cannot express. Returns the normalized row values. */
export function normalizeAnnouncement(raw, previous = null) {
  const input = announcementInput.parse(raw);
  if (input.imageUrl && !isAllowedUrl(input.imageUrl)) throw httpError('სურათის ბმული უნდა იწყებოდეს https://-ით.');
  if (input.ctaKind === 'none') {
    input.ctaLabel = '';
    input.ctaTarget = '';
  } else {
    if (!input.ctaLabel) throw httpError('ღილაკს სახელი სჭირდება.');
    if (input.ctaKind === 'route' && !isAllowedRoute(input.ctaTarget)) {
      throw httpError('აპის გვერდი არასწორია. მაგალითად: /medipulsi, /nutrition, /medi-quest.');
    }
    if (input.ctaKind === 'url' && !isAllowedUrl(input.ctaTarget)) throw httpError('ბმული უნდა იწყებოდეს https://-ით.');
  }
  const startsAt = input.startsAt ? new Date(input.startsAt) : null;
  const endsAt = input.endsAt ? new Date(input.endsAt) : null;
  if (startsAt && endsAt && endsAt <= startsAt) throw httpError('დასრულება დაწყების შემდეგ უნდა იყოს.');
  const publishedAt = input.status === 'PUBLISHED' ? previous?.publishedAt || new Date() : previous?.publishedAt || null;
  return {
    ...input,
    imageId: input.imageId || null,
    imageUrl: input.imageId ? null : input.imageUrl || null,
    audience: { gender: input.audience.gender, platforms: [...new Set(input.audience.platforms)] },
    startsAt,
    endsAt,
    publishedAt,
  };
}

/** DRAFT / SCHEDULED / LIVE / ENDED / ARCHIVED — what the admin list shows. */
export function phaseOf(row, now = new Date()) {
  if (row.status === 'ARCHIVED') return 'ARCHIVED';
  if (row.status !== 'PUBLISHED') return 'DRAFT';
  if (row.startsAt && new Date(row.startsAt) > now) return 'SCHEDULED';
  if (row.endsAt && new Date(row.endsAt) <= now) return 'ENDED';
  return 'LIVE';
}

export function matchesAudience(audience, { gender, platform }) {
  const a = audience && typeof audience === 'object' ? audience : {};
  if (a.gender === 'FEMALE' && gender !== 'FEMALE') return false;
  if (a.gender === 'MALE' && gender !== 'MALE') return false;
  const platforms = Array.isArray(a.platforms) ? a.platforms : [];
  if (platforms.length && !platforms.includes(platform)) return false;
  return true;
}

export function imagePath(row) {
  if (row.imageId) return `/api/announcements/image/${row.imageId}`;
  return row.imageUrl || null;
}

/** The card as the app receives it — nothing about audience, authors or stats. */
export function publicCard(row) {
  return {
    id: row.id,
    placement: row.placement,
    title: row.title,
    body: row.body,
    details: row.details,
    badge: row.badge || null,
    tone: TONES.includes(row.tone) ? row.tone : 'teal',
    image: imagePath(row),
    cta: row.ctaKind !== 'none' && row.ctaLabel && row.ctaTarget
      ? { label: row.ctaLabel, kind: row.ctaKind, target: row.ctaTarget }
      : null,
    dismissible: row.dismissible !== false,
    publishedAt: row.publishedAt ? new Date(row.publishedAt).toISOString() : null,
    endsAt: row.endsAt ? new Date(row.endsAt).toISOString() : null,
  };
}

/* ───────── storage ───────── */

const SQL_URL = new URL('../../prisma/20260928-announcements.sql', import.meta.url);
let ensured = false;

export async function ensureAnnouncementTables(db = prisma) {
  if (ensured) return;
  const statements = readFileSync(SQL_URL, 'utf8').replace(/--[^\n]*/g, '').split(';').map((s) => s.trim()).filter(Boolean);
  for (const statement of statements) await db.$executeRawUnsafe(statement);
  ensured = true;
}

const COLUMNS = `"id", "status", "placement", "title", "body", "details", "badge", "tone", "imageId", "imageUrl",
  "ctaLabel", "ctaKind", "ctaTarget", "audience", "priority", "dismissible", "startsAt", "endsAt", "publishedAt",
  "createdBy", "updatedBy", "createdAt", "updatedAt"`;

/** Live cards for one person, best first. Never throws: Home must render without them. */
export async function liveCardsFor(user, { placement = 'home', platform = null, now = new Date(), db = prisma } = {}) {
  try {
    if (!(await isFeatureEnabled('news', db))) return [];
    await ensureAnnouncementTables(db);
    const rows = await db.$queryRawUnsafe(
      `SELECT ${COLUMNS} FROM "Announcement" a
        WHERE a."status" = 'PUBLISHED' AND a."placement" = $1
          AND (a."startsAt" IS NULL OR a."startsAt" <= $2)
          AND (a."endsAt" IS NULL OR a."endsAt" > $2)
          AND NOT EXISTS (SELECT 1 FROM "AnnouncementReceipt" r
                           WHERE r."announcementId" = a."id" AND r."userId" = $3 AND r."dismissedAt" IS NOT NULL)
        ORDER BY a."priority" ASC, a."publishedAt" DESC NULLS LAST
        LIMIT 40`,
      placement, now, user.id,
    );
    return rows
      .filter((row) => matchesAudience(row.audience, { gender: user.gender, platform }))
      .slice(0, MAX_LIVE)
      .map(publicCard);
  } catch (error) {
    console.warn('[announcements] live read failed', error?.message);
    return [];
  }
}

/** One published card for the details screen (a dismissed card still opens from a push). */
export async function publishedCard(id, user, { platform = null, now = new Date(), db = prisma } = {}) {
  if (!(await isFeatureEnabled('news', db))) return null;
  await ensureAnnouncementTables(db);
  const rows = await db.$queryRawUnsafe(`SELECT ${COLUMNS} FROM "Announcement" WHERE "id" = $1 AND "status" = 'PUBLISHED'`, id);
  const row = rows[0];
  if (!row || phaseOf(row, now) !== 'LIVE') return null;
  if (!matchesAudience(row.audience, { gender: user.gender, platform })) return null;
  return publicCard(row);
}

const EVENT_COLUMN = { view: 'seenAt', click: 'clickedAt', dismiss: 'dismissedAt' };

/** First view / first tap / dismissal. Idempotent: later repeats keep the first timestamp. */
export async function recordReceipt(announcementId, userId, type, { db = prisma } = {}) {
  const column = EVENT_COLUMN[type];
  if (!column) throw httpError('უცნობი მოვლენა.');
  await ensureAnnouncementTables(db);
  const exists = await db.$queryRawUnsafe(`SELECT 1 FROM "Announcement" WHERE "id" = $1 AND "status" = 'PUBLISHED'`, announcementId);
  if (!exists.length) return false;
  await db.$executeRawUnsafe(
    `INSERT INTO "AnnouncementReceipt" ("announcementId", "userId", "${column}") VALUES ($1, $2, NOW())
     ON CONFLICT ("announcementId", "userId") DO UPDATE SET "${column}" = COALESCE("AnnouncementReceipt"."${column}", NOW())`,
    announcementId, userId,
  );
  return true;
}

/* ───────── admin ───────── */

export async function listForAdmin({ includeArchived = false, now = new Date(), db = prisma } = {}) {
  await ensureAnnouncementTables(db);
  const rows = await db.$queryRawUnsafe(
    `SELECT ${COLUMNS.replace(/"([A-Za-z]+)"/g, 'a."$1"')},
            COUNT(r."seenAt")::int AS "views", COUNT(r."clickedAt")::int AS "clicks", COUNT(r."dismissedAt")::int AS "dismissals"
       FROM "Announcement" a LEFT JOIN "AnnouncementReceipt" r ON r."announcementId" = a."id"
      WHERE ($1 OR a."status" <> 'ARCHIVED')
      GROUP BY a."id"
      ORDER BY (a."status" = 'ARCHIVED') ASC, a."priority" ASC, a."updatedAt" DESC
      LIMIT 200`,
    includeArchived,
  );
  return rows.map((row) => ({
    ...row,
    image: imagePath(row),
    phase: phaseOf(row, now),
    stats: { views: row.views, clicks: row.clicks, dismissals: row.dismissals },
  }));
}

export async function getForAdmin(id, db = prisma) {
  await ensureAnnouncementTables(db);
  const rows = await db.$queryRawUnsafe(`SELECT ${COLUMNS} FROM "Announcement" WHERE "id" = $1`, id);
  return rows[0] || null;
}

export async function createAnnouncement(raw, { admin, db = prisma } = {}) {
  const v = normalizeAnnouncement(raw);
  await ensureAnnouncementTables(db);
  const id = randomUUID();
  await db.$executeRawUnsafe(
    `INSERT INTO "Announcement" ("id", "status", "placement", "title", "body", "details", "badge", "tone", "imageId", "imageUrl",
       "ctaLabel", "ctaKind", "ctaTarget", "audience", "priority", "dismissible", "startsAt", "endsAt", "publishedAt", "createdBy", "updatedBy")
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb, $15, $16, $17, $18, $19, $20, $20)`,
    id, v.status, v.placement, v.title, v.body, v.details, v.badge, v.tone, v.imageId, v.imageUrl,
    v.ctaLabel, v.ctaKind, v.ctaTarget, JSON.stringify(v.audience), v.priority, v.dismissible, v.startsAt, v.endsAt, v.publishedAt,
    admin?.email || null,
  );
  return getForAdmin(id, db);
}

export async function updateAnnouncement(id, raw, { admin, db = prisma } = {}) {
  const previous = await getForAdmin(id, db);
  if (!previous) throw httpError('სიახლე ვერ მოიძებნა.', 404);
  if (previous.status === 'ARCHIVED') throw httpError('არქივირებული სიახლე ჯერ აღადგინე.', 409);
  const v = normalizeAnnouncement(raw, previous);
  await db.$executeRawUnsafe(
    `UPDATE "Announcement" SET "status" = $2, "placement" = $3, "title" = $4, "body" = $5, "details" = $6, "badge" = $7, "tone" = $8,
       "imageId" = $9, "imageUrl" = $10, "ctaLabel" = $11, "ctaKind" = $12, "ctaTarget" = $13, "audience" = $14::jsonb,
       "priority" = $15, "dismissible" = $16, "startsAt" = $17, "endsAt" = $18, "publishedAt" = $19, "updatedBy" = $20, "updatedAt" = NOW()
     WHERE "id" = $1`,
    id, v.status, v.placement, v.title, v.body, v.details, v.badge, v.tone, v.imageId, v.imageUrl,
    v.ctaLabel, v.ctaKind, v.ctaTarget, JSON.stringify(v.audience), v.priority, v.dismissible, v.startsAt, v.endsAt, v.publishedAt,
    admin?.email || null,
  );
  return { previous, next: await getForAdmin(id, db) };
}

/** Archive hides the card everywhere and keeps its stats; restore brings it back as a draft. */
export async function setArchived(id, archived, { admin, db = prisma } = {}) {
  const previous = await getForAdmin(id, db);
  if (!previous) throw httpError('სიახლე ვერ მოიძებნა.', 404);
  await db.$executeRawUnsafe(
    `UPDATE "Announcement" SET "status" = $2, "updatedBy" = $3, "updatedAt" = NOW() WHERE "id" = $1`,
    id, archived ? 'ARCHIVED' : 'DRAFT', admin?.email || null,
  );
  return { previous, next: await getForAdmin(id, db) };
}

/** `data:image/jpeg;base64,…` from the admin page (already resized there) → stored image id. */
export function decodeImageDataUrl(dataUrl) {
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=\s]+)$/.exec(String(dataUrl || ''));
  if (!match) throw httpError('სურათი უნდა იყოს JPEG, PNG ან WebP.');
  const bytes = Buffer.from(match[2].replace(/\s/g, ''), 'base64');
  if (!bytes.length) throw httpError('სურათი ცარიელია.');
  if (bytes.length > MAX_IMAGE_BYTES) throw httpError('სურათი ძალიან დიდია (მაქს. 1.2 MB).', 413);
  const mime = match[1];
  const magicOk = (mime === 'image/jpeg' && bytes[0] === 0xff && bytes[1] === 0xd8)
    || (mime === 'image/png' && bytes.subarray(1, 4).toString('ascii') === 'PNG')
    || (mime === 'image/webp' && bytes.subarray(8, 12).toString('ascii') === 'WEBP');
  if (!magicOk) throw httpError('ფაილის შიგთავსი სურათს არ ემთხვევა.');
  return { mime, bytes };
}

export async function saveImage({ mime, bytes, width = null, height = null }, { admin, db = prisma } = {}) {
  await ensureAnnouncementTables(db);
  const id = randomUUID();
  await db.$executeRawUnsafe(
    `INSERT INTO "AnnouncementImage" ("id", "mime", "bytes", "size", "width", "height", "createdBy") VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    id, mime, bytes, bytes.length, width, height, admin?.email || null,
  );
  return { id, url: `/api/announcements/image/${id}` };
}

export async function readImage(id, db = prisma) {
  if (!/^[0-9a-f-]{36}$/i.test(String(id || ''))) return null;
  await ensureAnnouncementTables(db);
  const rows = await db.$queryRawUnsafe(`SELECT "mime", "bytes" FROM "AnnouncementImage" WHERE "id" = $1`, id);
  return rows[0] || null;
}

export function resetAnnouncementsForTests() {
  ensured = false;
}
