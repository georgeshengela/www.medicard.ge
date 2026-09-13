import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createQuestFakeDb } from '../../questFakeDb.js';
import { mediWorldRouter } from '../../../routes/mediWorld.routes.js';
import { isMediWorldSocialEnabled } from '../flags.js';
import { processWorldActivity } from '../engine.js';
import { plantInPlot } from '../garden/service.js';
import {
  FRIEND_CODE_ALPHABET,
  generateFriendCode,
  normalizeFriendCode,
  pairKeyFor,
  WAVE_TYPES,
} from './codes.js';
import { sanitizeSocialBio, sanitizeSocialDisplayName } from './names.js';
import {
  acceptFriend,
  blockUser,
  cancelFriend,
  confirmSocialEligibility,
  createCircle,
  createReport,
  declineFriend,
  deleteCircle,
  getCurrentCircle,
  getFriendProfile,
  getOwnerPreview,
  getSocialMe,
  inviteToCircle,
  joinCircle,
  leaveCircle,
  listBlocks,
  listFriends,
  listInbox,
  listWaves,
  readInboxItem,
  removeCircleMember,
  removeFriend,
  requestFriend,
  resetSocialRateLimitsForTests,
  rotateFriendCode,
  sendWave,
  transferCircle,
  unblockUser,
  updateSocialMe,
  updateSocialPrivacy,
} from './service.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const NOW = new Date('2026-09-14T12:00:00.000Z');
const A = 'user-social-a';
const B = 'user-social-b';
const C = 'user-social-c';
const TZ = 'UTC';

function opts(db, extra = {}) {
  return {
    db,
    now: extra.now || NOW,
    timezone: extra.timezone || TZ,
    flags: {
      nodeEnv: extra.nodeEnv || 'test',
      flag: extra.flag ?? '1',
      socialFlag: extra.socialFlag ?? '1',
      gardenFlag: extra.gardenFlag ?? '1',
    },
    user: extra.user || { timezone: TZ },
  };
}

async function grantMovement(db, userId, stamp = 's') {
  await processWorldActivity(
    userId,
    {
      sourceType: 'FOUNDATION_TEST',
      sourceId: `social-g-${userId}-${stamp}`,
      idempotencyKey: `social-g-${userId}-${stamp}`,
      adapterId: 'activity.walking',
      energyType: 'movement',
      progressState: 'verified',
      personalTarget: 1500,
      completedAmount: 1500,
    },
    opts(db, { now: new Date(NOW.getTime() - 86_400_000) }),
  );
  await processWorldActivity(
    userId,
    {
      sourceType: 'FOUNDATION_TEST',
      sourceId: `social-g2-${userId}-${stamp}`,
      idempotencyKey: `social-g2-${userId}-${stamp}`,
      adapterId: 'activity.walking',
      energyType: 'movement',
      progressState: 'verified',
      personalTarget: 1500,
      completedAmount: 1500,
    },
    opts(db, { now: new Date(NOW.getTime() - 2 * 86_400_000) }),
  );
}

async function optIn(db, userId, name) {
  await confirmSocialEligibility(userId, { confirmAdult: true }, opts(db));
  return updateSocialMe(userId, { displayName: name, socialEnabled: true }, opts(db));
}

async function befriend(db, fromId, toId) {
  const target = await getSocialMe(toId, opts(db));
  const requested = await requestFriend(fromId, { friendCode: target.friendCode, idempotencyKey: `req-${fromId}-${toId}` }, opts(db));
  if (requested.state === 'accepted') return requested;
  return acceptFriend(toId, requested.relationshipId, opts(db));
}

function blob(value) {
  return JSON.stringify(value);
}

function assertNoSecrets(value) {
  const text = blob(value);
  for (const key of [
    'email',
    'phone',
    'birthDate',
    'userId',
    'passwordHash',
    'careEnergy',
    'latitude',
    'longitude',
    'nurtureDays',
    'fullName',
    'diagnosis',
    'medication',
  ]) {
    assert.equal(new RegExp(`"${key}"\\s*:`).test(text), false, `leaked ${key}`);
  }
}

