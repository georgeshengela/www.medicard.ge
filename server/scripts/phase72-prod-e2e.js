/**
 * Phase 7.2 — production Rewards smoke against https://medicard.ge
 * Uses QA phone OTP (0000 when qaOtpEnabled) + optional Neon credit via local prisma.
 *
 * Usage: node scripts/phase72-prod-e2e.js
 */
import { randomUUID } from 'node:crypto';
import { prisma } from '../src/lib/prisma.js';
import { getRewardBalance } from '../src/lib/quest.js';

const BASE = process.env.PHASE72_API_BASE || 'https://medicard.ge';
const PHONE = process.env.PHASE72_PHONE || '+995500000005';
const OTP = process.env.PHASE72_OTP || '0000';

async function api(path, { method = 'GET', token, body, headers = {} } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  return { status: res.status, json };
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function ensureBalance(userId, minCoins) {
  const bal = await getRewardBalance(userId);
  if (bal.coins >= minCoins) return bal;
  const need = minCoins - bal.coins;
  await prisma.rewardLedger.create({
    data: {
      id: randomUUID(),
      userId,
      currency: 'COIN',
      amount: need,
      transactionType: 'EARN',
      sourceType: 'SYSTEM',
      sourceId: `phase72-prod-${Date.now()}`,
    },
  });
  await prisma.userQuestProfile.update({
    where: { userId },
    data: { cachedCoinBalance: bal.coins + need },
  });
  return getRewardBalance(userId);
}

async function main() {
  console.log(JSON.stringify({ base: BASE, phone: PHONE }));

  const health = await api('/health');
  assert(health.status === 200 && health.json?.status === 'ok', `health failed: ${health.status}`);
  console.log('health ok');

  const start = await api('/api/auth/phone/start', { method: 'POST', body: { phone: PHONE } });
  assert(start.status === 200 || start.status === 201, `phone start ${start.status} ${JSON.stringify(start.json)}`);
  const verify = await api('/api/auth/phone/verify', {
    method: 'POST',
    body: { phone: PHONE, code: OTP },
  });
  assert(verify.status === 200 && verify.json?.token, `phone verify ${verify.status} ${JSON.stringify(verify.json)}`);
  const token = verify.json.token;
  const userId = verify.json.user?.id;
  assert(userId, 'missing user id');
  console.log('auth ok', userId);

  const catalog = await api('/api/rewards', { token });
  assert(catalog.status === 200, `catalog ${catalog.status}`);
  const rewards = [
    ...(catalog.json?.available || []),
    ...(catalog.json?.featured || []),
  ];
  // de-dupe by key
  const byKey = new Map(rewards.map((r) => [r.key, r]));
  const unique = [...byKey.values()];
  const keys = unique.map((r) => r.key);
  console.log('ACTIVE keys', keys, 'balance', catalog.json?.balance);
  assert(keys.includes('MEDI_THEME_7D'), 'missing MEDI_THEME_7D');
  assert(keys.includes('MEDI_PROFILE_STYLE_30D'), 'missing MEDI_PROFILE_STYLE_30D');
  assert(!keys.includes('MEDI_PREMIUM_DAY'), 'PREMIUM day exposed');
  assert(!keys.includes('MEDI_PREMIUM_3D'), 'PREMIUM 3d exposed');
  assert(!keys.includes('PARTNER_TEST_10'), 'PARTNER_TEST exposed');
  for (const r of unique) {
    assert(!('codes' in r) && !('codePool' in r) && !r.fullCode, `code leak in list ${r.key}`);
  }

  // DRAFT direct redeem — find premium id from Neon (not listed)
  const draft = await prisma.rewardDefinition.findFirst({ where: { key: 'MEDI_PREMIUM_DAY' } });
  assert(draft, 'draft def missing in Neon');
  const draftTry = await api(`/api/rewards/${draft.id}/redeem`, {
    method: 'POST',
    token,
    body: { idempotencyKey: `phase72-draft-${Date.now()}` },
  });
  console.log('draft redeem', draftTry.status, draftTry.json?.code || draftTry.json?.error || draftTry.json);
  assert(
    draftTry.status >= 400 &&
      String(draftTry.json?.code || draftTry.json?.error || draftTry.json?.message || '').match(
        /NOT_ACTIVE|DRAFT|INACTIVE|REWARD_NOT/i,
      ),
    `draft redeem should fail NOT_ACTIVE, got ${draftTry.status} ${JSON.stringify(draftTry.json)}`,
  );

  const theme = byKey.get('MEDI_THEME_7D');
  const profile = byKey.get('MEDI_PROFILE_STYLE_30D');
  assert(theme?.id && profile?.id, 'theme/profile reward ids');
  // Prefer theme for period-reset E2E; credit coins before eligibility re-check.
  const target = theme;
  const cost = Number(target.coinCost || 300);
  const before = await ensureBalance(userId, cost + 50);
  console.log('credited/ready balance', before.coins, 'need', cost);

  const catalogFresh = await api('/api/rewards', { token });
  const freshItems = [
    ...(catalogFresh.json?.available || []),
    ...(catalogFresh.json?.featured || []),
  ];
  const fresh = freshItems.find((r) => r.id === target.id) || target;
  assert(fresh.userEligibility?.canRedeem, `still not redeemable: ${fresh.userEligibility?.reasonCode}`);
  console.log('redeeming', fresh.key, 'cost', cost, 'storeBalance', catalogFresh.json?.balance);

  const idem = `phase72-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const redeem1 = await api(`/api/rewards/${fresh.id}/redeem`, {
    method: 'POST',
    token,
    body: { idempotencyKey: idem },
  });
  assert(redeem1.status === 200 || redeem1.status === 201, `redeem1 ${redeem1.status} ${JSON.stringify(redeem1.json)}`);
  const w1 = redeem1.json?.wallet?.currentBalance ?? redeem1.json?.coinBalance;
  assert(Number.isFinite(Number(w1)), `missing wallet in redeem response ${JSON.stringify(redeem1.json).slice(0, 500)}`);
  console.log('redeem1 balance', w1, 'redemption', redeem1.json?.redemption?.id || redeem1.json?.id);

  const redeem2 = await api(`/api/rewards/${fresh.id}/redeem`, {
    method: 'POST',
    token,
    body: { idempotencyKey: idem },
  });
  assert(redeem2.status === 200 || redeem2.status === 201, `idempotency ${redeem2.status}`);
  const w2 = redeem2.json?.wallet?.currentBalance ?? redeem2.json?.coinBalance;
  assert(Number(w2) === Number(w1), `idempotency double-spend ${w1} vs ${w2}`);
  const r1 = redeem1.json?.redemption?.id || redeem1.json?.id;
  const r2 = redeem2.json?.redemption?.id || redeem2.json?.id;
  assert(r1 && r1 === r2, `idempotency different redemption ${r1} ${r2}`);
  console.log('idempotency ok');

  const ents = await api('/api/rewards/entitlements', { token });
  assert(ents.status === 200, `entitlements ${ents.status}`);
  const entList = ents.json?.items || ents.json?.entitlements || ents.json?.active || [];
  assert(Array.isArray(entList), 'entitlements shape');
  const hasPick = entList.some(
    (e) =>
      e.rewardKey === fresh.key ||
      e.key === fresh.key ||
      e.entitlementKey?.includes('theme') ||
      e.reward?.key === fresh.key,
  );
  console.log('entitlements', entList.length, 'hasPick', hasPick, fresh.key);
  assert(hasPick, 'entitlement missing after redeem');

  const reds = await api('/api/rewards/redemptions', { token });
  assert(reds.status === 200, `redemptions ${reds.status}`);
  const flatReds = Array.isArray(reds.json)
    ? reds.json
    : [
        ...(reds.json?.items || []),
        ...(reds.json?.active || []),
        ...(reds.json?.used || []),
        ...(reds.json?.expired || []),
        ...(reds.json?.redemptions || []),
      ];
  assert(flatReds.length >= 1, `redemptions empty ${JSON.stringify(reds.json).slice(0, 300)}`);
  for (const row of flatReds) {
    assert(!row.codeValue && !row.fullCode && !(row.codes && row.codes.length), 'code leak in redemptions');
  }

  // privacy: other user's redemption
  const other = await prisma.rewardRedemption.findFirst({
    where: { NOT: { userId } },
    orderBy: { createdAt: 'desc' },
  });
  if (other) {
    const peek = await api(`/api/rewards/redemptions/${other.id}`, { token });
    assert(peek.status === 403 || peek.status === 404, `privacy redemption ${peek.status}`);
    console.log('privacy redemption', peek.status);
  } else {
    console.log('privacy redemption skipped (no other rows)');
  }

  const after = await getRewardBalance(userId);
  console.log('neon balance after', after.coins);
  assert(Number(w1) === after.coins, `api wallet ${w1} != neon ${after.coins}`);

  // Hub/store balance surface via catalog
  const catalog2 = await api('/api/rewards', { token });
  assert(Number(catalog2.json?.balance?.coins) === after.coins, 'store balance mismatch');

  console.log(JSON.stringify({ ok: true, activeKeys: keys, redeemed: fresh.key, balance: after.coins, redemptionId: r1 }));
}

main()
  .catch((e) => {
    console.error('PHASE72_FAIL', e.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
