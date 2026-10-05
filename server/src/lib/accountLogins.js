/**
 * Sign-in methods on one account, and what happens when a person proves an identifier that
 * already belongs to another account (owner 2026-10-05: one person signed up on the web with a
 * phone and in the app with an email — two accounts).
 *
 * Methods: phone (User.phone, OTP-verified), a real email + password (User.email /
 * passwordHash; phone and hidden-Apple accounts carry a synthetic address), Apple / Google
 * (AuthIdentity rows). A signed-in person can add any of them; the code / OTP / ID token proves it.
 *
 * Conflict: the identifier is proven but sits on another account. The person may
 *   - move_here: bring every sign-in method of the other account onto this one and delete the
 *     other — only while the other account holds no health data and every method fits;
 *   - switch: sign in to the other account; this one is deleted (its methods moved over) only
 *     while it holds no health data and every method fits, otherwise it stays as it is.
 * Health data is never merged or deleted by this flow.
 */
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from './prisma.js';
import { isSyntheticEmail, normalizeEmail } from './email/address.js';
import { sendEmailVerifyCode } from './email.js';
import { deleteUserAccount } from './deleteUser.js';
import { evaluateOtpRow, OTP_MAX_ATTEMPTS } from './otpContract.js';
import { isQaOtpEnabled } from './qaOtp.js';
import { t } from './i18n.js';

export const CONFLICT_TTL = '15m';
const CODE_TTL_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;

/**
 * Tables whose rows are the person's own health content. Things created automatically (health
 * profile from onboarding, device step / metric syncs, generated nutrition plans, quest and
 * activity rows, consents, push tokens) do not count: a fresh account has them too.
 */
export const CONTENT_TABLES = Object.freeze([
  'MedicalRecord', 'ChatSession', 'MedicationSchedule', 'MedicationDoseEvent', 'DoctorVisit',
  'CycleLog', 'CyclePregnancyEpisode', 'CyclePostpartumEpisode', 'PregnancyLog',
  'HydrationIntakeEvent', 'NutritionMeal', 'NutritionFood', 'NutritionFast', 'NutritionActivity',
  'BodyMeasurement', 'ProgressPhoto', 'WorkoutLog', 'Pet', 'CommunityMember', 'TrainerProfile',
  'PriceDropAlert', 'RewardRedemption', 'UserAvatar',
]);

export class AccountLoginError extends Error {
  constructor(code, status = 409) {
    super(code);
    this.code = code;
    this.status = status;
  }
}

function secret() {
  return String(process.env.JWT_SECRET || '');
}

/* ───────── Methods ───────── */

export function realEmail(email) {
  const value = normalizeEmail(email);
  return value && !isSyntheticEmail(value) && !value.endsWith('@deleted.medicard.ge') ? value : null;
}

async function identitiesOf(userId, db = prisma) {
  try {
    return await db.$queryRaw`SELECT provider, subject, email FROM "AuthIdentity" WHERE "userId" = ${userId}`;
  } catch {
    return [];
  }
}

/** What the person can sign in with. Never the password itself, never another person's data. */
export async function loginMethods(userId, db = prisma) {
  const user = await db.user.findUnique({ where: { id: userId }, select: { email: true, phone: true } });
  if (!user) return null;
  const ids = await identitiesOf(userId, db);
  return {
    phone: user.phone || null,
    email: realEmail(user.email),
    apple: ids.some((row) => row.provider === 'apple'),
    google: ids.some((row) => row.provider === 'google'),
  };
}

/* ───────── Health content ───────── */

let contentTables = null;
async function existingContentTables(db) {
  if (!contentTables) {
    const rows = await db.$queryRaw`
      SELECT table_name FROM information_schema.columns
      WHERE table_schema = 'public' AND column_name = 'userId' AND table_name = ANY(${[...CONTENT_TABLES]})`;
    contentTables = rows.map((row) => row.table_name);
  }
  return contentTables;
}

/** True when the account holds any health content (see CONTENT_TABLES). Fails closed. */
export async function accountHasContent(userId, db = prisma) {
  try {
    for (const table of await existingContentTables(db)) {
      const rows = await db.$queryRawUnsafe(`SELECT 1 FROM "${table}" WHERE "userId" = $1 LIMIT 1`, userId);
      if (rows.length) return true;
    }
    return false;
  } catch (error) {
    console.warn('[account-logins] content check failed', error?.message);
    return true;
  }
}

/* ───────── Moving sign-in methods ───────── */

/**
 * Pure plan for moving every sign-in method of `from` onto `into`.
 * from / into: { id, email, phone, identities: [{ provider, subject }] }.
 * → { ok, phone, email, identities, conflicts: ['phone' | 'email'] }
 */
export function planAbsorb(from, into) {
  const conflicts = [];
  const fromEmail = realEmail(from.email);
  const intoEmail = realEmail(into.email);
  const phone = from.phone && from.phone !== into.phone ? from.phone : null;
  if (phone && into.phone) conflicts.push('phone');
  const email = fromEmail && fromEmail !== intoEmail ? fromEmail : null;
  if (email && intoEmail) conflicts.push('email');
  return { ok: conflicts.length === 0, phone, email, identities: (from.identities || []).length, conflicts };
}

