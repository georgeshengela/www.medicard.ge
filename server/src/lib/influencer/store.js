/**
 * Influencer program — database layer (raw SQL on the tables of prisma/20261016-influencers.sql).
 *
 * Money: the append-only "InfluencerLedger" is the only source of the balance (SUM(amount), tetri). A registration is
 * credited once (unique ledger event CREDIT:<referralId>), a payout leaves the balance when it is requested (PAYOUT)
 * and comes back only when rejected (RELEASE), and at most one payout is open per influencer (partial unique index),
 * so a balance can never be paid twice.
 */
import { createHash, randomBytes, randomInt, randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '../prisma.js';
import { isFeatureEnabled } from '../featureFlags.js';
import { hasVerifiedPhone } from '../phoneGate.js';
import { calculateAge, MIN_USER_AGE } from '../patient.js';
import { maskedUserRef } from '../rewardsAdmin.js';
import {
  ACCOUNT_STATUSES, AUTO_ALPHABET, CODE_LENGTH, CUSTOM_CODE_COOLDOWN_DAYS, DEFAULT_CONFIG, MAX_CODES, TERMS_VERSION,
  amountForRange, customCodeProblem, maskIban, maskPhone, normalizeEnteredCode, phoneKey, rateForPosition, tierFor,
  tierLadder, validateConfig,
} from './rules.js';

const DAY = 86400000;
export const SESSION_DAYS = 30;
const CONFIG_TTL_MS = 15_000;

export function promoError(status, ka, en, code, field) {
  const err = new Error(ka);
  err.status = status;
  err.messageEn = en ?? ka;
  err.code = code ?? undefined;
  err.field = field ?? undefined;
  err.expose = true;
  return err;
}

const sha256 = (value) => createHash('sha256').update(String(value)).digest('hex');
const num = (v) => Number(v ?? 0) || 0;

/* ───────────── settings ───────────── */

let configCache = { at: 0, value: null };

export async function loadConfig({ db = prisma, fresh = false } = {}) {
  if (!fresh && configCache.value && Date.now() - configCache.at < CONFIG_TTL_MS) return configCache.value;
  let data = {};
  try {
    const [row] = await db.$queryRaw`SELECT data FROM "InfluencerConfig" WHERE id = 1`;
    data = row?.data && typeof row.data === 'object' ? row.data : {};
  } catch {
    data = {};
  }
  const merged = validateConfig(data, DEFAULT_CONFIG);
  const value = merged.config || validateConfig(DEFAULT_CONFIG).config;
  if (db === prisma) configCache = { at: Date.now(), value };
  return value;
}

export async function saveConfig(input, { admin, db = prisma } = {}) {
  const current = await loadConfig({ db, fresh: true });
  const { config, error } = validateConfig(input, current);
  if (error) throw promoError(400, error, error, 'INVALID_CONFIG');
  await db.$executeRaw`INSERT INTO "InfluencerConfig" (id, data, "updatedAt", "updatedBy") VALUES (1, ${JSON.stringify(config)}::jsonb, now(), ${admin?.email ?? null})
    ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, "updatedAt" = now(), "updatedBy" = EXCLUDED."updatedBy"`;
  configCache = { at: 0, value: null };
  return { previous: current, config };
}

/** What anyone may see about the program (portal landing, sign-up). */
export async function publicProgram({ db = prisma } = {}) {
  const config = await loadConfig({ db });
  const on = db !== prisma || await isFeatureEnabled('influencers');
  return {
    on,
    signupOpen: on && config.signupOpen,
    tiers: tierLadder(config.tiers),
    holdDays: config.holdDays,
    entryWindowDays: config.entryWindowDays,
    minPayout: config.minPayout,
    inviteeCoins: config.inviteeCoins,
    termsVersion: TERMS_VERSION,
  };
}

/* ───────────── accounts + sessions ───────────── */

const INFLUENCER_COLUMNS = 'id, email, "fullName", "displayName", phone, socials, "photoKey", status, "statusReason", lang, "approvedAt", "createdAt", "lastLoginAt"';

export async function getInfluencer(id, { db = prisma } = {}) {
  const rows = await db.$queryRawUnsafe(`SELECT ${INFLUENCER_COLUMNS} FROM "Influencer" WHERE id = $1`, String(id));
  return rows[0] || null;
}

export async function findInfluencerByEmail(email, { db = prisma } = {}) {
  const [row] = await db.$queryRaw`SELECT id, email, "passwordHash", status, "fullName", "displayName", lang FROM "Influencer" WHERE email = ${email}`;
  return row || null;
}

async function codeTaken(code, db) {
  const [[mine], [friend]] = await Promise.all([
    db.$queryRaw`SELECT 1 AS x FROM "InfluencerCode" WHERE code = ${code}`,
    db.$queryRaw`SELECT 1 AS x FROM "ReferralCode" WHERE code = ${code}`,
  ]);
  return Boolean(mine || friend);
}

/** A fresh code in the safe alphabet that neither an influencer nor a friend's invite already uses. */
export async function freshAutoCode(db = prisma) {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    let code = '';
    for (let i = 0; i < CODE_LENGTH; i += 1) code += AUTO_ALPHABET[randomInt(AUTO_ALPHABET.length)];
    if (customCodeProblem(code) === 'OFFENSIVE' || customCodeProblem(code) === 'RESERVED') continue;
    if (!(await codeTaken(code, db))) return code;
  }
  throw new Error('INFLUENCER_CODE_UNAVAILABLE');
}

export async function createInfluencer({ email, password, fullName, displayName, phone, socials, photoKey, lang = 'ka' }, { db = prisma } = {}) {
  const id = randomUUID();
  const passwordHash = await bcrypt.hash(String(password), 11);
  const code = await freshAutoCode(db);
  try {
    await db.$transaction(async (tx) => {
      await tx.$executeRaw`INSERT INTO "Influencer" (id, email, "passwordHash", "fullName", "displayName", phone, socials, "photoKey", lang, "termsVersion", "termsAcceptedAt")
        VALUES (${id}, ${email}, ${passwordHash}, ${fullName}, ${displayName}, ${phone}, ${JSON.stringify(socials)}::jsonb, ${photoKey}, ${lang === 'en' ? 'en' : 'ka'}, ${TERMS_VERSION}, now())`;
      await tx.$executeRaw`INSERT INTO "InfluencerCode" (code, "influencerId", kind, "primary") VALUES (${code}, ${id}, 'AUTO', TRUE)`;
    });
  } catch (error) {
    if (/Influencer_email_key|unique/i.test(String(error?.message))) {
      throw promoError(409, 'ამ ელფოსტით ანგარიში უკვე არსებობს. შედი ან აღადგინე პაროლი.', 'An account with this email already exists. Sign in or reset your password.', 'EMAIL_TAKEN', 'email');
    }
    throw error;
  }
  return { id, code };
}

export async function verifyPassword(row, password) {
  if (!row?.passwordHash) return false;
  return bcrypt.compare(String(password ?? ''), row.passwordHash);
}

