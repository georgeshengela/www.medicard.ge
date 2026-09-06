/**
 * Hydration domain merge — Quest reads HealthMetricDaily.hydrationMl only.
 *
 * Two writers:
 * 1. daily[].hydrationMl  → snapshot MAX (native Health totals). Retries cannot double.
 * 2. hydrationEvents[]    → unique (userId, clientEventId). Sum is authoritative
 *    for that date once any in-app event exists.
 *
 * In-app logs therefore never double on network/app retry.
 * Native snapshots never add on top of themselves.
 */
export const HYDRATION_ML_CAP = 20_000;

export function clampHydrationMl(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(HYDRATION_ML_CAP, Math.round(n)));
}

/** Native / absolute snapshots: never add, never double a retry. */
export function mergeHydrationSnapshot(existingMl, incomingMl) {
  if (incomingMl == null) return existingMl ?? null;
  const incoming = clampHydrationMl(incomingMl);
  if (existingMl == null) return incoming;
  return Math.max(clampHydrationMl(existingMl), incoming);
}

export function sanitizeHydrationEvent(row) {
  const clientEventId = String(row?.clientEventId || '').trim();
  const date = String(row?.date || '');
  const deltaMl = Math.round(Number(row?.deltaMl));
  if (!clientEventId || clientEventId.length > 80) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  if (!Number.isFinite(deltaMl) || deltaMl === 0) return null;
  if (Math.abs(deltaMl) > HYDRATION_ML_CAP) return null;
  return { clientEventId, date, deltaMl };
}

function isUniqueViolation(error) {
  return error?.code === 'P2002';
}

export async function applyHydrationEvents(db, userId, events = []) {
  const sanitized = events.map(sanitizeHydrationEvent).filter(Boolean);
  const dates = new Set();
  let inserted = 0;
  let duplicates = 0;

  for (const event of sanitized) {
    dates.add(event.date);
    if (typeof db.hydrationIntakeEvent?.create !== 'function') continue;
    try {
      await db.hydrationIntakeEvent.create({
        data: {
          userId,
          clientEventId: event.clientEventId,
          date: event.date,
          deltaMl: event.deltaMl,
        },
      });
      inserted += 1;
    } catch (error) {
      if (isUniqueViolation(error)) {
        duplicates += 1;
        continue;
      }
      throw error;
    }
  }

  const totals = new Map();
  if (typeof db.hydrationIntakeEvent?.findMany === 'function') {
    for (const date of dates) {
      const rows = await db.hydrationIntakeEvent.findMany({ where: { userId, date } });
      const sum = rows.reduce((acc, row) => acc + (Number(row.deltaMl) || 0), 0);
      totals.set(date, clampHydrationMl(sum));
    }
  }

  return { inserted, duplicates, totals };
}
