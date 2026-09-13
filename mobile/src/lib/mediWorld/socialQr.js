'use strict';

const FRIEND_CODE_RE = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{5}-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{5}$/;

function normalizeFriendCodeInput(raw) {
  return String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .replace(/^(.{5})(.{5})$/, '$1-$2');
}

function buildSocialFriendQrPayload(friendCode) {
  const code = normalizeFriendCodeInput(friendCode);
  if (!FRIEND_CODE_RE.test(code)) return null;
  return `medicard://medi-world/social/add?code=${encodeURIComponent(code)}`;
}

function parseSocialFriendQrPayload(raw) {
  if (raw == null || String(raw).trim() === '') {
    return { ok: false, reason: 'missing' };
  }
  let url;
  try {
    url = new URL(String(raw).trim());
  } catch {
    return { ok: false, reason: 'malformed' };
  }
  if (url.protocol !== 'medicard:') return { ok: false, reason: 'malformed' };
  if (url.username || url.password) return { ok: false, reason: 'malformed' };
  const hostPath = `${url.host}${url.pathname}`.replace(/\/+$/, '');
  if (hostPath !== 'medi-world/social/add') return { ok: false, reason: 'malformed' };
  const keys = [...url.searchParams.keys()];
  if (keys.some((key) => key !== 'code')) return { ok: false, reason: 'malformed' };
  const code = normalizeFriendCodeInput(url.searchParams.get('code'));
  if (!code) return { ok: false, reason: 'missing' };
  if (!FRIEND_CODE_RE.test(code)) return { ok: false, reason: 'malformed' };
  return {
    ok: true,
    code,
    payload: buildSocialFriendQrPayload(code),
  };
}

module.exports = {
  FRIEND_CODE_RE,
  normalizeFriendCodeInput,
  buildSocialFriendQrPayload,
  parseSocialFriendQrPayload,
};
