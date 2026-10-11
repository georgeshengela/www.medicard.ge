// MEDISLEEP storage (raw SQL on the tables of prisma/20261012-sleep.sql). Every user query is scoped by "userId".
// Reads fail soft before `npm run db:install` created the tables (empty answers, never a 500).
import { createHash, randomUUID } from 'node:crypto';
import { prisma } from './prisma.js';
import { getObject, objectStorageConfigured, putObject } from './objectStorage.js';
import { mergeNight, nightChanged, sleepError } from './sleep.js';
import { SLEEP_TIP_SEED, normalizeSleepConfig } from './sleepContent.js';

export const missingSleepTable = (error) => error?.code === 'P2021' || /does not exist|42P01/.test(String(error?.message || ''));

async function soft(run, fallback) {
  try {
    return await run();
  } catch (error) {
    if (missingSleepTable(error)) return fallback;
    throw error;
  }
}

// ------------------------------------------------------------------ plan

export async function readSleepPlan(userId, db = prisma) {
  return soft(async () => (await db.$queryRaw`SELECT * FROM "SleepPlan" WHERE "userId"=${userId}`)[0] || null, null);
}

export async function saveSleepPlan(userId, input, db = prisma) {
  const current = await readSleepPlan(userId, db);
  const p = {
    goalMinutes: input.goalMinutes,
    wakeTime: input.wakeTime,
    weekendWakeTime: input.weekendWakeTime ?? null,
    windDownMinutes: input.windDownMinutes ?? current?.windDownMinutes ?? 30,
    bedtimeReminder: input.bedtimeReminder ?? current?.bedtimeReminder ?? true,
    checkinReminder: input.checkinReminder ?? current?.checkinReminder ?? true,
    alarm: input.alarm ?? current?.alarm ?? false,
    hideScore: input.hideScore ?? current?.hideScore ?? false,
  };
  const [row] = await db.$queryRaw`
    INSERT INTO "SleepPlan" ("userId","goalMinutes","wakeTime","weekendWakeTime","windDownMinutes","bedtimeReminder","checkinReminder","alarm","hideScore")
    VALUES (${userId},${p.goalMinutes},${p.wakeTime},${p.weekendWakeTime},${p.windDownMinutes},${p.bedtimeReminder},${p.checkinReminder},${p.alarm},${p.hideScore})
    ON CONFLICT ("userId") DO UPDATE SET "goalMinutes"=EXCLUDED."goalMinutes","wakeTime"=EXCLUDED."wakeTime",
      "weekendWakeTime"=EXCLUDED."weekendWakeTime","windDownMinutes"=EXCLUDED."windDownMinutes",
      "bedtimeReminder"=EXCLUDED."bedtimeReminder","checkinReminder"=EXCLUDED."checkinReminder",
      "alarm"=EXCLUDED."alarm","hideScore"=EXCLUDED."hideScore","updatedAt"=NOW()
    RETURNING *`;
  return row;
}

// ------------------------------------------------------------------ nights

export async function listSleepNights(userId, { from, to } = {}, db = prisma) {
  return soft(async () => {
    if (from && to) return db.$queryRaw`SELECT * FROM "SleepNight" WHERE "userId"=${userId} AND "night">=${from}::date AND "night"<=${to}::date ORDER BY "night" ASC`;
    if (from) return db.$queryRaw`SELECT * FROM "SleepNight" WHERE "userId"=${userId} AND "night">=${from}::date ORDER BY "night" ASC`;
    return db.$queryRaw`SELECT * FROM "SleepNight" WHERE "userId"=${userId} ORDER BY "night" DESC LIMIT 400`;
  }, []);
}

