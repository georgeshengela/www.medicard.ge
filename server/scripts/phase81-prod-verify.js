/**
 * Phase 8.1 — Production readiness + DEV partner commerce E2E.
 * Usage:
 *   node scripts/phase81-prod-verify.js            # prod health + store + counts
 *   node scripts/phase81-dev-partner-e2e.js        # full DEV partner flow (local API)
 */
import 'dotenv/config';
import { prisma } from '../src/lib/prisma.js';
import {
  activateCampaign,
  adminImportCodes,
  adjustFiniteInventory,
  ensureDevPartnerFixture,
  inventoryStockState,
  listCodesAdmin,
  pauseCampaign,
  serializeCampaignForPartner,
  upsertCampaign,
  upsertPartner,
  validateCampaignActivation,
} from '../src/lib/rewardsAdmin.js';
import { listStoreRewards, redeemReward, ensureRewardDefinitions } from '../src/lib/rewards.js';
import { PARTNER_STATUSES, CAMPAIGN_STATUSES, STOCK_STATES } from '../src/lib/rewardCampaignDefs.js';
import { INVENTORY_MODES, REWARD_TYPES, REWARD_STATUSES } from '../src/lib/rewardDefs.js';
import { randomUUID } from 'crypto';
import { assertNoHealthFields } from '../src/lib/rewardsAdmin.js';

const base = process.env.PHASE81_API_BASE || 'http://127.0.0.1:4000';
const phone = process.env.PHASE81_QA_PHONE || '+995500000005';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function qaLogin() {
  const start = await fetch(`${base}/api/auth/phone/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone }),
  });
  const sj = await start.json();
  const code = sj.devCode || process.env.QA_OTP_MASTER || '0000';
  const verify = await fetch(`${base}/api/auth/phone/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, code }),
  });
  const vj = await verify.json();
  assert(verify.ok && vj.token, `login failed ${verify.status} ${JSON.stringify(vj)}`);
  return vj.token;
}

async function prodVerify() {
  const health = await fetch('https://medicard.ge/health');
  const hj = await health.json();
  console.log('health', health.status, hj.status);

  const { ensureAchievementDefinitions } = await import('../src/lib/achievementDefs.js');
  await ensureAchievementDefinitions(prisma);

  const partners = await prisma.rewardPartner.count();
  const campaigns = await prisma.rewardCampaign.count();
  const demo = await prisma.rewardPartner.findFirst({
    where: { key: 'MEDI_PHARMACY_DEMO' },
    include: { campaigns: true, rewards: true },
  });
  console.log('counts', {
    partners,
    campaigns,
    demo: demo
      ? { status: demo.status, campaigns: demo.campaigns.map((c) => c.status), rewards: demo.rewards.map((r) => r.status) }
      : null,
  });

  // First-party catalog statuses
  const keys = ['MEDI_THEME_7D', 'MEDI_PROFILE_STYLE_30D', 'MEDI_PREMIUM_DAY', 'MEDI_PREMIUM_3D', 'PARTNER_TEST_10'];
  const defs = await prisma.rewardDefinition.findMany({ where: { key: { in: keys } } });
  console.log(
    'definitions',
    defs.map((d) => ({ key: d.key, status: d.status, partnerId: d.partnerId || null })),
  );

  // Indexes presence (best-effort via raw)
  const idx = await prisma.$queryRawUnsafe(`
    SELECT indexname FROM pg_indexes
    WHERE tablename IN ('RewardCampaign','RewardRedemption','RewardCode')
    ORDER BY tablename, indexname
  `);
  console.log(
    'indexes',
    idx.map((r) => r.indexname),
  );

  // Achievement rarities in DB
  const ach = await prisma.achievementDefinition.findMany({
    where: { key: { in: ['FIRST_WEEKLY', 'COMEBACK'] } },
    select: { key: true, rarity: true, rewardXp: true, rewardCoins: true },
  });
  console.log('achievement rarities DB', ach);

  const unauth = await fetch('https://medicard.ge/api/admin/rewards/overview');
  console.log('prod unauth overview', unauth.status);

  const login = await fetch('https://medicard.ge/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD }),
  });
  const lj = await login.json();
  if (login.ok && lj.token) {
    const ov = await fetch('https://medicard.ge/api/admin/rewards/overview', {
      headers: { Authorization: `Bearer ${lj.token}` },
    });
    const text = await ov.text();
    console.log('prod admin overview', ov.status, text.slice(0, 160));
  } else {
    console.log('prod admin login failed', login.status);
  }
}

