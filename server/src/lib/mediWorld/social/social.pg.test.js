import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import {
  acceptFriend,
  blockUser,
  confirmSocialEligibility,
  createCircle,
  getCurrentCircle,
  getFriendProfile,
  getSocialMe,
  inviteToCircle,
  joinCircle,
  listFriends,
  requestFriend,
  sendWave,
  updateSocialMe,
  updateSocialPrivacy,
} from './service.js';

const url = process.env.PHASE38_TEST_DATABASE_URL || '';
const skip = !url;
const NOW = new Date('2026-09-14T12:00:00.000Z');

function safeDb() {
  return new PrismaClient({
    datasources: { db: { url } },
    log: ['error'],
  });
}

function opts(db, extra = {}) {
  return {
    db,
    now: extra.now || NOW,
    timezone: extra.timezone || 'UTC',
    flags: { nodeEnv: 'test', flag: '1', socialFlag: extra.socialFlag ?? '1' },
    user: extra.user || { timezone: 'UTC' },
  };
}

async function seedUser(db, email, fullName = 'Phase45 Social') {
  return db.user.create({
    data: {
      email,
      fullName,
      passwordHash: await bcrypt.hash('Phase45SocialPass!', 12),
    },
  });
}

async function optIn(db, userId, name) {
  await confirmSocialEligibility(userId, { confirmAdult: true }, opts(db));
  return updateSocialMe(userId, { displayName: name, socialEnabled: true }, opts(db));
}

describe('Medi World Phase 45 PostgreSQL', { skip }, () => {
  it('creates one canonical friendship under concurrent crossed requests', async () => {
    const db = safeDb();
    const stamp = Date.now();
    let a = null;
    let b = null;
    try {
      a = await seedUser(db, `phase45a.${stamp}@medicard.test`, 'Legal A');
      b = await seedUser(db, `phase45b.${stamp}@medicard.test`, 'Legal B');
      const profileA = await optIn(db, a.id, 'Ava');
      const profileB = await optIn(db, b.id, 'Bea');
      assert.equal(profileA.displayName, 'Ava');
      assert.notEqual(profileA.displayName, 'Legal A');
      const [left, right] = await Promise.all([
        requestFriend(a.id, { friendCode: profileB.friendCode, idempotencyKey: `pg-cross-a-${stamp}` }, opts(db)),
        requestFriend(b.id, { friendCode: profileA.friendCode, idempotencyKey: `pg-cross-b-${stamp}` }, opts(db)),
      ]);
      const rows = await db.socialFriendship.findMany({
        where: { OR: [{ requesterId: a.id }, { addresseeId: a.id }] },
      });
      assert.equal(rows.length, 1);
      const states = [left.state, right.state];
      assert.ok(states.includes('accepted') || states.every((state) => state === 'pending'));
      if (rows[0].state === 'pending') {
        const addressee = rows[0].addresseeId;
        await acceptFriend(addressee, rows[0].id, opts(db));
      }
      await updateSocialPrivacy(b.id, { showGardenPreview: true }, opts(db));
      const friends = await listFriends(a.id, opts(db));
      const accepted = friends.items.find((row) => row.state === 'accepted');
      const view = await getFriendProfile(a.id, accepted.relationshipId, opts(db));
      assert.equal(view.publicId, profileB.publicId);
      assert.equal(JSON.stringify(view).includes('"email"'), false);
      assert.equal(JSON.stringify(view).includes('"userId"'), false);
      await sendWave(a.id, { publicId: profileB.publicId, waveType: 'hello', idempotencyKey: `pg-wave-${stamp}` }, opts(db));
      await blockUser(b.id, { publicId: profileA.publicId }, opts(db));
      await assert.rejects(
        () => sendWave(a.id, { publicId: profileB.publicId, waveType: 'cheer', idempotencyKey: `pg-wave-2-${stamp}` }, opts(db)),
        (e) => e.code === 'SOCIAL_NOT_FOUND',
      );
    } finally {
      await db.$disconnect();
    }
  });

  it('joins a Circle once, enforces the member cap, and stays isolated from health tables', async () => {
    const db = safeDb();
    const stamp = Date.now();
    const users = [];
    try {
      for (let i = 0; i < 7; i += 1) {
        users.push(await seedUser(db, `phase45c.${stamp}.${i}@medicard.test`));
        await optIn(db, users[i].id, `P${i}`);
      }
      const circle = await createCircle(users[0].id, { name: 'Circle' }, opts(db));
      assert.equal(circle.circle.memberCap, 6);
      for (let i = 1; i < 6; i += 1) {
        const invite = await inviteToCircle(users[0].id, opts(db));
        await joinCircle(users[i].id, { inviteCode: invite.inviteCode, confirm: true }, opts(db));
      }
      const full = await inviteToCircle(users[0].id, opts(db));
      await assert.rejects(
        () => joinCircle(users[6].id, { inviteCode: full.inviteCode, confirm: true }, opts(db)),
        (e) => e.code === 'SOCIAL_CIRCLE_FULL',
      );
      const me = await getSocialMe(users[0].id, opts(db));
      assert.equal(JSON.stringify(me).includes('careEnergy'), false);
      assert.equal(JSON.stringify(me).includes('birthDate'), false);
    } finally {
      await db.$disconnect();
    }
  });

  it('restricts Circle membership on block without leaving the Circle ownerless', async () => {
    const db = safeDb();
    const stamp = Date.now();
    let a = null;
    let b = null;
    try {
      a = await seedUser(db, `phase45.block.${stamp}.a@medicard.test`);
      b = await seedUser(db, `phase45.block.${stamp}.b@medicard.test`);
      await optIn(db, a.id, 'Ava');
      await optIn(db, b.id, 'Bea');
      await createCircle(a.id, { name: 'Circle' }, opts(db));
      const invite = await inviteToCircle(a.id, opts(db));
      await joinCircle(b.id, { inviteCode: invite.inviteCode, confirm: true }, opts(db));
      const profileA = await getSocialMe(a.id, opts(db));
      const profileB = await getSocialMe(b.id, opts(db));
      await Promise.all([
        blockUser(b.id, { publicId: profileA.publicId }, opts(db)),
        sendWave(a.id, { publicId: profileB.publicId, waveType: 'hello', idempotencyKey: `pg-block-wave-${stamp}` }, opts(db)).catch((error) => error),
      ]);
      const owner = await getCurrentCircle(a.id, opts(db));
      assert.ok(owner.circle);
      assert.equal(owner.circle.members.some((row) => row.role === 'owner'), true);
      const memberCircle = await getCurrentCircle(b.id, opts(db));
      assert.equal(memberCircle.circle, null);
      const owned = await db.socialCircle.findMany({ where: { ownerUserId: a.id } });
      assert.equal(owned.length, 1);
      const ownerMembership = await db.socialCircleMember.findFirst({
        where: { circleId: owned[0].id, userId: a.id, role: 'owner' },
      });
      assert.ok(ownerMembership);
    } finally {
      await db.$disconnect();
    }
  });
});
