import { createHash, randomInt, randomUUID } from 'node:crypto';
import { prisma } from './prisma.js';
import { sendExpoPush } from './push.js';
import { hasVerifiedPhone } from './phoneGate.js';
import { getLevelForXp } from './questLevels.js';
import { maskedUserRef } from './rewardsAdmin.js';

/**
 * Referral with Medi coins (Phase 3.4, 2026-09-27).
 * A person shares a personal code. A new account (≤ CLAIM_WINDOW_DAYS old) can enter it once.
 * Coins go to both sides only after the invitee's first health action and only when both have a
 * verified phone. One device per referral, inviter paid at most INVITER_MONTHLY_CAP times a month.
 * Medi coins have no monetary value. Ledger rows: sourceType REFERRAL, unique per side.
 */
export const REFERRAL_COINS = 100;
export const INVITER_MONTHLY_CAP = 5;
export const CLAIM_WINDOW_DAYS = 14;
export const REWARD_WINDOW_DAYS = 30;
export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const CODE_LENGTH = 6;
const DAY = 86400000;

export const REFERRAL_ERRORS = {
  CODE_NOT_FOUND: 'ასეთი კოდი ვერ ვიპოვეთ. გადაამოწმე და სცადე ხელახლა.',
  OWN_CODE: 'საკუთარი კოდის შეყვანა არ შეიძლება.',
  ALREADY_CLAIMED: 'მოწვევის კოდი უკვე შეყვანილი გაქვს.',
  TOO_LATE: `მოწვევის კოდის შეყვანა შესაძლებელია რეგისტრაციიდან ${CLAIM_WINDOW_DAYS} დღის განმავლობაში.`,
  CYCLE: 'ამ ადამიანს შენ მოიწვიე — ერთმანეთის კოდს ვერ შეიყვანთ.',
  DEVICE_USED: 'ამ მოწყობილობიდან მოწვევის კოდი უკვე გამოყენებულია.',
  INVITER_INACTIVE: 'ეს კოდი ახლა არ მოქმედებს.',
};

export function generateCode(pick = (n) => randomInt(n)) {
  let out = '';
  for (let i = 0; i < CODE_LENGTH; i += 1) out += CODE_ALPHABET[pick(CODE_ALPHABET.length)];
  return out;
}

export function normalizeCode(raw) {
  const code = String(raw ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return code.length === CODE_LENGTH && [...code].every((c) => CODE_ALPHABET.includes(c)) ? code : null;
}

export function deviceHashOf(installId) {
  const id = String(installId ?? '').trim();
  if (id.length < 8 || id.length > 200) return null;
  return createHash('sha256').update(`medicard-referral:${id}`).digest('hex');
}

export function inviteLink(code) {
  return `https://medicard.ge/i/${code}`;
}

/** Start of the current month in Tbilisi (UTC+4, no DST), as a UTC Date. */
export function tbilisiMonthStart(now = new Date()) {
  const t = new Date(now.getTime() + 4 * 3600000);
  return new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), 1) - 4 * 3600000);
}

/** Pure claim decision. Returns an error code or null when the claim may be recorded. */
export function claimDecision({ invitee, inviter, now = new Date(), alreadyReferred, inviterReferredByInvitee, deviceUsed }) {
  if (!inviter) return 'CODE_NOT_FOUND';
  if (inviter.id === invitee.id) return 'OWN_CODE';
  if (alreadyReferred) return 'ALREADY_CLAIMED';
  if (now.getTime() - new Date(invitee.createdAt).getTime() > CLAIM_WINDOW_DAYS * DAY) return 'TOO_LATE';
  if (inviterReferredByInvitee) return 'CYCLE';
  if (deviceUsed) return 'DEVICE_USED';
  if (inviter.status !== 'ACTIVE') return 'INVITER_INACTIVE';
  return null;
}