async function writeNight(tx, userId, night, id, row) {
  const [saved] = await tx.$queryRaw`
    INSERT INTO "SleepNight" ("id","userId","night","bedAt","wakeAt","inBedMinutes","asleepMinutes","awakeMinutes",
      "deepMinutes","remMinutes","coreMinutes","latencyMinutes","wakeups","quality","factors","sounds","timesSource","checkedInAt")
    VALUES (${id},${userId},${night}::date,${row.bedAt},${row.wakeAt},${row.inBedMinutes},${row.asleepMinutes},${row.awakeMinutes},
      ${row.deepMinutes},${row.remMinutes},${row.coreMinutes},${row.latencyMinutes},${row.wakeups},${row.quality},
      ${row.factors}::text[],${row.sounds}::text[],${row.timesSource},${row.checkedInAt})
    ON CONFLICT ("userId","night") DO UPDATE SET "bedAt"=EXCLUDED."bedAt","wakeAt"=EXCLUDED."wakeAt",
      "inBedMinutes"=EXCLUDED."inBedMinutes","asleepMinutes"=EXCLUDED."asleepMinutes","awakeMinutes"=EXCLUDED."awakeMinutes",
      "deepMinutes"=EXCLUDED."deepMinutes","remMinutes"=EXCLUDED."remMinutes","coreMinutes"=EXCLUDED."coreMinutes",
      "latencyMinutes"=EXCLUDED."latencyMinutes","wakeups"=EXCLUDED."wakeups","quality"=EXCLUDED."quality",
      "factors"=EXCLUDED."factors","sounds"=EXCLUDED."sounds","timesSource"=EXCLUDED."timesSource",
      "checkedInAt"=EXCLUDED."checkedInAt","updatedAt"=NOW()
    RETURNING *`;
  return saved;
}

/** Merges one write into the night (row-locked), writes only when something changed. */
export async function upsertSleepNight(userId, night, input, { now = new Date() } = {}, db = prisma) {
  return db.$transaction(async (tx) => {
    const [existing] = await tx.$queryRaw`SELECT * FROM "SleepNight" WHERE "userId"=${userId} AND "night"=${night}::date FOR UPDATE`;
    const merged = mergeNight(existing || null, input, { now });
    if (existing && !nightChanged(existing, merged)) return { row: existing, changed: false };
    const row = await writeNight(tx, userId, night, existing?.id || input.id || randomUUID(), merged);
    return { row, changed: true };
  }, { maxWait: 10_000, timeout: 15_000 });
}

export async function deleteSleepNight(userId, night, db = prisma) {
  const count = await db.$executeRaw`DELETE FROM "SleepNight" WHERE "userId"=${userId} AND "night"=${night}::date`;
  return count > 0;
}

// ------------------------------------------------------------------ plays

export async function recordSleepPlays(userId, plays, db = prisma) {
  let saved = 0;
  for (const p of plays) {
    saved += await db.$executeRaw`
      INSERT INTO "SleepPlay" ("id","userId","soundIds","startedAt","minutes","timerMinutes","sleepMode")
      VALUES (${p.id},${userId},${p.soundIds}::text[],${new Date(p.startedAt)},${p.minutes},${p.timerMinutes ?? null},${!!p.sleepMode})
      ON CONFLICT ("id") DO UPDATE SET "minutes"=GREATEST("SleepPlay"."minutes",EXCLUDED."minutes")
      WHERE "SleepPlay"."userId"=${userId}`;
  }
  return saved;
}

// ------------------------------------------------------------------ catalogue

export async function listSleepSounds({ all = false } = {}, db = prisma) {
  return soft(async () => {
    const rows = all
      ? await db.$queryRaw`SELECT s.*, a."size" AS "audioSize", a."sha256" AS "audioSha", t."size" AS "tailSize", i."size" AS "artSize"
          FROM "SleepSound" s LEFT JOIN "SleepFile" a ON a."id"=s."audioFileId" LEFT JOIN "SleepFile" t ON t."id"=s."tailFileId"
          LEFT JOIN "SleepFile" i ON i."id"=s."artFileId" ORDER BY s."sortOrder" ASC, s."createdAt" ASC`
      : await db.$queryRaw`SELECT s.*, a."size" AS "audioSize", a."sha256" AS "audioSha", t."size" AS "tailSize", i."size" AS "artSize"
          FROM "SleepSound" s LEFT JOIN "SleepFile" a ON a."id"=s."audioFileId" LEFT JOIN "SleepFile" t ON t."id"=s."tailFileId"
          LEFT JOIN "SleepFile" i ON i."id"=s."artFileId" WHERE s."status"='LIVE' AND s."audioFileId" IS NOT NULL
          ORDER BY s."sortOrder" ASC, s."createdAt" ASC`;
    return rows;
  }, []);
}

export async function readSleepSound(id, db = prisma) {
  return soft(async () => (await db.$queryRaw`SELECT * FROM "SleepSound" WHERE "id"=${id}`)[0] || null, null);
}

