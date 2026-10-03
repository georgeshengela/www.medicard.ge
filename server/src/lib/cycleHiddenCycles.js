/**
 * „ამ ციკლის დამალვა“ — Clue's „Hide this cycle“ (brief §9 „მერე“ item 6).
 *
 * A person can leave an atypical cycle (illness, travel, an emergency pill, a miscarriage — the app
 * never asks why) out of every average and forecast. Stored as the cycle's start date (YYYY-MM-DD) in
 * `CycleProfile."hiddenCycles"` (JSONB array), added by prisma/20261004-cycle-hidden-cycles.sql
 * (install-cycle-hidden-cycles.mjs in `db:install`). The Prisma field is @ignore, so reads and writes are
 * raw SQL here and a database without the column serves the bundle as if nothing were hidden.
 *
 * What a hidden cycle changes (all through `inferCycleStats(…, { hiddenStarts })`): averages, cycle-length
 * spread / confidence / next-period window, the 3-cycle fertility gate (a hidden cycle does NOT count as
 * one of the 3 — it was atypical, so it cannot vouch for her rhythm), stats verdicts, trends, recurring
 * patterns, deviations, the doctor report statistics, the AI context and the partner's estimate. What it
 * does not change: the logged period days (calendar, history, last-period anchor).
 */

export const MAX_HIDDEN_CYCLES = 24;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

let warned = false;

/** Sorted, de-duplicated civil dates from whatever is stored (bad entries dropped). */
export function normalizeHiddenCycles(raw) {
  let value = raw;
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      value = [];
    }
  }
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(String).filter((d) => DATE_RE.test(d)))].sort();
}

/** Stored hidden starts for one account; [] when the row or the column is missing. */
export async function readCycleHiddenCycles(db, userId) {
  try {
    const rows = await db.$queryRaw`SELECT "hiddenCycles" FROM "CycleProfile" WHERE "userId" = ${userId} LIMIT 1`;
    return normalizeHiddenCycles(Array.isArray(rows) ? rows[0]?.hiddenCycles : null);
  } catch (err) {
    if (!warned) {
      warned = true;
      console.warn('[cycle] hidden cycles unavailable, nothing hidden:', err?.message || err);
    }
    return [];
  }
}

function badRequest(ka, en) {
  const err = new Error(ka);
  err.messageEn = en;
  err.status = 400;
  return err;
}

/**
 * Validate a requested list against her logged cycle starts. A date that is not a logged start is
 * refused — unless it was already stored (the period was edited away since): such stale dates are
 * dropped quietly so the one-tap toggle never fails on history she changed.
 */
export function planHiddenCyclesUpdate({ requested, stored = [], periodStarts = [] } = {}) {
  const real = new Set((periodStarts || []).filter(Boolean));
  const before = new Set(normalizeHiddenCycles(stored));
  const list = [];
  for (const raw of Array.isArray(requested) ? requested : []) {
    const date = String(raw);
    if (!DATE_RE.test(date)) {
      throw badRequest('თარიღის ფორმატი არასწორია.', 'The date format is not valid.');
    }
    if (real.has(date)) {
      if (!list.includes(date)) list.push(date);
      continue;
    }
    if (before.has(date)) continue;
    throw badRequest(
      'ამ თარიღით აღრიცხული ციკლი ვერ ვიპოვეთ.',
      'No logged cycle starts on this date.',
    );
  }
  if (list.length > MAX_HIDDEN_CYCLES) {
    throw badRequest(
      `საშუალოდან მაქსიმუმ ${MAX_HIDDEN_CYCLES} ციკლის დამალვაა შესაძლებელი.`,
      `You can hide up to ${MAX_HIDDEN_CYCLES} cycles from your averages.`,
    );
  }
  return list.sort();
}

/** Replace the stored list. Throws a 503 with a bilingual message when the column is not installed. */
export async function writeCycleHiddenCycles(db, userId, list) {
  if (!Array.isArray(list)) return;
  const json = JSON.stringify(normalizeHiddenCycles(list));
  try {
    await db.$executeRaw`UPDATE "CycleProfile" SET "hiddenCycles" = ${json}::jsonb WHERE "userId" = ${userId}`;
  } catch (cause) {
    console.error('[cycle] hidden cycles write failed', cause?.message || cause);
    const err = new Error('ეს ცვლილება ჯერ ვერ შეინახა. სცადე ცოტა ხანში.');
    err.messageEn = 'This change could not be saved yet. Try again shortly.';
    err.status = 503;
    throw err;
  }
}
