import { randomUUID } from 'node:crypto';
import { prisma as defaultPrisma } from '../../prisma.js';
import { getRealtimeIo } from '../../adminRealtime.js';
import { userSocketRoom } from '../../socketAuth.js';
import { dailyPeriodKey, getEffectiveQuestTimezone } from '../../questTime.js';
import { isPrismaMissing, isUniqueViolation, worldSchemaUnavailableError } from '../engine.js';
import { isMediWorldEnabled, isMediWorldSocialEnabled, mediWorldDisabledError, socialDisabledError } from '../flags.js';
import { evolutionStageByKey } from '../companion/evolution.js';
import {
  CIRCLE_INVITE_LENGTH,
  CIRCLE_INVITE_TTL_MS,
  CIRCLE_MEMBER_CAP,
  ELIGIBILITY_POLICY_VERSION,
  INBOX_RETENTION_MS,
  SOCIAL_PRIVACY_VERSION,
  SOCIAL_RULESET_ID,
  WAVE_OUTGOING_DAILY_CAP,
  WAVE_RECEIVED_SHOWN_CAP,
  WAVE_TYPES,
  generateFriendCode,
  generateOpaqueCode,
  isReportCategory,
  isWaveType,
  normalizeFriendCode,
  pairKeyFor,
} from './codes.js';
import { sanitizeReportDescription, sanitizeSocialBio, sanitizeSocialDisplayName } from './names.js';
import { assertSocialPayloadSafe, buildFriendProjection } from './projection.js';

function dbOf(options = {}) {
  return options.db || defaultPrisma;
}

function httpError(message, status, code) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

function uniformMiss() {
  return httpError('მოთხოვნილი მისამართი ვერ მოიძებნა.', 404, 'SOCIAL_NOT_FOUND');
}

function tablesReady(db) {
  return Boolean(
    db?.socialProfile?.findUnique &&
      db?.socialFriendship?.create &&
      db?.socialBlock?.create &&
      db?.socialCareWave?.create &&
      db?.socialCircle?.create &&
      db?.socialInboxItem?.create &&
      db?.socialReport?.create &&
      db?.socialMutation?.create,
  );
}

async function requireSocial(options = {}) {
  if (!isMediWorldEnabled(options.flags)) throw mediWorldDisabledError();
  if (!isMediWorldSocialEnabled(options.flags)) throw socialDisabledError();
}

async function withSocialTx(options, fn) {
  await requireSocial(options);
  const db = dbOf(options);
  if (!tablesReady(db)) throw worldSchemaUnavailableError();
  try {
    if (typeof db?.$transaction === 'function') return await db.$transaction((tx) => fn(tx));
    return await fn(db);
  } catch (error) {
    if (isPrismaMissing(error) || error?.code === 'P2021') throw worldSchemaUnavailableError();
    throw error;
  }
}

function nowOf(options) {
  return options.now || new Date();
}

function periodOf(options) {
  const timezone = getEffectiveQuestTimezone(options.user || {}, {
    timezone: options.timezone,
    deviceTimezone: options.deviceTimezone,
  });
  return dailyPeriodKey(nowOf(options), timezone);
}

const lookupHits = new Map();

export function resetSocialRateLimitsForTests() {
  lookupHits.clear();
}

function rateLimitFriendLookup(userId) {
  const now = Date.now();
  const recent = (lookupHits.get(userId) || []).filter((stamp) => now - stamp < 60_000);
  if (recent.length >= 8) {
    throw httpError('Too many friend-code lookups.', 429, 'SOCIAL_RATE_LIMIT');
  }
  recent.push(now);
  lookupHits.set(userId, recent);
}

const SOCIAL_INVALIDATION_SIGNALS = new Set(['inbox', 'friendship', 'privacy']);

function emitInvalidation(userId, signal, options = {}) {
  if (!userId || !SOCIAL_INVALIDATION_SIGNALS.has(signal)) return;
  const io = options.io || getRealtimeIo();
  if (!io?.to) return;
  io.to(userSocketRoom(userId)).emit('social:invalidate', { signal });
}

function isEligible(profile) {
  return Boolean(profile?.adultConfirmedAt && profile.socialEnabled && !profile.participationDisabledAt);
}

async function isBlockedPair(tx, a, b) {
  const rows = await tx.socialBlock.findMany({
    where: {
      OR: [
        { blockerId: a, blockedUserId: b },
        { blockerId: b, blockedUserId: a },
      ],
    },
  });
  return rows.length > 0;
}

async function uniqueFriendCode(tx) {
  for (let i = 0; i < 8; i += 1) {
    const friendCode = generateFriendCode();
    const friendCodeNormalized = normalizeFriendCode(friendCode);
    const clash = await tx.socialProfile.findUnique({ where: { friendCodeNormalized } });
    if (!clash) return { friendCode, friendCodeNormalized };
  }
  throw httpError('Could not create a friend code.', 503, 'SOCIAL_CODE_BUSY');
}