export async function createSession(influencerId, { db = prisma, now = new Date() } = {}) {
  const token = randomBytes(32).toString('base64url');
  await db.$executeRaw`INSERT INTO "InfluencerSession" (id, "influencerId", "tokenHash", "expiresAt") VALUES (${randomUUID()}, ${influencerId}, ${sha256(token)}, ${new Date(now.getTime() + SESSION_DAYS * DAY)})`;
  await db.$executeRaw`UPDATE "Influencer" SET "lastLoginAt" = now() WHERE id = ${influencerId}`;
  // Old sessions of this person go after 30 days anyway; keep the table small.
  await db.$executeRaw`DELETE FROM "InfluencerSession" WHERE "influencerId" = ${influencerId} AND "expiresAt" < now()`;
  return token;
}

/** Session token → { session, influencer }. Sliding: a session used in its second half is extended. */
export async function sessionFromToken(token, { db = prisma, now = new Date() } = {}) {
  if (!token || String(token).length < 20) return null;
  const [row] = await db.$queryRaw`SELECT s.id AS "sessionId", s."expiresAt", s."lastSeenAt", i.id FROM "InfluencerSession" s JOIN "Influencer" i ON i.id = s."influencerId"
    WHERE s."tokenHash" = ${sha256(token)}`;
  if (!row || new Date(row.expiresAt) <= now) return null;
  if (now.getTime() - new Date(row.lastSeenAt).getTime() > 10 * 60_000) {
    const extend = new Date(row.expiresAt).getTime() - now.getTime() < (SESSION_DAYS / 2) * DAY;
    await db.$executeRaw`UPDATE "InfluencerSession" SET "lastSeenAt" = ${now}, "expiresAt" = ${extend ? new Date(now.getTime() + SESSION_DAYS * DAY) : new Date(row.expiresAt)} WHERE id = ${row.sessionId}`;
  }
  const influencer = await getInfluencer(row.id, { db });
  return influencer ? { sessionId: row.sessionId, influencer } : null;
}

export async function deleteSession(token, { db = prisma } = {}) {
  if (!token) return;
  await db.$executeRaw`DELETE FROM "InfluencerSession" WHERE "tokenHash" = ${sha256(token)}`;
}

export async function deleteOtherSessions(influencerId, keepSessionId = null, { db = prisma } = {}) {
  await db.$executeRaw`DELETE FROM "InfluencerSession" WHERE "influencerId" = ${influencerId} AND id IS DISTINCT FROM ${keepSessionId}`;
}

export async function setPassword(influencerId, password, { db = prisma } = {}) {
  const hash = await bcrypt.hash(String(password), 11);
  await db.$executeRaw`UPDATE "Influencer" SET "passwordHash" = ${hash}, "updatedAt" = now() WHERE id = ${influencerId}`;
}

export async function updateProfile(influencerId, patch, { db = prisma } = {}) {
  const current = await getInfluencer(influencerId, { db });
  if (!current) throw promoError(404, 'ანგარიში ვერ მოიძებნა.', 'Account not found.', 'NOT_FOUND');
  const next = {
    displayName: patch.displayName ?? current.displayName,
    phone: patch.phone ?? current.phone,
    socials: patch.socials ?? current.socials,
    photoKey: patch.photoKey ?? current.photoKey,
    lang: patch.lang ?? current.lang,
  };
  await db.$executeRaw`UPDATE "Influencer" SET "displayName" = ${next.displayName}, phone = ${next.phone}, socials = ${JSON.stringify(next.socials)}::jsonb,
    "photoKey" = ${next.photoKey}, lang = ${next.lang}, "updatedAt" = now() WHERE id = ${influencerId}`;
  return { previousPhotoKey: current.photoKey, influencer: await getInfluencer(influencerId, { db }) };
}

/* ───────────── password reset ───────────── */

export const RESET_MINUTES = 15;

export async function startPasswordReset(influencerId, { db = prisma, now = new Date() } = {}) {
  const [{ n }] = await db.$queryRaw`SELECT COUNT(*)::int AS n FROM "InfluencerPasswordReset" WHERE "influencerId" = ${influencerId} AND "createdAt" > ${new Date(now.getTime() - 60 * 60_000)}`;
  if (n >= 4) return null;
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  await db.$executeRaw`UPDATE "InfluencerPasswordReset" SET "usedAt" = ${now} WHERE "influencerId" = ${influencerId} AND "usedAt" IS NULL`;
  await db.$executeRaw`INSERT INTO "InfluencerPasswordReset" (id, "influencerId", "codeHash", "expiresAt") VALUES (${randomUUID()}, ${influencerId}, ${sha256(`${influencerId}:${code}`)}, ${new Date(now.getTime() + RESET_MINUTES * 60_000)})`;
  return code;
}

/** true when the code was right (and is now used); false otherwise (5 tries per code). */
export async function consumePasswordReset(influencerId, code, { db = prisma, now = new Date() } = {}) {
  const [row] = await db.$queryRaw`SELECT id, "codeHash", attempts, "expiresAt" FROM "InfluencerPasswordReset" WHERE "influencerId" = ${influencerId} AND "usedAt" IS NULL ORDER BY "createdAt" DESC LIMIT 1`;
  if (!row || new Date(row.expiresAt) <= now || row.attempts >= 5) return false;
  if (row.codeHash !== sha256(`${influencerId}:${String(code ?? '').replace(/\D/g, '')}`)) {
    await db.$executeRaw`UPDATE "InfluencerPasswordReset" SET attempts = attempts + 1 WHERE id = ${row.id}`;
    return false;
  }
  const used = await db.$executeRaw`UPDATE "InfluencerPasswordReset" SET "usedAt" = ${now} WHERE id = ${row.id} AND "usedAt" IS NULL`;
  return used === 1;
}

/* ───────────── codes ───────────── */

export async function listCodes(influencerId, { db = prisma } = {}) {
  return db.$queryRaw`SELECT code, kind, "primary", "createdAt" FROM "InfluencerCode" WHERE "influencerId" = ${influencerId} ORDER BY "primary" DESC, "createdAt" ASC`;
}

/** Problem key (see CODE_PROBLEMS) or null when this influencer may take the code now. */
export async function customCodeAvailability(influencerId, raw, { db = prisma, now = new Date() } = {}) {
  const problem = customCodeProblem(raw);
  const code = String(raw ?? '').trim().toUpperCase().replace(/[\s-]/g, '');
  if (problem) return { code, problem };
  const [[owner], [friend], codes] = await Promise.all([
    db.$queryRaw`SELECT "influencerId" FROM "InfluencerCode" WHERE code = ${code}`,
    db.$queryRaw`SELECT 1 AS x FROM "ReferralCode" WHERE code = ${code}`,
    listCodes(influencerId, { db }),
  ]);
  if (owner?.influencerId === influencerId) return { code, problem: 'SAME' };
  if (owner || friend) return { code, problem: 'TAKEN' };
  if (codes.length >= MAX_CODES) return { code, problem: 'TOO_MANY' };
  const lastCustom = codes.filter((c) => c.kind === 'CUSTOM').map((c) => new Date(c.createdAt).getTime()).sort((a, b) => b - a)[0];
  if (lastCustom && now.getTime() - lastCustom < CUSTOM_CODE_COOLDOWN_DAYS * DAY) return { code, problem: 'TOO_SOON', nextAt: new Date(lastCustom + CUSTOM_CODE_COOLDOWN_DAYS * DAY).toISOString() };
  return { code, problem: null };
}

