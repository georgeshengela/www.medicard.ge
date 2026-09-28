/**
 * MEDI COACH safety (App Review 1.2, 2026-09-28): people can report the other side of a coach
 * relationship and block it. Reports reach the owner (admin #/trainers + Director Telegram);
 * a client's block ends the link and stops the trainer from inviting again. Additive raw-SQL
 * tables, created lazily. Report text is stored for moderation only.
 */
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { prisma } from './prisma.js';
import { coachError } from './trainer.js';

export const REPORT_REASONS = Object.freeze({
  harassment: 'შეურაცხყოფა ან შევიწროება',
  inappropriate: 'შეუფერებელი შინაარსი ან ფოტო',
  unsafe: 'სახიფათო ან არაპროფესიული რჩევა',
  spam: 'სპამი ან რეკლამა',
  impersonation: 'ყალბი პროფილი ან სერტიფიკატი',
  other: 'სხვა',
});

export const reportSchema = z.object({
  subjectId: z.string().trim().min(1).max(80),
  reason: z.enum(Object.keys(REPORT_REASONS)),
  details: z.string().trim().max(1000).optional().default(''),
  block: z.boolean().optional().default(false),
});

let ensured = false;
async function ensureTables(db = prisma) {
  if (ensured) return;
  await db.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "CoachReport" (
    "id" TEXT PRIMARY KEY,
    "reporterId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
    "reporterRole" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
    "reason" TEXT NOT NULL,
    "details" TEXT NOT NULL DEFAULT '',
    "blocked" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'open',
    "resolvedNote" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMPTZ
  )`);
  await db.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "CoachReport_status_idx" ON "CoachReport"("status", "createdAt")');
  await db.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "CoachBlock" (
    "clientId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
    "trainerId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY ("clientId", "trainerId")
  )`);
  ensured = true;
}

/** The reporter must actually know the subject: a (past) link either way, or a verified trainer in the directory. */
async function relationRole(reporterId, subjectId, db) {
  const [link] = await db.$queryRaw`SELECT "trainerId", "clientId" FROM "TrainerLink"
    WHERE ("trainerId" = ${reporterId} AND "clientId" = ${subjectId}) OR ("clientId" = ${reporterId} AND "trainerId" = ${subjectId})
    ORDER BY "createdAt" DESC LIMIT 1`;
  if (link) return link.trainerId === reporterId ? 'TRAINER' : 'CLIENT';
  const [trainer] = await db.$queryRaw`SELECT 1 AS ok FROM "TrainerProfile" WHERE "userId" = ${subjectId} AND status = 'VERIFIED'`;
  return trainer ? 'CLIENT' : null;
}

export async function isBlocked(clientId, trainerId, db = prisma) {
  await ensureTables(db);
  const [row] = await db.$queryRaw`SELECT 1 AS ok FROM "CoachBlock" WHERE "clientId" = ${clientId} AND "trainerId" = ${trainerId}`;
  return Boolean(row);
}

/** A client who ended or declined a trainer (or blocked them) is not invited by that trainer again. */
export async function assertTrainerMayInvite(trainerId, clientId, db = prisma) {
  if (await isBlocked(clientId, trainerId, db)) throw coachError(403, 'ამ ადამიანთან დაკავშირება შეუძლებელია.', 'BLOCKED');
  const [last] = await db.$queryRaw`SELECT status, "endedBy" FROM "TrainerLink" WHERE "trainerId" = ${trainerId} AND "clientId" = ${clientId}
    ORDER BY "createdAt" DESC LIMIT 1`;
  if (last && last.status === 'ENDED' && last.endedBy === 'CLIENT') {
    throw coachError(403, 'ამ ადამიანმა კავშირი დაასრულა. ხელახლა დაკავშირება მხოლოდ მისი ინიციატივით შეიძლება — მას შეუძლია შენი კოდით დაგიკავშირდეს.', 'CLIENT_ENDED');
  }
}

export async function reportCoach(reporter, input, { endLink, notify } = {}, db = prisma) {
  await ensureTables(db);
  const body = reportSchema.parse(input);
  if (body.subjectId === reporter.id) throw coachError(400, 'საკუთარ თავზე შეტყობინება შეუძლებელია.');
  const role = await relationRole(reporter.id, body.subjectId, db);
  if (!role) throw coachError(404, 'ეს ადამიანი ვერ მოიძებნა.', 'SUBJECT_NOT_FOUND');
  const id = randomUUID();
  await db.$executeRaw`INSERT INTO "CoachReport" ("id", "reporterId", "reporterRole", "subjectId", "reason", "details", "blocked")
    VALUES (${id}, ${reporter.id}, ${role}, ${body.subjectId}, ${body.reason}, ${body.details}, ${body.block})`;
  if (body.block) {
    const [clientId, trainerId] = role === 'CLIENT' ? [reporter.id, body.subjectId] : [body.subjectId, reporter.id];
    if (role === 'CLIENT') {
      await db.$executeRaw`INSERT INTO "CoachBlock" ("clientId", "trainerId") VALUES (${clientId}, ${trainerId}) ON CONFLICT DO NOTHING`;
    }
    const [open] = await db.$queryRaw`SELECT id FROM "TrainerLink" WHERE "trainerId" = ${trainerId} AND "clientId" = ${clientId} AND status IN ('REQUESTED', 'ACTIVE') LIMIT 1`;
    if (open && endLink) await endLink({ linkId: open.id, by: role, actorId: reporter.id }, db);
  }
  if (notify) {
    Promise.resolve(notify(`⚠️ MEDI COACH შეტყობინება: ${REPORT_REASONS[body.reason]} (${role === 'CLIENT' ? 'კლიენტი ტრენერზე' : 'ტრენერი კლიენტზე'})${body.block ? ', დაბლოკა' : ''}.\nადმინი → ტრენერები → შეტყობინებები.`)).catch(() => {});
  }
  return { id, blocked: body.block };
}

export async function listReports({ status = 'open' } = {}, db = prisma) {
  await ensureTables(db);
  const rows = status === 'all'
    ? await db.$queryRaw`SELECT r.*, rep."fullName" AS "reporterName", sub."fullName" AS "subjectName" FROM "CoachReport" r
        JOIN "User" rep ON rep.id = r."reporterId" JOIN "User" sub ON sub.id = r."subjectId" ORDER BY r."createdAt" DESC LIMIT 200`
    : await db.$queryRaw`SELECT r.*, rep."fullName" AS "reporterName", sub."fullName" AS "subjectName" FROM "CoachReport" r
        JOIN "User" rep ON rep.id = r."reporterId" JOIN "User" sub ON sub.id = r."subjectId" WHERE r.status = ${status} ORDER BY r."createdAt" DESC LIMIT 200`;
  return rows.map((r) => ({ ...r, reasonLabel: REPORT_REASONS[r.reason] || r.reason }));
}

export async function resolveReport(id, note, db = prisma) {
  await ensureTables(db);
  const n = await db.$executeRaw`UPDATE "CoachReport" SET "status" = 'resolved', "resolvedNote" = ${note || null}, "resolvedAt" = NOW() WHERE "id" = ${id} AND "status" = 'open'`;
  if (!n) throw coachError(404, 'შეტყობინება ვერ მოიძებნა ან უკვე განხილულია.');
}

export async function openReportCount(db = prisma) {
  await ensureTables(db);
  const [row] = await db.$queryRaw`SELECT COUNT(*)::int AS n FROM "CoachReport" WHERE "status" = 'open'`;
  return row?.n ?? 0;
}
