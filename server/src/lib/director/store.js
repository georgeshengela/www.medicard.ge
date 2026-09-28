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
  await db.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "DirectorInitiative" (
    "id" TEXT PRIMARY KEY,
    "title" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "hypothesis" TEXT NOT NULL DEFAULT '',
    "plan" TEXT NOT NULL DEFAULT '',
    "metric" TEXT NOT NULL DEFAULT '',
    "target" TEXT NOT NULL DEFAULT '',
    "impact" INTEGER NOT NULL DEFAULT 3,
    "effort" INTEGER NOT NULL DEFAULT 3,
    "status" TEXT NOT NULL DEFAULT 'idea',
    "progress" TEXT NOT NULL DEFAULT '',
    "result" TEXT NOT NULL DEFAULT '',
    "proposalId" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  await db.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "DirectorReport" (
    "id" TEXT PRIMARY KEY,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "DirectorReport_createdAt_idx" ON "DirectorReport"("createdAt")`);
  await db.$executeRawUnsafe(`INSERT INTO "DirectorState" ("id") VALUES (1) ON CONFLICT ("id") DO NOTHING`);
  ensured = true;
}

// ── initiatives (the plan) & reports (visible work) ──────────────────────────

export const INITIATIVE_AREAS = Object.freeze(['growth', 'marketing', 'content', 'product', 'retention', 'partnerships', 'analytics', 'ops']);
export const INITIATIVE_STATUSES = Object.freeze(['idea', 'proposed', 'approved', 'active', 'done', 'dropped']);
export const REPORT_KINDS = Object.freeze(['plan', 'daily', 'evening', 'weekly', 'analysis', 'research', 'content']);

const clampScore = (n) => Math.min(5, Math.max(1, Math.round(Number(n) || 3)));

export async function createInitiative(input, db = prisma) {
  await ensureDirectorTables(db);
  const id = randomUUID();
  const area = INITIATIVE_AREAS.includes(input.area) ? input.area : 'growth';
  const status = ['idea', 'proposed'].includes(input.status) ? input.status : 'idea';
  await db.$executeRaw`INSERT INTO "DirectorInitiative" ("id", "title", "area", "hypothesis", "plan", "metric", "target", "impact", "effort", "status")
    VALUES (${id}, ${clip(input.title, 200)}, ${area}, ${clip(input.hypothesis, 2000)}, ${clip(input.plan, 4000)}, ${clip(input.metric, 300)},
      ${clip(input.target, 300)}, ${clampScore(input.impact)}, ${clampScore(input.effort)}, ${status})`;
  return getInitiative(id, db);
}

export async function getInitiative(id, db = prisma) {
  await ensureDirectorTables(db);
  const [row] = await db.$queryRaw`SELECT * FROM "DirectorInitiative" WHERE "id" = ${String(id)}`;
  return row || null;
}

/** Only the owner moves an initiative to approved (via a proposal); starting work needs approval first. */
export function initiativeTransitionAllowed(from, to, byOwner) {
  if (!INITIATIVE_STATUSES.includes(to)) return false;
  if (from === to || byOwner) return true;
  if (to === 'approved') return false;
  if (to === 'active') return ['approved', 'active'].includes(from);
  if (to === 'done') return from === 'active';
  return true; // idea ↔ proposed, anything → dropped
}

export async function updateInitiative(id, patch, { byOwner = false } = {}, db = prisma) {
  const current = await getInitiative(id, db);
  if (!current) return null;
  const status = patch.status || current.status;
  if (!initiativeTransitionAllowed(current.status, status, byOwner)) {
    throw Object.assign(new Error(`status ${current.status} → ${status} needs the owner's approval (propose it)`), { status: 409 });
  }
  const pick = (k, n) => (patch[k] != null ? clip(patch[k], n) : current[k]);
  const next = {
    title: pick('title', 200), hypothesis: pick('hypothesis', 2000), plan: pick('plan', 4000), metric: pick('metric', 300),
    target: pick('target', 300), progress: pick('progress', 4000), result: pick('result', 4000),
    impact: patch.impact != null ? clampScore(patch.impact) : current.impact,
    effort: patch.effort != null ? clampScore(patch.effort) : current.effort,
    proposalId: patch.proposalId !== undefined ? patch.proposalId : current.proposalId,
  };
  await db.$executeRaw`UPDATE "DirectorInitiative" SET "title" = ${next.title}, "hypothesis" = ${next.hypothesis}, "plan" = ${next.plan},
    "metric" = ${next.metric}, "target" = ${next.target}, "impact" = ${next.impact}, "effort" = ${next.effort}, "status" = ${status},
    "progress" = ${next.progress}, "result" = ${next.result}, "proposalId" = ${next.proposalId}, "updatedAt" = NOW() WHERE "id" = ${String(id)}`;
  return getInitiative(id, db);
}

export async function listInitiatives({ includeClosed = true } = {}, db = prisma) {
  await ensureDirectorTables(db);
  if (includeClosed) return db.$queryRaw`SELECT * FROM "DirectorInitiative" ORDER BY "updatedAt" DESC LIMIT 100`;
  return db.$queryRaw`SELECT * FROM "DirectorInitiative" WHERE "status" NOT IN ('done', 'dropped') ORDER BY "updatedAt" DESC LIMIT 100`;
}

export async function addReport({ kind, title, body }, db = prisma) {
  await ensureDirectorTables(db);
  const id = randomUUID();
  await db.$executeRaw`INSERT INTO "DirectorReport" ("id", "kind", "title", "body")
    VALUES (${id}, ${REPORT_KINDS.includes(kind) ? kind : 'analysis'}, ${clip(title, 200)}, ${clip(body, 20000)})`;
  return id;
}

export async function listReports({ limit = 20, withBody = true } = {}, db = prisma) {
  await ensureDirectorTables(db);
  const lim = Math.min(100, Number(limit) || 20);
  if (withBody) return db.$queryRaw`SELECT * FROM "DirectorReport" ORDER BY "createdAt" DESC LIMIT ${lim}`;
  return db.$queryRaw`SELECT "id", "kind", "title", "createdAt" FROM "DirectorReport" ORDER BY "createdAt" DESC LIMIT ${lim}`;
}

export async function getReport(id, db = prisma) {
  await ensureDirectorTables(db);
  const [row] = await db.$queryRaw`SELECT * FROM "DirectorReport" WHERE "id" = ${String(id)}`;
  return row || null;
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

/** Memory values are text; objects/arrays/numbers are stored as JSON (never "[object Object]"). */
export function memoryValue(value) {
  if (value == null || value === '') return null;
  return typeof value === 'string' ? value : JSON.stringify(value);
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
