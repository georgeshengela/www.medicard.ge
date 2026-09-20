import { AsyncLocalStorage } from 'node:async_hooks';
import { createHash, randomUUID } from 'node:crypto';
import { prisma } from './prisma.js';
import manifest from '../../../mobile/src/config/aiDisclosure.json' with { type: 'json' };

export const AI_DISCLOSURE = Object.freeze(manifest);
export const AI_CONSENT_VERSION = createHash('sha256').update(JSON.stringify(manifest)).digest('hex');
const context = new AsyncLocalStorage();
export const withAiAccount = (userId, work) => context.run({ userId }, work);
export const currentAiAccount = () => context.getStore()?.userId || null;
export function consentRequired() {
  return Object.assign(new Error('AI-სთვის მონაცემების გაზიარებას შენი თანხმობა სჭირდება.'), { status: 403, code: 'AI_CONSENT_REQUIRED' });
}
export async function readAiConsent(userId, db = prisma) {
  if (!userId) throw consentRequired();
  const rows = await db.$queryRaw`SELECT "version", "decision", "updatedAt" FROM "UserAiConsent" WHERE "userId" = ${userId}`;
  const row = rows[0] || null;
  return { version: AI_CONSENT_VERSION, manifest: AI_DISCLOSURE,
    accepted: row?.version === AI_CONSENT_VERSION && row?.decision === 'accepted',
    decision: row?.decision || null, updatedAt: row?.updatedAt || null };
}
export async function assertAiConsent(userId = currentAiAccount()) {
  const consent = await readAiConsent(userId);
  if (!consent.accepted) throw consentRequired();
}
export async function recordAiConsent(userId, { version, decision }, db = prisma) {
  if (version !== AI_CONSENT_VERSION) throw Object.assign(new Error('მონაცემების გაზიარების პირობები განახლდა. წაიკითხე ახალი ვერსია.'), { status: 409, code: 'AI_CONSENT_VERSION_CHANGED' });
  if (!['accepted', 'declined', 'revoked'].includes(decision)) throw Object.assign(new Error('არასწორი არჩევანი.'), { status: 400 });
  await db.$transaction(async tx => {
    await tx.$executeRaw`INSERT INTO "UserAiConsent" ("userId", "version", "decision", "updatedAt") VALUES (${userId}, ${version}, ${decision}, NOW())
      ON CONFLICT ("userId") DO UPDATE SET "version" = EXCLUDED."version", "decision" = EXCLUDED."decision", "updatedAt" = NOW()`;
    await tx.$executeRaw`INSERT INTO "AiConsentEvent" ("id", "userId", "version", "decision", "createdAt") VALUES (${randomUUID()}, ${userId}, ${version}, ${decision}, NOW())`;
  });
  return readAiConsent(userId, db);
}
export async function requireAiConsent(req, res, next) {
  try { await assertAiConsent(req.user?.id); return next(); } catch (error) { return next(error); }
}
