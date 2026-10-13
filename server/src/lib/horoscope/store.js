// MEDIHOROSCOPE storage (raw SQL on the main DB; tables from prisma/20261013-horoscope.sql).
import { randomUUID } from 'node:crypto';
import { prisma } from '../prisma.js';
import { DEFAULT_MODELS, HOROSCOPE_MODELS } from './llm.js';

export const isHoroscopeSchemaMissing = (error) =>
  /Horoscope[A-Za-z]*"? does not exist|relation "Horoscope|42P01/.test(String(error?.message || error?.meta?.message || ''));

/** Reads fail soft before the install ran (the module then shows the sky without stored texts). */
async function soft(fn, fallback) {
  try {
    return await fn();
  } catch (error) {
    if (isHoroscopeSchemaMissing(error)) return fallback;
    throw error;
  }
}

// ── Config ──────────────────────────────────────────────────────────────

export const DEFAULT_CONFIG = Object.freeze({
  aiEnabled: true,
  writerModel: DEFAULT_MODELS.writer,
  editorModel: DEFAULT_MODELS.editor,
  englishModel: DEFAULT_MODELS.english,
  extraStyle: '',
  libraryAutoFill: true,
  homeCard: true,
  oracleEnabled: true,
  oracleDailyLimit: 30,
  oracleNameKa: 'ორაკული',
  oracleNameEn: 'Oracle',
});

/** Models for the writers from the admin settings (an unknown id falls back to the default). */
export function modelsFrom(config) {
  const pick = (v, d) => (HOROSCOPE_MODELS[v] || v === 'none' ? v : d);
  return {
    writer: pick(config.writerModel, DEFAULT_MODELS.writer),
    editor: pick(config.editorModel, DEFAULT_MODELS.editor),
    english: pick(config.englishModel, DEFAULT_MODELS.english),
  };
}

let configCache = { at: 0, value: null };

export async function readConfig(db = prisma) {
  if (configCache.value && Date.now() - configCache.at < 30_000) return configCache.value;
  const row = await soft(async () => (await db.$queryRaw`SELECT "data", "updatedAt", "updatedBy" FROM "HoroscopeConfig" WHERE "id" = 1`)[0], null);
  const value = { ...DEFAULT_CONFIG, ...(row?.data || {}), updatedAt: row?.updatedAt || null, updatedBy: row?.updatedBy || null };
  configCache = { at: Date.now(), value };
  return value;
}

export async function saveConfig(patch, adminId, db = prisma) {
  const current = await readConfig(db);
  const next = {};
  for (const key of Object.keys(DEFAULT_CONFIG)) next[key] = key in patch ? patch[key] : current[key];
  await db.$executeRaw`INSERT INTO "HoroscopeConfig" ("id", "data", "updatedBy", "updatedAt")
    VALUES (1, ${JSON.stringify(next)}::jsonb, ${adminId || null}, NOW())
    ON CONFLICT ("id") DO UPDATE SET "data" = EXCLUDED."data", "updatedBy" = EXCLUDED."updatedBy", "updatedAt" = NOW()`;
  configCache = { at: 0, value: null };
  return readConfig(db);
}

// ── Readings ────────────────────────────────────────────────────────────

export const readingId = (kind, periodKey, sign, source) => `${kind}:${periodKey}:${sign}:${source}`;

export async function getReading(kind, periodKey, sign, source = 'ai', db = prisma) {
  return soft(async () => (await db.$queryRaw`SELECT * FROM "HoroscopeReading"
    WHERE "id" = ${readingId(kind, periodKey, sign, source)}`)[0] || null, null);
}

export async function readingsFor(sign, periods, db = prisma) {
  const ids = [];
  for (const [kind, key] of periods) ids.push(readingId(kind, key, sign, 'ai'));
  return soft(() => db.$queryRaw`SELECT * FROM "HoroscopeReading" WHERE "id" = ANY(${ids}::text[])`, []);
}

