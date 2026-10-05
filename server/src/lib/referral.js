import { isFeatureEnabled } from './featureFlags.js';
import { createHash, randomInt, randomUUID } from 'node:crypto';
import { withJobLease } from './jobLease.js';
import { prisma } from './prisma.js';
import { sendExpoPush } from './push.js';
import { getLevelForXp } from './questLevels.js';
import { maskedUserRef } from './rewardsAdmin.js';
import { getUserLanguages, langOf } from './i18n.js';

/**
 * Referral with Medi coins (Phase 3.4, simplified by the owner 2026-10-05).
 * A person with a verified phone shares a personal code. A new account (≤ CLAIM_WINDOW_DAYS old)
 * enters it once on the invite page and both sides get REFERRAL_COINS at that moment, in the same
 * transaction. One code invites at most MONTHLY_INVITES people per Tbilisi calendar month. One device per referral.
 * Medi coins have no monetary value. Ledger rows: sourceType REFERRAL, unique per side.
 * While the admin switch `referralRewards` is off a claim is kept PENDING and paid once it is back on.
 */
export const REFERRAL_COINS = 25;
export const MONTHLY_INVITES = 5;
export const CLAIM_WINDOW_DAYS = 14;
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
  DEVICE_REQUIRED: 'მოწვევის კოდი აპიდან შეიყვანე.',
  INVITER_INACTIVE: 'ეს კოდი ახლა არ მოქმედებს.',
  NETWORK_USED: 'ამ ქსელიდან ამ კოდით მოწვევა უკვე დაფიქსირდა.',
  LIMIT_REACHED: `ამ თვეში ამ კოდით უკვე ${MONTHLY_INVITES} მეგობარია მოწვეული. კოდი ისევ იმუშავებს ახალი თვის 1-ლი რიცხვიდან.`,
};

export const REFERRAL_ERRORS_EN = {
  CODE_NOT_FOUND: "We couldn't find that code. Check it and try again.",
  OWN_CODE: "You can't enter your own code.",
  ALREADY_CLAIMED: "You've already entered an invite code.",
  TOO_LATE: `An invite code can be entered within ${CLAIM_WINDOW_DAYS} days of signing up.`,
  CYCLE: "You invited this person — you can't enter each other's codes.",
  DEVICE_USED: 'An invite code has already been used on this device.',
  DEVICE_REQUIRED: 'Enter the invite code in the app.',
  INVITER_INACTIVE: "This code isn't active right now.",
  NETWORK_USED: 'An invite with this code was already recorded from this network.',
  LIMIT_REACHED: `This code has already invited ${MONTHLY_INVITES} friends this month. It works again from the 1st of next month.`,
};

/**
 * Same inviter, same client network, within this window: at most three claims. installId alone is
 * client-supplied, so the request IP is the only server-observed signal against one person farming
 * codes from one place. The cap is deliberately loose: Georgian mobile carriers put many unrelated
 * subscribers behind one CGNAT address, and households share Wi-Fi, so two was hitting real friends.
 * We cannot tell a carrier NAT from a home router without an IP-intelligence lookup, so the rule
 * stays uniform and relies on the per-device, verified-phone and monthly caps for the rest.
 */
export const NETWORK_WINDOW_DAYS = 30;
export const NETWORK_CLAIMS_PER_INVITER = 3;

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