export async function createSleepSound(input, db = prisma) {
  const [row] = await db.$queryRaw`
    INSERT INTO "SleepSound" ("id","category","titleKa","titleEn","subtitleKa","subtitleEn","tint","loop","featured","status","sortOrder")
    VALUES (${input.id},${input.category},${input.titleKa},${input.titleEn},${input.subtitleKa || ''},${input.subtitleEn || ''},
      ${input.tint || '#2B2452'},${input.loop ?? true},${input.featured ?? false},${input.status || 'DRAFT'},${input.sortOrder ?? 0})
    RETURNING *`;
  return row;
}

const SOUND_FIELDS = ['category', 'titleKa', 'titleEn', 'subtitleKa', 'subtitleEn', 'tint', 'loop', 'featured', 'status', 'sortOrder', 'audioFileId', 'tailFileId', 'artFileId', 'durationMs'];

export async function updateSleepSound(id, patch, db = prisma) {
  const current = await readSleepSound(id, db);
  if (!current) throw sleepError(404, 'ხმა ვერ მოიძებნა.', 'SLEEP_SOUND_NOT_FOUND', 'Sound not found.');
  const next = { ...current };
  for (const field of SOUND_FIELDS) if (patch[field] !== undefined) next[field] = patch[field];
  if (next.status === 'LIVE' && !next.audioFileId) {
    throw sleepError(400, 'გამოსაქვეყნებლად ჯერ ხმის ფაილი ატვირთე.', 'SLEEP_SOUND_NO_AUDIO', 'Upload the audio file before publishing.');
  }
  const [row] = await db.$queryRaw`
    UPDATE "SleepSound" SET "category"=${next.category},"titleKa"=${next.titleKa},"titleEn"=${next.titleEn},
      "subtitleKa"=${next.subtitleKa},"subtitleEn"=${next.subtitleEn},"tint"=${next.tint},"loop"=${next.loop},
      "featured"=${next.featured},"status"=${next.status},"sortOrder"=${next.sortOrder},"audioFileId"=${next.audioFileId},
      "tailFileId"=${next.tailFileId},"artFileId"=${next.artFileId},"durationMs"=${next.durationMs},"updatedAt"=NOW()
    WHERE "id"=${id} RETURNING *`;
  return { before: current, row };
}

// ------------------------------------------------------------------ files

/** Small per-instance cache so a page of art or a replayed sound does not read Postgres each time. */
const FILE_CACHE = new Map();
const FILE_CACHE_LIMIT = 80 * 1024 * 1024;
let fileCacheBytes = 0;

function cachePut(id, file) {
  if (file.size > 12 * 1024 * 1024) return;
  FILE_CACHE.set(id, file);
  fileCacheBytes += file.size;
  while (fileCacheBytes > FILE_CACHE_LIMIT && FILE_CACHE.size) {
    const [oldest, value] = FILE_CACHE.entries().next().value;
    FILE_CACHE.delete(oldest);
    fileCacheBytes -= value.size;
  }
}

export async function readSleepFile(id, db = prisma) {
  if (FILE_CACHE.has(id)) {
    const hit = FILE_CACHE.get(id);
    FILE_CACHE.delete(id);
    FILE_CACHE.set(id, hit);
    return hit;
  }
  const row = await soft(async () => (await db.$queryRaw`SELECT "id","kind","mime","bytes","storageKey","size","sha256" FROM "SleepFile" WHERE "id"=${id}`)[0] || null, null);
  if (!row) return null;
  let bytes = row.bytes ? Buffer.from(row.bytes) : null;
  if (!bytes && row.storageKey) {
    const res = await getObject(row.storageKey);
    if (!res) return null;
    bytes = Buffer.from(await res.arrayBuffer());
  }
  if (!bytes) return null;
  const file = { id: row.id, kind: row.kind, mime: row.mime, bytes, size: row.size, sha256: row.sha256 };
  cachePut(id, file);
  return file;
}

export async function saveSleepFile({ kind, mime, bytes, durationMs = null, createdBy = null }, db = prisma) {
  const id = randomUUID();
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  // R2 when configured (keeps megabytes of audio out of Postgres); the row keeps the key, size and hash.
  let storageKey = null;
  if (objectStorageConfigured()) {
    storageKey = `sleep/${id}`;
    await putObject(storageKey, bytes, mime);
  }
  await db.$executeRaw`
    INSERT INTO "SleepFile" ("id","kind","mime","bytes","storageKey","size","sha256","durationMs","createdBy")
    VALUES (${id},${kind},${mime},${storageKey ? null : bytes},${storageKey},${bytes.length},${sha256},${durationMs},${createdBy})`;
  return { id, sha256, size: bytes.length };
}