export async function listReadings({ kind, periodKey, source = null }, db = prisma) {
  return soft(() => (source
    ? db.$queryRaw`SELECT * FROM "HoroscopeReading" WHERE "kind" = ${kind} AND "periodKey" = ${periodKey} AND "source" = ${source} ORDER BY "sign"`
    : db.$queryRaw`SELECT * FROM "HoroscopeReading" WHERE "kind" = ${kind} AND "periodKey" = ${periodKey} ORDER BY "sign", "source"`), []);
}

export async function existingReadingIds(ids, db = prisma) {
  const rows = await soft(() => db.$queryRaw`SELECT "id" FROM "HoroscopeReading" WHERE "id" = ANY(${ids}::text[])`, []);
  return new Set(rows.map((r) => r.id));
}

/**
 * Saves a reading. `replace` overwrites an existing row (admin „ხელახლა დაწერა“);
 * otherwise an existing row — including one the admin edited — is kept.
 */
export async function saveReading({ kind, periodKey, sign, source, body, sky = null, model = null, costUsd = null, replace = false }, db = prisma) {
  const id = readingId(kind, periodKey, sign, source);
  const bodyJson = JSON.stringify(body);
  const skyJson = sky ? JSON.stringify(sky) : null;
  if (replace) {
    await db.$executeRaw`INSERT INTO "HoroscopeReading" ("id", "kind", "periodKey", "sign", "source", "body", "sky", "model", "costUsd")
      VALUES (${id}, ${kind}, ${periodKey}, ${sign}, ${source}, ${bodyJson}::jsonb, ${skyJson}::jsonb, ${model}, ${costUsd})
      ON CONFLICT ("id") DO UPDATE SET "body" = EXCLUDED."body", "sky" = EXCLUDED."sky", "model" = EXCLUDED."model",
        "costUsd" = EXCLUDED."costUsd", "edited" = FALSE, "editedBy" = NULL, "status" = 'LIVE', "updatedAt" = NOW()`;
  } else {
    await db.$executeRaw`INSERT INTO "HoroscopeReading" ("id", "kind", "periodKey", "sign", "source", "body", "sky", "model", "costUsd")
      VALUES (${id}, ${kind}, ${periodKey}, ${sign}, ${source}, ${bodyJson}::jsonb, ${skyJson}::jsonb, ${model}, ${costUsd})
      ON CONFLICT ("id") DO NOTHING`;
  }
  return id;
}

export async function editReading(id, body, adminId, db = prisma) {
  const rows = await db.$queryRaw`UPDATE "HoroscopeReading" SET "body" = ${JSON.stringify(body)}::jsonb, "edited" = TRUE,
    "editedBy" = ${adminId || null}, "updatedAt" = NOW() WHERE "id" = ${id} RETURNING *`;
  return rows[0] || null;
}

export async function setReadingStatus(id, status, adminId, db = prisma) {
  const rows = await db.$queryRaw`UPDATE "HoroscopeReading" SET "status" = ${status}, "editedBy" = ${adminId || null},
    "updatedAt" = NOW() WHERE "id" = ${id} RETURNING *`;
  return rows[0] || null;
}

// ── Profile ─────────────────────────────────────────────────────────────

export async function readProfile(userId, db = prisma) {
  return soft(async () => (await db.$queryRaw`SELECT * FROM "HoroscopeProfile" WHERE "userId" = ${userId}`)[0] || null, null);
}

export async function saveProfile(userId, p, db = prisma) {
  const rows = await db.$queryRaw`INSERT INTO "HoroscopeProfile"
      ("userId", "birthTime", "placeName", "placeDetail", "lat", "lon", "tz", "showOnHome")
    VALUES (${userId}, ${p.birthTime}, ${p.placeName}, ${p.placeDetail}, ${p.lat}, ${p.lon}, ${p.tz}, ${p.showOnHome})
    ON CONFLICT ("userId") DO UPDATE SET "birthTime" = EXCLUDED."birthTime", "placeName" = EXCLUDED."placeName",
      "placeDetail" = EXCLUDED."placeDetail", "lat" = EXCLUDED."lat", "lon" = EXCLUDED."lon", "tz" = EXCLUDED."tz",
      "showOnHome" = EXCLUDED."showOnHome", "updatedAt" = NOW()
    RETURNING *`;
  return rows[0];
}