async function ensureProfile(tx, userId) {
  const existing = await tx.socialProfile.findUnique({ where: { userId } });
  if (existing) return existing;
  const codes = await uniqueFriendCode(tx);
  try {
    return await tx.socialProfile.create({
      data: {
        userId,
        publicId: randomUUID(),
        displayName: '',
        bio: '',
        friendCode: codes.friendCode,
        friendCodeNormalized: codes.friendCodeNormalized,
        socialEnabled: false,
        privacyVersion: SOCIAL_PRIVACY_VERSION,
        profileVisibility: 'friends_only',
        showWorldLevel: false,
        showBondLevel: false,
        showGardenPreview: false,
        wavesMuted: false,
        mediPresentationKey: 'present.spark',
      },
    });
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    return tx.socialProfile.findUnique({ where: { userId } });
  }
}

async function loadCompanion(tx, userId) {
  if (!tx.mediCompanionProfile?.findUnique) return null;
  return tx.mediCompanionProfile.findUnique({ where: { userId } });
}

async function loadWorld(tx, userId) {
  if (!tx.mediWorldProfile?.findUnique) return null;
  return tx.mediWorldProfile.findUnique({ where: { userId } });
}

async function loadPlants(tx, userId) {
  if (!tx.careGardenPlant?.findMany) return [];
  return tx.careGardenPlant.findMany({ where: { gardenUserId: userId } });
}

async function friendshipFor(tx, userA, userB) {
  return tx.socialFriendship.findUnique({ where: { pairKey: pairKeyFor(userA, userB) } });
}

function otherId(row, userId) {
  return row.requesterId === userId ? row.addresseeId : row.requesterId;
}

function canSeeProjection(profile, relation, inCircle) {
  if (!isEligible(profile)) return false;
  if (profile.profileVisibility !== 'friends_only') return false;
  return relation === 'accepted' || inCircle === true;
}

async function circleMemberUserIds(tx, userId) {
  const memberships = await tx.socialCircleMember.findMany({ where: { userId } });
  const ids = new Set();
  for (const membership of memberships) {
    const members = await tx.socialCircleMember.findMany({ where: { circleId: membership.circleId } });
    members.forEach((item) => ids.add(item.userId));
  }
  ids.delete(userId);
  return ids;
}

async function projectUser(tx, ownerId, viewerId) {
  const profile = await tx.socialProfile.findUnique({ where: { userId: ownerId } });
  if (!profile || !isEligible(profile)) throw uniformMiss();
  const ownerView = ownerId === viewerId;
  if (!ownerView) {
    if (await isBlockedPair(tx, ownerId, viewerId)) throw uniformMiss();
    const relation = await friendshipFor(tx, ownerId, viewerId);
    const circleIds = await circleMemberUserIds(tx, viewerId);
    const inCircle = circleIds.has(ownerId);
    if (!canSeeProjection(profile, relation?.state, inCircle)) throw uniformMiss();
  }
  const companion = await loadCompanion(tx, ownerId);
  const world = await loadWorld(tx, ownerId);
  const plants = await loadPlants(tx, ownerId);
  const stage = evolutionStageByKey(companion?.worldStageKey);
  if (stage && !profile.mediPresentationKey) {
    profile.mediPresentationKey = stage.presentationKey;
  }
  return buildFriendProjection({
    profile,
    viewerIsOwner: ownerView,
    companion,
    world,
    plants,
  });
}

function safeMe(profile, extras = {}) {
  return assertSocialPayloadSafe({
    rulesetId: SOCIAL_RULESET_ID,
    publicId: profile.publicId,
    displayName: profile.displayName,
    bio: profile.bio,
    friendCode: profile.friendCode,
    socialEnabled: isEligible(profile),
    eligibility: profile.adultConfirmedAt ? 'adult_confirmed' : 'unknown',
    eligibilityPolicyVersion: profile.eligibilityPolicyVersion,
    privacy: {
      version: profile.privacyVersion,
      profileVisibility: profile.profileVisibility,
      showWorldLevel: profile.showWorldLevel,
      showBondLevel: profile.showBondLevel,
      showGardenPreview: profile.showGardenPreview,
      wavesMuted: profile.wavesMuted,
    },
    ...extras,
  });
}

export async function getSocialMe(userId, options = {}) {
  return withSocialTx(options, async (tx) => {
    const profile = await ensureProfile(tx, userId);
    return safeMe(profile);
  });
}

