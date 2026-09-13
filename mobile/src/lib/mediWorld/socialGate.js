'use strict';

function isSocialRuntimeAvailable({ worldAvailable, clientEnabled, serverEnabled } = {}) {
  if (worldAvailable === false) return false;
  if (clientEnabled === false) return false;
  return serverEnabled === true;
}

function worldMapRequiresSocialProfile() {
  return false;
}

function worldMapRequiresExploreIntro() {
  return false;
}

function socialUiFailure(error) {
  const status = Number(error?.status || 0);
  if (status === 429) return 'rate_limited';
  if (status === 404 || error?.code === 'SOCIAL_NOT_FOUND') return 'unavailable';
  return 'error';
}

const INBOX_KIND_KEYS = {
  friend_request: 'friendRequest',
  request_accepted: 'requestAccepted',
  care_wave: 'careWave',
  circle_invite: 'circleInvite',
  circle_membership: 'circleMembership',
};

function inboxItemPresentation(item, copy = {}) {
  const payload = item?.payload && typeof item.payload === 'object' ? item.payload : {};
  const sender = String(payload.displayName || '').trim();
  const waveType = String(payload.waveType || '');
  const waveLabel = waveType && copy[waveType] ? copy[waveType] : '';
  const kindKey = INBOX_KIND_KEYS[item?.kind] || '';
  return {
    kindLabel: (kindKey && copy[kindKey]) || item?.kind || '',
    sender,
    waveLabel,
  };
}

module.exports = {
  isSocialRuntimeAvailable,
  socialUiFailure,
  inboxItemPresentation,
  worldMapRequiresSocialProfile,
  worldMapRequiresExploreIntro,
};
