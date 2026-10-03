/**
 * Storage of the two cycle preferences of brief §9 wave 2 item 17 — „მენსტრუაციას არ ველი“
 * (`expectsBleeding`) and „ნაყოფიერი დღეების ჩვენება“ (`fertilityDisplay`).
 *
 * Columns on "CycleProfile" added by prisma/20261003-cycle-tracking.sql (install-cycle-tracking.mjs in
 * `db:install`). The Prisma fields are @ignore, so every read/write is raw SQL here and a database that
 * has not run the install yet still serves the bundle with the defaults (today's behaviour).
 */
import { normalizeCycleTrackingPrefs } from './cycleModeCapabilityMatrix.js';

let warned = false;

/** `{ expectsBleeding, fertilityDisplay }` for one account; defaults when the row/columns are missing. */
export async function readCycleTrackingPrefs(db, userId) {
  try {
    const rows = await db.$queryRaw`SELECT "expectsBleeding", "fertilityDisplay" FROM "CycleProfile" WHERE "userId" = ${userId} LIMIT 1`;
    return normalizeCycleTrackingPrefs(Array.isArray(rows) ? rows[0] : null);
  } catch (err) {
    if (!warned) {
      warned = true;
      console.warn('[cycle] tracking preferences unavailable, using defaults:', err?.message || err);
    }
    return normalizeCycleTrackingPrefs(null);
  }
}

/** The part of a validated profile body that touches these preferences, or null. */
export function cycleTrackingPatch(body) {
  const patch = {};
  if (typeof body?.expectsBleeding === 'boolean') patch.expectsBleeding = body.expectsBleeding;
  if (body?.fertilityDisplay === 'auto' || body?.fertilityDisplay === 'off') patch.fertilityDisplay = body.fertilityDisplay;
  return Object.keys(patch).length ? patch : null;
}

/** Write the given fields (others untouched). Throws a 503 with a bilingual message when not installed. */
export async function writeCycleTrackingPrefs(db, userId, patch) {
  if (!patch) return;
  const expectsBleeding = typeof patch.expectsBleeding === 'boolean' ? patch.expectsBleeding : null;
  const fertilityDisplay = patch.fertilityDisplay === 'auto' || patch.fertilityDisplay === 'off' ? patch.fertilityDisplay : null;
  try {
    await db.$executeRaw`UPDATE "CycleProfile" SET "expectsBleeding" = COALESCE(${expectsBleeding}::boolean, "expectsBleeding"), "fertilityDisplay" = COALESCE(${fertilityDisplay}::text, "fertilityDisplay") WHERE "userId" = ${userId}`;
  } catch (cause) {
    console.error('[cycle] tracking preferences write failed', cause?.message || cause);
    const err = new Error('ეს პარამეტრი ჯერ ვერ შეინახა. სცადე ცოტა ხანში.');
    err.messageEn = 'This setting could not be saved yet. Try again shortly.';
    err.status = 503;
    throw err;
  }
}