/** Audio types we accept, checked by their first bytes (never by the file name). */
export function sniffSleepFile(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 12) return null;
  if (bytes.toString('ascii', 4, 8) === 'ftyp') return { kind: 'audio', mime: 'audio/mp4' };
  if (bytes.toString('ascii', 0, 3) === 'ID3' || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0)) return { kind: 'audio', mime: 'audio/mpeg' };
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { kind: 'image', mime: 'image/jpeg' };
  if (bytes.toString('hex', 0, 8) === '89504e470d0a1a0a') return { kind: 'image', mime: 'image/png' };
  if (bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') return { kind: 'image', mime: 'image/webp' };
  return null;
}

// ------------------------------------------------------------------ tips + config

export async function listSleepTips({ all = false } = {}, db = prisma) {
  return soft(async () => (all
    ? db.$queryRaw`SELECT * FROM "SleepTip" ORDER BY "sortOrder" ASC, "createdAt" ASC`
    : db.$queryRaw`SELECT * FROM "SleepTip" WHERE "status"='LIVE' ORDER BY "sortOrder" ASC`), []);
}

export async function saveSleepTip(tip, db = prisma) {
  const [row] = await db.$queryRaw`
    INSERT INTO "SleepTip" ("id","trigger","titleKa","titleEn","bodyKa","bodyEn","status","sortOrder")
    VALUES (${tip.id},${tip.trigger},${tip.titleKa},${tip.titleEn},${tip.bodyKa},${tip.bodyEn},${tip.status},${tip.sortOrder})
    ON CONFLICT ("id") DO UPDATE SET "trigger"=EXCLUDED."trigger","titleKa"=EXCLUDED."titleKa","titleEn"=EXCLUDED."titleEn",
      "bodyKa"=EXCLUDED."bodyKa","bodyEn"=EXCLUDED."bodyEn","status"=EXCLUDED."status","sortOrder"=EXCLUDED."sortOrder","updatedAt"=NOW()
    RETURNING *`;
  return row;
}

/** Install-time seed: adds starter tips that are missing; never touches a tip the admin edited or archived. */
export async function seedSleepTips(db = prisma) {
  let added = 0;
  for (const tip of SLEEP_TIP_SEED) {
    added += await db.$executeRaw`
      INSERT INTO "SleepTip" ("id","trigger","titleKa","titleEn","bodyKa","bodyEn","status","sortOrder")
      VALUES (${tip.id},${tip.trigger},${tip.titleKa},${tip.titleEn},${tip.bodyKa},${tip.bodyEn},${tip.status},${tip.sortOrder})
      ON CONFLICT ("id") DO NOTHING`;
  }
  return added;
}

let configCache = null;
export async function readSleepConfig(db = prisma) {
  if (configCache && configCache.at > Date.now() - 10_000) return configCache.value;
  const row = await soft(async () => (await db.$queryRaw`SELECT "data" FROM "SleepConfig" WHERE "id"='default'`)[0] || null, null);
  const value = normalizeSleepConfig(row?.data);
  configCache = { at: Date.now(), value };
  return value;
}

export async function saveSleepConfig(data, db = prisma) {
  const value = normalizeSleepConfig(data);
  await db.$executeRaw`INSERT INTO "SleepConfig" ("id","data") VALUES ('default',${JSON.stringify(value)}::jsonb)
    ON CONFLICT ("id") DO UPDATE SET "data"=EXCLUDED."data","updatedAt"=NOW()`;
  configCache = null;
  return value;
}

// ------------------------------------------------------------------ context for analytics

/** Steps per calendar day (HealthMetricDaily), for the „active day → better night?“ comparison. */
export async function stepsByDay(userId, from, db = prisma) {
  const rows = await soft(() => db.healthMetricDaily.findMany({ where: { userId, date: { gte: from } }, select: { date: true, steps: true } }), []);
  return Object.fromEntries(rows.filter((r) => Number.isFinite(r.steps)).map((r) => [r.date, r.steps]));
}