/** The influencer's own code becomes the one the portal shows; every older code keeps working. */
export async function setCustomCode(influencerId, raw, { db = prisma, now = new Date() } = {}) {
  const check = await customCodeAvailability(influencerId, raw, { db, now });
  if (check.problem) return check;
  try {
    await db.$transaction(async (tx) => {
      await tx.$executeRaw`UPDATE "InfluencerCode" SET "primary" = FALSE WHERE "influencerId" = ${influencerId}`;
      await tx.$executeRaw`INSERT INTO "InfluencerCode" (code, "influencerId", kind, "primary") VALUES (${check.code}, ${influencerId}, 'CUSTOM', TRUE)`;
    });
  } catch (error) {
    if (/unique|duplicate|InfluencerCode_pkey/i.test(String(error?.message))) return { code: check.code, problem: 'TAKEN' };
    throw error;
  }
  return { code: check.code, problem: null };
}

/** Typed code → the influencer behind it, or null (then it may be a friend's code). */
export async function resolveInfluencerCode(raw, { db = prisma } = {}) {
  const code = normalizeEnteredCode(raw);
  if (!code) return null;
  const [row] = await db.$queryRaw`SELECT c.code, i.id, i.status, i.email, i.phone, i."displayName", i."photoKey" FROM "InfluencerCode" c JOIN "Influencer" i ON i.id = c."influencerId" WHERE c.code = ${code}`;
  return row || null;
}

/* ───────────── registrations (from the app's „ვინ მოგიწვია?“) ───────────── */

export const CLAIM_ERRORS = Object.freeze({
  INVITER_INACTIVE: { ka: 'ეს კოდი ახლა არ მოქმედებს.', en: "This code isn't active right now." },
  OWN_CODE: { ka: 'საკუთარი კოდის შეყვანა არ შეიძლება.', en: "You can't enter your own code." },
  ALREADY_CLAIMED: { ka: 'კოდი უკვე შეყვანილი გაქვს — მისი შეცვლა აღარ შეიძლება.', en: "You've already entered a code — it can't be changed." },
  TOO_LATE: { ka: (d) => `კოდის შეყვანა რეგისტრაციიდან ${d} დღის განმავლობაში შეიძლება.`, en: (d) => `A code can be entered within ${d} days of signing up.` },
  DEVICE_USED: { ka: 'ამ მოწყობილობიდან კოდი უკვე შეყვანილია.', en: 'A code has already been entered on this device.' },
  AGE: { ka: 'ეს პროგრამა 18 წლიდანაა.', en: 'This program is for people 18 and over.' },
});

/** Pure decision for an influencer code claim; returns an error key or null. */
export function influencerClaimDecision({ invitee, influencer, config, now = new Date(), alreadyClaimed, deviceUsed, featureOn = true }) {
  if (!influencer || !featureOn || influencer.status === 'BLOCKED' || influencer.status === 'SUSPENDED') return 'INVITER_INACTIVE';
  const ownPhone = phoneKey(invitee.phone) && phoneKey(invitee.phone) === phoneKey(influencer.phone);
  const ownEmail = String(invitee.email || '').toLowerCase() === String(influencer.email || '').toLowerCase();
  if (ownPhone || ownEmail) return 'OWN_CODE';
  if (alreadyClaimed) return 'ALREADY_CLAIMED';
  if (now.getTime() - new Date(invitee.createdAt).getTime() > config.entryWindowDays * DAY) return 'TOO_LATE';
  if (deviceUsed) return 'DEVICE_USED';
  if (invitee.birthDate && (calculateAge(invitee.birthDate, now) ?? 99) < MIN_USER_AGE) return 'AGE';
  return null;
}

/**
 * Records a registration for an influencer inside the caller's transaction (referral.js holds the per-account and
 * per-device locks). Returns { id, status } or { error }.
 */
export async function insertInfluencerReferral(tx, { invitee, influencer, code, deviceHash, networkHash, config, now = new Date() }) {
  const since = new Date(now.getTime() - DAY);
  const [{ n }] = networkHash
    ? await tx.$queryRaw`SELECT COUNT(*)::int AS n FROM "InfluencerReferral" WHERE "influencerId" = ${influencer.id} AND "networkHash" = ${networkHash} AND "createdAt" >= ${since}`
    : [{ n: 0 }];
  const flagged = n + 1 >= config.networkFlag;
  const id = randomUUID();
  const inserted = await tx.$queryRaw`INSERT INTO "InfluencerReferral" (id, "influencerId", code, "userId", "userRef", "userCreatedAt", "deviceHash", "networkHash", status, flags, "holdUntil", "createdAt")
    VALUES (${id}, ${influencer.id}, ${code}, ${invitee.id}, ${maskedUserRef(invitee.id)}, ${new Date(invitee.createdAt)}, ${deviceHash}, ${networkHash},
      ${flagged ? 'FLAGGED' : 'PENDING'}, ${JSON.stringify(flagged ? [{ kind: 'NETWORK_BURST', count: n + 1 }] : [])}::jsonb, ${new Date(now.getTime() + config.holdDays * DAY)}, ${now})
    ON CONFLICT DO NOTHING RETURNING id`;
  if (!inserted.length) return { error: 'DEVICE_USED' };
  return { id, status: flagged ? 'FLAGGED' : 'PENDING' };
}

/* ───────────── hold → credit ───────────── */

/** Why a held registration must not be paid (null = pay it). SUSPENDED influencer = keep waiting ('WAIT'). */
export function holdOutcome({ user, influencerStatus, now = new Date() }) {
  if (!user) return 'ACCOUNT_DELETED';
  if (influencerStatus === 'BLOCKED') return 'INFLUENCER_BLOCKED';
  if (influencerStatus === 'SUSPENDED') return 'WAIT';
  if (user.status === 'BLOCKED') return 'ACCOUNT_BLOCKED';
  if (!hasVerifiedPhone(user)) return 'NO_PHONE';
  if (!user.birthDate) return 'AGE_UNKNOWN';
  if ((calculateAge(user.birthDate, now) ?? 0) < MIN_USER_AGE) return 'AGE';
  return null;
}