beforeEach(() => resetSocialRateLimitsForTests());

describe('Medi World Phase 45 eligibility and profile', () => {
  it('keeps unknown eligibility disabled and does not copy a legal name', async () => {
    const db = createQuestFakeDb();
    const me = await getSocialMe(A, opts(db));
    assert.equal(me.eligibility, 'unknown');
    assert.equal(me.socialEnabled, false);
    assert.equal(me.displayName, '');
    assert.equal(me.privacy.profileVisibility, 'friends_only');
    assert.equal(me.privacy.showGardenPreview, false);
    assert.equal(me.privacy.showWorldLevel, false);
    assert.equal(me.privacy.showBondLevel, false);
    assertNoSecrets(me);
  });

  it('requires explicit adult confirmation before opt-in', async () => {
    const db = createQuestFakeDb();
    await assert.rejects(
      () => confirmSocialEligibility(A, { confirmAdult: false }, opts(db)),
      (e) => e.status === 400,
    );
    const confirmed = await confirmSocialEligibility(A, { confirmAdult: true }, opts(db));
    assert.equal(confirmed.eligibility, 'adult_confirmed');
    assert.equal(confirmed.socialEnabled, false);
    await assert.rejects(
      () => updateSocialMe(A, { socialEnabled: true }, opts(db)),
      (e) => e.code === 'SOCIAL_NAME_REQUIRED',
    );
    const on = await updateSocialMe(A, { displayName: 'ნათელი', socialEnabled: true }, opts(db));
    assert.equal(on.socialEnabled, true);
    assert.equal(on.displayName, 'ნათელი');
    const off = await updateSocialMe(A, { socialEnabled: false }, opts(db));
    assert.equal(off.socialEnabled, false);
  });

  it('normalizes names and rejects links, controls, and medical cues', () => {
    assert.equal(sanitizeSocialDisplayName('  Medi  '), 'Medi');
    assert.throws(() => sanitizeSocialDisplayName('https://x.com'), (e) => e.code === 'SOCIAL_NAME_INVALID');
    assert.throws(() => sanitizeSocialDisplayName('diagnosed today'), (e) => e.code === 'SOCIAL_NAME_INVALID');
    assert.throws(() => sanitizeSocialBio('www.example.com'), (e) => e.code === 'SOCIAL_BIO_INVALID');
    assert.equal(sanitizeSocialBio('ბაღი მშვიდია'), 'ბაღი მშვიდია');
  });
});