/** Pure reward decision for one pending referral. */
export function rewardDecision({ referral, invitee, inviter, hasHealthAction, inviterRewardedThisMonth, now = new Date() }) {
  if (now.getTime() - new Date(referral.createdAt).getTime() > REWARD_WINDOW_DAYS * DAY) return { action: 'EXPIRE' };
  if (!invitee || invitee.status !== 'ACTIVE') return { action: 'WAIT' };
  if (!hasVerifiedPhone(invitee) || !hasHealthAction) return { action: 'WAIT' };
  const inviterOk = Boolean(inviter && inviter.status === 'ACTIVE' && hasVerifiedPhone(inviter) && inviterRewardedThisMonth < INVITER_MONTHLY_CAP);
  return { action: 'REWARD', inviter: inviterOk };
}

export async function getOrCreateCode(userId, { db = prisma } = {}) {
  const [row] = await db.$queryRaw`SELECT code FROM "ReferralCode" WHERE "userId" = ${userId}`;
  if (row) return row.code;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const code = generateCode();
    const inserted = await db.$queryRaw`INSERT INTO "ReferralCode" ("userId", code) VALUES (${userId}, ${code})
      ON CONFLICT DO NOTHING RETURNING code`;
    if (inserted.length) return inserted[0].code;
    const [again] = await db.$queryRaw`SELECT code FROM "ReferralCode" WHERE "userId" = ${userId}`;
    if (again) return again.code;
  }
  throw new Error('REFERRAL_CODE_UNAVAILABLE');
}

export async function claimReferral({ invitee, code: rawCode, installId }, { db = prisma, now = new Date() } = {}) {
  const code = normalizeCode(rawCode);
  const fail = (key) => ({ ok: false, code: `REFERRAL_${key}`, error: REFERRAL_ERRORS[key] });
  if (!code) return fail('CODE_NOT_FOUND');
  const [owner] = await db.$queryRaw`SELECT u.id, u.status FROM "ReferralCode" c JOIN "User" u ON u.id = c."userId" WHERE c.code = ${code}`;
  const deviceHash = deviceHashOf(installId);
  const [[referred], [cycle], [device]] = await Promise.all([
    db.$queryRaw`SELECT 1 AS x FROM "Referral" WHERE "inviteeId" = ${invitee.id}`,
    owner ? db.$queryRaw`SELECT 1 AS x FROM "Referral" WHERE "inviterId" = ${invitee.id} AND "inviteeId" = ${owner.id}` : Promise.resolve([]),
    deviceHash ? db.$queryRaw`SELECT 1 AS x FROM "Referral" WHERE "deviceHash" = ${deviceHash}` : Promise.resolve([]),
  ]);
  const reason = claimDecision({ invitee, inviter: owner, now, alreadyReferred: Boolean(referred), inviterReferredByInvitee: Boolean(cycle), deviceUsed: Boolean(device) });
  if (reason) return fail(reason);
  const inserted = await db.$queryRaw`INSERT INTO "Referral" (id, "inviterId", "inviteeId", code, "deviceHash")
    VALUES (${randomUUID()}, ${owner.id}, ${invitee.id}, ${code}, ${deviceHash})
    ON CONFLICT DO NOTHING RETURNING id`;
  if (!inserted.length) return fail(deviceHash ? 'DEVICE_USED' : 'ALREADY_CLAIMED');
  return { ok: true, status: 'PENDING' };
}

async function hasHealthAction(db, userId) {
  const [row] = await db.$queryRaw`SELECT (
      EXISTS (SELECT 1 FROM "MedicationSchedule" WHERE "userId" = ${userId})
      OR EXISTS (SELECT 1 FROM "DailyCheckIn" WHERE "userId" = ${userId})
      OR EXISTS (SELECT 1 FROM "DoctorVisit" WHERE "userId" = ${userId})
      OR EXISTS (SELECT 1 FROM "MedicalRecord" WHERE "userId" = ${userId})
      OR EXISTS (SELECT 1 FROM "NutritionMeal" WHERE "userId" = ${userId})
      OR EXISTS (SELECT 1 FROM "CycleLog" WHERE "userId" = ${userId})
    ) AS ok`;
  return Boolean(row?.ok);
}