/** Credits one PENDING registration: next position, its rate, one ledger row. Safe to run twice. */
export async function creditReferral(referralId, { db = prisma, now = new Date(), config } = {}) {
  const cfg = config || await loadConfig({ db });
  return db.$transaction(async (tx) => {
    const [ref] = await tx.$queryRaw`SELECT id, "influencerId", status FROM "InfluencerReferral" WHERE id = ${referralId} FOR UPDATE`;
    if (!ref || ref.status !== 'PENDING') return null;
    // Positions are counted per influencer: queue credits behind the influencer row.
    await tx.$queryRaw`SELECT 1 AS x FROM "Influencer" WHERE id = ${ref.influencerId} FOR UPDATE`;
    const [{ n }] = await tx.$queryRaw`SELECT COUNT(*)::int AS n FROM "InfluencerReferral" WHERE "influencerId" = ${ref.influencerId} AND status = 'CREDITED'`;
    const seq = n + 1;
    const amount = rateForPosition(seq, cfg.tiers);
    await tx.$executeRaw`UPDATE "InfluencerReferral" SET status = 'CREDITED', seq = ${seq}, amount = ${amount}, "creditedAt" = ${now} WHERE id = ${ref.id}`;
    await tx.$executeRaw`INSERT INTO "InfluencerLedger" (id, "influencerId", kind, amount, "refId", "createdAt") VALUES (${randomUUID()}, ${ref.influencerId}, 'CREDIT', ${amount}, ${ref.id}, ${now})
      ON CONFLICT (kind, "refId") DO NOTHING`;
    return { seq, amount };
  });
}

let holdBusy = false;

/** Runs every 10 minutes (lease): reverses deleted accounts at once, credits or refuses registrations whose hold ended. */
export async function processInfluencerHolds({ db = prisma, now = new Date() } = {}) {
  if (holdBusy) return { busy: true };
  holdBusy = true;
  const out = { credited: 0, reversed: 0, rejected: 0, waiting: 0 };
  try {
    const config = await loadConfig({ db, fresh: true });
    const rows = await db.$queryRaw`SELECT r.id, r."userId", r."holdUntil", i.status AS "influencerStatus",
        u.id AS "uid", u.status AS "userStatus", u.phone, u."birthDate"
      FROM "InfluencerReferral" r JOIN "Influencer" i ON i.id = r."influencerId" LEFT JOIN "User" u ON u.id = r."userId"
      WHERE r.status = 'PENDING' AND (r."holdUntil" <= ${now} OR r."userId" IS NULL)
      ORDER BY r."createdAt" LIMIT 500`;
    for (const row of rows) {
      const user = row.uid ? { status: row.userStatus, phone: row.phone, birthDate: row.birthDate } : null;
      const outcome = holdOutcome({ user, influencerStatus: row.influencerStatus, now });
      if (outcome === 'WAIT') { out.waiting += 1; continue; }
      if (!outcome) {
        if (new Date(row.holdUntil) > now) continue;
        const done = await creditReferral(row.id, { db, now, config });
        if (done) out.credited += 1;
        continue;
      }
      const status = outcome === 'ACCOUNT_DELETED' ? 'REVERSED' : 'REJECTED';
      const changed = await db.$executeRaw`UPDATE "InfluencerReferral" SET status = ${status}, reason = ${outcome}, "decidedAt" = ${now} WHERE id = ${row.id} AND status = 'PENDING'`;
      if (changed) out[status === 'REVERSED' ? 'reversed' : 'rejected'] += 1;
    }
    return out;
  } finally {
    holdBusy = false;
  }
}

/* ───────────── balance + dashboard ───────────── */

export async function balanceOf(influencerId, { db = prisma } = {}) {
  const [[ledger], [payouts]] = await Promise.all([
    db.$queryRaw`SELECT COALESCE(SUM(amount), 0)::int AS available,
        COALESCE(SUM(amount) FILTER (WHERE kind = 'CREDIT'), 0)::int AS credited,
        COALESCE(SUM(amount) FILTER (WHERE kind = 'REVERSAL'), 0)::int AS reversed,
        COALESCE(SUM(amount) FILTER (WHERE kind = 'ADJUST'), 0)::int AS adjusted
      FROM "InfluencerLedger" WHERE "influencerId" = ${influencerId}`,
    db.$queryRaw`SELECT COALESCE(SUM(amount) FILTER (WHERE status = 'PAID'), 0)::int AS paid,
        COALESCE(SUM(amount) FILTER (WHERE status IN ('REQUESTED', 'APPROVED')), 0)::int AS "inProcess"
      FROM "InfluencerPayout" WHERE "influencerId" = ${influencerId}`,
  ]);
  return {
    available: num(ledger.available),
    earned: num(ledger.credited) + num(ledger.reversed) + num(ledger.adjusted),
    paid: num(payouts.paid),
    inProcess: num(payouts.inProcess),
  };
}

async function referralCounts(influencerId, db) {
  const [row] = await db.$queryRaw`SELECT
      COUNT(*) FILTER (WHERE status = 'CREDITED')::int AS credited,
      COUNT(*) FILTER (WHERE status = 'PENDING')::int AS pending,
      COUNT(*) FILTER (WHERE status = 'FLAGGED')::int AS flagged,
      COUNT(*) FILTER (WHERE status IN ('REVERSED', 'REJECTED'))::int AS "notCounted",
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE status NOT IN ('REVERSED', 'REJECTED') AND "createdAt" >= date_trunc('month', now() AT TIME ZONE 'Asia/Tbilisi') AT TIME ZONE 'Asia/Tbilisi')::int AS "thisMonth"
    FROM "InfluencerReferral" WHERE "influencerId" = ${influencerId}`;
  return { credited: num(row.credited), pending: num(row.pending), flagged: num(row.flagged), notCounted: num(row.notCounted), total: num(row.total), thisMonth: num(row.thisMonth) };
}

/** Registrations per Tbilisi day for the last `days` days (all statuses except not counted). */
export async function dailySeries(influencerId, { db = prisma, days = 30, now = new Date() } = {}) {
  const since = new Date(now.getTime() - (days - 1) * DAY);
  const rows = await db.$queryRaw`SELECT to_char(("createdAt" AT TIME ZONE 'Asia/Tbilisi')::date, 'YYYY-MM-DD') AS day, COUNT(*)::int AS n
    FROM "InfluencerReferral" WHERE "influencerId" = ${influencerId} AND status NOT IN ('REVERSED', 'REJECTED') AND "createdAt" >= ${new Date(since.getTime() - DAY)}
    GROUP BY 1`;
  const byDay = new Map(rows.map((r) => [r.day, num(r.n)]));
  const out = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(now.getTime() + 4 * 3600000 - i * DAY).toISOString().slice(0, 10);
    out.push({ day: d, n: byDay.get(d) || 0 });
  }
  return out;
}

function payoutView(p, { full = false } = {}) {
  const d = p.details || {};
  return {
    id: p.id,
    amount: num(p.amount),
    status: p.status,
    requestedAt: p.requestedAt,
    approvedAt: p.approvedAt,
    paidAt: p.paidAt,
    rejectedAt: p.rejectedAt,
    reference: p.reference || null,
    rejectReason: p.rejectReason || null,
    account: full ? d : { iban: maskIban(d.iban), bank: d.bank || null, holder: d.holder || null, payeeType: d.payeeType || null },
  };
}