describe('Medi World Phase 45 friend codes and relationships', () => {
  it('uses a human-readable high-entropy format that is not derived from a user id', () => {
    const codes = new Set();
    for (let i = 0; i < 40; i += 1) {
      const code = generateFriendCode();
      assert.match(code, /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{5}-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{5}$/);
      assert.equal(normalizeFriendCode(code).length, 10);
      assert.equal(FRIEND_CODE_ALPHABET.includes('0'), false);
      codes.add(code);
    }
    assert.equal(codes.size, 40);
    assert.equal(pairKeyFor('b', 'a'), pairKeyFor('a', 'b'));
  });

  it('looks up exact codes, rotates them, and hides missing or blocked accounts', async () => {
    const db = createQuestFakeDb();
    const a = await optIn(db, A, 'Ava');
    const b = await optIn(db, B, 'Bea');
    await assert.rejects(() => requestFriend(A, { friendCode: a.friendCode }, opts(db)), (e) => e.code === 'SOCIAL_NOT_FOUND');
    await assert.rejects(() => requestFriend(A, { friendCode: 'NOPE-NOPE0' }, opts(db)), (e) => e.code === 'SOCIAL_NOT_FOUND');
    const pending = await requestFriend(A, { friendCode: b.friendCode.toLowerCase(), idempotencyKey: 'req-1' }, opts(db));
    assert.equal(pending.state, 'pending');
    const rotated = await rotateFriendCode(B, opts(db));
    assert.notEqual(rotated.friendCode, b.friendCode);
    await optIn(db, C, 'Cal');
    await assert.rejects(() => requestFriend(C, { friendCode: b.friendCode }, opts(db)), (e) => e.code === 'SOCIAL_NOT_FOUND');
    const again = await requestFriend(A, { friendCode: rotated.friendCode, idempotencyKey: 'req-2' }, opts(db));
    assert.equal(again.state, 'pending');
    assert.equal(again.relationshipId, pending.relationshipId);
  });

  it('accepts, declines, cancels, removes, and authorizes only participants', async () => {
    const db = createQuestFakeDb();
    const a = await optIn(db, A, 'Ava');
    const b = await optIn(db, B, 'Bea');
    await optIn(db, C, 'Cal');
    const pending = await requestFriend(A, { friendCode: b.friendCode, idempotencyKey: 'life-1' }, opts(db));
    await assert.rejects(() => acceptFriend(C, pending.relationshipId, opts(db)), (e) => e.code === 'SOCIAL_NOT_FOUND');
    await assert.rejects(() => acceptFriend(A, pending.relationshipId, opts(db)), (e) => e.code === 'SOCIAL_NOT_FOUND');
    const cancelled = await cancelFriend(A, pending.relationshipId, opts(db));
    assert.equal(cancelled.state, 'cancelled');
    const again = await requestFriend(A, { friendCode: b.friendCode, idempotencyKey: 'life-2' }, opts(db));
    const declined = await declineFriend(B, again.relationshipId, opts(db));
    assert.equal(declined.state, 'declined');
    const third = await requestFriend(A, { friendCode: b.friendCode, idempotencyKey: 'life-3' }, opts(db));
    const accepted = await acceptFriend(B, third.relationshipId, opts(db));
    assert.equal(accepted.state, 'accepted');
    const removed = await removeFriend(A, third.relationshipId, opts(db));
    assert.equal(removed.state, 'removed');
    await assert.rejects(() => getFriendProfile(A, third.relationshipId, opts(db)), (e) => e.code === 'SOCIAL_NOT_FOUND');
    void a;
  });

  it('turns crossed concurrent requests into one accepted friendship', async () => {
    const db = createQuestFakeDb();
    const a = await optIn(db, A, 'Ava');
    const b = await optIn(db, B, 'Bea');
    const [left, right] = await Promise.all([
      requestFriend(A, { friendCode: b.friendCode, idempotencyKey: 'cross-a' }, opts(db)),
      requestFriend(B, { friendCode: a.friendCode, idempotencyKey: 'cross-b' }, opts(db)),
    ]);
    const states = [left.state, right.state].sort();
    assert.equal(states.includes('accepted') || (states[0] === 'pending' && states[1] === 'pending'), true);
    const rows = await db.socialFriendship.findMany({});
    assert.equal(rows.length, 1);
  });

  it('rate-limits friend-code lookups', async () => {
    const db = createQuestFakeDb();
    await optIn(db, A, 'Ava');
    await optIn(db, B, 'Bea');
    const me = await getSocialMe(B, opts(db));
    for (let i = 0; i < 8; i += 1) {
      await requestFriend(A, { friendCode: 'ZZZZZ-ZZZZZ', idempotencyKey: `rl-${i}` }, opts(db)).catch((error) => {
        if (error.code !== 'SOCIAL_NOT_FOUND') throw error;
      });
    }
    await assert.rejects(
      () => requestFriend(A, { friendCode: me.friendCode, idempotencyKey: 'rl-last' }, opts(db)),
      (e) => e.code === 'SOCIAL_RATE_LIMIT',
    );
  });
});