export async function confirmSocialEligibility(userId, body, options = {}) {
  return withSocialTx(options, async (tx) => {
    const profile = await ensureProfile(tx, userId);
    if (body?.confirmAdult !== true) {
      throw httpError('Social features stay off until you confirm.', 400, 'SOCIAL_ELIGIBILITY_REQUIRED');
    }
    const updated = await tx.socialProfile.update({
      where: { userId },
      data: {
        adultConfirmedAt: profile.adultConfirmedAt || nowOf(options),
        eligibilityPolicyVersion: ELIGIBILITY_POLICY_VERSION,
      },
    });
    return safeMe(updated);
  });
}

export async function updateSocialMe(userId, body, options = {}) {
  return withSocialTx(options, async (tx) => {
    const profile = await ensureProfile(tx, userId);
    if (!profile.adultConfirmedAt) throw httpError('Social features stay off until you confirm.', 403, 'SOCIAL_ELIGIBILITY_UNKNOWN');
    const data = {};
    if (body.displayName != null) data.displayName = sanitizeSocialDisplayName(body.displayName);
    if (body.bio != null) data.bio = sanitizeSocialBio(body.bio);
    if (body.socialEnabled === false) {
      data.socialEnabled = false;
      data.participationDisabledAt = nowOf(options);
    }
    if (body.socialEnabled === true) {
      data.socialEnabled = true;
      data.participationDisabledAt = null;
    }
    const nextName = data.displayName ?? profile.displayName;
    const nextEnabled = data.socialEnabled === true || (data.socialEnabled !== false && profile.socialEnabled && !profile.participationDisabledAt);
    if (nextEnabled && !String(nextName || '').trim()) {
      throw httpError('Choose a game name before turning Social on.', 400, 'SOCIAL_NAME_REQUIRED');
    }
    const companion = await loadCompanion(tx, userId);
    const stage = evolutionStageByKey(companion?.worldStageKey);
    if (stage) data.mediPresentationKey = stage.presentationKey;
    const updated = await tx.socialProfile.update({ where: { userId }, data });
    return safeMe(updated);
  });
}

export async function updateSocialPrivacy(userId, body, options = {}) {
  return withSocialTx(options, async (tx) => {
    const profile = await ensureProfile(tx, userId);
    if (!isEligible(profile)) throw httpError('Social features stay off until you confirm.', 403, 'SOCIAL_ELIGIBILITY_UNKNOWN');
    const updated = await tx.socialProfile.update({
      where: { userId },
      data: {
        showWorldLevel: body.showWorldLevel === true,
        showBondLevel: body.showBondLevel === true,
        showGardenPreview: body.showGardenPreview === true,
        wavesMuted: body.wavesMuted === true,
        profileVisibility: 'friends_only',
        privacyVersion: SOCIAL_PRIVACY_VERSION,
      },
    });
    const friends = await tx.socialFriendship.findMany({
      where: {
        state: 'accepted',
        OR: [{ requesterId: userId }, { addresseeId: userId }],
      },
    });
    for (const row of friends) {
      emitInvalidation(otherId(row, userId), 'privacy', options);
    }
    return safeMe(updated);
  });
}

export async function rotateFriendCode(userId, options = {}) {
  return withSocialTx(options, async (tx) => {
    const profile = await ensureProfile(tx, userId);
    if (!isEligible(profile)) throw httpError('Social features stay off until you confirm.', 403, 'SOCIAL_ELIGIBILITY_UNKNOWN');
    const codes = await uniqueFriendCode(tx);
    const updated = await tx.socialProfile.update({
      where: { userId },
      data: { friendCode: codes.friendCode, friendCodeNormalized: codes.friendCodeNormalized },
    });
    return safeMe(updated);
  });
}

export async function getOwnerPreview(userId, options = {}) {
  return withSocialTx(options, async (tx) => projectUser(tx, userId, userId));
}