// ── Library ─────────────────────────────────────────────────────────────

/** { key → data } for one language; English falls back to Georgian when a key has no English row yet. */
export async function libraryEntries(keys, lang = 'ka', db = prisma) {
  if (!keys.length) return {};
  const rows = await soft(() => db.$queryRaw`SELECT "key", "lang", "data" FROM "HoroscopeLibrary"
    WHERE "key" = ANY(${keys}::text[]) AND "lang" = ANY(${[lang, 'ka']}::text[])`, []);
  const out = {};
  for (const r of rows) if (r.lang === lang || !out[r.key]) out[r.key] = r.data;
  return out;
}

export async function existingLibraryKeys(keys, db = prisma) {
  if (!keys.length) return new Set();
  const rows = await soft(() => db.$queryRaw`SELECT "key" FROM "HoroscopeLibrary"
    WHERE "key" = ANY(${keys}::text[]) GROUP BY "key" HAVING COUNT(DISTINCT "lang") = 2`, []);
  return new Set(rows.map((r) => r.key));
}

/** Writes one entry. An admin-edited entry is only replaced by another admin edit or with `force`. */
export async function saveLibraryEntry({ key, lang, data, source = 'ai', model = null, updatedBy = null, force = false }, db = prisma) {
  const json = JSON.stringify(data);
  if (source === 'admin' || force) {
    await db.$executeRaw`INSERT INTO "HoroscopeLibrary" ("key", "lang", "data", "source", "model", "updatedBy")
      VALUES (${key}, ${lang}, ${json}::jsonb, ${source}, ${model}, ${updatedBy})
      ON CONFLICT ("key", "lang") DO UPDATE SET "data" = EXCLUDED."data", "source" = EXCLUDED."source",
        "model" = EXCLUDED."model", "updatedBy" = EXCLUDED."updatedBy", "updatedAt" = NOW()`;
  } else {
    await db.$executeRaw`INSERT INTO "HoroscopeLibrary" ("key", "lang", "data", "source", "model", "updatedBy")
      VALUES (${key}, ${lang}, ${json}::jsonb, ${source}, ${model}, ${updatedBy})
      ON CONFLICT ("key", "lang") DO UPDATE SET "data" = EXCLUDED."data", "model" = EXCLUDED."model", "updatedAt" = NOW()
      WHERE "HoroscopeLibrary"."source" <> 'admin'`;
  }
}

export async function libraryCounts(db = prisma) {
  const rows = await soft(() => db.$queryRaw`SELECT split_part("key", ':', 1) AS "ns", COUNT(DISTINCT "key")::int AS "keys",
      COUNT(*) FILTER (WHERE "source" = 'admin')::int AS "edited"
    FROM "HoroscopeLibrary" GROUP BY 1`, []);
  return Object.fromEntries(rows.map((r) => [r.ns, { keys: r.keys, edited: r.edited }]));
}

export async function listLibrary({ prefix = '', q = '', limit = 50, offset = 0 }, db = prisma) {
  const like = `${prefix}%`;
  const needle = q ? `%${q}%` : null;
  return soft(() => (needle
    ? db.$queryRaw`SELECT "key", "lang", "data", "source", "updatedAt" FROM "HoroscopeLibrary"
        WHERE "key" LIKE ${like} AND ("key" ILIKE ${needle} OR "data"::text ILIKE ${needle})
        ORDER BY "key", "lang" LIMIT ${limit} OFFSET ${offset}`
    : db.$queryRaw`SELECT "key", "lang", "data", "source", "updatedAt" FROM "HoroscopeLibrary"
        WHERE "key" LIKE ${like} ORDER BY "key", "lang" LIMIT ${limit} OFFSET ${offset}`), []);
}

