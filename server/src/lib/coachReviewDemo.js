/**
 * App Review demo trainer (docs/APP-REVIEW-2026-09-28-COACH.md). The review notes promise open
 * sessions to book, but slots seeded once go stale (the 2026-09-28 seed had expired by 2 Oct).
 * An hourly pass (job lease `coach-review-demo`) keeps at least three bookable open slots ahead by
 * rolling the demo trainer's expired, never-booked open slots forward; it adds rows only when there
 * are not enough old ones to move. It writes only TrainerSession rows of the one VERIFIED profile with
 * the review code whose account is a team @medicard.ge address — anything else is skipped.
 * `APP_REVIEW_TRAINER_CODE` overrides the code; `off` disables the pass.
 */
import { randomUUID } from 'node:crypto';
import { prisma } from './prisma.js';
import { withJobLease } from './jobLease.js';
import { normalizeCode } from './referral.js';
import { addDaysYmd, findConflict, tbilisiDayStart, tbilisiYmd } from './trainer.js';

export const REVIEW_DEMO_DEFAULT_CODE = 'QSPW7W';
export const REVIEW_DEMO_MIN_OPEN = 3;

const HOUR = 3600000;
const DAY = 24 * HOUR;
const SLOT_HOUR = 10; // Tbilisi time, like the original seed
const SLOT_MIN = 60;
const LEAD_MS = 3 * HOUR; // a slot starting sooner than this no longer counts as bookable for a reviewer
const HORIZON_DAYS = 14; // well inside the client's 21-day open-slot list
const KINDS = ['FUNCTIONAL', 'CARDIO', 'STRENGTH'];
const TEAM_EMAIL = /@medicard\.ge$/i;

export function reviewDemoCode(env = process.env) {
  const raw = String(env.APP_REVIEW_TRAINER_CODE ?? '').trim();
  if (raw.toLowerCase() === 'off') return null;
  return normalizeCode(raw || REVIEW_DEMO_DEFAULT_CODE) || null;
}

/**
 * Pure plan over the trainer's live sessions: which expired open slots move where and which new
 * slots to add, so that at least `min` open slots start later than now + 3 h. Candidates are 10:00
 * Tbilisi on today and the coming days, skipping any time that clashes with a live session.
 */
export function planReviewDemoSlots(sessions, now = new Date(), { min = REVIEW_DEMO_MIN_OPEN } = {}) {
  const at = (s) => new Date(s.startsAt).getTime();
  const cutoff = now.getTime() + LEAD_MS;
  const busy = sessions.filter((s) => ['SCHEDULED', 'OPEN'].includes(s.status));
  const fresh = busy.filter((s) => s.status === 'OPEN' && at(s) > cutoff).length;
  const movable = busy.filter((s) => s.status === 'OPEN' && !s.clientId && at(s) <= now.getTime()).sort((a, b) => at(a) - at(b));
  const moves = [];
  const inserts = [];
  const today = tbilisiYmd(now);
  for (let d = 0; d <= HORIZON_DAYS && fresh + moves.length + inserts.length < min; d += 1) {
    const startsAt = new Date(tbilisiDayStart(addDaysYmd(today, d)).getTime() + SLOT_HOUR * HOUR);
    const row = movable[0];
    const durationMin = row?.durationMin ?? SLOT_MIN;
    if (startsAt.getTime() <= cutoff || findConflict(busy, startsAt, durationMin)) continue;
    if (row) {
      movable.shift();
      moves.push({ id: row.id, startsAt });
    } else {
      inserts.push({ startsAt, kind: KINDS[(fresh + moves.length + inserts.length) % KINDS.length] });
    }
    busy.push({ id: row?.id ?? `new-${d}`, status: 'OPEN', startsAt, durationMin });
  }
  return { fresh, moves, inserts };
}

/** The demo trainer, only when the code belongs to a VERIFIED profile of an active team account. */
async function reviewDemoTrainer(code, db) {
  const [row] = await db.$queryRaw`SELECT t."userId", t."gymIds", u.email FROM "TrainerProfile" t JOIN "User" u ON u.id = t."userId"
    WHERE t.code = ${code} AND t.status = 'VERIFIED' AND u.status = 'ACTIVE'`;
  return row && TEAM_EMAIL.test(String(row.email ?? '')) ? row : null;
}

/** One pass. `dryRun` returns the plan without writing. */
export async function ensureReviewDemoSlots({ db = prisma, now = new Date(), code = reviewDemoCode(), dryRun = false } = {}) {
  if (!code) return { skipped: 'off' };
  const [probe] = await db.$queryRaw`SELECT to_regclass('"TrainerSession"') IS NOT NULL AS ok`;
  if (!probe?.ok) return { skipped: 'table' };
  const trainer = await reviewDemoTrainer(code, db);
  if (!trainer) return { skipped: 'no-demo-trainer' };
  const sessions = await db.$queryRaw`SELECT id, status, "clientId", "startsAt", "durationMin" FROM "TrainerSession"
    WHERE "trainerId" = ${trainer.userId} AND status IN ('SCHEDULED', 'OPEN') AND "startsAt" < ${new Date(now.getTime() + (HORIZON_DAYS + 2) * DAY)}
    ORDER BY "startsAt" LIMIT 500`;
  const plan = planReviewDemoSlots(sessions, now);
  if (dryRun) return { ...plan, dryRun: true };
  const gymId = Array.isArray(trainer.gymIds) ? trainer.gymIds[0] ?? null : null;
  let moved = 0;
  let created = 0;
  for (const m of plan.moves) {
    // Booking needs "startsAt" > now, so an expired slot cannot be booked while it moves.
    moved += await db.$executeRaw`UPDATE "TrainerSession" SET "startsAt" = ${m.startsAt}, reminded24 = false, reminded1 = false, "updatedAt" = CURRENT_TIMESTAMP
      WHERE id = ${m.id} AND "trainerId" = ${trainer.userId} AND status = 'OPEN' AND "clientId" IS NULL AND "startsAt" <= ${now}`;
  }
  for (const n of plan.inserts) {
    created += await db.$executeRaw`INSERT INTO "TrainerSession" (id, "trainerId", "gymId", "startsAt", "durationMin", kind, status)
      VALUES (${randomUUID()}, ${trainer.userId}, ${gymId}, ${n.startsAt}, ${SLOT_MIN}, ${n.kind}, 'OPEN')`;
  }
  if (moved || created) console.log(`[coach] review demo trainer: ${moved} open slot(s) moved forward, ${created} added`);
  return { fresh: plan.fresh, moved, created };
}

export function startReviewDemoSlots({ intervalMs = HOUR } = {}) {
  if (process.env.NODE_ENV === 'test' || !reviewDemoCode()) return null;
  const tick = () => withJobLease('coach-review-demo', intervalMs * 1.5, () => ensureReviewDemoSlots())
    .catch((e) => console.warn('[coach] review demo pass failed', e?.message));
  const timer = setInterval(tick, intervalMs);
  timer.unref?.();
  setTimeout(tick, 2 * 60 * 1000).unref?.();
  return timer;
}
