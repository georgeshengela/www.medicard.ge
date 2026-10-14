/**
 * MEDICARD's place in the App Store top charts (owner 2026-10-14: „ჩვენ კატეგორიაში საქართველოში რომელ ადგილზე
 * ვართ“ — shown on the admin home's „ახლა აპში“ card, a tap opens Apple's chart). Apple's public chart feeds
 * (iTunes RSS: top 100 free iPhone apps in Georgia, our category and overall) are read once an hour by the lease
 * holder and on demand for admin; each read is kept in "AppStoreRankSample" so the card can say how the place moved
 * since yesterday. Public chart data only — nothing about people.
 *
 * Raw SQL (install-app-store-rank.mjs in db:install; also created lazily).
 */
import { prisma } from './prisma.js';
import { withJobLease } from './jobLease.js';

export const APP_STORE_ID = '6812517519'; // mobile/eas.json ascAppId
export const APP_STORE_COUNTRY = 'ge';
const DEFAULT_GENRE = 6013; // Health & Fitness — the category App Store Connect lists for MEDICARD AI
const GENRES = {
  6013: { ka: 'ჯანმრთელობა და ფიტნესი', slug: 'health-fitness-apps' },
  6020: { ka: 'მედიცინა', slug: 'medical-apps' },
  6012: { ka: 'ცხოვრების სტილი', slug: 'lifestyle-apps' },
};

const HOUR = 60 * 60 * 1000;
const MEMO_MS = 20 * 60 * 1000;
const SAMPLE_GAP_MS = 50 * 60 * 1000; // one sample per hour, whoever reads first (job or admin)
const KEEP_DAYS = 400;

export const APP_STORE_RANK_SQL = `CREATE TABLE IF NOT EXISTS "AppStoreRankSample" (
  "country" TEXT NOT NULL,
  "genreId" INTEGER NOT NULL,
  "at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "rank" INTEGER,
  "overallRank" INTEGER,
  "chartUpdatedAt" TIMESTAMPTZ,
  PRIMARY KEY ("country", "genreId", "at")
)`;

let ensured = false;
async function ensureTable(db) {
  if (ensured) return;
  await db.$executeRawUnsafe(APP_STORE_RANK_SQL);
  ensured = true;
}

/** Apple's chart page for a category (or the app's own page when the category has no known chart slug). */
export function chartUrl(genreId, country = APP_STORE_COUNTRY, appId = APP_STORE_ID) {
  const slug = GENRES[genreId]?.slug;
  return slug
    ? `https://apps.apple.com/${country}/charts/iphone/${slug}/${genreId}?chart=top-free`
    : `https://apps.apple.com/${country}/app/id${appId}`;
}

/** Our place in one iTunes RSS chart feed: 1-based rank (null = not in the list), its size, the app just ahead. */
export function rankIn(feed, appId = APP_STORE_ID) {
  const raw = feed?.feed?.entry;
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const at = list.findIndex((entry) => entry?.id?.attributes?.['im:id'] === appId);
  const updated = Date.parse(feed?.feed?.updated?.label || '');
  return {
    rank: at < 0 ? null : at + 1,
    size: list.length,
    ahead: at > 0 ? list[at - 1]?.['im:name']?.label || null : null,
    updatedAt: Number.isFinite(updated) ? new Date(updated).toISOString() : null,
  };
}

async function getJson(url, fetchImpl) {
  const res = await fetchImpl(url, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`App Store ${res.status}`);
  return res.json();
}

/** Reads the live charts: the app's category (from Apple's lookup), our place there and in the overall top free. */
export async function readAppStoreCharts({ fetchImpl = globalThis.fetch, appId = APP_STORE_ID, country = APP_STORE_COUNTRY } = {}) {
  const lookup = await getJson(`https://itunes.apple.com/lookup?id=${appId}&country=${country}`, fetchImpl).catch(() => null);
  const app = lookup?.results?.[0];
  const genreId = Number(app?.primaryGenreId) || DEFAULT_GENRE;
  const [category, overall] = await Promise.all([
    getJson(`https://itunes.apple.com/${country}/rss/topfreeapplications/limit=100/genre=${genreId}/json`, fetchImpl),
    getJson(`https://itunes.apple.com/${country}/rss/topfreeapplications/limit=100/json`, fetchImpl).catch(() => null),
  ]);
  const inCategory = rankIn(category, appId);
  const inOverall = overall ? rankIn(overall, appId) : { rank: null, size: 0 };
  return {
    country,
    genreId,
    genre: GENRES[genreId]?.ka || app?.primaryGenreName || '',
    rank: inCategory.rank,
    size: inCategory.size,
    ahead: inCategory.ahead,
    overallRank: inOverall.rank,
    overallSize: inOverall.size,
    chartUpdatedAt: inCategory.updatedAt,
    chartUrl: chartUrl(genreId, country, appId),
  };
}

const tbilisiDay = (date) => new Date(date).toLocaleDateString('en-CA', { timeZone: 'Asia/Tbilisi' });

/**
 * How the place moved. `delta` > 0 = climbed (a smaller number). Yesterday = the last sample at least 23 h old
 * (and at most 2 days). `series` = the best place of each Tbilisi day, oldest first (null = outside the list).
 */
