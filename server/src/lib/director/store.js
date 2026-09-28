/**
 * MEDICARD Director — the owner's stand-in. The "brain" is Claude Code (cloud routine / desktop
 * session) calling /api/director/brain/*; this server is its office: shift switch, the owner's
 * Telegram inbox, the approval queue, memory and journal. Additive raw-SQL tables, created lazily
 * (same pattern as FeatureFlag). Nothing here ever holds an individual user's health data.
 */
import { randomInt, randomUUID } from 'node:crypto';
import { prisma } from '../prisma.js';

export const PROPOSAL_STATUSES = Object.freeze(['pending', 'approved', 'rejected', 'done', 'expired']);
export const JOURNAL_KINDS = Object.freeze(['brief', 'check', 'note', 'run', 'shift']);
export const MAX_TEXT = 8000;
const PAIRING_TTL_MS = 10 * 60 * 1000;

const clip = (v, n = MAX_TEXT) => String(v ?? '').slice(0, n);
let ensured = false;

export async function ensureDirectorTables(db = prisma) {
  if (ensured) return;
  await db.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "DirectorState" (
    "id" INTEGER PRIMARY KEY DEFAULT 1,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "activatedAt" TIMESTAMPTZ,
    "activatedBy" TEXT,
    "ownerChatId" TEXT,
    "pairingCode" TEXT,
    "pairingExpiresAt" TIMESTAMPTZ,
    "lastBrainAt" TIMESTAMPTZ,
    "lastTriggerAt" TIMESTAMPTZ,
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  await db.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "DirectorMessage" (
    "id" TEXT PRIMARY KEY,
    "direction" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "telegramMessageId" TEXT,
    "replyToTelegramId" TEXT,
    "handledAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "DirectorMessage_createdAt_idx" ON "DirectorMessage"("createdAt")`);
  await db.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "DirectorProposal" (
    "id" TEXT PRIMARY KEY,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "payload" JSONB,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "ownerNote" TEXT,
    "result" TEXT,
    "decidedAt" TIMESTAMPTZ,
    "decidedVia" TEXT,
    "telegramMessageId" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "DirectorProposal_status_idx" ON "DirectorProposal"("status", "createdAt")`);
  await db.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "DirectorMemory" (
    "key" TEXT PRIMARY KEY,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  await db.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "DirectorJournal" (
    "id" TEXT PRIMARY KEY,
    "kind" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "data" JSONB,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "DirectorJournal_createdAt_idx" ON "DirectorJournal"("createdAt")`);
  await db.$executeRawUnsafe(`INSERT INTO "DirectorState" ("id") VALUES (1) ON CONFLICT ("id") DO NOTHING`);
  ensured = true;
}

// ── state ────────────────────────────────────────────────────────────────────

export async function getState(db = prisma) {
  await ensureDirectorTables(db);
  const [row] = await db.$queryRaw`SELECT * FROM "DirectorState" WHERE "id" = 1`;
  return row;
}

export async function setActive(active, by, db = prisma) {
  await ensureDirectorTables(db);
  await db.$executeRaw`UPDATE "DirectorState" SET "active" = ${Boolean(active)},
    "activatedAt" = CASE WHEN ${Boolean(active)} THEN NOW() ELSE "activatedAt" END,
    "activatedBy" = ${clip(by, 160)}, "updatedAt" = NOW() WHERE "id" = 1`;
  await addJournal({ kind: 'shift', summary: active ? `ცვლა ჩაიბარა (${by})` : `ცვლა დაბრუნდა (${by})` }, db);
  return getState(db);
}

export async function touchState(field, db = prisma) {
  if (!['lastBrainAt', 'lastTriggerAt'].includes(field)) throw new Error('bad field');
  await ensureDirectorTables(db);
  await db.$executeRawUnsafe(`UPDATE "DirectorState" SET "${field}" = NOW() WHERE "id" = 1`);
}

/** 6-digit code the owner sends to the bot (`/start CODE`) to bind their private chat. */
export async function createPairingCode(db = prisma) {
  await ensureDirectorTables(db);
  const code = String(randomInt(100000, 1000000));
  const expires = new Date(Date.now() + PAIRING_TTL_MS);
  await db.$executeRaw`UPDATE "DirectorState" SET "pairingCode" = ${code}, "pairingExpiresAt" = ${expires}, "updatedAt" = NOW() WHERE "id" = 1`;
  return { code, expiresAt: expires };
}

export async function consumePairingCode(code, chatId, db = prisma) {
  const state = await getState(db);
  const ok = state.pairingCode && String(code).trim() === state.pairingCode
    && state.pairingExpiresAt && new Date(state.pairingExpiresAt).getTime() > Date.now();
  if (!ok) return false;
  await db.$executeRaw`UPDATE "DirectorState" SET "ownerChatId" = ${String(chatId)}, "pairingCode" = NULL,
    "pairingExpiresAt" = NULL, "updatedAt" = NOW() WHERE "id" = 1`;
  return true;
}

export async function unpairOwner(db = prisma) {
  await ensureDirectorTables(db);
  await db.$executeRaw`UPDATE "DirectorState" SET "ownerChatId" = NULL, "updatedAt" = NOW() WHERE "id" = 1`;
}

// ── messages ─────────────────────────────────────────────────────────────────

export async function addMessage({ direction, text, telegramMessageId = null, replyToTelegramId = null, handled = false }, db = prisma) {
  if (!['owner', 'director', 'system'].includes(direction)) throw new Error('bad direction');
  await ensureDirectorTables(db);
  const id = randomUUID();
  await db.$executeRaw`INSERT INTO "DirectorMessage" ("id", "direction", "text", "telegramMessageId", "replyToTelegramId", "handledAt")
    VALUES (${id}, ${direction}, ${clip(text)}, ${telegramMessageId ? String(telegramMessageId) : null},
      ${replyToTelegramId ? String(replyToTelegramId) : null}, ${handled || direction !== 'owner' ? new Date() : null})`;
  return id;
}

export async function listMessages({ limit = 50 } = {}, db = prisma) {
  await ensureDirectorTables(db);
  const rows = await db.$queryRaw`SELECT * FROM "DirectorMessage" ORDER BY "createdAt" DESC LIMIT ${Math.min(200, Number(limit) || 50)}`;
  return rows.reverse();
}

export async function unhandledOwnerMessages(db = prisma) {
  await ensureDirectorTables(db);
  return db.$queryRaw`SELECT * FROM "DirectorMessage" WHERE "direction" = 'owner' AND "handledAt" IS NULL ORDER BY "createdAt" ASC LIMIT 50`;
}

export async function markMessagesHandled(ids, db = prisma) {
  const list = (Array.isArray(ids) ? ids : []).map(String).slice(0, 100);
  if (!list.length) return 0;
  await ensureDirectorTables(db);
  return db.$executeRaw`UPDATE "DirectorMessage" SET "handledAt" = NOW() WHERE "id" = ANY(${list}) AND "handledAt" IS NULL`;
}

// ── proposals (approval queue) ───────────────────────────────────────────────

export async function createProposal({ kind, title, body, payload = null }, db = prisma) {
  await ensureDirectorTables(db);
  const id = randomUUID();
  await db.$executeRaw`INSERT INTO "DirectorProposal" ("id", "kind", "title", "body", "payload")
    VALUES (${id}, ${clip(kind, 40)}, ${clip(title, 200)}, ${clip(body)}, ${payload == null ? null : JSON.stringify(payload)}::jsonb)`;
  return getProposal(id, db);
}

export async function getProposal(id, db = prisma) {
  await ensureDirectorTables(db);
  const [row] = await db.$queryRaw`SELECT * FROM "DirectorProposal" WHERE "id" = ${String(id)}`;
  return row || null;
}

export async function findProposalByTelegramId(messageId, db = prisma) {
  await ensureDirectorTables(db);
  const [row] = await db.$queryRaw`SELECT * FROM "DirectorProposal" WHERE "telegramMessageId" = ${String(messageId)} LIMIT 1`;
  return row || null;
}

export async function setProposalTelegramId(id, messageId, db = prisma) {
  await db.$executeRaw`UPDATE "DirectorProposal" SET "telegramMessageId" = ${String(messageId)} WHERE "id" = ${String(id)}`;
}

/** Owner decision. Only a pending proposal can be decided; returns null otherwise. */
export async function decideProposal(id, { approve, via, note = null }, db = prisma) {
  await ensureDirectorTables(db);
  const status = approve ? 'approved' : 'rejected';
  const n = await db.$executeRaw`UPDATE "DirectorProposal" SET "status" = ${status}, "decidedAt" = NOW(),
    "decidedVia" = ${clip(via, 40)}, "ownerNote" = COALESCE(${note ? clip(note, 2000) : null}, "ownerNote"), "updatedAt" = NOW()
    WHERE "id" = ${String(id)} AND "status" = 'pending'`;
  return n ? getProposal(id, db) : null;
}

export async function addProposalNote(id, note, db = prisma) {
  await ensureDirectorTables(db);
  await db.$executeRaw`UPDATE "DirectorProposal" SET "ownerNote" = TRIM(BOTH E'\n' FROM COALESCE("ownerNote", '') || E'\n' || ${clip(note, 2000)}),
    "updatedAt" = NOW() WHERE "id" = ${String(id)}`;
}

/** The brain reports what it did with an approved proposal (or withdraws a pending one). */
export async function completeProposal(id, { result, status = 'done' }, db = prisma) {
  if (!['done', 'expired'].includes(status)) throw new Error('bad status');
  await ensureDirectorTables(db);
  const n = await db.$executeRaw`UPDATE "DirectorProposal" SET "status" = ${status}, "result" = ${clip(result, 4000)}, "updatedAt" = NOW()
    WHERE "id" = ${String(id)} AND "status" IN ('approved', 'pending')`;
  return n ? getProposal(id, db) : null;
}

export async function listProposals({ status, limit = 50 } = {}, db = prisma) {
  await ensureDirectorTables(db);
  const lim = Math.min(200, Number(limit) || 50);
  if (status) return db.$queryRaw`SELECT * FROM "DirectorProposal" WHERE "status" = ${String(status)} ORDER BY "createdAt" DESC LIMIT ${lim}`;
  return db.$queryRaw`SELECT * FROM "DirectorProposal" ORDER BY "createdAt" DESC LIMIT ${lim}`;
}

/** Decisions the brain still has to act on: approved (not done) and recently rejected with a note. */
export async function openDecisions(db = prisma) {
  await ensureDirectorTables(db);
  return db.$queryRaw`SELECT * FROM "DirectorProposal" WHERE "status" = 'approved'
    OR ("status" = 'rejected' AND "decidedAt" > NOW() - INTERVAL '3 days') ORDER BY "decidedAt" ASC LIMIT 50`;
}

// ── memory & journal ─────────────────────────────────────────────────────────

export async function readMemory(db = prisma) {
  await ensureDirectorTables(db);
  return db.$queryRaw`SELECT "key", "value", "updatedAt" FROM "DirectorMemory" ORDER BY "key" ASC`;
}

export async function writeMemory(key, value, db = prisma) {
  const k = String(key || '').trim();
  if (!/^[a-z0-9][a-z0-9_.-]{0,63}$/i.test(k)) throw Object.assign(new Error('invalid memory key'), { status: 400 });
  await ensureDirectorTables(db);
  if (value == null || value === '') {
    await db.$executeRaw`DELETE FROM "DirectorMemory" WHERE "key" = ${k}`;
    return null;
  }
  await db.$executeRaw`INSERT INTO "DirectorMemory" ("key", "value") VALUES (${k}, ${clip(value, 20000)})
    ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value", "updatedAt" = NOW()`;
  return k;
}

export async function addJournal({ kind, summary, data = null }, db = prisma) {
  const k = JOURNAL_KINDS.includes(kind) ? kind : 'note';
  await ensureDirectorTables(db);
  const id = randomUUID();
  await db.$executeRaw`INSERT INTO "DirectorJournal" ("id", "kind", "summary", "data")
    VALUES (${id}, ${k}, ${clip(summary, 4000)}, ${data == null ? null : JSON.stringify(data)}::jsonb)`;
  return id;
}

export async function listJournal({ limit = 50 } = {}, db = prisma) {
  await ensureDirectorTables(db);
  return db.$queryRaw`SELECT * FROM "DirectorJournal" ORDER BY "createdAt" DESC LIMIT ${Math.min(200, Number(limit) || 50)}`;
}
