/**
 * Photo avatars and personal QR codes (2026-09-28).
 *
 * Avatar photo: private storage; visible to the person, to people they have an open trainer link
 * with (REQUESTED/ACTIVE, either side), to everyone when the person is a VERIFIED trainer (public
 * card), and to a verified trainer holding the person's current QR token (scan preview).
 * The women's space never shows it (anonymous by design).
 *
 * Personal QR: a random renewable token — never the user id. It encodes https://medicard.ge/u/TOKEN.
 */
import { randomBytes } from 'node:crypto';
import { prisma } from './prisma.js';

export const QR_TOKEN_RE = /^[A-Za-z0-9_-]{16,40}$/;

export function newQrToken() {
  return randomBytes(15).toString('base64url'); // 20 chars, 120 bits
}

export function qrLink(token) {
  return `https://medicard.ge/u/${token}`;
}

/** Accepts a raw token or any text that contains /u/TOKEN (a scanned URL). */
export function parseQrToken(raw) {
  const s = String(raw ?? '').trim();
  const m = s.match(/\/u\/([A-Za-z0-9_-]{16,40})(?:[/?#]|$)/) || s.match(/^([A-Za-z0-9_-]{16,40})$/);
  return m ? m[1] : null;
}

export function avatarUrl(userId, updatedAt) {
  if (!userId || !updatedAt) return null;
  return `/api/identity/avatars/${userId}?v=${new Date(updatedAt).getTime()}`;
}

export async function getAvatar(userId, db = prisma) {
  const [row] = await db.$queryRaw`SELECT "fileKey", "updatedAt" FROM "UserAvatar" WHERE "userId" = ${userId}`;
  return row ?? null;
}

/** Replace the photo; returns the previous storage key so the caller can remove its bytes. */
export async function setAvatar(userId, fileKey, db = prisma) {
  const prev = await getAvatar(userId, db);
  const [row] = await db.$queryRaw`INSERT INTO "UserAvatar" ("userId", "fileKey", "updatedAt") VALUES (${userId}, ${fileKey}, CURRENT_TIMESTAMP)
    ON CONFLICT ("userId") DO UPDATE SET "fileKey" = EXCLUDED."fileKey", "updatedAt" = CURRENT_TIMESTAMP RETURNING "updatedAt"`;
  return { updatedAt: row.updatedAt, previousKey: prev?.fileKey ?? null };
}

export async function removeAvatar(userId, db = prisma) {
  const [row] = await db.$queryRaw`DELETE FROM "UserAvatar" WHERE "userId" = ${userId} RETURNING "fileKey"`;
  return row?.fileKey ?? null;
}

export async function getOrCreateQr(userId, db = prisma) {
  const [row] = await db.$queryRaw`SELECT token FROM "UserQr" WHERE "userId" = ${userId}`;
  if (row) return row.token;
  for (let i = 0; i < 5; i += 1) {
    const inserted = await db.$queryRaw`INSERT INTO "UserQr" ("userId", token) VALUES (${userId}, ${newQrToken()}) ON CONFLICT DO NOTHING RETURNING token`;
    if (inserted.length) return inserted[0].token;
    const [again] = await db.$queryRaw`SELECT token FROM "UserQr" WHERE "userId" = ${userId}`;
    if (again) return again.token;
  }
  throw Object.assign(new Error('QR კოდი ვერ შეიქმნა.'), { status: 503 });
}

/** New token; any printed/screenshotted old code stops working at once. */
export async function rotateQr(userId, db = prisma) {
  await getOrCreateQr(userId, db);
  const [row] = await db.$queryRaw`UPDATE "UserQr" SET token = ${newQrToken()}, "rotatedAt" = CURRENT_TIMESTAMP WHERE "userId" = ${userId} RETURNING token`;
  return row.token;
}

export async function userByQr(token, db = prisma) {
  if (!token || !QR_TOKEN_RE.test(token)) return null;
  const [row] = await db.$queryRaw`SELECT "userId" FROM "UserQr" WHERE token = ${token}`;
  return row?.userId ?? null;
}

/** Pure decision used by the avatar route. */
export function avatarVisible({ viewerId, targetId, targetIsVerifiedTrainer, sharedOpenLink, viewerIsVerifiedTrainer, qrMatches }) {
  if (!viewerId || !targetId) return false;
  if (viewerId === targetId) return true;
  if (targetIsVerifiedTrainer) return true;
  if (sharedOpenLink) return true;
  return Boolean(viewerIsVerifiedTrainer && qrMatches);
}

export async function canViewAvatar(viewerId, targetId, qrToken = null, db = prisma) {
  if (viewerId === targetId) return true;
  const [facts] = await db.$queryRaw`SELECT
      EXISTS (SELECT 1 FROM "TrainerProfile" WHERE "userId" = ${targetId} AND status = 'VERIFIED') AS "targetTrainer",
      EXISTS (SELECT 1 FROM "TrainerProfile" WHERE "userId" = ${viewerId} AND status = 'VERIFIED') AS "viewerTrainer",
      EXISTS (SELECT 1 FROM "TrainerLink" WHERE status IN ('REQUESTED', 'ACTIVE')
        AND (("trainerId" = ${viewerId} AND "clientId" = ${targetId}) OR ("trainerId" = ${targetId} AND "clientId" = ${viewerId}))) AS "linked"`;
  const qrMatches = qrToken ? (await userByQr(qrToken, db)) === targetId : false;
  return avatarVisible({ viewerId, targetId, targetIsVerifiedTrainer: facts?.targetTrainer, sharedOpenLink: facts?.linked, viewerIsVerifiedTrainer: facts?.viewerTrainer, qrMatches });
}
