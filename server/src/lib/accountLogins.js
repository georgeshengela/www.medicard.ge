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
import { openSecret, sealSecret } from './socialAuth.js';
import { t } from './i18n.js';

export const CONFLICT_TTL = '15m';
const CODE_TTL_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;

/**
 * Tables whose every row ("userId") is the person's own content: health records, cycle entries,
 * Medi Coins (every ledger row is a claimed quest / achievement, a MEDIRUN opening or walk, a
 * referral or an admin grant — nothing is written on sign-up), MEDIRUN walks and box openings.
 * Things created automatically (health profile defaults, device step / metric syncs, generated
 * nutrition plans, quest and activity rows, MEDIRUN player rows, consents, push tokens) do not
 * count: a fresh account has them too. Tables that hold both kinds are in CONTENT_PREDICATES.
 */
export const CONTENT_TABLES = Object.freeze([
  'MedicalRecord', 'ChatSession', 'MedicationSchedule', 'MedicationDoseEvent', 'DoctorVisit',
  'CycleLog', 'CyclePregnancyEpisode', 'CyclePostpartumEpisode', 'PregnancyLog',
  'CycleCustomTag', 'CyclePostpartumBleedClassification', 'PregnancyCarePlanItemState',
  'HydrationIntakeEvent', 'NutritionMeal', 'NutritionFood', 'NutritionFast', 'NutritionActivity',
  'BodyMeasurement', 'ProgressPhoto', 'WorkoutLog', 'Pet', 'CommunityMember', 'TrainerProfile',
  'PriceDropAlert', 'RewardRedemption', 'UserAvatar',
  'RewardLedger', 'MedipulsiSession', 'MedipulsiClaim', 'MedirunCrewMember',
]);

/** A JSON array with at least one element (anything else, NULL included, is false — never an error). */
const nonEmptyArray = (expr) => `(jsonb_typeof(${expr}) = 'array' AND ${expr} <> '[]'::jsonb)`;
/** Weight entries she typed; `wseed-` rows are seeded from the profile weight / Apple Health. */
const typedWeightLogs = (expr) => `(CASE WHEN jsonb_typeof(${expr}) = 'array' THEN EXISTS (
  SELECT 1 FROM jsonb_array_elements(${expr}) AS w WHERE COALESCE(w->>'id', '') NOT LIKE 'wseed-%') ELSE false END)`;

/**
 * Tables that also hold automatic rows: only rows matching `where` ($1 = the user id) count.
 * Every column in `columns` must exist, otherwise the check is skipped — raw-SQL tables and columns
 * are created lazily, and a table that is not there holds nobody's data.
 */
export const CONTENT_PREDICATES = Object.freeze([
  {
    // Created by the first cycle read. Her last-period answer (onboarding), mode, contraception,
    // conditions and lock are hers; aiInsights / reminderPrefs are written by the app itself.
    table: 'CycleProfile',
    columns: ['userId', 'lastPeriodStart', 'dueDate', 'mode', 'contraceptionMethod', 'isIrregular', 'privacyEnabled',
      'avgCycleLength', 'avgPeriodLength', 'conditions', 'partnerShareCode'],
    where: `"userId" = $1 AND ("lastPeriodStart" IS NOT NULL OR "dueDate" IS NOT NULL OR mode <> 'TRACK_PERIOD'
      OR "contraceptionMethod" IS NOT NULL OR "isIrregular" OR "privacyEnabled" OR "avgCycleLength" <> 28
      OR "avgPeriodLength" <> 5 OR "partnerShareCode" IS NOT NULL OR ${nonEmptyArray('conditions')})`,
  },
  {
    table: 'CycleProfile', // raw-SQL columns (cycleTrackingPrefs.js)
    columns: ['userId', 'expectsBleeding', 'fertilityDisplay'],
    where: `"userId" = $1 AND ("expectsBleeding" = false OR "fertilityDisplay" <> 'auto')`,
  },
  {
    table: 'CyclePartnerShare',
    columns: ['ownerUserId', 'partnerUserId'],
    where: `"ownerUserId" = $1 OR "partnerUserId" = $1`,
  },
  {
    // The profile row and its onboarding answers are automatic / re-asked; the clinical lists and the
    // weight log, lab values and dose marks synced into extraAnswers (appState.js) are hers.
    table: 'HealthProfile',
    columns: ['userId', 'chronicConditions', 'allergies', 'medications', 'familyHistory', 'extraAnswers'],
    where: `"userId" = $1 AND (${nonEmptyArray('"chronicConditions"')} OR ${nonEmptyArray('allergies')}
      OR ${nonEmptyArray('medications')} OR ${nonEmptyArray('"familyHistory"')}
      OR ${nonEmptyArray(`"extraAnswers"->'labPanels'`)} OR ${nonEmptyArray(`"extraAnswers"->'appState'->'labPanels'`)}
      OR ${nonEmptyArray(`"extraAnswers"->'appState'->'doseLogs'`)} OR ${nonEmptyArray(`"extraAnswers"->'appState'->'runHistory'`)}
      OR ${typedWeightLogs(`"extraAnswers"->'appState'->'weightLogs'`)})`,
  },
  {
    // A claimed invite code, either side (with referral rewards paused it has no ledger row yet).
    table: 'Referral',
    columns: ['inviterId', 'inviteeId'],
    where: `"inviterId" = $1 OR "inviteeId" = $1`,
  },
  {
    // Her trainer: a link she asked for or accepted. A trainer's unanswered invite is not hers.
    table: 'TrainerLink',
    columns: ['clientId', 'acceptedAt'],
    where: `"clientId" = $1 AND "acceptedAt" IS NOT NULL`,
  },
  {
    table: 'TrainerLink',
    columns: ['clientId', 'initiator'],
    where: `"clientId" = $1 AND initiator = 'CLIENT'`,
  },
  {
    // Her safety choices (coachSafety.js, raw SQL): a trainer she blocked or reported, with or without a link.
    table: 'CoachBlock',
    columns: ['clientId'],
    where: `"clientId" = $1`,
  },
  {
    table: 'CoachReport',
    columns: ['reporterId'],
    where: `"reporterId" = $1`,
  },
]);