/** Everything the portal dashboard shows. No consumer names or contacts — counts and days only. */
export async function dashboard(influencerId, { db = prisma, now = new Date() } = {}) {
  const [influencer, config, codes, counts, balance, series, payouts] = await Promise.all([
    getInfluencer(influencerId, { db }),
    loadConfig({ db }),
    listCodes(influencerId, { db }),
    referralCounts(influencerId, db),
    balanceOf(influencerId, { db }),
    dailySeries(influencerId, { db, days: 30, now }),
    db.$queryRaw`SELECT * FROM "InfluencerPayout" WHERE "influencerId" = ${influencerId} ORDER BY "requestedAt" DESC LIMIT 20`,
  ]);
  if (!influencer) return null;
  const tier = tierFor(counts.credited, config.tiers);
  const waiting = counts.pending + counts.flagged;
  const [nextRow] = await db.$queryRaw`SELECT MIN("holdUntil") AS at FROM "InfluencerReferral" WHERE "influencerId" = ${influencerId} AND status = 'PENDING'`;
  const open = payouts.find((p) => p.status === 'REQUESTED' || p.status === 'APPROVED');
  const primary = codes.find((c) => c.primary) || codes[0] || null;
  return {
    influencer: {
      id: influencer.id,
      fullName: influencer.fullName,
      displayName: influencer.displayName,
      email: influencer.email,
      phone: influencer.phone,
      socials: influencer.socials || {},
      hasPhoto: Boolean(influencer.photoKey),
      status: influencer.status,
      statusReason: influencer.statusReason || null,
      createdAt: influencer.createdAt,
      approvedAt: influencer.approvedAt,
    },
    code: primary?.code || null,
    codes: codes.map((c) => ({ code: c.code, kind: c.kind, primary: c.primary, createdAt: c.createdAt })),
    tier,
    ladder: tierLadder(config.tiers),
    counts,
    pendingAmount: amountForRange(counts.credited, waiting, config.tiers),
    nextCreditAt: nextRow?.at || null,
    balance,
    canRequestPayout: influencer.status === 'ACTIVE' && !open && balance.available >= config.minPayout,
    series,
    payouts: payouts.map((p) => payoutView(p)),
    rules: { holdDays: config.holdDays, entryWindowDays: config.entryWindowDays, minPayout: config.minPayout, inviteeCoins: config.inviteeCoins },
  };
}

/* ───────────── payouts ───────────── */

export async function lastPayoutDetails(influencerId, { db = prisma } = {}) {
  const [row] = await db.$queryRaw`SELECT details FROM "InfluencerPayout" WHERE "influencerId" = ${influencerId} ORDER BY "requestedAt" DESC LIMIT 1`;
  return row?.details || null;
}

/** Takes `amount` (default: the whole balance) off the balance and opens a request. */
export async function requestPayout(influencerId, { details, amount = null }, { db = prisma, now = new Date() } = {}) {
  const config = await loadConfig({ db });
  const id = randomUUID();
  try {
    return await db.$transaction(async (tx) => {
      const [inf] = await tx.$queryRaw`SELECT id, status FROM "Influencer" WHERE id = ${influencerId} FOR UPDATE`;
      if (!inf) throw promoError(404, 'ანგარიში ვერ მოიძებნა.', 'Account not found.', 'NOT_FOUND');
      if (inf.status !== 'ACTIVE') {
        throw inf.status === 'PENDING'
          ? promoError(409, 'ანგარიში ჯერ განხილვაშია. თანხის გატანა დადასტურების შემდეგ გახდება შესაძლებელი.', 'Your account is still under review. Payouts open once it is approved.', 'NOT_APPROVED')
          : promoError(409, 'ანგარიში შეჩერებულია — გატანა ახლა ვერ მოხერხდება. მოგვწერე support@medicard.ge-ზე.', 'Your account is paused, so payouts are unavailable. Write to support@medicard.ge.', 'NOT_ACTIVE');
      }
      const [open] = await tx.$queryRaw`SELECT 1 AS x FROM "InfluencerPayout" WHERE "influencerId" = ${influencerId} AND status IN ('REQUESTED', 'APPROVED')`;
      if (open) throw promoError(409, 'წინა მოთხოვნა ჯერ მუშავდება. ახალს მისი დასრულების შემდეგ გააგზავნი.', 'Your previous request is still being processed. You can send a new one after it is done.', 'PAYOUT_OPEN');
      const [{ available }] = await tx.$queryRaw`SELECT COALESCE(SUM(amount), 0)::int AS available FROM "InfluencerLedger" WHERE "influencerId" = ${influencerId}`;
      const want = amount == null ? num(available) : Math.round(Number(amount));
      if (!(want >= config.minPayout)) {
        throw promoError(409, `მინიმალური გატანა ${(config.minPayout / 100).toFixed(2)} ₾-ია.`, `The minimum payout is ${(config.minPayout / 100).toFixed(2)} ₾.`, 'BELOW_MIN');
      }
      if (want > num(available)) throw promoError(409, 'ბალანსზე ამდენი თანხა არ არის.', "Your balance isn't that high.", 'INSUFFICIENT');
      await tx.$executeRaw`INSERT INTO "InfluencerPayout" (id, "influencerId", amount, status, details, "requestedAt") VALUES (${id}, ${influencerId}, ${want}, 'REQUESTED', ${JSON.stringify(details)}::jsonb, ${now})`;
      await tx.$executeRaw`INSERT INTO "InfluencerLedger" (id, "influencerId", kind, amount, "refId", "createdAt") VALUES (${randomUUID()}, ${influencerId}, 'PAYOUT', ${-want}, ${id}, ${now})`;
      return { id, amount: want };
    });
  } catch (error) {
    if (/InfluencerPayout_open|unique|duplicate/i.test(String(error?.message)) && !error.status) {
      throw promoError(409, 'წინა მოთხოვნა ჯერ მუშავდება.', 'Your previous request is still being processed.', 'PAYOUT_OPEN');
    }
    throw error;
  }
}

async function payoutRow(id, db) {
  const [row] = await db.$queryRaw`SELECT p.*, i."displayName", i."fullName", i.email, i.phone, i.lang FROM "InfluencerPayout" p JOIN "Influencer" i ON i.id = p."influencerId" WHERE p.id = ${id}`;
  return row || null;
}

