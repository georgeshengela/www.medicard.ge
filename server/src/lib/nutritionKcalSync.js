/**
 * HealthMetricDaily.nutritionKcal has two writers that mean different things:
 * 1. the phone's Apple Health / Health Connect read — the day's TOTAL, sent again on every read;
 * 2. a person's own entry (health card, Medi `metric_record`) — an ADDITION to the day.
 *
 * Until 2026-10-11 the sync route added every incoming value, so each later device read added the
 * whole day once more. Now a device total replaces only the device part and additions are kept
 * apart in "nutritionKcalAdded" (raw SQL; the Prisma field is @ignore), so
 * nutritionKcal = device total + additions and neither writer erases or repeats the other.
 *
 * Wire format: `nutritionKcalTotal` = device total (app 1.0.0.21.43+); `nutritionKcal` = addition
 * (manual entries of every build, Medi). Older apps send their device totals as `nutritionKcal`
 * too. Their device reads carry several days or step logs — a manual entry or Medi always sends
 * one day and no step logs — so such a request's `nutritionKcal` counts as a total.
 *
 * Without the column (before db:install, a failed read) everything fails open: additions count as
 * none, a device total simply replaces the value, and the sync itself never fails.
 */

/** True when this request is an older app's device read whose `nutritionKcal` values are day totals. */
export function legacyDeviceTotals({ daily = [], stepLogs = [] } = {}) {
  if (daily.some((row) => row?.nutritionKcalTotal != null)) return false;
  return daily.length > 1 || stepLogs.length > 0;
}

/** What one request row says about the day's calories: `{ total, addition }`, each a number or null. */
export function nutritionInput(row, legacyTotals = false) {
  const total = row?.nutritionKcalTotal ?? null;
  const value = row?.nutritionKcal ?? null;
  if (legacyTotals && total == null) return { total: value, addition: null };
  return { total, addition: value };
}

export function touchesNutrition(input) {
  return input.total != null || input.addition != null;
}

/**
 * Next stored values. `existingAdded` null = no additions known (legacy row or unreadable column):
 * the whole stored value is then treated as the device part.
 */
export function mergeNutritionKcal({ existingKcal = null, existingAdded = null, total = null, addition = null }) {
  const added = Math.max(0, Number(existingAdded) || 0);
  let nutritionKcal = existingKcal ?? null;
  let nutritionKcalAdded = existingAdded ?? null;
  if (total != null) nutritionKcal = total + added;
  if (addition != null) {
    nutritionKcal = (nutritionKcal ?? 0) + addition;
    nutritionKcalAdded = added + addition;
  }
  return { nutritionKcal, nutritionKcalAdded };
}

let warned = false;
function warnOnce(error) {
  if (warned) return;
  warned = true;
  console.warn('[health-sync] nutritionKcalAdded unavailable — device totals replace the whole value', error?.code || error?.message);
}

/** `{ known: true, value }` (value null = none) or `{ known: false, value: null }` when it cannot be read. */
export async function readNutritionAdded(db, userId, date) {
  try {
    const rows = await db.$queryRaw`SELECT "nutritionKcalAdded" FROM "HealthMetricDaily" WHERE "userId" = ${userId} AND "date" = ${date}`;
    const value = rows?.[0]?.nutritionKcalAdded;
    return { known: true, value: value == null ? null : Number(value) };
  } catch (error) {
    warnOnce(error);
    return { known: false, value: null };
  }
}

/** Stores the day's additions after its row was upserted. Never throws. */
export async function writeNutritionAdded(db, userId, date, value) {
  try {
    await db.$executeRaw`UPDATE "HealthMetricDaily" SET "nutritionKcalAdded" = ${value}::double precision WHERE "userId" = ${userId} AND "date" = ${date}`;
    return true;
  } catch (error) {
    warnOnce(error);
    return false;
  }
}
