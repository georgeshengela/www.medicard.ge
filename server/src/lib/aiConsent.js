import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import { prisma } from './prisma.js';
import { parseLang, t } from './i18n.js';
import manifest from '../../../mobile/src/config/aiDisclosure.json' with { type: 'json' };

export const AI_DISCLOSURE = Object.freeze(manifest);
/**
 * Bump only when the AI providers, the categories of personal data shared,
 * or the processing purpose materially change. UI copy alone must not bump this.
 * 2026-09-25.1 replaces the repeated in-flow modal with one explicit permission.
 * Older hashed decisions are not this version and must be asked again once.
 */
export const CURRENT_AI_CONSENT_VERSION = '2026-09-25.1';
export const AI_CONSENT_VERSION = CURRENT_AI_CONSENT_VERSION;
const context = new AsyncLocalStorage();
/**
 * Per-request AI context: the account (consent checks) and the reading language (ka | en), so every
 * prompt/fallback deep in the AI stack answers in the person's language without threading `lang`.
 */
export const withAiAccount = (userId, work, lang) =>
  context.run({ userId, lang: parseLang(lang) ?? context.getStore()?.lang ?? null }, work);
export const currentAiAccount = () => context.getStore()?.userId || null;
/** 'ka' | 'en' for the current AI request (Georgian when unknown). */
export const currentAiLanguage = () => context.getStore()?.lang || 'ka';
/** True when the request language was explicitly bound (header / stored account language). */
export const hasAiLanguage = () => Boolean(context.getStore()?.lang);
/** Bind the reading language on the current AI context (after requireAuth). */
export function setAiLanguage(lang) {
  const store = context.getStore();
  const value = parseLang(lang);
  if (store && value) store.lang = value;
}
/** Express middleware for AI routers: mount after requireAuth. */
export function bindAiLanguage(req, _res, next) {
  setAiLanguage(req.lang);
  next();
}
export function consentRequired() {
  return Object.assign(new Error(t(currentAiLanguage(), 'AI-სთვის მონაცემების გაზიარებას შენი თანხმობა სჭირდება.', 'Sharing your data with AI needs your permission.')), { status: 403, code: 'AI_CONSENT_REQUIRED' });
}
const isAcceptedConsentRow = (row) => row?.version === AI_CONSENT_VERSION && row?.decision === 'accepted';
export async function readAiConsent(userId, db = prisma) {
  if (!userId) throw consentRequired();
  const rows = await db.$queryRaw`SELECT "version", "decision", "updatedAt" FROM "UserAiConsent" WHERE "userId" = ${userId}`;
  const row = rows[0] || null;
  return { version: AI_CONSENT_VERSION, manifest: AI_DISCLOSURE,
    accepted: isAcceptedConsentRow(row),
    decision: row?.decision || null, updatedAt: row?.updatedAt || null };
}
/**
 * Non-throwing check for features offered only after AI consent (the weekly Medi mission).
 * True only for the current version's explicit „accepted“; no row, an old version or a failed read is false.
 */
export async function hasAcceptedAiConsent(userId, db = prisma) {
  if (!userId || typeof db?.userAiConsent?.findUnique !== 'function') return false;
  try {
    return isAcceptedConsentRow(await db.userAiConsent.findUnique({ where: { userId } }));
  } catch {
    return false;
  }
}
export async function assertAiConsent(userId = currentAiAccount()) {
  const consent = await readAiConsent(userId);
  if (!consent.accepted) throw consentRequired();
}
export async function recordAiConsent(userId, { version, decision }, db = prisma) {
  if (version !== AI_CONSENT_VERSION) throw Object.assign(new Error(t(currentAiLanguage(), 'მონაცემების გაზიარების პირობები განახლდა. წაიკითხე ახალი ვერსია.', 'The data sharing terms have been updated. Please read the new version.')), { status: 409, code: 'AI_CONSENT_VERSION_CHANGED' });
  if (!['accepted', 'declined', 'revoked'].includes(decision)) throw Object.assign(new Error(t(currentAiLanguage(), 'არასწორი არჩევანი.', 'Invalid choice.')), { status: 400 });
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
