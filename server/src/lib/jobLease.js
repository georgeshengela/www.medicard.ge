import { randomUUID } from 'node:crypto';
import { hostname } from 'node:os';
import { prisma } from './prisma.js';

/**
 * Cross-instance leader lease for in-process background jobs (table "JobLease",
 * prisma/20260927-job-lease.sql). The holder keeps renewing on every tick; another
 * instance takes over only after the lease expires (crash, or the old instance of a deploy exiting).
 */
export const LEASE_HOLDER = `${hostname()}:${process.pid}:${randomUUID().slice(0, 8)}`;

const isMissingTable = (error) => /JobLease|42P01|does not exist/.test(String(error?.message || error?.meta?.message || ''));
let warnedMissing = false;

export async function acquireJobLease(name, ttlMs, { db = prisma, holder = LEASE_HOLDER } = {}) {
  try {
    const rows = await db.$queryRaw`INSERT INTO "JobLease" (name, holder, "expiresAt")
      VALUES (${name}, ${holder}, NOW() + (${Math.round(ttlMs)}::int * INTERVAL '1 millisecond'))
      ON CONFLICT (name) DO UPDATE SET holder = EXCLUDED.holder, "expiresAt" = EXCLUDED."expiresAt"
      WHERE "JobLease"."expiresAt" < NOW() OR "JobLease".holder = EXCLUDED.holder
      RETURNING holder`;
    return rows.length > 0;
  } catch (error) {
    // Release installs the table before start; if it is somehow missing, behave like the old single instance.
    if (isMissingTable(error)) {
      if (!warnedMissing) console.warn('[job-lease] JobLease table missing — running jobs without a lease');
      warnedMissing = true;
      return true;
    }
    throw error;
  }
}

/** Runs `fn` only when this instance holds (or just took) the lease `name`. */
export async function withJobLease(name, ttlMs, fn, options) {
  if (!(await acquireJobLease(name, ttlMs, options))) return { skipped: 'lease' };
  return fn();
}