/**
 * True once the person answered onboarding (app: a step key on every answered step, then the phase
 * flag; web: the phase flag and the completed profile). Such an account is never discarded as new.
 */
export function onboardingStarted(profile) {
  if (!profile) return false;
  if (profile.completedAt) return true;
  const extra = profile.extraAnswers && typeof profile.extraAnswers === 'object' ? profile.extraAnswers : {};
  return typeof extra.onboardingStepKey === 'string'
    || extra.assessmentPhaseComplete === true
    || extra.onboardingComplete === true
    || extra.onboardingVersion != null;
}

export const NEW_ACCOUNT_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * Why „I already have an account“ (POST /api/auth/me/discard-new) may not remove `user`, or null
 * when it may: 'old' (created more than a day ago, or no valid creation time), 'started' (onboarding
 * answered in the app or on the web) or 'content' (anything of the person's own, accountHasContent).
 */
export async function discardNewBlocker(user, db = prisma, now = Date.now()) {
  const age = now - new Date(user?.createdAt).getTime();
  if (!Number.isFinite(age) || age >= NEW_ACCOUNT_WINDOW_MS) return 'old';
  const profile = await db.healthProfile.findUnique({
    where: { userId: user.id },
    select: { extraAnswers: true, completedAt: true },
  });
  if (onboardingStarted(profile)) return 'started';
  if (await accountHasContent(user.id, db)) return 'content';
  return null;
}

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

const CONTENT_CHECKS = Object.freeze([
  ...CONTENT_TABLES.map((table) => ({ table, columns: ['userId'], where: '"userId" = $1' })),
  ...CONTENT_PREDICATES,
]);

/**
 * The checks whose table and columns exist. Read on every call (this runs only on a conflict or a
 * discard), never cached: a raw-SQL table created after the first read must not be missed.
 */
async function installedContentChecks(db) {
  const tables = [...new Set(CONTENT_CHECKS.map((check) => check.table))];
  const rows = await db.$queryRaw`
    SELECT table_name, column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = ANY(${tables})`;
  const present = new Set(rows.map((row) => `${row.table_name}.${row.column_name}`));
  return CONTENT_CHECKS.filter((check) => check.columns.every((column) => present.has(`${check.table}.${column}`)));
}

/** True when the account holds anything of the person's own (CONTENT_TABLES / CONTENT_PREDICATES). Fails closed. */
export async function accountHasContent(userId, db = prisma) {
  try {
    for (const check of await installedContentChecks(db)) {
      const rows = await db.$queryRawUnsafe(`SELECT 1 FROM "${check.table}" WHERE ${check.where} LIMIT 1`, userId);
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
 * `passwordHash`: the password the person chose with the email they just proved (add-email
 * conflict); the moved email signs in with it instead of the other account's old password.
 */
export async function absorbLogins(fromId, intoId, db = prisma, { passwordHash = null } = {}) {
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
      await tx.user.update({ where: { id: intoId }, data: { email: plan.email, passwordHash: passwordHash || from.passwordHash } });
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

/**
 * Proof that the signed-in `from` account proved an identifier owned by `to` (15 minutes).
 * An add-email conflict also carries the bcrypt hash of the password typed with the code, sealed
 * (AES-GCM) so the token the app holds never exposes it; move_here gives it to the moved email.
 */
export function signConflictToken({ kind, from, to, passwordHash = null }, key = secret()) {
  const pw = kind === 'email' && passwordHash ? sealSecret(passwordHash, key) : null;
  return jwt.sign({ typ: 'account-conflict', kind, from, to, ...(pw ? { pw } : {}) }, key, { expiresIn: CONFLICT_TTL });
}

export function readConflictToken(token, key = secret()) {
  try {
    const payload = jwt.verify(String(token || ''), key, { algorithms: ['HS256'] });
    if (payload?.typ !== 'account-conflict' || !payload.from || !payload.to || payload.from === payload.to) return null;
    if (!['phone', 'email', 'apple', 'google'].includes(payload.kind)) return null;
    const conflict = { kind: payload.kind, from: String(payload.from), to: String(payload.to) };
    const passwordHash = payload.kind === 'email' && payload.pw ? openSecret(payload.pw, key) : null;
    return passwordHash ? { ...conflict, passwordHash } : conflict;
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
export async function conflictPayload(lang, { kind, currentId, otherId, passwordHash = null }, db = prisma) {
  const options = await conflictOptions(currentId, otherId, db);
  const copy = TAKEN_COPY[kind];
  return {
    error: t(lang, copy[0], copy[1]),
    code: TAKEN_CODES[kind],
    conflict: options
      ? { kind, token: signConflictToken({ kind, from: currentId, to: otherId, passwordHash }), ...options }
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
