'use strict';

/**
 * Shared in-memory World economy snapshot.
 * Expo Router keeps Medi World Hub mounted under Movement, so a mount-only
 * fetch cannot see a movement reward. Finish writes the server snapshot here;
 * Hub and Companion subscribe instead of waiting for a remount.
 */

let profileSnapshot = null;
let companionSnapshot = null;
let companionEpoch = 0;
let gardenSnapshot = null;
let socialSnapshot = null;
let socialOwnerId = null;
const friendProjections = new Map();
const profileListeners = new Set();
const companionListeners = new Set();
const gardenListeners = new Set();
const socialListeners = new Set();

function emit(listeners) {
  listeners.forEach((listener) => listener());
}

function subscribe(listeners) {
  return (listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };
}

function resetWorldEconomyCache() {
  profileSnapshot = null;
  companionSnapshot = null;
  companionEpoch = 0;
  gardenSnapshot = null;
  socialSnapshot = null;
  socialOwnerId = null;
  friendProjections.clear();
  emit(profileListeners);
  emit(companionListeners);
  emit(gardenListeners);
  emit(socialListeners);
}

function subscribeWorldProfile(listener) {
  return subscribe(profileListeners)(listener);
}

function getWorldProfileSnapshot() {
  return profileSnapshot;
}

function rememberWorldProfile(payload) {
  if (!payload || !payload.profile) return false;
  profileSnapshot = payload;
  emit(profileListeners);
  return true;
}

function subscribeCompanionWorld(listener) {
  return subscribe(companionListeners)(listener);
}

function getCompanionWorldSnapshot() {
  return companionSnapshot;
}

function getCompanionWorldEpoch() {
  return companionEpoch;
}

function rememberCompanionWorld(payload) {
  if (!payload || !payload.companion) return false;
  companionSnapshot = payload;
  emit(companionListeners);
  return true;
}

function patchCompanionWorldFromProfile(world) {
  if (!companionSnapshot || !world?.profile) return false;
  const care = world.profile.careEnergy || companionSnapshot.world?.careEnergy;
  companionSnapshot = {
    ...companionSnapshot,
    world: {
      ...companionSnapshot.world,
      worldLevel: world.profile.worldLevel ?? companionSnapshot.world?.worldLevel,
      worldXp: world.profile.worldXp ?? companionSnapshot.world?.worldXp,
      careEnergy: { ...companionSnapshot.world?.careEnergy, ...care },
    },
  };
  emit(companionListeners);
  return true;
}

function bumpCompanionWorld() {
  companionEpoch += 1;
  emit(companionListeners);
}

/**
 * Apply the authoritative GET /api/medi-world snapshot returned by finish.
 * No local XP/level formula. Failed/offline callers must not invoke this.
 */
function applyAuthoritativeWorldFromFinish(world, extras = {}) {
  if (!world?.profile) return false;
  rememberWorldProfile(world);
  patchCompanionWorldFromProfile(world);
  if (extras.bondChanged) bumpCompanionWorld();
  return true;
}

function subscribeGarden(listener) {
  return subscribe(gardenListeners)(listener);
}

function getGardenSnapshot() {
  return gardenSnapshot;
}

function rememberGarden(payload) {
  if (payload?.enabled === false && payload.plots == null) {
    gardenSnapshot = payload;
    emit(gardenListeners);
    return true;
  }
  if (!payload?.plots) return false;
  gardenSnapshot = payload;
  emit(gardenListeners);
  if (payload.world?.profile) applyAuthoritativeWorldFromFinish(payload.world);
  return true;
}

function subscribeSocial(listener) {
  return subscribe(socialListeners)(listener);
}

function getSocialSnapshot(userId) {
  if (!socialSnapshot) return null;
  if (userId && socialOwnerId && socialOwnerId !== userId) return null;
  return socialSnapshot;
}

function rememberSocial(payload, ownerUserId) {
  if (!payload || typeof payload !== 'object') return false;
  socialSnapshot = payload;
  socialOwnerId = ownerUserId || null;
  emit(socialListeners);
  return true;
}

function rememberFriendProjection(ownerUserId, relationshipId, payload) {
  if (!ownerUserId || !relationshipId || !payload || typeof payload !== 'object') return false;
  friendProjections.set(`${ownerUserId}:${relationshipId}`, payload);
  return true;
}

function getFriendProjection(ownerUserId, relationshipId) {
  if (!ownerUserId || !relationshipId) return null;
  return friendProjections.get(`${ownerUserId}:${relationshipId}`) || null;
}

function revokeFriendProjection(ownerUserId, relationshipId) {
  if (!ownerUserId) return false;
  if (relationshipId) {
    return friendProjections.delete(`${ownerUserId}:${relationshipId}`);
  }
  let removed = false;
  for (const key of [...friendProjections.keys()]) {
    if (key.startsWith(`${ownerUserId}:`)) {
      friendProjections.delete(key);
      removed = true;
    }
  }
  return removed;
}

module.exports = {
  resetWorldEconomyCache,
  subscribeWorldProfile,
  getWorldProfileSnapshot,
  rememberWorldProfile,
  subscribeCompanionWorld,
  getCompanionWorldSnapshot,
  getCompanionWorldEpoch,
  rememberCompanionWorld,
  patchCompanionWorldFromProfile,
  bumpCompanionWorld,
  applyAuthoritativeWorldFromFinish,
  subscribeGarden,
  getGardenSnapshot,
  rememberGarden,
  subscribeSocial,
  getSocialSnapshot,
  rememberSocial,
  rememberFriendProjection,
  getFriendProjection,
  revokeFriendProjection,
};