export function summarizeRank(current, samples, now = new Date()) {
  const rows = (samples || [])
    .map((s) => ({ at: new Date(s.at), rank: s.rank == null ? null : Number(s.rank) }))
    .filter((s) => Number.isFinite(s.at.getTime()))
    .sort((a, b) => a.at - b.at);
  const t = now.getTime();
  const lastBefore = (ms, within) => {
    const found = rows.filter((s) => s.at.getTime() <= t - ms && s.at.getTime() >= t - within).pop();
    return found ? { rank: found.rank, at: found.at.toISOString() } : null;
  };
  const yesterday = lastBefore(23 * HOUR, 48 * HOUR);
  const weekAgo = lastBefore(7 * 24 * HOUR - HOUR, 9 * 24 * HOUR);
  const ranked = rows.filter((s) => s.rank != null);
  const bestRow = ranked.reduce((best, s) => (!best || s.rank < best.rank ? s : best), null);
  const days = new Map();
  for (const s of rows) {
    const day = tbilisiDay(s.at);
    const prev = days.get(day);
    if (prev === undefined || (s.rank != null && (prev == null || s.rank < prev))) days.set(day, s.rank);
  }
  const rank = current?.rank ?? null;
  let delta = null;
  if (yesterday) {
    if (rank != null && yesterday.rank != null) delta = yesterday.rank - rank;
    else if (rank != null) delta = 'entered';
    else if (yesterday.rank != null) delta = 'left';
  }
  return {
    yesterday,
    weekAgo,
    best: bestRow ? { rank: bestRow.rank, at: bestRow.at.toISOString() } : null,
    delta,
    series: [...days].slice(-14).map(([day, r]) => ({ day, rank: r })),
  };
}

async function lastSample(db, country, genreId) {
  const rows = await db.$queryRaw`SELECT "at", "rank", "overallRank", "chartUpdatedAt" FROM "AppStoreRankSample"
    WHERE "country" = ${country} AND "genreId" = ${genreId} ORDER BY "at" DESC LIMIT 1`;
  return rows[0] || null;
}

/** Keeps one sample per hour (the job and admin reads share the gap) and drops rows older than 400 days. */
export async function recordAppStoreRank(snapshot, { db = prisma, now = new Date() } = {}) {
  await ensureTable(db);
  const last = await lastSample(db, snapshot.country, snapshot.genreId);
  if (last && now.getTime() - new Date(last.at).getTime() < SAMPLE_GAP_MS) return false;
  await db.$executeRaw`INSERT INTO "AppStoreRankSample" ("country", "genreId", "at", "rank", "overallRank", "chartUpdatedAt")
    VALUES (${snapshot.country}, ${snapshot.genreId}, ${now}, ${snapshot.rank}::int, ${snapshot.overallRank}::int,
      ${snapshot.chartUpdatedAt ? new Date(snapshot.chartUpdatedAt) : null}::timestamptz)
    ON CONFLICT DO NOTHING`;
  await db.$executeRaw`DELETE FROM "AppStoreRankSample" WHERE "at" < ${new Date(now.getTime() - KEEP_DAYS * 24 * HOUR)}`;
  return true;
}

async function loadSamples(db, country, genreId, now) {
  await ensureTable(db);
  return db.$queryRaw`SELECT "at", "rank" FROM "AppStoreRankSample"
    WHERE "country" = ${country} AND "genreId" = ${genreId} AND "at" >= ${new Date(now.getTime() - 15 * 24 * HOUR)}
    ORDER BY "at"`;
}

let memo = { at: 0, data: null, pending: null };

/**
 * The admin card's payload: the live place (cached 20 min), how it moved, and the last stored place when Apple
 * cannot be reached (`stale`). Never throws — `{ error }` only when there is nothing at all to show.
 */
export async function getAppStoreRank({ fresh = false, db = prisma, fetchImpl = globalThis.fetch, now = () => new Date() } = {}) {
  if (!fresh && memo.data && Date.now() - memo.at < MEMO_MS) return memo.data;
  if (memo.pending) return memo.pending;
  memo.pending = (async () => {
    const at = now();
    let current = null;
    let liveError = null;
    try {
      current = await readAppStoreCharts({ fetchImpl });
      await recordAppStoreRank(current, { db, now: at }).catch((error) => console.warn('[app-store-rank] not stored', error?.message));
    } catch (error) {
      liveError = error;
      console.warn('[app-store-rank] chart read failed', error?.message);
    }
    const genreId = current?.genreId ?? DEFAULT_GENRE;
    const samples = await loadSamples(db, APP_STORE_COUNTRY, genreId, at).catch(() => []);
    if (!current) {
      const last = samples[samples.length - 1];
      if (!last) return { error: 'App Store-ის ჩარტი ვერ ჩაიტვირთა.' };
      current = {
        country: APP_STORE_COUNTRY, genreId, genre: GENRES[genreId]?.ka || '', rank: last.rank, size: 100,
        ahead: null, overallRank: null, overallSize: 0, chartUpdatedAt: null, chartUrl: chartUrl(genreId),
      };
    }
    const data = { ...current, ...summarizeRank(current, samples, at), fetchedAt: at.toISOString(), stale: Boolean(liveError) };
    memo = { at: Date.now(), data, pending: null };
    return data;
  })().finally(() => {
    memo.pending = null;
  });
  return memo.pending;
}

let timer = null;
/** Production: one chart read an hour on the lease holder, so „vs yesterday“ has a sample even when nobody looks. */
export function startAppStoreRankMonitor() {
  if (timer) return;
  const tick = () => withJobLease('app-store-rank', 2 * HOUR, () => getAppStoreRank({ fresh: true }))
    .catch((error) => console.warn('[app-store-rank] tick failed', error?.message));
  setTimeout(tick, 60_000).unref?.();
  timer = setInterval(tick, HOUR);
  timer.unref?.();
}

export function stopAppStoreRankMonitor() {
  if (timer) clearInterval(timer);
  timer = null;
}

export function resetAppStoreRankMemoForTests() {
  memo = { at: 0, data: null, pending: null };
  ensured = false;
}