export async function requestFriend(userId, body, options = {}) {
  return withSocialTx(options, async (tx) => {
    const me = await ensureProfile(tx, userId);
    if (!isEligible(me)) throw httpError('Social features stay off until you confirm.', 403, 'SOCIAL_ELIGIBILITY_UNKNOWN');
    rateLimitFriendLookup(userId);
    const normalized = normalizeFriendCode(body?.friendCode);
    if (normalized.length < 8) throw uniformMiss();
    const target = await tx.socialProfile.findUnique({ where: { friendCodeNormalized: normalized } });
    if (!target || target.userId === userId || !isEligible(target)) throw uniformMiss();
    if (await isBlockedPair(tx, userId, target.userId)) throw uniformMiss();
    const pairKey = pairKeyFor(userId, target.userId);
    const existing = await tx.socialFriendship.findUnique({ where: { pairKey } });
    if (existing?.state === 'blocked' && (await isBlockedPair(tx, userId, target.userId))) throw uniformMiss();
    if (existing?.state === 'accepted') {
      return assertSocialPayloadSafe({ relationshipId: existing.id, state: 'accepted' });
    }
    if (existing?.state === 'pending') {
      if (existing.addresseeId === userId) {
        const accepted = await tx.socialFriendship.update({
          where: { id: existing.id },
          data: { state: 'accepted' },
        });
        await pushInbox(tx, accepted.requesterId, 'request_accepted', `accepted:${accepted.id}`, {
          publicId: me.publicId,
          displayName: me.displayName,
        });
        emitInvalidation(accepted.requesterId, 'friendship', options);
        return assertSocialPayloadSafe({ relationshipId: accepted.id, state: 'accepted' });
      }
      return assertSocialPayloadSafe({ relationshipId: existing.id, state: 'pending' });
    }
    const created = existing
      ? await tx.socialFriendship.update({
          where: { id: existing.id },
          data: { requesterId: userId, addresseeId: target.userId, state: 'pending' },
        })
      : await tx.socialFriendship.create({
          data: {
            id: randomUUID(),
            pairKey,
            requesterId: userId,
            addresseeId: target.userId,
            state: 'pending',
            idempotencyKey: body?.idempotencyKey || null,
          },
        });
    await pushInbox(tx, target.userId, 'friend_request', `request:${created.id}`, {
      publicId: me.publicId,
      displayName: me.displayName,
      relationshipId: created.id,
    });
    emitInvalidation(target.userId, 'inbox', options);
    return assertSocialPayloadSafe({ relationshipId: created.id, state: 'pending' });
  });
}

async function requireRelationship(tx, userId, relationshipId) {
  const row = await tx.socialFriendship.findUnique({ where: { id: relationshipId } });
  if (!row || (row.requesterId !== userId && row.addresseeId !== userId)) throw uniformMiss();
  return row;
}

export async function acceptFriend(userId, relationshipId, options = {}) {
  return withSocialTx(options, async (tx) => {
    const row = await requireRelationship(tx, userId, relationshipId);
    if (row.addresseeId !== userId || row.state !== 'pending') throw uniformMiss();
    if (await isBlockedPair(tx, row.requesterId, row.addresseeId)) throw uniformMiss();
    const updated = await tx.socialFriendship.update({ where: { id: row.id }, data: { state: 'accepted' } });
    const me = await tx.socialProfile.findUnique({ where: { userId } });
    await pushInbox(tx, updated.requesterId, 'request_accepted', `accepted:${updated.id}`, {
      publicId: me.publicId,
      displayName: me.displayName,
    });
    emitInvalidation(updated.requesterId, 'friendship', options);
    emitInvalidation(updated.addresseeId, 'friendship', options);
    return assertSocialPayloadSafe({ relationshipId: updated.id, state: 'accepted' });
  });
}

export async function declineFriend(userId, relationshipId, options = {}) {
  return withSocialTx(options, async (tx) => {
    const row = await requireRelationship(tx, userId, relationshipId);
    if (row.addresseeId !== userId || row.state !== 'pending') throw uniformMiss();
    const updated = await tx.socialFriendship.update({ where: { id: row.id }, data: { state: 'declined' } });
    return assertSocialPayloadSafe({ relationshipId: updated.id, state: 'declined' });
  });
}

export async function cancelFriend(userId, relationshipId, options = {}) {
  return withSocialTx(options, async (tx) => {
    const row = await requireRelationship(tx, userId, relationshipId);
    if (row.requesterId !== userId || row.state !== 'pending') throw uniformMiss();
    const updated = await tx.socialFriendship.update({ where: { id: row.id }, data: { state: 'cancelled' } });
    return assertSocialPayloadSafe({ relationshipId: updated.id, state: 'cancelled' });
  });
}

export async function removeFriend(userId, relationshipId, options = {}) {
  return withSocialTx(options, async (tx) => {
    const row = await requireRelationship(tx, userId, relationshipId);
    if (row.state !== 'accepted') throw uniformMiss();
    const updated = await tx.socialFriendship.update({ where: { id: row.id }, data: { state: 'removed' } });
    emitInvalidation(otherId(row, userId), 'privacy', options);
    return assertSocialPayloadSafe({ relationshipId: updated.id, state: 'removed' });
  });
}

export async function listFriends(userId, options = {}) {
  return withSocialTx(options, async (tx) => {
    const me = await ensureProfile(tx, userId);
    const rows = await tx.socialFriendship.findMany({
      where: {
        state: { in: ['pending', 'accepted'] },
        OR: [{ requesterId: userId }, { addresseeId: userId }],
      },
    });
    const items = [];
    for (const row of rows) {
      const other = otherId(row, userId);
      const profile = await tx.socialProfile.findUnique({ where: { userId: other } });
      items.push({
        relationshipId: row.id,
        state: row.state,
        direction: row.requesterId === userId ? 'outgoing' : 'incoming',
        publicId: profile?.publicId || null,
        displayName: row.state === 'accepted' ? profile?.displayName || '' : profile?.displayName || '',
      });
    }
    return assertSocialPayloadSafe({ socialEnabled: isEligible(me), items });
  });
}