async function syncQuestCache(tx, userId) {
  const rows = await tx.rewardLedger.groupBy({ by: ['currency'], where: { userId }, _sum: { amount: true } });
  const sum = (c) => rows.find((r) => r.currency === c)?._sum.amount ?? 0;
  const xp = sum('XP');
  const coins = sum('COIN');
  const level = getLevelForXp(xp).level;
  await tx.userQuestProfile.upsert({
    where: { userId },
    update: { cachedCoinBalance: coins, totalXp: xp, currentLevel: level },
    create: { userId, cachedCoinBalance: coins, totalXp: xp, currentLevel: level },
  });
}

async function earn(tx, userId, side, referralId, now) {
  await tx.rewardLedger.create({
    data: { userId, currency: 'COIN', amount: REFERRAL_COINS, transactionType: 'EARN', sourceType: 'REFERRAL', sourceId: `${side}:${referralId}`, createdAt: now, metadata: { side } },
  });
  await syncQuestCache(tx, userId);
}

async function notify(db, send, userId, body) {
  const tokens = (await db.pushToken.findMany({ where: { userId, active: true }, select: { token: true } })).map((t) => t.token);
  if (tokens.length) await send(tokens, { title: `+${REFERRAL_COINS} Medi მონეტა`, body, data: { url: '/profile/invite' } }).catch(() => null);
}

let busy = false;

export async function processPendingReferrals({ db = prisma, now = new Date(), send = sendExpoPush } = {}) {
  if (busy) return { rewarded: 0 };
  busy = true;
  let rewarded = 0;
  try {
    await db.$executeRaw`UPDATE "Referral" SET status = 'EXPIRED', reason = 'NO_ACTION' WHERE status = 'PENDING' AND "createdAt" < ${new Date(now.getTime() - REWARD_WINDOW_DAYS * DAY)}`;
    const pending = await db.$queryRaw`SELECT id, "inviterId", "inviteeId", "createdAt" FROM "Referral" WHERE status = 'PENDING' ORDER BY "createdAt" LIMIT 200`;
    const monthStart = tbilisiMonthStart(now);
    for (const referral of pending) {
      const people = await db.user.findMany({ where: { id: { in: [referral.inviterId, referral.inviteeId] } }, select: { id: true, status: true, phone: true } });
      const invitee = people.find((p) => p.id === referral.inviteeId);
      const inviter = people.find((p) => p.id === referral.inviterId);
      if (!invitee || !hasVerifiedPhone(invitee)) continue;
      const [{ n }] = await db.$queryRaw`SELECT count(*)::int AS n FROM "Referral" WHERE "inviterId" = ${referral.inviterId} AND "inviterRewarded" = TRUE AND "rewardedAt" >= ${monthStart}`;
      const decision = rewardDecision({ referral, invitee, inviter, hasHealthAction: await hasHealthAction(db, invitee.id), inviterRewardedThisMonth: n, now });
      if (decision.action !== 'REWARD') continue;
      const done = await db.$transaction(async (tx) => {
        const claimed = await tx.$executeRaw`UPDATE "Referral" SET status = 'REWARDED', "rewardedAt" = ${now}, "inviterRewarded" = ${decision.inviter},
          reason = ${decision.inviter ? null : 'INVITER_NOT_ELIGIBLE'} WHERE id = ${referral.id} AND status = 'PENDING'`;
        if (!claimed) return false;
        await earn(tx, invitee.id, 'invitee', referral.id, now);
        if (decision.inviter) await earn(tx, inviter.id, 'inviter', referral.id, now);
        return true;
      });
      if (!done) continue;
      rewarded += 1;
      await notify(db, send, invitee.id, 'მოწვევის ბონუსი ჩაგერიცხა. მადლობა, რომ MEDICARD-ს იყენებ!');
      if (decision.inviter) await notify(db, send, inviter.id, 'შენმა მოწვეულმა MEDICARD-ით სარგებლობა დაიწყო — ბონუსი ჩაგერიცხა.');
    }
    return { rewarded };
  } finally {
    busy = false;
  }
}