/** Admin: approve → APPROVED, paid → PAID (reference), reject → REJECTED + money back. Returns { before, after }. */
export async function decidePayout(id, { action, reference = '', reason = '' }, { admin, db = prisma, now = new Date() } = {}) {
  return db.$transaction(async (tx) => {
    const [p] = await tx.$queryRaw`SELECT * FROM "InfluencerPayout" WHERE id = ${id} FOR UPDATE`;
    if (!p) throw promoError(404, 'მოთხოვნა ვერ მოიძებნა.', 'Request not found.', 'NOT_FOUND');
    const by = admin?.email ?? null;
    if (action === 'approve') {
      if (p.status !== 'REQUESTED') throw promoError(409, 'დამტკიცება მხოლოდ ახალ მოთხოვნაზე შეიძლება.', 'Only a new request can be approved.', 'BAD_STATE');
      await tx.$executeRaw`UPDATE "InfluencerPayout" SET status = 'APPROVED', "approvedAt" = ${now}, "decidedBy" = ${by} WHERE id = ${id}`;
    } else if (action === 'paid') {
      if (p.status !== 'REQUESTED' && p.status !== 'APPROVED') throw promoError(409, 'ეს მოთხოვნა უკვე დასრულებულია.', 'This request is already closed.', 'BAD_STATE');
      await tx.$executeRaw`UPDATE "InfluencerPayout" SET status = 'PAID', "paidAt" = ${now}, "approvedAt" = COALESCE("approvedAt", ${now}), reference = ${reference || null}, "decidedBy" = ${by} WHERE id = ${id}`;
    } else if (action === 'reject') {
      if (p.status !== 'REQUESTED' && p.status !== 'APPROVED') throw promoError(409, 'ეს მოთხოვნა უკვე დასრულებულია.', 'This request is already closed.', 'BAD_STATE');
      await tx.$executeRaw`UPDATE "InfluencerPayout" SET status = 'REJECTED', "rejectedAt" = ${now}, "rejectReason" = ${reason || null}, "decidedBy" = ${by} WHERE id = ${id}`;
      await tx.$executeRaw`INSERT INTO "InfluencerLedger" (id, "influencerId", kind, amount, "refId", note, "adminEmail", "createdAt")
        VALUES (${randomUUID()}, ${p.influencerId}, 'RELEASE', ${num(p.amount)}, ${id}, ${reason || null}, ${by}, ${now}) ON CONFLICT (kind, "refId") DO NOTHING`;
    } else {
      throw promoError(400, 'უცნობი მოქმედება.', 'Unknown action.', 'BAD_ACTION');
    }
    return { before: p.status, influencerId: p.influencerId, amount: num(p.amount) };
  });
}

/* ───────────── admin ───────────── */

const INFLUENCER_SORT = 'i."createdAt" DESC';

/** List + program totals for #/influencers. */
export async function adminOverview({ status = 'ALL', q = '', db = prisma } = {}) {
  const filter = ACCOUNT_STATUSES.includes(status) ? status : null;
  const like = q ? `%${String(q).trim().toLowerCase()}%` : null;
  const [totalsRows, list, [money], [payoutsOpen], [flagged]] = await Promise.all([
    db.$queryRaw`SELECT status, COUNT(*)::int AS n FROM "Influencer" GROUP BY status`,
    db.$queryRawUnsafe(`SELECT i.id, i.email, i."fullName", i."displayName", i.phone, i.socials, i."photoKey", i.status, i."createdAt", i."approvedAt", i."lastLoginAt",
        (SELECT code FROM "InfluencerCode" c WHERE c."influencerId" = i.id ORDER BY c."primary" DESC, c."createdAt" LIMIT 1) AS code,
        COALESCE(r.credited, 0)::int AS credited, COALESCE(r.pending, 0)::int AS pending, COALESCE(r.flagged, 0)::int AS flagged,
        COALESCE(r.month, 0)::int AS month, COALESCE(r.returned, 0)::int AS returned, COALESCE(r.total, 0)::int AS total,
        COALESCE(l.available, 0)::int AS available, COALESCE(l.earned, 0)::int AS earned
      FROM "Influencer" i
      LEFT JOIN LATERAL (
        SELECT COUNT(*) FILTER (WHERE x.status = 'CREDITED') AS credited, COUNT(*) FILTER (WHERE x.status = 'PENDING') AS pending,
          COUNT(*) FILTER (WHERE x.status = 'FLAGGED') AS flagged,
          COUNT(*) FILTER (WHERE x."createdAt" >= date_trunc('month', now() AT TIME ZONE 'Asia/Tbilisi') AT TIME ZONE 'Asia/Tbilisi') AS month,
          COUNT(*) FILTER (WHERE x."userId" IS NOT NULL AND EXISTS (SELECT 1 FROM "AppActivity" a WHERE a."userId" = x."userId" AND a.date > (x."userCreatedAt" AT TIME ZONE 'Asia/Tbilisi')::date)) AS returned,
          COUNT(*) FILTER (WHERE x.status NOT IN ('REVERSED', 'REJECTED')) AS total
        FROM "InfluencerReferral" x WHERE x."influencerId" = i.id
      ) r ON TRUE
      LEFT JOIN LATERAL (
        SELECT SUM(amount) AS available, SUM(amount) FILTER (WHERE kind IN ('CREDIT', 'REVERSAL', 'ADJUST')) AS earned FROM "InfluencerLedger" g WHERE g."influencerId" = i.id
      ) l ON TRUE
      WHERE ($1::text IS NULL OR i.status = $1) AND ($2::text IS NULL OR lower(i."fullName" || ' ' || i."displayName" || ' ' || i.email || ' ' || i.phone || ' ' || i.socials::text) LIKE $2
        OR EXISTS (SELECT 1 FROM "InfluencerCode" c2 WHERE c2."influencerId" = i.id AND lower(c2.code) LIKE $2))
      ORDER BY (i.status = 'PENDING') DESC, ${INFLUENCER_SORT} LIMIT 300`, filter, like),
    db.$queryRaw`SELECT COALESCE(SUM(amount), 0)::int AS owed,
        COALESCE(SUM(amount) FILTER (WHERE kind IN ('CREDIT', 'REVERSAL', 'ADJUST')), 0)::int AS earned FROM "InfluencerLedger"`,
    db.$queryRaw`SELECT COUNT(*)::int AS n, COALESCE(SUM(amount), 0)::int AS amount,
        (SELECT COALESCE(SUM(amount), 0)::int FROM "InfluencerPayout" WHERE status = 'PAID') AS paid FROM "InfluencerPayout" WHERE status IN ('REQUESTED', 'APPROVED')`,
    db.$queryRaw`SELECT COUNT(*)::int AS n FROM "InfluencerReferral" WHERE status = 'FLAGGED'`,
  ]);
  const [reg] = await db.$queryRaw`SELECT COUNT(*) FILTER (WHERE status = 'CREDITED')::int AS credited, COUNT(*) FILTER (WHERE status = 'PENDING')::int AS pending,
      COUNT(*) FILTER (WHERE status NOT IN ('REVERSED', 'REJECTED') AND "createdAt" >= date_trunc('month', now() AT TIME ZONE 'Asia/Tbilisi') AT TIME ZONE 'Asia/Tbilisi')::int AS month,
      COUNT(*) FILTER (WHERE status IN ('REVERSED', 'REJECTED'))::int AS "notCounted"
    FROM "InfluencerReferral"`;
  const byStatus = Object.fromEntries(totalsRows.map((r) => [r.status, num(r.n)]));
  const config = await loadConfig({ db });
  return {
    totals: {
      influencers: Object.values(byStatus).reduce((a, b) => a + b, 0),
      byStatus,
      registrations: { credited: num(reg.credited), pending: num(reg.pending), month: num(reg.month), notCounted: num(reg.notCounted), flagged: num(flagged.n) },
      owed: num(money.owed) + num(payoutsOpen.amount),
      available: num(money.owed),
      earned: num(money.earned),
      paid: num(payoutsOpen.paid),
      payoutsOpen: { count: num(payoutsOpen.n), amount: num(payoutsOpen.amount) },
    },
    influencers: list.map((r) => ({
      id: r.id,
      email: r.email,
      fullName: r.fullName,
      displayName: r.displayName,
      phone: r.phone,
      socials: r.socials || {},
      hasPhoto: Boolean(r.photoKey),
      status: r.status,
      createdAt: r.createdAt,
      approvedAt: r.approvedAt,
      lastLoginAt: r.lastLoginAt,
      code: r.code,
      tier: tierFor(num(r.credited), config.tiers),
      counts: { credited: num(r.credited), pending: num(r.pending), flagged: num(r.flagged), month: num(r.month), total: num(r.total), returned: num(r.returned) },
      available: num(r.available),
      earned: num(r.earned),
    })),
    config,
  };
}