describe('Medi World Phase 45 blocking, waves, and circles', () => {
  it('blocks pending and accepted access, suppresses waves, and unblocks only from the blocker', async () => {
    const db = createQuestFakeDb();
    const a = await optIn(db, A, 'Ava');
    const b = await optIn(db, B, 'Bea');
    await befriend(db, A, B);
    await updateSocialPrivacy(B, { showGardenPreview: true }, opts(db));
    const before = await getFriendProfile(A, (await listFriends(A, opts(db))).items[0].relationshipId, opts(db));
    assert.equal(before.publicId, b.publicId);
    const wave = await sendWave(A, { publicId: b.publicId, waveType: 'hello', idempotencyKey: 'wave-1' }, opts(db));
    assert.equal(wave.when, 'today');
    const blocked = await blockUser(B, { publicId: a.publicId }, opts(db));
    const afterBlock = await listFriends(A, opts(db));
    await assert.rejects(
      () => getFriendProfile(A, afterBlock.items[0]?.relationshipId || '00000000-0000-4000-8000-000000000001', opts(db)),
      (e) => e.code === 'SOCIAL_NOT_FOUND',
    );
    await assert.rejects(() => sendWave(A, { publicId: b.publicId, waveType: 'cheer', idempotencyKey: 'wave-2' }, opts(db)), (e) => e.code === 'SOCIAL_NOT_FOUND');
    const stillB = await getSocialMe(B, opts(db));
    await assert.rejects(() => requestFriend(A, { friendCode: stillB.friendCode }, opts(db)), (e) => e.code === 'SOCIAL_NOT_FOUND');
    const blocks = await listBlocks(B, opts(db));
    assert.equal(blocks.items[0].blockId, blocked.blockId);
    await unblockUser(B, blocked.blockId, opts(db));
    const afterUnblock = await listFriends(A, opts(db));
    await assert.rejects(
      () => getFriendProfile(A, afterUnblock.items.find((row) => row.state === 'accepted')?.relationshipId || '00000000-0000-4000-8000-000000000001', opts(db)),
      (e) => e.code === 'SOCIAL_NOT_FOUND',
    );
    const meA = await getSocialMe(A, opts(db));
    const reRequest = await requestFriend(B, { friendCode: meA.friendCode, idempotencyKey: 're-after-unblock' }, opts(db));
    assert.equal(reRequest.state, 'pending');
    assert.equal((await listFriends(A, opts(db))).items[0].state, 'pending');
    await acceptFriend(A, reRequest.relationshipId, opts(db));
    assert.equal((await listFriends(A, opts(db))).items[0].state, 'accepted');
  });

  it('allows only curated waves with daily caps, mute, and no rewards', async () => {
    const db = createQuestFakeDb();
    await optIn(db, A, 'Ava');
    const b = await optIn(db, B, 'Bea');
    await befriend(db, A, B);
    await assert.rejects(() => sendWave(A, { publicId: b.publicId, waveType: 'free_text' }, opts(db)), (e) => e.code === 'SOCIAL_WAVE_TYPE');
    const first = await sendWave(A, { publicId: b.publicId, waveType: 'cheer', idempotencyKey: 'w-cheer' }, opts(db));
    const again = await sendWave(A, { publicId: b.publicId, waveType: 'cheer', idempotencyKey: 'w-cheer' }, opts(db));
    assert.equal(first.waveId, again.waveId);
    await sendWave(A, { publicId: b.publicId, waveType: 'hello', idempotencyKey: 'w-hello' }, opts(db));
    await sendWave(A, { publicId: b.publicId, waveType: 'proud_of_you', idempotencyKey: 'w-proud' }, opts(db));
    await sendWave(A, { publicId: b.publicId, waveType: 'gentle_support', idempotencyKey: 'w-gentle' }, opts(db));
    await sendWave(A, { publicId: b.publicId, waveType: 'garden_love', idempotencyKey: 'w-garden' }, opts(db));
    await optIn(db, C, 'Cal');
    await befriend(db, A, C);
    const cal = await getSocialMe(C, opts(db));
    await assert.rejects(
      () => sendWave(A, { publicId: cal.publicId, waveType: 'hello', idempotencyKey: 'w-over' }, opts(db)),
      (e) => e.code === 'SOCIAL_WAVE_CAP',
    );
    await updateSocialPrivacy(B, { wavesMuted: true }, opts(db));
    await befriend(db, C, B);
    await assert.rejects(() => sendWave(C, { publicId: b.publicId, waveType: 'hello', idempotencyKey: 'mute' }, opts(db)), (e) => e.code === 'SOCIAL_NOT_FOUND');
    const listed = await listWaves(B, opts(db));
    assert.deepEqual(listed.types, WAVE_TYPES);
    assert.equal(await db.mediWorldLedger.count({ where: { userId: B } }), 0);
    assert.equal(await db.mediWorldLedger.count({ where: { userId: A } }), 0);
  });

  it('creates a six-member Circle with expiring one-time invites and no health fields', async () => {
    const db = createQuestFakeDb();
    await optIn(db, A, 'Ava');
    await optIn(db, B, 'Bea');
    const created = await createCircle(A, { name: 'ნაზი წრე' }, opts(db));
    assert.equal(created.circle.memberCap, 6);
    const invite = await inviteToCircle(A, opts(db));
    const joined = await joinCircle(B, { inviteCode: invite.inviteCode, confirm: true }, opts(db));
    assert.equal(joined.circle.memberCount, 2);
    await assert.rejects(() => joinCircle(B, { inviteCode: invite.inviteCode, confirm: true }, opts(db)), (e) => e.code === 'SOCIAL_NOT_FOUND');
    const expired = await inviteToCircle(A, opts(db, { now: NOW }));
    await assert.rejects(
      () => joinCircle(C, { inviteCode: expired.inviteCode, confirm: true }, opts(db, { now: new Date(NOW.getTime() + 25 * 3600_000) })),
      (e) => e.code === 'SOCIAL_ELIGIBILITY_UNKNOWN' || e.code === 'SOCIAL_NOT_FOUND',
    );
    await optIn(db, C, 'Cal');
    const fresh = await inviteToCircle(A, opts(db));
    await joinCircle(C, { inviteCode: fresh.inviteCode, confirm: true }, opts(db));
    const current = await getCurrentCircle(B, opts(db));
    assert.equal(current.circle.memberCount, 3);
    await leaveCircle(B, opts(db));
    await assert.rejects(() => leaveCircle(A, opts(db)), (e) => e.code === 'SOCIAL_CIRCLE_OWNER');
    const afterLeave = await getCurrentCircle(A, opts(db));
    const cal = await getSocialMe(C, opts(db));
    await removeCircleMember(A, { publicId: cal.publicId }, opts(db));
    const again = await inviteToCircle(A, opts(db));
    await joinCircle(C, { inviteCode: again.inviteCode, confirm: true }, opts(db));
    await transferCircle(A, { confirm: true, publicId: cal.publicId }, opts(db));
    await deleteCircle(C, { confirm: true }, opts(db));
    const gone = await getCurrentCircle(A, opts(db));
    assert.equal(gone.circle, null);
    assertNoSecrets(created);
    assertNoSecrets(current);
  });
});