export async function referralSummary(userId, { db = prisma, now = new Date(), withCode = true } = {}) {
  const [code, [counts], [mine], [me]] = await Promise.all([
    withCode ? getOrCreateCode(userId, { db }) : Promise.resolve(null),
    db.$queryRaw`SELECT count(*)::int AS invited,
        count(*) FILTER (WHERE status = 'PENDING')::int AS pending,
        count(*) FILTER (WHERE "inviterRewarded")::int AS rewarded,
        count(*) FILTER (WHERE "inviterRewarded" AND "rewardedAt" >= ${tbilisiMonthStart(now)})::int AS "rewardedThisMonth"
      FROM "Referral" WHERE "inviterId" = ${userId}`,
    db.$queryRaw`SELECT status FROM "Referral" WHERE "inviteeId" = ${userId}`,
    db.$queryRaw`SELECT "createdAt" FROM "User" WHERE id = ${userId}`,
  ]);
  const canClaim = !mine && Boolean(me) && now.getTime() - new Date(me.createdAt).getTime() <= CLAIM_WINDOW_DAYS * DAY;
  return {
    code,
    link: code ? inviteLink(code) : null,
    phoneRequired: !withCode,
    coinsPerSide: REFERRAL_COINS,
    monthlyCap: INVITER_MONTHLY_CAP,
    invited: counts?.invited ?? 0,
    pending: counts?.pending ?? 0,
    rewarded: counts?.rewarded ?? 0,
    coinsEarned: (counts?.rewarded ?? 0) * REFERRAL_COINS,
    monthRemaining: Math.max(0, INVITER_MONTHLY_CAP - (counts?.rewardedThisMonth ?? 0)),
    invitedBy: mine ? { status: mine.status } : null,
    canClaim,
  };
}

export async function referralAdminOverview({ db = prisma, now = new Date() } = {}) {
  const [[totals], top, recent] = await Promise.all([
    db.$queryRaw`SELECT count(*)::int AS total,
        count(*) FILTER (WHERE status = 'PENDING')::int AS pending,
        count(*) FILTER (WHERE status = 'REWARDED')::int AS rewarded,
        count(*) FILTER (WHERE status = 'EXPIRED')::int AS expired,
        count(*) FILTER (WHERE "createdAt" >= ${tbilisiMonthStart(now)})::int AS "thisMonth"
      FROM "Referral"`,
    db.$queryRaw`SELECT "inviterId", count(*)::int AS invited, count(*) FILTER (WHERE "inviterRewarded")::int AS rewarded
      FROM "Referral" GROUP BY "inviterId" ORDER BY invited DESC LIMIT 20`,
    db.$queryRaw`SELECT id, status, reason, "inviterRewarded", "createdAt", "rewardedAt", "inviterId", "inviteeId"
      FROM "Referral" ORDER BY "createdAt" DESC LIMIT 50`,
  ]);
  // Masked refs only, like the rest of Rewards admin; user ids stay for the investigation link.
  const mask = ({ inviterId, inviteeId, ...row }) => ({
    ...row,
    inviterId,
    inviter: maskedUserRef(inviterId),
    ...(inviteeId ? { inviteeId, invitee: maskedUserRef(inviteeId) } : {}),
  });
  return { totals, top: top.map(mask), recent: recent.map(mask), rules: { coinsPerSide: REFERRAL_COINS, monthlyCap: INVITER_MONTHLY_CAP, claimWindowDays: CLAIM_WINDOW_DAYS, rewardWindowDays: REWARD_WINDOW_DAYS } };
}

export function startReferralRewards({ intervalMs = 10 * 60 * 1000 } = {}) {
  if (process.env.NODE_ENV === 'test' || process.env.REFERRAL_REWARDS_DISABLED === 'true') return null;
  const tick = () => processPendingReferrals().catch((error) => console.warn('[referral] reward pass failed', error?.message));
  const timer = setInterval(tick, intervalMs);
  timer.unref?.();
  setTimeout(tick, 60 * 1000).unref?.();
  return timer;
}
