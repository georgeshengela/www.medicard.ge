'use strict';

function socialCacheKey(userId) {
  if (!userId) return null;
  return `medicard.mediWorld.socialCache.${userId}`;
}

function wrapSocialDisk(userId, payload) {
  if (!userId || !payload || typeof payload !== 'object') return null;
  return JSON.stringify({ userId, payload });
}

function unwrapSocialDisk(raw, userId) {
  if (!raw || !userId) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.userId !== userId || !parsed.payload || typeof parsed.payload !== 'object') {
      return null;
    }
    return parsed.payload;
  } catch {
    return null;
  }
}

module.exports = { socialCacheKey, wrapSocialDisk, unwrapSocialDisk };