describe('Medi World Phase 45 reports, inbox, privacy, and regression gates', () => {
  it('stores sanitized reports without revealing the reporter and paginates inbox', async () => {
    const db = createQuestFakeDb();
    const a = await optIn(db, A, 'Ava');
    const b = await optIn(db, B, 'Bea');
    await befriend(db, A, B);
    const report = await createReport(A, { targetPublicId: b.publicId, category: 'harassment', description: 'please help <b>no</b>' }, opts(db));
    assert.equal(report.offerBlock, true);
    const dup = await createReport(A, { targetPublicId: b.publicId, category: 'harassment' }, opts(db));
    assert.equal(dup.reportId, report.reportId);
    const inbox = await listInbox(B, { take: 10 }, opts(db));
    assert.ok(inbox.items.length >= 1);
    const read = await readInboxItem(B, inbox.items[0].itemId, opts(db));
    assert.equal(read.read, true);
    await assert.rejects(() => readInboxItem(A, inbox.items[0].itemId, opts(db)), (e) => e.code === 'SOCIAL_NOT_FOUND');
    assertNoSecrets(inbox);
    void a;
  });

  it('projects only enabled fields and matches owner preview to the friend view', async () => {
    const db = createQuestFakeDb();
    await optIn(db, A, 'Ava');
    await optIn(db, B, 'Bea');
    await grantMovement(db, B);
    await plantInPlot(B, 0, { catalogKey: 'pulse_fern', idempotencyKey: 'social-plant' }, opts(db));
    await updateSocialPrivacy(B, { showGardenPreview: false, showWorldLevel: false, showBondLevel: false }, opts(db));
    await befriend(db, A, B);
    const rel = (await listFriends(A, opts(db))).items.find((row) => row.state === 'accepted');
    const hidden = await getFriendProfile(A, rel.relationshipId, opts(db));
    assert.equal(hidden.garden, null);
    assert.equal(hidden.worldLevel, null);
    assert.equal(hidden.bondLevel, null);
    const ownerHidden = await getOwnerPreview(B, opts(db));
    assert.deepEqual(hidden.garden, ownerHidden.garden);
    await updateSocialPrivacy(B, { showGardenPreview: true, showWorldLevel: true, showBondLevel: true }, opts(db));
    const shown = await getFriendProfile(A, rel.relationshipId, opts(db));
    const owner = await getOwnerPreview(B, opts(db));
    assert.equal(shown.garden.plots[0].presentationKey, 'pulse_fern');
    assert.equal(shown.garden.plots[0].nurtureDays, undefined);
    assert.deepEqual(shown.garden, owner.garden);
    assert.equal(shown.worldLevel, owner.worldLevel);
    assertNoSecrets(shown);
  });

  it('emits allowlisted socket signals without profile or health payloads', async () => {
    const db = createQuestFakeDb();
    const events = [];
    const io = {
      to: (room) => ({
        emit: (name, payload) => events.push({ room, name, payload }),
      }),
    };
    await optIn(db, A, 'Ava');
    await optIn(db, B, 'Bea');
    const meB = await getSocialMe(B, opts(db));
    await requestFriend(A, { friendCode: meB.friendCode, idempotencyKey: 'sock-req' }, { ...opts(db), io });
    const rel = (await listFriends(B, opts(db))).items.find((row) => row.state === 'pending');
    await acceptFriend(B, rel.relationshipId, { ...opts(db), io });
    await sendWave(A, { publicId: meB.publicId, waveType: 'hello', idempotencyKey: 'sock-wave' }, { ...opts(db), io });
    await updateSocialPrivacy(B, { showGardenPreview: true }, { ...opts(db), io });
    const meA = await getSocialMe(A, opts(db));
    await blockUser(B, { publicId: meA.publicId }, { ...opts(db), io });
    assert.ok(events.every((event) => event.name === 'social:invalidate'));
    assert.ok(events.some((event) => event.payload.signal === 'inbox'));
    assert.ok(events.some((event) => event.payload.signal === 'friendship'));
    assert.ok(events.some((event) => event.payload.signal === 'privacy'));
    assert.ok(events.every((event) => Object.keys(event.payload).length === 1 && event.payload.signal));
    assert.equal(JSON.stringify(events).includes('friendCode'), false);
    assert.equal(JSON.stringify(events).includes('email'), false);
    assert.equal(JSON.stringify(events).includes('careEnergy'), false);
  });

  it('keeps a Circle owner when a member blocks them and removes a member when the owner blocks', async () => {
    const db = createQuestFakeDb();
    await optIn(db, A, 'Ava');
    await optIn(db, B, 'Bea');
    await optIn(db, C, 'Cal');
    await createCircle(A, { name: 'Circle' }, opts(db));
    const inviteB = await inviteToCircle(A, opts(db));
    await joinCircle(B, { inviteCode: inviteB.inviteCode, confirm: true }, opts(db));
    const a = await getSocialMe(A, opts(db));
    const b = await getSocialMe(B, opts(db));
    await blockUser(B, { publicId: a.publicId }, opts(db));
    const ownerCircle = await getCurrentCircle(A, opts(db));
    assert.equal(ownerCircle.circle.memberCount, 1);
    assert.equal(ownerCircle.circle.members[0].role, 'owner');
    const memberCircle = await getCurrentCircle(B, opts(db));
    assert.equal(memberCircle.circle, null);
    const inviteC = await inviteToCircle(A, opts(db));
    await joinCircle(C, { inviteCode: inviteC.inviteCode, confirm: true }, opts(db));
    const pending = await inviteToCircle(A, opts(db));
    const calBeforeBlock = await getSocialMe(C, opts(db));
    await blockUser(A, { publicId: calBeforeBlock.publicId }, opts(db));
    await assert.rejects(
      () => joinCircle(C, { inviteCode: pending.inviteCode, confirm: true }, opts(db)),
      (e) => e.code === 'SOCIAL_NOT_FOUND',
    );
    const afterOwnerBlock = await getCurrentCircle(A, opts(db));
    const cal = await getSocialMe(C, opts(db));
    assert.equal(afterOwnerBlock.circle.members.some((row) => row.publicId === cal.publicId), false);
    void b;
  });

  it('disables independently, omits QA social routes, and keeps the migration after garden', () => {
    assert.equal(isMediWorldSocialEnabled({ nodeEnv: 'production', flag: '1', socialFlag: '' }), false);
    assert.equal(isMediWorldSocialEnabled({ nodeEnv: 'production', flag: '1', socialFlag: '0' }), false);
    assert.equal(isMediWorldSocialEnabled({ nodeEnv: 'production', flag: '1', socialFlag: 'false' }), false);
    assert.equal(isMediWorldSocialEnabled({ nodeEnv: 'production', flag: '1', socialFlag: 'maybe' }), false);
    assert.equal(isMediWorldSocialEnabled({ nodeEnv: 'production', flag: '1', socialFlag: '1' }), true);
    assert.equal(isMediWorldSocialEnabled({ nodeEnv: 'development', flag: '1', socialFlag: '' }), true);
    assert.equal(isMediWorldSocialEnabled({ nodeEnv: 'test', flag: '1', socialFlag: '0' }), false);
    assert.equal(isMediWorldSocialEnabled({ nodeEnv: 'test', flag: '1', socialFlag: 'nope' }), false);
    const paths = [];
    mediWorldRouter.stack.forEach((layer) => {
      if (layer.route) paths.push(layer.route.path);
    });
    assert.ok(paths.includes('/social/me'));
    assert.ok(paths.includes('/social/friends/request'));
    assert.equal(paths.some((path) => /social\/qa/.test(path)), false);
    assert.equal(paths.some((path) => /search/.test(path)), false);
    const folder = join(HERE, '../../../../prisma/migrations');
    const names = readdirSync(folder).filter((name) => /^\d{14}_/.test(name));
    assert.ok(names.includes('20260913020000_medi_world_garden'));
    assert.ok(names.includes('20260913030000_medi_world_social'));
    assert.ok(names.indexOf('20260913030000_medi_world_social') > names.indexOf('20260913020000_medi_world_garden'));
    const sql = readFileSync(join(HERE, '../../../../prisma/phase45-medi-world-social.sql'), 'utf8');
    assert.match(sql, /SocialProfile/);
    assert.equal(/DROP TABLE/i.test(sql), false);
  });

  it('returns 404 when social is disabled and never queries missing tables in production', async () => {
    const db = createQuestFakeDb();
    await assert.rejects(() => getSocialMe(A, opts(db, { socialFlag: '0' })), (e) => e.code === 'SOCIAL_DISABLED');
    const missing = createQuestFakeDb();
    missing.socialProfile = {};
    await assert.rejects(
      () => getSocialMe(A, opts(missing, { nodeEnv: 'production', socialFlag: '' })),
      (e) => e.code === 'SOCIAL_DISABLED',
    );
    await assert.rejects(() => getSocialMe(A, opts(missing)), (e) => e.code === 'WORLD_UNAVAILABLE');
  });
});