async function adminLogin() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const res = await fetch(`${base}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const j = await res.json();
  assert(res.ok && j.token, `admin login ${res.status}`);
  return j.token;
}

async function runDevE2E() {
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_DEV_PARTNER !== '1') {
    throw new Error('DEV partner E2E blocked in production without ALLOW_DEV_PARTNER=1');
  }
  await ensureRewardDefinitions(prisma);
  const admin = { id: 'phase81-admin', email: process.env.ADMIN_EMAIL || 'admin@test' };

  const old = await prisma.rewardDefinition.findFirst({ where: { key: 'MEDI_PHARMACY_DEMO_VOUCHER' } });
  if (old) {
    await prisma.userRewardEntitlement.deleteMany({ where: { redemption: { rewardId: old.id } } });
    await prisma.rewardRedemptionAudit.deleteMany({ where: { rewardId: old.id } });
    await prisma.rewardRedemption.deleteMany({ where: { rewardId: old.id } });
    await prisma.rewardCode.deleteMany({ where: { rewardId: old.id } });
    await prisma.rewardCampaign.deleteMany({ where: { rewardDefinitionId: old.id } });
    await prisma.rewardInventoryAdjustment.deleteMany({ where: { rewardId: old.id } });
    await prisma.rewardDefinition.delete({ where: { id: old.id } });
  }
  await prisma.rewardCampaign.deleteMany({ where: { key: 'MEDI_PHARMACY_DEMO_CAMP' } });

  const partner = await ensureDevPartnerFixture(prisma);
  assert(partner?.key === 'MEDI_PHARMACY_DEMO', 'dev partner missing');
  assert(partner.status === PARTNER_STATUSES.ACTIVE, 'dev partner not ACTIVE');

  // Create CODE_POOL reward (DRAFT first)
  const reward = await prisma.rewardDefinition.create({
    data: {
      id: randomUUID(),
      key: 'MEDI_PHARMACY_DEMO_VOUCHER',
      type: REWARD_TYPES.PARTNER_VOUCHER,
      status: REWARD_STATUSES.DRAFT,
      titleKey: 'reward.partnerDemo.title',
      descriptionKey: 'reward.partnerDemo.description',
      termsKey: 'reward.partnerDemo.terms',
      coinCost: 100,
      partnerId: partner.id,
      inventoryMode: INVENTORY_MODES.CODE_POOL,
      featured: false,
      sortOrder: 90,
      redemptionExpiryDays: 14,
      lowStockThreshold: 3,
      metadata: { neverShowInProduction: true, env: 'DEV' },
    },
  });

  // Code import QA matrix
  const past = new Date(Date.now() - 86400000).toISOString();
  const future = new Date(Date.now() + 7 * 86400000).toISOString();
  const importRows = [
    '  DEMO-CODE-001  ',
    'DEMO-CODE-001', // file duplicate
    'DEMO-CODE-002',
    'AB', // invalid short
    { code: 'DEMO-EXPIRED', expiresAt: past },
    { code: 'DEMO-CODE-003', expiresAt: future },
    'DEMO-CODE-004',
    'DEMO-CODE-005',
  ];
  const report1 = await adminImportCodes(reward.id, importRows, { admin });
  console.log('import1', report1);
  assert(report1.accepted >= 4, 'expected accepted codes');
  assert(report1.duplicates >= 1, 'expected duplicates');
  assert(report1.invalid >= 1, 'expected invalid');
  assert(report1.expiredRejected >= 1, 'expected expiredRejected');
  assert(!('codes' in report1) && !('acceptedCodes' in report1), 'must not return plaintext list');

  // Second import DB duplicate
  const report2 = await adminImportCodes(reward.id, ['DEMO-CODE-002', 'DEMO-CODE-006'], { admin });
  console.log('import2', report2);
  assert(report2.duplicates >= 1, 'db duplicate');

  // Masking
  const listed = await listCodesAdmin(reward.id, { limit: 50 });
  assert(listed.items.every((c) => c.codeMasked && !c.code), 'codes must be masked only');
  console.log(
    'masked sample',
    listed.items.slice(0, 3).map((c) => ({ m: c.codeMasked, s: c.status })),
  );

  // Campaign
  const campaign = await upsertCampaign(
    {
      key: 'MEDI_PHARMACY_DEMO_CAMP',
      partnerId: partner.id,
      rewardDefinitionId: reward.id,
      name: 'Medi Pharmacy Demo Campaign',
      status: CAMPAIGN_STATUSES.DRAFT,
      fundingModel: 'PER_REDEMPTION',
      commercialValueMinor: 1500,
      commercialCurrency: 'GEL',
      maxRedemptions: 2,
      lowStockThreshold: 3,
    },
    { admin },
  );

  // Activation validation failures
  const badPartner = validateCampaignActivation({
    partner: { status: 'DRAFT' },
    reward: { ...reward, status: 'ACTIVE', type: REWARD_TYPES.PARTNER_VOUCHER },
    campaign,
    availableCodes: 5,
  });
  assert(badPartner.some((e) => /partner/i.test(e)), 'partner DRAFT should fail');

  const geoBlock = validateCampaignActivation({
    partner: { status: 'ACTIVE' },
    reward: { ...reward, status: 'ACTIVE', type: REWARD_TYPES.PARTNER_VOUCHER, titleKey: 't', descriptionKey: 'd', coinCost: 100 },
    campaign: { ...campaign, marketCountryCode: 'GE', name: 'X' },
    availableCodes: 5,
  });
  // In test/dev NODE_ENV may not be production — document
  console.log('geo validation (may warn only outside production)', geoBlock);

  // Activate reward + campaign
  await prisma.rewardDefinition.update({
    where: { id: reward.id },
    data: { status: REWARD_STATUSES.ACTIVE },
  });
  const live = await activateCampaign(campaign.id, { admin });
  assert(live.status === CAMPAIGN_STATUSES.ACTIVE, 'campaign not ACTIVE');
  console.log('campaign ACTIVE', live.key);

  // Stock state
  const avail = listed.counts?.available ?? (await prisma.rewardCode.count({ where: { rewardId: reward.id, status: 'AVAILABLE' } }));
  const stock = inventoryStockState({
    mode: INVENTORY_MODES.CODE_POOL,
    available: avail,
    threshold: 3,
  });
  console.log('stock', { avail, stock });
  assert([STOCK_STATES.OK, STOCK_STATES.LOW, STOCK_STATES.OUT].includes(stock), 'stock state');

  // Serializer privacy
  const view = serializeCampaignForPartner(live, {
    redemptions: { issued: 0 },
    inventory: { available: avail },
  });
  assertNoHealthFields(view);
  const json = JSON.stringify(view);
  assert(!/userId|email|phone|diagnosis|medication|steps|pain|cycle/i.test(json), 'serializer leak');

  // Mobile catalog (QA user) — DEV reward has neverShowInProduction so may be hidden
  // Temporarily clear neverShow for local E2E visibility
  await prisma.rewardDefinition.update({
    where: { id: reward.id },
    data: { metadata: { env: 'DEV', e2e: true } },
  });

  const token = await qaLogin();
  const me = await fetch(`${base}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
  const mej = await me.json();
  const userId = mej.user?.id || mej.id;
  assert(userId, 'no user id');

  // Ensure enough coins for 2×100 redemptions
  await prisma.rewardLedger.create({
    data: {
      id: randomUUID(),
      userId,
      currency: 'COIN',
      amount: 500,
      transactionType: 'ADJUST',
      sourceType: 'SYSTEM',
      sourceId: `phase81-topup-${Date.now()}`,
    },
  });
  await prisma.userQuestProfile.upsert({
    where: { userId },
    create: { userId, cachedCoinBalance: 500, currentLevel: 1, totalXp: 0 },
    update: { cachedCoinBalance: { increment: 500 } },
  });

  const catalog = await listStoreRewards(userId, { db: prisma });
  const demoCard = catalog.available.find((r) => r.key === 'MEDI_PHARMACY_DEMO_VOUCHER');
  const firstParty = catalog.available.filter((r) => ['MEDI_THEME_7D', 'MEDI_PROFILE_STYLE_30D'].includes(r.key));
  console.log('catalog', {
    demo: demoCard
      ? { partner: demoCard.partnerDisplay?.displayName, cost: demoCard.coinCost, campaign: demoCard.campaignKey }
      : null,
    firstParty: firstParty.map((r) => r.key),
    coins: catalog.balance.coins,
  });
  assert(demoCard, 'DEV partner reward not in store');
  assert(demoCard.partnerDisplay?.displayName, 'partner display missing');
  assert(firstParty.length === 2, 'first-party missing from store');

  // Redeem #1
  const balBefore = catalog.balance.coins;
  const r1 = await redeemReward(userId, reward.id, {
    db: prisma,
    idempotencyKey: `phase81-${randomUUID()}`,
  });
  assert(r1.redemption?.status === 'ISSUED', 'redeem1 not ISSUED');
  assert(r1.wallet.currentBalance === balBefore - 100, 'coin spend');
  assert(r1.redemption.code || r1.redemption.codeMasked, 'code assigned');
  console.log('redeem1', {
    id: r1.redemption.id,
    codeMasked: r1.redemption.codeMasked,
    spent: r1.wallet.spent,
  });

  // Redeem #2 (maxRedemptions=2)
  const r2 = await redeemReward(userId, reward.id, {
    db: prisma,
    idempotencyKey: `phase81-${randomUUID()}`,
  });
  assert(r2.redemption?.status === 'ISSUED', 'redeem2 not ISSUED');

  // Redeem #3 → campaign limit
  let limitHit = null;
  try {
    await redeemReward(userId, reward.id, {
      db: prisma,
      idempotencyKey: `phase81-${randomUUID()}`,
    });
  } catch (e) {
    limitHit = e.code || e.message;
  }
  assert(limitHit === 'REWARD_CAMPAIGN_LIMIT' || /CAMPAIGN_LIMIT|ლიმიტი/i.test(String(limitHit)), `expected LIMIT got ${limitHit}`);
  console.log('campaign limit ok', limitHit);

  // Pause partner → hide
  await upsertPartner({ id: partner.id, key: partner.key, displayName: partner.displayName, status: 'PAUSED' }, { admin });
  const catalogPaused = await listStoreRewards(userId, { db: prisma });
  assert(
    !catalogPaused.available.find((r) => r.key === 'MEDI_PHARMACY_DEMO_VOUCHER'),
    'paused partner still visible',
  );

  // Restore partner
  await upsertPartner({ id: partner.id, key: partner.key, displayName: partner.displayName, status: 'ACTIVE' }, { admin });
  await pauseCampaign(campaign.id, { admin });
  const catalogCampPaused = await listStoreRewards(userId, { db: prisma });
  assert(
    !catalogCampPaused.available.find((r) => r.key === 'MEDI_PHARMACY_DEMO_VOUCHER'),
    'paused campaign still visible',
  );

  // FINITE inventory adjustment on a scratch reward? skip — use CODE_POOL counts
  const afterCodes = await listCodesAdmin(reward.id, { limit: 20 });
  console.log('code counts after', afterCodes.counts || afterCodes);

  // Market activation block in production path
  const prev = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  delete process.env.ALLOW_GEO_RESTRICTED_REWARDS;
  const geoProd = validateCampaignActivation({
    partner: { status: 'ACTIVE' },
    reward: {
      type: REWARD_TYPES.PARTNER_VOUCHER,
      titleKey: 't',
      descriptionKey: 'd',
      coinCost: 10,
      entitlementKey: null,
    },
    campaign: { name: 'Geo', marketCountryCode: 'GE' },
    availableCodes: 5,
  });
  process.env.NODE_ENV = prev;
  assert(geoProd.some((e) => /geo-restricted|market/i.test(e)), `geo should block in production: ${geoProd}`);

  // Leave DEV fixture non-active so shared Neon never serves it to prod users
  await prisma.rewardDefinition.update({
    where: { id: reward.id },
    data: {
      status: REWARD_STATUSES.PAUSED,
      metadata: { neverShowInProduction: true, env: 'DEV' },
    },
  });
  await upsertPartner(
    { id: partner.id, key: partner.key, displayName: partner.displayName, status: 'PAUSED' },
    { admin },
  );

  console.log('DEV E2E PASS');
  return { partnerId: partner.id, rewardId: reward.id, campaignId: campaign.id };
}

const mode = process.argv[2] || 'verify';
try {
  if (mode === 'e2e') await runDevE2E();
  else await prodVerify();
} catch (e) {
  console.error('FAIL', e);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