export async function getFriendProfile(userId, relationshipId, options = {}) {
  return withSocialTx(options, async (tx) => {
    const row = await requireRelationship(tx, userId, relationshipId);
    if (row.state !== 'accepted') throw uniformMiss();
    return projectUser(tx, otherId(row, userId), userId);
  });
}

async function restrictCirclesOnBlock(tx, blockerId, blockedUserId) {
  const blockerMemberships = await tx.socialCircleMember.findMany({ where: { userId: blockerId } });
  const blockedMemberships = await tx.socialCircleMember.findMany({ where: { userId: blockedUserId } });
  const blockerCircleIds = new Set(blockerMemberships.map((row) => row.circleId));
  const sharedIds = blockedMemberships
    .map((row) => row.circleId)
    .filter((circleId) => blockerCircleIds.has(circleId));
  for (const circleId of sharedIds) {
    const circle = await tx.socialCircle.findUnique({ where: { id: circleId } });
    if (!circle) continue;
    await tx.socialCircleInvite.updateMany({
      where: { circleId, usedAt: null, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (circle.ownerUserId === blockedUserId) {
      await tx.socialCircleMember.deleteMany({ where: { circleId, userId: blockerId } });
    } else {
      await tx.socialCircleMember.deleteMany({ where: { circleId, userId: blockedUserId } });
    }
  }
}

export async function blockUser(userId, body, options = {}) {
  return withSocialTx(options, async (tx) => {
    const me = await ensureProfile(tx, userId);
    if (!me.adultConfirmedAt) throw httpError('Social features stay off until you confirm.', 403, 'SOCIAL_ELIGIBILITY_UNKNOWN');
    const target = await tx.socialProfile.findUnique({ where: { publicId: String(body?.publicId || '') } });
    if (!target || target.userId === userId) throw uniformMiss();
    let block = await tx.socialBlock.findFirst({ where: { blockerId: userId, blockedUserId: target.userId } });
    if (!block) {
      block = await tx.socialBlock.create({
        data: { id: randomUUID(), blockerId: userId, blockedUserId: target.userId },
      });
    }
    const relation = await friendshipFor(tx, userId, target.userId);
    if (relation) {
      await tx.socialFriendship.update({ where: { id: relation.id }, data: { state: 'blocked' } });
    }
    await restrictCirclesOnBlock(tx, userId, target.userId);
    emitInvalidation(target.userId, 'privacy', options);
    emitInvalidation(userId, 'privacy', options);
    return assertSocialPayloadSafe({ blockId: block.id });
  });
}

export async function unblockUser(userId, blockId, options = {}) {
  return withSocialTx(options, async (tx) => {
    const row = await tx.socialBlock.findUnique({ where: { id: blockId } });
    if (!row || row.blockerId !== userId) throw uniformMiss();
    await tx.socialBlock.delete({ where: { id: row.id } });
    return assertSocialPayloadSafe({ ok: true });
  });
}

export async function listBlocks(userId, options = {}) {
  return withSocialTx(options, async (tx) => {
    const rows = await tx.socialBlock.findMany({ where: { blockerId: userId } });
    const items = [];
    for (const row of rows) {
      const profile = await tx.socialProfile.findUnique({ where: { userId: row.blockedUserId } });
      items.push({ blockId: row.id, publicId: profile?.publicId || null, displayName: profile?.displayName || '' });
    }
    return assertSocialPayloadSafe({ items });
  });
}

export async function sendWave(userId, body, options = {}) {
  return withSocialTx(options, async (tx) => {
    const me = await ensureProfile(tx, userId);
    if (!isEligible(me)) throw httpError('Social features stay off until you confirm.', 403, 'SOCIAL_ELIGIBILITY_UNKNOWN');
    if (!isWaveType(body?.waveType)) throw httpError('That Care Wave is not available.', 400, 'SOCIAL_WAVE_TYPE');
    const target = await tx.socialProfile.findUnique({ where: { publicId: String(body?.publicId || '') } });
    if (!target || !isEligible(target) || target.wavesMuted) throw uniformMiss();
    if (await isBlockedPair(tx, userId, target.userId)) throw uniformMiss();
    const relation = await friendshipFor(tx, userId, target.userId);
    const circleIds = await circleMemberUserIds(tx, userId);
    if (relation?.state !== 'accepted' && !circleIds.has(target.userId)) throw uniformMiss();
    const periodKey = periodOf(options);
    const outgoing = await tx.socialCareWave.findMany({ where: { senderId: userId, periodKey } });
    if (outgoing.length >= WAVE_OUTGOING_DAILY_CAP) {
      throw httpError('Today’s Care Wave limit is reached.', 429, 'SOCIAL_WAVE_CAP');
    }
    const idempotencyKey = String(body?.idempotencyKey || `wave:${body.waveType}:${periodKey}:${target.userId}`);
    const existing = await tx.socialCareWave.findFirst({
      where: { senderId: userId, idempotencyKey },
    });
    if (existing) return assertSocialPayloadSafe({ waveId: existing.id, waveType: existing.waveType, when: 'today' });
    try {
      const wave = await tx.socialCareWave.create({
        data: {
          id: randomUUID(),
          senderId: userId,
          recipientId: target.userId,
          waveType: body.waveType,
          periodKey,
          idempotencyKey,
        },
      });
      await pushInbox(tx, target.userId, 'care_wave', `wave:${wave.id}`, {
        publicId: me.publicId,
        displayName: me.displayName,
        waveType: wave.waveType,
        when: 'today',
      });
      emitInvalidation(target.userId, 'inbox', options);
      return assertSocialPayloadSafe({ waveId: wave.id, waveType: wave.waveType, when: 'today' });
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      const dup = await tx.socialCareWave.findFirst({
        where: { senderId: userId, recipientId: target.userId, waveType: body.waveType, periodKey },
      });
      if (dup) return assertSocialPayloadSafe({ waveId: dup.id, waveType: dup.waveType, when: 'today' });
      throw error;
    }
  });
}

export async function listWaves(userId, options = {}) {
  return withSocialTx(options, async (tx) => {
    const periodKey = periodOf(options);
    const rows = await tx.socialCareWave.findMany({
      where: { recipientId: userId, periodKey },
    });
    const items = [];
    for (const row of rows.slice(0, WAVE_RECEIVED_SHOWN_CAP)) {
      const sender = await tx.socialProfile.findUnique({ where: { userId: row.senderId } });
      items.push({
        waveId: row.id,
        waveType: row.waveType,
        when: 'today',
        publicId: sender?.publicId || null,
        displayName: sender?.displayName || '',
      });
    }
    return assertSocialPayloadSafe({ items, types: WAVE_TYPES });
  });
}

async function pushInbox(tx, recipientId, kind, dedupeKey, payload) {
  const now = new Date();
  const stale = await tx.socialInboxItem.findMany({
    where: { recipientId, createdAt: { lt: new Date(now.getTime() - INBOX_RETENTION_MS) } },
  });
  if (stale.length) {
    await tx.socialInboxItem.deleteMany({ where: { id: { in: stale.map((row) => row.id) } } });
  }
  const existing = (await tx.socialInboxItem.findMany({ where: { recipientId, dedupeKey } }))[0];
  if (existing) {
    await tx.socialInboxItem.update({
      where: { id: existing.id },
      data: { kind, payload, readAt: null },
    });
    return;
  }
  await tx.socialInboxItem.create({
    data: {
      id: randomUUID(),
      recipientId,
      kind,
      dedupeKey,
      payload,
    },
  });
}

export async function listInbox(userId, query, options = {}) {
  return withSocialTx(options, async (tx) => {
    const take = Math.min(50, Math.max(1, Number(query?.take) || 20));
    const rows = await tx.socialInboxItem.findMany({
      where: { recipientId: userId },
    });
    const sorted = [...rows].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const start = query?.cursor ? sorted.findIndex((row) => row.id === query.cursor) + 1 : 0;
    const slice = sorted.slice(Math.max(0, start), Math.max(0, start) + take);
    return assertSocialPayloadSafe({
      items: slice.map((row) => ({
        itemId: row.id,
        kind: row.kind,
        payload: row.payload,
        read: Boolean(row.readAt),
        when: 'recent',
      })),
      nextCursor: slice.length === take ? slice[slice.length - 1].id : null,
    });
  });
}

export async function readInboxItem(userId, itemId, options = {}) {
  return withSocialTx(options, async (tx) => {
    const row = await tx.socialInboxItem.findUnique({ where: { id: itemId } });
    if (!row || row.recipientId !== userId) throw uniformMiss();
    await tx.socialInboxItem.update({ where: { id: row.id }, data: { readAt: nowOf(options) } });
    return assertSocialPayloadSafe({ itemId: row.id, read: true });
  });
}

export async function createCircle(userId, body, options = {}) {
  return withSocialTx(options, async (tx) => {
    const me = await ensureProfile(tx, userId);
    if (!isEligible(me)) throw httpError('Social features stay off until you confirm.', 403, 'SOCIAL_ELIGIBILITY_UNKNOWN');
    const existing = await tx.socialCircle.findUnique({ where: { ownerUserId: userId } });
    if (existing) return { circle: await publicCircle(tx, existing, userId) };
    const circle = await tx.socialCircle.create({
      data: {
        id: randomUUID(),
        publicId: randomUUID(),
        ownerUserId: userId,
        name: sanitizeSocialDisplayName(body?.name || me.displayName || 'Circle'),
      },
    });
    await tx.socialCircleMember.create({
      data: { id: randomUUID(), circleId: circle.id, userId, role: 'owner' },
    });
    return { circle: await publicCircle(tx, circle, userId) };
  });
}

async function publicCircle(tx, circle, viewerId) {
  const members = await tx.socialCircleMember.findMany({ where: { circleId: circle.id } });
  const items = [];
  for (const member of members) {
    const profile = await tx.socialProfile.findUnique({ where: { userId: member.userId } });
    items.push({
      publicId: profile?.publicId || null,
      displayName: profile?.displayName || '',
      role: member.role,
      viewer: member.userId === viewerId,
    });
  }
  return assertSocialPayloadSafe({
    circleId: circle.publicId,
    name: circle.name,
    memberCount: items.length,
    memberCap: CIRCLE_MEMBER_CAP,
    members: items,
  });
}

export async function getCurrentCircle(userId, options = {}) {
  return withSocialTx(options, async (tx) => {
    const membership = await tx.socialCircleMember.findFirst({ where: { userId } });
    if (!membership) return assertSocialPayloadSafe({ circle: null });
    const circle = await tx.socialCircle.findUnique({ where: { id: membership.circleId } });
    if (!circle) return assertSocialPayloadSafe({ circle: null });
    return { circle: await publicCircle(tx, circle, userId) };
  });
}

export async function inviteToCircle(userId, options = {}) {
  return withSocialTx(options, async (tx) => {
    const circle = await tx.socialCircle.findUnique({ where: { ownerUserId: userId } });
    if (!circle) throw uniformMiss();
    await tx.socialCircleInvite.updateMany({
      where: { circleId: circle.id, usedAt: null, revokedAt: null },
      data: { revokedAt: nowOf(options) },
    });
    const code = generateOpaqueCode(CIRCLE_INVITE_LENGTH);
    const invite = await tx.socialCircleInvite.create({
      data: {
        id: randomUUID(),
        circleId: circle.id,
        codeNormalized: code,
        expiresAt: new Date(nowOf(options).getTime() + CIRCLE_INVITE_TTL_MS),
      },
    });
    return assertSocialPayloadSafe({ inviteCode: invite.codeNormalized, expiresInHours: 24 });
  });
}

export async function joinCircle(userId, body, options = {}) {
  return withSocialTx(options, async (tx) => {
    const me = await ensureProfile(tx, userId);
    if (!isEligible(me)) throw httpError('Social features stay off until you confirm.', 403, 'SOCIAL_ELIGIBILITY_UNKNOWN');
    if (body?.confirm !== true) throw httpError('Joining a Circle needs an explicit confirmation.', 400, 'SOCIAL_CIRCLE_CONFIRM');
    const code = normalizeFriendCode(body?.inviteCode);
    const invite =
      (await tx.socialCircleInvite.findUnique({ where: { codeNormalized: code } })) ||
      (await tx.socialCircleInvite.findFirst({ where: { codeNormalized: code } }));
    const now = nowOf(options);
    const expired = invite ? new Date(invite.expiresAt).getTime() <= now.getTime() : true;
    if (!invite || invite.revokedAt || invite.usedAt || expired) throw uniformMiss();
    const circle = await tx.socialCircle.findUnique({ where: { id: invite.circleId } });
    if (!circle) throw uniformMiss();
    if (await isBlockedPair(tx, userId, circle.ownerUserId)) throw uniformMiss();
    const members = await tx.socialCircleMember.findMany({ where: { circleId: circle.id } });
    if (members.length >= CIRCLE_MEMBER_CAP) throw httpError('This Circle is full.', 409, 'SOCIAL_CIRCLE_FULL');
    if (members.some((item) => item.userId === userId)) {
      return { circle: await publicCircle(tx, circle, userId) };
    }
    await tx.socialCircleMember.create({
      data: { id: randomUUID(), circleId: circle.id, userId, role: 'member' },
    });
    await tx.socialCircleInvite.update({
      where: { id: invite.id },
      data: { usedAt: now, usedByUserId: userId },
    });
    await pushInbox(tx, circle.ownerUserId, 'circle_membership', `join:${circle.id}:${me.publicId}`, {
      publicId: me.publicId,
      displayName: me.displayName,
    });
    await pushInbox(tx, userId, 'circle_invite', `joined:${circle.publicId}`, {
      circleId: circle.publicId,
      name: circle.name,
    });
    return { circle: await publicCircle(tx, circle, userId) };
  });
}

export async function leaveCircle(userId, options = {}) {
  return withSocialTx(options, async (tx) => {
    const membership = await tx.socialCircleMember.findFirst({ where: { userId } });
    if (!membership) throw uniformMiss();
    if (membership.role === 'owner') throw httpError('Transfer ownership before leaving.', 409, 'SOCIAL_CIRCLE_OWNER');
    await tx.socialCircleMember.delete({ where: { id: membership.id } });
    return assertSocialPayloadSafe({ ok: true });
  });
}

export async function removeCircleMember(userId, body, options = {}) {
  return withSocialTx(options, async (tx) => {
    const circle = await tx.socialCircle.findUnique({ where: { ownerUserId: userId } });
    if (!circle) throw uniformMiss();
    const target = await tx.socialProfile.findUnique({ where: { publicId: String(body?.publicId || '') } });
    if (!target || target.userId === userId) throw uniformMiss();
    await tx.socialCircleMember.deleteMany({ where: { circleId: circle.id, userId: target.userId } });
    return { circle: await publicCircle(tx, circle, userId) };
  });
}

export async function transferCircle(userId, body, options = {}) {
  return withSocialTx(options, async (tx) => {
    if (body?.confirm !== true) throw httpError('Ownership transfer needs confirmation.', 400, 'SOCIAL_CIRCLE_CONFIRM');
    const circle = await tx.socialCircle.findUnique({ where: { ownerUserId: userId } });
    if (!circle) throw uniformMiss();
    const target = await tx.socialProfile.findUnique({ where: { publicId: String(body?.publicId || '') } });
    if (!target) throw uniformMiss();
    const member = await tx.socialCircleMember.findFirst({ where: { circleId: circle.id, userId: target.userId } });
    if (!member) throw uniformMiss();
    await tx.socialCircleMember.updateMany({ where: { circleId: circle.id, userId }, data: { role: 'member' } });
    await tx.socialCircleMember.updateMany({ where: { circleId: circle.id, userId: target.userId }, data: { role: 'owner' } });
    await tx.socialCircle.update({ where: { id: circle.id }, data: { ownerUserId: target.userId } });
    return { circle: await publicCircle(tx, { ...circle, ownerUserId: target.userId }, userId) };
  });
}

export async function deleteCircle(userId, body, options = {}) {
  return withSocialTx(options, async (tx) => {
    if (body?.confirm !== true) throw httpError('Deleting a Circle needs confirmation.', 400, 'SOCIAL_CIRCLE_CONFIRM');
    const circle = await tx.socialCircle.findUnique({ where: { ownerUserId: userId } });
    if (!circle) throw uniformMiss();
    await tx.socialCircleInvite.deleteMany({ where: { circleId: circle.id } });
    await tx.socialCircleMember.deleteMany({ where: { circleId: circle.id } });
    await tx.socialCircle.delete({ where: { id: circle.id } });
    return assertSocialPayloadSafe({ ok: true });
  });
}

export async function createReport(userId, body, options = {}) {
  return withSocialTx(options, async (tx) => {
    const me = await ensureProfile(tx, userId);
    if (!me.adultConfirmedAt) throw httpError('Social features stay off until you confirm.', 403, 'SOCIAL_ELIGIBILITY_UNKNOWN');
    if (!isReportCategory(body?.category)) throw httpError('Choose a report category.', 400, 'SOCIAL_REPORT_CATEGORY');
    const description = sanitizeReportDescription(body?.description || '');
    const recent = await tx.socialReport.findMany({ where: { reporterId: userId } });
    const today = periodOf(options);
    const timezone = getEffectiveQuestTimezone(options.user || {}, { timezone: options.timezone });
    const same = recent.filter((row) => dailyPeriodKey(row.createdAt, timezone) === today && row.targetPublicId === body.targetPublicId && row.category === body.category);
    if (same.length) return assertSocialPayloadSafe({ reportId: same[0].id, offerBlock: true });
    const report = await tx.socialReport.create({
      data: {
        id: randomUUID(),
        reporterId: userId,
        targetPublicId: String(body.targetPublicId || ''),
        category: body.category,
        description,
        createdAt: nowOf(options),
      },
    });
    return assertSocialPayloadSafe({ reportId: report.id, offerBlock: true });
  });
}

export const WAVE_COPY = Object.freeze({
  ka: {
    hello: 'გამარჯობა',
    cheer: 'ძალიან კარგი',
    proud_of_you: 'შენით ვამაყობ',
    gentle_support: 'ნაზი მხარდაჭერა',
    garden_love: 'ბაღის სიყვარული',
  },
  en: {
    hello: 'Hello',
    cheer: 'Cheer',
    proud_of_you: 'Proud of you',
    gentle_support: 'Gentle support',
    garden_love: 'Garden love',
  },
});