async function loginShape(userId, db = prisma) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, phone: true, passwordHash: true, status: true, createdAt: true },
  });
  if (!user) return null;
  return { ...user, identities: await identitiesOf(userId, db) };
}

/**
 * What the conflict sheet may offer, seen from the signed-in account `currentId` against the
 * account `otherId` that owns the proven identifier.
 */
export async function conflictOptions(currentId, otherId, db = prisma) {
  const [current, other] = await Promise.all([loginShape(currentId, db), loginShape(otherId, db)]);
  if (!current || !other) return null;
  const [currentHasData, otherHasData] = await Promise.all([accountHasContent(currentId, db), accountHasContent(otherId, db)]);
  const blocked = other.status === 'BLOCKED';
  return {
    otherCreatedAt: other.createdAt,
    otherHasData,
    currentHasData,
    canMoveHere: !blocked && !otherHasData && planAbsorb(other, current).ok,
    canSwitch: !blocked,
    switchDeletesCurrent: !currentHasData && planAbsorb(current, other).ok,
  };
}

/**
 * Moves every sign-in method of `fromId` onto `intoId`, then deletes `fromId`.
 * Refuses when `from` holds health data or a method does not fit.
 */
export async function absorbLogins(fromId, intoId, db = prisma) {
  if (fromId === intoId) throw new AccountLoginError('MERGE_SAME', 400);
  if (await accountHasContent(fromId, db)) throw new AccountLoginError('MERGE_HAS_DATA');
  const [from, into] = await Promise.all([loginShape(fromId, db), loginShape(intoId, db)]);
  if (!from || !into) throw new AccountLoginError('MERGE_MISSING', 404);
  const plan = planAbsorb(from, into);
  if (!plan.ok) throw new AccountLoginError('MERGE_CONFLICT');

  await db.$transaction(async (tx) => {
    if (plan.phone) {
      await tx.user.update({ where: { id: fromId }, data: { phone: null } });
      await tx.user.update({ where: { id: intoId }, data: { phone: plan.phone } });
    }
    if (plan.email) {
      // The address is unique: free it on the account that goes, then give it (and the password
      // that belongs to it) to the account that stays.
      await tx.user.update({ where: { id: fromId }, data: { email: `merged.${fromId}@deleted.medicard.ge` } });
      await tx.user.update({ where: { id: intoId }, data: { email: plan.email, passwordHash: from.passwordHash } });
    }
    if (plan.identities) {
      await tx.$executeRaw`UPDATE "AuthIdentity" SET "userId" = ${intoId} WHERE "userId" = ${fromId}`;
    }
  });

  const deleted = await deleteUserAccount(fromId);
  if (!deleted.ok) console.warn('[account-logins] merged account was not deleted', fromId, deleted.error);
  return { moved: { phone: Boolean(plan.phone), email: Boolean(plan.email), identities: plan.identities }, deleted: deleted.ok };
}

/* ───────── Conflict token ───────── */

/** Proof that the signed-in `from` account proved an identifier owned by `to` (15 minutes). */
export function signConflictToken({ kind, from, to }, key = secret()) {
  return jwt.sign({ typ: 'account-conflict', kind, from, to }, key, { expiresIn: CONFLICT_TTL });
}

export function readConflictToken(token, key = secret()) {
  try {
    const payload = jwt.verify(String(token || ''), key, { algorithms: ['HS256'] });
    if (payload?.typ !== 'account-conflict' || !payload.from || !payload.to || payload.from === payload.to) return null;
    if (!['phone', 'email', 'apple', 'google'].includes(payload.kind)) return null;
    return { kind: payload.kind, from: String(payload.from), to: String(payload.to) };
  } catch {
    return null;
  }
}

const TAKEN_COPY = {
  phone: ['ამ ნომრით MEDICARD-ის ანგარიში უკვე გაქვს.', 'You already have a MEDICARD account with this number.'],
  email: ['ამ ელ-ფოსტით MEDICARD-ის ანგარიში უკვე გაქვს.', 'You already have a MEDICARD account with this email.'],
  apple: ['ამ Apple ID-ით MEDICARD-ის ანგარიში უკვე გაქვს.', 'You already have a MEDICARD account with this Apple ID.'],
  google: ['ამ Google ანგარიშით MEDICARD-ის ანგარიში უკვე გაქვს.', 'You already have a MEDICARD account with this Google account.'],
};
const TAKEN_CODES = { phone: 'PHONE_TAKEN', email: 'EMAIL_TAKEN', apple: 'SOCIAL_TAKEN', google: 'SOCIAL_TAKEN' };

/** 409 body for a proven identifier that belongs to another account (old clients read `error`/`code`). */
export async function conflictPayload(lang, { kind, currentId, otherId }, db = prisma) {
  const options = await conflictOptions(currentId, otherId, db);
  const copy = TAKEN_COPY[kind];
  return {
    error: t(lang, copy[0], copy[1]),
    code: TAKEN_CODES[kind],
    conflict: options
      ? { kind, token: signConflictToken({ kind, from: currentId, to: otherId }), ...options }
      : null,
  };
}