export async function adminInfluencerDetail(id, { db = prisma, now = new Date() } = {}) {
  const [row] = await db.$queryRaw`SELECT * FROM "Influencer" WHERE id = ${id}`;
  if (!row) return null;
  const [config, codes, counts, balance, series, referrals, payouts, ledger, [networks]] = await Promise.all([
    loadConfig({ db }),
    listCodes(id, { db }),
    referralCounts(id, db),
    balanceOf(id, { db }),
    dailySeries(id, { db, days: 60, now }),
    db.$queryRaw`SELECT r.id, r.code, r."userId", r."userRef", r."userCreatedAt", r.status, r.reason, r.flags, r.seq, r.amount, r."holdUntil", r."creditedAt", r."decidedAt", r."decidedBy", r."createdAt",
        u.phone, u.status AS "userStatus",
        EXISTS (SELECT 1 FROM "AppActivity" a WHERE a."userId" = r."userId" AND a.date > (r."userCreatedAt" AT TIME ZONE 'Asia/Tbilisi')::date) AS returned
      FROM "InfluencerReferral" r LEFT JOIN "User" u ON u.id = r."userId" WHERE r."influencerId" = ${id} ORDER BY r."createdAt" DESC LIMIT 300`,
    db.$queryRaw`SELECT * FROM "InfluencerPayout" WHERE "influencerId" = ${id} ORDER BY "requestedAt" DESC LIMIT 50`,
    db.$queryRaw`SELECT id, kind, amount, "refId", note, "adminEmail", "createdAt" FROM "InfluencerLedger" WHERE "influencerId" = ${id} ORDER BY "createdAt" DESC LIMIT 100`,
    db.$queryRaw`SELECT COUNT(*)::int AS total, COALESCE(MAX(n), 0)::int AS top FROM (SELECT "networkHash", COUNT(*) AS n FROM "InfluencerReferral" WHERE "influencerId" = ${id} AND "networkHash" IS NOT NULL GROUP BY 1) s`,
  ]);
  const returned = referrals.filter((r) => r.returned).length;
  const quick = referrals.filter((r) => r.userCreatedAt && new Date(r.createdAt).getTime() - new Date(r.userCreatedAt).getTime() < 10 * 60_000).length;
  return {
    influencer: {
      id: row.id, email: row.email, fullName: row.fullName, displayName: row.displayName, phone: row.phone, socials: row.socials || {},
      hasPhoto: Boolean(row.photoKey), status: row.status, statusReason: row.statusReason, adminNote: row.adminNote, lang: row.lang,
      termsVersion: row.termsVersion, termsAcceptedAt: row.termsAcceptedAt, approvedAt: row.approvedAt, lastLoginAt: row.lastLoginAt, createdAt: row.createdAt,
    },
    codes,
    tier: tierFor(counts.credited, config.tiers),
    counts,
    pendingAmount: amountForRange(counts.credited, counts.pending + counts.flagged, config.tiers),
    balance,
    series,
    quality: {
      considered: referrals.length,
      returned,
      quickEntries: quick,
      topNetworkShare: num(networks?.total) ? num(networks.top) : 0,
      networks: num(networks?.total),
    },
    referrals: referrals.map((r) => ({
      id: r.id, code: r.code, userId: r.userId, userRef: r.userRef, phone: maskPhone(r.phone), userStatus: r.userStatus || null,
      userCreatedAt: r.userCreatedAt, status: r.status, reason: r.reason, flags: r.flags || [], seq: r.seq, amount: r.amount == null ? null : num(r.amount),
      holdUntil: r.holdUntil, creditedAt: r.creditedAt, decidedAt: r.decidedAt, decidedBy: r.decidedBy, createdAt: r.createdAt, returned: Boolean(r.returned),
    })),
    payouts: payouts.map((p) => payoutView(p)),
    ledger: ledger.map((l) => ({ ...l, amount: num(l.amount) })),
  };
}

export async function adminSetStatus(id, status, reason, { db = prisma } = {}) {
  if (!ACCOUNT_STATUSES.includes(status)) throw promoError(400, 'უცნობი სტატუსი.', 'Unknown status.', 'BAD_STATUS');
  const [before] = await db.$queryRaw`SELECT status FROM "Influencer" WHERE id = ${id}`;
  if (!before) throw promoError(404, 'ინფლუენსერი ვერ მოიძებნა.', 'Influencer not found.', 'NOT_FOUND');
  await db.$executeRaw`UPDATE "Influencer" SET status = ${status}, "statusReason" = ${reason || null},
    "approvedAt" = CASE WHEN ${status} = 'ACTIVE' THEN COALESCE("approvedAt", now()) ELSE "approvedAt" END, "updatedAt" = now() WHERE id = ${id}`;
  if (status === 'BLOCKED') await db.$executeRaw`DELETE FROM "InfluencerSession" WHERE "influencerId" = ${id}`;
  return { before: before.status, after: status };
}

export async function adminSetNote(id, note, { db = prisma } = {}) {
  await db.$executeRaw`UPDATE "Influencer" SET "adminNote" = ${note || null}, "updatedAt" = now() WHERE id = ${id}`;
}

/** Bonus (+) or correction (−) with a note; one ledger row. */
export async function adminAdjust(id, amount, note, { admin, db = prisma, now = new Date() } = {}) {
  const value = Math.round(Number(amount));
  if (!Number.isFinite(value) || value === 0 || Math.abs(value) > 10_000_000) throw promoError(400, 'თანხა არასწორია.', 'Invalid amount.', 'BAD_AMOUNT');
  const [exists] = await db.$queryRaw`SELECT 1 AS x FROM "Influencer" WHERE id = ${id}`;
  if (!exists) throw promoError(404, 'ინფლუენსერი ვერ მოიძებნა.', 'Influencer not found.', 'NOT_FOUND');
  const refId = randomUUID();
  await db.$executeRaw`INSERT INTO "InfluencerLedger" (id, "influencerId", kind, amount, "refId", note, "adminEmail", "createdAt") VALUES (${randomUUID()}, ${id}, 'ADJUST', ${value}, ${refId}, ${note}, ${admin?.email ?? null}, ${now})`;
  return { amount: value };
}