/** Dream dictionary search over the `dream:` entries of one language. */
export async function searchDreams(q, lang = 'ka', limit = 30, db = prisma) {
  const needle = `%${String(q || '').trim()}%`;
  return soft(() => db.$queryRaw`SELECT "key", "data" FROM "HoroscopeLibrary"
    WHERE "key" LIKE 'dream:%' AND "lang" = ${lang} AND ("data"->>'word' ILIKE ${needle} OR "data"->>'text' ILIKE ${needle})
    ORDER BY ("data"->>'word' ILIKE ${needle}) DESC, "data"->>'word' LIMIT ${limit}`, []);
}

export async function dreamLetters(lang = 'ka', db = prisma) {
  return soft(() => db.$queryRaw`SELECT "key", "data"->>'word' AS "word" FROM "HoroscopeLibrary"
    WHERE "key" LIKE 'dream:%' AND "lang" = ${lang} ORDER BY "data"->>'word'`, []);
}

// ── Runs ────────────────────────────────────────────────────────────────

export async function startRun(job, periodKey = null, db = prisma) {
  const id = randomUUID();
  await soft(() => db.$executeRaw`INSERT INTO "HoroscopeRun" ("id", "job", "periodKey", "status") VALUES (${id}, ${job}, ${periodKey}, 'RUNNING')`, null);
  return id;
}

export async function finishRun(id, { status = 'DONE', ok = 0, failed = 0, costUsd = null, detail = null }, db = prisma) {
  await soft(() => db.$executeRaw`UPDATE "HoroscopeRun" SET "status" = ${status}, "ok" = ${ok}, "failed" = ${failed},
    "costUsd" = ${costUsd}, "detail" = ${detail ? JSON.stringify(detail) : null}::jsonb, "finishedAt" = NOW() WHERE "id" = ${id}`, null);
}

export async function listRuns(limit = 40, db = prisma) {
  return soft(() => db.$queryRaw`SELECT * FROM "HoroscopeRun" ORDER BY "startedAt" DESC LIMIT ${limit}`, []);
}

export async function lastRun(job, periodKey, db = prisma) {
  return soft(async () => (await db.$queryRaw`SELECT * FROM "HoroscopeRun" WHERE "job" = ${job} AND "periodKey" = ${periodKey}
    ORDER BY "startedAt" DESC LIMIT 1`)[0] || null, null);
}

/** Marks runs left RUNNING by a crashed/redeployed instance. */
export async function closeStaleRuns(db = prisma) {
  await soft(() => db.$executeRaw`UPDATE "HoroscopeRun" SET "status" = 'FAILED', "finishedAt" = NOW(),
    "detail" = COALESCE("detail", '{}'::jsonb) || '{"error":"stale"}'::jsonb
    WHERE "status" = 'RUNNING' AND "startedAt" < NOW() - INTERVAL '45 minutes'`, null);
}

// ── Visits ──────────────────────────────────────────────────────────────

/** Best-effort usage mark: one row per person per Tbilisi day; never fails a request. */
export async function recordVisit(userId, day, section = 'hub', db = prisma) {
  try {
    await db.$executeRaw`INSERT INTO "HoroscopeVisit" ("userId", "day", "views", "sections", "lastAt")
      VALUES (${userId}, ${day}::date, 1, ARRAY[${section}]::text[], NOW())
      ON CONFLICT ("userId", "day") DO UPDATE SET "views" = "HoroscopeVisit"."views" + 1, "lastAt" = NOW(),
        "sections" = CASE WHEN ${section} = ANY("HoroscopeVisit"."sections") THEN "HoroscopeVisit"."sections"
          ELSE array_append("HoroscopeVisit"."sections", ${section}) END`;
  } catch { /* usage is optional */ }
}