/** Server-observed network (request IP), hashed; never stored raw. */
export function networkHashOf(ip) {
  const value = String(ip ?? '').trim().replace(/^::ffff:/, '');
  if (!value || value === 'unknown') return null;
  return createHash('sha256').update(`medicard-referral-net:${value}`).digest('hex');
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
export function claimDecision({ invitee, inviter, now = new Date(), alreadyReferred, inviterReferredByInvitee, deviceUsed, networkClaims = 0, inviterInvites = 0 }) {
  if (!inviter) return 'CODE_NOT_FOUND';
  if (inviter.id === invitee.id) return 'OWN_CODE';
  if (alreadyReferred) return 'ALREADY_CLAIMED';
  if (now.getTime() - new Date(invitee.createdAt).getTime() > CLAIM_WINDOW_DAYS * DAY) return 'TOO_LATE';
  if (inviterReferredByInvitee) return 'CYCLE';
  if (deviceUsed) return 'DEVICE_USED';
  if (networkClaims >= NETWORK_CLAIMS_PER_INVITER) return 'NETWORK_USED';
  if (inviter.status !== 'ACTIVE') return 'INVITER_INACTIVE';
  if (inviterInvites >= MONTHLY_INVITES) return 'LIMIT_REACHED';
  return null;
}

/** "Nino Beridze" → "Nino B." — the inviter sees who joined, never the full name or contact. */
export function inviteeLabel(fullName, fallback = 'მეგობარი') {
  const parts = String(fullName ?? '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length || parts[0].includes('@')) return fallback;
  return parts.length > 1 ? `${parts[0]} ${[...parts[1]][0]}.` : parts[0];
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

async function referralRewardsOn(db) {
  return db !== prisma || isFeatureEnabled('referralRewards');
}

export async function claimReferral({ invitee, code: rawCode, installId, ip, lang = 'ka' }, { db = prisma, now = new Date(), send = sendExpoPush } = {}) {
  const code = normalizeCode(rawCode);
  const errors = langOf(lang) === 'en' ? REFERRAL_ERRORS_EN : REFERRAL_ERRORS;
  const fail = (key) => ({ ok: false, code: `REFERRAL_${key}`, error: errors[key] });
  if (!code) return fail('CODE_NOT_FOUND');
  const [owner] = await db.$queryRaw`SELECT u.id, u.status, u."fullName" FROM "ReferralCode" c JOIN "User" u ON u.id = c."userId" WHERE c.code = ${code}`;
  // One device per referral: a claim without a device id could dodge the unique index.
  const deviceHash = deviceHashOf(installId);
  if (!deviceHash) return fail('DEVICE_REQUIRED');
  const networkHash = networkHashOf(ip);
  const networkSince = new Date(now.getTime() - NETWORK_WINDOW_DAYS * DAY);
  const monthStart = tbilisiMonthStart(now);
  const [[referred], [cycle], [device], [network], [invites]] = await Promise.all([
    db.$queryRaw`SELECT 1 AS x FROM "Referral" WHERE "inviteeId" = ${invitee.id}`,
    owner ? db.$queryRaw`SELECT 1 AS x FROM "Referral" WHERE "inviterId" = ${invitee.id} AND "inviteeId" = ${owner.id}` : Promise.resolve([]),
    db.$queryRaw`SELECT 1 AS x FROM "Referral" WHERE "deviceHash" = ${deviceHash}`,
    owner && networkHash
      ? db.$queryRaw`SELECT COUNT(*)::int AS n FROM "Referral" WHERE "inviterId" = ${owner.id} AND "networkHash" = ${networkHash} AND "createdAt" >= ${networkSince}`
      : Promise.resolve([{ n: 0 }]),
    owner ? db.$queryRaw`SELECT COUNT(*)::int AS n FROM "Referral" WHERE "inviterId" = ${owner.id} AND status <> 'REJECTED' AND "createdAt" >= ${monthStart}` : Promise.resolve([{ n: 0 }]),
  ]);
  const reason = claimDecision({
    invitee, inviter: owner, now,
    alreadyReferred: Boolean(referred), inviterReferredByInvitee: Boolean(cycle), deviceUsed: Boolean(device),
    networkClaims: Number(network?.n ?? 0), inviterInvites: Number(invites?.n ?? 0),
  });
  if (reason) return fail(reason);
  const pay = await referralRewardsOn(db);
  const id = randomUUID();
  const result = await db.$transaction(async (tx) => {
    // Claims on one code queue behind this row lock, so the monthly cap holds under concurrency.
    await tx.$queryRaw`SELECT 1 AS x FROM "ReferralCode" WHERE "userId" = ${owner.id} FOR UPDATE`;
    const [{ n }] = await tx.$queryRaw`SELECT COUNT(*)::int AS n FROM "Referral" WHERE "inviterId" = ${owner.id} AND status <> 'REJECTED' AND "createdAt" >= ${monthStart}`;
    if (n >= MONTHLY_INVITES) return { error: 'LIMIT_REACHED' };
    const inserted = await tx.$queryRaw`INSERT INTO "Referral" (id, "inviterId", "inviteeId", code, "deviceHash", "networkHash", status, "inviterRewarded", "rewardedAt")
      VALUES (${id}, ${owner.id}, ${invitee.id}, ${code}, ${deviceHash}, ${networkHash}, ${pay ? 'REWARDED' : 'PENDING'}, ${pay}, ${pay ? now : null})
      ON CONFLICT DO NOTHING RETURNING id`;
    if (!inserted.length) return { error: 'DEVICE_USED' };
    if (!pay) return { balance: null };
    const balance = await earn(tx, invitee.id, 'invitee', id, now);
    await earn(tx, owner.id, 'inviter', id, now);
    return { balance };
  });
  if (result.error) return fail(result.error);
  if (pay) void notifyInviter(db, send, owner.id);
  return {
    ok: true,
    status: pay ? 'REWARDED' : 'PENDING',
    coins: pay ? REFERRAL_COINS : 0,
    balance: result.balance,
    inviter: inviteeLabel(owner.fullName, langOf(lang) === 'en' ? 'Friend' : 'მეგობარი'),
  };
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
  return coins;
}

async function earn(tx, userId, side, referralId, now) {
  await tx.rewardLedger.create({
    data: { userId, currency: 'COIN', amount: REFERRAL_COINS, transactionType: 'EARN', sourceType: 'REFERRAL', sourceId: `${side}:${referralId}`, createdAt: now, metadata: { side } },
  });
  return syncQuestCache(tx, userId);
}

async function notify(db, send, userId, body, lang = 'ka') {
  const tokens = (await db.pushToken.findMany({ where: { userId, active: true }, select: { token: true } })).map((t) => t.token);
  const title = langOf(lang) === 'en' ? `+${REFERRAL_COINS} Medi Coins` : `+${REFERRAL_COINS} Medi მონეტა`;
  if (tokens.length) await send(tokens, { title, body, data: { route: '/profile/invite' } }).catch(() => null);
}

async function notifyInviter(db, send, inviterId) {
  try {
    const lang = db === prisma ? (await getUserLanguages([inviterId])).get(String(inviterId)) ?? 'ka' : 'ka';
    await notify(db, send, inviterId, langOf(lang) === 'en'
      ? 'A friend entered your invite code — your bonus has been added.'
      : 'მეგობარმა შენი მოწვევის კოდი შეიყვანა — ბონუსი ჩაგერიცხა.', lang);
  } catch {
    // A missed push never undoes the payout.
  }
}

let busy = false;

/** Pays claims recorded while the admin switch `referralRewards` was off. */
export async function processPendingReferrals({ db = prisma, now = new Date(), send = sendExpoPush } = {}) {
  if (!(await referralRewardsOn(db))) return { rewarded: 0, paused: true };
  if (busy) return { rewarded: 0 };
  busy = true;
  let rewarded = 0;
  try {
    const pending = await db.$queryRaw`SELECT id, "inviterId", "inviteeId" FROM "Referral" WHERE status = 'PENDING' ORDER BY "createdAt" LIMIT 200`;
    for (const referral of pending) {
      const done = await db.$transaction(async (tx) => {
        const claimed = await tx.$executeRaw`UPDATE "Referral" SET status = 'REWARDED', "rewardedAt" = ${now}, "inviterRewarded" = TRUE, reason = NULL
          WHERE id = ${referral.id} AND status = 'PENDING'`;
        if (!claimed) return false;
        await earn(tx, referral.inviteeId, 'invitee', referral.id, now);
        await earn(tx, referral.inviterId, 'inviter', referral.id, now);
        return true;
      });
      if (!done) continue;
      rewarded += 1;
      await notifyInviter(db, send, referral.inviterId);
    }
    return { rewarded };
  } finally {
    busy = false;
  }
}

export async function referralSummary(userId, { db = prisma, now = new Date(), withCode = true, lang = 'ka' } = {}) {
  const friend = langOf(lang) === 'en' ? 'Friend' : 'მეგობარი';
  const [code, invitees, paid, [mine], [me]] = await Promise.all([
    withCode ? getOrCreateCode(userId, { db }) : Promise.resolve(null),
    db.$queryRaw`SELECT r.status, r."createdAt", u."fullName" FROM "Referral" r JOIN "User" u ON u.id = r."inviteeId"
      WHERE r."inviterId" = ${userId} AND r.status <> 'REJECTED' ORDER BY r."createdAt" DESC`,
    db.rewardLedger.aggregate({ where: { userId, sourceType: 'REFERRAL', sourceId: { startsWith: 'inviter:' } }, _sum: { amount: true } }),
    db.$queryRaw`SELECT r.status, u."fullName" FROM "Referral" r JOIN "User" u ON u.id = r."inviterId" WHERE r."inviteeId" = ${userId}`,
    db.$queryRaw`SELECT "createdAt" FROM "User" WHERE id = ${userId}`,
  ]);
  const canClaim = !mine && Boolean(me) && now.getTime() - new Date(me.createdAt).getTime() <= CLAIM_WINDOW_DAYS * DAY;
  const invited = invitees.length;
  const rewarded = invitees.filter((r) => r.status === 'REWARDED').length;
  const monthStart = tbilisiMonthStart(now);
  const invitedThisMonth = invitees.filter((r) => new Date(r.createdAt) >= monthStart).length;
  const monthRemaining = Math.max(0, MONTHLY_INVITES - invitedThisMonth);
  return {
    code,
    link: code ? inviteLink(code) : null,
    phoneRequired: !withCode,
    coinsPerSide: REFERRAL_COINS,
    claimWindowDays: CLAIM_WINDOW_DAYS,
    invited,
    pending: invited - rewarded,
    rewarded,
    coinsEarned: paid?._sum?.amount ?? 0,
    invitees: invitees.map((r) => ({
      name: inviteeLabel(r.fullName, friend),
      at: new Date(r.createdAt).toISOString(),
      status: r.status,
      coins: r.status === 'REWARDED' ? REFERRAL_COINS : 0,
    })),
    monthlyCap: MONTHLY_INVITES,
    invitedThisMonth,
    monthRemaining,
    invitedBy: mine ? { status: mine.status, name: inviteeLabel(mine.fullName, friend) } : null,
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
  return { totals, top: top.map(mask), recent: recent.map(mask), rules: { coinsPerSide: REFERRAL_COINS, monthlyCap: MONTHLY_INVITES, claimWindowDays: CLAIM_WINDOW_DAYS } };
}

export function startReferralRewards({ intervalMs = 10 * 60 * 1000 } = {}) {
  if (process.env.NODE_ENV === 'test' || process.env.REFERRAL_REWARDS_DISABLED === 'true') return null;
  // The per-row PENDING claim already makes payouts single; the lease also keeps pushes to one instance.
  const tick = () => withJobLease('referral-rewards', intervalMs * 1.5, () => processPendingReferrals()).catch((error) => console.warn('[referral] reward pass failed', error?.message));
  const timer = setInterval(tick, intervalMs);
  timer.unref?.();
  setTimeout(tick, 60 * 1000).unref?.();
  return timer;
}