/**
 * Admin decision on one registration: approve (FLAGGED → PENDING; credited at hold end), reject (PENDING/FLAGGED →
 * REJECTED), reverse (CREDITED → REVERSED with a negative ledger row).
 */
export async function adminDecideReferral(id, action, note, { admin, db = prisma, now = new Date() } = {}) {
  const by = admin?.email ?? null;
  return db.$transaction(async (tx) => {
    const [r] = await tx.$queryRaw`SELECT id, "influencerId", status, amount FROM "InfluencerReferral" WHERE id = ${id} FOR UPDATE`;
    if (!r) throw promoError(404, 'რეგისტრაცია ვერ მოიძებნა.', 'Registration not found.', 'NOT_FOUND');
    if (action === 'approve') {
      if (r.status !== 'FLAGGED') throw promoError(409, 'დასტური მხოლოდ შემოწმებაზე მყოფს სჭირდება.', 'Only a flagged registration can be approved.', 'BAD_STATE');
      await tx.$executeRaw`UPDATE "InfluencerReferral" SET status = 'PENDING', "decidedAt" = ${now}, "decidedBy" = ${by} WHERE id = ${id}`;
    } else if (action === 'reject') {
      if (r.status !== 'FLAGGED' && r.status !== 'PENDING') throw promoError(409, 'უარი მხოლოდ მოლოდინში მყოფზე შეიძლება.', 'Only a held registration can be refused.', 'BAD_STATE');
      await tx.$executeRaw`UPDATE "InfluencerReferral" SET status = 'REJECTED', reason = 'ADMIN', "decidedAt" = ${now}, "decidedBy" = ${by} WHERE id = ${id}`;
    } else if (action === 'reverse') {
      if (r.status !== 'CREDITED') throw promoError(409, 'გაუქმება მხოლოდ ჩათვლილზე შეიძლება.', 'Only a counted registration can be reversed.', 'BAD_STATE');
      await tx.$executeRaw`UPDATE "InfluencerReferral" SET status = 'REVERSED', reason = 'ADMIN', "decidedAt" = ${now}, "decidedBy" = ${by} WHERE id = ${id}`;
      await tx.$executeRaw`INSERT INTO "InfluencerLedger" (id, "influencerId", kind, amount, "refId", note, "adminEmail", "createdAt")
        VALUES (${randomUUID()}, ${r.influencerId}, 'REVERSAL', ${-num(r.amount)}, ${id}, ${note || null}, ${by}, ${now}) ON CONFLICT (kind, "refId") DO NOTHING`;
    } else {
      throw promoError(400, 'უცნობი მოქმედება.', 'Unknown action.', 'BAD_ACTION');
    }
    return { before: r.status, influencerId: r.influencerId };
  });
}

/** Registrations waiting for an admin (burst from one network), with the signals behind each. */
export async function adminFlagged({ db = prisma } = {}) {
  const rows = await db.$queryRaw`SELECT r.id, r."influencerId", r.code, r."userId", r."userRef", r."userCreatedAt", r.flags, r."holdUntil", r."createdAt", r."networkHash",
      i."displayName", i."fullName", u.phone, u.status AS "userStatus",
      (SELECT COUNT(*)::int FROM "InfluencerReferral" s WHERE s."influencerId" = r."influencerId" AND s."networkHash" = r."networkHash") AS "sameNetwork",
      EXISTS (SELECT 1 FROM "AppActivity" a WHERE a."userId" = r."userId" AND a.date > (r."userCreatedAt" AT TIME ZONE 'Asia/Tbilisi')::date) AS returned
    FROM "InfluencerReferral" r JOIN "Influencer" i ON i.id = r."influencerId" LEFT JOIN "User" u ON u.id = r."userId"
    WHERE r.status = 'FLAGGED' ORDER BY r."createdAt" DESC LIMIT 300`;
  return rows.map((r) => ({
    id: r.id, influencerId: r.influencerId, influencer: r.displayName || r.fullName, code: r.code, userId: r.userId, userRef: r.userRef, phone: maskPhone(r.phone),
    userStatus: r.userStatus || null, userCreatedAt: r.userCreatedAt, flags: r.flags || [], holdUntil: r.holdUntil, createdAt: r.createdAt,
    network: r.networkHash ? r.networkHash.slice(0, 6) : null, sameNetwork: num(r.sameNetwork), returned: Boolean(r.returned),
  }));
}

export async function adminPayouts({ status = 'OPEN', db = prisma } = {}) {
  const rows = status === 'OPEN'
    ? await db.$queryRaw`SELECT p.*, i."displayName", i."fullName", i.email, i.phone, i.status AS "influencerStatus" FROM "InfluencerPayout" p JOIN "Influencer" i ON i.id = p."influencerId"
        WHERE p.status IN ('REQUESTED', 'APPROVED') ORDER BY p."requestedAt" ASC LIMIT 300`
    : await db.$queryRaw`SELECT p.*, i."displayName", i."fullName", i.email, i.phone, i.status AS "influencerStatus" FROM "InfluencerPayout" p JOIN "Influencer" i ON i.id = p."influencerId"
        WHERE (${status} = 'ALL' OR p.status = ${status}) ORDER BY p."requestedAt" DESC LIMIT 300`;
  const [counts] = await db.$queryRaw`SELECT COUNT(*) FILTER (WHERE status = 'REQUESTED')::int AS requested, COUNT(*) FILTER (WHERE status = 'APPROVED')::int AS approved,
      COUNT(*) FILTER (WHERE status = 'PAID')::int AS paid, COUNT(*) FILTER (WHERE status = 'REJECTED')::int AS rejected FROM "InfluencerPayout"`;
  return {
    counts: { requested: num(counts.requested), approved: num(counts.approved), paid: num(counts.paid), rejected: num(counts.rejected) },
    payouts: rows.map((p) => ({ ...payoutView(p, { full: true }), influencerId: p.influencerId, influencer: { name: p.displayName, fullName: p.fullName, email: p.email, phone: p.phone, status: p.influencerStatus }, decidedBy: p.decidedBy })),
  };
}

export async function payoutForNotice(id, { db = prisma } = {}) {
  return payoutRow(id, db);
}

export async function adminPhotoKey(id, { db = prisma } = {}) {
  return db.$queryRaw`SELECT "photoKey" FROM "Influencer" WHERE id = ${id}`;
}

/** Hold → credit pass every 10 minutes under one lease (one instance does it; the per-row PENDING guard keeps it single). */
export function startInfluencerJobs({ intervalMs = 10 * 60 * 1000 } = {}) {
  if (process.env.NODE_ENV === 'test' || process.env.INFLUENCER_JOBS_DISABLED === 'true') return null;
  const tick = () => import('../jobLease.js')
    .then(({ withJobLease }) => withJobLease('influencer-holds', intervalMs * 1.5, () => processInfluencerHolds()))
    .catch((error) => console.warn('[influencers] hold pass failed', error?.message));
  const timer = setInterval(tick, intervalMs);
  timer.unref?.();
  setTimeout(tick, 90 * 1000).unref?.();
  return timer;
}