/* ───────── Adding an email ───────── */

let tableReady = null;
function ensureEmailVerificationTable(db = prisma) {
  if (!tableReady) {
    tableReady = db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "EmailVerification" (
        "id" TEXT PRIMARY KEY,
        "userId" TEXT NOT NULL,
        "email" TEXT NOT NULL,
        "codeHash" TEXT NOT NULL,
        "attempts" INTEGER NOT NULL DEFAULT 0,
        "expiresAt" TIMESTAMPTZ NOT NULL,
        "usedAt" TIMESTAMPTZ,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`).then(() => db.$executeRawUnsafe(
      'CREATE INDEX IF NOT EXISTS "EmailVerification_userId_idx" ON "EmailVerification" ("userId", "createdAt")',
    )).catch((error) => {
      tableReady = null;
      throw error;
    });
  }
  return tableReady;
}

/** Sends a 6-digit code to `email` for the signed-in `user`. Allowed only while the account has no real email. */
export async function requestEmailAddCode({ user, email, lang = 'ka' }, db = prisma) {
  const address = normalizeEmail(email);
  if (realEmail(user.email)) {
    return { ok: false, status: 400, code: 'EMAIL_ALREADY_SET', error: t(lang, 'ამ ანგარიშს ელ-ფოსტა უკვე აქვს.', 'This account already has an email.') };
  }
  if (!realEmail(address)) {
    return { ok: false, status: 400, code: 'EMAIL_INVALID', error: t(lang, 'შეიყვანე სწორი ელ-ფოსტა.', 'Enter a valid email.') };
  }
  await ensureEmailVerificationTable(db);
  const recent = await db.$queryRaw`
    SELECT "createdAt" FROM "EmailVerification"
    WHERE "userId" = ${user.id} AND email = ${address} AND "usedAt" IS NULL AND "expiresAt" > NOW()
    ORDER BY "createdAt" DESC LIMIT 1`;
  if (recent[0] && Date.now() - new Date(recent[0].createdAt).getTime() < RESEND_COOLDOWN_MS) {
    return { ok: true, sent: true, message: t(lang, 'კოდი უკვე გამოგზავნილია. სცადე ხელახლა ერთი წუთის შემდეგ.', 'A code has already been sent. Try again in a minute.') };
  }
  await db.$executeRaw`UPDATE "EmailVerification" SET "usedAt" = NOW() WHERE "userId" = ${user.id} AND "usedAt" IS NULL`;
  const code = String(crypto.randomInt(100_000, 1_000_000));
  await db.$executeRaw`
    INSERT INTO "EmailVerification" (id, "userId", email, "codeHash", "expiresAt")
    VALUES (${crypto.randomUUID()}, ${user.id}, ${address}, ${await bcrypt.hash(code, 10)}, ${new Date(Date.now() + CODE_TTL_MS)})`;
  const result = { ok: true, sent: true, message: t(lang, `კოდი გამოგზავნილია: ${address}`, `We sent a code to ${address}`) };
  try {
    await sendEmailVerifyCode({ to: address, code, fullName: user.fullName, lang: t(lang, 'ka', 'en') });
  } catch (error) {
    console.error('[account-logins] email verify send failed:', error?.message ?? error);
    if (process.env.NODE_ENV === 'production' && !(await isQaOtpEnabled())) {
      return { ok: false, status: 502, error: t(lang, 'წერილი ვერ გაიგზავნა. სცადე ცოტა ხანში.', 'We could not send the email. Please try again shortly.') };
    }
  }
  if (process.env.NODE_ENV !== 'production') result.devCode = code;
  return result;
}

/** Checks the code (5 attempts, 10 minutes) and marks it used. → { ok } | { ok:false, status, error } */
export async function verifyEmailAddCode({ userId, email, code, lang = 'ka' }, db = prisma) {
  const address = normalizeEmail(email);
  await ensureEmailVerificationTable(db);
  const rows = await db.$queryRaw`
    SELECT id, "codeHash", attempts, "expiresAt", "usedAt" FROM "EmailVerification"
    WHERE "userId" = ${userId} AND email = ${address} AND "usedAt" IS NULL
    ORDER BY "createdAt" DESC LIMIT 1`;
  const row = rows[0] || null;
  const state = evaluateOtpRow(row, new Date(), lang);
  if (!state.ok) return state;
  if (!(await bcrypt.compare(String(code || '').trim(), row.codeHash))) {
    await db.$executeRaw`UPDATE "EmailVerification" SET attempts = attempts + 1 WHERE id = ${row.id}`;
    const left = OTP_MAX_ATTEMPTS - (row.attempts + 1);
    return { ok: false, status: left > 0 ? 400 : 429, error: t(lang, 'კოდი არასწორია ან ვადა გაუვიდა.', 'The code is wrong or has expired.') };
  }
  await db.$executeRaw`UPDATE "EmailVerification" SET "usedAt" = NOW() WHERE id = ${row.id}`;
  return { ok: true };
}
